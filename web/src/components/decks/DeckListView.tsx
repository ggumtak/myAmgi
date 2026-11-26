import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  type ActionMenuItem,
  ErrorState,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconDeck,
  IconDownload,
  IconEdit,
  IconFolder,
  IconMore,
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
import { DeckOverviewPane } from './DeckOverviewPane';
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

function flattenDeckTree(
  node: anki.DeckTreeNode,
  depth = 0,
  parentFullName = '',
  out: FlatDeckRow[] = []
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

    if (hasChildren && !collapsed) {
      flattenDeckTree(child, depth + 1, fullName, out);
    }
  }
  return out;
}

function pickInitialSelectedDeck(rows: FlatDeckRow[], preferredId?: number): number | null {
  if (preferredId && rows.some((r) => r.deckId === preferredId)) {
    return preferredId;
  }
  const firstDue = rows.find((r) => r.newCount + r.learnCount + r.reviewCount > 0);
  if (firstDue) return firstDue.deckId;
  return rows[0]?.deckId ?? null;
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
  const [todayStats, setTodayStats] = useState<{ answerCount: number; answerMillis: number }>({
    answerCount: 0,
    answerMillis: 0,
  });
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
  const [customValue, setCustomValue] = useState(10);

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

  const loadDecks = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading((prev) => (treeRoot === null ? true : prev));
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const [tree, g] = await Promise.all([
        anki.deckTree(),
        anki.graphs('', 1).catch(() => null),
      ]);
      setTreeRoot(tree);
      setTodayStats({
        answerCount: g?.today?.answerCount ?? 0,
        answerMillis: g?.today?.answerMillis ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '덱 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [treeRoot]);

  useEffect(() => {
    void loadDecks(false);
  }, [collectionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when tab/window regains focus
  useEffect(() => {
    const onFocus = () => {
      void loadDecks(true);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void loadDecks(true);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        void loadDecks(true);
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
    () => (treeRoot ? flattenDeckTree(treeRoot) : []),
    [treeRoot]
  );

  // Maintain selectedDeckId for wide 2-pane layout
  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedDeckId || !rows.some((r) => r.deckId === selectedDeckId)) {
      setSelectedDeckId(pickInitialSelectedDeck(rows, initialSelectedDeckId));
    }
  }, [rows, selectedDeckId, initialSelectedDeckId]);

  const topLevelNodes = useMemo(
    () => ((treeRoot?.children ?? []) as anki.DeckTreeNode[]),
    [treeRoot]
  );

  const anyTopHasChildren = useMemo(
    () => topLevelNodes.some((n) => (n.children ?? []).length > 0),
    [topLevelNodes]
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
    try {
      await anki.setDeckCollapsed(
        row.deckId,
        !row.collapsed,
        anki.SetDeckCollapsedScope.REVIEWER
      );
      await loadDecks(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱 접기 상태를 바꾸지 못했습니다.',
        'error'
      );
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
      showToast(`'${deletedName}' 덱을 삭제했습니다.`, 'success');
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
    setCustomValue(10);
    setCustomLoading(true);
    try {
      const defaults = await anki.customStudyDefaults(row.deckId);
      setCustomAvail({
        newAvail: defaults.availableNew ?? 0,
        revAvail: defaults.availableReview ?? 0,
      });
      setCustomValue(Math.max(1, defaults.extendNew || 10));
    } catch {
      setCustomAvail({ newAvail: 0, revAvail: 0 });
    } finally {
      setCustomLoading(false);
    }
  };

  const handleSubmitQuickCustom = async () => {
    if (!customDeck) return;
    setBusyModal(true);
    try {
      const val = Math.max(1, customValue);
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
      const uploaded = await host.uploadHostFile(file, file.name);
      const res = await host.host.importFile({ path: uploaded.path, name: file.name });
      if (res.kind === 'colpkg' && res.needsConfirm) {
        setColpkgConfirm({ path: res.path, name: file.name });
      } else if (res.route) {
        navigate(`#${res.route}`);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '파일을 가져오지 못했습니다.',
        'error'
      );
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

  // Summary text formatting in natural Korean
  const renderSummaryCard = () => {
    let primaryText: string;
    let secondaryText: string;
    if (totalDue > 0) {
      primaryText = `남은 카드 ${totalDue.toLocaleString()}장 · 오늘 ${todayStats.answerCount.toLocaleString()}장 완료`;
      secondaryText =
        todayStats.answerCount > 0
          ? `학습 시간 ${formatDurationKo(todayStats.answerMillis)}`
          : '지금 가볍게 복습을 시작해 보세요.';
    } else if (todayStats.answerCount > 0) {
      primaryText = `오늘 학습 완료 · ${todayStats.answerCount.toLocaleString()}장 복습`;
      secondaryText = `학습 시간 ${formatDurationKo(todayStats.answerMillis)}`;
    } else {
      primaryText = '오늘 남은 카드가 없습니다';
      secondaryText = '새 카드를 추가하거나 맞춤 학습을 열어 보세요.';
    }

    return (
      <section className="amgi-summary-card" aria-label="오늘의 학습 요약">
        <div className="amgi-summary-body">
          <div className="amgi-summary-eyebrow">
            <span>오늘의 학습</span>
          </div>
          <div className="amgi-summary-primary tabular">{primaryText}</div>
          <div className="amgi-summary-secondary tabular">{secondaryText}</div>
        </div>
        <button
          type="button"
          className="amgi-btn amgi-btn-ghost amgi-btn-icon amgi-summary-refresh"
          onClick={() => void loadDecks(true)}
          aria-label="카운트 새로고침"
          title="카운트 새로고침"
        >
          <IconRefresh size={18} />
        </button>
      </section>
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
          onRetry={() => void loadDecks(false)}
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
            가지고 있는 Anki 파일(.apkg)을 불러오거나 새 덱을 만들어 시작해 보세요.
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

    return (
      <>
        <div className="amgi-deck-tree-card" role="region" aria-label="덱 목록">
          <div className="amgi-deck-header-row" role="row">
            <div className="amgi-deck-header-col">덱</div>
            <div className="amgi-deck-header-col">새</div>
            <div className="amgi-deck-header-col">학습</div>
            <div className="amgi-deck-header-col">복습</div>
            <div className="amgi-deck-header-col" aria-hidden="true" />
          </div>

          {rows.map((row) => {
            const indentPx = Math.min(row.depth, 4) * 18;
            const isSelected = isWide && selectedDeckId === row.deckId;
            return (
              <div
                key={row.deckId}
                role="row"
                data-deck-id={row.deckId}
                className={`amgi-deck-row ${isSelected ? 'amgi-deck-row-selected' : ''}`}
                onClick={() => {
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  void handleRowTap(row);
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
                <div
                  className="amgi-deck-name-cell"
                  style={{ paddingLeft: `${indentPx}px` }}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className="amgi-deck-chevron compact"
                      aria-label={row.collapsed ? `${row.shortName} 펼치기` : `${row.shortName} 접기`}
                      aria-expanded={!row.collapsed}
                      onClick={(e) => void handleToggleCollapse(e, row)}
                    >
                      {row.collapsed ? (
                        <IconChevronRight size={16} />
                      ) : (
                        <IconChevronDown size={16} />
                      )}
                    </button>
                  ) : anyTopHasChildren || row.depth > 0 ? (
                    <span className="amgi-deck-chevron-spacer" aria-hidden="true" />
                  ) : null}

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

                <div
                  className={`amgi-deck-num tabular ${
                    row.newCount > 0 ? 'amgi-deck-num-new' : 'amgi-deck-num-zero'
                  }`}
                >
                  {row.newCount}
                </div>
                <div
                  className={`amgi-deck-num tabular ${
                    row.learnCount > 0 ? 'amgi-deck-num-learn' : 'amgi-deck-num-zero'
                  }`}
                >
                  {row.learnCount}
                </div>
                <div
                  className={`amgi-deck-num tabular ${
                    row.reviewCount > 0 ? 'amgi-deck-num-review' : 'amgi-deck-num-zero'
                  }`}
                >
                  {row.reviewCount}
                </div>

                <button
                  type="button"
                  className="amgi-deck-more-btn amgi-btn-icon"
                  aria-label={`${row.shortName} 덱 메뉴`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuDeck(row);
                  }}
                >
                  <IconMore size={18} />
                </button>
              </div>
            );
          })}
        </div>

        {onlyEmptyDefault && (
          <div className="amgi-onboarding-banner">
            <div className="amgi-summary-primary">처음 시작하시나요?</div>
            <p className="amgi-empty-desc" style={{ maxWidth: 'none', textAlign: 'left' }}>
              기존 Anki 덱 파일(.apkg)을 불러오거나 새 노트를 직접 추가해 학습을 시작해 보세요.
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
        if (window.scrollY <= 0 && e.touches.length === 1) {
          touchStartYRef.current = e.touches[0].clientY;
        } else {
          touchStartYRef.current = null;
        }
      }}
      onTouchMove={(e) => {
        if (touchStartYRef.current === null || window.scrollY > 0) return;
        const dy = e.touches[0].clientY - touchStartYRef.current;
        if (dy > 16) {
          setPullDistance(Math.min(84, dy));
        }
      }}
      onTouchEnd={() => {
        if (pullDistance >= 56) {
          void loadDecks(true);
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
        <p className="amgi-prose" style={{ margin: 0 }}>
          &apos;{deleteTarget?.fullName}&apos; 덱과 포함된 카드{' '}
          <strong className="tabular">
            {(deleteTarget?.totalIncludingChildren ?? 0).toLocaleString()}장
          </strong>
          을 삭제합니다. 되돌리기(Ctrl+Z)로 복구할 수 있습니다.
        </p>
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
                setCustomValue(10);
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
                setCustomValue(20);
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
                setCustomValue(1);
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
                setCustomValue(1);
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
                setCustomValue(1);
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
                onChange={(e) => setCustomValue(Number(e.target.value) || 1)}
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
