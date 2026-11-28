import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  host,
  HostApiError,
  subscribeHostEvents,
  type AnkiPageEvent,
  type HostInfo,
  type HostKeyEvent,
  type HostPrefs,
  type OpenFileEvent,
  type ProgressEvent,
  type SyncStatus,
} from '../host';
import { closeTopModal, SheetOrDialog, useToast } from '../ui';

export type ResolvedTheme = 'light' | 'dark' | 'eink';
export type PrefTheme = 'auto' | 'light' | 'dark' | 'eink';
export type { HostKeyEvent };

export interface AppContextValue {
  info: HostInfo | null;
  prefs: HostPrefs;
  prefTheme: PrefTheme;
  resolvedTheme: ResolvedTheme;
  setPref: (key: string, value: unknown) => Promise<void>;
  setPrefs: (patch: Record<string, unknown>) => Promise<void>;
  syncStatus: SyncStatus | null;
  syncProgress: ProgressEvent | null;
  mediaSyncProgress: ProgressEvent | null;
  /** Last `progress` event with `op: "update"` (APK download / UI bundle apply), or null. */
  updateProgress: ProgressEvent | null;
  /** Fetches `sync.status`, stores it and returns it. Rejects on failure. */
  refreshSyncStatus: () => Promise<SyncStatus>;
  startBackgroundSync: (
    mode?: 'normal' | 'upload' | 'download',
    opts?: { silentStartToast?: boolean; forceMedia?: boolean }
  ) => void;
  startMediaSync: () => void;
  abortMediaSync: () => Promise<void>;
  openSyncSheet: () => void;
  closeSyncSheet: () => void;
  syncSheetOpen: boolean;
  openFullSyncDialog: () => void;
  closeFullSyncDialog: () => void;
  fullSyncOpen: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;
  addSheetOpen: boolean;
  collectionVersion: number;
  bumpCollection: () => void;
  navigate: (hash: string) => void;
  /**
   * Android/app back. Registered back handlers run first (top-most first) unless
   * `opts.force` is set, which skips them and navigates immediately.
   */
  goBack: (fallback?: string, opts?: { force?: boolean }) => void;
  registerBackHandler: (fn: () => boolean) => () => void;
  registerKeyHandler: (fn: (ev: HostKeyEvent) => boolean) => () => void;
  /**
   * Report focus of an input that lives inside a card iframe (type-answer box).
   * OR-ed into the `isInputFocused` flag sent to `AndroidShell.setStudyState`.
   */
  setCardInputFocused: (focused: boolean) => void;
  /**
   * Subscribe to `anki-page` events on the app's single host event stream
   * (embedded official pages). Returns an unsubscribe function.
   */
  subscribeAnkiPage: (fn: (ev: AnkiPageEvent) => void) => () => void;
}

/** Network-level failure (host unreachable, AnkiWeb unreachable): not worth a toast for auto-sync. */
function isNetworkError(err: unknown): boolean {
  if (err instanceof HostApiError) {
    return err.status === 502 || err.status === 503 || err.status === 504;
  }
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  return err instanceof TypeError;
}

const HIDDEN_SYNC_MIN_INTERVAL_MS = 10 * 60_000;
const HIDDEN_SYNC_AFTER_ACTIVITY_MIN_INTERVAL_MS = 60_000;

const AppContext = createContext<AppContextValue | null>(null);

function normalizePrefTheme(raw: unknown, einkDevice: boolean): PrefTheme {
  if (raw === 'light' || raw === 'dark' || raw === 'eink' || raw === 'auto') {
    return raw;
  }
  return einkDevice ? 'eink' : 'auto';
}

function getSystemPrefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

function resolveTheme(pref: PrefTheme, systemDark: boolean): ResolvedTheme {
  if (pref === 'light' || pref === 'dark' || pref === 'eink') {
    return pref;
  }
  return systemDark ? 'dark' : 'light';
}

function normalizeHashTarget(hash: string): string {
  const trimmed = hash.trim();
  if (!trimmed) return '#/decks';
  if (trimmed.startsWith('#/')) return trimmed;
  if (trimmed.startsWith('#')) return `#/${trimmed.slice(1).replace(/^\/+/, '')}`;
  if (trimmed.startsWith('/')) return `#${trimmed}`;
  return `#/${trimmed}`;
}

function isRootHash(hash: string): boolean {
  const normalized = normalizeHashTarget(hash);
  return normalized === '#/decks' || normalized === '#/';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();

  const [info, setInfo] = useState<HostInfo | null>(null);
  const [prefs, setPrefsState] = useState<HostPrefs>({});
  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<ProgressEvent | null>(null);
  const [mediaSyncProgress, setMediaSyncProgress] = useState<ProgressEvent | null>(null);
  const [updateProgress, setUpdateProgress] = useState<ProgressEvent | null>(null);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const [fullSyncOpen, setFullSyncOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const [pendingColpkg, setPendingColpkg] = useState<OpenFileEvent | null>(null);
  const [colpkgReplacing, setColpkgReplacing] = useState(false);
  const [cardInputFocused, setCardInputFocusedState] = useState(false);
  const setCardInputFocused = useCallback((focused: boolean) => {
    setCardInputFocusedState(Boolean(focused));
  }, []);

  const backHandlersRef = useRef<Set<() => boolean>>(new Set());
  const keyHandlersRef = useRef<Set<(ev: HostKeyEvent) => boolean>>(new Set());
  const autoSyncAttemptedRef = useRef(false);
  const ankiPageSubscribersRef = useRef<Set<(ev: AnkiPageEvent) => void>>(new Set());
  const prefsRef = useRef<HostPrefs>({});
  prefsRef.current = prefs;
  const syncStatusRef = useRef<SyncStatus | null>(null);
  syncStatusRef.current = syncStatus;

  /** Something was studied or edited since the last completed sync (cheap heuristic). */
  const localActivityRef = useRef(false);

  const bumpCollection = useCallback(() => {
    localActivityRef.current = true;
    setCollectionVersion((v) => v + 1);
  }, []);

  /*
   * One finished sync must refresh lists exactly once. The completion is observed
   * through several channels (sync.run result, SSE progress/sync-state, status
   * refreshes), so the bump is keyed on `lastSync`, which the host only advances
   * after a successful collection sync.
   */
  const lastSyncSeenRef = useRef<number | null | undefined>(undefined);
  const observeLastSync = useCallback((lastSync: number | null | undefined) => {
    const cur = typeof lastSync === 'number' && lastSync > 0 ? lastSync : null;
    const prev = lastSyncSeenRef.current;
    if (prev === undefined) {
      lastSyncSeenRef.current = cur; // baseline, no bump
      return;
    }
    if (cur !== null && (prev === null || cur > prev)) {
      lastSyncSeenRef.current = cur;
      localActivityRef.current = false;
      setCollectionVersion((v) => v + 1);
    }
  }, []);

  const applySyncStatus = useCallback(
    (st: SyncStatus) => {
      setSyncStatus(st);
      observeLastSync(st.lastSync);
    },
    [observeLastSync]
  );

  const navigate = useCallback((hash: string) => {
    setAddSheetOpen(false);
    setSyncSheetOpen(false);
    const next = normalizeHashTarget(hash);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
  }, []);

  const goBack = useCallback((fallback = '#/decks', opts?: { force?: boolean }) => {
    if (!opts?.force) {
      // The top-most open sheet/dialog always takes the back press first.
      if (closeTopModal()) return;
      const handlers = Array.from(backHandlersRef.current);
      for (let i = handlers.length - 1; i >= 0; i--) {
        try {
          if (handlers[i]()) {
            return;
          }
        } catch {
          // Ignore faulty handler and try next
        }
      }
    }

    if (isRootHash(window.location.hash || '#/decks')) {
      void host.platformExit().catch(() => undefined);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const target = normalizeHashTarget(fallback);
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
  }, []);

  const registerBackHandler = useCallback((fn: () => boolean) => {
    backHandlersRef.current.add(fn);
    return () => {
      backHandlersRef.current.delete(fn);
    };
  }, []);

  const registerKeyHandler = useCallback((fn: (ev: HostKeyEvent) => boolean) => {
    keyHandlersRef.current.add(fn);
    return () => {
      keyHandlersRef.current.delete(fn);
    };
  }, []);

  // Each prefs write gets a sequence number; only the newest request's response
  // (or recovery fetch) may replace the optimistic state.
  const prefsSeqRef = useRef(0);
  const setPrefs = useCallback(
    async (patch: Record<string, unknown>) => {
      const seq = ++prefsSeqRef.current;
      setPrefsState((prev) => {
        const next: HostPrefs = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) {
            delete next[k];
          } else {
            next[k] = v;
          }
        }
        return next;
      });
      try {
        const updated = await host.prefsSet(patch);
        if (seq === prefsSeqRef.current) setPrefsState(updated ?? {});
      } catch (err) {
        // Never reject: callers use `void setPref(...)`. Roll back to the host's state.
        showToast(
          err instanceof Error && err.message
            ? `설정을 저장하지 못했습니다: ${err.message}`
            : '설정을 저장하지 못했습니다.',
          'error'
        );
        try {
          const fresh = await host.prefsGet();
          if (seq === prefsSeqRef.current) setPrefsState(fresh ?? {});
        } catch {
          // Host unreachable: keep the optimistic state until the next successful write
        }
      }
    },
    [showToast]
  );

  const setPref = useCallback(
    async (key: string, value: unknown) => {
      await setPrefs({ [key]: value });
    },
    [setPrefs]
  );

  const refreshSyncStatus = useCallback(async () => {
    const status = await host.syncStatus();
    applySyncStatus(status);
    return status;
  }, [applySyncStatus]);

  const syncInFlightRef = useRef(false);
  const startBackgroundSync = useCallback(
    (
      mode: 'normal' | 'upload' | 'download' = 'normal',
      opts?: { silentStartToast?: boolean; forceMedia?: boolean }
    ) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      setSyncStatus((prev) =>
        prev
          ? {
              ...prev,
              running: true,
              phase: mode === 'download' ? 'download' : mode === 'upload' ? 'upload' : 'collection',
              lastError: null,
            }
          : prev
      );

      if (!opts?.silentStartToast) {
        const startMsg =
          mode === 'download'
            ? '백그라운드에서 서버 데이터를 가져옵니다. 다른 화면을 보셔도 계속 진행됩니다.'
            : mode === 'upload'
              ? '백그라운드에서 서버로 업로드합니다. 다른 화면을 보셔도 계속 진행됩니다.'
              : '동기화를 시작했습니다.';
        showToast(startMsg, 'info');
      }

      const runOpts =
        opts?.forceMedia !== undefined ? { forceMedia: opts.forceMedia } : undefined;

      void host
        .syncRun(mode, undefined, runOpts)
        .then(async (res) => {
          await refreshSyncStatus().catch(() => undefined);
          if (res.needsFullSync) {
            setFullSyncOpen(true);
            return;
          }
          if (res.ok) {
            observeLastSync(res.lastSync);
            const doneMsg =
              mode === 'download'
                ? res.mediaSyncStarted
                  ? '서버 카드를 가져왔습니다 · 미디어는 백그라운드에서 이어서 맞춥니다.'
                  : '서버에서 카드와 학습 설정을 모두 가져왔습니다.'
                : mode === 'upload'
                  ? res.mediaSyncStarted
                    ? '서버로 업로드했습니다 · 미디어는 백그라운드에서 이어서 맞춥니다.'
                    : '이 기기의 카드와 기록을 서버로 보냈습니다.'
                  : res.mediaSyncStarted
                    ? '카드 동기화 완료 · 미디어는 백그라운드에서 이어서 맞춥니다.'
                    : '동기화를 마쳤습니다.';
            showToast(doneMsg, 'success');
          }
        })
        .catch(async (err) => {
          await refreshSyncStatus().catch(() => undefined);
          if (err instanceof HostApiError && err.status === 409) {
            if (err.detail === 'aborted') {
              showToast('동기화를 중단했습니다.', 'info');
            } else if (err.detail === 'busy') {
              showToast('이미 동기화가 진행 중입니다.', 'info');
            } else {
              showToast(err.message || '동기화를 중단했습니다.', 'info');
            }
          } else {
            showToast(
              err instanceof Error ? err.message : '동기화를 끝내지 못했습니다.',
              'error'
            );
          }
        })
        .finally(() => {
          syncInFlightRef.current = false;
        });
    },
    [refreshSyncStatus, observeLastSync, showToast]
  );

  const mediaSyncInFlightRef = useRef(false);
  const startMediaSync = useCallback(() => {
    if (mediaSyncInFlightRef.current) return;
    mediaSyncInFlightRef.current = true;

    setSyncStatus((prev) =>
      prev
        ? {
            ...prev,
            mediaRunning: true,
            mediaError: null,
          }
        : prev
    );

    void host
      .syncMediaRun()
      .then((st) => {
        applySyncStatus(st);
        if (st.mediaRunning) {
          showToast('백그라운드에서 미디어 확인을 시작했습니다.', 'info');
        } else if (st.mediaError) {
          showToast(st.mediaError, 'error');
        } else if (st.mediaSkipped) {
          showToast('미디어가 이미 최신 상태라 확인을 건너뛰었습니다.', 'info');
        } else {
          showToast('미디어 확인을 마쳤습니다.', 'success');
        }
      })
      .catch(async (err) => {
        await refreshSyncStatus().catch(() => undefined);
        if (err instanceof HostApiError && err.status === 409) {
          showToast('이미 미디어 동기화가 진행 중입니다.', 'info');
        } else {
          showToast(
            err instanceof Error ? err.message : '미디어 동기화를 시작하지 못했습니다.',
            'error'
          );
        }
      })
      .finally(() => {
        mediaSyncInFlightRef.current = false;
      });
  }, [applySyncStatus, refreshSyncStatus, showToast]);

  const abortMediaSync = useCallback(async () => {
    try {
      await host.syncMediaAbort();
      setMediaSyncProgress(null);
      await refreshSyncStatus().catch(() => undefined);
      showToast('미디어 동기화를 중단했습니다.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '미디어 동기화를 중단하지 못했습니다.',
        'error'
      );
    }
  }, [refreshSyncStatus, showToast]);

  // When returning from another Android app, refresh syncStatus & collection if sync finished in background
  const wasRunningRef = useRef(false);
  const wasMediaRunningRef = useRef(false);
  const reconcileSyncTransition = useCallback((st: SyncStatus) => {
    // Collection refresh after a finished sync is handled by observeLastSync.
    if (wasRunningRef.current && !st.running) {
      wasRunningRef.current = false;
    } else if (st.running) {
      wasRunningRef.current = true;
    }

    if (wasMediaRunningRef.current && !st.mediaRunning) {
      wasMediaRunningRef.current = false;
      setMediaSyncProgress(null);
    } else if (st.mediaRunning) {
      wasMediaRunningRef.current = true;
    }
  }, []);

  useEffect(() => {
    wasRunningRef.current = Boolean(syncStatus?.running);
    wasMediaRunningRef.current = Boolean(syncStatus?.mediaRunning);
  }, [syncStatus?.running, syncStatus?.mediaRunning]);

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === 'hidden') return;
      void host
        .syncStatus()
        .then((st) => {
          applySyncStatus(st);
          reconcileSyncTransition(st);
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [applySyncStatus, reconcileSyncTransition]);

  const openSyncSheet = useCallback(() => setSyncSheetOpen(true), []);
  const closeSyncSheet = useCallback(() => setSyncSheetOpen(false), []);
  const openFullSyncDialog = useCallback(() => setFullSyncOpen(true), []);
  const closeFullSyncDialog = useCallback(() => setFullSyncOpen(false), []);
  const openAddSheet = useCallback(() => setAddSheetOpen(true), []);
  const closeAddSheet = useCallback(() => setAddSheetOpen(false), []);

  // Close global sheets whenever the hash route changes
  useEffect(() => {
    const onHashChange = () => {
      setAddSheetOpen(false);
      setSyncSheetOpen(false);
      // A card iframe that unmounts may never report its blur.
      setCardInputFocusedState(false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Track OS color scheme changes when prefTheme === 'auto'
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const prefTheme = useMemo<PrefTheme>(
    () => normalizePrefTheme(prefs['theme'], Boolean(info?.eink)),
    [prefs, info?.eink]
  );

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => resolveTheme(prefTheme, systemDark),
    [prefTheme, systemDark]
  );

  // Sync theme to document root & Android system bars
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle('night_mode', resolvedTheme === 'dark');

    const bgHex =
      resolvedTheme === 'dark'
        ? '#0B0E14'
        : resolvedTheme === 'eink'
          ? '#FFFFFF'
          : '#F4F5F7';
    const isLight = resolvedTheme !== 'dark';
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = bgHex;
    }
    try {
      const shell = (
        window as unknown as {
          AndroidShell?: { setSystemBars?: (bg: string, light: boolean) => void };
        }
      ).AndroidShell;
      shell?.setSystemBars?.(bgHex, isLight);
    } catch {
      // Ignore shell bridge errors
    }
  }, [resolvedTheme]);

  // Sync study & volume-key state to AndroidShell on route, focus, or pref changes
  useEffect(() => {
    const pushStudyState = () => {
      const hash = window.location.hash || '#/decks';
      const inStudy = hash.startsWith('#/study/');
      const volumeKeyStudy =
        typeof prefs['study.volumeKeys'] === 'boolean'
          ? prefs['study.volumeKeys']
          : Boolean(info?.eink);
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const isInputFocused =
        cardInputFocused ||
        Boolean(
          active &&
            (tag === 'input' ||
              tag === 'textarea' ||
              tag === 'select' ||
              (active as HTMLElement).isContentEditable)
        );
      try {
        const shell = (
          window as unknown as {
            AndroidShell?: {
              setStudyState?: (
                inStudy: boolean,
                volumeKeyStudy: boolean,
                isInputFocused: boolean
              ) => void;
            };
          }
        ).AndroidShell;
        shell?.setStudyState?.(inStudy, volumeKeyStudy, isInputFocused);
      } catch {
        // Ignore shell bridge errors
      }
    };

    pushStudyState();
    window.addEventListener('hashchange', pushStudyState);
    document.addEventListener('focusin', pushStudyState);
    document.addEventListener('focusout', pushStudyState);
    return () => {
      window.removeEventListener('hashchange', pushStudyState);
      document.removeEventListener('focusin', pushStudyState);
      document.removeEventListener('focusout', pushStudyState);
    };
  }, [prefs, info?.eink, cardInputFocused]);

  /*
   * Automatic sync ("sync.auto"): once at startup and, best effort, when the page is
   * hidden (app closed / switched away). Network failures stay silent; any other
   * failure (e.g. expired login) shows one toast until a sync succeeds again.
   */
  const lastAutoSyncAtRef = useRef(0);
  const autoSyncErrorShownRef = useRef(false);
  const runAutoSync = useCallback(() => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    lastAutoSyncAtRef.current = Date.now();
    host
      .syncRun('normal')
      .then(async (res) => {
        if (res.needsFullSync) {
          setFullSyncOpen(true);
        } else if (res.ok) {
          autoSyncErrorShownRef.current = false;
          observeLastSync(res.lastSync);
        }
        await refreshSyncStatus().catch(() => undefined);
      })
      .catch(async (err) => {
        await refreshSyncStatus().catch(() => undefined);
        if (isNetworkError(err)) return;
        if (err instanceof HostApiError && err.status === 409) return; // busy / aborted
        if (autoSyncErrorShownRef.current) return;
        autoSyncErrorShownRef.current = true;
        showToast(
          `자동 동기화를 하지 못했습니다: ${
            err instanceof Error && err.message ? err.message : '알 수 없는 오류'
          }`,
          'error',
          { label: '동기화 열기', onClick: () => setSyncSheetOpen(true) }
        );
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, [observeLastSync, refreshSyncStatus, showToast]);

  const maybeStartupAutoSync = useCallback(
    (st: SyncStatus, loadedPrefs: HostPrefs) => {
      if (autoSyncAttemptedRef.current) return;
      autoSyncAttemptedRef.current = true;
      if (
        !syncInFlightRef.current &&
        st.loggedIn &&
        loadedPrefs['sync.auto'] === true &&
        !st.running &&
        !st.needsFullSync
      ) {
        runAutoSync();
      }
    },
    [runAutoSync]
  );

  // Initial load: info, prefs, syncStatus (+ conditional auto-sync)
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: number | undefined;

    // `syncStatus === null` means "not loaded yet": keep retrying with backoff so the
    // sync button never treats a failed first call as "logged out".
    const retrySyncStatus = (attempt: number) => {
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      retryTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (syncStatusRef.current) {
          // Loaded meanwhile (e.g. the user tapped sync, or an SSE sync-state arrived)
          maybeStartupAutoSync(syncStatusRef.current, prefsRef.current);
          return;
        }
        host
          .syncStatus(controller.signal)
          .then((st) => {
            if (cancelled) return;
            applySyncStatus(st);
            maybeStartupAutoSync(st, prefsRef.current);
          })
          .catch(() => {
            if (!cancelled) retrySyncStatus(attempt + 1);
          });
      }, delay);
    };

    Promise.all([
      host.info(controller.signal).catch(() => null),
      host.prefsGet(controller.signal).catch((): HostPrefs => ({})),
      host.syncStatus(controller.signal).catch(() => null),
    ]).then(([loadedInfo, loadedPrefs, loadedSync]) => {
      if (cancelled) return;
      if (loadedInfo) setInfo(loadedInfo);
      if (loadedPrefs) {
        setPrefsState(loadedPrefs);
        prefsRef.current = loadedPrefs;
      }
      if (loadedSync) {
        applySyncStatus(loadedSync);
        maybeStartupAutoSync(loadedSync, loadedPrefs);
      } else {
        retrySyncStatus(0);
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      controller.abort();
    };
  }, [applySyncStatus, maybeStartupAutoSync]);

  // Studying counts as local activity for the hide-time auto-sync heuristic.
  useEffect(() => {
    const onHash = () => {
      if ((window.location.hash || '').startsWith('#/study/')) {
        localActivityRef.current = true;
      }
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Best-effort auto-sync when the app is closed or sent to the background. The host
  // runs the sync itself (foreground service on Android), so it continues while hidden.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      const st = syncStatusRef.current;
      if (prefsRef.current['sync.auto'] !== true) return;
      if (!st || !st.loggedIn || st.running || st.needsFullSync) return;
      if (syncInFlightRef.current) return;
      const lastAt = Math.max(lastAutoSyncAtRef.current, st.lastSync ?? 0);
      const since = Date.now() - lastAt;
      const due = localActivityRef.current
        ? since >= HIDDEN_SYNC_AFTER_ACTIVITY_MIN_INTERVAL_MS
        : since >= HIDDEN_SYNC_MIN_INTERVAL_MS;
      if (!due) return;
      runAutoSync();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [runAutoSync]);

  const subscribeAnkiPage = useCallback((fn: (ev: AnkiPageEvent) => void) => {
    ankiPageSubscribersRef.current.add(fn);
    return () => {
      ankiPageSubscribersRef.current.delete(fn);
    };
  }, []);

  // Subscribe to host SSE stream
  useEffect(() => {
    const unsubscribe = subscribeHostEvents({
      syncState: (ev) => {
        applySyncStatus(ev);
        reconcileSyncTransition(ev);
        if (!ev.mediaRunning) {
          setMediaSyncProgress(null);
        }
      },
      progress: (ev) => {
        if (ev.op === 'sync') {
          if (ev.phase === 'done' || ev.phase === 'error') {
            setSyncProgress(null);
            // Collection refresh happens once via observeLastSync (lastSync advanced).
            if (ev.phase === 'done') {
              void refreshSyncStatus().catch(() => undefined);
            }
          } else {
            setSyncProgress(ev);
          }
        } else if (ev.op === 'media-sync') {
          if (ev.phase === 'done' || ev.phase === 'error') {
            setMediaSyncProgress(null);
            void refreshSyncStatus().catch(() => undefined);
          } else {
            setMediaSyncProgress(ev);
            setSyncStatus((prev) =>
              prev
                ? {
                    ...prev,
                    mediaRunning: true,
                    ...(ev.checked !== undefined ? { mediaChecked: String(ev.checked) } : {}),
                    ...(ev.added !== undefined ? { mediaAdded: String(ev.added) } : {}),
                    ...(ev.removed !== undefined ? { mediaRemoved: String(ev.removed) } : {}),
                  }
                : prev
            );
          }
        } else if (ev.op === 'update') {
          setUpdateProgress(ev);
        } else if (ev.op === 'import' || ev.op === 'restore') {
          if (ev.phase === 'done') {
            setCollectionVersion((v) => v + 1);
          }
        }
      },
      back: () => {
        goBack();
      },
      openFile: (ev) => {
        if (ev.route) {
          navigate(ev.route);
        } else if (ev.kind === 'colpkg') {
          setPendingColpkg(ev);
        }
      },
      ankiPage: (ev) => {
        if (ev.close) {
          setCollectionVersion((v) => v + 1);
        }
        for (const fn of Array.from(ankiPageSubscribersRef.current)) {
          try {
            fn(ev);
          } catch {
            // Ignore subscriber failure
          }
        }
      },
      key: (ev) => {
        const handlers = Array.from(keyHandlersRef.current);
        for (let i = handlers.length - 1; i >= 0; i--) {
          try {
            if (handlers[i](ev)) {
              return;
            }
          } catch {
            // Ignore handler failure
          }
        }
      },
    });

    return unsubscribe;
  }, [applySyncStatus, goBack, navigate, reconcileSyncTransition, refreshSyncStatus]);

  const handleConfirmColpkg = async () => {
    if (!pendingColpkg || colpkgReplacing) return;
    setColpkgReplacing(true);
    try {
      await host.importFile({
        path: pendingColpkg.path,
        name: pendingColpkg.name,
        replace: true,
      });
      setPendingColpkg(null);
      bumpCollection();
      showToast('컬렉션 패키지(.colpkg)를 가져왔습니다.', 'success');
      navigate('#/decks');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '컬렉션 가져오기에 실패했습니다.',
        'error'
      );
    } finally {
      setColpkgReplacing(false);
    }
  };

  const value = useMemo<AppContextValue>(
    () => ({
      info,
      prefs,
      prefTheme,
      resolvedTheme,
      setPref,
      setPrefs,
      syncStatus,
      syncProgress,
      mediaSyncProgress,
      updateProgress,
      refreshSyncStatus,
      startBackgroundSync,
      startMediaSync,
      abortMediaSync,
      openSyncSheet,
      closeSyncSheet,
      syncSheetOpen,
      openFullSyncDialog,
      closeFullSyncDialog,
      fullSyncOpen,
      openAddSheet,
      closeAddSheet,
      addSheetOpen,
      collectionVersion,
      bumpCollection,
      navigate,
      goBack,
      registerBackHandler,
      registerKeyHandler,
      setCardInputFocused,
      subscribeAnkiPage,
    }),
    [
      info,
      prefs,
      prefTheme,
      resolvedTheme,
      setPref,
      setPrefs,
      syncStatus,
      syncProgress,
      mediaSyncProgress,
      updateProgress,
      refreshSyncStatus,
      startBackgroundSync,
      startMediaSync,
      abortMediaSync,
      openSyncSheet,
      closeSyncSheet,
      syncSheetOpen,
      openFullSyncDialog,
      closeFullSyncDialog,
      fullSyncOpen,
      openAddSheet,
      closeAddSheet,
      addSheetOpen,
      collectionVersion,
      bumpCollection,
      navigate,
      goBack,
      registerBackHandler,
      registerKeyHandler,
      setCardInputFocused,
      subscribeAnkiPage,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <SheetOrDialog
        open={pendingColpkg !== null}
        onClose={() => {
          if (!colpkgReplacing) setPendingColpkg(null);
        }}
        title="컬렉션 바꾸기 (.colpkg)"
        subtitle={pendingColpkg?.name || pendingColpkg?.path}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={colpkgReplacing}
              onClick={() => setPendingColpkg(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={colpkgReplacing}
              onClick={handleConfirmColpkg}
            >
              {colpkgReplacing ? '가져오는 중...' : '백업 후 교체'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          <strong>{pendingColpkg?.name || '선택한 파일'}</strong>로 현재 전체 컬렉션을
          교체합니다. 교체하기 전에 현재 컬렉션의 안전 백업이 자동으로 생성됩니다.
        </p>
      </SheetOrDialog>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
