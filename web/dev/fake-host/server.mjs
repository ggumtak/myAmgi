#!/usr/bin/env node
// Fake myAmgi host for development and tests.
//
// Implements the host HTTP contract from docs/ARCHITECTURE.md (token cookie
// handshake, /ui, /_anki/<method>, /media, /api/host/*, events) and forwards every
// engine call to the REAL Anki engine through sidecar.py (pip `anki`, same Rust
// backend version as the app). The collection is seeded on first start.
//
// Usage: node dev/fake-host/server.mjs [--port 40001] [--token dev] [--dir <tmp>]
//                                      [--ui dist|none] [--fresh]
// Prints "AMGI_FAKE_HOST_READY http://127.0.0.1:<port>/?t=<token>" when ready.
//
// Dev-only extras (not part of the contract, only reachable with the token):
//   POST /__fake/emit {event, data}  -> broadcast an SSE event (tests: back button)
//   POST /__fake/reset                -> reseed a fresh collection

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');
const ANKI_VERSION = '26.9.4';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const PORT = Number(arg('port', process.env.AMGI_FAKE_PORT || 40001));
const TOKEN = String(arg('token', process.env.AMGI_FAKE_TOKEN || 'dev'));
const DIR = path.resolve(String(arg('dir', fs.mkdtempSync(path.join(os.tmpdir(), 'amgi-fake-')))));
const UI_DIR = arg('ui', 'dist') === 'none' ? null : path.join(WEB, 'dist');
if (arg('fresh', false)) fs.rmSync(path.join(DIR, 'collection'), { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const log = [];
function note(line) {
  const entry = `${new Date().toISOString()} ${line}`;
  log.push(entry);
  if (log.length > 500) log.shift();
  if (process.env.AMGI_FAKE_VERBOSE) console.error(entry);
}

// ---------------------------------------------------------------------------
// Python sidecar
// ---------------------------------------------------------------------------

function findPython() {
  if (process.env.AMGI_PYTHON) return process.env.AMGI_PYTHON;
  const venv = path.join(HERE, '.venv');
  const py = path.join(venv, 'bin', 'python');
  const ok = (bin) => spawnSync(bin, ['-c', 'import anki.collection'], { stdio: 'ignore' }).status === 0;
  if (fs.existsSync(py) && ok(py)) return py;
  if (ok('python3')) return 'python3';
  console.error(`[fake-host] creating ${venv} with anki==${ANKI_VERSION} (one-time)`);
  let r = spawnSync('python3', ['-m', 'venv', venv], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('python3 -m venv failed');
  r = spawnSync(py, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', `anki==${ANKI_VERSION}`], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`pip install anki==${ANKI_VERSION} failed`);
  return py;
}

class Sidecar {
  constructor(python, dir) {
    this.python = python;
    this.dir = dir;
    this.queue = Promise.resolve();
  }

  start() {
    this.buf = Buffer.alloc(0);
    this.waiters = [];
    this.proc = spawn(this.python, [path.join(HERE, 'sidecar.py'), this.dir], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
    });
    this.proc.stderr.on('data', (d) => note(`[engine] ${d.toString().trimEnd()}`));
    this.proc.stdout.on('data', (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      this.drain();
    });
    this.proc.on('exit', (code) => {
      note(`[engine] exited with ${code}`);
      for (const w of this.waiters.splice(0)) w.reject(new Error(`engine exited (${code})`));
    });
    return this.next().then((r) => {
      if (r.status !== 0) throw new Error(r.payload.toString());
      return JSON.parse(r.payload.toString());
    });
  }

  drain() {
    while (this.buf.length >= 5 && this.waiters.length) {
      const status = this.buf.readUInt8(0);
      const len = this.buf.readUInt32BE(1);
      if (this.buf.length < 5 + len) return;
      const payload = this.buf.subarray(5, 5 + len);
      this.buf = this.buf.subarray(5 + len);
      this.waiters.shift().resolve({ status, payload: Buffer.from(payload) });
    }
  }

  next() {
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.drain();
    });
  }

  /** Serialized request; returns {status, payload}. */
  request(header, body = Buffer.alloc(0)) {
    const run = () => {
      const h = Buffer.from(JSON.stringify(header));
      const frame = Buffer.alloc(8 + h.length + body.length);
      frame.writeUInt32BE(h.length, 0);
      h.copy(frame, 4);
      frame.writeUInt32BE(body.length, 4 + h.length);
      body.copy(frame, 8 + h.length);
      const p = this.next();
      this.proc.stdin.write(frame);
      return p;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async stop() {
    if (!this.proc || this.proc.exitCode !== null) return;
    try {
      await Promise.race([this.request({ op: 'close' }), new Promise((r) => setTimeout(r, 3000))]);
    } catch {
      // ignore
    }
    this.proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Host state
// ---------------------------------------------------------------------------

const prefsFile = path.join(DIR, 'prefs.json');
const readPrefs = () => {
  try {
    return JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
  } catch {
    return {};
  }
};
const uploadsDir = path.join(DIR, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const sseClients = new Set();
function emit(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of sseClients) res.write(msg);
}

class HostError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

const notSupported = (name) => () => {
  throw new HostError(501, '개발용 호스트에서는 지원하지 않는 기능입니다', name);
};

let sidecar;

const hostFunctions = {
  info: async () => ({
    appVersion: '0.0.0-dev',
    build: 0,
    flavor: process.env.AMGI_FAKE_FLAVOR || 'pro',
    platform: 'desktop',
    eink: process.env.AMGI_FAKE_FLAVOR === 'comet',
    device: `fake-host (${os.hostname()})`,
    uiVersion: readUiVersion(),
    backendVersion: `${ANKI_VERSION} (python anki)`,
  }),
  'prefs.get': async () => readPrefs(),
  'prefs.set': async (body) => {
    const merged = { ...readPrefs(), ...(body || {}) };
    fs.writeFileSync(prefsFile, JSON.stringify(merged, null, 1));
    return merged;
  },
  'collection.status': async () => {
    const r = await sidecar.request({ op: 'info' });
    const info = JSON.parse(r.payload.toString());
    return { open: true, path: info.path, size: info.size, lastError: null };
  },
  'sync.status': async () => ({ loggedIn: false, user: null, required: 'none', syncing: false, lastSync: null, error: null }),
  'sync.login': notSupported('sync.login'),
  'sync.logout': async () => ({}),
  'sync.run': notSupported('sync.run'),
  'sync.abort': async () => ({}),
  'backup.create': notSupported('backup.create'),
  'backup.list': async () => ({ backups: [] }),
  'backup.restore': notSupported('backup.restore'),
  'import.file': async (body) => {
    const name = String(body?.name || '');
    const p = String(body?.path || '');
    const lower = name.toLowerCase();
    const kind = lower.endsWith('.colpkg') ? 'colpkg' : lower.endsWith('.apkg') ? 'apkg' : 'csv';
    return { kind, route: `/import/${kind}?path=${encodeURIComponent(p)}` };
  },
  'export.package': notSupported('export.package'),
  'export.collection': notSupported('export.collection'),
  'platform.share': notSupported('platform.share'),
  'platform.openExternal': async () => ({}),
  'platform.tts': async () => ({}),
  'platform.ttsStop': async () => ({}),
  'platform.clipboardWrite': async () => ({}),
  'platform.exit': async () => {
    emit('exit-requested', {});
    return {};
  },
  'hanja.lookup': notSupported('hanja.lookup'),
  'update.status': async () => ({ available: false, current: '0.0.0-dev' }),
  'update.check': async () => ({ available: false, current: '0.0.0-dev' }),
  'update.apply': notSupported('update.apply'),
  'log.get': async () => ({ log: log.slice(-200).join('\n'), errors: [] }),
};

function readUiVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(WEB, 'package.json'), 'utf8')).version;
  } catch {
    return 'dev';
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit = 512 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HostError(413, '요청이 너무 큽니다'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

/** Serve a file with Range support, MIME type, no-cache + Last-Modified. */
function sendFile(req, res, file, extraHeaders = {}) {
  let stat;
  try {
    stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'Last-Modified': stat.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
    ...extraHeaders,
  };
  const since = req.headers['if-modified-since'];
  if (since && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stat.size - 1;
    if (range[1] === '') end = stat.size - 1;
    if (start < 0) start = 0;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return;
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/** Resolve `rel` under `root`, rejecting traversal. */
function safeJoin(root, rel) {
  const full = path.resolve(root, '.' + path.sep + rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

let mediaDir = null;
const OFFICIAL_PAGES = [
  'deck-options',
  'graphs',
  'card-info',
  'congrats',
  'change-notetype',
  'image-occlusion',
  'import-anki-package',
  'import-csv',
  'import-page',
];

function officialPlaceholder(name, rest) {
  // The pip `anki` package has no SvelteKit pages; the real host serves them
  // from the backend artifact. This stand-in follows the same theme handoff.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
 html{color-scheme:light}
 body{font:16px system-ui,"Noto Sans KR",sans-serif;margin:0;padding:24px;background:#fff;color:#1b1c1f}
 html.night-mode body{background:#121316;color:#e6e7ea}
 code{font-size:14px}
</style></head><body>
<h1 id="official-page" data-page="${name}">${name}</h1>
<p>공식 Anki 페이지 자리입니다. 개발용 호스트는 이 페이지를 제공하지 않습니다.</p>
<p><code>/${name}${rest ? '/' + rest.replace(/[<>&"]/g, '') : ''}</code></p>
</body></html>`;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = decodeURIComponent(url.pathname);

  // Handshake: /?t=<token> -> cookie + redirect to /ui/
  if (url.pathname === '/' && url.searchParams.has('t')) {
    if (url.searchParams.get('t') !== TOKEN) return sendJson(res, 403, { error: '접근이 거부되었습니다' });
    res.writeHead(302, {
      'Set-Cookie': `amgi_t=${encodeURIComponent(TOKEN)}; HttpOnly; SameSite=Strict; Path=/`,
      Location: '/ui/',
    });
    return res.end();
  }

  // Host header + token checks
  const host = req.headers.host || '';
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('bad host');
  }
  const token = req.headers['x-amgi-token'] || parseCookies(req.headers.cookie).amgi_t;
  if (token !== TOKEN) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('forbidden');
  }

  if (req.method === 'POST' && url.pathname.startsWith('/_anki/')) {
    const method = url.pathname.slice('/_anki/'.length);
    const body = await readBody(req);
    const r = await sidecar.request({ op: 'anki', method }, body);
    if (r.status === 0) {
      res.writeHead(200, { 'Content-Type': 'application/binary', 'Content-Length': r.payload.length });
      return res.end(r.payload);
    }
    note(`[anki] ${method} failed: ${r.payload.toString()}`);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(r.payload);
  }

  if (url.pathname === '/api/host/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    sseClients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
    return;
  }

  if (url.pathname === '/api/host/upload' && req.method === 'POST') {
    const name = path.basename(url.searchParams.get('name') || 'upload.bin');
    const dest = path.join(uploadsDir, `${crypto.randomUUID()}-${name}`);
    const body = await readBody(req);
    fs.writeFileSync(dest, body);
    return sendJson(res, 200, { path: dest });
  }

  if (url.pathname === '/api/host/download' && req.method === 'GET') {
    const file = url.searchParams.get('path') || '';
    const full = safeJoin(uploadsDir, path.relative(uploadsDir, file));
    if (!full) return sendJson(res, 403, { error: '허용되지 않은 경로입니다' });
    const name = url.searchParams.get('name') || path.basename(full);
    return sendFile(req, res, full, { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
  }

  if (url.pathname.startsWith('/api/host/') && req.method === 'POST') {
    const name = url.pathname.slice('/api/host/'.length);
    const fn = hostFunctions[name];
    if (!fn) return sendJson(res, 404, { error: '알 수 없는 호스트 기능입니다', detail: name });
    let body = {};
    const raw = await readBody(req, 4 * 1024 * 1024);
    if (raw.length) body = JSON.parse(raw.toString('utf8'));
    try {
      return sendJson(res, 200, (await fn(body)) ?? {});
    } catch (err) {
      const status = err instanceof HostError ? err.status : 500;
      note(`[host] ${name} failed: ${err.message}`);
      return sendJson(res, status, { error: err.message, detail: err.detail || err.stack || String(err) });
    }
  }

  if (url.pathname === '/__fake/emit' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    emit(body.event, body.data);
    return sendJson(res, 200, { clients: sseClients.size });
  }

  if (url.pathname === '/__fake/reset' && req.method === 'POST') {
    await sidecar.stop();
    fs.rmSync(path.join(DIR, 'collection'), { recursive: true, force: true });
    fs.rmSync(prefsFile, { force: true });
    await startEngine();
    return sendJson(res, 200, {});
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (p === '/media/__amgi_frame.html') {
      const built = UI_DIR && path.join(UI_DIR, 'card-frame.html');
      const file = built && fs.existsSync(built) ? built : path.join(WEB, 'public', 'card-frame.html');
      return sendFile(req, res, file);
    }
    if (p.startsWith('/media/')) {
      const full = safeJoin(mediaDir, p.slice('/media/'.length));
      if (!full) return sendJson(res, 403, { error: '허용되지 않은 경로입니다' });
      return sendFile(req, res, full);
    }
    if (p === '/ui' || p.startsWith('/ui/')) {
      if (!UI_DIR || !fs.existsSync(UI_DIR)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('UI bundle not built: run `npm run build` (or use `npm run dev`)');
      }
      if (p === '/ui') {
        res.writeHead(302, { Location: '/ui/' });
        return res.end();
      }
      const rel = p.slice('/ui/'.length) || 'index.html';
      const full = safeJoin(UI_DIR, rel);
      if (!full) return sendJson(res, 403, { error: '허용되지 않은 경로입니다' });
      return sendFile(req, res, fs.existsSync(full) ? full : path.join(UI_DIR, 'index.html'));
    }
    const first = p.split('/')[1];
    if (OFFICIAL_PAGES.includes(first)) {
      const html = Buffer.from(officialPlaceholder(first, p.split('/').slice(2).join('/')));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      return res.end(html);
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

async function startEngine() {
  sidecar = new Sidecar(PYTHON, path.join(DIR, 'collection'));
  const ready = await sidecar.start();
  const info = JSON.parse((await sidecar.request({ op: 'info' })).payload.toString());
  mediaDir = path.resolve(info.mediaDir);
  note(`[engine] ready: ${ready.methods} raw methods, collection ${info.path}`);
}

const PYTHON = findPython();
await startEngine();

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    note(`[http] ${req.url}: ${err.stack || err}`);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.message || '오류', detail: String(err.stack || err) });
    else res.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AMGI_FAKE_HOST_READY http://127.0.0.1:${PORT}/?t=${encodeURIComponent(TOKEN)}`);
  console.log(`[fake-host] collection dir: ${DIR}`);
});

async function shutdown() {
  for (const res of sseClients) res.end();
  server.close();
  await sidecar.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
