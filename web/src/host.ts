export class HostApiError extends Error {
  readonly status: number;
  readonly fn: string;
  readonly detail?: string;

  constructor(fn: string, status: number, message: string, detail?: string) {
    super(message || `호스트 요청에 실패했습니다 (${fn}: HTTP ${status}).`);
    this.name = 'HostApiError';
    this.fn = fn;
    this.status = status;
    this.detail = detail;
  }
}

export interface HostInfo {
  appVersion: string;
  build: number;
  flavor: string;
  platform: 'android' | 'desktop' | string;
  eink: boolean;
  device: string;
  uiVersion: string | null;
  backendVersion: string;
}

export type HostPrefs = Record<string, unknown>;

export interface CollectionStatus {
  open: boolean;
  path: string | null;
  size: number;
  mediaDir: string | null;
  lastError: string | null;
}

export interface SyncStatus {
  loggedIn: boolean;
  user: string | null;
  endpoint: string | null;
  running: boolean;
  phase: 'idle' | 'collection' | 'backup' | 'download' | 'upload' | 'media' | string;
  needsFullSync: boolean;
  lastSync: number | null;
  lastError: string | null;
  mediaRunning?: boolean;
  mediaChecked?: string | null;
  mediaAdded?: string | null;
  mediaRemoved?: string | null;
  mediaLastSync?: number | null;
  mediaError?: string | null;
  mediaSkipped?: boolean;
}

export interface SyncRunResult {
  ok: boolean;
  needsFullSync: boolean;
  serverMessage?: string;
  lastSync?: number;
  mediaSyncStarted?: boolean;
  mediaSyncSkipped?: boolean;
}

export interface BackupEntry {
  name: string;
  size: number;
  time: number;
}

export interface BackupListResponse {
  keep: number;
  backups: BackupEntry[];
}

export interface BackupRestoreResponse {
  ok: boolean;
  safetyBackup: string;
}

export interface UploadResult {
  path: string;
  name: string;
  size: number;
}

export interface ImportFileResult {
  kind: 'apkg' | 'colpkg' | 'csv';
  path: string;
  route: string | null;
  needsConfirm?: boolean;
  imported?: boolean;
  safetyBackup?: string;
  detectedEncoding?: string;
}

export interface ExportResult {
  path: string;
  name: string;
  size: number;
  notes?: number;
}

export interface LogSnapshot {
  lines: string[];
  errors: string[];
  text: string;
}

export interface UpdateStatusResponse {
  supported?: boolean;
  checking?: boolean;
  available?: boolean;
  version?: string;
  currentVersion?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface ProgressEvent {
  op: string;
  phase: 'start' | 'running' | 'done' | 'error';
  kind?: string;
  text?: string;
  stage?: string;
  added?: string | number;
  removed?: string | number;
  checked?: string | number;
  transferred?: number;
  total?: number;
  current?: number;
  error?: string;
}

export interface AnkiPageEvent {
  method: string;
  close: boolean;
}

export interface OpenFileEvent {
  path: string;
  name?: string;
  kind?: string;
  route?: string | null;
}

export interface HostKeyEvent {
  key?: string;
  action?: string;
  shift?: boolean;
  ctrl?: boolean;
}

export interface HostEventHandlers {
  progress?: (ev: ProgressEvent) => void;
  syncState?: (ev: SyncStatus) => void;
  back?: (ev: unknown) => void;
  openFile?: (ev: OpenFileEvent) => void;
  ankiPage?: (ev: AnkiPageEvent) => void;
  key?: (ev: HostKeyEvent) => void;
  error?: (ev: Event) => void;
}

let hostBaseUrl = '';
let hostHeaders: Record<string, string> = {};

export function configureHostApi(options: {
  baseUrl?: string;
  headers?: Record<string, string>;
}): void {
  if (options.baseUrl !== undefined) {
    hostBaseUrl = options.baseUrl.replace(/\/+$/, '');
  }
  if (options.headers !== undefined) {
    hostHeaders = { ...options.headers };
  }
}

async function postHost<TReq extends object | undefined, TRes>(
  fn: string,
  args?: TReq,
  signal?: AbortSignal
): Promise<TRes> {
  const response = await fetch(`${hostBaseUrl}/api/host/${fn}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...hostHeaders,
    },
    body: JSON.stringify(args ?? {}),
    signal,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errObj = (parsed && typeof parsed === 'object' ? parsed : {}) as {
      error?: string;
      detail?: string;
    };
    throw new HostApiError(
      fn,
      response.status,
      errObj.error || text || `호스트 호출에 실패했습니다 (${fn}, HTTP ${response.status}).`,
      errObj.detail
    );
  }

  return parsed as TRes;
}

export async function uploadHostFile(
  file: File | Blob,
  name: string,
  signal?: AbortSignal
): Promise<UploadResult> {
  const encodedName = encodeURIComponent(name);
  const response = await fetch(`${hostBaseUrl}/api/host/upload?name=${encodedName}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...hostHeaders,
    },
    body: file,
    signal,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errObj = (parsed && typeof parsed === 'object' ? parsed : {}) as {
      error?: string;
      detail?: string;
    };
    throw new HostApiError(
      'upload',
      response.status,
      errObj.error || text || '파일을 올리지 못했습니다.',
      errObj.detail
    );
  }

  return parsed as UploadResult;
}

export function getHostDownloadUrl(path: string, name: string): string {
  const params = new URLSearchParams({ path, name });
  return `${hostBaseUrl}/api/host/download?${params.toString()}`;
}

export function subscribeHostEvents(handlers: HostEventHandlers): () => void {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }
  const source = new EventSource(`${hostBaseUrl}/api/host/events`, {
    withCredentials: true,
  });

  const bind = <T>(eventName: string, cb?: (data: T) => void) => {
    if (!cb) return;
    source.addEventListener(eventName, (event) => {
      const msg = event as MessageEvent<string>;
      try {
        cb(JSON.parse(msg.data) as T);
      } catch {
        // Ignore malformed SSE payload
      }
    });
  };

  bind<ProgressEvent>('progress', handlers.progress);
  bind<SyncStatus>('sync-state', handlers.syncState);
  bind<unknown>('back', handlers.back);
  bind<OpenFileEvent>('open-file', handlers.openFile);
  bind<AnkiPageEvent>('anki-page', handlers.ankiPage);
  bind<HostKeyEvent>('key', handlers.key);

  if (handlers.error) {
    source.onerror = handlers.error;
  }

  return () => {
    source.close();
  };
}

export const host = {
  info: (signal?: AbortSignal) => postHost<Record<string, never>, HostInfo>('info', {}, signal),

  prefsGet: (signal?: AbortSignal) =>
    postHost<Record<string, never>, HostPrefs>('prefs.get', {}, signal),

  prefsSet: (changes: Record<string, unknown>, signal?: AbortSignal) =>
    postHost<Record<string, unknown>, HostPrefs>('prefs.set', changes, signal),

  collectionStatus: (signal?: AbortSignal) =>
    postHost<Record<string, never>, CollectionStatus>('collection.status', {}, signal),

  syncStatus: (signal?: AbortSignal) =>
    postHost<Record<string, never>, SyncStatus>('sync.status', {}, signal),

  syncLogin: (
    args: { user: string; password: string; endpoint?: string },
    signal?: AbortSignal
  ) => postHost<typeof args, SyncStatus>('sync.login', args, signal),

  syncLogout: (signal?: AbortSignal) =>
    postHost<Record<string, never>, SyncStatus>('sync.logout', {}, signal),

  syncRun: (
    mode: 'normal' | 'upload' | 'download' = 'normal',
    signal?: AbortSignal,
    opts?: { forceMedia?: boolean }
  ) =>
    postHost<{ mode: string; forceMedia?: boolean }, SyncRunResult>(
      'sync.run',
      opts?.forceMedia !== undefined ? { mode, forceMedia: opts.forceMedia } : { mode },
      signal
    ),

  syncAbort: (signal?: AbortSignal) =>
    postHost<Record<string, never>, SyncStatus>('sync.abort', {}, signal),

  syncMediaRun: (signal?: AbortSignal) =>
    postHost<Record<string, never>, SyncStatus>('sync.mediaRun', {}, signal),

  syncMediaAbort: (signal?: AbortSignal) =>
    postHost<Record<string, never>, SyncStatus>('sync.mediaAbort', {}, signal),

  backupCreate: (signal?: AbortSignal) =>
    postHost<Record<string, never>, BackupEntry>('backup.create', {}, signal),

  backupList: (signal?: AbortSignal) =>
    postHost<Record<string, never>, BackupListResponse>('backup.list', {}, signal),

  backupRestore: (name: string, signal?: AbortSignal) =>
    postHost<{ name: string }, BackupRestoreResponse>('backup.restore', { name }, signal),

  importFile: (
    args: { path: string; name?: string; replace?: boolean },
    signal?: AbortSignal
  ) => postHost<typeof args, ImportFileResult>('import.file', args, signal),

  exportPackage: (
    args: {
      deckId?: number;
      withScheduling?: boolean;
      withMedia?: boolean;
      legacy?: boolean;
    } = {},
    signal?: AbortSignal
  ) => postHost<typeof args, ExportResult>('export.package', args, signal),

  exportCollection: (
    args: { withMedia?: boolean; legacy?: boolean } = {},
    signal?: AbortSignal
  ) => postHost<typeof args, ExportResult>('export.collection', args, signal),

  logGet: (signal?: AbortSignal) =>
    postHost<Record<string, never>, LogSnapshot>('log.get', {}, signal),

  platformShare: (args: { path: string; name?: string }, signal?: AbortSignal) =>
    postHost<typeof args, { ok: boolean }>('platform.share', args, signal),

  platformOpenExternal: (url: string, signal?: AbortSignal) =>
    postHost<{ url: string }, { ok: boolean }>('platform.openExternal', { url }, signal),

  platformTts: (
    args: { text: string; lang?: string; rate?: number },
    signal?: AbortSignal
  ) => postHost<typeof args, { ok: boolean }>('platform.tts', args, signal),

  platformTtsStop: (signal?: AbortSignal) =>
    postHost<Record<string, never>, { ok: boolean }>('platform.ttsStop', {}, signal),

  platformClipboardWrite: (text: string, signal?: AbortSignal) =>
    postHost<{ text: string }, { ok: boolean }>('platform.clipboardWrite', { text }, signal),

  platformExit: (signal?: AbortSignal) =>
    postHost<Record<string, never>, { ok: boolean }>('platform.exit', {}, signal),

  hanjaLookup: (
    args: { text: string; sentence?: string },
    signal?: AbortSignal
  ) => postHost<typeof args, { ok: boolean }>('hanja.lookup', args, signal),

  updateStatus: (signal?: AbortSignal) =>
    postHost<Record<string, never>, UpdateStatusResponse>('update.status', {}, signal),

  updateCheck: (signal?: AbortSignal) =>
    postHost<Record<string, never>, UpdateStatusResponse>('update.check', {}, signal),

  updateApply: (signal?: AbortSignal) =>
    postHost<Record<string, never>, UpdateStatusResponse>('update.apply', {}, signal),

  upload: uploadHostFile,
  downloadUrl: getHostDownloadUrl,
  subscribeEvents: subscribeHostEvents,
};

export default host;
