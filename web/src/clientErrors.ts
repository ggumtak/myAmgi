/* --------------------------------------------------------------------------
 * Client error log: render errors, uncaught errors and unhandled rejections are
 * kept (last few) so that "오류 로그 복사" can include them, and announced to the
 * toast layer via a tiny listener set.
 * ------------------------------------------------------------------------ */

const MAX_CLIENT_ERRORS = 20;
const clientErrors: string[] = [];
const listeners = new Set<(message: string) => void>();

export function describeError(err: unknown): { message: string; detail: string } {
  if (err instanceof Error) {
    return { message: err.message || err.name, detail: err.stack || `${err.name}: ${err.message}` };
  }
  const text = typeof err === 'string' ? err : (() => {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  })();
  return { message: text, detail: text };
}

export function recordClientError(kind: string, err: unknown, extra?: string): void {
  const { detail } = describeError(err);
  const entry = `${new Date().toISOString()} [${kind}] ${detail}${extra ? `\n${extra}` : ''}`;
  clientErrors.push(entry);
  if (clientErrors.length > MAX_CLIENT_ERRORS) clientErrors.shift();
  try {
    console.error(`[myAmgi ${kind}]`, err);
  } catch {
    // ignore
  }
}

export function getClientErrorLog(): string {
  return clientErrors.join('\n\n');
}

export function announceClientError(message: string) {
  for (const fn of Array.from(listeners)) {
    try {
      fn(message);
    } catch {
      // ignore
    }
  }
}

export function subscribeClientErrors(fn: (message: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
