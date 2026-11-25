import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The UI is served by the host under /ui/ with relative asset URLs.
// `npm run dev` proxies engine/host/media requests to a host:
//   AMGI_HOST_URL   (default http://127.0.0.1:40001, the fake host)
//   AMGI_HOST_TOKEN (default "dev"), sent as X-Amgi-Token.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const hostUrl = (env.AMGI_HOST_URL || 'http://127.0.0.1:40001').replace(/\/\?.*$/, '').replace(/\/$/, '');
const token = env.AMGI_HOST_TOKEN || 'dev';

const proxied = ['/_anki', '/_app', '/api', '/media', '/deck-options', '/graphs', '/card-info', '/congrats', '/change-notetype', '/image-occlusion', '/import-anki-package', '/import-csv', '/import-page'];

export default defineConfig({
  plugins: [react()],
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
          // SSE must not be buffered.
          ...(p === '/api' ? { ws: false } : {}),
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
