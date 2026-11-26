// Helpers for the on-device test (device.spec.ts): adb, the Chrome DevTools connection to the app's
// Android WebView, and engine/host calls made from inside the page.
//
// HOW IT CONNECTS
//   The debug APK enables WebView debugging (BuildConfig.WEBVIEW_DEBUGGING). Each app process exposes the
//   abstract socket `webview_devtools_remote_<pid>`; `connect()` forwards it to tcp:9222 on this machine
//   and attaches Playwright with `chromium.connectOverCDP`. A restarted process has a new pid, socket,
//   host port and token, so every step asks `app()` for the page instead of keeping one.
//
// ENGINE / HOST CALLS
//   Made by the page itself (same origin, session cookie): `engine(page, 'deckTree', {...})` encodes the
//   request with the generated protobuf classes here, the page POSTs it to `/_anki/<method>`, and the
//   bytes come back to be decoded here. `hostFn(page, 'info')` = `POST /api/host/info`.
//
// ENVIRONMENT
//   AMGI_PKG (application id), AMGI_FLAVOR (pro|comet), AMGI_DEVICE_OUT (screenshots, logs, state.json),
//   ANDROID_SERIAL (optional, picked up by adb itself).
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { methods, type MethodName, type MethodRequest, type MethodResponse } from '../src/anki/generated/methods.js';

export const FLAVOR = process.env.AMGI_FLAVOR ?? 'pro';
export const PKG = process.env.AMGI_PKG ?? (FLAVOR === 'comet' ? 'com.ggumtak.myamgi.comet' : 'com.ggumtak.myamgi');
export const LAUNCHER = `${PKG}/com.ggumtak.myamgi.ui.MainActivity`;
export const HOST_ACTIVITY = `${PKG}/com.ggumtak.myamgi.shell.HostActivity`;
export const OUT = path.resolve(process.env.AMGI_DEVICE_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'out'));
export const FIXTURES = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures');
const CDP_PORT = 9222;

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true });

// ---------------------------------------------------------------------------------------------------
// adb

export interface AdbResult {
  code: number;
  out: string;
  err: string;
}

/** Runs `adb <args>`; never throws. */
export function adbRaw(args: string[], timeoutMs = 60_000): AdbResult {
  const r = spawnSync('adb', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? -1, out: r.stdout ?? '', err: (r.stderr ?? '') + (r.error ? String(r.error) : '') };
}

/** Runs `adb <args>` and returns stdout; throws with stderr on failure. */
export function adb(args: string[], timeoutMs = 60_000): string {
  const r = adbRaw(args, timeoutMs);
  if (r.code !== 0) throw new Error(`adb ${args.join(' ')} failed (${r.code}): ${r.err || r.out}`);
  return r.out;
}

/** `adb shell <cmd>` (one string, run by the device shell). */
export function sh(cmd: string, timeoutMs = 60_000): string {
  return adb(['shell', cmd], timeoutMs);
}

export function keyevent(key: string) {
  sh(`input keyevent ${key}`);
}

export function pidOf(pkg = PKG): number | null {
  const r = adbRaw(['shell', `pidof ${pkg}`]);
  const pid = Number(r.out.trim().split(/\s+/)[0]);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/** The activity that is resumed on top (`topResumedActivity`), e.g. `com.ggumtak.myamgi/...HostActivity`. */
export function topActivity(): string {
  const out = sh('dumpsys activity activities');
  const m = /topResumedActivity=ActivityRecord\{\S+ \S+ (\S+)/.exec(out) ?? /mResumedActivity: ActivityRecord\{\S+ \S+ (\S+)/.exec(out);
  return m ? m[1] : '';
}

export function appIsOnTop(): boolean {
  return topActivity().startsWith(`${PKG}/`);
}

/** Starts the app from the launcher entry and waits for the activity (`am start -W`). */
export function launch(): string {
  const out = sh(`am start -W -n ${LAUNCHER}`);
  log(`launch: ${out.replace(/\s+/g, ' ').trim()}`);
  return out;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Polls `fn` until it returns a truthy value. */
export async function waitFor<T>(what: string, fn: () => T | Promise<T>, timeoutMs = 30_000, everyMs = 500): Promise<NonNullable<T>> {
  const end = Date.now() + timeoutMs;
  let last: unknown;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v as NonNullable<T>;
      last = v;
    } catch (e) {
      last = e;
    }
    if (Date.now() > end) throw new Error(`timed out after ${timeoutMs} ms waiting for ${what} (last: ${String(last)})`);
    await sleep(everyMs);
  }
}

export function log(msg: string) {
  const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(OUT, 'logs', `device-test-${FLAVOR}.log`), line + '\n');
}

/** Screenshot of the whole display (system bars included) to out/shots/<flavor>-<name>.png. */
export function shot(name: string): string {
  const r = spawnSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
  // Numbered across worker restarts (a failed step starts a new worker process).
  const n = fs.readdirSync(path.join(OUT, 'shots')).filter((f) => f.startsWith(`${FLAVOR}-`)).length + 1;
  const file = path.join(OUT, 'shots', `${FLAVOR}-${String(n).padStart(2, '0')}-${name}.png`);
  if (r.status === 0 && r.stdout?.length) fs.writeFileSync(file, r.stdout);
  else log(`screenshot ${name} failed: ${r.stderr?.toString()}`);
  return file;
}

export function writeLog(name: string, text: string) {
  fs.writeFileSync(path.join(OUT, 'logs', name), text);
}

// ---------------------------------------------------------------------------------------------------
// State shared between steps (a failed step restarts the worker; the device keeps its state)

export interface SharedState {
  deckName?: string;
  deckId?: number;
  [k: string]: unknown;
}
const STATE = path.join(OUT, `state-${FLAVOR}.json`);
export function loadState(): SharedState {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return {};
  }
}
export function saveState(patch: SharedState) {
  fs.writeFileSync(STATE, JSON.stringify({ ...loadState(), ...patch }, null, 2));
}

// ---------------------------------------------------------------------------------------------------
// Chrome DevTools connection to the WebView

let browser: Browser | null = null;
let forwardedSocket: string | null = null;

function devtoolsSocket(pid: number): string | null {
  const unix = sh('cat /proc/net/unix');
  const m = new RegExp(`@(webview_devtools_remote_${pid})\\b`).exec(unix);
  return m ? m[1] : null;
}

/** Connects (or reconnects) to the WebView of the running app process; launches the app if it is not running. */
export async function connect(): Promise<Browser> {
  let pid = pidOf();
  if (!pid) {
    launch();
    pid = await waitFor('app process', () => pidOf(), 30_000);
  }
  const socket = await waitFor(`devtools socket of pid ${pid}`, () => devtoolsSocket(pid!), 45_000);
  if (browser && browser.isConnected() && socket === forwardedSocket) return browser;
  if (browser) await browser.close().catch(() => {});
  browser = null;
  adbRaw(['forward', '--remove', `tcp:${CDP_PORT}`]);
  adb(['forward', `tcp:${CDP_PORT}`, `localabstract:${socket}`]);
  forwardedSocket = socket;
  // ws URL directly: WebView's /json/version does not always name a reachable browser endpoint.
  browser = await waitFor(
    'CDP connection',
    () => chromium.connectOverCDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`, { noDefaults: true, timeout: 20_000 }),
    60_000,
    2_000,
  );
  log(`CDP connected to ${socket} (pid ${pid}), ${browser.version()}`);
  return browser;
}

/** The app's page (the WebView showing `/ui/`), after it rendered a route. */
export async function app(opts: { timeoutMs?: number } = {}): Promise<Page> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const end = Date.now() + timeoutMs;
  for (;;) {
    const b = await connect();
    const pages = b.contexts().flatMap((c) => c.pages()).filter((p) => !p.isClosed());
    const page = pages.find((p) => p.url().includes('/ui/'));
    if (page) {
      try {
        await page.locator('.route').first().waitFor({ state: 'visible', timeout: Math.max(1_000, Math.min(20_000, end - Date.now())) });
        return page;
      } catch (e) {
        if (Date.now() > end) throw e;
      }
    } else if (Date.now() > end) {
      throw new Error(`no app page; WebView targets: ${pages.map((p) => p.url()).join(', ') || 'none'}`);
    }
    await sleep(1_000);
  }
}

export async function disconnect() {
  if (browser) await browser.close().catch(() => {});
  browser = null;
  forwardedSocket = null;
}

/** Navigates inside the SPA (hash route) and waits for the route. */
export async function goRoute(page: Page, hash: string, route?: string) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  if (route) await expect(page.locator('.route')).toHaveAttribute('data-route', route);
}

export async function route(page: Page): Promise<string> {
  return (await page.locator('.route').first().getAttribute('data-route').catch(() => null)) ?? '';
}

// ---------------------------------------------------------------------------------------------------
// Engine and host calls from inside the page

export async function hostFn<T = Record<string, unknown>>(page: Page, name: string, body: unknown = {}): Promise<T> {
  return page.evaluate(
    async ([n, b]) => {
      const r = await fetch(`/api/host/${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
      const t = await r.text();
      if (!r.ok) throw new Error(`${n}: HTTP ${r.status} ${t}`);
      return t ? JSON.parse(t) : {};
    },
    [name, body] as const,
  ) as Promise<T>;
}

export async function engine<M extends MethodName>(page: Page, name: M, req: MethodRequest<M> = {} as MethodRequest<M>): Promise<MethodResponse<M>> {
  const spec = methods[name] as unknown as {
    request: { encode(m: unknown): { finish(): Uint8Array } };
    response: { decode(b: Uint8Array): MethodResponse<M> };
  };
  const bytes = Array.from(spec.request.encode(req).finish());
  const out = await page.evaluate(
    async ([n, b]) => {
      const r = await fetch(`/_anki/${n}`, { method: 'POST', headers: { 'Content-Type': 'application/binary' }, body: new Uint8Array(b) });
      const buf = new Uint8Array(await r.arrayBuffer());
      if (!r.ok) throw new Error(`${n}: HTTP ${r.status} ${new TextDecoder().decode(buf)}`);
      return Array.from(buf);
    },
    [name, bytes] as const,
  );
  return spec.response.decode(Uint8Array.from(out));
}

export async function searchNotes(page: Page, search: string): Promise<number[]> {
  return (await engine(page, 'searchNotes', { search, order: { none: {} } })).ids as number[];
}

export async function deckNames(page: Page): Promise<string[]> {
  return (await engine(page, 'getDeckNames', { skipEmptyDefault: true, includeFiltered: true })).entries.map((e) => e.name ?? '');
}

/** Saves the host log (`log.get`) as logs/host-<flavor>-<label>.txt. */
export async function saveHostLog(page: Page | null, label: string) {
  try {
    const p = page ?? (await app({ timeoutMs: 10_000 }));
    const l = await hostFn<{ text: string; errors?: string[] }>(p, 'log.get');
    writeLog(`host-${FLAVOR}-${label}.txt`, `${l.text}\n--- errors ---\n${(l.errors ?? []).join('\n')}\n`);
  } catch (e) {
    log(`host log (${label}) not saved: ${String(e)}`);
  }
}

// ---------------------------------------------------------------------------------------------------
// Device geometry

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const rectOf = (s: string): Rect => {
  const [left, top, right, bottom] = s.match(/-?\d+/g)!.map(Number);
  return { left, top, right, bottom };
};
const intersects = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The current UI hierarchy (uiautomator), or '' when it could not be dumped. */
export function uiDump(): string {
  for (let i = 0; i < 3; i++) {
    const r = adbRaw(['exec-out', 'uiautomator dump /dev/tty'], 45_000);
    const xml = r.out.slice(r.out.indexOf('<?xml'), r.out.lastIndexOf('</hierarchy>') + '</hierarchy>'.length);
    if (xml.startsWith('<?xml')) return xml;
    log(`uiautomator dump failed: ${r.err || r.out.slice(0, 300)}`);
  }
  return '';
}

/** Bounds of the first node matching `attr="value"` (exact) in a uiautomator dump. */
export function nodeBounds(xml: string, attr: string, value: string | RegExp): Rect | null {
  for (const m of xml.matchAll(/<node [^>]*>/g)) {
    const node = m[0];
    const a = new RegExp(`\\b${attr}="([^"]*)"`).exec(node)?.[1];
    if (a === undefined) continue;
    const decoded = a.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (typeof value === 'string' ? decoded === value : value.test(decoded)) {
      const b = /bounds="([^"]+)"/.exec(node)?.[1];
      if (b) return rectOf(b);
    }
  }
  return null;
}

export function tapRect(r: Rect) {
  sh(`input tap ${Math.round((r.left + r.right) / 2)} ${Math.round((r.top + r.bottom) / 2)}`);
}

/** Rotation-aware display size in device px. */
export function displaySize(): { width: number; height: number } {
  const out = sh('wm size');
  const m = /Override size: (\d+)x(\d+)/.exec(out) ?? /Physical size: (\d+)x(\d+)/.exec(out);
  const w = Number(m![1]);
  const h = Number(m![2]);
  const rot = /mCurrentRotation=(?:ROTATION_)?(\d+)/.exec(sh('dumpsys window displays'))?.[1] ?? '0';
  const quarter = rot === '1' || rot === '3' || rot === '90' || rot === '270';
  return quarter ? { width: h, height: w } : { width: w, height: h };
}

/** Visible status/navigation bar frames for the current orientation (`dumpsys window` InsetsSource lines). */
export function systemBars(disp = displaySize()): { type: string; frame: Rect }[] {
  const out = sh('dumpsys window');
  const seen = new Set<string>();
  const bars: { type: string; frame: Rect }[] = [];
  for (const m of out.matchAll(/InsetsSource[^\n]*?type=(statusBars|navigationBars)[^\n]*?frame=(\[-?\d+,-?\d+\]\[-?\d+,-?\d+\])[^\n]*?visible=(true|false)/g)) {
    if (m[3] !== 'true') continue;
    const frame = rectOf(m[2]);
    if (frame.right <= frame.left || frame.bottom <= frame.top) continue;
    // dumpsys also lists frames computed for the other orientation.
    if (frame.right > disp.width || frame.bottom > disp.height) continue;
    if (frame.right - frame.left !== disp.width && frame.bottom - frame.top !== disp.height) continue;
    const key = `${m[1]}${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bars.push({ type: m[1], frame });
  }
  return bars;
}

/**
 * Asserts the WebView is not under a system bar, matches the page viewport, and the page has no
 * horizontal scroll and no app chrome outside the viewport. Returns the measurements.
 */
export async function checkLayout(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const chrome = Array.from(document.querySelectorAll('.app-bar, .rail, .tabbar, .answer-bar, .fab')).map((e) => {
      const r = e.getBoundingClientRect();
      return { cls: (e as HTMLElement).className.toString().split(' ')[0], top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
    });
    return { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, scrollW: d.scrollWidth, bodyScrollW: document.body.scrollWidth, chrome };
  });
  const disp = displaySize();
  const bars = systemBars(disp);
  const xml = uiDump();
  writeLog(`layout-${FLAVOR}-${label}.xml`, xml);
  const wv = xml ? nodeBounds(xml, 'class', /WebView$/) : null;
  const report = { label, page: m, webView: wv, bars, display: disp, top: topActivity() };
  log(`layout ${label}: ${JSON.stringify(report)}`);
  writeLog(`layout-${FLAVOR}-${label}.json`, JSON.stringify(report, null, 2));

  expect(m.scrollW, `${label}: horizontal scroll (scrollWidth ${m.scrollW} > innerWidth ${m.w})`).toBeLessThanOrEqual(m.w + 1);
  expect(m.bodyScrollW, `${label}: body wider than the viewport`).toBeLessThanOrEqual(m.w + 1);
  for (const c of m.chrome) {
    if (c.w === 0 || c.h === 0) continue;
    expect(c.top, `${label}: .${c.cls} starts above the viewport`).toBeGreaterThanOrEqual(-1);
    expect(c.bottom, `${label}: .${c.cls} ends below the viewport`).toBeLessThanOrEqual(m.h + 1);
    expect(c.right, `${label}: .${c.cls} ends right of the viewport`).toBeLessThanOrEqual(m.w + 1);
  }
  const vw = m.w * m.dpr;
  const vh = m.h * m.dpr;
  const status = bars.filter((b) => b.type === 'statusBars');
  const nav = bars.filter((b) => b.type === 'navigationBars');
  // The room the system bars leave (status bar at the top, navigation/task bar at the bottom or a side).
  const top = Math.max(0, ...status.map((b) => b.frame.bottom));
  const bottom = Math.min(disp.height, ...nav.filter((b) => b.frame.top > 0).map((b) => b.frame.top));
  const left = Math.max(0, ...nav.filter((b) => b.frame.left === 0 && b.frame.right < disp.width).map((b) => b.frame.right));
  const right = Math.min(disp.width, ...nav.filter((b) => b.frame.left > 0).map((b) => b.frame.left));
  expect(status.length, `${label}: no status bar found in dumpsys window`).toBeGreaterThan(0);
  if (wv) {
    for (const b of bars) {
      expect(intersects(wv, b.frame), `${label}: WebView ${JSON.stringify(wv)} overlaps ${b.type} ${JSON.stringify(b.frame)}`).toBe(false);
    }
    expect(Math.abs(vw - (wv.right - wv.left)), `${label}: viewport width vs WebView`).toBeLessThanOrEqual(m.dpr * 2);
    expect(Math.abs(vh - (wv.bottom - wv.top)), `${label}: viewport height vs WebView`).toBeLessThanOrEqual(m.dpr * 2);
  } else {
    log(`layout ${label}: WebView node not in the uiautomator dump; checking the viewport against the bar-free area`);
  }
  // The page gets exactly the area between the bars: not behind them (too big) and no gap (too small).
  expect(Math.abs(vh - (bottom - top)), `${label}: viewport height ${vh} vs space between bars ${bottom - top}`).toBeLessThanOrEqual(m.dpr * 2);
  expect(Math.abs(vw - (right - left)), `${label}: viewport width ${vw} vs space between bars ${right - left}`).toBeLessThanOrEqual(m.dpr * 2);
  return report;
}

/** Closes system dialogs ("… isn't responding") and leaves the app on top if it was running. */
export function dismissSystemDialogs() {
  const focus = adbRaw(['shell', 'dumpsys window | grep -E "mCurrentFocus|mFocusedApp"']).out;
  if (/Application Not Responding|Application Error|isn't responding/i.test(focus)) {
    log(`system dialog in focus: ${focus.replace(/\s+/g, ' ')}`);
    const xml = uiDump();
    const wait = nodeBounds(xml, 'text', /^(Wait|대기)$/) ?? nodeBounds(xml, 'text', /^(Close app|앱 닫기)$/);
    if (wait) tapRect(wait);
    else keyevent('KEYCODE_BACK');
  }
}

// ---------------------------------------------------------------------------------------------------
// Media for the reviewer cards

/** A mono 8-bit WAV with a 440 Hz tone (audible, so playback can be heard in a recording). */
export function toneWav(ms = 4000): Uint8Array {
  const rate = 8000;
  const n = Math.floor((rate * ms) / 1000);
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 440 * i) / rate));
  return new Uint8Array(buf);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A `size`×`size` RGB PNG: blue with a white diagonal, so it is recognisable in screenshots. */
export function testPng(size = 96): Uint8Array {
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const on = Math.abs(x - y) < 6;
      row[1 + x * 3] = on ? 255 : 30;
      row[2 + x * 3] = on ? 255 : 90;
      row[3 + x * 3] = 255;
    }
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return new Uint8Array(png);
}

/** Music stream volume (`cmd media_session volume --get`), or null if it could not be read. */
export function musicVolume(): number | null {
  const out = adbRaw(['shell', 'cmd media_session volume --stream 3 --get']).out;
  const m = /volume is (\d+)/.exec(out);
  return m ? Number(m[1]) : null;
}

export function setMusicVolume(v: number) {
  adbRaw(['shell', `cmd media_session volume --stream 3 --set ${v}`]);
}
