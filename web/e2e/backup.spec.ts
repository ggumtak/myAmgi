// 설정 › 백업 end to end against the real engine: create, list, keep count, restore
// (with the confirmation naming the backup date) and the automatic safety backup.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { anki, deckNames, engine, hostFn, openApp, resetHost, setPrefs, shot, shotAllThemes } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light', 'backup.keep': null });
});

async function addDeck(request: APIRequestContext, name: string) {
  const deck = await engine(request, 'newDeck', anki.generic.Empty.encode({}).finish(), anki.decks.Deck);
  deck.name = name;
  await engine(request, 'addDeck', anki.decks.Deck.encode(deck).finish(), anki.collection.OpChangesWithId);
}

type List = { keep: number; backups: { name: string; size: number; time: number }[] };

test('back up now, restore with confirmation, keep count', async ({ page, request }, info) => {
  await resetHost(request);
  await openApp(page, '/settings/backup');
  await expect(page.getByTestId('empty-state')).toContainText('백업이 없습니다');
  await shotAllThemes(page, request, info, 'backup-empty');

  await page.getByTestId('backup-now').click();
  await expect(page.locator('.toast').filter({ hasText: '백업했습니다' })).toBeVisible();
  await expect(page.getByTestId('backup-row')).toHaveCount(1);
  const list1 = await hostFn<List>(request, 'backup.list');
  expect(list1.backups).toHaveLength(1);
  expect(list1.backups[0].name).toMatch(/^backup-\d{4}-\d{2}-\d{2}-\d{2}\.\d{2}\.\d{2}(-\d+)?\.colpkg$/);
  await expect(page.getByTestId('backup-row')).toContainText(list1.backups[0].name);
  await shotAllThemes(page, request, info, 'backup-list');

  // A change after the backup, then restore: the change is gone and a safety backup exists.
  const extra = `백업 뒤 덱 ${info.project.name}`;
  await addDeck(request, extra);
  expect(await deckNames(request)).toContain(extra);
  await page.getByTestId('backup-restore').first().click();
  const confirm = page.getByTestId('confirm-dialog');
  const m = /backup-(\d{4})-(\d{2})-(\d{2})/.exec(list1.backups[0].name)!;
  await expect(confirm.getByTestId('restore-message')).toContainText(`${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`);
  await expect(confirm.getByTestId('restore-message')).toContainText('백업으로 컬렉션 전체를 되돌립니다');
  await shot(page, `backup-restore-confirm-${info.project.name}`);
  await confirm.getByRole('button', { name: '복원' }).click();
  await expect(page.locator('.toast').filter({ hasText: '복원했습니다' })).toBeVisible();
  expect(await deckNames(request)).not.toContain(extra);
  await expect(page.getByTestId('backup-row')).toHaveCount(2);
  expect((await hostFn<List>(request, 'backup.list')).backups).toHaveLength(2);

  // Keep count: stored as the host pref the BackupService prunes by.
  await page.getByTestId('backup-keep').selectOption('5');
  await expect.poll(async () => (await hostFn<List>(request, 'backup.list')).keep).toBe(5);
  await expect(page.getByTestId('backup-keep')).toHaveValue('5');

  // The deck list shows the restored collection.
  await page.goto('/ui/#/decks');
  await expect(page.locator(`[data-deck-name="${extra}"]`)).toHaveCount(0);
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
});
