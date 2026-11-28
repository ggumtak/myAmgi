import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const basePath =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.VITE_BASE_PATH || './';

/**
 * Writes `ui-version.json` = {"version": "2.0.<BUILD_NUMBER>", "minBuild": <n>} into the bundle root.
 *
 * `minBuild` comes from `web/min-native-build.json` (`{"minBuild": N}`): the smallest native build
 * number (APK versionCode = the GitHub Actions run number of the main build) this UI bundle works with.
 * Shells older than N ignore the OTA bundle and ask for an APK update instead.
 * Raise N whenever the UI starts to depend on a new native capability (a new `AndroidShell` method,
 * host function or route implemented in `app/` or `core/`): set it to the run number of the main
 * build that ships that native change (look up the newest run number of "Build myAmgi APKs" in
 * GitHub Actions and add 1 if the change is not merged yet). Leaving it too low lets old APKs load a
 * UI they cannot run; setting it too high only delays the UI until the APK is installed.
 */
function emitUiVersionJson(): Plugin {
  let outDir = 'dist';
  let root = '.';
  return {
    name: 'emit-ui-version-json',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
      root = config.root || '.';
    },
    async closeBundle() {
      const nodeImport = (specifier: string) => import(/* @vite-ignore */ specifier);
      const { mkdirSync, readFileSync, writeFileSync } = (await nodeImport('node:fs')) as {
        mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
        readFileSync: (p: string, encoding: string) => string;
        writeFileSync: (p: string, data: string, encoding: string) => void;
      };
      const { resolve, join } = (await nodeImport('node:path')) as {
        resolve: (...parts: string[]) => string;
        join: (...parts: string[]) => string;
      };
      const buildNumber =
        (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
          ?.BUILD_NUMBER || '1';
      const minBuildFile = resolve(root, 'min-native-build.json');
      const minBuild = (JSON.parse(readFileSync(minBuildFile, 'utf-8')) as { minBuild?: unknown })
        .minBuild;
      if (typeof minBuild !== 'number' || !Number.isInteger(minBuild) || minBuild < 0) {
        throw new Error(`${minBuildFile}: "minBuild" must be a non-negative integer`);
      }
      const targetDir = resolve(root, outDir);
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(
        join(targetDir, 'ui-version.json'),
        JSON.stringify({ version: `2.0.${buildNumber}`, minBuild }) + '\n',
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
