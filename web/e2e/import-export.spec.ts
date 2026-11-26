// Export (#/export) and import (추가 › 가져오기) end to end against the real engine:
// .apkg export → delete the deck → re-import through the official import page;
// .colpkg export → change the collection → replace it from the file (with confirmation).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import { anki, deckNames, engine, hostFn, isPhone, officialFrame, openApp, resetHost, searchNotes, SEED, setPrefs, shot, shotAllThemes } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light' });
});

async function exportFile(page: Page, info: TestInfo): Promise<string> {
  const download = page.waitForEvent('download');
  await page.getByTestId('export-run').click();
  const d = await download;
  const file = info.outputPath(d.suggestedFilename());
  await d.saveAs(file);
  await expect(page.getByTestId('export-done')).toContainText(d.suggestedFilename());
  return file;
}

async function pickImport(page: Page, info: TestInfo, file: string) {
  await page.goto('/ui/#/decks');
  await page.getByTestId(isPhone(info) ? 'fab-add' : 'rail-add').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-import').click();
  await (await chooser).setFiles(file);
}

test('apkg: export a deck, delete it, import it back through the official page', async ({ page, request }, info) => {
  await resetHost(request);
  await openApp(page, `/export?deck=${SEED.deck.kanji}`);
  await expect(page.getByTestId('export-deck')).toHaveValue(String(SEED.deck.kanji));
  await shotAllThemes(page, request, info, 'export', () => expect(page.getByTestId('export-deck')).toBeVisible());
  const notesBefore = (await searchNotes(request, `"deck:일본어::한자"`)).length;
  const file = await exportFile(page, info);
  expect(path.basename(file)).toBe('일본어_한자.apkg');
  await expect(page.locator('.toast').filter({ hasText: `내보내기 완료: 노트 ${notesBefore}개` })).toBeVisible();
  await shot(page, `export-done-${info.project.name}`);

  await engine(request, 'removeDecks', anki.decks.DeckIds.encode({ dids: [SEED.deck.kanji] }).finish(), anki.collection.OpChangesWithCount);
  expect(await deckNames(request)).not.toContain('일본어::한자');

  await pickImport(page, info, file);
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'import');
  await expect(page.locator('.app-bar__title')).toHaveText('덱 가져오기');
  await expect(officialFrame(page).locator('body')).toContainText('일본어_한자.apkg');
  const frame = officialFrame(page);
  await expect(frame.locator('body')).toContainText('가져오기 옵션');
  await shot(page, `import-apkg-options-${info.project.name}`);
  await frame.getByRole('button', { name: /^(가져오기|Import)$/ }).first().click();
  await expect(page.locator('.toast').filter({ hasText: '가져오기 완료' })).toBeVisible();
  await expect(frame.locator('body')).toContainText(String(notesBefore));
  await shot(page, `import-apkg-done-${info.project.name}`);

  expect(await deckNames(request)).toContain('일본어::한자');
  expect((await searchNotes(request, `"deck:일본어::한자"`)).length).toBe(notesBefore);
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
});

test('colpkg: export the collection, change it, replace it from the file', async ({ page, request }, info) => {
  await resetHost(request);
  await openApp(page, '/export');
  await page.getByTestId('export-format-colpkg').click();
  await expect(page.getByTestId('export-scheduling')).toHaveCount(0);
  const file = await exportFile(page, info);
  expect(path.basename(file)).toMatch(/^myAmgi-\d{8}-\d{4}\.colpkg$/);

  const extra = `바꾸기 전 덱 ${info.project.name}`;
  const deck = await engine(request, 'newDeck', anki.generic.Empty.encode({}).finish(), anki.decks.Deck);
  deck.name = extra;
  await engine(request, 'addDeck', anki.decks.Deck.encode(deck).finish(), anki.collection.OpChangesWithId);

  await pickImport(page, info, file);
  const confirm = page.getByTestId('confirm-dialog');
  await expect(confirm.getByTestId('colpkg-message')).toHaveText(`'${path.basename(file)}' 파일로 이 기기의 컬렉션 전체를 바꿉니다.`);
  await shot(page, `import-colpkg-confirm-${info.project.name}`);
  await confirm.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.locator('.toast').filter({ hasText: '컬렉션을 바꿨습니다' })).toBeVisible();
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
  await expect(page.locator(`[data-deck-name="${extra}"]`)).toHaveCount(0);
  expect(await deckNames(request)).not.toContain(extra);
  // The host backed up the replaced collection first.
  expect((await hostFn<{ backups: unknown[] }>(request, 'backup.list')).backups).toHaveLength(1);
});

test('import refuses unsupported files with a Korean message', async ({ page }, info) => {
  await openApp(page, '/decks');
  await page.getByTestId(isPhone(info) ? 'fab-add' : 'rail-add').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-import').click();
  await (await chooser).setFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await expect(page.locator('.toast').filter({ hasText: '가져오기 실패: 가져올 수 없는 파일 형식입니다: notes.pdf' })).toBeVisible();
});
