import { expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { anki } from '../src/anki/generated/proto.js';

export const startUrl = process.env.AMGI_E2E_START!;
export const token = new URL(startUrl).searchParams.get('t') ?? '';
export const isFake = !process.env.AMGI_HOST_URL;
export const THEMES = ['light', 'dark', 'eink'] as const;
export type Theme = (typeof THEMES)[number];

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

export async function deckTree(request: APIRequestContext) {
  const req = anki.decks.DeckTreeRequest.encode({ now: Math.floor(Date.now() / 1000) }).finish();
  return engine(request, 'deckTree', req, anki.decks.DeckTreeNode);
}

export async function deckNames(request: APIRequestContext): Promise<string[]> {
  const req = anki.decks.GetDeckNamesRequest.encode({ skipEmptyDefault: true, includeFiltered: true }).finish();
  const res = await engine(request, 'getDeckNames', req, anki.decks.DeckNames);
  return res.entries.map((e) => e.name ?? '');
}

export async function setPrefs(request: APIRequestContext, patch: Record<string, unknown>) {
  const res = await request.post('/api/host/prefs.set', { headers: auth(), data: patch });
  expect(res.ok()).toBeTruthy();
}

export async function getPrefs(request: APIRequestContext): Promise<Record<string, unknown>> {
  const res = await request.post('/api/host/prefs.get', { headers: auth(), data: {} });
  return res.json();
}

/** Resets the fake host to a freshly seeded collection (no-op on a real host). */
export async function resetFake(request: APIRequestContext) {
  if (!isFake) return;
  const res = await request.post('/__fake/reset', { headers: auth() });
  expect(res.ok()).toBeTruthy();
}

/** Opens the app through the token handshake, then navigates to `hash`. */
export async function openApp(page: Page, hash = '/decks') {
  await page.goto(startUrl);
  await page.waitForURL(/\/ui\//);
  await page.goto(`/ui/#${hash}`);
  await expect(page.locator('.route')).toBeVisible();
}

export async function shot(page: Page, name: string) {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
}
