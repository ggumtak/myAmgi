import { expect, test } from '@playwright/test';
import { getPrefs, hostFn, openApp, resetHost, setPrefs, shot, THEMES } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

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
    const host = await hostFn<{ uiVersion: string; backendVersion: string }>(request, 'info');
    expect(host.uiVersion).toMatch(/^\d+(\.\d+)*$/);
    await expect(page.getByTestId('about-ui')).toHaveText(host.uiVersion);
    await expect(page.getByTestId('about-engine')).toHaveText(host.backendVersion);
    expect(host.backendVersion).toContain('26.09.4');
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
    ['/settings/tools', '도구'],
    ['/custom-study/1', '맞춤 학습'],
    ['/filtered-deck/new', '필터 덱 만들기'],
    ['/export', '내보내기'],
    ['/stats', '통계'],
    ['/deck-options/1', '덱 옵션'],
    ['/card-info/1', '카드 정보'],
    ['/congrats', '축하합니다'],
  ];
  for (const [hash, title] of routes) {
    await page.goto(`/ui/#${hash}`);
    await expect(page.locator('.app-bar__title')).toHaveText(title);
  }
  await page.goto('/ui/#/nope');
  await expect(page.getByText('화면을 찾을 수 없습니다')).toBeVisible();
});
