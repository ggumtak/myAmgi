// 설정 › 동기화 and the app-bar sync button. AnkiWeb cannot be reached from tests, so the
// host's sync.* functions and the event stream are intercepted with a stateful fake that
// follows the real shapes (core/.../SyncService.kt). Media-sync pref goes to the real host.
import { expect, test, type Page } from '@playwright/test';
import { deferred, fakeEventStream, getPrefs, isPhone, openApp, resetHost, setPrefs, shot, shotAllThemes } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetHost(request);
});

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light', 'sync.media': null });
});

interface Status {
  loggedIn: boolean;
  user: string | null;
  endpoint: string | null;
  running: boolean;
  phase: string;
  needsFullSync: boolean;
  lastSync: number | null;
  lastError: string | null;
}

async function fakeSync(page: Page) {
  const status: Status = { loggedIn: false, user: null, endpoint: null, running: false, phase: 'idle', needsFullSync: false, lastSync: null, lastError: null };
  const runs: string[] = [];
  const logins: { user: string; endpoint: string | null }[] = [];
  /** The next `sync.run` waits for this test-supplied answer. */
  let answer = deferred<{ status: number; body: unknown }>();
  let runStarted = deferred();
  const json = (body: unknown, code = 200) => ({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/host/sync.*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    const args = JSON.parse(route.request().postData() || '{}');
    switch (name) {
      case 'sync.status':
        return route.fulfill(json(status));
      case 'sync.check':
        return route.fulfill(json({ loggedIn: status.loggedIn, required: status.loggedIn && !status.lastSync ? 'normal' : 'none' }));
      case 'sync.login':
        if (args.password !== 'pw') return route.fulfill(json({ error: 'AnkiWeb 아이디 또는 비밀번호가 맞지 않습니다.', detail: 'auth' }, 401));
        logins.push({ user: args.user, endpoint: args.endpoint });
        Object.assign(status, { loggedIn: true, user: args.user, endpoint: args.endpoint, lastError: null });
        return route.fulfill(json(status));
      case 'sync.logout':
        Object.assign(status, { loggedIn: false });
        return route.fulfill(json(status));
      case 'sync.run': {
        runs.push(args.mode);
        Object.assign(status, { running: true, phase: 'collection', lastError: null });
        runStarted.resolve();
        const a = await answer.promise;
        answer = deferred();
        runStarted = deferred();
        Object.assign(status, { running: false, phase: 'idle' });
        return route.fulfill(json(a.body, a.status));
      }
      default:
        return route.fulfill(json({ error: `unexpected ${name}` }, 500));
    }
  });
  return { status, runs, logins, answer: (a: { status: number; body: unknown }) => answer.resolve(a), started: () => runStarted.promise };
}

test('login form, wrong password, custom server, login', async ({ page, request }, info) => {
  await fakeEventStream(page);
  const fake = await fakeSync(page);
  await openApp(page, '/settings/sync');
  await expect(page.getByTestId('sync-login')).toBeVisible();
  await shotAllThemes(page, request, info, 'sync-login');

  await page.locator('#sync-user').fill('me@example.com');
  await page.locator('#sync-password').fill('wrong');
  await page.getByTestId('sync-login-submit').click();
  await expect(page.getByTestId('sync-login-error')).toHaveText('AnkiWeb 아이디 또는 비밀번호가 맞지 않습니다.');
  await shot(page, `sync-login-error-${info.project.name}`);

  await page.getByTestId('sync-custom-server').check();
  await page.locator('#sync-endpoint').fill('https://sync.example.com/');
  await page.locator('#sync-password').fill('pw');
  await page.getByTestId('sync-login-submit').click();
  await expect(page.getByTestId('sync-user')).toHaveText('me@example.com');
  expect(fake.logins).toEqual([{ user: 'me@example.com', endpoint: 'https://sync.example.com/' }]);
  await expect(page.getByTestId('sync-last')).toHaveText('없음');
});

test('sync now: progress from events, full-sync direction dialog, download, errors', async ({ page, request }, info) => {
  const events = await fakeEventStream(page);
  const fake = await fakeSync(page);
  Object.assign(fake.status, { loggedIn: true, user: 'me@example.com' });
  await openApp(page, '/settings/sync');
  await expect(page.getByTestId('sync-user')).toHaveText('me@example.com');

  // Running: phase and progress come from host events.
  await page.getByTestId('sync-now').click();
  await fake.started();
  events.emit('sync-state', { ...fake.status, running: true, phase: 'collection' });
  events.emit('progress', { op: 'sync', phase: 'running', kind: 'normalSync', stage: 'Sending', added: '3', removed: '1' });
  await expect(page.getByTestId('sync-status')).toContainText('컬렉션 동기화 중 (보냄 3 · 받음 1)');
  await expect(page.getByTestId('sync-abort')).toBeVisible();
  await shot(page, `sync-running-${info.project.name}`);

  // The host answers "full sync required": the owner picks a direction.
  fake.answer({ status: 200, body: { ok: false, needsFullSync: true } });
  const dialog = page.getByTestId('full-sync-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('이 기기의 내용을 서버에 올리기');
  await expect(dialog).toContainText('AnkiWeb에 있는 컬렉션을 이 기기의 내용으로 덮어씁니다');
  await expect(dialog).toContainText('서버의 내용을 이 기기로 내려받기');
  await expect(dialog).toContainText('이 기기의 컬렉션을 AnkiWeb의 내용으로 덮어씁니다');
  await shot(page, `sync-full-dialog-${info.project.name}`);

  await page.getByTestId('full-sync-download').click();
  await fake.started();
  events.emit('sync-state', { ...fake.status, running: true, phase: 'download' });
  events.emit('progress', { op: 'sync', phase: 'running', kind: 'fullSync', transferred: 512, total: 1024 });
  await expect(page.getByTestId('sync-status')).toContainText('서버에서 내려받는 중 50%');
  const now = Date.now();
  fake.status.lastSync = now;
  fake.answer({ status: 200, body: { ok: true, needsFullSync: false, serverMessage: '', lastSync: now } });
  await expect(page.locator('.toast').filter({ hasText: '동기화 완료' })).toBeVisible();
  await expect(page.getByTestId('sync-last')).not.toHaveText('없음');
  expect(fake.runs).toEqual(['normal', 'download']);

  // The full-sync dialog in every theme (opened from 전체 올리기/내려받기).
  await shotAllThemes(page, request, info, 'sync-full-manual', async () => {
    await page.getByTestId('sync-full').click();
    await expect(page.getByTestId('full-sync-dialog')).toBeVisible();
  });
  await shotAllThemes(page, request, info, 'sync-account');

  // Media sync toggle is a real host pref.
  await page.getByTestId('pref-sync-media').click();
  await expect.poll(async () => (await getPrefs(request))['sync.media']).toBe(false);

  // App-bar button: same flow; a network error shows a Korean toast and the error badge.
  await page.goto('/ui/#/decks');
  const button = page.getByTestId('sync-button');
  await expect(button).toHaveAttribute('data-state', 'idle');
  await button.click();
  await fake.started();
  fake.status.lastError = '동기화하지 못했습니다: 네트워크에 연결할 수 없습니다.';
  fake.answer({ status: 502, body: { error: fake.status.lastError, detail: 'network' } });
  await expect(page.locator('.toast').filter({ hasText: '동기화 실패: 동기화하지 못했습니다: 네트워크에 연결할 수 없습니다.' })).toBeVisible();
  await expect(button).toHaveAttribute('data-state', 'error');
  await shot(page, `sync-button-error-${info.project.name}`);
  expect(fake.runs).toEqual(['normal', 'download', 'normal']);

  // Logout
  await page.goto('/ui/#/settings/sync');
  await page.getByTestId('sync-logout').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByTestId('sync-login')).toBeVisible();
  if (isPhone(info)) {
    await page.goto('/ui/#/decks');
    await expect(page.getByTestId('sync-button')).toHaveAttribute('data-state', 'logged-out');
    await page.getByTestId('sync-button').click();
    await expect(page.locator('.route')).toHaveAttribute('data-route', 'settings-sync');
  }
});
