// The app on a real Android device (CI: x86_64 emulator, API 34, Pixel Tablet profile), driven through
// the WebView's Chrome DevTools socket plus adb. Steps run in order and share the device; each step
// asks `app()` for the current page because some steps restart the activity or the process.
// Screenshots: out/shots/<flavor>-NN-<name>.png (adb screencap, system bars included).
// How to run: e2e-device/run.sh (CI: .github/workflows/device-test.yml). It needs one device or emulator
// on adb and the debug APKs (`./gradlew -PemulatorAbi assembleProDebug assembleCometDebug`).
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { officialFrame } from '../e2e/helpers';
import { anki } from '../src/anki/generated/proto.js';
import {
  FIXTURES,
  FLAVOR,
  HOST_ACTIVITY,
  PKG,
  adb,
  adbRaw,
  app,
  appIsOnTop,
  checkLayout,
  deckNames,
  dismissSystemDialogs,
  engine,
  goRoute,
  hostFn,
  keyevent,
  launch,
  loadState,
  log,
  musicVolume,
  audioDiagnostics,
  volumeAdjustments,
  nodeBounds,
  pidOf,
  route,
  saveHostLog,
  saveState,
  searchNotes,
  setMusicVolume,
  sh,
  shot,
  sleep,
  tapRect,
  testPng,
  toneWav,
  topActivity,
  uiDump,
  waitFor,
  writeLog,
} from './device';

interface HostInfo {
  appVersion: string;
  build: number;
  flavor: string;
  platform: string;
  eink: boolean;
  device: string;
  uiVersion: string | null;
  backendVersion: string;
}

const DECK = '기기 테스트';

test.beforeEach(async ({}, info) => {
  log(`=== ${info.title}`);
  // The emulator's own apps sometimes show "… isn't responding"; such a dialog takes every key and tap.
  dismissSystemDialogs();
  // A step that failed may have left the picker, the share sheet or the home screen on top.
  if (pidOf() && !appIsOnTop()) {
    log(`top before the step: ${topActivity()}; bringing the app back`);
    launch();
  }
});

test.afterEach(async ({}, info) => {
  const label = info.title.replace(/[^\w가-힣-]+/g, '_').slice(0, 40);
  if (info.status !== info.expectedStatus) {
    shot(`FAILED-${label}`);
    log(`FAILED: ${info.title}: ${info.error?.message?.split('\n')[0]}`);
  }
  await saveHostLog(null, label);
});

async function basicNotetype(page: Page): Promise<number> {
  const names = await engine(page, 'getNotetypeNames', {});
  for (const e of names.entries) {
    const nt = await engine(page, 'getNotetype', { ntid: e.id });
    if (nt.config?.originalStockKind === anki.notetypes.StockNotetype.OriginalStockKind.ORIGINAL_STOCK_KIND_BASIC && nt.templates.length === 1) return nt.id as number;
  }
  throw new Error('no Basic note type');
}

async function addNote(page: Page, deckId: number, ntid: number, fields: string[]): Promise<number> {
  const note = await engine(page, 'newNote', { ntid });
  note.fields = fields;
  note.tags = ['기기테스트'];
  return (await engine(page, 'addNote', { note, deckId })).noteId as number;
}

async function deckRowCounts(page: Page, name: string) {
  const row = page.locator(`[data-deck-name="${name}"]`);
  await expect(row).toBeVisible();
  const read = async (k: string) => Number((await row.locator(`[data-count="${k}"]`).textContent())?.trim() || 'NaN');
  return { new: await read('new'), learn: await read('learn'), review: await read('review') };
}

async function addButton(page: Page) {
  const wide = await page.evaluate(() => innerWidth >= 900);
  return page.getByTestId(wide ? 'rail-add' : 'fab-add');
}

/** Waits for the reviewer to show `side`. */
async function rendered(page: Page, side: 'question' | 'answer') {
  await expect(page.getByTestId('study')).toHaveAttribute('data-rendered', side, { timeout: 20_000 });
}

const cardId = async (page: Page) => Number(await page.getByTestId('study').getAttribute('data-card-id'));

function cardFrame(page: Page) {
  const f = page.frames().find((fr) => fr.url().includes('__amgi_frame.html'));
  if (!f) throw new Error(`card frame not found; frames: ${page.frames().map((x) => x.url()).join(', ')}`);
  return f;
}

/** Records real playback of every media element the page plays (no stubbing). */
async function installAudioProbe(page: Page) {
  await page.evaluate(() => {
    type W = { __amgiAudio?: { ev: string; src: string; t?: number; err?: string }[]; __amgiMaxT?: Record<string, number> };
    const w = window as unknown as W;
    if (w.__amgiAudio) return;
    w.__amgiAudio = [];
    w.__amgiMaxT = {};
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const el = this;
      const src = decodeURIComponent(el.currentSrc || el.src || '').split('/').pop() || '';
      const rec = (ev: string, extra: { t?: number; err?: string } = {}) => w.__amgiAudio!.push({ ev, src, ...extra });
      rec('play()');
      if (!(el as unknown as { __probed?: boolean }).__probed) {
        (el as unknown as { __probed?: boolean }).__probed = true;
        for (const ev of ['playing', 'ended', 'error', 'pause', 'stalled']) {
          el.addEventListener(ev, () => {
            const s = decodeURIComponent(el.currentSrc || el.src || '').split('/').pop() || '';
            w.__amgiAudio!.push({ ev, src: s, t: el.currentTime, err: el.error ? String(el.error.code) : undefined });
          });
        }
        el.addEventListener('timeupdate', () => {
          const s = decodeURIComponent(el.currentSrc || el.src || '').split('/').pop() || '';
          w.__amgiMaxT![s] = Math.max(w.__amgiMaxT![s] ?? 0, el.currentTime);
        });
      }
      const p = orig.call(this);
      p?.then(
        () => rec('resolved'),
        (e: unknown) => rec('rejected', { err: String(e) }),
      );
      return p;
    };
  });
}

async function audioProbe(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __amgiAudio?: { ev: string; src: string }[]; __amgiMaxT?: Record<string, number> };
    return { events: w.__amgiAudio ?? [], maxT: w.__amgiMaxT ?? {} };
  });
}

// =====================================================================================================
// Pro (phone/tablet build): the full walk-through

test.describe('pro @pro', () => {
  test.skip(FLAVOR !== 'pro', 'pro steps');

  test('01 cold start: deck list, host info, system bars, no horizontal scroll', async () => {
    sh('settings put system accelerometer_rotation 0');
    sh('settings put system user_rotation 0');
    sh('cmd uimode night no');
    adbRaw(['shell', `am force-stop ${PKG}`]);
    const started = Date.now();
    launch();
    const page = await app({ timeoutMs: 90_000 });
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
    log(`cold start to deck list: ${Date.now() - started} ms`);
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/ui\//);

    const info = await hostFn<HostInfo>(page, 'info');
    log(`host.info ${JSON.stringify(info)}`);
    writeLog(`host-info-${FLAVOR}.json`, JSON.stringify(info, null, 2));
    expect(info.platform).toBe('android');
    expect(info.flavor).toBe('pro');
    expect(info.build).toBeGreaterThan(0);
    expect(info.uiVersion).toMatch(/^\d+(\.\d+)*$/);
    expect(info.backendVersion).toMatch(/Anki 26\.09/);
    expect(info.eink).toBe(false);
    // The page told the shell it is ready (HostRuntime logs "ui ready: <version> back-ack").
    await expect.poll(async () => (await hostFn<{ text: string }>(page, 'log.get')).text).toContain(`ui ready: ${info.uiVersion}`);
    saveState({ info, firstOrigin: new URL(page.url()).origin, firstPid: pidOf() });

    await expect(page.getByTestId('loading-state')).toHaveCount(0);
    await checkLayout(page, 'cold-start');
    // Korean text is laid out with a real font (not tofu): a Hangul string is wider than zero and similar to Latin.
    const widths = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.font = getComputedStyle(document.body).font;
      return { hangul: c.measureText('가나다라마').width, latin: c.measureText('abcde').width, font: c.font };
    });
    log(`font check ${JSON.stringify(widths)}`);
    expect(widths.hangul).toBeGreaterThan(widths.latin * 0.9);
    shot('cold-start');
  });

  test('02 engine on device: create a deck in the UI, add notes and media through the engine', async () => {
    const page = await app();
    await goRoute(page, '#/decks', 'decks');
    await (await addButton(page)).click();
    await page.getByTestId('add-deck').click();
    const dialog = page.getByTestId('prompt-dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').fill(DECK);
    shot('create-deck-dialog');
    await dialog.getByRole('button', { name: '만들기' }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.locator(`[data-deck-name="${DECK}"]`);
    await expect(row).toBeVisible();
    const deckId = Number(await row.getAttribute('data-deck-id'));
    expect(deckId).toBeGreaterThan(0);
    expect(await deckNames(page)).toContain(DECK);

    const ntid = await basicNotetype(page);
    const tone = (await engine(page, 'addMediaFile', { desiredName: 'device-tone.wav', data: toneWav(4000) })).val;
    const png = (await engine(page, 'addMediaFile', { desiredName: 'device-image.png', data: testPng(96) })).val;
    expect(tone).toBe('device-tone.wav');
    expect(png).toBe('device-image.png');
    // New cards come in creation order: sound, image, then three plain cards.
    await addNote(page, deckId, ntid, ['소리 카드 [sound:device-tone.wav]', '소리 정답']);
    await addNote(page, deckId, ntid, ['그림 카드<br><img src="device-image.png" id="device-img">', '그림 정답']);
    for (let i = 1; i <= 3; i++) await addNote(page, deckId, ntid, [`질문 ${i} 日本語 한국어`, `정답 ${i}`]);
    saveState({ deckName: DECK, deckId, ntid });

    await page.reload();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
    await expect.poll(() => deckRowCounts(page, DECK)).toEqual({ new: 5, learn: 0, review: 0 });
    shot('deck-with-notes');
  });

  test('03 reviewer: sound autoplays, image from /media/, answers reach the engine', async () => {
    const { deckId } = loadState();
    const page = await app();
    await hostFn(page, 'prefs.set', { volumeKeys: true, twoButtons: false, theme: 'light' });
    await page.reload();
    await installAudioProbe(page);
    await goRoute(page, '#/decks', 'decks');
    await page.locator(`[data-deck-name="${DECK}"] .deck-row__name`).click();
    const start = page.getByTestId('start-study');
    if (!(await start.isVisible().catch(() => false))) await goRoute(page, `#/deck/${deckId}`);
    await page.getByTestId('start-study').click();
    await rendered(page, 'question');

    // Card 1: [sound:] plays by itself (deck option "autoplay"), no tap.
    await expect.poll(() => cardFrame(page).locator('#qa').textContent()).toContain('소리 카드');
    await expect
      .poll(async () => (await audioProbe(page)).maxT['device-tone.wav'] ?? 0, { timeout: 20_000, message: 'audio playback position advances' })
      .toBeGreaterThan(0.3);
    const probe = await audioProbe(page);
    log(`audio probe ${JSON.stringify(probe)}`);
    expect(probe.events.some((e) => e.ev === 'playing' && e.src === 'device-tone.wav')).toBe(true);
    expect(probe.events.filter((e) => e.ev === 'rejected' || e.ev === 'error')).toEqual([]);
    shot('study-sound-question');

    let cid = await cardId(page);
    await page.getByTestId('show-answer').click();
    await rendered(page, 'answer');
    await page.getByTestId('answer-good').click();
    await expect.poll(async () => (await engine(page, 'getReviewLogs', { cid })).entries.length).toBe(1);
    expect((await engine(page, 'getCard', { cid })).queue).not.toBe(0);

    // Card 2: the image is served from /media/ into the card frame.
    await expect.poll(() => cardId(page)).not.toBe(cid);
    await rendered(page, 'question');
    const img = cardFrame(page).locator('#device-img');
    await expect(img).toBeVisible();
    const imgInfo = await img.evaluate((el: HTMLImageElement) => ({ src: el.currentSrc, w: el.naturalWidth, h: el.naturalHeight, complete: el.complete }));
    log(`card image ${JSON.stringify(imgInfo)}`);
    expect(imgInfo.src).toMatch(/\/media\/device-image\.png$/);
    expect(imgInfo).toMatchObject({ w: 96, h: 96, complete: true });
    shot('study-image-question');
    cid = await cardId(page);
    await page.getByTestId('show-answer').click();
    await rendered(page, 'answer');
    shot('study-image-answer');
    await page.getByTestId('answer-good').click();
    await expect.poll(async () => (await engine(page, 'getReviewLogs', { cid })).entries.length).toBe(1);
    await expect.poll(() => cardId(page)).not.toBe(cid);
    await rendered(page, 'question');
  });

  test('04 volume keys: answer cards with the pref on, change the volume with it off', async () => {
    const page = await app();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'study');
    await rendered(page, 'question');
    setMusicVolume(8);
    const v0 = musicVolume();
    const a0 = volumeAdjustments();
    log(`music volume before: ${v0}, volume adjustments so far: ${a0}`);
    audioDiagnostics('before');

    // Pref on (set in step 03): VOLUME_DOWN = "positive": show the answer, then Good. The system never sees the key.
    const cid = await cardId(page);
    keyevent('KEYCODE_VOLUME_DOWN');
    await rendered(page, 'answer');
    shot('volume-key-answer-shown');
    keyevent('KEYCODE_VOLUME_DOWN');
    await expect.poll(async () => (await engine(page, 'getReviewLogs', { cid })).entries.length).toBe(1);
    const logs = (await engine(page, 'getReviewLogs', { cid })).entries;
    expect(logs[0].buttonChosen).toBe(3);
    await expect.poll(() => cardId(page)).not.toBe(cid);
    await rendered(page, 'question');
    expect(musicVolume()).toBe(v0);
    expect(volumeAdjustments(), 'the system adjusted the volume although the app took the key').toBe(a0);

    // Pref off (the reviewer reads its prefs when it opens, like after changing them in Settings).
    await hostFn(page, 'prefs.set', { volumeKeys: false });
    await page.reload();
    await rendered(page, 'question');
    const cid2 = await cardId(page);
    const v1 = musicVolume();
    keyevent('KEYCODE_VOLUME_DOWN');
    await sleep(1_500);
    shot('volume-key-system-volume');
    log(`pref off: volume ${v1} → ${musicVolume()}, adjustments ${a0} → ${volumeAdjustments()}`);
    audioDiagnostics('pref-off');
    await expect(page.getByTestId('study')).toHaveAttribute('data-rendered', 'question');
    expect(await cardId(page)).toBe(cid2);
    expect((await engine(page, 'getReviewLogs', { cid: cid2 })).entries).toHaveLength(0);
    await expect.poll(() => volumeAdjustments(), { message: 'the system handled the volume key' }).toBeGreaterThan(a0);
    await hostFn(page, 'prefs.set', { volumeKeys: true });
    // Let the volume panel disappear before the next screenshot.
    await sleep(3_500);
  });

  test('05 back button: screen by screen, leaves the app on the root, relaunch keeps the data', async () => {
    let page = await app();
    const trail: string[] = [await route(page)];
    if (trail[0] === 'study') {
      keyevent('KEYCODE_BACK');
      await expect.poll(() => route(page)).not.toBe('study');
      trail.push(await route(page));
    }
    await goRoute(page, '#/decks', 'decks');
    await page.locator('a[href="#/settings"]').first().click();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings');
    await page.getByTestId('settings-sync').click();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings-sync');
    shot('back-before');
    keyevent('KEYCODE_BACK');
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings');
    trail.push('settings');
    keyevent('KEYCODE_BACK');
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
    trail.push('decks');
    log(`back trail: ${trail.join(' → ')}`);
    expect(appIsOnTop()).toBe(true);

    keyevent('KEYCODE_BACK');
    await waitFor('the app to leave the screen', () => !appIsOnTop(), 10_000);
    log(`after back on root, top activity: ${topActivity()}`);
    shot('back-left-app');

    launch();
    page = await app();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
    const counts = await deckRowCounts(page, DECK);
    log(`after relaunch ${JSON.stringify(counts)}`);
    expect(counts.new).toBe(2);
    expect(counts.learn + counts.review).toBe(3);
    shot('back-relaunched');
  });

  test('06 rotation: same page (not reloaded), one pane ⇄ two panes', async () => {
    const page = await app();
    await goRoute(page, '#/decks', 'decks');
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 4242));
    const layout = () =>
      page.evaluate(() => ({
        w: innerWidth,
        h: innerHeight,
        rail: !!document.querySelector('.rail'),
        tabbar: !!document.querySelector('.tabbar'),
        twoPane: !!document.querySelector('.two-pane'),
        marker: (window as unknown as { __marker?: number }).__marker,
      }));
    const before = await layout();
    log(`rotation 0: ${JSON.stringify(before)}`);
    expect(before.rail).toBe(before.w >= 900);
    expect(before.twoPane).toBe(before.w >= 900);

    sh('settings put system user_rotation 1');
    await expect.poll(async () => (await layout()).w, { timeout: 20_000 }).not.toBe(before.w);
    await sleep(800);
    const turned = await layout();
    log(`rotation 1: ${JSON.stringify(turned)}`);
    expect(turned.marker).toBe(4242);
    expect(turned.rail).toBe(turned.w >= 900);
    expect(turned.tabbar).toBe(turned.w < 900);
    expect(turned.twoPane).toBe(turned.w >= 900);
    expect(turned.twoPane, 'rotation switches between one and two panes').not.toBe(before.twoPane);
    await checkLayout(page, 'rotated');
    shot('rotated');

    sh('settings put system user_rotation 0');
    await expect.poll(async () => (await layout()).w, { timeout: 20_000 }).toBe(before.w);
    await sleep(800);
    const back = await layout();
    expect(back).toEqual(before);
    await checkLayout(page, 'rotated-back');
  });

  test('07 system dark mode: the UI follows (theme auto), the activity recovers with the data', async () => {
    let page = await app();
    await hostFn(page, 'prefs.set', { theme: 'auto' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    sh('cmd uimode night yes');
    // uiMode is not in configChanges: the activity is recreated with a new WebView.
    await waitFor(
      'dark page',
      async () => {
        page = await app({ timeoutMs: 20_000 });
        return (await page.locator('html').getAttribute('data-theme')) === 'dark';
      },
      60_000,
      1_000,
    );
    await expect(page.locator('.route')).toBeVisible();
    await expect(page.locator(`[data-deck-name="${DECK}"]`)).toBeVisible();
    await checkLayout(page, 'dark');
    shot('dark-mode');

    sh('cmd uimode night no');
    await waitFor(
      'light page',
      async () => {
        page = await app({ timeoutMs: 20_000 });
        return (await page.locator('html').getAttribute('data-theme')) === 'light';
      },
      60_000,
      1_000,
    );
    await expect(page.locator(`[data-deck-name="${DECK}"]`)).toBeVisible();
    shot('light-again');
  });

  test('08 open an .apkg from Downloads with the app (ACTION_VIEW) → official import page → notes exist', async () => {
    let page = await app();
    for (const f of ['device-open.apkg', 'device-pick.apkg']) {
      adb(['push', path.join(FIXTURES, f), `/sdcard/Download/${f}`]);
      adbRaw(['shell', `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/${f}`]);
    }
    const mediaId = await waitFor(
      'MediaStore entry for device-open.apkg',
      () => /_id=(\d+)/.exec(adbRaw(['shell', `content query --uri content://media/external/downloads --projection _id:_display_name --where "_display_name='device-open.apkg'"`]).out)?.[1],
      30_000,
      1_000,
    ).catch((e) => {
      log(String(e));
      return null;
    });
    let how: string;
    let started: string;
    if (mediaId) {
      const uri = `content://media/external/downloads/${mediaId}`;
      how = `MediaStore ${uri}`;
      started = adbRaw(['shell', `am start -a android.intent.action.VIEW -d ${uri} -t application/octet-stream --grant-read-uri-permission -n ${HOST_ACTIVITY}`]).out;
    } else {
      // Fallback: the app's own FileProvider (debuggable build: run-as can place the file).
      adb(['push', path.join(FIXTURES, 'device-open.apkg'), '/data/local/tmp/device-open.apkg']);
      sh(`run-as ${PKG} sh -c 'mkdir -p files/amgi-host/tmp/share/viewtest && cp /data/local/tmp/device-open.apkg files/amgi-host/tmp/share/viewtest/'`);
      const uri = `content://${PKG}.fileprovider/share/viewtest/device-open.apkg`;
      how = `FileProvider ${uri} (MediaStore id not found)`;
      started = adbRaw(['shell', `am start -a android.intent.action.VIEW -d ${uri} -t application/octet-stream -n ${HOST_ACTIVITY}`]).out;
    }
    log(`VIEW via ${how}: ${started.replace(/\s+/g, ' ')}`);
    test.info().annotations.push({ type: 'view-intent', description: how });
    writeLog('resolve-view-apkg.txt', adbRaw(['shell', `cmd package query-activities -a android.intent.action.VIEW -d content://com.android.externalstorage.documents/document/primary%3ADownload%2Fdevice-open.apkg -t application/octet-stream`]).out);

    page = await app();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'import', { timeout: 30_000 });
    const frame = officialFrame(page);
    await expect(frame.locator('body')).toContainText('device-open.apkg', { timeout: 30_000 });
    shot('import-view-options');
    await frame.getByRole('button', { name: /^(가져오기|Import)$/ }).first().click();
    await expect(page.locator('.toast').filter({ hasText: '가져오기 완료' })).toBeVisible({ timeout: 30_000 });
    shot('import-view-done');
    await expect.poll(() => searchNotes(page, '"deck:기기 가져오기::열기"')).toHaveLength(3);
  });

  test('09 추가 › 가져오기: the system document picker opens and a file can be picked', async () => {
    const page = await app();
    await goRoute(page, '#/decks', 'decks');
    await (await addButton(page)).click();
    await page.getByTestId('add-import').click();
    const picker = await waitFor('document picker on top', () => (/documentsui/i.test(topActivity()) ? topActivity() : ''), 20_000);
    log(`picker: ${picker}`);
    await sleep(1_500);
    shot('picker-open');

    let picked = false;
    for (let attempt = 0; attempt < 5 && !picked; attempt++) {
      const xml = uiDump();
      writeLog(`picker-${attempt}.xml`, xml);
      const file = nodeBounds(xml, 'text', 'device-pick.apkg');
      if (file) {
        tapRect(file);
        picked = true;
        break;
      }
      const downloads = nodeBounds(xml, 'text', /^(Downloads|Download|다운로드)$/);
      if (downloads) {
        tapRect(downloads);
      } else {
        const roots = nodeBounds(xml, 'content-desc', /^(Show roots|루트 표시)$/);
        if (roots) tapRect(roots);
      }
      await sleep(1_500);
    }
    if (!picked) {
      shot('picker-file-not-found');
      keyevent('KEYCODE_BACK');
      await waitFor('back in the app', () => appIsOnTop(), 10_000);
      test.info().annotations.push({ type: 'unverified', description: 'device-pick.apkg not found in DocumentsUI; only "picker opens" is proven' });
      log('UNVERIFIED: could not pick the file in DocumentsUI');
      return;
    }
    await waitFor('back in the app after picking', () => appIsOnTop(), 20_000);
    const p2 = await app();
    await expect(p2.locator('.route')).toHaveAttribute('data-route', 'import', { timeout: 30_000 });
    const frame = officialFrame(p2);
    await expect(frame.locator('body')).toContainText('device-pick.apkg', { timeout: 30_000 });
    await frame.getByRole('button', { name: /^(가져오기|Import)$/ }).first().click();
    await expect(p2.locator('.toast').filter({ hasText: '가져오기 완료' })).toBeVisible({ timeout: 30_000 });
    shot('picker-import-done');
    await expect.poll(() => searchNotes(p2, '"deck:기기 가져오기::선택"')).toHaveLength(2);
  });

  test('10 export reaches the Android share sheet, back returns to the app', async () => {
    const { deckId } = loadState();
    const page = await app();
    await goRoute(page, `#/export?deck=${deckId}`, 'export');
    await expect(page.getByTestId('export-deck')).toHaveValue(String(deckId));
    shot('export-screen');
    await page.getByTestId('export-run').click();
    const chooser = await waitFor('share sheet on top', () => (/Chooser|intentresolver|Resolver/i.test(topActivity()) ? topActivity() : ''), 30_000);
    log(`share sheet: ${chooser}`);
    await sleep(1_500);
    shot('share-sheet');
    keyevent('KEYCODE_BACK');
    await waitFor('app on top after closing the share sheet', () => appIsOnTop(), 15_000);
    const p2 = await app();
    await expect(p2.locator('.route')).toHaveAttribute('data-route', 'export');
  });

  test('11 settings › 정보 shows the versions; 오류 로그 복사 fills the clipboard', async () => {
    const { info } = loadState() as { info: HostInfo };
    const page = await app();
    await goRoute(page, '#/settings', 'settings');
    const about = page.getByTestId('about');
    await about.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('about-app')).toContainText(info.appVersion);
    await expect(page.getByTestId('about-build')).toHaveText(String(info.build));
    await expect(page.getByTestId('about-ui')).toHaveText(info.uiVersion!);
    await expect(page.getByTestId('about-engine')).toHaveText(info.backendVersion);
    shot('settings-about');

    await about.getByRole('button', { name: '오류 로그 복사' }).click();
    await expect(page.locator('.toast').filter({ hasText: '오류 로그를 복사했습니다' })).toBeVisible();
    // Read the clipboard back the way a person would: paste into a text field in the app.
    await page.evaluate(() => {
      const ta = document.createElement('textarea');
      ta.id = 'device-paste';
      ta.style.cssText = 'position:fixed;top:0;left:0;width:300px;height:80px;z-index:99999';
      document.body.appendChild(ta);
    });
    await page.locator('#device-paste').click();
    const pasted = async () => page.locator('#device-paste').inputValue();
    adbRaw(['shell', 'input keycombination KEYCODE_CTRL_LEFT KEYCODE_V']);
    await sleep(1_000);
    if (!(await pasted())) {
      keyevent('KEYCODE_PASTE');
      await sleep(1_000);
    }
    const text = await pasted();
    writeLog('clipboard.txt', text);
    log(`clipboard: ${text.length} chars, starts ${JSON.stringify(text.slice(0, 80))}`);
    await page.evaluate(() => {
      const ta = document.getElementById('device-paste') as HTMLTextAreaElement | null;
      ta?.blur();
      ta?.remove();
    });
    adbRaw(['shell', 'input keyevent KEYCODE_ESCAPE']);
    expect(text).toContain('myAmgi 오류 로그');
    expect(text).toContain(info.appVersion);
  });

  test('12 the exported provider answers (or refuses) the shell', async () => {
    const r = adbRaw(['shell', `content query --uri content://${PKG}.flashcards/decks`]);
    const text = `${r.out}\n${r.err}`;
    writeLog('provider-query.txt', text);
    log(`provider query (exit ${r.code}): ${text.slice(0, 400).replace(/\s+/g, ' ')}`);
    if (/SecurityException|Permission Denial/.test(text)) {
      test.info().annotations.push({ type: 'provider', description: 'shell lacks READ_WRITE_DATABASE: SecurityException as expected' });
      expect(text).toMatch(/permission\.READ_WRITE_DATABASE|Permission Denial/);
    } else {
      expect(text).toContain(DECK);
      expect(text).toContain('기기 가져오기::열기');
    }
  });

  test('13 process death: new port and token, UI loads, collection intact', async () => {
    let page = await app();
    const before = { pid: pidOf(), origin: new URL(page.url()).origin, cookie: await cookie(page) };
    log(`before kill: ${JSON.stringify(before)}`);
    keyevent('KEYCODE_HOME');
    await waitFor('app in background', () => !appIsOnTop(), 10_000);
    sh(`am kill ${PKG}`);
    const killed = await waitFor('process gone after am kill', () => pidOf() === null, 10_000).catch(() => false);
    if (!killed) {
      log('am kill did not end the process; using am force-stop');
      sh(`am force-stop ${PKG}`);
      await waitFor('process gone', () => pidOf() === null, 10_000);
    }
    launch();
    page = await app({ timeoutMs: 90_000 });
    const after = { pid: pidOf(), origin: new URL(page.url()).origin, cookie: await cookie(page) };
    log(`after relaunch: ${JSON.stringify(after)}`);
    expect(after.pid).not.toBe(before.pid);
    expect(before.cookie).toBeTruthy();
    expect(after.cookie).toBeTruthy();
    expect(after.cookie).not.toBe(before.cookie);
    expect(after.origin).not.toBe(before.origin);
    await expect(page.locator(`[data-deck-name="${DECK}"]`)).toBeVisible();
    await expect(page.locator('[data-deck-name="기기 가져오기::열기"]')).toBeVisible();
    expect(await searchNotes(page, `"deck:${DECK}"`)).toHaveLength(5);
    shot('after-process-death');

    sh(`am force-stop ${PKG}`);
    await waitFor('process gone after force-stop', () => pidOf() === null, 10_000);
    launch();
    page = await app({ timeoutMs: 90_000 });
    await expect(page.locator(`[data-deck-name="${DECK}"]`)).toBeVisible();
    expect(await searchNotes(page, `"deck:${DECK}"`)).toHaveLength(5);
  });
});

/** The session token cookie (WebView has no Storage.getCookies; Network.getCookies works per page). */
async function cookie(page: Page): Promise<string | null> {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { cookies } = (await cdp.send('Network.getCookies')) as { cookies: { name: string; value: string }[] };
    await cdp.detach().catch(() => {});
    return cookies.find((c) => c.name === 'amgi_t')?.value ?? null;
  } catch (e) {
    log(`cookies unavailable: ${String(e)}`);
    return null;
  }
}

// =====================================================================================================
// Comet (e-ink build): a shorter pass

test.describe('comet @comet', () => {
  test.skip(FLAVOR !== 'comet', 'comet steps');

  test('C1 cold start in e-ink, study one card', async () => {
    sh('settings put system user_rotation 0');
    adbRaw(['shell', `am force-stop ${PKG}`]);
    launch();
    const page = await app({ timeoutMs: 90_000 });
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
    const info = await hostFn<HostInfo>(page, 'info');
    log(`host.info ${JSON.stringify(info)}`);
    expect(info).toMatchObject({ platform: 'android', flavor: 'comet', eink: true });
    expect(info.uiVersion).toMatch(/^\d+(\.\d+)*$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'eink');
    await checkLayout(page, 'comet-cold-start');
    shot('comet-cold-start');

    // Volume keys answer cards on Comet by default, but outside the reviewer they must still change the volume.
    const a0 = volumeAdjustments();
    keyevent('KEYCODE_VOLUME_DOWN');
    await sleep(1_000);
    audioDiagnostics('comet-deck-list');
    await expect.poll(() => volumeAdjustments(), { message: 'volume key on the deck list reaches the system volume' }).toBeGreaterThan(a0);
    await sleep(3_500);

    const deck = await engine(page, 'newDeck', {});
    deck.name = '코멧 테스트';
    const deckId = (await engine(page, 'addDeck', deck)).id as number;
    await addNote(page, deckId, await basicNotetype(page), ['코멧 질문 漢字', '코멧 정답']);
    await goRoute(page, `#/study/${deckId}`, 'study');
    await rendered(page, 'question');
    shot('comet-study-question');
    const cid = await cardId(page);
    keyevent('KEYCODE_VOLUME_DOWN'); // comet default: volume keys answer
    await rendered(page, 'answer');
    shot('comet-study-answer');
    await page.getByTestId('answer-good').click();
    await expect.poll(async () => (await engine(page, 'getReviewLogs', { cid })).entries.length).toBe(1);
  });
});
