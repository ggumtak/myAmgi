import { defineConfig } from '@playwright/test';
import path from 'node:path';

// The on-device test (device.spec.ts): Playwright attaches to the app's Android WebView over the
// Chrome DevTools Protocol; no browser is launched here. Run through e2e-device/run.sh, which installs
// the APKs, captures logcat and checks for crashes. AMGI_FLAVOR selects the steps (pro | comet).
//
// e2e/helpers.ts (shared with the desktop suite) reads AMGI_HOST_URL when it is imported; the device
// test never uses that host, so give it a placeholder.
process.env.AMGI_HOST_URL ??= 'http://127.0.0.1:1/?t=device';
const out = path.resolve(process.env.AMGI_DEVICE_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'out'));

export default defineConfig({
  testDir: '.',
  testMatch: 'device.spec.ts',
  outputDir: path.join(out, 'results'),
  // Steps share one device and run in file order; a failed step does not skip the later ones.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: path.join(out, `report-${process.env.AMGI_FLAVOR ?? 'pro'}.json`) }]],
  use: { trace: 'off' },
});
