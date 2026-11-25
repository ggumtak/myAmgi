import { expect, test } from '@playwright/test';
import { getPrefs, openApp, setPrefs, shot, THEMES } from './helpers';

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'auto' });
});

test('theme switch persists via host prefs', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light' });
  await openApp(page, '/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(async () => (await getPrefs(request)).theme).toBe('dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('theme-dark').locator('input')).toBeChecked();
  // Not stored in the browser: a fresh context (new origin storage) still gets it.
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  await page.getByTestId('theme-eink').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'eink');
  await expect.poll(async () => (await getPrefs(request)).theme).toBe('eink');
  await shot(page, `settings-eink-${info.project.name}`);
});

for (const theme of THEMES) {
  test(`settings and about show host info (${theme})`, async ({ page, request }, info) => {
    await setPrefs(request, { theme });
    await openApp(page, '/settings');
    await expect(page.getByTestId('about-ui')).not.toHaveText('…');
    await expect(page.getByTestId('about-engine')).toContainText('26.9.4');
    await shot(page, `settings-${theme}-${info.project.name}`);
    await page.getByTestId('about').scrollIntoViewIfNeeded();
    await shot(page, `settings-about-${theme}-${info.project.name}`);
  });
}

test('every spec route renders (placeholders name their screen)', async ({ page }) => {
  await openApp(page, '/decks');
  const routes: [string, string][] = [
    ['/study/1', '학습'],
    ['/browse?q=deck:x', '찾아보기'],
    ['/note/new?deck=1', '노트 추가'],
    ['/note/5', '노트 편집'],
    ['/notetypes', '노트 유형'],
    ['/notetype/1', '노트 유형 편집'],
    ['/settings/sync', '동기화'],
    ['/settings/backup', '백업'],
    ['/settings/about', '정보'],
    ['/custom-study/1', '맞춤 학습'],
    ['/filtered-deck/new', '필터 덱 만들기'],
    ['/export', '내보내기'],
  ];
  for (const [hash, title] of routes) {
    await page.goto(`/ui/#${hash}`);
    await expect(page.locator('.app-bar__title')).toHaveText(title);
  }
  for (const [hash, title, page_] of [
    ['/stats', '통계', 'graphs'],
    ['/deck-options/1', '덱 옵션', 'deck-options'],
    ['/card-info/1', '카드 정보', 'card-info'],
  ] as const) {
    await page.goto(`/ui/#${hash}`);
    await expect(page.locator('.app-bar__title')).toHaveText(title);
    const frame = page.frameLocator('[data-testid="official-frame"]');
    if (!process.env.AMGI_HOST_URL) await expect(frame.locator('#official-page')).toHaveAttribute('data-page', page_);
  }
  await page.goto('/ui/#/nope');
  await expect(page.getByText('화면을 찾을 수 없습니다')).toBeVisible();
});

test('official pages adopt the theme', async ({ page, request }) => {
  test.skip(!!process.env.AMGI_HOST_URL, 'checks the fake page stand-in');
  await setPrefs(request, { theme: 'dark' });
  await openApp(page, '/deck-options/1');
  const html = page.frameLocator('[data-testid="official-frame"]').locator('html');
  await expect(html).toHaveAttribute('data-bs-theme', 'dark');
  await expect(html).toHaveClass(/night-mode/);
});
