import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The UI is served by the host under /ui/ with relative asset URLs.
// `npm run dev` (dev/dev.mjs) starts the real host and proxies engine/host/media
// requests to it:
//   AMGI_HOST_URL   "http://127.0.0.1:<port>/?t=<token>" (set by dev/dev.mjs)
//   AMGI_HOST_TOKEN the token, sent as X-Amgi-Token (default: the URL's `t`)
// `vite build` writes ui-version.json from AMGI_UI_VERSION (CI: 1.0.<run>).
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const rawHost = env.AMGI_HOST_URL || 'http://127.0.0.1:40001/?t=dev';
const hostUrl = rawHost.replace(/\/?\?.*$/, '').replace(/\/$/, '');
const token = env.AMGI_HOST_TOKEN || new URL(rawHost).searchParams.get('t') || 'dev';

const proxied = ['/_anki', '/_app', '/api', '/media', '/deck-options', '/graphs', '/card-info', '/congrats', '/change-notetype', '/image-occlusion', '/import-anki-package', '/import-csv', '/import-page'];

/** Dotted numbers only: the host compares bundle versions numerically (UiBundle.kt). */
export function uiVersion(value: string | undefined): string {
  const v = (value ?? '').trim() || '0.0.0';
  if (!/^\d+(\.\d+)*$/.test(v)) throw new Error(`AMGI_UI_VERSION must be dotted numbers (e.g. 1.0.42), got "${v}"`);
  return v;
}

function uiVersionFile(): Plugin {
  return {
    name: 'amgi-ui-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'ui-version.json', source: JSON.stringify({ version: uiVersion(env.AMGI_UI_VERSION) }) + '\n' });
    },
  };
}

export default defineConfig({
  plugins: [react(), uiVersionFile()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: Object.fromEntries(
      proxied.map((p) => [
        p,
        {
          target: hostUrl,
          changeOrigin: true,
          headers: { 'X-Amgi-Token': token },
        },
      ]),
    ),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
