// Official Anki pages embedded through OfficialPage, served by the real host:
// statistics (graphs), deck options, card info, congrats. Includes saving a deck
// option through the official page and checking the engine stored it.
import { expect, test } from '@playwright/test';
import { flattenDeckTree } from '../src/lib/deckTree';
import {
  deckConfigsForUpdate,
  deckTree,
  officialFrame,
  openApp,
  resetHost,
  SEED,
  setPrefs,
  setTheme,
  shot,
  THEMES,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light' });
});

const PAGES = [
  { hash: `/stats`, name: 'stats', title: '통계', expectText: '카드 개수' },
  { hash: `/deck-options/${SEED.deck.kanji}`, name: 'deck-options', title: '덱 옵션', expectText: '일일 한도' },
  { hash: `/card-info/${SEED.noteIdBase}`, name: 'card-info', title: '카드 정보', expectText: String(SEED.noteIdBase) },
  { hash: `/congrats`, name: 'congrats', title: '축하합니다', expectText: '축하합니다' },
] as const;

for (const p of PAGES) {
  test(`${p.name}: real page, full height, theme hand-off`, async ({ page, request }, info) => {
    await openApp(page, p.hash);
    await expect(page.locator('.app-bar__title')).toHaveText(p.title);
    const frame = officialFrame(page);
    await expect(frame.locator('body')).toContainText(p.expectText);
    if (p.name === 'stats') await expect(frame.locator('svg').first()).toBeAttached();

    // The frame fills the space between the app bar and the tab bar (phone) / the window bottom (tablet).
    const box = (await page.getByTestId('official-frame').boundingBox())!;
    const bar = (await page.locator('.app-bar').boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.y)).toBe(Math.round(bar.y + bar.height));
    expect(box.height).toBeGreaterThan(viewport.height * 0.6);
    const tabbar = page.locator('.tabbar');
    const bottom = (await tabbar.count()) ? (await tabbar.boundingBox())!.y : viewport.height;
    expect(Math.abs(box.y + box.height - bottom)).toBeLessThan(2);

    for (const theme of THEMES) {
      await setTheme(page, request, theme);
      const html = officialFrame(page).locator('html');
      await expect(officialFrame(page).locator('body')).toContainText(p.expectText);
      await expect(html).toHaveAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light');
      if (theme === 'dark') await expect(html).toHaveClass(/night-mode/);
      else await expect(html).not.toHaveClass(/night-mode/);
      await expect(officialFrame(page).locator('#amgi-eink')).toHaveCount(theme === 'eink' ? 1 : 0);
      await page.waitForTimeout(300); // let the page settle after the theme change before the screenshot
      await shot(page, `official-${p.name}-${theme}-${info.project.name}`);
    }
    // Live theme changes follow without a reload.
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await expect(officialFrame(page).locator('html')).toHaveClass(/night-mode/);
  });
}

test('back from an official page returns to the deck list', async ({ page }, info) => {
  await setPrefs(page.request, { theme: 'light' });
  await openApp(page, '/decks');
  await page.locator('[data-deck-name="일본어::한자"]').getByTestId('deck-menu').click();
  await page.getByTestId('menu-options').click();
  await expect(page.locator('.app-bar__title')).toHaveText('덱 옵션');
  await expect(officialFrame(page).locator('body')).toContainText('일일 한도');
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
  if (info.project.name === 'tablet') await expect(page.getByTestId('deck-overview')).toBeVisible();
});

test('deck options: change new cards/day on the official page; saved in the engine, page closes, counts refresh', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light' });
  const before = await deckConfigsForUpdate(request, SEED.deck.kanji);
  const configId = before.currentDeck!.configId;
  const oldLimit = before.allConfig.find((c) => c.config!.id === configId)!.config!.config!.newPerDay;
  const target = oldLimit === 3 ? 4 : 3;

  await openApp(page, '/decks');
  const row = page.locator('[data-deck-name="일본어::한자"]');
  const countBefore = await row.locator('[data-count="new"]').textContent();
  await row.getByTestId('deck-menu').click();
  await page.getByTestId('menu-options').click();
  const frame = officialFrame(page);
  await expect(frame.locator('body')).toContainText('새 카드/일');
  // The first number input on the page is "새 카드/일" (Daily Limits section).
  const input = frame.locator('input[type=number]').first();
  await input.fill(String(target));
  await input.press('Tab');
  await shot(page, `official-deck-options-edited-${info.project.name}`);
  await frame.getByRole('button', { name: /^(Save|저장)$/ }).first().click();

  // The host emits anki-page {close: true}; the app goes back with a toast.
  await expect(page.locator('.toast')).toContainText('저장했습니다');
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');

  const after = await deckConfigsForUpdate(request, SEED.deck.kanji);
  expect(after.allConfig.find((c) => c.config!.id === configId)!.config!.config!.newPerDay).toBe(target);

  // Counts were refreshed from the engine.
  const expected = flattenDeckTree(await deckTree(request)).find((r) => r.fullName === '일본어::한자')!;
  await expect(row.locator('[data-count="new"]')).toHaveText(String(expected.newCount));
  expect(String(expected.newCount)).not.toBe(countBefore);
});
