import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  type ActionMenuItem,
  ErrorState,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconDeck,
  IconDownload,
  IconEdit,
  IconFlame,
  IconFolder,
  IconMore,
  IconMove,
  IconPlay,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpark,
  IconTrash,
  IconUpload,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import {
  DailyProgressRing,
  DeckCategoryIcon,
  getPersonalGreeting,
  resolveDeckTheme,
} from './DeckBadge';
import { DeckOverviewPane } from './DeckOverviewPane';
import { ImportProgressSheet, importErrorMessage, useFileImport } from './ImportProgressSheet';
import './decks.css';

export interface DeckListViewProps {
  initialSelectedDeckId?: number;
}

interface FlatDeckRow {
  deckId: number;
  shortName: string;
  fullName: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  totalInDeck: number;
  totalIncludingChildren: number;
  filtered: boolean;
}

interface DeckGroup {
  root: FlatDeckRow;
  descendants: FlatDeckRow[];
}

function flattenDeckTree(
  node: anki.DeckTreeNode,
  depth = 0,
  parentFullName = '',
  out: FlatDeckRow[] = [],
  includeCollapsed = false
): FlatDeckRow[] {
  const children = (node.children ?? []) as anki.DeckTreeNode[];
  for (const child of children) {
    const id = anki.toNumber(child.deckId);
    const shortName = child.name ?? '';
    const fullName = parentFullName ? `${parentFullName}::${shortName}` : shortName;
    const grandChildren = (child.children ?? []) as anki.DeckTreeNode[];
    const hasChildren = grandChildren.length > 0;
    const collapsed = Boolean(child.collapsed);

    out.push({
      deckId: id,
      shortName,
      fullName,
      depth,
      hasChildren,
      collapsed,
      newCount: child.newCount ?? 0,
      learnCount: child.learnCount ?? 0,
      reviewCount: child.reviewCount ?? 0,
      totalInDeck: child.totalInDeck ?? 0,
      totalIncludingChildren: child.totalIncludingChildren ?? 0,
      filtered: Boolean(child.filtered),
    });

    if (hasChildren && (includeCollapsed || !collapsed)) {
      flattenDeckTree(child, depth + 1, fullName, out, includeCollapsed);
    }
  }
  return out;
}

function groupFlatDeckRows(rows: FlatDeckRow[]): DeckGroup[] {
  const groups: DeckGroup[] = [];
  for (const row of rows) {
    if (row.depth === 0 || groups.length === 0) {
      groups.push({ root: row, descendants: [] });
    } else {
      groups[groups.length - 1].descendants.push(row);
    }
  }
  return groups;
}

function getParentBreadcrumb(fullName: string): string | null {
  const parts = fullName.split('::');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(' › ');
}

function pickInitialSelectedDeck(rows: FlatDeckRow[], preferredId?: number): number | null {
  if (preferredId && rows.some((r) => r.deckId === preferredId)) {
    return preferredId;
  }
  const firstDue = rows.find((r) => r.newCount + r.learnCount + r.reviewCount > 0);
  if (firstDue) return firstDue.deckId;
  return rows[0]?.deckId ?? null;
}

/** Days of review history fetched for the streak; a longer streak shows as "N일+". */
const STREAK_WINDOW_DAYS = 60;

type DeckLoadMode = 'initial' | 'quiet' | 'user';

/** Whether the scroll container under `el` (or the page) is scrolled to the top. */
function isScrolledToTop(el: EventTarget | null): boolean {
  let node = el instanceof Element ? el : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const scrollable =
      /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    if (scrollable) return node.scrollTop <= 0;
    node = node.parentElement;
  }
  const pageTop = document.scrollingElement?.scrollTop ?? window.scrollY;
  return pageTop <= 0 && window.scrollY <= 0;
}

function setCollapsedInTree(
  node: anki.DeckTreeNode,
  deckId: number,
  collapsed: boolean
): anki.DeckTreeNode {
  const children = (node.children ?? []) as anki.DeckTreeNode[];
  let changed = false;
  const nextChildren = children.map((child) => {
    if (anki.toNumber(child.deckId) === deckId) {
      changed = true;
      return { ...child, collapsed } as anki.DeckTreeNode;
    }
    const next = setCollapsedInTree(child, deckId, collapsed);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? ({ ...node, children: nextChildren } as anki.DeckTreeNode) : node;
}

function formatDurationKo(millis: number): string {
  const totalSecs = Math.max(0, Math.round(millis / 1000));
  if (totalSecs < 60) return `${totalSecs}초`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}시간 ${remMins}분` : `${hours}시간`;
}

export const DeckListView: React.FC<DeckListViewProps> = ({ initialSelectedDeckId }) => {
  const {
    info,
    resolvedTheme,
    collectionVersion,
    bumpCollection,
    navigate,
    openAddSheet,
    registerBackHandler,
  } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeRoot, setTreeRoot] = useState<anki.DeckTreeNode | null>(null);
  const [todayStats, setTodayStats] = useState<{
    answerCount: number;
    answerMillis: number;
    streakDays: number;
    /** The streak reaches the end of the fetched window, so it may be longer. */
    streakCapped: boolean;
  }>({
    answerCount: 0,
    answerMillis: 0,
    streakDays: 0,
    streakCapped: false,
  });
  // Decks answered in today (for the "완료" badge); null until known.
  const [studiedTodayIds, setStudiedTodayIds] = useState<Set<number> | null>(null);
  const [deckFilterQuery, setDeckFilterQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(
    initialSelectedDeckId ?? null
  );
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  // Action menu & modal states
  const [menuDeck, setMenuDeck] = useState<FlatDeckRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<FlatDeckRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<FlatDeckRow | null>(null);
  const [moveParentId, setMoveParentId] = useState<number>(0);
  const [subdeckParent, setSubdeckParent] = useState<FlatDeckRow | null>(null);
  const [subdeckName, setSubdeckName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FlatDeckRow | null>(null);

  // Empty state create/import helpers
  const [emptyCreateOpen, setEmptyCreateOpen] = useState(false);
  const [emptyDeckName, setEmptyDeckName] = useState('');
  const [busyModal, setBusyModal] = useState(false);

  // Custom study modal (triggered from Deck ActionMenu)
  const [customDeck, setCustomDeck] = useState<FlatDeckRow | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customAvail, setCustomAvail] = useState<{ newAvail: number; revAvail: number }>({
    newAvail: 0,
    revAvail: 0,
  });
  const [customPreset, setCustomPreset] = useState<
    'newLimitDelta' | 'reviewLimitDelta' | 'forgotDays' | 'reviewAheadDays' | 'previewDays'
  >('newLimitDelta');
  const [customValue, setCustomValue] = useState('10');

  // Export modal (triggered from Deck ActionMenu)
  const [exportDeck, setExportDeck] = useState<FlatDeckRow | null>(null);
  const [exportScheduling, setExportScheduling] = useState(true);
  const [exportMedia, setExportMedia] = useState(true);
  const [exportLegacy, setExportLegacy] = useState(false);
  const [exportResult, setExportResult] = useState<host.ExportResult | null>(null);

  // Pull-to-refresh state
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  // Long-press tracking
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // File input for empty-state import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileImport = useFileImport();
  const [colpkgConfirm, setColpkgConfirm] = useState<{ path: string; name: string } | null>(
    null
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsWide(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    if (initialSelectedDeckId !== undefined) {
      setSelectedDeckId(initialSelectedDeckId);
    }
  }, [initialSelectedDeckId]);

  const loadGenRef = useRef(0);
  const statsVersionRef = useRef<number | null>(null);
  const treeRootRef = useRef<anki.DeckTreeNode | null>(null);
  treeRootRef.current = treeRoot;
  const toastedErrorRef = useRef<string | null>(null);

  /**
   * - `initial`: first load / collection changed; shows the loading card only when empty.
   * - `quiet`: focus/visibility/collapse; deck tree only, no banner.
   * - `user`: pull-to-refresh, F5 or the refresh button; shows the refresh banner.
   * Review statistics (graphs over the whole collection) are fetched once per
   * collectionVersion, or on a user refresh.
   */
  const loadDecks = useCallback(
    async (mode: DeckLoadMode = 'initial') => {
      const gen = ++loadGenRef.current;
      if (mode === 'initial' && treeRootRef.current === null) setLoading(true);
      if (mode === 'user') setRefreshing(true);
      const wantStats = mode === 'user' || statsVersionRef.current !== collectionVersion;
      try {
        const [tree, g] = await Promise.all([
          anki.deckTree(),
          wantStats ? anki.graphs('', STREAK_WINDOW_DAYS).catch(() => null) : Promise.resolve(null),
        ]);
        if (gen !== loadGenRef.current) return;
        setTreeRoot(tree);
        setError(null);
        toastedErrorRef.current = null;
        if (wantStats && g) {
          statsVersionRef.current = collectionVersion;
          const countMap = g.reviews?.count ?? {};
          const dayTotal = (offset: number) => {
            const entry = countMap[String(offset)];
            if (!entry) return 0;
            return (
              (entry.learn ?? 0) +
              (entry.relearn ?? 0) +
              (entry.young ?? 0) +
              (entry.mature ?? 0) +
              (entry.filtered ?? 0)
            );
          };
          let streak = 0;
          let cursor = dayTotal(0) > 0 ? 0 : -1;
          const oldest = -(STREAK_WINDOW_DAYS - 1);
          while (cursor >= oldest && dayTotal(cursor) > 0) {
            streak++;
            cursor--;
          }
          const answerCount = g.today?.answerCount ?? 0;
          setTodayStats({
            answerCount,
            answerMillis: g.today?.answerMillis ?? 0,
            streakDays: streak,
            streakCapped: cursor < oldest,
          });
          if (answerCount > 0) {
            const ids = flattenDeckTree(tree, 0, '', [], true).map((r) => r.deckId);
            void anki
              .decksStudiedToday(ids)
              .then((set) => setStudiedTodayIds(set))
              .catch(() => setStudiedTodayIds(null));
          } else {
            setStudiedTodayIds(new Set());
          }
        }
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        const message = err instanceof Error ? err.message : '덱 목록을 불러오지 못했습니다.';
        setError(message);
        // With rows on screen the error card is not shown; tell the owner once.
        if (treeRootRef.current !== null && toastedErrorRef.current !== message) {
          toastedErrorRef.current = message;
          showToast(`덱 목록을 새로 고치지 못했습니다: ${message}`, 'error');
        }
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [collectionVersion, showToast]
  );

  useEffect(() => {
    void loadDecks('initial');
  }, [collectionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh counts when tab/window regains focus (deck tree only)
  useEffect(() => {
    const onFocus = () => {
      void loadDecks('quiet');
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void loadDecks('quiet');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        void loadDecks('user');
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [loadDecks]);

  // Register back handler for open sheets/modals
  useEffect(() => {
    if (
      !menuDeck &&
      !renameTarget &&
      !moveTarget &&
      !subdeckParent &&
      !deleteTarget &&
      !customDeck &&
      !exportDeck &&
      !emptyCreateOpen &&
      !colpkgConfirm
    ) {
      return;
    }
    return registerBackHandler(() => {
      if (busyModal) return true;
      if (colpkgConfirm) {
        setColpkgConfirm(null);
        return true;
      }
      if (emptyCreateOpen) {
        setEmptyCreateOpen(false);
        return true;
      }
      if (exportDeck) {
        setExportDeck(null);
        return true;
      }
      if (customDeck) {
        setCustomDeck(null);
        return true;
      }
      if (deleteTarget) {
        setDeleteTarget(null);
        return true;
      }
      if (subdeckParent) {
        setSubdeckParent(null);
        return true;
      }
      if (moveTarget) {
        setMoveTarget(null);
        return true;
      }
      if (renameTarget) {
        setRenameTarget(null);
        return true;
      }
      if (menuDeck) {
        setMenuDeck(null);
        return true;
      }
      return false;
    });
  }, [
    menuDeck,
    renameTarget,
    moveTarget,
    subdeckParent,
    deleteTarget,
    customDeck,
    exportDeck,
    emptyCreateOpen,
    colpkgConfirm,
    busyModal,
    registerBackHandler,
  ]);

  const rows = useMemo(
    () => (treeRoot ? flattenDeckTree(treeRoot, 0, '', [], false) : []),
    [treeRoot]
  );

  const allRows = useMemo(
    () => (treeRoot ? flattenDeckTree(treeRoot, 0, '', [], true) : []),
    [treeRoot]
  );

  // Maintain selectedDeckId for wide 2-pane layout
  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedDeckId || !allRows.some((r) => r.deckId === selectedDeckId)) {
      setSelectedDeckId(pickInitialSelectedDeck(rows, initialSelectedDeckId));
    }
  }, [rows, allRows, selectedDeckId, initialSelectedDeckId]);

  const topLevelNodes = useMemo(
    () => ((treeRoot?.children ?? []) as anki.DeckTreeNode[]),
    [treeRoot]
  );

  const totalDue = useMemo(
    () =>
      topLevelNodes.reduce(
        (sum, n) => sum + (n.newCount ?? 0) + (n.learnCount ?? 0) + (n.reviewCount ?? 0),
        0
      ),
    [topLevelNodes]
  );

  const totalCardsAll = useMemo(
    () => topLevelNodes.reduce((sum, n) => sum + (n.totalIncludingChildren ?? 0), 0),
    [topLevelNodes]
  );

  const handleRowTap = async (row: FlatDeckRow) => {
    if (isWide) {
      setSelectedDeckId(row.deckId);
      return;
    }
    const rowDue = row.newCount + row.learnCount + row.reviewCount;
    if (rowDue > 0) {
      try {
        await anki.setCurrentDeck(row.deckId);
      } catch {
        // Proceed to study route even if setCurrentDeck fails silently
      }
      navigate(`#/study/${row.deckId}`);
    } else {
      navigate(`#/deck/${row.deckId}`);
    }
  };

  const handleToggleCollapse = async (e: React.MouseEvent, row: FlatDeckRow) => {
    e.stopPropagation();
    const nextCollapsed = !row.collapsed;
    // Optimistic: flip the row now so the list does not jump under the finger.
    setTreeRoot((prev) => (prev ? setCollapsedInTree(prev, row.deckId, nextCollapsed) : prev));
    try {
      await anki.setDeckCollapsed(row.deckId, nextCollapsed, anki.SetDeckCollapsedScope.REVIEWER);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱 접기 상태를 바꾸지 못했습니다.',
        'error'
      );
      void loadDecks('quiet');
    }
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (row: FlatDeckRow) => {
    cancelLongPress();
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setMenuDeck(row);
    }, 480);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showToast('새 이름을 입력해 주세요.', 'error');
      return;
    }
    setBusyModal(true);
    try {
      await anki.renameDeck(renameTarget.deckId, trimmed);
      setRenameTarget(null);
      bumpCollection();
      showToast('덱 이름을 변경했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱 이름을 변경하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleCreateSubdeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdeckParent) return;
    const trimmed = subdeckName.trim();
    if (!trimmed) {
      showToast('하위 덱 이름을 입력해 주세요.', 'error');
      return;
    }
    const targetFullName = trimmed.includes('::')
      ? trimmed
      : `${subdeckParent.fullName}::${trimmed}`;
    setBusyModal(true);
    try {
      await anki.createSimpleDeck(targetFullName);
      if (subdeckParent.collapsed) {
        await anki.setDeckCollapsed(
          subdeckParent.deckId,
          false,
          anki.SetDeckCollapsedScope.REVIEWER
        ).catch(() => undefined);
      }
      setSubdeckParent(null);
      setSubdeckName('');
      bumpCollection();
      showToast(`'${targetFullName}' 하위 덱을 만들었습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '하위 덱을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleMoveDeckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    setBusyModal(true);
    try {
      await anki.reparentDecks([moveTarget.deckId], moveParentId);
      const movedName = moveTarget.shortName;
      setMoveTarget(null);
      bumpCollection();
      showToast(`'${movedName}' 덱의 위치를 변경했습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱을 이동하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyModal(true);
    try {
      await anki.removeDecks([deleteTarget.deckId]);
      const deletedName = deleteTarget.shortName;
      if (selectedDeckId === deleteTarget.deckId) {
        setSelectedDeckId(null);
      }
      setDeleteTarget(null);
      bumpCollection();
      showToast(`'${deletedName}' 덱을 삭제했습니다.`, 'success', {
        label: '되돌리기',
        onClick: async () => {
          try {
            await anki.undo();
            bumpCollection();
            showToast('덱 삭제를 되돌렸습니다.', 'info');
          } catch {
            showToast('되돌리지 못했습니다.', 'error');
          }
        },
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱을 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const openQuickCustomStudy = async (row: FlatDeckRow) => {
    setCustomDeck(row);
    setCustomPreset('newLimitDelta');
    setCustomValue('10');
    setCustomLoading(true);
    try {
      const defaults = await anki.customStudyDefaults(row.deckId);
      setCustomAvail({
        newAvail: defaults.availableNew ?? 0,
        revAvail: defaults.availableReview ?? 0,
      });
      setCustomValue(String(Math.max(1, defaults.extendNew || 10)));
    } catch {
      setCustomAvail({ newAvail: 0, revAvail: 0 });
    } finally {
      setCustomLoading(false);
    }
  };

  const handleSubmitQuickCustom = async () => {
    if (!customDeck) return;
    const parsed = Math.floor(Number(customValue.trim()));
    if (!customValue.trim() || !Number.isFinite(parsed) || parsed < 1) {
      showToast('1 이상의 숫자를 입력해 주세요.', 'error');
      return;
    }
    setBusyModal(true);
    try {
      const val = Math.min(9999, parsed);
      const req: Parameters<typeof anki.customStudy>[0] =
        customPreset === 'newLimitDelta'
          ? { deckId: customDeck.deckId, newLimitDelta: val }
          : customPreset === 'reviewLimitDelta'
            ? { deckId: customDeck.deckId, reviewLimitDelta: val }
            : customPreset === 'forgotDays'
              ? { deckId: customDeck.deckId, forgotDays: val }
              : customPreset === 'reviewAheadDays'
                ? { deckId: customDeck.deckId, reviewAheadDays: val }
                : { deckId: customDeck.deckId, previewDays: val };

      await anki.customStudy(req);
      const targetId = customDeck.deckId;
      setCustomDeck(null);
      bumpCollection();
      if (customPreset === 'newLimitDelta' || customPreset === 'reviewLimitDelta') {
        await anki.setCurrentDeck(targetId);
        navigate(`#/study/${targetId}`);
      } else {
        showToast('맞춤 학습 세션을 만들었습니다.', 'success');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습을 시작하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleRunExport = async () => {
    if (!exportDeck) return;
    setBusyModal(true);
    try {
      const res = await host.host.exportPackage({
        deckId: exportDeck.deckId,
        withScheduling: exportScheduling,
        withMedia: exportMedia,
        legacy: exportLegacy,
      });
      setExportResult(res);
      showToast(`내보내기 준비 완료 (${res.notes ?? 0}개 노트)`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '내보내기에 실패했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleEmptyCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emptyDeckName.trim();
    if (!trimmed) {
      showToast('덱 이름을 입력해 주세요.', 'error');
      return;
    }
    setBusyModal(true);
    try {
      await anki.createSimpleDeck(trimmed);
      setEmptyCreateOpen(false);
      setEmptyDeckName('');
      bumpCollection();
      showToast(`'${trimmed}' 덱을 만들었습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const handleEmptyImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const outcome = await fileImport.run(file);
      if (outcome.kind === 'colpkgConfirm') {
        setColpkgConfirm({ path: outcome.path, name: outcome.name });
      } else if (outcome.kind === 'route') {
        navigate(`#${outcome.route}`);
      }
    } catch (err) {
      showToast(importErrorMessage(err), 'error');
    }
  };

  const buildMenuItems = (row: FlatDeckRow): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        id: 'study',
        label: '학습 시작',
        icon: <IconPlay size={18} />,
        onSelect: () => {
          void anki.setCurrentDeck(row.deckId).finally(() => {
            navigate(`#/study/${row.deckId}`);
          });
        },
      },
      {
        id: 'overview',
        label: '덱 정보 보기',
        icon: <IconDeck size={18} />,
        onSelect: () => {
          if (isWide) {
            setSelectedDeckId(row.deckId);
          } else {
            navigate(`#/deck/${row.deckId}`);
          }
        },
      },
    ];

    if (row.filtered) {
      items.push(
        {
          id: 'rebuild',
          label: '다시 만들기',
          icon: <IconRefresh size={18} />,
          onSelect: () => {
            void anki
              .rebuildFilteredDeck(row.deckId)
              .then(() => {
                bumpCollection();
                showToast('맞춤 학습 덱을 다시 만들었습니다.', 'success');
              })
              .catch((err) =>
                showToast(
                  err instanceof Error ? err.message : '다시 만들지 못했습니다.',
                  'error'
                )
              );
          },
        },
        {
          id: 'empty',
          label: '비우기',
          icon: <IconClose size={18} />,
          onSelect: () => {
            void anki
              .emptyFilteredDeck(row.deckId)
              .then(() => {
                bumpCollection();
                showToast('맞춤 학습 덱을 비웠습니다.', 'success');
              })
              .catch((err) =>
                showToast(
                  err instanceof Error ? err.message : '비우지 못했습니다.',
                  'error'
                )
              );
          },
        }
      );
    } else {
      items.push(
        {
          id: 'options',
          label: '덱 설정',
          icon: <IconSettings size={18} />,
          onSelect: () => navigate(`#/deck-options/${row.deckId}`),
        },
        {
          id: 'custom',
          label: '맞춤 학습',
          icon: <IconSpark size={18} />,
          onSelect: () => void openQuickCustomStudy(row),
        },
        {
          id: 'subdeck',
          label: '하위 덱 만들기',
          icon: <IconFolder size={18} />,
          onSelect: () => {
            setSubdeckParent(row);
            setSubdeckName('');
          },
        }
      );
    }

    items.push(
      {
        id: 'rename',
        label: '이름 바꾸기',
        icon: <IconEdit size={18} />,
        onSelect: () => {
          setRenameTarget(row);
          setRenameValue(row.fullName);
        },
      },
      {
        id: 'move',
        label: '상위 덱 이동',
        description: '다른 덱 아래로 옮기거나 최상위로 꺼냅니다',
        icon: <IconMove size={18} />,
        onSelect: () => {
          setMoveTarget(row);
          setMoveParentId(0);
        },
      },
      {
        id: 'browse',
        label: '카드 찾아보기',
        icon: <IconSearch size={18} />,
        onSelect: () =>
          navigate(`#/browse?q=${encodeURIComponent(`deck:"${row.fullName}"`)}`),
      },
      {
        id: 'export',
        label: '내보내기 (.apkg)',
        icon: <IconDownload size={18} />,
        onSelect: () => {
          setExportDeck(row);
          setExportResult(null);
        },
      },
      {
        id: 'delete',
        label: '삭제',
        icon: <IconTrash size={18} />,
        destructive: true,
        onSelect: () => setDeleteTarget(row),
      }
    );

    return items;
  };

  const firstDueDeck = useMemo(
    () => rows.find((r) => r.newCount + r.learnCount + r.reviewCount > 0) ?? null,
    [rows]
  );

  const deckGroups = useMemo(() => groupFlatDeckRows(rows), [rows]);

  const isFiltering = deckFilterQuery.trim().length > 0;

  const filteredRows = useMemo(() => {
    const q = deckFilterQuery.trim().toLowerCase();
    if (!q) return [];
    return allRows.filter(
      (r) =>
        r.shortName.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q)
    );
  }, [allRows, deckFilterQuery]);

  const anyHasChildren = useMemo(() => rows.some((r) => r.hasChildren), [rows]);

  // Compact, Serene Today Focus Header Card
  const renderSummaryCard = () => {
    const todayTotalGoal = todayStats.answerCount + totalDue;
    // Nothing due and nothing studied: there is no goal, so no "100%".
    const progressPct =
      todayTotalGoal > 0
        ? Math.min(100, Math.round((todayStats.answerCount / todayTotalGoal) * 100))
        : null;
    const allDone = totalDue === 0 && todayStats.answerCount > 0;
    const greeting = getPersonalGreeting(totalDue, todayStats.answerCount);

    let statSummary: string;
    if (totalDue > 0) {
      statSummary =
        todayStats.answerCount > 0
          ? `남은 ${totalDue.toLocaleString()}장 · 오늘 ${todayStats.answerCount.toLocaleString()}장 완료`
          : `남은 ${totalDue.toLocaleString()}장`;
    } else if (todayStats.answerCount > 0) {
      statSummary = `오늘 ${todayStats.answerCount.toLocaleString()}장 완료 · ${formatDurationKo(todayStats.answerMillis)}`;
    } else {
      statSummary = '새 카드를 추가하거나 덱을 가져와 시작해 보세요';
    }

    return (
      <section className="amgi-summary-card" aria-label="오늘의 학습 요약">
        <div className="amgi-summary-lead">
          <DailyProgressRing pct={progressPct} done={allDone} size={48} />

          <div className="amgi-summary-body">
            <div className="amgi-summary-title-row">
              <span className="amgi-summary-primary">{greeting}</span>
              {todayStats.streakDays > 0 && (
                <span
                  className="amgi-streak-pill"
                  title={
                    todayStats.streakCapped
                      ? `${todayStats.streakDays}일 이상 연속 학습`
                      : `${todayStats.streakDays}일 연속 학습`
                  }
                >
                  <IconFlame size={11} />
                  <span>
                    {todayStats.streakDays}일{todayStats.streakCapped ? '+' : ''}
                  </span>
                </span>
              )}
            </div>
            <div className="amgi-summary-secondary tabular">{statSummary}</div>
          </div>
        </div>

        <div className="amgi-summary-actions">
          {firstDueDeck ? (
            <button
              type="button"
              className="amgi-btn amgi-btn-primary amgi-summary-play-btn"
              onClick={() => {
                void anki.setCurrentDeck(firstDueDeck.deckId).finally(() => {
                  navigate(`#/study/${firstDueDeck.deckId}`);
                });
              }}
            >
              <IconPlay size={15} />
              <span>학습 시작</span>
            </button>
          ) : (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-summary-play-btn"
              onClick={() => openAddSheet()}
            >
              <IconEdit size={15} />
              <span>노트 추가</span>
            </button>
          )}
          <button
            type="button"
            className="amgi-summary-refresh-btn"
            onClick={() => void loadDecks('user')}
            aria-label="카운트 새로고침"
            title="카운트 새로고침"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </section>
    );
  };

  const renderDeckRow = (
    row: FlatDeckRow,
    mode: 'root' | 'child' | 'search',
    showChevronSlot: boolean
  ) => {
    const isSelected = isWide && selectedDeckId === row.deckId;
    const rowDue = row.newCount + row.learnCount + row.reviewCount;
    const themeMeta = resolveDeckTheme(row.fullName);
    const breadcrumb = mode === 'search' ? getParentBreadcrumb(row.fullName) : null;

    let rowVariantClass = 'amgi-deck-row--root';
    let indentStyle: React.CSSProperties | undefined;
    if (mode === 'search') {
      rowVariantClass = 'amgi-deck-row--search';
    } else if (mode === 'child') {
      const clampedDepth = Math.min(Math.max(row.depth - 1, 0), 3);
      const indentPx = 20 + clampedDepth * 16;
      indentStyle = { '--deck-indent': `${indentPx}px` } as React.CSSProperties;
      rowVariantClass =
        row.depth === 1
          ? 'amgi-deck-row--child amgi-deck-row--d1'
          : row.depth === 2
            ? 'amgi-deck-row--child amgi-deck-row--d2'
            : 'amgi-deck-row--child amgi-deck-row--deep';
    }

    // "완료" only for a deck with cards that was actually studied today; an empty deck or
    // one with nothing scheduled today gets a muted dash.
    const doneToday =
      rowDue === 0 && row.totalIncludingChildren > 0 && Boolean(studiedTodayIds?.has(row.deckId));
    const countsAria =
      rowDue > 0
        ? `새 카드 ${row.newCount}장, 학습 중 ${row.learnCount}장, 복습 ${row.reviewCount}장`
        : doneToday
          ? '오늘 학습 완료'
          : row.totalIncludingChildren === 0
            ? '카드 없음'
            : '오늘 학습할 카드 없음';

    return (
      <div
        key={row.deckId}
        role="listitem"
        tabIndex={0}
        data-deck-id={row.deckId}
        className={`amgi-deck-row ${rowVariantClass} ${isSelected ? 'is-selected' : ''}`}
        style={indentStyle}
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          void handleRowTap(row);
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            void handleRowTap(row);
          }
        }}
        onTouchStart={() => startLongPress(row)}
        onTouchMove={cancelLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuDeck(row);
        }}
      >
        <div className="amgi-deck-row-left">
          {mode === 'root' && (
            <span
              className={`amgi-deck-emblem amgi-deck-emblem--${
                row.filtered ? 'blue' : themeMeta.tone
              }`}
              aria-hidden="true"
            >
              {row.filtered ? (
                <IconSpark size={15} />
              ) : (
                <DeckCategoryIcon deckName={row.fullName} size={16} />
              )}
            </span>
          )}

          {mode === 'child' && row.depth >= 2 && (
            <span
              className={`amgi-deck-depth-dot ${row.depth >= 3 ? 'is-deep' : ''}`}
              aria-hidden="true"
            />
          )}

          <div className="amgi-deck-row-text">
            {breadcrumb && <span className="amgi-deck-breadcrumb">{breadcrumb}</span>}
            <div className="amgi-deck-title-wrap">
              <span
                className={`amgi-deck-title ${
                  row.filtered ? 'amgi-deck-title-filtered' : ''
                }`}
              >
                {row.shortName}
              </span>
              {row.filtered && <span className="amgi-filtered-pill">맞춤</span>}
            </div>
          </div>
        </div>

        <div className="amgi-deck-row-right">
          <div className="amgi-deck-counts tabular" aria-label={countsAria}>
            {rowDue === 0 ? (
              doneToday ? (
                <span className="amgi-deck-done-badge">
                  <IconCheck size={11} />
                  <span>완료</span>
                </span>
              ) : (
                <span className="amgi-deck-none-dash" aria-hidden="true">
                  –
                </span>
              )
            ) : (
              <>
                <span
                  className={`amgi-deck-count amgi-deck-count--new ${
                    row.newCount === 0 ? 'is-zero' : ''
                  }`}
                >
                  {row.newCount}
                </span>
                <span
                  className={`amgi-deck-count amgi-deck-count--learn ${
                    row.learnCount === 0 ? 'is-zero' : ''
                  }`}
                >
                  {row.learnCount}
                </span>
                <span
                  className={`amgi-deck-count amgi-deck-count--review ${
                    row.reviewCount === 0 ? 'is-zero' : ''
                  }`}
                >
                  {row.reviewCount}
                </span>
              </>
            )}
          </div>

          <div className="amgi-deck-actions">
            {showChevronSlot &&
              (row.hasChildren ? (
                <button
                  type="button"
                  className={`amgi-deck-chevron ${!row.collapsed ? 'is-expanded' : ''}`}
                  aria-label={
                    row.collapsed ? `${row.shortName} 펼치기` : `${row.shortName} 접기`
                  }
                  aria-expanded={!row.collapsed}
                  onClick={(e) => void handleToggleCollapse(e, row)}
                >
                  <IconChevronRight size={16} />
                </button>
              ) : (
                <span className="amgi-deck-chevron-spacer" aria-hidden="true" />
              ))}

            <button
              type="button"
              className="amgi-deck-more-btn"
              aria-label={`${row.shortName} 덱 메뉴`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuDeck(row);
              }}
            >
              <IconMore size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeckTreeCard = () => {
    if (loading && rows.length === 0) {
      return (
        <div className="amgi-empty-card">
          <div className="amgi-empty-title">덱을 불러오는 중입니다...</div>
          <p className="amgi-empty-desc">잠시만 기다려 주세요.</p>
        </div>
      );
    }

    if (error && rows.length === 0) {
      return (
        <ErrorState
          title="덱 목록을 불러오지 못했습니다"
          message={error}
          onRetry={() => void loadDecks('initial')}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <div className="amgi-empty-card">
          <div className="amgi-empty-icon-wrap" aria-hidden="true">
            <IconDeck size={32} />
          </div>
          <h2 className="amgi-empty-title">아직 덱이 없습니다</h2>
          <p className="amgi-empty-desc">
            가지고 있는 Anki 파일(.apkg · .colpkg)을 불러오거나 새 덱을 만들어 시작해 보세요.
          </p>
          <div className="amgi-empty-actions">
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload size={18} />
              <span>파일 가져오기</span>
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              onClick={() => {
                setEmptyDeckName('');
                setEmptyCreateOpen(true);
              }}
            >
              <IconFolder size={18} />
              <span>새 덱 만들기</span>
            </button>
          </div>
        </div>
      );
    }

    const onlyEmptyDefault =
      rows.length === 1 && rows[0].deckId === 1 && totalCardsAll === 0;
    const showChevronSlot = !isFiltering && anyHasChildren;
    const deckCountDisplay = isFiltering ? filteredRows.length : allRows.length;

    return (
      <>
        {allRows.length >= 6 && (
          <div className="amgi-deck-filter-bar">
            <div className="amgi-deck-filter-input-wrap">
              <span className="amgi-deck-filter-icon" aria-hidden="true">
                <IconSearch size={15} />
              </span>
              <input
                type="search"
                className="amgi-deck-filter-input"
                value={deckFilterQuery}
                onChange={(e) => setDeckFilterQuery(e.target.value)}
                placeholder="암기장 이름으로 빠르게 찾기..."
                aria-label="덱 필터"
              />
              {isFiltering && (
                <button
                  type="button"
                  className="amgi-deck-filter-clear"
                  onClick={() => setDeckFilterQuery('')}
                  aria-label="검색어 지우기"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className={`amgi-deck-list-shell ${showChevronSlot ? 'has-chevrons' : ''}`}>
          <div className="amgi-deck-list-header">
            <div className="amgi-deck-section-left">
              <h2 className="amgi-deck-section-title">
                {isFiltering ? '검색 결과' : '내 암기장'}
              </h2>
              <span className="amgi-deck-section-count tabular">
                {!isFiltering && allRows.length > deckGroups.length
                  ? `총 ${deckCountDisplay}개`
                  : `${deckCountDisplay}개`}
              </span>
            </div>

            <div className="amgi-deck-legend-cols" aria-hidden="true">
              <span className="amgi-deck-legend-col">
                <span className="amgi-legend-dot amgi-legend-dot--new" />
                <span>새</span>
              </span>
              <span className="amgi-deck-legend-col">
                <span className="amgi-legend-dot amgi-legend-dot--learn" />
                <span>학습</span>
              </span>
              <span className="amgi-deck-legend-col">
                <span className="amgi-legend-dot amgi-legend-dot--review" />
                <span>복습</span>
              </span>
            </div>
          </div>

          <div className="amgi-deck-groups" role="list" aria-label="덱 목록">
            {isFiltering ? (
              filteredRows.length === 0 ? (
                <div className="amgi-deck-empty-search">
                  검색 조건과 일치하는 덱이 없습니다.
                </div>
              ) : (
                <div className="amgi-deck-group amgi-deck-group--search" role="presentation">
                  {filteredRows.map((row) => renderDeckRow(row, 'search', false))}
                </div>
              )
            ) : (
              deckGroups.map((group) => {
                const hasVisibleChildren = group.descendants.length > 0;
                return (
                  <div
                    key={group.root.deckId}
                    role="presentation"
                    className={`amgi-deck-group ${hasVisibleChildren ? 'is-expanded' : ''}`}
                  >
                    {renderDeckRow(group.root, 'root', showChevronSlot)}
                    {hasVisibleChildren && (
                      <div
                        className="amgi-deck-children"
                        role="group"
                        aria-label={`${group.root.shortName} 하위 덱`}
                      >
                        {group.descendants.map((child) =>
                          renderDeckRow(child, 'child', showChevronSlot)
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {onlyEmptyDefault && (
          <div className="amgi-onboarding-banner">
            <div className="amgi-summary-primary">처음 시작하시나요?</div>
            <p className="amgi-empty-desc" style={{ maxWidth: 'none', textAlign: 'left' }}>
              기존 Anki 덱 파일(.apkg · .colpkg)을 불러오거나 새 노트를 직접 추가해 학습을 시작해 보세요.
            </p>
            <div className="amgi-inline-row">
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload size={16} />
                <span>파일 가져오기</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-primary amgi-btn-sm"
                onClick={() => openAddSheet()}
              >
                <IconEdit size={16} />
                <span>추가 메뉴 열기</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="amgi-decks-page"
      onTouchStart={(e) => {
        // In the split layout the list scrolls inside .amgi-deck-split-left, not the page.
        if (e.touches.length === 1 && isScrolledToTop(e.target)) {
          touchStartYRef.current = e.touches[0].clientY;
        } else {
          touchStartYRef.current = null;
        }
      }}
      onTouchMove={(e) => {
        if (touchStartYRef.current === null || !isScrolledToTop(e.target)) {
          touchStartYRef.current = null;
          if (pullDistance !== 0) setPullDistance(0);
          return;
        }
        const dy = e.touches[0].clientY - touchStartYRef.current;
        if (dy > 28) {
          setPullDistance(Math.min(84, dy));
        } else if (dy < 0) {
          touchStartYRef.current = null;
          if (pullDistance !== 0) setPullDistance(0);
        }
      }}
      onTouchEnd={() => {
        if (pullDistance >= 64) {
          void loadDecks('user');
        }
        touchStartYRef.current = null;
        setPullDistance(0);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".apkg,.colpkg,.csv,.tsv,.txt,.zip"
        style={{ display: 'none' }}
        onChange={(e) => void handleEmptyImportFile(e)}
      />

      {(pullDistance > 24 || refreshing) && (
        <div className="amgi-ptr-banner">
          <IconRefresh size={16} />
          <span>
            {refreshing
              ? resolvedTheme === 'eink'
                ? '목록 새로고침 중'
                : '카운트를 새로고침하는 중...'
              : pullDistance >= 56
                ? '손을 놓으면 새로고침합니다'
                : '당겨서 새로고침'}
          </span>
        </div>
      )}

      {isWide ? (
        <div className="amgi-deck-split">
          <div className="amgi-deck-split-left">
            {renderSummaryCard()}
            {renderDeckTreeCard()}
          </div>
          <div className="amgi-deck-split-right">
            {selectedDeckId ? (
              <DeckOverviewPane deckId={selectedDeckId} />
            ) : (
              <div className="amgi-empty-card">
                <h2 className="amgi-empty-title">덱을 선택해 주세요</h2>
                <p className="amgi-empty-desc">
                  왼쪽 목록에서 덱을 고르면 요약과 빠른 학습 도구가 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {renderSummaryCard()}
          {renderDeckTreeCard()}
        </>
      )}

      <ImportProgressSheet state={fileImport.progress} />

      {/* Deck Row ActionMenu */}
      <ActionMenu
        open={menuDeck !== null}
        onClose={() => setMenuDeck(null)}
        title={menuDeck?.fullName ?? '덱 메뉴'}
        subtitle={
          menuDeck
            ? `총 ${menuDeck.totalIncludingChildren.toLocaleString()}장`
            : undefined
        }
        items={menuDeck ? buildMenuItems(menuDeck) : []}
      />

      {/* Rename Deck Modal */}
      <SheetOrDialog
        open={renameTarget !== null}
        onClose={() => {
          if (!busyModal) setRenameTarget(null);
        }}
        title="덱 이름 바꾸기"
        subtitle={renameTarget?.fullName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setRenameTarget(null)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-rename-deck-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
            >
              {busyModal ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <form
          id="amgi-rename-deck-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleRenameSubmit(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="rename-deck-input">
              새 덱 이름
            </label>
            <input
              id="rename-deck-input"
              type="text"
              className="amgi-input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <span className="amgi-field-hint">
              <code>::</code>를 사용해 상위 덱 경로를 함께 바꿀 수 있습니다.
            </span>
          </div>
        </form>
      </SheetOrDialog>

      {/* Move / Reparent Deck Modal */}
      <SheetOrDialog
        open={moveTarget !== null}
        onClose={() => {
          if (!busyModal) setMoveTarget(null);
        }}
        title="상위 덱 이동"
        subtitle={moveTarget?.fullName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setMoveTarget(null)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-move-deck-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
            >
              {busyModal ? '이동 중...' : '이동'}
            </button>
          </>
        }
      >
        <form
          id="amgi-move-deck-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleMoveDeckSubmit(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="move-deck-parent-select">
              이동할 상위 덱
            </label>
            <select
              id="move-deck-parent-select"
              className="amgi-select"
              value={moveParentId}
              onChange={(e) => setMoveParentId(Number(e.target.value))}
            >
              <option value={0}>최상위 (상위 덱 없음)</option>
              {allRows
                .filter(
                  (r) =>
                    !r.filtered &&
                    moveTarget &&
                    r.deckId !== moveTarget.deckId &&
                    !r.fullName.startsWith(`${moveTarget.fullName}::`)
                )
                .map((r) => (
                  <option key={r.deckId} value={r.deckId}>
                    {r.fullName}
                  </option>
                ))}
            </select>
          </div>
        </form>
      </SheetOrDialog>

      {/* Create Subdeck Modal */}
      <SheetOrDialog
        open={subdeckParent !== null}
        onClose={() => {
          if (!busyModal) setSubdeckParent(null);
        }}
        title="하위 덱 만들기"
        subtitle={subdeckParent ? `상위 덱: ${subdeckParent.fullName}` : undefined}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setSubdeckParent(null)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-subdeck-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
            >
              {busyModal ? '만드는 중...' : '만들기'}
            </button>
          </>
        }
      >
        <form
          id="amgi-subdeck-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleCreateSubdeck(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="subdeck-name-input">
              하위 덱 이름
            </label>
            <input
              id="subdeck-name-input"
              type="text"
              className="amgi-input"
              autoFocus
              value={subdeckName}
              onChange={(e) => setSubdeckName(e.target.value)}
              placeholder="예: 문법 또는 1단원"
            />
          </div>
        </form>
      </SheetOrDialog>

      {/* Delete Deck Confirmation Modal */}
      <SheetOrDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!busyModal) setDeleteTarget(null);
        }}
        title="덱 삭제"
        subtitle={deleteTarget?.fullName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={busyModal}
              onClick={() => void handleConfirmDelete()}
            >
              {busyModal ? '삭제 중...' : '삭제'}
            </button>
          </>
        }
      >
        {deleteTarget?.filtered ? (
          <p className="amgi-prose" style={{ margin: 0 }}>
            &apos;{deleteTarget.fullName}&apos; 맞춤 학습 덱을 삭제합니다. 이 덱의 카드{' '}
            <strong className="tabular">
              {deleteTarget.totalIncludingChildren.toLocaleString()}장
            </strong>
            은 삭제되지 않고 원래 덱으로 돌아갑니다.
          </p>
        ) : (
          <p className="amgi-prose" style={{ margin: 0 }}>
            &apos;{deleteTarget?.fullName}&apos; 덱과 포함된 카드{' '}
            <strong className="tabular">
              {(deleteTarget?.totalIncludingChildren ?? 0).toLocaleString()}장
            </strong>
            을 삭제합니다. 되돌리기(Ctrl+Z)로 복구할 수 있습니다.
          </p>
        )}
      </SheetOrDialog>

      {/* Quick Custom Study Modal (from Deck ActionMenu) */}
      <SheetOrDialog
        open={customDeck !== null}
        onClose={() => {
          if (!busyModal) setCustomDeck(null);
        }}
        title="맞춤 학습"
        subtitle={customDeck?.fullName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setCustomDeck(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal || customLoading}
              onClick={() => void handleSubmitQuickCustom()}
            >
              {busyModal ? '준비 중...' : '맞춤 학습 시작'}
            </button>
          </>
        }
      >
        {customLoading ? (
          <p className="amgi-empty-desc" style={{ textAlign: 'left' }}>
            선택지를 불러오는 중입니다...
          </p>
        ) : (
          <div className="amgi-modal-form">
            <button
              type="button"
              className={`amgi-radio-card ${customPreset === 'newLimitDelta' ? 'active' : ''}`}
              onClick={() => {
                setCustomPreset('newLimitDelta');
                setCustomValue('10');
              }}
            >
              <span className="amgi-radio-card-title">오늘 새 카드 더 공부하기</span>
              <span className="amgi-radio-card-desc">
                더 공부 가능: {customAvail.newAvail}장
              </span>
            </button>
            <button
              type="button"
              className={`amgi-radio-card ${customPreset === 'reviewLimitDelta' ? 'active' : ''}`}
              onClick={() => {
                setCustomPreset('reviewLimitDelta');
                setCustomValue('20');
              }}
            >
              <span className="amgi-radio-card-title">오늘 복습 카드 더 공부하기</span>
              <span className="amgi-radio-card-desc">
                더 공부 가능: {customAvail.revAvail}장
              </span>
            </button>
            <button
              type="button"
              className={`amgi-radio-card ${customPreset === 'forgotDays' ? 'active' : ''}`}
              onClick={() => {
                setCustomPreset('forgotDays');
                setCustomValue('1');
              }}
            >
              <span className="amgi-radio-card-title">최근 틀린 카드 다시 보기</span>
              <span className="amgi-radio-card-desc">최근 N일 내 틀린 카드 모아 복습</span>
            </button>
            <button
              type="button"
              className={`amgi-radio-card ${customPreset === 'reviewAheadDays' ? 'active' : ''}`}
              onClick={() => {
                setCustomPreset('reviewAheadDays');
                setCustomValue('1');
              }}
            >
              <span className="amgi-radio-card-title">미리 복습하기</span>
              <span className="amgi-radio-card-desc">N일 이내 복습할 카드 당겨서 보기</span>
            </button>
            <button
              type="button"
              className={`amgi-radio-card ${customPreset === 'previewDays' ? 'active' : ''}`}
              onClick={() => {
                setCustomPreset('previewDays');
                setCustomValue('1');
              }}
            >
              <span className="amgi-radio-card-title">최근 새 카드 미리 보기</span>
              <span className="amgi-radio-card-desc">일정 변경 없이 새 카드 훑어보기</span>
            </button>

            <div className="amgi-field-group">
              <label className="amgi-field-label" htmlFor="quick-cs-val">
                {customPreset === 'newLimitDelta' || customPreset === 'reviewLimitDelta'
                  ? '추가할 카드 수'
                  : '일수 (일)'}
              </label>
              <input
                id="quick-cs-val"
                type="number"
                min={1}
                max={9999}
                className="amgi-input tabular"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            </div>
          </div>
        )}
      </SheetOrDialog>

      {/* Export .apkg Modal (from Deck ActionMenu) */}
      <SheetOrDialog
        open={exportDeck !== null}
        onClose={() => {
          if (!busyModal) setExportDeck(null);
        }}
        title="덱 내보내기 (.apkg)"
        subtitle={exportDeck?.fullName}
        footer={
          exportResult ? (
            <>
              <a
                className="amgi-btn amgi-btn-primary"
                href={host.getHostDownloadUrl(exportResult.path, exportResult.name)}
                download={exportResult.name}
              >
                <IconDownload size={16} />
                <span>파일 저장</span>
              </a>
              {info?.platform === 'android' && (
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary"
                  onClick={() => {
                    void host.host
                      .platformShare({
                        path: exportResult.path,
                        name: exportResult.name,
                      })
                      .catch((err) =>
                        showToast(
                          err instanceof Error ? err.message : '공유하지 못했습니다.',
                          'error'
                        )
                      );
                  }}
                >
                  공유하기
                </button>
              )}
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => setExportDeck(null)}
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                disabled={busyModal}
                onClick={() => setExportDeck(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-primary"
                disabled={busyModal}
                onClick={() => void handleRunExport()}
              >
                {busyModal ? '만드는 중...' : '내보내기 파일 만들기'}
              </button>
            </>
          )
        }
      >
        {exportResult ? (
          <div className="amgi-congrats-box">
            <div className="amgi-inline-row">
              <IconCheck size={18} />
              <strong>{exportResult.name}</strong>
            </div>
            <p className="amgi-congrats-sub tabular">
              노트 {(exportResult.notes ?? 0).toLocaleString()}개 ·{' '}
              {(exportResult.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="amgi-modal-form">
            <div className="amgi-switch-row">
              <div>
                <div className="amgi-field-label">학습 기록 포함</div>
                <div className="amgi-field-hint">복습 날짜와 학습 횟수를 함께 저장합니다</div>
              </div>
              <Switch
                checked={exportScheduling}
                onChange={setExportScheduling}
                aria-label="학습 기록 포함"
              />
            </div>
            <div className="amgi-switch-row">
              <div>
                <div className="amgi-field-label">사진·음성 포함</div>
                <div className="amgi-field-hint">카드 안의 이미지와 오디오 파일을 묶습니다</div>
              </div>
              <Switch
                checked={exportMedia}
                onChange={setExportMedia}
                aria-label="사진·음성 포함"
              />
            </div>
            <div className="amgi-switch-row">
              <div>
                <div className="amgi-field-label">구버전 Anki 호환</div>
                <div className="amgi-field-hint">오래된 Anki 버전에서도 열 수 있게 저장합니다</div>
              </div>
              <Switch
                checked={exportLegacy}
                onChange={setExportLegacy}
                aria-label="구버전 Anki 호환"
              />
            </div>
          </div>
        )}
      </SheetOrDialog>

      {/* Empty State Create Deck Modal */}
      <SheetOrDialog
        open={emptyCreateOpen}
        onClose={() => {
          if (!busyModal) setEmptyCreateOpen(false);
        }}
        title="새 덱 만들기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setEmptyCreateOpen(false)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-empty-create-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
            >
              {busyModal ? '만드는 중...' : '만들기'}
            </button>
          </>
        }
      >
        <form
          id="amgi-empty-create-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleEmptyCreateDeck(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="empty-deck-name-input">
              덱 이름
            </label>
            <input
              id="empty-deck-name-input"
              type="text"
              className="amgi-input"
              autoFocus
              value={emptyDeckName}
              onChange={(e) => setEmptyDeckName(e.target.value)}
              placeholder="예: 일본어::한자"
            />
          </div>
        </form>
      </SheetOrDialog>

      {/* .colpkg confirm dialog (from empty state import) */}
      <SheetOrDialog
        open={colpkgConfirm !== null}
        onClose={() => {
          if (!busyModal) setColpkgConfirm(null);
        }}
        title="컬렉션 전체 덮어쓰기"
        subtitle={colpkgConfirm?.name}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setColpkgConfirm(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={busyModal}
              onClick={() => {
                if (!colpkgConfirm) return;
                setBusyModal(true);
                void host.host
                  .importFile({
                    path: colpkgConfirm.path,
                    name: colpkgConfirm.name,
                    replace: true,
                  })
                  .then(() => {
                    setColpkgConfirm(null);
                    bumpCollection();
                    showToast('전체 컬렉션을 불러왔습니다.', 'success');
                  })
                  .catch((err) =>
                    showToast(
                      err instanceof Error ? err.message : '컬렉션 가져오기에 실패했습니다.',
                      'error'
                    )
                  )
                  .finally(() => setBusyModal(false));
              }}
            >
              {busyModal ? '불러오는 중...' : '백업 후 가져오기'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          가져온 <code>.colpkg</code> 파일로 현재 기기의 모든 덱과 학습 기록을 바꿉니다.
          진행하기 전에 현재 데이터는 자동으로 안전 백업됩니다.
        </p>
      </SheetOrDialog>
    </div>
  );
};

export default DeckListView;
