#!/usr/bin/env node
// `npm run dev`: Vite dev server (hot reload) in front of the REAL desktop host.
// /_anki, /_app, /api, /media and the official pages are proxied to the host
// (see vite.config.ts), which runs on a free port with a fresh seeded
// collection in a temp dir.
//  - AMGI_HOST_URL set ("http://127.0.0.1:<port>/?t=<token>"): use that host instead.
//  - AMGI_DEV_DIR set: keep the collection in that directory between runs.
// Ctrl+C stops everything this script started.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startHost, WEB } from './host.mjs';

const env = { ...process.env };
let host = null;
if (!env.AMGI_HOST_URL) {
  try {
    host = await startHost({
      dir: env.AMGI_DEV_DIR,
      // The card frame (/media/__amgi_frame.html) comes from the UI bundle; in dev
      // the app itself is served by Vite, so web/public is enough.
      uiDir: fs.existsSync(path.join(WEB, 'dist', 'index.html')) ? path.join(WEB, 'dist') : path.join(WEB, 'public'),
      token: 'devtoken',
      log: env.AMGI_HOST_VERBOSE ? (s) => process.stderr.write(s) : undefined,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  env.AMGI_HOST_URL = host.url;
  console.log(`[dev] real host ${host.url} (data ${host.dir})`);
}
env.AMGI_HOST_TOKEN ??= new URL(env.AMGI_HOST_URL).searchParams.get('t') ?? 'dev';

const vite = spawn(path.join(WEB, 'node_modules', '.bin', 'vite'), process.argv.slice(2), { cwd: WEB, stdio: 'inherit', env });
const stop = async (code) => {
  if (vite.exitCode === null) vite.kill('SIGTERM');
  if (host) await host.stop();
  process.exit(code ?? 0);
};
vite.on('exit', (code) => void stop(code));
process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));
