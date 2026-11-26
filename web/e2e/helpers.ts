// Shared harness for the Playwright suite. Every test runs against the REAL
// desktop host (Kotlin + official Anki backend), never a fake.
//
// HOW TO RUN
//   ./gradlew :desktop:installDist          (once, and after host changes; serialize with flock on shared machines)
//   cd web && npm run e2e                     (builds the UI, starts a seeded host, runs everything, stops the host)
//   npm run e2e -- e2e/decks.spec.ts --project=phone   (a subset; any Playwright arguments)
//   AMGI_HOST_URL="http://127.0.0.1:<port>/?t=<token>" npx playwright test
//                                             (reuse a host from `npm run host`; it must have --test-hooks)
//
// STATE
//   One host and one collection serve the whole run (workers: 1). A spec that needs the known seed
//   state calls `resetHost(request)` in `beforeAll`: it deletes and reseeds the collection, prefs,
//   backups and AnkiWeb login. The seed is desktop/.../SampleCollection.kt: fixed deck ids (`SEED.deck`),
//   notes from 2026-01-01, and special cards findable by tag (`SEED.tag`).
//
// ENGINE TRUTH
//   Assert against what the engine says, not against constants: `engine()` calls any backend method
//   through `/_anki/<method>` with the generated protobuf classes (`anki.*`), e.g.
//     const tree = await deckTree(request);
//     const ids = await searchCards(request, `tag:${SEED.tag.audio}`);
//   Host functions: `hostFn(request, 'backup.list')`.
//
// SCREENSHOTS
//   `shot(page, name)` writes e2e/screenshots/<name>.png (git-ignored). Loop over `THEMES` and set the
//   theme with `setTheme(page, request, theme)`; the two sizes are the Playwright projects `phone`
//   (390×844) and `tablet` (1280×800) — include `info.project.name` in the name. Look at the PNGs.
import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { anki } from '../src/anki/generated/proto.js';

export { anki };

export const startUrl = process.env.AMGI_HOST_URL!;
export const token = new URL(startUrl).searchParams.get('t') ?? '';
export const THEMES = ['light', 'dark', 'eink'] as const;
export type Theme = (typeof THEMES)[number];

/** The seeded collection (desktop/src/main/kotlin/.../SampleCollection.kt). */
export const SEED = {
  deck: {
    japanese: 1_767_225_600_001,
    kanji: 1_767_225_600_002,
    vocab: 1_767_225_600_003,
    english: 1_767_225_600_004,
    math: 1_767_225_600_005,
    filtered: 1_767_225_600_006,
  },
  /** Full deck names in deck-list order. */
  deckNames: ['수학', '영어', '일본어', '일본어::어휘', '일본어::한자', '집중 복습'],
  filteredDeck: '집중 복습',
  kanjiNotetype: '한자 (뜻·읽기·예문)',
  noteIdBase: 1_767_225_600_000,
  tag: {
    audio: '샘플::오디오',
    image: '샘플::이미지',
    math: '샘플::수식',
    typeIn: '샘플::입력',
    long: '샘플::긴카드',
    cloze: '샘플::빈칸',
    suspended: '샘플::일시중지',
    flagged: '샘플::깃발',
    fields: '샘플::여러필드',
    marked: 'marked',
  },
} as const;

const auth = () => ({ 'X-Amgi-Token': token });

/** Raw engine call from the test process (same HTTP contract as the UI). */
export async function engine<Res>(
  request: APIRequestContext,
  method: string,
  bytes: Uint8Array,
  Res: { decode(b: Uint8Array): Res },
): Promise<Res> {
  const res = await request.post(`/_anki/${method}`, {
    headers: { ...auth(), 'Content-Type': 'application/binary' },
    data: Buffer.from(bytes),
  });
  expect(res.ok(), `${method}: ${await res.text().catch(() => '')}`).toBeTruthy();
  return Res.decode(new Uint8Array(await res.body()));
}

/** Calls a host function (`POST /api/host/<name>`) and returns its JSON; fails the test on errors. */
export async function hostFn<T = Record<string, unknown>>(request: APIRequestContext, name: string, body: unknown = {}): Promise<T> {
  const res = await request.post(`/api/host/${name}`, { headers: auth(), data: body as object });
  expect(res.ok(), `${name}: ${await res.text().catch(() => '')}`).toBeTruthy();
  return (await res.json()) as T;
}

/** Deletes and reseeds the collection, prefs, backups and sync login (desktop `--test-hooks`). */
export async function resetHost(request: APIRequestContext) {
  await hostFn(request, 'test.reset');
}

/** Publishes a host event to every open UI, as the shell would (e.g. `back`). */
export async function emitHostEvent(request: APIRequestContext, event: string, data: unknown = {}) {
  await hostFn(request, 'test.emit', { event, data });
}

export async function deckTree(request: APIRequestContext) {
  const req = anki.decks.DeckTreeRequest.encode({ now: Math.floor(Date.now() / 1000) }).finish();
  return engine(request, 'deckTree', req, anki.decks.DeckTreeNode);
}

export async function deckNames(request: APIRequestContext): Promise<string[]> {
  const req = anki.decks.GetDeckNamesRequest.encode({ skipEmptyDefault: true, includeFiltered: true }).finish();
  const res = await engine(request, 'getDeckNames', req, anki.decks.DeckNames);
  return res.entries.map((e) => e.name ?? '');
}

export async function searchCards(request: APIRequestContext, search: string): Promise<number[]> {
  const req = anki.search.SearchRequest.encode({ search, order: { none: {} } }).finish();
  return (await engine(request, 'searchCards', req, anki.search.SearchResponse)).ids as number[];
}

export async function searchNotes(request: APIRequestContext, search: string): Promise<number[]> {
  const req = anki.search.SearchRequest.encode({ search, order: { none: {} } }).finish();
  return (await engine(request, 'searchNotes', req, anki.search.SearchResponse)).ids as number[];
}

export async function getNote(request: APIRequestContext, nid: number) {
  return engine(request, 'getNote', anki.notes.NoteId.encode({ nid }).finish(), anki.notes.Note);
}

export async function updateNote(request: APIRequestContext, note: anki.notes.INote) {
  const req = anki.notes.UpdateNotesRequest.encode({ notes: [note], skipUndoEntry: true }).finish();
  await engine(request, 'updateNotes', req, anki.collection.OpChanges);
}

export async function deckConfigsForUpdate(request: APIRequestContext, did: number) {
  return engine(request, 'getDeckConfigsForUpdate', anki.decks.DeckId.encode({ did }).finish(), anki.deck_config.DeckConfigsForUpdate);
}

export async function setPrefs(request: APIRequestContext, patch: Record<string, unknown>) {
  await hostFn(request, 'prefs.set', patch);
}

export async function getPrefs(request: APIRequestContext): Promise<Record<string, unknown>> {
  return hostFn(request, 'prefs.get');
}

/** Opens the app through the token handshake, then navigates to `hash`. */
export async function openApp(page: Page, hash = '/decks') {
  await page.goto(startUrl);
  await page.waitForURL(/\/ui\//);
  await page.goto(`/ui/#${hash}`);
  await expect(page.locator('.route')).toBeVisible();
}

/** Sets the theme pref on the host and checks the open page picked it up (reloads if needed). */
export async function setTheme(page: Page, request: APIRequestContext, theme: Theme) {
  await setPrefs(request, { theme });
  if (page.url().includes('/ui/')) {
    await page.reload();
    await expect(page.locator('.route')).toBeVisible();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

export const SCREENSHOT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');

/** Saves e2e/screenshots/<name>.png (whole viewport, animations off). */
export async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), animations: 'disabled' });
}

/**
 * Screenshots the current screen in every theme: `<name>-<theme>-<project>.png`. `prepare` runs after
 * each theme change (reload) to bring the screen back into the state to capture.
 */
export async function shotAllThemes(
  page: Page,
  request: APIRequestContext,
  info: TestInfo,
  name: string,
  prepare: () => Promise<void> = async () => {},
) {
  for (const theme of THEMES) {
    await setTheme(page, request, theme);
    await prepare();
    await shot(page, `${name}-${theme}-${info.project.name}`);
  }
  await setPrefs(request, { theme: 'light' });
}

/** The frame of the embedded official Anki page (`OfficialPage`). */
export function officialFrame(page: Page) {
  return page.frameLocator('[data-testid="official-frame"]');
}

export const isPhone = (info: TestInfo) => info.project.name === 'phone';

/**
 * Replaces the host's event stream (`/api/host/events`) with one the test controls, for states the
 * real host cannot produce here (AnkiWeb sync progress). Each response carries the queued events and
 * `retry: 50`, so EventSource reconnects and picks up new ones within ~50 ms. Call before `openApp`.
 * For events the real host can deliver, prefer `emitHostEvent` (no interception).
 */
export async function fakeEventStream(page: Page) {
  const queue: string[] = [];
  await page.route('**/api/host/events', async (route) => {
    const body = 'retry: 50\n\n' + queue.splice(0).join('');
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }, body });
  });
  return {
    emit(event: string, data: unknown) {
      queue.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  };
}

/** A promise with its resolve function exposed (to hold an intercepted request open). */
export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
