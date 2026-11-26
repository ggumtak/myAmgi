// The Android shell protocol, exercised from the desktop host: ui.ready, ui.state on
// theme changes, back {id} → in-app back + ui.backHandled (exit on the root screen),
// the `update` event's "새 화면으로 다시 열기", and open-file starting the import flow.
// The desktop host has no ui.* functions, so those calls are intercepted and recorded;
// events go through the real host (test.emit).
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { emitHostEvent, hostFn, openApp, resetHost, setPrefs, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light' });
});

async function recordShellCalls(page: Page) {
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  await page.route(/\/api\/host\/(ui\.[a-zA-Z]+|platform\.exit|update\.apply)$/, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    calls.push({ name, body: JSON.parse(route.request().postData() || '{}') });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  return calls;
}

test('ui.ready, ui.state, back with acknowledgement, exit on root', async ({ page, request }) => {
  await setPrefs(request, { theme: 'dark' });
  const calls = await recordShellCalls(page);
  await openApp(page, '/decks');
  const info = await hostFn<{ uiVersion: string }>(request, 'info');
  await expect.poll(() => calls.filter((c) => c.name === 'ui.ready').map((c) => c.body)).toEqual([{ uiVersion: info.uiVersion, features: ['back-ack'] }]);
  await expect.poll(() => calls.filter((c) => c.name === 'ui.state').at(-1)?.body).toEqual({ theme: 'dark', background: '#121316' });

  await page.goto('/ui/#/settings');
  await page.getByTestId('theme-eink').click();
  await expect.poll(() => calls.filter((c) => c.name === 'ui.state').at(-1)?.body).toEqual({ theme: 'eink', background: '#FFFFFF' });

  // back {id}: in-app back, then acknowledged.
  await page.getByTestId('settings-sync').click();
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings-sync');
  await emitHostEvent(request, 'back', { id: 41 });
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings');
  await expect.poll(() => calls.filter((c) => c.name === 'ui.backHandled').map((c) => c.body)).toEqual([{ id: 41 }]);

  // An open sheet closes first.
  await page.getByTestId('settings-backup').click();
  await page.getByTestId('backup-now').waitFor();
  await page.goto('/ui/#/decks');
  await page.locator('[data-deck-name="영어"]').getByTestId('deck-menu').click();
  await page.getByTestId('menu-delete').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await emitHostEvent(request, 'back', { id: 42 });
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
  await expect.poll(() => calls.filter((c) => c.name === 'ui.backHandled').length).toBe(2);

  // Root screen: exit instead of acknowledging.
  await emitHostEvent(request, 'back', { id: 43 });
  await expect.poll(() => calls.filter((c) => c.name === 'platform.exit').length).toBe(1);
  expect(calls.filter((c) => c.name === 'ui.backHandled').map((c) => c.body.id)).toEqual([41, 42]);
});

test('update event offers "새 화면으로 다시 열기"', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light' });
  const calls = await recordShellCalls(page);
  await openApp(page, '/decks');
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
  await emitHostEvent(request, 'update', {
    available: true,
    kind: 'ota',
    ui: { version: '1.0.1', source: 'builtin', downloaded: '1.0.7', reloadNeeded: true },
  });
  const banner = page.getByTestId('update-banner');
  await expect(banner).toContainText('새 화면이 준비되었습니다 (1.0.7)');
  await shot(page, `update-banner-${info.project.name}`);
  await page.getByTestId('update-reload').click();
  await expect.poll(() => calls.filter((c) => c.name === 'update.apply').map((c) => c.body)).toEqual([{ kind: 'ota' }]);
});

test('open-file starts the import flow', async ({ page, request }, info) => {
  await openApp(page, '/decks');
  // A file the shell already put on the host (like an upload).
  const up = await (
    await request.post(`/api/host/upload?name=${encodeURIComponent('열기.colpkg')}`, {
      headers: { 'X-Amgi-Token': new URL(process.env.AMGI_HOST_URL!).searchParams.get('t')! },
      data: fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json')),
    })
  ).json();
  await emitHostEvent(request, 'open-file', { path: up.path, name: '열기.colpkg' });
  await expect(page.getByTestId('colpkg-message')).toHaveText(`'열기.colpkg' 파일로 이 기기의 컬렉션 전체를 바꿉니다.`);
  await shot(page, `open-file-confirm-${info.project.name}`);
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
});
