// 설정 › 도구 against the real engine: check database, check media (with an unused file
// to trash), empty cards (made by removing a cloze from a seeded note).
import { expect, test } from '@playwright/test';
import { anki, engine, getNote, openApp, resetHost, searchCards, searchNotes, SEED, setPrefs, shot, shotAllThemes, updateNote } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light' });
});

test('check database, check media, empty cards', async ({ page, request }, info) => {
  await resetHost(request);
  await openApp(page, '/settings/tools');
  await shotAllThemes(page, request, info, 'tools');

  // Database
  await page.getByTestId('tool-db-run').click();
  await expect(page.getByTestId('db-result')).toContainText('문제가 없습니다');
  await shot(page, `tools-db-result-${info.project.name}`);
  await page.getByTestId('db-result').getByRole('button', { name: '확인' }).click();

  // Media: everything used, then an unused file appears and is trashed.
  await page.getByTestId('tool-media-run').click();
  await expect(page.getByTestId('media-summary')).toContainText('문제가 없습니다');
  await page.getByTestId('media-result').getByRole('button', { name: '확인' }).click();
  const add = anki.media.AddMediaFileRequest.encode({ desiredName: 'unused_e2e.txt', data: new TextEncoder().encode('x') }).finish();
  await engine(request, 'addMediaFile', add, anki.generic.String);
  await page.getByTestId('tool-media-run').click();
  await expect(page.getByTestId('media-summary')).toContainText('사용하지 않는 파일 1개');
  await shot(page, `tools-media-result-${info.project.name}`);
  await page.getByTestId('media-trash').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('.toast').filter({ hasText: '파일 1개를 삭제했습니다' })).toBeVisible();
  const check = await engine(request, 'checkMedia', anki.generic.Empty.encode({}).finish(), anki.media.CheckMediaResponse);
  expect(check.unused).toEqual([]);

  // Empty cards: none, then remove c2 from the two-cloze note.
  await page.getByTestId('tool-empty-run').click();
  await expect(page.getByTestId('empty-result')).toContainText('빈 카드가 없습니다');
  await page.getByTestId('empty-result').getByRole('button', { name: '확인' }).click();
  const [nid] = await searchNotes(request, `tag:${SEED.tag.cloze} 후지산`);
  const note = await getNote(request, nid);
  expect(await searchCards(request, `nid:${nid}`)).toHaveLength(2);
  note.fields[0] = note.fields[0].replace('{{c2::후지산}}', '후지산');
  await updateNote(request, note);
  await page.getByTestId('tool-empty-run').click();
  await expect(page.getByTestId('empty-message')).toHaveText('빈 카드 1장을 삭제합니다.');
  await shot(page, `tools-empty-confirm-${info.project.name}`);
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '1장 삭제' }).click();
  await expect(page.locator('.toast').filter({ hasText: '빈 카드 1장을 삭제했습니다' })).toBeVisible();
  expect(await searchCards(request, `nid:${nid}`)).toHaveLength(1);
});
