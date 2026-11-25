// Typed client for the host functions (`POST /api/host/<name>`, JSON in/out),
// uploads/downloads and the server-sent events stream (`GET /api/host/events`).
//
// The Kotlin host is the source of truth for every shape here:
// core/src/main/kotlin/com/ggumtak/myamgi/host/{HostApi,HostServer,SyncService,BackupService,
// ProgressPump,EventBus}.kt (see also docs/ARCHITECTURE.md "Host functions").

import { useSyncExternalStore } from 'react';

/** `info` (HostApi.info + Platform.info). */
export interface HostInfo {
  appVersion: string;
  build: number;
  /** `pro` | `comet` on Android, `desktop` on PC. */
  flavor: string;
  platform: 'android' | 'desktop';
  eink: boolean;
  device: string;
  /** `ui-version.json` of the bundle being served; null when the bundle has none. */
  uiVersion: string | null;
  /** e.g. "Anki 26.09.4 (anki-backend 0.1.77)". */
  backendVersion: string;
}

/** `collection.status`. */
export interface CollectionStatus {
  open: boolean;
  path: string | null;
  /** Bytes (collection + WAL). */
  size: number;
  mediaDir: string | null;
  lastError: string | null;
}

export type SyncPhase = 'idle' | 'collection' | 'backup' | 'upload' | 'download' | 'media';

/** `sync.status`, also the payload of the `sync-state` event (SyncService.status). */
export interface SyncStatus {
  loggedIn: boolean;
  user: string | null;
  /** Custom sync server, or null for AnkiWeb. */
  endpoint: string | null;
  running: boolean;
  phase: SyncPhase | string;
  /** The last normal sync answered "full sync required"; the UI must ask for a direction. */
  needsFullSync: boolean;
  /** Epoch milliseconds of the last successful sync. */
  lastSync: number | null;
  lastError: string | null;
}

export type SyncMode = 'normal' | 'upload' | 'download';

/** `sync.run`. `ok: false, needsFullSync: true` = ask the owner for a direction, then run again. */
export interface SyncRunResult {
  ok: boolean;
  needsFullSync: boolean;
  serverMessage?: string;
  lastSync?: number;
}

/** `sync.check`: what a sync would do now (may contact AnkiWeb). */
export interface SyncCheck {
  loggedIn: boolean;
  required: 'none' | 'normal' | 'full';
}

/** One `.colpkg` in `dataDir/backups` (BackupService.Entry). `time` = epoch ms. */
export interface BackupEntry {
  name: string;
  size: number;
  time: number;
}

export interface BackupList {
  /** Pref `backup.keep` (default 20). */
  keep: number;
  /** Newest first. */
  backups: BackupEntry[];
}

/** `/api/host/upload` answer. `path` is a host temp path for `import.file`. */
export interface UploadResult {
  path: string;
  name: string;
  size: number;
}

/** `import.file`. */
export interface ImportResult {
  kind: 'apkg' | 'colpkg' | 'csv';
  path: string;
  /** Official page to continue with (`/import-anki-package/<enc>` or `/import-csv/<enc>`), null for colpkg. */
  route: string | null;
  /** colpkg without `replace: true`: confirm first. */
  needsConfirm?: boolean;
  /** colpkg with `replace: true`: the collection was replaced. */
  imported?: boolean;
  safetyBackup?: string;
}

/** `export.package` / `export.collection`. `name` is the display file name for downloads. */
export interface ExportResult {
  path: string;
  name: string;
  size: number;
  /** export.package only. */
  notes?: number;
}

/**
 * `update.status` / `update.check` / `update.apply`. The shape is platform defined; the desktop
 * host answers `update.status` with `{supported: false, currentVersion}` and the others with 501.
 */
export interface UpdateStatus {
  supported?: boolean;
  available?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  kind?: 'apk' | 'ota' | string;
  [key: string]: unknown;
}

/** `log.get`. */
export interface HostLogSnapshot {
  lines: string[];
  errors: string[];
  /** `lines` joined with newlines. */
  text: string;
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
  /** HostError.unsupported (501): "이 기기에서는 지원하지 않습니다". */
  get unsupported(): boolean {
    return this.status === 501;
  }
}

let baseUrl = '';
export function configureHost(opts: { baseUrl?: string }): void {
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl.replace(/\/$/, '');
}

function parseError(fn: string, status: number, text: string): HostError {
  let json: { error?: string; detail?: string } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body
  }
  return new HostError(fn, status, json.error || `호스트 오류 (${status})`, json.detail ?? text);
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
  if (!res.ok) throw parseError(name, res.status, text);
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HostError(name, res.status, '호스트의 응답을 읽지 못했습니다', text);
  }
}

type Ok = { ok: true };

export const host = {
  info: () => hostCall<HostInfo>('info'),
  prefs: {
    get: () => hostCall<Record<string, unknown>>('prefs.get'),
    /** Merged on the host; a `null` value deletes the key. Returns all prefs. */
    set: (patch: Record<string, unknown>) => hostCall<Record<string, unknown>>('prefs.set', patch),
  },
  collectionStatus: () => hostCall<CollectionStatus>('collection.status'),
  sync: {
    status: () => hostCall<SyncStatus>('sync.status'),
    /** 401 wrong id/password, 502 network. Returns the new status. */
    login: (user: string, password: string, endpoint?: string | null) =>
      hostCall<SyncStatus>('sync.login', { user, password, endpoint: endpoint || null }),
    logout: () => hostCall<SyncStatus>('sync.logout'),
    /** 401 not logged in / login expired, 409 busy or cancelled, 502 network. */
    run: (mode: SyncMode = 'normal') => hostCall<SyncRunResult>('sync.run', { mode }),
    abort: () => hostCall<SyncStatus>('sync.abort'),
    check: () => hostCall<SyncCheck>('sync.check'),
  },
  backup: {
    create: () => hostCall<BackupEntry>('backup.create'),
    list: () => hostCall<BackupList>('backup.list'),
    /** Takes a safety backup of the current collection first; returns its name. */
    restore: (name: string) => hostCall<{ ok: true; safetyBackup: string }>('backup.restore', { name }),
  },
  importFile: (path: string, name: string, replace = false) => hostCall<ImportResult>('import.file', { path, name, replace }),
  exportPackage: (opts: { deckId?: number; withScheduling: boolean; withMedia: boolean; legacy: boolean }) =>
    hostCall<ExportResult>('export.package', opts),
  exportCollection: (opts: { withMedia: boolean; legacy?: boolean }) => hostCall<ExportResult>('export.collection', opts),
  platform: {
    share: (path: string, name: string) => hostCall<Ok>('platform.share', { path, name }),
    openExternal: (url: string) => hostCall<Ok>('platform.openExternal', { url }),
    tts: (text: string, lang?: string, rate?: number) => hostCall<Ok>('platform.tts', { text, lang, rate }),
    ttsStop: () => hostCall<Ok>('platform.ttsStop'),
    clipboardWrite: (text: string) => hostCall<Ok>('platform.clipboardWrite', { text }),
    exit: () => hostCall<Ok>('platform.exit'),
  },
  hanjaLookup: (text: string, sentence?: string) => hostCall<Ok>('hanja.lookup', { text, sentence }),
  update: {
    status: () => hostCall<UpdateStatus>('update.status'),
    check: () => hostCall<UpdateStatus>('update.check'),
    apply: () => hostCall<UpdateStatus>('update.apply'),
  },
  logGet: () => hostCall<HostLogSnapshot>('log.get'),

  /**
   * Streams `file` to the host (`POST /api/host/upload?name=`). `onProgress` gets 0..1.
   * Uses XMLHttpRequest because fetch() cannot report upload progress.
   */
  upload(file: Blob, name: string, onProgress?: (fraction: number) => void): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${baseUrl}/api/host/upload?name=${encodeURIComponent(name)}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as UploadResult);
          } catch {
            reject(new HostError('upload', xhr.status, '호스트의 응답을 읽지 못했습니다', xhr.responseText));
          }
        } else {
          reject(parseError('upload', xhr.status, xhr.responseText));
        }
      };
      xhr.onerror = () => reject(new HostError('upload', 0, '앱 엔진에 연결할 수 없습니다'));
      xhr.send(file);
    });
  },

  /** `GET /api/host/download` for a file from `export.*`. */
  downloadUrl(path: string, name: string): string {
    return `${baseUrl}/api/host/download?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
  },
};

// ---------------------------------------------------------------------------
// Events (SSE)
// ---------------------------------------------------------------------------

/**
 * `progress` (ProgressPump): `{op, phase}` plus backend details while running.
 * `op`: sync | backup | restore | import | export. `kind` (running only): normalSync, fullSync,
 * mediaSync, importing, exporting, mediaCheck, databaseCheck, note.
 */
export interface ProgressEvent {
  op: string;
  phase: 'start' | 'running' | 'done' | 'error';
  kind?: string;
  /** importing/exporting/mediaCheck/databaseCheck/note text from the backend. */
  text?: string;
  /** fullSync: bytes. */
  transferred?: number;
  total?: number;
  /** normalSync stage, mediaSync / normalSync counts (strings from the backend). */
  stage?: string;
  added?: string;
  removed?: string;
  checked?: string;
  current?: number;
  error?: string;
}

/** `anki-page`: an embedded official page made a frontend-service call. */
export interface AnkiPageEvent {
  method: string;
  /** The page asks to be closed (e.g. deck options saved). */
  close: boolean;
}

export interface HostEvents {
  progress: ProgressEvent;
  back: Record<string, unknown>;
  'open-file': { path?: string; name?: string; [key: string]: unknown };
  'sync-state': SyncStatus;
  'anki-page': AnkiPageEvent;
}

export const HOST_EVENT_TYPES = ['progress', 'back', 'open-file', 'sync-state', 'anki-page'] as const;

type Handler<K extends keyof HostEvents> = (data: HostEvents[K]) => void;
const handlers: { [K in keyof HostEvents]?: Set<Handler<K>> } = {};
let source: EventSource | null = null;

/** Delivers an event to subscribers (used by the SSE stream; also handy in unit tests). */
export function dispatchHostEvent<K extends keyof HostEvents>(type: K, data: HostEvents[K]): void {
  const set = handlers[type] as Set<Handler<K>> | undefined;
  set?.forEach((h) => h(data));
}

function ensureSource(): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(`${baseUrl}/api/host/events`, { withCredentials: true });
  for (const type of HOST_EVENT_TYPES) {
    source.addEventListener(type, (ev) => {
      let data: unknown = {};
      try {
        data = JSON.parse((ev as MessageEvent<string>).data || '{}');
      } catch {
        return; // ignore malformed event
      }
      dispatchHostEvent(type, data as never);
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
  /** Host: sync media after the collection (default true). */
  'sync.media'?: boolean;
  /** Host: backups to keep (default 20). */
  'backup.keep'?: number;
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
