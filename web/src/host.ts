// Typed client for the host functions (`POST /api/host/<name>`, JSON in/out),
// uploads/downloads and the server-sent events stream (`GET /api/host/events`).
// See docs/ARCHITECTURE.md "Host functions".

import { useSyncExternalStore } from 'react';

export interface HostInfo {
  appVersion: string;
  build: number | string;
  flavor: 'pro' | 'comet' | string;
  platform: 'android' | 'desktop';
  eink: boolean;
  device: string;
  uiVersion: string;
  backendVersion: string;
}

export interface CollectionStatus {
  open: boolean;
  path?: string;
  size?: number;
  lastError?: string | null;
}

/**
 * Shape assumed for `sync.status` (the contract lists the call but not its fields;
 * see the report's recommended doc change).
 */
export interface SyncStatus {
  loggedIn: boolean;
  user?: string | null;
  /** What the engine says is needed: nothing, a normal sync, or a full sync. */
  required: 'none' | 'normal' | 'full';
  syncing: boolean;
  lastSync?: number | null;
  error?: string | null;
}

export interface SyncRunResult {
  needsFullSync?: boolean;
}

export interface BackupEntry {
  name: string;
  size?: number;
  time?: number;
}

export interface ImportClassification {
  kind: 'apkg' | 'colpkg' | 'csv' | string;
  /** UI route (hash path, without '#') to continue the import on. */
  route: string;
}

export interface ExportResult {
  path: string;
  name: string;
}

export interface UpdateStatus {
  available: boolean;
  current?: string;
  latest?: string;
  kind?: 'apk' | 'ota';
}

export interface HostLog {
  log: string;
  errors?: string[];
}

export class HostError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly fn: string;
  constructor(fn: string, status: number, message: string, detail?: string) {
    super(message);
    this.name = 'HostError';
    this.fn = fn;
    this.status = status;
    this.detail = detail;
  }
}

let baseUrl = '';
export function configureHost(opts: { baseUrl?: string }): void {
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl.replace(/\/$/, '');
}

export async function hostCall<T = unknown>(name: string, body: unknown = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/host/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    throw new HostError(name, 0, '앱 엔진에 연결할 수 없습니다', String(err));
  }
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const e = (json ?? {}) as { error?: string; detail?: string };
    throw new HostError(name, res.status, e.error || `호스트 오류 (${res.status})`, e.detail ?? text);
  }
  return json as T;
}

export const host = {
  info: () => hostCall<HostInfo>('info'),
  prefs: {
    get: () => hostCall<Record<string, unknown>>('prefs.get'),
    set: (patch: Record<string, unknown>) => hostCall<Record<string, unknown>>('prefs.set', patch),
  },
  collectionStatus: () => hostCall<CollectionStatus>('collection.status'),
  sync: {
    status: () => hostCall<SyncStatus>('sync.status'),
    login: (user: string, password: string, endpoint?: string) =>
      hostCall<Record<string, never>>('sync.login', { user, password, endpoint }),
    logout: () => hostCall('sync.logout'),
    run: (mode: 'normal' | 'upload' | 'download' = 'normal') => hostCall<SyncRunResult>('sync.run', { mode }),
    abort: () => hostCall('sync.abort'),
  },
  backup: {
    create: () => hostCall<BackupEntry>('backup.create'),
    list: () => hostCall<{ backups: BackupEntry[] }>('backup.list'),
    restore: (name: string) => hostCall('backup.restore', { name }),
  },
  importFile: (path: string, name: string) => hostCall<ImportClassification>('import.file', { path, name }),
  exportPackage: (opts: { deckId?: number; withScheduling: boolean; withMedia: boolean; legacy: boolean }) =>
    hostCall<ExportResult>('export.package', opts),
  exportCollection: (withMedia: boolean) => hostCall<ExportResult>('export.collection', { withMedia }),
  platform: {
    share: (path: string, name: string) => hostCall('platform.share', { path, name }),
    openExternal: (url: string) => hostCall('platform.openExternal', { url }),
    tts: (text: string, lang: string, rate = 1) => hostCall('platform.tts', { text, lang, rate }),
    ttsStop: () => hostCall('platform.ttsStop'),
    clipboardWrite: (text: string) => hostCall('platform.clipboardWrite', { text }),
    exit: () => hostCall('platform.exit'),
  },
  hanjaLookup: (text: string, sentence?: string) => hostCall('hanja.lookup', { text, sentence }),
  update: {
    status: () => hostCall<UpdateStatus>('update.status'),
    check: () => hostCall<UpdateStatus>('update.check'),
    apply: () => hostCall('update.apply'),
  },
  logGet: () => hostCall<HostLog>('log.get'),

  /** Streams `file` to the host; returns the temp path for `import.file`. */
  async upload(file: Blob, name: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/host/upload?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) {
      let msg = `업로드 실패 (${res.status})`;
      try {
        msg = ((await res.json()) as { error?: string }).error || msg;
      } catch {
        // keep default
      }
      throw new HostError('upload', res.status, msg);
    }
    return ((await res.json()) as { path: string }).path;
  },

  downloadUrl(path: string, name: string): string {
    return `${baseUrl}/api/host/download?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
  },
};

// ---------------------------------------------------------------------------
// Events (SSE)
// ---------------------------------------------------------------------------

export interface ProgressEvent {
  kind: 'sync' | 'media-sync' | 'import' | 'export' | string;
  label?: string;
  value?: number;
  max?: number;
  done?: boolean;
}

export interface HostEvents {
  progress: ProgressEvent;
  back: Record<string, never>;
  'open-file': { path: string; name: string };
  'sync-state': Partial<SyncStatus>;
}

type Handler<K extends keyof HostEvents> = (data: HostEvents[K]) => void;
const handlers: { [K in keyof HostEvents]?: Set<Handler<K>> } = {};
let source: EventSource | null = null;

function ensureSource(): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(`${baseUrl}/api/host/events`, { withCredentials: true });
  for (const type of ['progress', 'back', 'open-file', 'sync-state'] as const) {
    source.addEventListener(type, (ev) => {
      let data: unknown = {};
      try {
        data = JSON.parse((ev as MessageEvent<string>).data || '{}');
      } catch {
        // ignore malformed event
      }
      const set = handlers[type] as Set<(d: unknown) => void> | undefined;
      set?.forEach((h) => h(data));
    });
  }
  // EventSource reconnects by itself after errors.
}

/** Subscribe to a host event; returns an unsubscribe function. */
export function onHostEvent<K extends keyof HostEvents>(type: K, handler: Handler<K>): () => void {
  ensureSource();
  const set = (handlers[type] ??= new Set() as never) as Set<Handler<K>>;
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

// ---------------------------------------------------------------------------
// UI preferences, persisted by the host (not localStorage: the origin changes
// between launches because the port does).
// ---------------------------------------------------------------------------

export type ThemePref = 'auto' | 'light' | 'dark' | 'eink';

export interface UiPrefs {
  theme?: ThemePref;
  /** Reviewer: 모름 / 암기 완료 instead of four buttons. */
  twoButtons?: boolean;
  /** Reviewer: tap on the card shows the answer. */
  tapToShowAnswer?: boolean;
  /** Reviewer: volume keys / Bluetooth remotes answer cards. */
  volumeKeys?: boolean;
  /** Card text scale in percent. */
  cardFontScale?: number;
  [key: string]: unknown;
}

let prefsState: UiPrefs = {};
const prefListeners = new Set<() => void>();
const emitPrefs = () => prefListeners.forEach((l) => l());

export const prefsStore = {
  /** Loads prefs from the host. Call once at start-up. */
  async load(): Promise<UiPrefs> {
    prefsState = (await host.prefs.get()) as UiPrefs;
    emitPrefs();
    return prefsState;
  },
  get(): UiPrefs {
    return prefsState;
  },
  /** Optimistic local update, then persisted on the host. Reverts on failure. */
  async set(patch: Partial<UiPrefs>): Promise<void> {
    const before = prefsState;
    prefsState = { ...prefsState, ...patch };
    emitPrefs();
    try {
      await host.prefs.set(patch);
    } catch (err) {
      prefsState = before;
      emitPrefs();
      throw err;
    }
  },
  /** Test hook. */
  _reset(value: UiPrefs = {}): void {
    prefsState = value;
    emitPrefs();
  },
  subscribe(listener: () => void): () => void {
    prefListeners.add(listener);
    return () => prefListeners.delete(listener);
  },
};

/** React hook: current UI prefs and a setter that persists on the host. */
export function usePrefs(): [UiPrefs, (patch: Partial<UiPrefs>) => Promise<void>] {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.get, prefsStore.get);
  return [prefs, prefsStore.set];
}

let infoCache: HostInfo | null = null;
export const hostInfoStore = {
  async load(): Promise<HostInfo> {
    infoCache = await host.info();
    return infoCache;
  },
  get: (): HostInfo | null => infoCache,
  _set(info: HostInfo | null) {
    infoCache = info;
  },
};
