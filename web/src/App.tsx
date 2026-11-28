import { useCallback, useEffect, useMemo, useState } from 'react';
import * as anki from './anki';
import { AppProvider, useApp } from './context/AppContext';
import { host, signalUiReady } from './host';
import {
  ActionMenu,
  type ActionMenuItem,
  IconArrowLeft,
  IconClose,
  IconDeck,
  IconMore,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpark,
  IconStats,
  IconSync,
  IconTag,
  IconUndo,
  IconUpload,
  SheetOrDialog,
  ToastProvider,
  useToast,
} from './ui';
import { DeckListView } from './components/decks/DeckListView';
import { DeckOverviewPane } from './components/decks/DeckOverviewPane';
import { AddActionSheet } from './components/decks/AddActionSheet';
import { StudyView } from './components/study/StudyView';
import { BrowserView } from './components/browser/BrowserView';
import { NoteEditorView } from './components/editor/NoteEditorView';
import { NoteTypeListView } from './components/notetypes/NoteTypeListView';
import { NoteTypeEditorView } from './components/notetypes/NoteTypeEditorView';
import { DeckOptionsView } from './components/options/DeckOptionsView';
import { StatsView } from './components/stats/StatsView';
import { SettingsView } from './components/settings/SettingsView';
import { SyncSheet } from './components/sync/SyncSheet';
import { formatMediaProgressText, formatSyncProgressText } from './components/sync/SyncCard';
import { FullSyncDialog } from './components/sync/FullSyncDialog';
import { AnkiIframeView } from './components/shared/AnkiIframeView';
import { TagManagerSheet } from './components/shared/TagManagerSheet';
import { CommandPalette } from './components/shared/CommandPalette';
import { EmptyCardsSummary } from './components/shared/EmptyCardsSummary';
import { useStartupUpdateCheck } from './useStartupUpdateCheck';
import { AppErrorBoundary, GlobalErrorToaster } from './ErrorBoundary';

type RootTab = 'decks' | 'browse' | 'stats' | 'settings';

type ParsedRoute =
  | { kind: 'decks' }
  | { kind: 'deck'; deckId: number }
  | { kind: 'study'; deckId: number }
  | { kind: 'browse'; query?: string }
  | { kind: 'noteNew'; deckId?: number }
  | { kind: 'noteEdit'; noteId: number }
  | { kind: 'notetypes' }
  | { kind: 'notetypeEdit'; notetypeId: number }
  | { kind: 'stats' }
  | { kind: 'deckOptions'; deckId: number }
  | { kind: 'settings' }
  | { kind: 'ankiIframe'; path: string; title: string };

function parseHashRoute(rawHash: string): ParsedRoute {
  const cleaned = rawHash.trim().replace(/^#/, '');
  if (!cleaned || cleaned === '/') {
    return { kind: 'decks' };
  }
  const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const qIdx = normalized.indexOf('?');
  const pathname = qIdx >= 0 ? normalized.slice(0, qIdx) : normalized;
  const searchStr = qIdx >= 0 ? normalized.slice(qIdx + 1) : '';
  const params = new URLSearchParams(searchStr);

  if (pathname === '/decks') {
    return { kind: 'decks' };
  }

  const deckMatch = /^\/deck\/(\d+)\/?$/.exec(pathname);
  if (deckMatch) {
    return { kind: 'deck', deckId: Number(deckMatch[1]) };
  }

  const studyMatch = /^\/study\/(\d+)\/?$/.exec(pathname);
  if (studyMatch) {
    return { kind: 'study', deckId: Number(studyMatch[1]) };
  }

  if (pathname === '/browse' || pathname === '/browse/') {
    const q = params.get('q') ?? undefined;
    return { kind: 'browse', query: q };
  }

  if (pathname === '/note/new' || pathname === '/note/new/') {
    const deckRaw = params.get('deck');
    const deckId = deckRaw && /^\d+$/.test(deckRaw) ? Number(deckRaw) : undefined;
    return { kind: 'noteNew', deckId };
  }

  const noteMatch = /^\/note\/(\d+)\/?$/.exec(pathname);
  if (noteMatch) {
    return { kind: 'noteEdit', noteId: Number(noteMatch[1]) };
  }

  if (pathname === '/notetypes' || pathname === '/notetypes/') {
    return { kind: 'notetypes' };
  }

  const ntMatch = /^\/notetype\/(\d+)\/?$/.exec(pathname);
  if (ntMatch) {
    return { kind: 'notetypeEdit', notetypeId: Number(ntMatch[1]) };
  }

  if (pathname === '/stats' || pathname === '/stats/') {
    return { kind: 'stats' };
  }

  const optsMatch = /^\/deck-options\/(\d+)\/?$/.exec(pathname);
  if (optsMatch) {
    return { kind: 'deckOptions', deckId: Number(optsMatch[1]) };
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return { kind: 'settings' };
  }

  if (pathname.startsWith('/card-info')) {
    return { kind: 'ankiIframe', path: normalized, title: '카드 상세 정보' };
  }
  if (pathname.startsWith('/import-anki-package')) {
    return { kind: 'ankiIframe', path: normalized, title: 'Anki 패키지 가져오기' };
  }
  if (pathname.startsWith('/import-csv')) {
    return { kind: 'ankiIframe', path: normalized, title: '텍스트/CSV 가져오기' };
  }
  if (pathname.startsWith('/import-page')) {
    return { kind: 'ankiIframe', path: normalized, title: '파일 가져오기' };
  }
  if (pathname.startsWith('/change-notetype')) {
    return { kind: 'ankiIframe', path: normalized, title: '노트 유형 바꾸기' };
  }
  if (pathname.startsWith('/image-occlusion')) {
    return { kind: 'ankiIframe', path: normalized, title: '이미지 가리기' };
  }
  if (pathname.startsWith('/anki/')) {
    const subPath = normalized.slice('/anki'.length);
    return { kind: 'ankiIframe', path: subPath, title: 'Anki 도구' };
  }

  return { kind: 'decks' };
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

function AppShell() {
  const {
    prefs,
    syncStatus,
    syncProgress,
    mediaSyncProgress,
    resolvedTheme,
    refreshSyncStatus,
    startBackgroundSync,
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
    bumpCollection,
    navigate,
    goBack,
  } = useApp();
  const { showToast } = useToast();

  const [hash, setHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash || '#/decks' : '#/decks'
  );
  const windowWidth = useWindowWidth();

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mediaBarDismissed, setMediaBarDismissed] = useState(false);
  const [emptyCardsReport, setEmptyCardsReport] = useState<anki.EmptyCardsReport | null>(
    null
  );
  const [checkingEmpty, setCheckingEmpty] = useState(false);
  const [cleaningEmpty, setCleaningEmpty] = useState(false);
  const [exportingColpkg, setExportingColpkg] = useState(false);

  const isCollectionSyncing = Boolean(syncStatus?.running);
  const isMediaSyncing = Boolean(syncStatus?.mediaRunning);

  // Tell the native shell (watchdog) that the UI mounted. Once per page load.
  useEffect(() => {
    signalUiReady();
  }, []);

  useEffect(() => {
    if (isMediaSyncing) {
      setMediaBarDismissed(false);
    }
  }, [isMediaSyncing]);

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash || '#/decks');
      closeAddSheet();
      closeSyncSheet();
      setOverflowOpen(false);
      setTagManagerOpen(false);
      setCommandOpen(false);
      setEmptyCardsReport(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [closeAddSheet, closeSyncSheet]);

  const route = useMemo(() => parseHashRoute(hash), [hash]);
  const isWideSplit = windowWidth >= 1024;
  const isStudy = route.kind === 'study';

  const handleGlobalUndo = useCallback(async () => {
    try {
      const status = await anki.undoStatus();
      if (!status.undo) {
        showToast('되돌릴 수 있는 작업이 없습니다.', 'info');
        return;
      }
      await anki.undo();
      bumpCollection();
      showToast(`되돌림: ${status.undo}`, 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '작업을 되돌리지 못했습니다.',
        'error'
      );
    }
  }, [bumpCollection, showToast]);

  const handleGlobalRedo = useCallback(async () => {
    try {
      const status = await anki.undoStatus();
      if (!status.redo) {
        showToast('다시 실행할 작업이 없습니다.', 'info');
        return;
      }
      await anki.redo();
      bumpCollection();
      showToast(`다시 실행: ${status.redo}`, 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '다시 실행하지 못했습니다.',
        'error'
      );
    }
  }, [bumpCollection, showToast]);

  // Global keyboard shortcuts: Ctrl+K Quick Switcher, Ctrl+Z / Ctrl+Shift+Z outside Study/inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const hasMod = e.ctrlKey || e.metaKey;
      if (hasMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (isStudy) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (hasMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        void handleGlobalUndo();
      } else if (
        (hasMod && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        (hasMod && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        void handleGlobalRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStudy, handleGlobalUndo, handleGlobalRedo]);

  // Determine whether the outer AppShell topbar should render (avoid double topbar!)
  const hasOwnTopbar =
    route.kind === 'noteNew' ||
    route.kind === 'noteEdit' ||
    route.kind === 'notetypes' ||
    route.kind === 'notetypeEdit' ||
    route.kind === 'deckOptions' ||
    route.kind === 'ankiIframe';

  const activeTab: RootTab | null = useMemo(() => {
    switch (route.kind) {
      case 'decks':
      case 'deck':
        return 'decks';
      case 'browse':
        return 'browse';
      case 'stats':
        return 'stats';
      case 'settings':
        return 'settings';
      default:
        return null;
    }
  }, [route.kind]);

  // Automatic update check once per launch; a UI bundle update reloads only while the
  // user is on a root tab (not studying or editing) with no sheet open.
  useStartupUpdateCheck(() => activeTab !== null);

  const showTopBar = !isStudy && !hasOwnTopbar;
  const showNavChrome = activeTab !== null;
  const isDecksRoot =
    route.kind === 'decks' || (route.kind === 'deck' && isWideSplit);
  const showFab = isDecksRoot && windowWidth < 840;

  const topbarMeta = useMemo(() => {
    switch (route.kind) {
      case 'decks':
        return { title: 'myAmgi', showBack: false };
      case 'deck':
        return isWideSplit
          ? { title: 'myAmgi', showBack: false }
          : { title: '덱 정보', showBack: true };
      case 'browse':
        return { title: '찾아보기', showBack: false };
      case 'stats':
        return { title: '통계', showBack: false };
      case 'settings':
        return { title: '설정', showBack: false };
      default:
        return { title: 'myAmgi', showBack: false };
    }
  }, [route.kind, isWideSplit]);

  const handleSyncPress = useCallback(async () => {
    let status = syncStatus;
    if (!status) {
      // Status not loaded yet (first call failed or still pending): fetch it before
      // deciding, instead of treating "unknown" as "logged out".
      try {
        status = await refreshSyncStatus();
      } catch (err) {
        showToast(
          err instanceof Error && err.message
            ? `동기화 상태를 확인하지 못했습니다: ${err.message}`
            : '동기화 상태를 확인하지 못했습니다.',
          'error'
        );
        return;
      }
    }
    const syncStatusNow = status;
    if (!syncStatusNow.loggedIn) {
      openSyncSheet();
      return;
    }
    if (syncStatusNow.running || syncStatusNow.mediaRunning) {
      openSyncSheet();
      return;
    }
    if (syncStatusNow.needsFullSync) {
      openFullSyncDialog();
      return;
    }
    if (syncStatusNow.lastError || syncStatusNow.mediaError) {
      openSyncSheet();
      return;
    }
    startBackgroundSync('normal');
  }, [
    syncStatus,
    refreshSyncStatus,
    showToast,
    openSyncSheet,
    openFullSyncDialog,
    startBackgroundSync,
  ]);

  const handleCheckEmptyCards = useCallback(async () => {
    if (checkingEmpty) return;
    setCheckingEmpty(true);
    try {
      const report = await anki.getEmptyCards();
      setEmptyCardsReport(report);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '빈 카드를 확인하지 못했습니다.',
        'error'
      );
    } finally {
      setCheckingEmpty(false);
    }
  }, [checkingEmpty, showToast]);

  const handleDeleteEmptyCards = useCallback(async () => {
    if (!emptyCardsReport || cleaningEmpty) return;
    if (anki.planEmptyCardsRemoval(emptyCardsReport).cardIds.length === 0) {
      setEmptyCardsReport(null);
      return;
    }
    setCleaningEmpty(true);
    try {
      // Keeps the first card of notes whose cards are all empty (Anki "keep notes").
      const plan = await anki.removeEmptyCards(emptyCardsReport);
      setEmptyCardsReport(null);
      bumpCollection();
      showToast(`빈 카드 ${plan.cardIds.length}장을 삭제했습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '빈 카드를 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setCleaningEmpty(false);
    }
  }, [emptyCardsReport, cleaningEmpty, bumpCollection, showToast]);

  const handleExportCollection = useCallback(async () => {
    if (exportingColpkg) return;
    setExportingColpkg(true);
    try {
      const res = await host.exportCollection({ withMedia: true });
      showToast(`전체 컬렉션을 내보냈습니다 (${res.name}).`, 'success');
      try {
        await host.platformShare({ path: res.path, name: res.name });
      } catch {
        const url = host.downloadUrl(res.path, res.name);
        window.open(url, '_blank', 'noopener');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '컬렉션을 내보내지 못했습니다.',
        'error'
      );
    } finally {
      setExportingColpkg(false);
    }
  }, [exportingColpkg, showToast]);

  const overflowItems = useMemo<ActionMenuItem[]>(
    () => [
      {
        id: 'undo',
        label: '방금 작업 되돌리기',
        description: '최근 덱/카드 변경을 취소합니다 (Ctrl+Z)',
        icon: <IconUndo size={18} />,
        onSelect: () => void handleGlobalUndo(),
      },
      {
        id: 'notetypes',
        label: '노트 유형 관리',
        description: '필드, 카드 템플릿 및 스타일 편집',
        icon: <IconSpark size={18} />,
        onSelect: () => navigate('#/notetypes'),
      },
      {
        id: 'tags',
        label: '태그 관리',
        description: '태그 검색, 이름 바꾸기, 미사용 태그 정리',
        icon: <IconTag size={18} />,
        onSelect: () => setTagManagerOpen(true),
      },
      {
        id: 'empty-cards',
        label: checkingEmpty ? '빈 카드 확인 중...' : '빈 카드 정리',
        description: '앞면이 비어 있는 카드를 찾아 삭제합니다',
        icon: <IconDeck size={18} />,
        disabled: checkingEmpty,
        onSelect: () => void handleCheckEmptyCards(),
      },
      {
        id: 'export-colpkg',
        label: exportingColpkg ? '내보내는 중...' : '전체 컬렉션 내보내기 (.colpkg)',
        description: '모든 덱, 학습 기록, 미디어를 하나로 백업',
        icon: <IconUpload size={18} />,
        disabled: exportingColpkg,
        onSelect: () => void handleExportCollection(),
      },
      {
        id: 'refresh',
        label: '새로고침',
        description: '덱 카운트와 화면을 다시 불러옵니다',
        icon: <IconRefresh size={18} />,
        onSelect: () => bumpCollection(),
      },
    ],
    [
      checkingEmpty,
      exportingColpkg,
      navigate,
      handleGlobalUndo,
      handleCheckEmptyCards,
      handleExportCollection,
      bumpCollection,
    ]
  );

  // Per-route boundary: a crashing screen shows an error card instead of a blank
  // page, and navigating elsewhere clears it.
  const renderRouteContent = () => (
    <AppErrorBoundary resetOnHashChange>{renderRouteSwitch()}</AppErrorBoundary>
  );

  const renderRouteSwitch = () => {
    switch (route.kind) {
      case 'decks':
        return <DeckListView />;
      case 'deck':
        if (isWideSplit) {
          return <DeckListView initialSelectedDeckId={route.deckId} />;
        }
        return <DeckOverviewPane deckId={route.deckId} standalone />;
      case 'study':
        return <StudyView deckId={route.deckId} />;
      case 'browse':
        return <BrowserView initialQuery={route.query} />;
      case 'noteNew':
        return <NoteEditorView defaultDeckId={route.deckId} />;
      case 'noteEdit':
        return <NoteEditorView noteId={route.noteId} />;
      case 'notetypes':
        return <NoteTypeListView />;
      case 'notetypeEdit':
        return <NoteTypeEditorView notetypeId={route.notetypeId} />;
      case 'stats':
        return <StatsView />;
      case 'deckOptions':
        return <DeckOptionsView deckId={route.deckId} />;
      case 'settings':
        return <SettingsView />;
      case 'ankiIframe':
        return <AnkiIframeView path={route.path} title={route.title} />;
    }
  };

  if (isStudy) {
    return (
      <>
        {renderRouteContent()}
        <AddActionSheet open={addSheetOpen} onClose={closeAddSheet} />
        <SyncSheet open={syncSheetOpen} onClose={closeSyncSheet} />
        <FullSyncDialog open={fullSyncOpen} onClose={closeFullSyncDialog} />
      </>
    );
  }

  const navTabs: Array<{ id: RootTab; label: string; hash: string; icon: typeof IconDeck }> = [
    { id: 'decks', label: '덱', hash: '#/decks', icon: IconDeck },
    { id: 'browse', label: '찾아보기', hash: '#/browse', icon: IconSearch },
    { id: 'stats', label: '통계', hash: '#/stats', icon: IconStats },
    { id: 'settings', label: '설정', hash: '#/settings', icon: IconSettings },
  ];

  const needsFullSync = Boolean(syncStatus?.needsFullSync);
  const hasSyncError = Boolean(syncStatus?.lastError);
  const hasMediaError = Boolean(syncStatus?.mediaError);
  const isLoggedOut = syncStatus !== null && !syncStatus.loggedIn;

  const syncAriaLabel = isCollectionSyncing
    ? '동기화 중'
    : isMediaSyncing
      ? '미디어 백그라운드 동기화 중'
      : needsFullSync
        ? '전체 동기화 필요'
        : hasSyncError
          ? '동기화 오류'
          : hasMediaError
            ? '미디어 동기화 오류'
            : isLoggedOut
              ? '동기화 로그인 필요'
              : '동기화';

  const showSyncBar =
    !syncSheetOpen &&
    (isCollectionSyncing || (isMediaSyncing && !mediaBarDismissed));
  const isMediaOnlyBar = !isCollectionSyncing && isMediaSyncing;

  const fullWidthContainer =
    route.kind === 'browse' ||
    route.kind === 'noteNew' ||
    route.kind === 'noteEdit' ||
    route.kind === 'notetypes' ||
    route.kind === 'notetypeEdit' ||
    route.kind === 'deckOptions' ||
    route.kind === 'ankiIframe';

  const emptyCardsPlan = anki.planEmptyCardsRemoval(emptyCardsReport);
  const emptyCardTotal = emptyCardsPlan.cardIds.length;

  return (
    <div className="amgi-shell" data-theme={resolvedTheme}>
      {showTopBar && (
        <header className="amgi-topbar">
          <div className="amgi-topbar-left">
            {topbarMeta.showBack ? (
              <button
                type="button"
                className="amgi-btn amgi-btn-ghost amgi-btn-icon"
                aria-label="뒤로 가기"
                onClick={() => goBack('#/decks')}
              >
                <IconArrowLeft size={20} />
              </button>
            ) : isDecksRoot ? (
              <span className="amgi-brand-mark" aria-hidden="true">
                <IconDeck size={15} />
              </span>
            ) : null}
            <h1 className="amgi-topbar-title">{topbarMeta.title}</h1>
          </div>

          <div className="amgi-topbar-right">
            {isDecksRoot && (
              <button
                type="button"
                className="amgi-btn amgi-btn-ghost amgi-btn-icon"
                aria-label="빠른 이동"
                title="빠른 이동 (Ctrl+K)"
                onClick={() => setCommandOpen(true)}
              >
                <IconSearch size={19} />
              </button>
            )}

            <button
              type="button"
              className={`amgi-sync-btn ${isCollectionSyncing ? 'is-syncing' : ''} ${
                isMediaOnlyBar ? 'is-media-syncing' : ''
              }`.trim()}
              aria-label={syncAriaLabel}
              onClick={() => void handleSyncPress()}
            >
              <IconSync size={19} />
              <span className="amgi-sync-chip">동기화 중</span>
              {!isCollectionSyncing && isMediaSyncing && (
                <span className="amgi-sync-dot is-media" aria-hidden="true" />
              )}
              {!isCollectionSyncing && !isMediaSyncing && hasSyncError && (
                <span className="amgi-sync-badge-error" aria-hidden="true">
                  !
                </span>
              )}
              {!isCollectionSyncing &&
                !isMediaSyncing &&
                !hasSyncError &&
                (needsFullSync || hasMediaError) && (
                  <span className="amgi-sync-dot is-warn" aria-hidden="true" />
                )}
              {!isCollectionSyncing &&
                !isMediaSyncing &&
                !hasSyncError &&
                !needsFullSync &&
                !hasMediaError &&
                isLoggedOut && <span className="amgi-sync-dot" aria-hidden="true" />}
            </button>

            {isDecksRoot && (
              <button
                type="button"
                className="amgi-btn amgi-btn-ghost amgi-btn-icon"
                aria-label="더보기 메뉴"
                onClick={() => setOverflowOpen(true)}
              >
                <IconMore size={20} />
              </button>
            )}
          </div>
        </header>
      )}

      {showSyncBar && (
        <div className="amgi-bg-sync-wrap">
          <div
            className={`amgi-bg-sync-bar ${isMediaOnlyBar ? 'amgi-bg-sync-bar--media' : ''}`.trim()}
            role="status"
            aria-live="polite"
          >
            <button
              type="button"
              className="amgi-bg-sync-bar-main"
              onClick={openSyncSheet}
              data-compact="true"
            >
              <span className="amgi-bg-sync-indicator" aria-hidden="true">
                {isCollectionSyncing ? (
                  <IconSync
                    size={14}
                    className={resolvedTheme === 'eink' ? undefined : 'amgi-spin'}
                  />
                ) : (
                  <span className="amgi-bg-sync-dot" />
                )}
              </span>
              <span className="amgi-bg-sync-bar-text">
                {isCollectionSyncing
                  ? formatSyncProgressText(syncStatus, syncProgress, mediaSyncProgress)
                  : formatMediaProgressText(syncStatus, mediaSyncProgress)}
              </span>
            </button>
            <div className="amgi-bg-sync-bar-actions">
              <button
                type="button"
                className="amgi-bg-sync-bar-stop"
                onClick={() => {
                  if (isCollectionSyncing) {
                    void host.syncAbort().catch(() => undefined);
                  } else {
                    void abortMediaSync();
                  }
                }}
                data-compact="true"
              >
                중단
              </button>
              {isMediaOnlyBar && (
                <button
                  type="button"
                  className="amgi-bg-sync-bar-hide"
                  onClick={() => setMediaBarDismissed(true)}
                  aria-label="미디어 동기화 상태 숨기기"
                  title="숨기기"
                  data-compact="true"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="amgi-shell-body">
        {showNavChrome && (
          <nav className="amgi-rail" aria-label="기본 탐색">
            <button
              type="button"
              className="amgi-rail-cta"
              onClick={openAddSheet}
              aria-label="추가"
            >
              <IconPlus size={20} />
              <span>추가</span>
            </button>

            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`amgi-nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigate(tab.hash)}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {fullWidthContainer ? (
          <main style={{ flex: 1, minWidth: 0, width: '100%' }}>
            {renderRouteContent()}
          </main>
        ) : (
          <main
            className={`amgi-main ${showFab ? 'amgi-main--with-fab' : ''}`.trim()}
          >
            {renderRouteContent()}
          </main>
        )}
      </div>

      {showNavChrome && (
        <nav className="amgi-bottomnav" aria-label="하단 탐색">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`amgi-nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(tab.hash)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {showFab && (
        <button
          type="button"
          className={`amgi-fab ${prefs['study.leftHanded'] === true ? 'amgi-fab--left' : ''}`.trim()}
          onClick={openAddSheet}
          aria-label="추가"
        >
          <IconPlus size={18} />
          <span>추가</span>
        </button>
      )}

      <ActionMenu
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        title="도구 및 관리"
        items={overflowItems}
      />

      <SheetOrDialog
        open={emptyCardsReport !== null}
        onClose={() => setEmptyCardsReport(null)}
        dismissible={!cleaningEmpty}
        title="빈 카드 정리"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={cleaningEmpty}
              onClick={() => setEmptyCardsReport(null)}
            >
              닫기
            </button>
            {emptyCardTotal > 0 && (
              <button
                type="button"
                className="amgi-btn amgi-btn-danger"
                disabled={cleaningEmpty}
                onClick={() => void handleDeleteEmptyCards()}
              >
                {cleaningEmpty
                  ? '삭제 중...'
                  : `빈 카드 ${emptyCardTotal}장 삭제`}
              </button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EmptyCardsSummary plan={emptyCardsPlan} />
          {emptyCardTotal > 0 && emptyCardsReport?.report && (
            <pre className="amgi-error-detail">{emptyCardsReport.report}</pre>
          )}
        </div>
      </SheetOrDialog>

      <AddActionSheet
        open={addSheetOpen}
        onClose={closeAddSheet}
        defaultDeckId={route.kind === 'deck' ? route.deckId : undefined}
      />
      <SyncSheet open={syncSheetOpen} onClose={closeSyncSheet} />
      <FullSyncDialog open={fullSyncOpen} onClose={closeFullSyncDialog} />
      <TagManagerSheet
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenTags={() => setTagManagerOpen(true)}
        onRunSync={() => void handleSyncPress()}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <GlobalErrorToaster />
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ToastProvider>
  );
}

export default App;
