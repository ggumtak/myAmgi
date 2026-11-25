import { chromium, defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// E2E against the fake host (real Anki engine via Python) or, when
// AMGI_HOST_URL is set (e.g. "http://127.0.0.1:40001/?t=<token>"), against a
// running real host. Build the UI first (`npm run e2e` does).
const external = process.env.AMGI_HOST_URL;
const port = Number(process.env.AMGI_FAKE_PORT || 40123);
const token = 'e2e';
const startUrl = external ?? `http://127.0.0.1:${port}/?t=${token}`;
const origin = new URL(startUrl).origin;
process.env.AMGI_E2E_START = startUrl;

// Chromium is pre-installed on some machines outside Playwright's cache.
const fallbackChromium = '/opt/pw-browsers/chromium';
function launchOptions() {
  try {
    // Use Playwright's own browser; fall back only when it is missing.
    if (fs.existsSync(chromium.executablePath())) return {};
  } catch {
    // ignore
  }
  return fs.existsSync(fallbackChromium) ? { executablePath: fallbackChromium } : {};
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amgi-e2e-'));

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: origin,
    trace: 'off',
    launchOptions: launchOptions(),
    locale: 'ko-KR',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium' } },
    { name: 'tablet', use: { viewport: { width: 1280, height: 800 }, hasTouch: true, browserName: 'chromium' } },
  ],
  webServer: external
    ? undefined
    : {
        command: `node dev/fake-host/server.mjs --port ${port} --token ${token} --dir ${dir} --fresh`,
        url: `http://127.0.0.1:${port}/?t=${token}`,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
      },
});
