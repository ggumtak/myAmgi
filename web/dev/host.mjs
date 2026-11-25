#!/usr/bin/env node
// Starts the REAL myAmgi desktop host (Kotlin + official Anki backend) for
// development and end-to-end tests. Used by `npm run dev` and `npm run e2e`.
//
// The host binary is `desktop/build/install/desktop/bin/desktop` (build it with
// `./gradlew :desktop:installDist`) or `$AMGI_HOST_BIN`.
//
// Library:  const h = await startHost({ seed: true, uiDir: 'web/dist' });
//           h.url  -> "http://127.0.0.1:<port>/?t=<token>"   h.stop()
// CLI:      node dev/host.mjs [--keep-dir] [--dir D] [--no-ui] [--verbose]
//           prints the start URL and runs until Ctrl+C.
//
// Every start uses a fresh temporary data dir (unless `dir` is given), a fixed
// token, `--seed`, `--no-open`, and `--test-hooks` (host functions `test.reset`
// and `test.emit`, see desktop/Main.kt). The process is always killed on exit.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(WEB, '..');
export const DEFAULT_TOKEN = 'e2etoken';
const READY = /myAmgi host listening: (http:\/\/\S+)/;

export function hostBinary() {
  const bin = process.env.AMGI_HOST_BIN || path.join(REPO, 'desktop', 'build', 'install', 'desktop', 'bin', process.platform === 'win32' ? 'desktop.bat' : 'desktop');
  if (!fs.existsSync(bin)) {
    const msg = [
      `myAmgi host not found: ${bin}`,
      'Build it first (from the repository root):',
      '    ./gradlew :desktop:installDist',
      'or point AMGI_HOST_BIN at an installed host, or AMGI_HOST_URL at a running one.',
    ].join('\n');
    const err = new Error(msg);
    err.code = 'AMGI_HOST_MISSING';
    throw err;
  }
  return bin;
}

/**
 * Starts the host and resolves once it prints its listening line.
 * @param {{dir?: string, uiDir?: string|null, token?: string, seed?: boolean, port?: number,
 *          verbose?: boolean, timeoutMs?: number, keepDir?: boolean, log?: (s: string) => void}} opts
 */
export async function startHost(opts = {}) {
  const bin = hostBinary();
  const token = opts.token ?? DEFAULT_TOKEN;
  const ownDir = !opts.dir;
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'amgi-host-'));
  const uiDir = opts.uiDir === undefined ? path.join(WEB, 'dist') : opts.uiDir;
  const args = ['--port', String(opts.port ?? 0), '--dir', dir, '--token', token, '--no-open', '--test-hooks'];
  if (opts.seed !== false) args.push('--seed');
  if (uiDir) {
    if (!fs.existsSync(uiDir)) throw new Error(`UI bundle not built: ${uiDir} (run \`npm run build\`)`);
    args.push('--ui-dir', uiDir);
  }
  if (opts.verbose) args.push('--verbose');
  const log = opts.log ?? (() => {});

  // Output goes to a file, not a pipe: the native backend redirects fds 1/2 when it loads, and the
  // host can only keep its console when that is a file or a tty (Node's stdio pipes are sockets).
  const logFile = path.join(dir, 'host-output.log');
  fs.mkdirSync(dir, { recursive: true });
  const fd = fs.openSync(logFile, 'w');
  const child = spawn(bin, args, {
    cwd: REPO,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, JAVA_OPTS: process.env.JAVA_OPTS ?? '-Xmx768m' },
    // Own process group so that stop() also reaches anything the launcher script started.
    detached: process.platform !== 'win32',
  });
  fs.closeSync(fd);
  let output = '';
  let read = 0;
  const poll = () => {
    try {
      const buf = fs.readFileSync(logFile);
      if (buf.length > read) {
        const s = buf.subarray(read).toString();
        read = buf.length;
        output += s;
        log(s);
      }
    } catch {
      // file not there yet
    }
  };
  const tail = setInterval(poll, 200);
  const killTree = (signal = 'SIGTERM') => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      // already gone
    }
  };
  // Never leave a host behind, whatever way this process ends.
  const onExit = () => killTree('SIGKILL');
  process.on('exit', onExit);

  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(check);
      killTree('SIGKILL');
      reject(new Error(`myAmgi host did not start within ${(opts.timeoutMs ?? 120_000) / 1000}s.\n${output.slice(-4000)}`));
    }, opts.timeoutMs ?? 120_000);
    const check = setInterval(() => {
      poll();
      const m = READY.exec(output);
      if (m) {
        clearTimeout(timer);
        clearInterval(check);
        resolve(m[1]);
      }
    }, 100);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      clearInterval(check);
      poll();
      reject(new Error(`myAmgi host exited (${code ?? signal}) before it was ready.\n${output.slice(-4000)}`));
    });
  });

  const stopped = new Promise((resolve) => child.on('exit', resolve));
  return {
    url,
    origin: new URL(url).origin,
    port: Number(new URL(url).port),
    token,
    dir,
    process: child,
    output: () => {
      poll();
      return output;
    },
    async stop() {
      clearInterval(tail);
      killTree('SIGTERM');
      const t = setTimeout(() => killTree('SIGKILL'), 5000);
      await stopped;
      clearTimeout(t);
      process.off('exit', onExit);
      if (ownDir && !opts.keepDir) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const has = (f) => process.argv.includes(f);
  const val = (f) => {
    const i = process.argv.indexOf(f);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  try {
    const h = await startHost({
      dir: val('--dir'),
      keepDir: has('--keep-dir'),
      uiDir: has('--no-ui') ? null : undefined,
      verbose: has('--verbose'),
      log: has('--verbose') ? (s) => process.stdout.write(s) : undefined,
    });
    console.log(`myAmgi host: ${h.url}\ndata dir:    ${h.dir}`);
    const stop = async () => {
      await h.stop();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
