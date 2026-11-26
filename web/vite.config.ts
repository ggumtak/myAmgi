import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const basePath =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.VITE_BASE_PATH || './';

function emitUiVersionJson(): Plugin {
  let outDir = 'dist';
  return {
    name: 'emit-ui-version-json',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    async closeBundle() {
      const nodeImport = (specifier: string) => import(/* @vite-ignore */ specifier);
      const { mkdirSync, writeFileSync } = (await nodeImport('node:fs')) as {
        mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
        writeFileSync: (p: string, data: string, encoding: string) => void;
      };
      const { resolve, join } = (await nodeImport('node:path')) as {
        resolve: (...parts: string[]) => string;
        join: (...parts: string[]) => string;
      };
      const buildNumber =
        (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
          ?.BUILD_NUMBER || '1';
      const targetDir = resolve(outDir);
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(
        join(targetDir, 'ui-version.json'),
        JSON.stringify({ version: `2.0.${buildNumber}` }) + '\n',
        'utf-8'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), emitUiVersionJson()],
  base: basePath,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
