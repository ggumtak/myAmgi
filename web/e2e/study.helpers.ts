// Test utilities for the reviewer specs. Everything a test needs is created
// through the engine (`POST /_anki/<method>`) in a fresh deck, so the specs do
// not depend on the seed collection beyond "the host is running".
import { expect, type APIRequestContext, type Frame, type Page } from '@playwright/test';
import { methods, type MethodName, type MethodRequest, type MethodResponse } from '../src/anki/generated/methods.js';
import { anki } from '../src/anki/generated/proto.js';
import { openApp, token } from './helpers';

const auth = () => ({ 'X-Amgi-Token': token });

/** Typed engine call from the test process. */
export async function call<M extends MethodName>(request: APIRequestContext, name: M, req: MethodRequest<M> = {} as MethodRequest<M>): Promise<MethodResponse<M>> {
  const spec = methods[name] as unknown as { request: { encode(m: unknown): { finish(): Uint8Array } }; response: { decode(b: Uint8Array): MethodResponse<M> } };
  const res = await request.post(`/_anki/${name}`, {
    headers: { ...auth(), 'Content-Type': 'application/binary' },
    data: Buffer.from(spec.request.encode(req).finish()),
  });
  expect(res.ok(), `${name}: ${await res.text().catch(() => '')}`).toBeTruthy();
  return spec.response.decode(new Uint8Array(await res.body()));
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function uniq(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export async function createDeck(request: APIRequestContext, name: string): Promise<number> {
  const deck = await call(request, 'newDeck', {});
  deck.name = name;
  return (await call(request, 'addDeck', deck)).id;
}

/** A deck options preset with `patch` (legacy JSON keys: autoplay, replayq, maxTaken, timer, ...) assigned to `deckId`. */
export async function setDeckOptions(request: APIRequestContext, deckId: number, patch: Record<string, unknown>, newSteps?: number[]) {
  const base = JSON.parse(dec.decode((await call(request, 'newDeckConfigLegacy', {})).json));
  const conf = { ...base, ...patch, name: uniq('e2e-preset-') };
  if (newSteps) conf.new = { ...conf.new, delays: newSteps };
  const id = (await call(request, 'addOrUpdateDeckConfigLegacy', { json: enc.encode(JSON.stringify(conf)) })).dcid;
  const deck = await call(request, 'getDeck', { did: deckId });
  deck.normal!.configId = id;
  await call(request, 'updateDeck', deck);
  return id;
}

export async function stockNotetypeId(request: APIRequestContext, kind: 'basic' | 'cloze' | 'typing' = 'basic'): Promise<number> {
  const names = await call(request, 'getNotetypeNames', {});
  const Kind = anki.notetypes.StockNotetype.OriginalStockKind;
  const want = kind === 'basic' ? Kind.ORIGINAL_STOCK_KIND_BASIC : kind === 'cloze' ? Kind.ORIGINAL_STOCK_KIND_CLOZE : Kind.ORIGINAL_STOCK_KIND_BASIC_TYPING;
  for (const e of names.entries) {
    const nt = await call(request, 'getNotetype', { ntid: e.id });
    if (nt.config?.originalStockKind === want) return nt.id;
  }
  throw new Error(`no stock notetype ${kind}`);
}

/** A new note type cloned from Basic with the given templates and CSS. */
export async function createNotetype(
  request: APIRequestContext,
  opts: { fields?: string[]; qfmt: string; afmt: string; css?: string; name?: string },
): Promise<number> {
  const basic = await call(request, 'getNotetype', { ntid: await stockNotetypeId(request, 'basic') });
  const nt = anki.notetypes.Notetype.decode(anki.notetypes.Notetype.encode(basic).finish());
  nt.id = 0;
  nt.name = opts.name ?? uniq('e2e-type-');
  const fieldNames = opts.fields ?? ['Front', 'Back'];
  const proto = nt.fields[0];
  nt.fields = fieldNames.map((name) => ({ ...proto, ord: null, name, config: { ...proto.config, id: null } }));
  nt.templates = [{ ...nt.templates[0], ord: null, name: 'Card 1', config: { ...nt.templates[0].config, id: null, qFormat: opts.qfmt, aFormat: opts.afmt } }];
  if (opts.css !== undefined) nt.config!.css = opts.css;
  return (await call(request, 'addNotetype', nt)).id;
}

export async function addNote(request: APIRequestContext, deckId: number, notetypeId: number, fields: string[], tags: string[] = []): Promise<{ noteId: number; cardIds: number[] }> {
  const note = await call(request, 'newNote', { ntid: notetypeId });
  note.fields = fields;
  note.tags = tags;
  const noteId = (await call(request, 'addNote', { note, deckId })).noteId;
  const cardIds = (await call(request, 'cardsOfNote', { nid: noteId })).cids;
  return { noteId, cardIds };
}

export async function addMedia(request: APIRequestContext, name: string, data: Uint8Array): Promise<string> {
  return (await call(request, 'addMediaFile', { desiredName: name, data })).val;
}

export function getCard(request: APIRequestContext, cid: number) {
  return call(request, 'getCard', { cid });
}

export async function reviewLogs(request: APIRequestContext, cid: number) {
  return (await call(request, 'getReviewLogs', { cid })).entries;
}

export async function noteTags(request: APIRequestContext, nid: number) {
  return (await call(request, 'getNote', { nid })).tags;
}

/** Engine's queue for `deckId` (makes it the current deck, as the reviewer does). */
export async function queueFor(request: APIRequestContext, deckId: number, fetchLimit = 1) {
  await call(request, 'setCurrentDeck', { did: deckId });
  return call(request, 'getQueuedCards', { fetchLimit, intradayLearningOnly: false });
}

/** A short silent WAV (valid RIFF) so <audio> could play it. */
export function wav(ms = 200): Uint8Array {
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
  buf.fill(128, 44);
  return new Uint8Array(buf);
}

/**
 * Replaces HTMLMediaElement.play with a spy (in the app and the card frame):
 * every call is recorded in `window.__plays` (top window) and the element
 * "ends" after `ms` so sequential playback can be observed without real audio.
 */
export async function installPlaySpy(page: Page, ms = 150) {
  await page.addInitScript((delay: number) => {
    const top = window.top as unknown as { __plays?: string[] };
    try {
      if (window === window.top) top.__plays = [];
    } catch {
      return;
    }
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      try {
        (window.top as unknown as { __plays: string[] }).__plays.push(decodeURIComponent(this.src || this.currentSrc).split('/').pop() || '');
      } catch {
        // ignore
      }
      const el = this;
      const src = el.src;
      setTimeout(() => {
        if (el.src === src) el.dispatchEvent(new Event('ended'));
      }, delay);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  }, ms);
}

export async function plays(page: Page): Promise<string[]> {
  return page.evaluate(() => [...((window as unknown as { __plays?: string[] }).__plays ?? [])]);
}

export async function clearPlays(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __plays: string[] }).__plays = [];
  });
}

/** Opens the reviewer for `deckId` and waits until the question is rendered in the frame. */
export async function openStudy(page: Page, deckId: number) {
  await openApp(page, `/study/${deckId}`);
  await waitRendered(page, 'question');
}

export async function waitRendered(page: Page, side: 'question' | 'answer') {
  await expect(page.getByTestId('study')).toHaveAttribute('data-rendered', side, { timeout: 15_000 });
}

export function cardFrame(page: Page): Frame {
  const f = page.frames().find((fr) => fr.url().includes('__amgi_frame.html'));
  if (!f) throw new Error('card frame not found');
  return f;
}

export async function shownCardId(page: Page): Promise<number> {
  return Number(await page.getByTestId('study').getAttribute('data-card-id'));
}

export async function showAnswer(page: Page) {
  await page.getByTestId('show-answer').click();
  await waitRendered(page, 'answer');
}
