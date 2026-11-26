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
  subscribeHostEvents,
  type HostInfo,
  type HostKeyEvent,
  type HostPrefs,
  type OpenFileEvent,
  type ProgressEvent,
  type SyncStatus,
} from '../host';
import { SheetOrDialog, useToast } from '../ui';

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
  refreshSyncStatus: () => Promise<void>;
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
  goBack: (fallback?: string) => void;
  registerBackHandler: (fn: () => boolean) => () => void;
  registerKeyHandler: (fn: (ev: HostKeyEvent) => boolean) => () => void;
}

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
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const [fullSyncOpen, setFullSyncOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const [pendingColpkg, setPendingColpkg] = useState<OpenFileEvent | null>(null);
  const [colpkgReplacing, setColpkgReplacing] = useState(false);

  const backHandlersRef = useRef<Set<() => boolean>>(new Set());
  const keyHandlersRef = useRef<Set<(ev: HostKeyEvent) => boolean>>(new Set());
  const autoSyncAttemptedRef = useRef(false);

  const bumpCollection = useCallback(() => {
    setCollectionVersion((v) => v + 1);
  }, []);

  const navigate = useCallback((hash: string) => {
    setAddSheetOpen(false);
    setSyncSheetOpen(false);
    const next = normalizeHashTarget(hash);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
  }, []);

  const goBack = useCallback((fallback = '#/decks') => {
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

  const setPrefs = useCallback(async (patch: Record<string, unknown>) => {
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
    const updated = await host.prefsSet(patch);
    setPrefsState(updated ?? {});
  }, []);

  const setPref = useCallback(
    async (key: string, value: unknown) => {
      await setPrefs({ [key]: value });
    },
    [setPrefs]
  );

  const refreshSyncStatus = useCallback(async () => {
    const status = await host.syncStatus();
    setSyncStatus(status);
  }, []);

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

    const bgHex = resolvedTheme === 'dark' ? '#161B24' : '#FFFFFF';
    const isLight = resolvedTheme !== 'dark';
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
      const isInputFocused = Boolean(
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
  }, [prefs, info?.eink]);

  // Initial load: info, prefs, syncStatus (+ conditional auto-sync)
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    Promise.all([
      host.info(controller.signal).catch(() => null),
      host.prefsGet(controller.signal).catch((): HostPrefs => ({})),
      host.syncStatus(controller.signal).catch(() => null),
    ]).then(([loadedInfo, loadedPrefs, loadedSync]) => {
      if (cancelled) return;
      if (loadedInfo) setInfo(loadedInfo);
      if (loadedPrefs) setPrefsState(loadedPrefs);
      if (loadedSync) setSyncStatus(loadedSync);

      if (
        !autoSyncAttemptedRef.current &&
        loadedSync &&
        loadedSync.loggedIn &&
        loadedPrefs['sync.auto'] === true &&
        !loadedSync.running &&
        !loadedSync.needsFullSync
      ) {
        autoSyncAttemptedRef.current = true;
        host
          .syncRun('normal')
          .then((res) => {
            if (cancelled) return;
            if (res.needsFullSync) {
              setFullSyncOpen(true);
            } else if (res.ok) {
              setCollectionVersion((v) => v + 1);
            }
          })
          .catch(() => {
            // Silently ignore startup auto-sync errors
          });
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Subscribe to host SSE stream
  useEffect(() => {
    const unsubscribe = subscribeHostEvents({
      syncState: (ev) => {
        setSyncStatus(ev);
      },
      progress: (ev) => {
        if (ev.op === 'sync') {
          if (ev.phase === 'done' || ev.phase === 'error') {
            setSyncProgress(null);
            if (ev.phase === 'done') {
              setCollectionVersion((v) => v + 1);
            }
          } else {
            setSyncProgress(ev);
          }
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
  }, [goBack, navigate]);

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
      refreshSyncStatus,
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
      refreshSyncStatus,
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
