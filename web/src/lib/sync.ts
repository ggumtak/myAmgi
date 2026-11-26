// AnkiWeb sync controller shared by the app-bar sync button and 설정 › 동기화.
// State comes from the host (`sync.status`, `sync-state` and `progress` events);
// `runSync` drives `sync.run` and opens the full-sync direction dialog
// (ui/FullSyncDialog) when the host answers `needsFullSync`.
import { useSyncExternalStore } from 'react';
import { host, HostError, onHostEvent, type ProgressEvent, type SyncMode, type SyncStatus } from '../host';
import { toast } from '../ui/Toast';
import { describeError } from './errors';
import { notifyCollectionChanged } from './hooks';

export interface SyncState {
  status: SyncStatus | null;
  /** `sync.status` could not be read. */
  unreachable: boolean;
  /** From `sync.check` (local changes or server ahead). */
  required: 'none' | 'normal' | 'full';
  /** Human-readable progress while running (Korean). */
  progress: string | null;
  /** Fraction 0..1 when known (full upload/download). */
  fraction: number | null;
  /** The full-sync direction dialog: why it is open. */
  askFull: null | 'required' | 'manual';
}

let state: SyncState = { status: null, unreachable: false, required: 'none', progress: null, fraction: null, askFull: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const PHASE_LABEL: Record<string, string> = {
  collection: '컬렉션 동기화 중',
  backup: '내려받기 전에 백업하는 중',
  upload: '서버에 올리는 중',
  download: '서버에서 내려받는 중',
  media: '미디어 동기화 중',
};

/** Korean progress text for a `progress` event of op `sync`. */
export function describeSyncProgress(p: ProgressEvent, phase?: string): { text: string | null; fraction: number | null } {
  const base = (phase && PHASE_LABEL[phase]) || '동기화 중';
  if (p.kind === 'fullSync' && p.total) {
    const f = Math.min(1, (p.transferred ?? 0) / p.total);
    return { text: `${base} ${Math.round(f * 100)}%`, fraction: f };
  }
  if (p.kind === 'mediaSync') {
    const bits = [p.checked && `확인 ${p.checked}`, p.added && `추가 ${p.added}`, p.removed && `삭제 ${p.removed}`].filter(Boolean);
    return { text: bits.length ? `미디어 동기화 중 (${bits.join(' · ')})` : '미디어 동기화 중', fraction: null };
  }
  if (p.kind === 'normalSync') {
    const bits = [p.added && `보냄 ${p.added}`, p.removed && `받음 ${p.removed}`].filter(Boolean);
    return { text: bits.length ? `${base} (${bits.join(' · ')})` : base, fraction: null };
  }
  if (p.kind === 'note' && p.text) return { text: p.text, fraction: null };
  return { text: base, fraction: null };
}

let started = false;
let lastCheck = 0;

function applyStatus(s: SyncStatus) {
  set({
    status: s,
    unreachable: false,
    progress: s.running ? state.progress ?? PHASE_LABEL[s.phase] ?? '동기화 중' : null,
    fraction: s.running ? state.fraction : null,
  });
}

/** Loads the status once and follows the host's events (idempotent). */
export function startSync(): void {
  if (started) return;
  started = true;
  void refreshSync();
  onHostEvent('sync-state', (s) => applyStatus(s));
  onHostEvent('progress', (p) => {
    if (p.op !== 'sync') return;
    if (p.phase === 'done' || p.phase === 'error') {
      set({ progress: null, fraction: null });
      return;
    }
    const d = describeSyncProgress(p, state.status?.phase);
    set({ progress: d.text, fraction: d.fraction });
  });
}

export async function refreshSync(): Promise<void> {
  try {
    applyStatus(await host.sync.status());
  } catch {
    set({ unreachable: true });
  }
}

/** Asks the host whether a sync is needed (at most every 5 minutes unless forced). Silent on errors. */
export async function checkSyncNeeded(force = false): Promise<void> {
  if (!state.status?.loggedIn || state.status.running) return;
  if (!force && Date.now() - lastCheck < 5 * 60_000) return;
  lastCheck = Date.now();
  try {
    const r = await host.sync.check();
    set({ required: r.required });
  } catch {
    // offline etc.: keep the last answer
  }
}

/**
 * Runs a sync. `normal` may end with the direction dialog; `upload` / `download` are the two
 * full-sync directions. Errors are shown as Korean toasts and kept in the status (`lastError`).
 */
export async function runSync(mode: SyncMode = 'normal'): Promise<boolean> {
  set({ askFull: null, progress: PHASE_LABEL[mode === 'normal' ? 'collection' : mode] ?? '동기화 중', fraction: null });
  if (state.status) set({ status: { ...state.status, running: true, lastError: null } });
  try {
    const res = await host.sync.run(mode);
    if (!res.ok && res.needsFullSync) {
      set({ askFull: 'required', required: 'full' });
      return false;
    }
    set({ required: 'none' });
    lastCheck = Date.now();
    notifyCollectionChanged();
    toast(res.serverMessage ? `동기화 완료: ${res.serverMessage}` : '동기화 완료');
    return true;
  } catch (err) {
    const msg = describeError(err).message;
    if (err instanceof HostError && err.status === 409 && err.detail === 'aborted') toast(msg);
    else toast(`동기화 실패: ${msg}`, { kind: 'error' });
    return false;
  } finally {
    set({ progress: null, fraction: null });
    await refreshSync();
  }
}

export function openFullSyncDialog(reason: 'required' | 'manual' = 'manual'): void {
  set({ askFull: reason });
}

export function closeFullSyncDialog(): void {
  set({ askFull: null });
}

export function useSyncState(): SyncState {
  startSync();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/** The sync button's state per UI_SPEC: idle, syncing, needs sync (dot), error (!). */
export function syncButtonState(s: SyncState): 'idle' | 'syncing' | 'needed' | 'error' | 'logged-out' {
  if (s.unreachable) return 'error';
  if (!s.status) return 'idle';
  if (s.status.running) return 'syncing';
  if (!s.status.loggedIn) return 'logged-out';
  if (s.status.lastError) return 'error';
  if (s.status.needsFullSync || s.required !== 'none') return 'needed';
  return 'idle';
}

/** Test hook. */
export function _resetSyncState(): void {
  state = { status: null, unreachable: false, required: 'none', progress: null, fraction: null, askFull: null };
  started = false;
  lastCheck = 0;
  listeners.forEach((l) => l());
}
