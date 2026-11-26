import { expect, test } from '@playwright/test';
import { flattenDeckTree } from '../src/lib/deckTree';
import { deckNames, deckTree, openApp, resetHost, SEED, setPrefs, shot, THEMES } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'auto' });
});

for (const theme of THEMES) {
  test(`deck list shows the engine's decks and counts (${theme})`, async ({ page, request }, info) => {
    await setPrefs(request, { theme });
    await openApp(page, '/decks');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const expected = flattenDeckTree(await deckTree(request));
    const rows = page.getByTestId('deck-row');
    await expect(rows).toHaveCount(expected.length);
    for (const [i, row] of expected.entries()) {
      const el = rows.nth(i);
      await expect(el).toHaveAttribute('data-deck-name', row.fullName);
      await expect(el.locator('[data-count="new"]')).toHaveText(String(row.newCount));
      await expect(el.locator('[data-count="learn"]')).toHaveText(String(row.learnCount));
      await expect(el.locator('[data-count="review"]')).toHaveText(String(row.reviewCount));
    }
    // The seeded collection: nested decks (expanded), a filtered deck, every count kind non-zero.
    expect(expected.map((r) => r.fullName)).toEqual(SEED.deckNames);
    const japanese = expected.find((r) => r.fullName === '일본어')!;
    expect(japanese.newCount).toBeGreaterThan(0);
    expect(japanese.learnCount).toBeGreaterThan(0);
    expect(japanese.reviewCount).toBeGreaterThan(0);
    await expect(page.locator(`[data-deck-name="${SEED.filteredDeck}"]`)).toHaveClass(/deck-row--filtered/);
    await expect(page.getByTestId('studied-today')).not.toBeEmpty();

    // Indentation: children start 20px further right than their parent.
    const parentBox = await page.locator('[data-deck-name="일본어"] .deck-row__name').boundingBox();
    const childBox = await page.locator('[data-deck-name="일본어::한자"] .deck-row__name').boundingBox();
    expect(Math.round(childBox!.x - parentBox!.x)).toBe(20);

    if (info.project.name === 'tablet') {
      // Two panes: the overview of the selected deck is visible next to the list.
      await page.locator('[data-deck-name="일본어::한자"]').click();
      await expect(page.getByTestId('deck-overview')).toBeVisible();
      await expect(page.locator('.overview__title')).toHaveText('한자');
      await expect(page.locator('[data-deck-name="일본어::한자"]')).toHaveClass(/deck-row--selected/);
    }
    await shot(page, `decks-${theme}-${info.project.name}`);

    // Row menu
    await page.locator('[data-deck-name="일본어::한자"]').getByTestId('deck-menu').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await shot(page, `decks-menu-${theme}-${info.project.name}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
}

test('deck overview (phone route) and description sanitizing', async ({ page }, info) => {
  await openApp(page, '/decks');
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toHaveAttribute('data-deck-id', String(SEED.deck.kanji));
  await page.goto(`/ui/#/deck/${SEED.deck.kanji}`);
  await expect(page.getByTestId('deck-overview')).toBeVisible();
  await expect(page.locator('.overview__count--new .overview__count-value')).not.toHaveText('');
  await expect(page.getByTestId('deck-description')).toContainText('JLPT N3');
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.getByTestId('deck-description').locator('script, [onclick]')).toHaveCount(0);
  await expect(page.getByTestId('start-study')).toBeEnabled();
  await shot(page, `overview-${info.project.name}`);
});

test('create, rename, add sub-deck and delete round-trip through the engine', async ({ page, request }, info) => {
  const base = `테스트덱-${info.project.name}-${Date.now() % 100000}`;
  await openApp(page, '/decks');

  // Create through the 추가 menu.
  await page.getByTestId(info.project.name === 'tablet' ? 'rail-add' : 'fab-add').click();
  await page.getByTestId('add-deck').click();
  const dialog = page.getByTestId('prompt-dialog');
  await expect(dialog).toBeVisible();
  await shot(page, `dialog-create-${info.project.name}`);
  await dialog.locator('input').fill(base);
  await dialog.getByRole('button', { name: '만들기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(`[data-deck-name="${base}"]`)).toBeVisible();
  expect(await deckNames(request)).toContain(base);

  // Duplicate names are refused before reaching the engine.
  await page.getByTestId(info.project.name === 'tablet' ? 'rail-add' : 'fab-add').click();
  await page.getByTestId('add-deck').click();
  await dialog.locator('input').fill(base);
  await dialog.getByRole('button', { name: '만들기' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('같은 이름의 덱이 이미 있습니다');
  await dialog.getByRole('button', { name: '취소' }).click();

  // Rename
  const renamed = `${base}-새이름`;
  await page.locator(`[data-deck-name="${base}"]`).getByTestId('deck-menu').click();
  await page.getByTestId('menu-rename').click();
  await dialog.locator('input').fill(renamed);
  await dialog.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.locator(`[data-deck-name="${renamed}"]`)).toBeVisible();
  let names = await deckNames(request);
  expect(names).toContain(renamed);
  expect(names).not.toContain(base);

  // Sub-deck
  await page.locator(`[data-deck-name="${renamed}"]`).getByTestId('deck-menu').click();
  await page.getByTestId('menu-subdeck').click();
  await dialog.locator('input').fill('하위');
  await dialog.getByRole('button', { name: '만들기' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await deckNames(request)).toContain(`${renamed}::하위`);

  // Delete (names the deck and the card count)
  await page.locator(`[data-deck-name="${renamed}"]`).getByTestId('deck-menu').click();
  await page.getByTestId('menu-delete').click();
  const confirm = page.getByTestId('confirm-dialog');
  await expect(confirm.getByTestId('delete-message')).toHaveText(`'${renamed}' 덱과 카드 0장을 삭제합니다`);
  await shot(page, `dialog-delete-${info.project.name}`);
  await confirm.getByRole('button', { name: '삭제' }).click();
  await expect(page.locator(`[data-deck-name="${renamed}"]`)).toHaveCount(0);
  names = await deckNames(request);
  expect(names.some((n) => n.startsWith(renamed))).toBe(false);
});

test('collapse persists across reload (stored in the engine)', async ({ page, request }) => {
  await openApp(page, '/decks');
  const parent = page.locator('[data-deck-name="일본어"]');
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
  await parent.getByTestId('deck-toggle').click();
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toHaveCount(0);
  await expect.poll(async () => (await deckTree(request)).children.find((c) => c.name === '일본어')?.collapsed).toBe(true);

  await page.reload();
  await expect(page.locator('[data-deck-name="일본어"]')).toBeVisible();
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toHaveCount(0);
  await expect(page.locator('[data-deck-name="일본어"]').getByTestId('deck-toggle')).toHaveAttribute('aria-expanded', 'false');

  // Expand again (restores the seeded state).
  await page.locator('[data-deck-name="일본어"]').getByTestId('deck-toggle').click();
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-deck-name="일본어::한자"]')).toBeVisible();
});
