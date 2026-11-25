#!/usr/bin/env node
// `npm run dev`: Vite dev server with /_anki, /api, /media and the official
// pages proxied to a host.
//  - AMGI_HOST_URL unset: starts the fake host (real engine via Python) on
//    127.0.0.1:40001 with token "dev", collection kept in $TMPDIR/amgi-dev.
//  - AMGI_HOST_URL set (e.g. the Kotlin desktop host): proxies there; set
//    AMGI_HOST_TOKEN to its token.
// Ctrl+C stops everything this script started.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
const stop = () => {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
};
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});

const env = { ...process.env };
if (!env.AMGI_HOST_URL) {
  const port = env.AMGI_FAKE_PORT || '40001';
  env.AMGI_HOST_URL = `http://127.0.0.1:${port}`;
  env.AMGI_HOST_TOKEN = 'dev';
  const host = spawn(process.execPath, ['dev/fake-host/server.mjs', '--port', port, '--token', 'dev', '--dir', path.join(os.tmpdir(), 'amgi-dev'), '--ui', 'none'], {
    cwd: WEB,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  children.push(host);
  await new Promise((resolve, reject) => {
    host.stdout.on('data', (d) => {
      process.stdout.write(d);
      if (String(d).includes('AMGI_FAKE_HOST_READY')) resolve();
    });
    host.on('exit', (code) => reject(new Error(`fake host exited (${code})`)));
  });
}
const vite = spawn(path.join(WEB, 'node_modules', '.bin', 'vite'), process.argv.slice(2), { cwd: WEB, stdio: 'inherit', env });
children.push(vite);
vite.on('exit', (code) => {
  stop();
  process.exit(code ?? 0);
});
