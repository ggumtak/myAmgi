#!/usr/bin/env node
// `npm run e2e [-- <playwright args>]`: runs the Playwright suite against the
// REAL desktop host (seeded collection, UI from web/dist), then stops the host.
// Set AMGI_HOST_URL="http://127.0.0.1:<port>/?t=<token>" to use a host you
// started yourself instead (it must run with --test-hooks for resets).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startHost, WEB } from './host.mjs';

let host = null;
const env = { ...process.env };
if (!env.AMGI_HOST_URL) {
  try {
    host = await startHost({ seed: true, log: env.AMGI_HOST_VERBOSE ? (s) => process.stderr.write(s) : undefined });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  env.AMGI_HOST_URL = host.url;
  console.log(`[e2e] real host ${host.url} (data ${host.dir})`);
}

const pw = spawn(path.join(WEB, 'node_modules', '.bin', 'playwright'), ['test', '--trace', 'off', ...process.argv.slice(2)], {
  cwd: WEB,
  stdio: 'inherit',
  env,
});
const finish = async (code) => {
  if (host) {
    if (code && env.AMGI_HOST_VERBOSE === undefined) {
      // Show the end of the host log when something failed.
      console.error('\n[e2e] host output (tail):\n' + host.output().split('\n').slice(-40).join('\n'));
    }
    await host.stop();
  }
  process.exit(code ?? 1);
};
pw.on('exit', (code) => void finish(code));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => pw.kill(sig));
