import { chromium, defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// End-to-end tests against the REAL desktop host (Kotlin + official Anki
// backend) with a seeded collection. `npm run e2e` builds the UI, starts the
// host (dev/e2e.mjs) and sets AMGI_HOST_URL; to reuse a host you started
// yourself, set AMGI_HOST_URL="http://127.0.0.1:<port>/?t=<token>" and run
// `npx playwright test`. See e2e/helpers.ts.
const startUrl = process.env.AMGI_HOST_URL;
if (!startUrl) {
  throw new Error(
    'AMGI_HOST_URL is not set. Run `npm run e2e` (starts the real host for you), or start one with ' +
      '`node dev/host.mjs` and pass its URL: AMGI_HOST_URL="http://127.0.0.1:<port>/?t=<token>" npx playwright test',
  );
}
const origin = new URL(startUrl).origin;

// Chromium is pre-installed on some machines outside Playwright's cache.
const fallbackChromium = '/opt/pw-browsers/chromium';
function launchOptions() {
  try {
    if (fs.existsSync(chromium.executablePath())) return {};
  } catch {
    // ignore
  }
  return fs.existsSync(fallbackChromium) ? { executablePath: fallbackChromium } : {};
}

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  // One engine, one collection: tests run serially and reset the collection
  // where they need a known state (helpers.resetHost).
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: origin,
    trace: 'off',
    launchOptions: launchOptions(),
    locale: 'ko-KR',
    acceptDownloads: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium' } },
    { name: 'tablet', use: { viewport: { width: 1280, height: 800 }, hasTouch: true, browserName: 'chromium' } },
  ],
});
