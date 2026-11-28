import React, { useEffect, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconCheck,
  IconChevronRight,
  IconDeck,
  IconDownload,
  IconEdit,
  IconFilter,
  IconPlay,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpark,
  IconStats,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { DeckCategoryIcon, resolveDeckTheme } from './DeckBadge';
import {
  buildDeckSearchQuery,
  parseClampedInt,
  preventImeEnterSubmit,
  sanitizeDeckHtml,
} from './deckUtils';
import './decks.css';

export interface DeckOverviewPaneProps {
  deckId: number;
  standalone?: boolean;
}

interface FlatDeckInfo {
  deckId: number;
  fullName: string;
  shortName: string;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  totalInDeck: number;
  totalIncludingChildren: number;
  filtered: boolean;
}

type CustomStudyPreset =
  | 'newLimitDelta'
  | 'reviewLimitDelta'
  | 'forgotDays'
  | 'reviewAheadDays'
  | 'previewDays'
  | 'cram';

const CRAM_KINDS = [
  { id: 0, label: '오늘 복습할 카드' },
  { id: 1, label: '새 카드' },
  { id: 2, label: '복습 카드' },
  { id: 3, label: '전체 카드' },
] as const;

const FILTERED_ORDER_OPTIONS = [
  { value: anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST, label: '오래전에 본 카드부터' },
  { value: anki.FilteredSearchOrder.RANDOM, label: '무작위 순서' },
  { value: anki.FilteredSearchOrder.INTERVALS_ASCENDING, label: '복습 간격 짧은 순' },
  { value: anki.FilteredSearchOrder.INTERVALS_DESCENDING, label: '복습 간격 긴 순' },
  { value: anki.FilteredSearchOrder.LAPSES, label: '틀린 횟수 많은 순' },
  { value: anki.FilteredSearchOrder.ADDED, label: '추가한 순서' },
  { value: anki.FilteredSearchOrder.DUE, label: '예정일 순' },
  { value: anki.FilteredSearchOrder.REVERSE_ADDED, label: '최근 추가한 순' },
  { value: anki.FilteredSearchOrder.RELATIVE_OVERDUENESS, label: '가장 시급한 순' },
];

function findDeckInTree(
  node: anki.DeckTreeNode,
  targetId: number,
  parentFullName = ''
): FlatDeckInfo | null {
  const id = anki.toNumber(node.deckId);
  const fullName =
    node.level > 0
      ? parentFullName
        ? `${parentFullName}::${node.name}`
        : node.name
      : '';
  if (node.level > 0 && id === targetId) {
    return {
      deckId: id,
      fullName,
      shortName: node.name,
      newCount: node.newCount ?? 0,
      learnCount: node.learnCount ?? 0,
      reviewCount: node.reviewCount ?? 0,
      totalInDeck: node.totalInDeck ?? 0,
      totalIncludingChildren: node.totalIncludingChildren ?? 0,
      filtered: Boolean(node.filtered),
    };
  }
  for (const child of node.children ?? []) {
    const found = findDeckInTree(child as anki.DeckTreeNode, targetId, fullName);
    if (found) return found;
  }
  return null;
}

function formatWaitKo(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}시간 ${remM}분` : `${h}시간`;
}

export const DeckOverviewPane: React.FC<DeckOverviewPaneProps> = ({
  deckId,
  standalone = false,
}) => {
  const { info, collectionVersion, bumpCollection, navigate } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadedDeckId, setLoadedDeckId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deckInfo, setDeckInfo] = useState<FlatDeckInfo | null>(null);
  const [deckObj, setDeckObj] = useState<anki.Deck | null>(null);
  const [congrats, setCongrats] = useState<anki.CongratsInfoResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const startingStudyRef = useRef(false);
  const customLoadSeqRef = useRef(0);

  // Custom Study modal state (string drafts for numeric inputs so typing never snaps back)
  const [customOpen, setCustomOpen] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [customDefaultsData, setCustomDefaultsData] = useState<{
    extendNew: number;
    extendReview: number;
    availableNew: number;
    availableReview: number;
    tags: Array<{ name: string; include: boolean; exclude: boolean }>;
  } | null>(null);
  const [preset, setPreset] = useState<CustomStudyPreset>('newLimitDelta');
  const [newDeltaDraft, setNewDeltaDraft] = useState('10');
  const [reviewDeltaDraft, setReviewDeltaDraft] = useState('20');
  const [forgotDaysDraft, setForgotDaysDraft] = useState('1');
  const [aheadDaysDraft, setAheadDaysDraft] = useState('1');
  const [previewDaysDraft, setPreviewDaysDraft] = useState('1');
  const [cramKind, setCramKind] = useState<number>(0);
  const [cramLimitDraft, setCramLimitDraft] = useState('100');
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);

  // Filtered Deck edit modal state
  const [filterEditOpen, setFilterEditOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLimitDraft, setFilterLimitDraft] = useState('100');
  const [filterOrder, setFilterOrder] = useState<number>(
    anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST
  );
  const [filterReschedule, setFilterReschedule] = useState(true);

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScheduling, setExportScheduling] = useState(true);
  const [exportMedia, setExportMedia] = useState(true);
  const [exportLegacy, setExportLegacy] = useState(false);
  const [exportResult, setExportResult] = useState<host.ExportResult | null>(null);

  // Deck description editor state
  const [descEditOpen, setDescEditOpen] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [maturity, setMaturity] = useState<{
    newCount: number;
    learnCount: number;
    youngCount: number;
    matureCount: number;
    total: number;
  } | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);

  // Clear stale deck state immediately when switching to a different deck in split view
  const prevDeckIdRef = useRef<number>(deckId);
  useEffect(() => {
    const switchingDeck = prevDeckIdRef.current !== deckId;
    prevDeckIdRef.current = deckId;

    const seq = ++loadSeqRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (switchingDeck) {
      setDeckInfo(null);
      setDeckObj(null);
      setCongrats(null);
      setMaturity(null);
      setLoadedDeckId(null);
    }

    Promise.all([anki.deckTree(), anki.getDeck(deckId)])
      .then(async ([tree, deck]) => {
        if (cancelled || seq !== loadSeqRef.current) return;
        const found = findDeckInTree(tree, deckId);
        setDeckInfo(found);
        setDeckObj(deck);
        setLoadedDeckId(deckId);

        const searchName = found?.fullName || deck?.name || '';
        if (searchName) {
          anki
            .graphs(buildDeckSearchQuery(searchName), 1)
            .then((g) => {
              if (cancelled || seq !== loadSeqRef.current || !g?.cardCounts) return;
              const cc =
                g.cardCounts.excludingInactive ?? g.cardCounts.includingInactive;
              if (!cc) return;
              const n = cc.newCards ?? 0;
              const l = (cc.learn ?? 0) + (cc.relearn ?? 0);
              const y = cc.young ?? 0;
              const m = cc.mature ?? 0;
              setMaturity({
                newCount: n,
                learnCount: l,
                youngCount: y,
                matureCount: m,
                total: n + l + y + m,
              });
            })
            .catch(() => {
              if (!cancelled && seq === loadSeqRef.current) setMaturity(null);
            });
        } else {
          setMaturity(null);
        }

        const dueCount = found
          ? found.newCount + found.learnCount + found.reviewCount
          : 0;
        if (dueCount === 0) {
          // Do not mutate Anki's global currentDeck merely from browsing the overview pane.
          // Only query congratsInfo when this deck is already the active current deck.
          try {
            const current = await anki.getCurrentDeck();
            if (cancelled || seq !== loadSeqRef.current) return;
            if (anki.toNumber(current.id) === deckId) {
              const cg = await anki.congratsInfo();
              if (!cancelled && seq === loadSeqRef.current) setCongrats(cg);
            } else {
              setCongrats(null);
            }
          } catch {
            if (!cancelled && seq === loadSeqRef.current) setCongrats(null);
          }
        } else {
          setCongrats(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled || seq !== loadSeqRef.current) return;
        setError(err instanceof Error ? err.message : '덱 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled && seq === loadSeqRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, collectionVersion, refreshTick]);

  const handleSaveDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckObj || deckObj.filtered || busyAction === 'desc') return;
    setBusyAction('desc');
    try {
      await anki.updateDeck({
        ...deckObj,
        normal: {
          ...(deckObj.normal ?? {}),
          description: descDraft,
        },
      });
      setDescEditOpen(false);
      showToast('덱 설명을 저장했습니다.', 'success');
      bumpCollection();
      setRefreshTick((v) => v + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱 설명을 저장하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartStudy = async () => {
    if (startingStudyRef.current || busyAction === 'study') return;
    startingStudyRef.current = true;
    setBusyAction('study');
    try {
      await anki.setCurrentDeck(deckId);
      navigate(`#/study/${deckId}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '학습 화면을 열지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
      window.setTimeout(() => {
        startingStudyRef.current = false;
      }, 350);
    }
  };

  const handleUnbury = async () => {
    if (busyAction === 'unbury') return;
    setBusyAction('unbury');
    try {
      await anki.unburyDeck(deckId, anki.UnburyDeckMode.ALL);
      showToast('숨겨둔 카드를 다시 불러왔습니다.', 'success');
      bumpCollection();
      setRefreshTick((v) => v + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '숨긴 카드를 되돌리지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRebuildFiltered = async () => {
    if (busyAction === 'rebuild') return;
    setBusyAction('rebuild');
    try {
      await anki.rebuildFilteredDeck(deckId);
      showToast('맞춤 학습 덱을 다시 만들었습니다.', 'success');
      bumpCollection();
      setRefreshTick((v) => v + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습 덱을 다시 만들지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleEmptyFiltered = async () => {
    if (busyAction === 'empty') return;
    setBusyAction('empty');
    try {
      await anki.emptyFilteredDeck(deckId);
      showToast('맞춤 학습 덱을 비웠습니다.', 'success');
      bumpCollection();
      setRefreshTick((v) => v + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습 덱을 비우지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const openCustomStudy = async () => {
    const seq = ++customLoadSeqRef.current;
    setCustomOpen(true);
    setCustomLoading(true);
    try {
      const defaults = await anki.customStudyDefaults(deckId);
      if (seq !== customLoadSeqRef.current) return;
      setCustomDefaultsData({
        extendNew: defaults.extendNew ?? 10,
        extendReview: defaults.extendReview ?? 20,
        availableNew: defaults.availableNew ?? 0,
        availableReview: defaults.availableReview ?? 0,
        tags: (defaults.tags ?? []).map((t) => ({
          name: t.name ?? '',
          include: Boolean(t.include),
          exclude: Boolean(t.exclude),
        })),
      });
      setNewDeltaDraft(String(Math.max(1, defaults.extendNew || 10)));
      setReviewDeltaDraft(String(Math.max(1, defaults.extendReview || 20)));
      setIncludeTags(
        (defaults.tags ?? []).filter((t) => t.include && t.name).map((t) => t.name!)
      );
      setExcludeTags(
        (defaults.tags ?? []).filter((t) => t.exclude && t.name).map((t) => t.name!)
      );
    } catch (err) {
      if (seq !== customLoadSeqRef.current) return;
      showToast(
        err instanceof Error ? err.message : '맞춤 학습 기본값을 불러오지 못했습니다.',
        'error'
      );
    } finally {
      if (seq === customLoadSeqRef.current) {
        setCustomLoading(false);
      }
    }
  };

  const submitCustomStudy = async () => {
    if (busyAction === 'custom') return;
    const newDeltaVal = parseClampedInt(newDeltaDraft, 1, 9999, 10);
    const reviewDeltaVal = parseClampedInt(reviewDeltaDraft, 1, 9999, 20);
    const forgotDaysVal = parseClampedInt(forgotDaysDraft, 1, 365, 1);
    const aheadDaysVal = parseClampedInt(aheadDaysDraft, 1, 365, 1);
    const previewDaysVal = parseClampedInt(previewDaysDraft, 1, 365, 1);
    const cramLimitVal = parseClampedInt(cramLimitDraft, 1, 9999, 100);

    setNewDeltaDraft(String(newDeltaVal));
    setReviewDeltaDraft(String(reviewDeltaVal));
    setForgotDaysDraft(String(forgotDaysVal));
    setAheadDaysDraft(String(aheadDaysVal));
    setPreviewDaysDraft(String(previewDaysVal));
    setCramLimitDraft(String(cramLimitVal));

    setBusyAction('custom');
    try {
      let req: Parameters<typeof anki.customStudy>[0];
      switch (preset) {
        case 'newLimitDelta':
          req = { deckId, newLimitDelta: newDeltaVal };
          break;
        case 'reviewLimitDelta':
          req = { deckId, reviewLimitDelta: reviewDeltaVal };
          break;
        case 'forgotDays':
          req = { deckId, forgotDays: forgotDaysVal };
          break;
        case 'reviewAheadDays':
          req = { deckId, reviewAheadDays: aheadDaysVal };
          break;
        case 'previewDays':
          req = { deckId, previewDays: previewDaysVal };
          break;
        case 'cram':
          req = {
            deckId,
            cram: {
              kind: cramKind,
              cardLimit: cramLimitVal,
              tagsToInclude: includeTags,
              tagsToExclude: excludeTags,
            },
          };
          break;
      }

      await anki.customStudy(req);
      setCustomOpen(false);
      bumpCollection();

      if (preset === 'newLimitDelta' || preset === 'reviewLimitDelta') {
        await anki.setCurrentDeck(deckId);
        showToast('오늘 학습 한도를 늘렸습니다.', 'success');
        navigate(`#/study/${deckId}`);
      } else {
        // Anki sets the newly created/updated custom study filtered deck as the current deck
        const currentDeck = await anki.getCurrentDeck().catch(() => null);
        const filteredId = currentDeck ? anki.toNumber(currentDeck.id) : 0;
        showToast('맞춤 학습 세션을 준비했습니다.', 'success');
        if (filteredId > 0 && (Boolean(currentDeck?.filtered) || filteredId !== deckId)) {
          navigate(`#/study/${filteredId}`);
        } else {
          setRefreshTick((v) => v + 1);
        }
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습을 시작하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const openFilterConditionEditor = async () => {
    try {
      const f = await anki.getOrCreateFilteredDeck(deckId);
      const firstTerm = f.config?.searchTerms?.[0];
      setFilterName(f.name ?? deckInfo?.fullName ?? '맞춤 학습 덱');
      setFilterSearch(firstTerm?.search ?? '');
      setFilterLimitDraft(String(firstTerm?.limit ?? 100));
      setFilterOrder(
        firstTerm?.order ?? anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST
      );
      setFilterReschedule(f.config?.reschedule ?? true);
      setFilterEditOpen(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습 조건을 불러오지 못했습니다.',
        'error'
      );
    }
  };

  const saveFilterCondition = async () => {
    if (busyAction === 'filterSave') return;
    const trimmedName = filterName.trim();
    if (!trimmedName) {
      showToast('덱 이름을 입력해 주세요.', 'error');
      return;
    }
    const clampedLimit = parseClampedInt(filterLimitDraft, 1, 9999, 100);
    setFilterLimitDraft(String(clampedLimit));

    setBusyAction('filterSave');
    try {
      const existing = await anki.getOrCreateFilteredDeck(deckId);
      await anki.addOrUpdateFilteredDeck({
        id: deckId,
        name: trimmedName,
        allowEmpty: existing.allowEmpty ?? true,
        config: {
          ...(existing.config ?? {}),
          reschedule: filterReschedule,
          searchTerms: [
            {
              search: filterSearch.trim(),
              limit: clampedLimit,
              order: filterOrder,
            },
          ],
        },
      });
      setFilterEditOpen(false);
      showToast('맞춤 학습 조건을 저장했습니다.', 'success');
      bumpCollection();
      setRefreshTick((v) => v + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '조건을 저장하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const runExport = async () => {
    if (busyAction === 'export') return;
    setBusyAction('export');
    try {
      const res = await host.host.exportPackage({
        deckId,
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
      setBusyAction(null);
    }
  };

  const handleShareExport = async () => {
    if (!exportResult) return;
    try {
      await host.host.platformShare({
        path: exportResult.path,
        name: exportResult.name,
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '공유 기능을 열지 못했습니다.',
        'error'
      );
    }
  };

  // Show loading skeleton when loading a newly selected deck (never display stale previous deck data)
  if (loading && loadedDeckId !== deckId) {
    return (
      <div
        className={`amgi-overview ${standalone ? 'amgi-overview-standalone' : ''}`}
        aria-busy="true"
        aria-label="덱 정보를 불러오는 중"
      >
        <div className="amgi-overview-card amgi-overview-skeleton">
          <div className="amgi-skeleton-head">
            <div className="amgi-skeleton-block amgi-skeleton-avatar" />
            <div className="amgi-skeleton-title-col">
              <div className="amgi-skeleton-block amgi-skeleton-title" />
              <div className="amgi-skeleton-block amgi-skeleton-meta" />
            </div>
          </div>
          <div className="amgi-skeleton-tiles">
            <div className="amgi-skeleton-block amgi-skeleton-tile" />
            <div className="amgi-skeleton-block amgi-skeleton-tile" />
            <div className="amgi-skeleton-block amgi-skeleton-tile" />
          </div>
          <div className="amgi-skeleton-block amgi-skeleton-cta" />
        </div>
        <div className="amgi-overview-card amgi-overview-skeleton">
          <div className="amgi-skeleton-block amgi-skeleton-row" />
          <div className="amgi-skeleton-block amgi-skeleton-row" />
          <div className="amgi-skeleton-block amgi-skeleton-row" />
        </div>
      </div>
    );
  }

  if (error && loadedDeckId !== deckId) {
    return (
      <div
        className={`amgi-overview ${standalone ? 'amgi-overview-standalone' : ''}`}
      >
        <ErrorState
          title="덱 정보를 불러오지 못했습니다"
          message={error}
          onRetry={() => setRefreshTick((v) => v + 1)}
        />
      </div>
    );
  }

  const displayName = deckInfo?.fullName || deckObj?.name || `덱 #${deckId}`;
  const nameParts = displayName.split('::');
  const shortTitle = nameParts[nameParts.length - 1] || displayName;
  const parentBreadcrumb =
    nameParts.length > 1 ? nameParts.slice(0, -1).join(' › ') : null;
  const isFiltered = Boolean(deckInfo?.filtered || deckObj?.filtered);
  const themeMeta = resolveDeckTheme(displayName);
  const newCount = deckInfo?.newCount ?? 0;
  const learnCount = deckInfo?.learnCount ?? 0;
  const reviewCount = deckInfo?.reviewCount ?? 0;
  const totalDue = newCount + learnCount + reviewCount;
  const rawDescription = deckObj?.normal?.description ?? '';
  const sanitizedDescription = sanitizeDeckHtml(rawDescription);
  const filteredSearchTerm = deckObj?.filtered?.searchTerms?.[0]?.search ?? '';
  const maturePct =
    maturity && maturity.total > 0
      ? Math.round((maturity.matureCount / maturity.total) * 100)
      : 0;

  return (
    <div
      className={`amgi-overview ${standalone ? 'amgi-overview-standalone' : ''}`}
    >
      <div className="amgi-overview-card">
        <div className="amgi-overview-head">
          <div className="amgi-overview-identity">
            <span
              className={`amgi-deck-emblem amgi-deck-emblem--lg amgi-deck-emblem--${
                isFiltered ? 'blue' : themeMeta.tone
              }`}
              aria-hidden="true"
            >
              {isFiltered ? (
                <IconSpark size={20} />
              ) : (
                <DeckCategoryIcon deckName={displayName} size={20} />
              )}
            </span>

            <div className="amgi-overview-title-block">
              {parentBreadcrumb && (
                <div className="amgi-overview-breadcrumb">{parentBreadcrumb}</div>
              )}
              <h2 className="amgi-overview-name">{shortTitle}</h2>
              <div className="amgi-overview-meta">
                {isFiltered && <span className="amgi-filtered-pill">맞춤 학습 덱</span>}
                {deckInfo && (
                  <span className="tabular">
                    전체 {deckInfo.totalIncludingChildren.toLocaleString()}장
                  </span>
                )}
              </div>
            </div>
          </div>

          {!isFiltered && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-overview-settings-btn"
              onClick={() => navigate(`#/deck-options/${deckId}`)}
              aria-label="덱 설정"
            >
              <IconSettings size={17} />
              <span>설정</span>
            </button>
          )}
        </div>

        {isFiltered && filteredSearchTerm && (
          <div className="amgi-overview-desc">
            <strong>검색 조건:</strong> <code>{filteredSearchTerm}</code>
          </div>
        )}

        {!isFiltered && sanitizedDescription && (
          <div
            className="amgi-overview-desc amgi-prose"
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        )}

        <div className="amgi-overview-tiles">
          <div className={`amgi-stat-tile amgi-stat-tile-new ${newCount === 0 ? 'is-zero' : ''}`}>
            <span className="amgi-stat-tile-label">
              <span className="amgi-legend-dot amgi-legend-dot--new" aria-hidden="true" />
              <span>새 카드</span>
            </span>
            <span className="amgi-stat-tile-value tabular">{newCount.toLocaleString()}</span>
          </div>
          <div className={`amgi-stat-tile amgi-stat-tile-learn ${learnCount === 0 ? 'is-zero' : ''}`}>
            <span className="amgi-stat-tile-label">
              <span className="amgi-legend-dot amgi-legend-dot--learn" aria-hidden="true" />
              <span>학습 중</span>
            </span>
            <span className="amgi-stat-tile-value tabular">{learnCount.toLocaleString()}</span>
          </div>
          <div className={`amgi-stat-tile amgi-stat-tile-review ${reviewCount === 0 ? 'is-zero' : ''}`}>
            <span className="amgi-stat-tile-label">
              <span className="amgi-legend-dot amgi-legend-dot--review" aria-hidden="true" />
              <span>복습</span>
            </span>
            <span className="amgi-stat-tile-value tabular">{reviewCount.toLocaleString()}</span>
          </div>
        </div>

        {totalDue > 0 ? (
          <button
            type="button"
            className="amgi-btn amgi-btn-primary amgi-overview-cta"
            disabled={busyAction === 'study'}
            onClick={() => void handleStartStudy()}
          >
            <IconPlay size={18} />
            <span>
              {busyAction === 'study'
                ? '준비 중...'
                : `학습 시작 · ${totalDue.toLocaleString()}장`}
            </span>
          </button>
        ) : (
          <div className="amgi-congrats-box">
            <div className="amgi-congrats-head">
              <span className="amgi-congrats-check" aria-hidden="true">
                <IconCheck size={16} />
              </span>
              <div className="amgi-congrats-title">
                {isFiltered
                  ? '현재 맞춤 학습 덱이 비어 있습니다'
                  : (deckInfo?.totalIncludingChildren ?? 0) === 0
                    ? '아직 이 덱에 카드가 없습니다'
                    : '오늘 이 덱의 복습을 모두 마쳤습니다'}
              </div>
            </div>
            {congrats && congrats.secsUntilNextLearn > 0 && (
              <p className="amgi-congrats-sub">
                다음 학습 카드가 {formatWaitKo(congrats.secsUntilNextLearn)} 뒤에 열립니다.
              </p>
            )}
            {(congrats?.haveSchedBuried || congrats?.haveUserBuried) && (
              <div className="amgi-inline-row">
                <span className="amgi-congrats-sub">오늘 미뤄둔 카드가 있습니다.</span>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  disabled={busyAction === 'unbury'}
                  onClick={() => void handleUnbury()}
                >
                  미룬 카드 다시 보기
                </button>
              </div>
            )}
            <button
              type="button"
              className="amgi-btn amgi-btn-primary amgi-overview-cta"
              onClick={() =>
                isFiltered
                  ? void handleRebuildFiltered()
                  : (deckInfo?.totalIncludingChildren ?? 0) === 0
                    ? navigate(`#/note/new?deck=${deckId}`)
                    : void openCustomStudy()
              }
            >
              {isFiltered ? (
                <IconRefresh size={18} />
              ) : (deckInfo?.totalIncludingChildren ?? 0) === 0 ? (
                <IconEdit size={18} />
              ) : (
                <IconSpark size={18} />
              )}
              <span>
                {isFiltered
                  ? '다시 만들기'
                  : (deckInfo?.totalIncludingChildren ?? 0) === 0
                    ? '노트 추가하기'
                    : '맞춤 학습'}
              </span>
            </button>
          </div>
        )}

        {maturity && maturity.total > 0 && (
          <div className="amgi-overview-maturity" aria-label="덱 숙련도 분포">
            <div className="amgi-overview-maturity-head">
              <span className="amgi-overview-maturity-title">숙련도 분포</span>
              <span className="amgi-overview-maturity-pct tabular">
                장기 기억 {maturePct}%
              </span>
            </div>
            <div className="amgi-overview-maturity-bar">
              {maturity.newCount > 0 && (
                <div
                  className="amgi-overview-m-seg new"
                  style={{ width: `${(maturity.newCount / maturity.total) * 100}%` }}
                />
              )}
              {maturity.learnCount > 0 && (
                <div
                  className="amgi-overview-m-seg learn"
                  style={{ width: `${(maturity.learnCount / maturity.total) * 100}%` }}
                />
              )}
              {maturity.youngCount > 0 && (
                <div
                  className="amgi-overview-m-seg young"
                  style={{ width: `${(maturity.youngCount / maturity.total) * 100}%` }}
                />
              )}
              {maturity.matureCount > 0 && (
                <div
                  className="amgi-overview-m-seg mature"
                  style={{ width: `${(maturity.matureCount / maturity.total) * 100}%` }}
                />
              )}
            </div>
            <div className="amgi-overview-maturity-legend tabular">
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot new" />
                <span>새 {maturity.newCount.toLocaleString()}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot learn" />
                <span>학습 {maturity.learnCount.toLocaleString()}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot young" />
                <span>익히는 중 {maturity.youngCount.toLocaleString()}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot mature" />
                <span>장기 기억 {maturity.matureCount.toLocaleString()}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="amgi-overview-card amgi-overview-card--actions">
        <div className="amgi-overview-section-title">빠른 도구</div>
        <div className="amgi-overview-action-list">
          {isFiltered ? (
            <>
              <button
                type="button"
                className="amgi-overview-action-row"
                disabled={busyAction === 'rebuild'}
                onClick={() => void handleRebuildFiltered()}
              >
                <span className="amgi-overview-action-icon" aria-hidden="true">
                  <IconRefresh size={18} />
                </span>
                <span className="amgi-overview-action-text">
                  <span className="amgi-overview-action-label">다시 만들기</span>
                  <span className="amgi-overview-action-desc">검색 조건에 맞는 카드를 새로 모읍니다</span>
                </span>
                <IconChevronRight size={18} className="amgi-overview-action-arrow" />
              </button>
              <button
                type="button"
                className="amgi-overview-action-row"
                disabled={busyAction === 'empty'}
                onClick={() => void handleEmptyFiltered()}
              >
                <span className="amgi-overview-action-icon" aria-hidden="true">
                  <IconDeck size={18} />
                </span>
                <span className="amgi-overview-action-text">
                  <span className="amgi-overview-action-label">비우기</span>
                  <span className="amgi-overview-action-desc">모아둔 카드를 원래 덱으로 돌려보냅니다</span>
                </span>
                <IconChevronRight size={18} className="amgi-overview-action-arrow" />
              </button>
              <button
                type="button"
                className="amgi-overview-action-row"
                onClick={() => void openFilterConditionEditor()}
              >
                <span className="amgi-overview-action-icon" aria-hidden="true">
                  <IconFilter size={18} />
                </span>
                <span className="amgi-overview-action-text">
                  <span className="amgi-overview-action-label">조건 수정</span>
                  <span className="amgi-overview-action-desc">검색식, 카드 수, 정렬 순서를 바꿉니다</span>
                </span>
                <IconChevronRight size={18} className="amgi-overview-action-arrow" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="amgi-overview-action-row"
                onClick={() => void openCustomStudy()}
              >
                <span className="amgi-overview-action-icon" aria-hidden="true">
                  <IconSpark size={18} />
                </span>
                <span className="amgi-overview-action-text">
                  <span className="amgi-overview-action-label">맞춤 학습</span>
                  <span className="amgi-overview-action-desc">한도 늘리기, 틀린 카드 모으기, 미리 복습</span>
                </span>
                <IconChevronRight size={18} className="amgi-overview-action-arrow" />
              </button>
              <button
                type="button"
                className="amgi-overview-action-row"
                onClick={() => navigate(`#/note/new?deck=${deckId}`)}
              >
                <span className="amgi-overview-action-icon" aria-hidden="true">
                  <IconEdit size={18} />
                </span>
                <span className="amgi-overview-action-text">
                  <span className="amgi-overview-action-label">노트 추가</span>
                  <span className="amgi-overview-action-desc">이 덱에 새 카드를 바로 작성합니다</span>
                </span>
                <IconChevronRight size={18} className="amgi-overview-action-arrow" />
              </button>
            </>
          )}

          <button
            type="button"
            className="amgi-overview-action-row"
            onClick={() =>
              navigate(`#/browse?q=${encodeURIComponent(buildDeckSearchQuery(displayName))}`)
            }
          >
            <span className="amgi-overview-action-icon" aria-hidden="true">
              <IconSearch size={18} />
            </span>
            <span className="amgi-overview-action-text">
              <span className="amgi-overview-action-label">카드 찾아보기</span>
              <span className="amgi-overview-action-desc">이 덱에 포함된 카드를 목록에서 봅니다</span>
            </span>
            <IconChevronRight size={18} className="amgi-overview-action-arrow" />
          </button>

          <button
            type="button"
            className="amgi-overview-action-row"
            onClick={() => navigate('#/stats')}
          >
            <span className="amgi-overview-action-icon" aria-hidden="true">
              <IconStats size={18} />
            </span>
            <span className="amgi-overview-action-text">
              <span className="amgi-overview-action-label">학습 통계</span>
              <span className="amgi-overview-action-desc">복습 기록과 성취도를 확인합니다</span>
            </span>
            <IconChevronRight size={18} className="amgi-overview-action-arrow" />
          </button>

          {!isFiltered && (
            <button
              type="button"
              className="amgi-overview-action-row"
              onClick={() => {
                setDescDraft(rawDescription);
                setDescEditOpen(true);
              }}
            >
              <span className="amgi-overview-action-icon" aria-hidden="true">
                <IconEdit size={18} />
              </span>
              <span className="amgi-overview-action-text">
                <span className="amgi-overview-action-label">설명 편집</span>
                <span className="amgi-overview-action-desc">덱 메모나 학습 목표를 적어둡니다</span>
              </span>
              <IconChevronRight size={18} className="amgi-overview-action-arrow" />
            </button>
          )}

          {!isFiltered && (
            <button
              type="button"
              className="amgi-overview-action-row"
              onClick={() => {
                setExportResult(null);
                setExportOpen(true);
              }}
            >
              <span className="amgi-overview-action-icon" aria-hidden="true">
                <IconDownload size={18} />
              </span>
              <span className="amgi-overview-action-text">
                <span className="amgi-overview-action-label">내보내기 (.apkg)</span>
                <span className="amgi-overview-action-desc">다른 기기나 친구에게 공유할 파일을 만듭니다</span>
              </span>
              <IconChevronRight size={18} className="amgi-overview-action-arrow" />
            </button>
          )}
        </div>
      </div>

      {/* Deck Description Editor Modal */}
      <SheetOrDialog
        open={descEditOpen}
        onClose={() => {
          if (busyAction !== 'desc') setDescEditOpen(false);
        }}
        title="덱 설명 편집"
        subtitle={displayName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyAction === 'desc'}
              onClick={() => setDescEditOpen(false)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-deck-desc-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyAction === 'desc'}
            >
              {busyAction === 'desc' ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <form
          id="amgi-deck-desc-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleSaveDescription(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="deck-desc-textarea">
              덱 메모 / 설명
            </label>
            <textarea
              id="deck-desc-textarea"
              className="amgi-textarea"
              rows={5}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="학습 목표, 출처, 암기 팁 등을 자유롭게 적어두세요..."
            />
          </div>
        </form>
      </SheetOrDialog>

      {/* Custom Study Sheet */}
      <SheetOrDialog
        open={customOpen}
        onClose={() => {
          if (busyAction !== 'custom') setCustomOpen(false);
        }}
        title="맞춤 학습"
        subtitle={displayName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyAction === 'custom'}
              onClick={() => setCustomOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busyAction === 'custom' || customLoading}
              onClick={() => void submitCustomStudy()}
            >
              {busyAction === 'custom' ? '준비 중...' : '맞춤 학습 시작'}
            </button>
          </>
        }
      >
        {customLoading ? (
          <p className="amgi-congrats-sub">선택지를 불러오는 중입니다...</p>
        ) : (
          <div className="amgi-modal-form">
            <button
              type="button"
              className={`amgi-radio-card ${preset === 'newLimitDelta' ? 'active' : ''}`}
              onClick={() => setPreset('newLimitDelta')}
            >
              <span className="amgi-radio-card-title">오늘 새 카드 더 공부하기</span>
              <span className="amgi-radio-card-desc">
                더 공부 가능: {(customDefaultsData?.availableNew ?? 0).toLocaleString()}장
              </span>
            </button>
            {preset === 'newLimitDelta' && (
              <div className="amgi-field-group">
                <label className="amgi-field-label" htmlFor="cs-new-delta">
                  추가할 새 카드 수
                </label>
                <input
                  id="cs-new-delta"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={9999}
                  className="amgi-input tabular"
                  value={newDeltaDraft}
                  onChange={(e) => setNewDeltaDraft(e.target.value)}
                  onBlur={() =>
                    setNewDeltaDraft(
                      String(parseClampedInt(newDeltaDraft, 1, 9999, 10))
                    )
                  }
                  onKeyDown={preventImeEnterSubmit}
                />
              </div>
            )}

            <button
              type="button"
              className={`amgi-radio-card ${preset === 'reviewLimitDelta' ? 'active' : ''}`}
              onClick={() => setPreset('reviewLimitDelta')}
            >
              <span className="amgi-radio-card-title">오늘 복습 카드 더 공부하기</span>
              <span className="amgi-radio-card-desc">
                더 공부 가능: {(customDefaultsData?.availableReview ?? 0).toLocaleString()}장
              </span>
            </button>
            {preset === 'reviewLimitDelta' && (
              <div className="amgi-field-group">
                <label className="amgi-field-label" htmlFor="cs-rev-delta">
                  추가할 복습 카드 수
                </label>
                <input
                  id="cs-rev-delta"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={9999}
                  className="amgi-input tabular"
                  value={reviewDeltaDraft}
                  onChange={(e) => setReviewDeltaDraft(e.target.value)}
                  onBlur={() =>
                    setReviewDeltaDraft(
                      String(parseClampedInt(reviewDeltaDraft, 1, 9999, 20))
                    )
                  }
                  onKeyDown={preventImeEnterSubmit}
                />
              </div>
            )}

            <button
              type="button"
              className={`amgi-radio-card ${preset === 'forgotDays' ? 'active' : ''}`}
              onClick={() => setPreset('forgotDays')}
            >
              <span className="amgi-radio-card-title">최근 틀린 카드 다시 보기</span>
              <span className="amgi-radio-card-desc">
                최근 틀린 카드만 따로 모아 복습합니다
              </span>
            </button>
            {preset === 'forgotDays' && (
              <div className="amgi-field-group">
                <label className="amgi-field-label" htmlFor="cs-forgot-days">
                  며칠 이내 틀린 카드
                </label>
                <input
                  id="cs-forgot-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={forgotDaysDraft}
                  onChange={(e) => setForgotDaysDraft(e.target.value)}
                  onBlur={() =>
                    setForgotDaysDraft(
                      String(parseClampedInt(forgotDaysDraft, 1, 365, 1))
                    )
                  }
                  onKeyDown={preventImeEnterSubmit}
                />
              </div>
            )}

            <button
              type="button"
              className={`amgi-radio-card ${preset === 'reviewAheadDays' ? 'active' : ''}`}
              onClick={() => setPreset('reviewAheadDays')}
            >
              <span className="amgi-radio-card-title">미리 복습하기</span>
              <span className="amgi-radio-card-desc">
                며칠 뒤 복습할 카드를 앞당겨 봅니다
              </span>
            </button>
            {preset === 'reviewAheadDays' && (
              <div className="amgi-field-group">
                <label className="amgi-field-label" htmlFor="cs-ahead-days">
                  앞당길 일수
                </label>
                <input
                  id="cs-ahead-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={aheadDaysDraft}
                  onChange={(e) => setAheadDaysDraft(e.target.value)}
                  onBlur={() =>
                    setAheadDaysDraft(
                      String(parseClampedInt(aheadDaysDraft, 1, 365, 1))
                    )
                  }
                  onKeyDown={preventImeEnterSubmit}
                />
              </div>
            )}

            <button
              type="button"
              className={`amgi-radio-card ${preset === 'previewDays' ? 'active' : ''}`}
              onClick={() => setPreset('previewDays')}
            >
              <span className="amgi-radio-card-title">최근 새 카드 미리 보기</span>
              <span className="amgi-radio-card-desc">
                복습 일정을 바꾸지 않고 새 카드를 훑어봅니다
              </span>
            </button>
            {preset === 'previewDays' && (
              <div className="amgi-field-group">
                <label className="amgi-field-label" htmlFor="cs-preview-days">
                  최근 추가 일수
                </label>
                <input
                  id="cs-preview-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={previewDaysDraft}
                  onChange={(e) => setPreviewDaysDraft(e.target.value)}
                  onBlur={() =>
                    setPreviewDaysDraft(
                      String(parseClampedInt(previewDaysDraft, 1, 365, 1))
                    )
                  }
                  onKeyDown={preventImeEnterSubmit}
                />
              </div>
            )}

            <button
              type="button"
              className={`amgi-radio-card ${preset === 'cram' ? 'active' : ''}`}
              onClick={() => setPreset('cram')}
            >
              <span className="amgi-radio-card-title">태그별로 집중 학습하기</span>
              <span className="amgi-radio-card-desc">
                원하는 태그나 카드 상태만 골라 학습합니다
              </span>
            </button>
            {preset === 'cram' && (
              <div className="amgi-modal-form">
                <div className="amgi-field-group">
                  <span className="amgi-field-label">카드 범위</span>
                  <div className="amgi-tag-chips">
                    {CRAM_KINDS.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        className="amgi-chip"
                        aria-pressed={cramKind === k.id}
                        onClick={() => setCramKind(k.id)}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="amgi-field-group">
                  <label className="amgi-field-label" htmlFor="cs-cram-limit">
                    최대 카드 수
                  </label>
                  <input
                    id="cs-cram-limit"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={9999}
                    className="amgi-input tabular"
                    value={cramLimitDraft}
                    onChange={(e) => setCramLimitDraft(e.target.value)}
                    onBlur={() =>
                      setCramLimitDraft(
                        String(parseClampedInt(cramLimitDraft, 1, 9999, 100))
                      )
                    }
                    onKeyDown={preventImeEnterSubmit}
                  />
                </div>
                {customDefaultsData && customDefaultsData.tags.length > 0 && (
                  <div className="amgi-field-group">
                    <span className="amgi-field-label">포함할 태그 선택</span>
                    <div className="amgi-tag-chips">
                      {customDefaultsData.tags.map((t) => {
                        const included = includeTags.includes(t.name);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            className="amgi-chip"
                            aria-pressed={included}
                            onClick={() =>
                              setIncludeTags((prev) =>
                                prev.includes(t.name)
                                  ? prev.filter((x) => x !== t.name)
                                  : [...prev, t.name]
                              )
                            }
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetOrDialog>

      {/* Filtered Deck Condition Edit Modal */}
      <SheetOrDialog
        open={filterEditOpen}
        onClose={() => {
          if (busyAction !== 'filterSave') setFilterEditOpen(false);
        }}
        title="맞춤 학습 조건 수정"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyAction === 'filterSave'}
              onClick={() => setFilterEditOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busyAction === 'filterSave'}
              onClick={() => void saveFilterCondition()}
            >
              {busyAction === 'filterSave' ? '저장 중...' : '저장하고 다시 만들기'}
            </button>
          </>
        }
      >
        <div className="amgi-modal-form">
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="fd-name">
              덱 이름
            </label>
            <input
              id="fd-name"
              type="text"
              className="amgi-input"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={preventImeEnterSubmit}
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="fd-search">
              검색 조건
            </label>
            <input
              id="fd-search"
              type="text"
              className="amgi-input"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={preventImeEnterSubmit}
              placeholder='예: deck:"일본어" is:due'
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="fd-limit">
              최대 카드 수
            </label>
            <input
              id="fd-limit"
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              className="amgi-input tabular"
              value={filterLimitDraft}
              onChange={(e) => setFilterLimitDraft(e.target.value)}
              onBlur={() =>
                setFilterLimitDraft(
                  String(parseClampedInt(filterLimitDraft, 1, 9999, 100))
                )
              }
              onKeyDown={preventImeEnterSubmit}
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="fd-order">
              카드 순서
            </label>
            <select
              id="fd-order"
              className="amgi-select"
              value={filterOrder}
              onChange={(e) => setFilterOrder(Number(e.target.value))}
            >
              {FILTERED_ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">답변 후 카드 일정 변경</div>
              <div className="amgi-field-hint">
                끄면 미리보기 모드로 일정이 바뀌지 않습니다
              </div>
            </div>
            <Switch
              checked={filterReschedule}
              onChange={setFilterReschedule}
              aria-label="답변 후 카드 일정 변경"
            />
          </div>
        </div>
      </SheetOrDialog>

      {/* Export .apkg Modal */}
      <SheetOrDialog
        open={exportOpen}
        onClose={() => {
          if (busyAction !== 'export') setExportOpen(false);
        }}
        title="덱 내보내기 (.apkg)"
        subtitle={displayName}
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
                  onClick={() => void handleShareExport()}
                >
                  공유하기
                </button>
              )}
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => setExportOpen(false)}
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                disabled={busyAction === 'export'}
                onClick={() => setExportOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-primary"
                disabled={busyAction === 'export'}
                onClick={() => void runExport()}
              >
                {busyAction === 'export' ? '만드는 중...' : '내보내기 파일 만들기'}
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
    </div>
  );
};

export default DeckOverviewPane;
