// Minimal hash router: `#/path?query`. Patterns use `:param` segments and an
// optional trailing `*` that captures the rest of the path.
import { useSyncExternalStore } from 'react';

export interface Location {
  path: string;
  query: URLSearchParams;
  /** The raw hash without '#', e.g. "/browse?q=deck:x". */
  href: string;
}

export function parseHash(hash: string): Location {
  let h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('/')) h = '/' + h;
  const q = h.indexOf('?');
  const rawPath = q >= 0 ? h.slice(0, q) : h;
  const query = new URLSearchParams(q >= 0 ? h.slice(q + 1) : '');
  let path = rawPath.replace(/\/+$/, '') || '/';
  path = path.replace(/\/{2,}/g, '/');
  return { path, query, href: h };
}

export interface Match<R> {
  route: R;
  params: Record<string, string>;
}

interface Compiled<R> {
  route: R;
  regex: RegExp;
  keys: string[];
}

export function compile<R extends { pattern: string }>(routes: R[]): Compiled<R>[] {
  return routes.map((route) => {
    const keys: string[] = [];
    const segs = route.pattern
      .split('/')
      .filter(Boolean)
      .map((seg) => {
        if (seg === '*') {
          keys.push('*');
          return '(?:/(.*))?';
        }
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '/([^/]+)';
        }
        return '/' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
    const body = segs.join('') || '/';
    return { route, keys, regex: new RegExp(`^${body}/?$`) };
  });
}

export function matchPath<R extends { pattern: string }>(compiled: Compiled<R>[], path: string): Match<R> | null {
  for (const c of compiled) {
    const m = c.regex.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    c.keys.forEach((k, i) => {
      const v = m[i + 1];
      params[k] = v === undefined ? '' : safeDecode(v);
    });
    return { route: c.route, params };
  }
  return null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Build a hash path with query, skipping empty values. */
export function href(path: string, query?: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (opts.replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

let cachedHash: string | null = null;
let cachedLoc: Location | null = null;
export function currentLocation(): Location {
  const h = getHash();
  if (h !== cachedHash || !cachedLoc) {
    cachedHash = h;
    cachedLoc = parseHash(h || '#/decks');
  }
  return cachedLoc;
}

export function useLocation(): Location {
  useSyncExternalStore(subscribe, getHash, getHash);
  return currentLocation();
}
