import React, { useEffect, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconCheck,
  IconDeck,
  IconDownload,
  IconEdit,
  IconFilter,
  IconPlay,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpark,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
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

function findCustomStudyDeckId(node: anki.DeckTreeNode): number | null {
  const name = node.name ?? '';
  if (node.level > 0 && node.filtered && (name.includes('맞춤') || name.includes('Custom'))) {
    return anki.toNumber(node.deckId);
  }
  for (const child of node.children ?? []) {
    const found = findCustomStudyDeckId(child as anki.DeckTreeNode);
    if (found !== null) return found;
  }
  return null;
}

function sanitizeDeckHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const badTags = doc.querySelectorAll('script, iframe, object, embed, link, meta, base, form');
    badTags.forEach((el) => el.remove());

    const all = doc.body.querySelectorAll('*');
    all.forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
        } else if (
          (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') &&
          (val.startsWith('javascript:') || val.startsWith('data:text/html'))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  } catch {
    return rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
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
  const [error, setError] = useState<string | null>(null);
  const [deckInfo, setDeckInfo] = useState<FlatDeckInfo | null>(null);
  const [deckObj, setDeckObj] = useState<anki.Deck | null>(null);
  const [congrats, setCongrats] = useState<anki.CongratsInfoResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Custom Study modal state
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
  const [newDelta, setNewDelta] = useState(10);
  const [reviewDelta, setReviewDelta] = useState(20);
  const [forgotDays, setForgotDays] = useState(1);
  const [aheadDays, setAheadDays] = useState(1);
  const [previewDays, setPreviewDays] = useState(1);
  const [cramKind, setCramKind] = useState<number>(0);
  const [cramLimit, setCramLimit] = useState(100);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);

  // Filtered Deck edit modal state
  const [filterEditOpen, setFilterEditOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLimit, setFilterLimit] = useState(100);
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([anki.deckTree(), anki.getDeck(deckId)])
      .then(async ([tree, deck]) => {
        if (cancelled) return;
        const found = findDeckInTree(tree, deckId);
        setDeckInfo(found);
        setDeckObj(deck);

        const searchName = found?.fullName || deck?.name || '';
        if (searchName) {
          anki
            .graphs(`deck:"${searchName}"`, 1)
            .then((g) => {
              if (cancelled || !g?.cardCounts) return;
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
              if (!cancelled) setMaturity(null);
            });
        }

        const dueCount = found
          ? found.newCount + found.learnCount + found.reviewCount
          : 0;
        if (dueCount === 0) {
          try {
            await anki.setCurrentDeck(deckId);
            const cg = await anki.congratsInfo();
            if (!cancelled) setCongrats(cg);
          } catch {
            if (!cancelled) setCongrats(null);
          }
        } else {
          setCongrats(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '덱 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, collectionVersion, refreshTick]);

  const handleSaveDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckObj || deckObj.filtered) return;
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
    }
  };

  const handleUnbury = async () => {
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
    setCustomOpen(true);
    setCustomLoading(true);
    try {
      const defaults = await anki.customStudyDefaults(deckId);
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
      setNewDelta(Math.max(1, defaults.extendNew || 10));
      setReviewDelta(Math.max(1, defaults.extendReview || 20));
      setIncludeTags(
        (defaults.tags ?? []).filter((t) => t.include && t.name).map((t) => t.name!)
      );
      setExcludeTags(
        (defaults.tags ?? []).filter((t) => t.exclude && t.name).map((t) => t.name!)
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '맞춤 학습 기본값을 불러오지 못했습니다.',
        'error'
      );
    } finally {
      setCustomLoading(false);
    }
  };

  const submitCustomStudy = async () => {
    setBusyAction('custom');
    try {
      let req: Parameters<typeof anki.customStudy>[0];
      switch (preset) {
        case 'newLimitDelta':
          req = { deckId, newLimitDelta: Math.max(1, newDelta) };
          break;
        case 'reviewLimitDelta':
          req = { deckId, reviewLimitDelta: Math.max(1, reviewDelta) };
          break;
        case 'forgotDays':
          req = { deckId, forgotDays: Math.max(1, forgotDays) };
          break;
        case 'reviewAheadDays':
          req = { deckId, reviewAheadDays: Math.max(1, aheadDays) };
          break;
        case 'previewDays':
          req = { deckId, previewDays: Math.max(1, previewDays) };
          break;
        case 'cram':
          req = {
            deckId,
            cram: {
              kind: cramKind,
              cardLimit: Math.max(1, cramLimit),
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
        const tree = await anki.deckTree();
        const filteredId = findCustomStudyDeckId(tree);
        showToast('맞춤 학습 세션을 준비했습니다.', 'success');
        if (filteredId) {
          await anki.setCurrentDeck(filteredId);
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
      setFilterLimit(firstTerm?.limit ?? 100);
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
    const trimmedName = filterName.trim();
    if (!trimmedName) {
      showToast('덱 이름을 입력해 주세요.', 'error');
      return;
    }
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
              limit: Math.max(1, filterLimit),
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

  if (loading && !deckInfo) {
    return (
      <div
        className={`amgi-overview ${standalone ? 'amgi-overview-standalone' : ''}`}
      >
        <div className="amgi-overview-card">
          <div className="amgi-overview-name">불러오는 중...</div>
          <p className="amgi-congrats-sub">덱 정보를 확인하고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (error && !deckInfo) {
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
  const isFiltered = Boolean(deckInfo?.filtered || deckObj?.filtered);
  const newCount = deckInfo?.newCount ?? 0;
  const learnCount = deckInfo?.learnCount ?? 0;
  const reviewCount = deckInfo?.reviewCount ?? 0;
  const totalDue = newCount + learnCount + reviewCount;
  const rawDescription = deckObj?.normal?.description ?? '';
  const sanitizedDescription = sanitizeDeckHtml(rawDescription);
  const filteredSearchTerm = deckObj?.filtered?.searchTerms?.[0]?.search ?? '';

  return (
    <div
      className={`amgi-overview ${standalone ? 'amgi-overview-standalone' : ''}`}
    >
      <div className="amgi-overview-card">
        <div className="amgi-overview-head">
          <div className="amgi-overview-title-block">
            <h2 className="amgi-overview-name">{displayName}</h2>
            <div className="amgi-overview-meta">
              {isFiltered && <span className="amgi-filtered-pill">맞춤 학습 덱</span>}
              {deckInfo && (
                <span className="tabular">
                  전체 카드 {deckInfo.totalIncludingChildren.toLocaleString()}장
                </span>
              )}
            </div>
          </div>

          {!isFiltered && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => navigate(`#/deck-options/${deckId}`)}
            >
              <IconSettings size={16} />
              <span>덱 설정</span>
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
          <div className="amgi-stat-tile amgi-stat-tile-new">
            <span className="amgi-stat-tile-label">새 카드</span>
            <span className="amgi-stat-tile-value tabular">{newCount}</span>
          </div>
          <div className="amgi-stat-tile amgi-stat-tile-learn">
            <span className="amgi-stat-tile-label">학습 중</span>
            <span className="amgi-stat-tile-value tabular">{learnCount}</span>
          </div>
          <div className="amgi-stat-tile amgi-stat-tile-review">
            <span className="amgi-stat-tile-label">복습</span>
            <span className="amgi-stat-tile-value tabular">{reviewCount}</span>
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
            <span>{busyAction === 'study' ? '준비 중...' : '학습 시작'}</span>
          </button>
        ) : (
          <div className="amgi-congrats-box">
            <div className="amgi-congrats-title">
              {isFiltered
                ? '현재 맞춤 학습 덱이 비어 있습니다'
                : '오늘 이 덱의 복습을 모두 마쳤습니다!'}
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
              onClick={() => (isFiltered ? void handleRebuildFiltered() : void openCustomStudy())}
            >
              {isFiltered ? <IconRefresh size={18} /> : <IconSpark size={18} />}
              <span>{isFiltered ? '다시 만들기' : '맞춤 학습'}</span>
            </button>
          </div>
        )}
        {maturity && maturity.total > 0 && (
          <div className="amgi-overview-maturity" aria-label="덱 숙련도 분포">
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
                <span>새 {maturity.newCount}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot learn" />
                <span>학습 {maturity.learnCount}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot young" />
                <span>익히는 중 {maturity.youngCount}</span>
              </span>
              <span className="amgi-overview-maturity-item">
                <span className="amgi-overview-m-dot mature" />
                <span>장기 기억 {maturity.matureCount}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="amgi-overview-card">
        <div className="amgi-section-title">빠른 도구</div>
        <div className="amgi-overview-tools">
          {isFiltered ? (
            <>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                disabled={busyAction === 'rebuild'}
                onClick={() => void handleRebuildFiltered()}
              >
                <IconRefresh size={16} />
                <span>다시 만들기</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                disabled={busyAction === 'empty'}
                onClick={() => void handleEmptyFiltered()}
              >
                <IconDeck size={16} />
                <span>비우기</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => void openFilterConditionEditor()}
              >
                <IconFilter size={16} />
                <span>조건 수정</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => void openCustomStudy()}
              >
                <IconSpark size={16} />
                <span>맞춤 학습</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => navigate(`#/note/new?deck=${deckId}`)}
              >
                <IconEdit size={16} />
                <span>노트 추가</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            onClick={() =>
              navigate(`#/browse?q=${encodeURIComponent(`deck:"${displayName}"`)}`)
            }
          >
            <IconSearch size={16} />
            <span>카드 찾아보기</span>
          </button>

          {!isFiltered && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => {
                setExportResult(null);
                setExportOpen(true);
              }}
            >
              <IconDownload size={16} />
              <span>내보내기 (.apkg)</span>
            </button>
          )}

          {!isFiltered && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => {
                setDescDraft(rawDescription);
                setDescEditOpen(true);
              }}
            >
              <IconEdit size={16} />
              <span>설명 편집</span>
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
                더 공부 가능: {customDefaultsData?.availableNew ?? 0}장
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
                  min={1}
                  max={9999}
                  className="amgi-input tabular"
                  value={newDelta}
                  onChange={(e) => setNewDelta(Number(e.target.value) || 1)}
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
                더 공부 가능: {customDefaultsData?.availableReview ?? 0}장
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
                  min={1}
                  max={9999}
                  className="amgi-input tabular"
                  value={reviewDelta}
                  onChange={(e) => setReviewDelta(Number(e.target.value) || 1)}
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
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={forgotDays}
                  onChange={(e) => setForgotDays(Number(e.target.value) || 1)}
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
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={aheadDays}
                  onChange={(e) => setAheadDays(Number(e.target.value) || 1)}
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
                  min={1}
                  max={365}
                  className="amgi-input tabular"
                  value={previewDays}
                  onChange={(e) => setPreviewDays(Number(e.target.value) || 1)}
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
                    min={1}
                    max={9999}
                    className="amgi-input tabular"
                    value={cramLimit}
                    onChange={(e) => setCramLimit(Number(e.target.value) || 100)}
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
        onClose={() => setFilterEditOpen(false)}
        title="맞춤 학습 조건 수정"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
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
              min={1}
              max={9999}
              className="amgi-input tabular"
              value={filterLimit}
              onChange={(e) => setFilterLimit(Number(e.target.value) || 100)}
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
        onClose={() => setExportOpen(false)}
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
