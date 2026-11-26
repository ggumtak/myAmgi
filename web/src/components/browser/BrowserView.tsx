import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import * as anki from '../../anki';
import ankiProto from '../../anki/generated';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconCheck,
  IconClose,
  IconEye,
  IconPlus,
  IconSearch,
  SheetOrDialog,
  useToast,
} from '../../ui';
import { BatchActionBar } from './BatchActionBar';
import { BrowserPreviewPane, BrowserPreviewSheet } from './BrowserPreviewPane';
import {
  composeQueryFromFilters,
  FilterBarAndSheet,
  parseQueryToFilters,
  type BrowserFilterState,
} from './FilterBarAndSheet';
import {
  DEFAULT_WIDE_COLUMNS,
  MOBILE_ACTIVE_COLUMNS,
  VirtualBrowserList,
} from './VirtualBrowserList';
import './browser.css';

const BROWSER_TABLE_SHOW_NOTES_MODE = 0;

function useIsWide(breakpoint = 900): boolean {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setIsWide(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [breakpoint]);
  return isWide;
}

export const BrowserView: React.FC<{ initialQuery?: string }> = ({ initialQuery }) => {
  const {
    prefs,
    setPref,
    resolvedTheme,
    collectionVersion,
    navigate,
    registerBackHandler,
  } = useApp();
  const { showToast } = useToast();

  const isWide = useIsWide(900);
  const isEink = resolvedTheme === 'eink';

  const [queryText, setQueryText] = useState(() => initialQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => initialQuery ?? '');
  const [filters, setFilters] = useState<BrowserFilterState>(() =>
    parseQueryToFilters(initialQuery ?? '')
  );

  const [isNotesMode, setIsNotesMode] = useState(false);
  const [allColumns, setAllColumns] = useState<anki.BrowserColumn[]>([]);
  const [wideColumns, setWideColumns] = useState<string[]>(DEFAULT_WIDE_COLUMNS);
  const [sortColumn, setSortColumn] = useState<string | null>('noteFld');
  const [sortReverse, setSortReverse] = useState(false);

  const [ids, setIds] = useState<number[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cacheGeneration, setCacheGeneration] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const lastSelectedIdRef = useRef<number | null>(null);

  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [showWidePreview, setShowWidePreview] = useState(true);

  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [columnsSheetOpen, setColumnsSheetOpen] = useState(false);

  // Sync external initialQuery prop changes (e.g., navigation from duplicate warning)
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQueryText(initialQuery);
      setDebouncedQuery(initialQuery);
      setFilters(parseQueryToFilters(initialQuery));
    }
  }, [initialQuery]);

  // Load initial browser mode, available columns, and saved prefs
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      anki.getConfigBool(BROWSER_TABLE_SHOW_NOTES_MODE).catch(() => false),
      anki.browserColumns().catch(() => []),
    ]).then(([notesMode, cols]) => {
      if (cancelled) return;
      setIsNotesMode(notesMode);
      setAllColumns(cols);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate column & sort prefs when mode or prefs update
  useEffect(() => {
    const colKey = isNotesMode ? 'browser.columns.notes' : 'browser.columns.cards';
    const savedCols = prefs[colKey];
    if (Array.isArray(savedCols) && savedCols.length > 0) {
      const valid = savedCols.filter((c): c is string => typeof c === 'string');
      if (valid.length > 0) setWideColumns(valid);
    } else {
      setWideColumns(DEFAULT_WIDE_COLUMNS);
    }

    const savedSortCol = prefs['browser.sortColumn'];
    if (typeof savedSortCol === 'string' && savedSortCol.length > 0) {
      setSortColumn(savedSortCol);
    }
    if (typeof prefs['browser.sortReverse'] === 'boolean') {
      setSortReverse(prefs['browser.sortReverse']);
    }
  }, [isNotesMode, prefs]);

  // Debounce free-text query edits
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryText);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryText]);

  // Back handler exits selection mode / preview sheet first on phone
  useEffect(() => {
    return registerBackHandler(() => {
      if (previewSheetOpen) {
        setPreviewSheetOpen(false);
        return true;
      }
      if (sortSheetOpen) {
        setSortSheetOpen(false);
        return true;
      }
      if (columnsSheetOpen) {
        setColumnsSheetOpen(false);
        return true;
      }
      if (selectionMode || selectedIds.size > 0) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        return true;
      }
      return false;
    });
  }, [
    registerBackHandler,
    previewSheetOpen,
    sortSheetOpen,
    columnsSheetOpen,
    selectionMode,
    selectedIds.size,
  ]);

  const sortableColumns = useMemo(() => {
    return allColumns.filter((col) => {
      const mode = isNotesMode ? col.sortingNotes : col.sortingCards;
      return mode !== undefined && mode !== ankiProto.search.BrowserColumns.Sorting.SORTING_NONE;
    });
  }, [allColumns, isNotesMode]);

  const effectiveActiveColumns = useMemo(() => {
    return isWide ? wideColumns : MOBILE_ACTIVE_COLUMNS;
  }, [isWide, wideColumns]);

  const runSearch = useCallback(async () => {
    setLoadingSearch(true);
    setSearchError(null);
    try {
      // CRITICAL: always setActiveBrowserColumns BEFORE browserRowForId can run
      await anki.setActiveBrowserColumns(effectiveActiveColumns);

      let order: anki.SortOrder = { none: {} };
      if (sortColumn) {
        const colMeta = allColumns.find((c) => c.key === sortColumn);
        const mode = isNotesMode ? colMeta?.sortingNotes : colMeta?.sortingCards;
        const canSort =
          allColumns.length === 0 ||
          (mode !== undefined && mode !== ankiProto.search.BrowserColumns.Sorting.SORTING_NONE);
        if (canSort) {
          order = { builtin: { column: sortColumn, reverse: sortReverse } };
        }
      }

      const trimmed = debouncedQuery.trim();
      const resultIds = isNotesMode
        ? await anki.searchNotes(trimmed, order)
        : await anki.searchCards(trimmed, order);

      setIds(resultIds);
      setCacheGeneration((g) => g + 1);
      setActiveItemId((prev) => {
        if (prev !== null && resultIds.includes(prev)) return prev;
        return isWide && resultIds.length > 0 ? resultIds[0] : null;
      });
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : '카드 검색에 실패했습니다.'
      );
    } finally {
      setLoadingSearch(false);
    }
  }, [
    debouncedQuery,
    isNotesMode,
    sortColumn,
    sortReverse,
    effectiveActiveColumns,
    allColumns,
    isWide,
  ]);

  useEffect(() => {
    void runSearch();
  }, [runSearch, collectionVersion]);

  // Ctrl/Cmd+A selects all search results in wide mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (ids.length === 0) return;
        e.preventDefault();
        setSelectionMode(true);
        setSelectedIds(new Set(ids));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ids]);

  const handleFiltersChange = async (next: BrowserFilterState) => {
    setFilters(next);
    try {
      const composed = await composeQueryFromFilters(next);
      setQueryText(composed);
      setDebouncedQuery(composed);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '필터 조건을 조합하지 못했습니다.',
        'error'
      );
    }
  };

  const handleManualQueryChange = (val: string) => {
    setQueryText(val);
    setFilters(parseQueryToFilters(val));
  };

  const handleResetAll = () => {
    const empty: BrowserFilterState = {
      states: [],
      tags: [],
      addedToday: false,
      freeText: '',
    };
    setFilters(empty);
    setQueryText('');
    setDebouncedQuery('');
  };

  const handleToggleMode = async (notesMode: boolean) => {
    if (notesMode === isNotesMode) return;
    setIsNotesMode(notesMode);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setActiveItemId(null);
    try {
      await anki.setConfigBool(BROWSER_TABLE_SHOW_NOTES_MODE, notesMode, false);
    } catch {
      // Non-fatal
    }
  };

  const handleSortColumn = (colKey: string) => {
    let nextRev = false;
    if (sortColumn === colKey) {
      nextRev = !sortReverse;
    } else {
      const meta = allColumns.find((c) => c.key === colKey);
      const mode = isNotesMode ? meta?.sortingNotes : meta?.sortingCards;
      nextRev = mode === ankiProto.search.BrowserColumns.Sorting.SORTING_DESCENDING;
    }
    setSortColumn(colKey);
    setSortReverse(nextRev);
    void setPref('browser.sortColumn', colKey).catch(() => undefined);
    void setPref('browser.sortReverse', nextRev).catch(() => undefined);
  };

  const handleToggleSelect = (id: number, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdRef.current !== null) {
        const a = ids.indexOf(lastSelectedIdRef.current);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) {
            next.add(ids[i]);
          }
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastSelectedIdRef.current = id;
      return next;
    });
  };

  const handleEnterSelectionMode = (initialId: number) => {
    setSelectionMode(true);
    lastSelectedIdRef.current = initialId;
    setSelectedIds(new Set([initialId]));
  };

  const handleTapItem = (id: number, e: MouseEvent) => {
    if (isWide) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        handleToggleSelect(id, e.shiftKey);
      } else {
        setActiveItemId(id);
      }
    } else {
      setActiveItemId(id);
      setPreviewSheetOpen(true);
    }
  };

  const handleToggleWideColumn = (colKey: string) => {
    const exists = wideColumns.includes(colKey);
    if (exists && wideColumns.length <= 1) {
      showToast('최소 1개 이상의 열을 표시해야 합니다.');
      return;
    }
    const next = exists
      ? wideColumns.filter((k) => k !== colKey)
      : [...wideColumns, colKey];
    setWideColumns(next);
    const prefKey = isNotesMode ? 'browser.columns.notes' : 'browser.columns.cards';
    void setPref(prefKey, next).catch(() => undefined);
  };

  const activeSortLabel = useMemo(() => {
    if (!sortColumn) return '정렬 없음';
    const meta = allColumns.find((c) => c.key === sortColumn);
    const label =
      (isNotesMode ? meta?.notesModeLabel : meta?.cardsModeLabel) || sortColumn;
    return `${label} ${sortReverse ? '↓' : '↑'}`;
  }, [sortColumn, sortReverse, allColumns, isNotesMode]);

  const hasAnyActiveFilter =
    Boolean(queryText.trim()) ||
    Boolean(filters.deck) ||
    filters.states.length > 0 ||
    filters.flag !== undefined ||
    filters.tags.length > 0 ||
    filters.addedToday;

  const allSelected = ids.length > 0 && selectedIds.size === ids.length;

  return (
    <div className="amgi-browser-root" data-testid="browser-view">
      <div className="amgi-browser-header">
        {/* Row 1: Search + Cards/Notes Toggle + Actions */}
        <div className="amgi-browser-search-row">
          <div className="amgi-browser-search-wrap">
            <span className="amgi-browser-search-icon">
              <IconSearch size={17} />
            </span>
            <input
              type="search"
              className={`amgi-browser-search-input ${queryText ? 'has-clear' : ''}`.trim()}
              placeholder={isWide ? '검색어 또는 조건 입력 (예: deck:일본어)' : '카드·태그 검색'}
              value={queryText}
              onChange={(e) => handleManualQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setDebouncedQuery(queryText);
                }
              }}
              aria-label="카드 또는 노트 검색"
            />
            {queryText && (
              <button
                type="button"
                className="amgi-browser-search-clear"
                aria-label="검색어 지우기"
                onClick={handleResetAll}
              >
                <IconClose size={16} />
              </button>
            )}
          </div>

          <div
            className="amgi-browser-mode-toggle"
            role="group"
            aria-label="보기 단위 전환"
          >
            <button
              type="button"
              className={`amgi-browser-mode-btn ${!isNotesMode ? 'active' : ''}`}
              aria-pressed={!isNotesMode}
              onClick={() => void handleToggleMode(false)}
            >
              카드
            </button>
            <button
              type="button"
              className={`amgi-browser-mode-btn ${isNotesMode ? 'active' : ''}`}
              aria-pressed={isNotesMode}
              onClick={() => void handleToggleMode(true)}
            >
              노트
            </button>
          </div>

          {isWide ? (
            <>
              <button
                type="button"
                className="amgi-browser-compact-btn"
                onClick={() => setColumnsSheetOpen(true)}
              >
                열 설정
              </button>
              <button
                type="button"
                className={`amgi-browser-compact-btn ${showWidePreview ? 'active' : ''}`}
                onClick={() => setShowWidePreview((v) => !v)}
              >
                <IconEye size={16} />
                <span>{showWidePreview ? '미리보기' : '미리보기 켜기'}</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-primary amgi-btn-sm"
                onClick={() => navigate('#/note/new')}
              >
                <IconPlus size={16} />
                <span>새 노트</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`amgi-browser-compact-btn ${selectionMode ? 'active' : ''}`}
              aria-pressed={selectionMode}
              onClick={() => {
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                } else {
                  setSelectionMode(true);
                }
              }}
            >
              <span>{selectionMode ? '완료' : '선택'}</span>
            </button>
          )}
        </div>

        {/* Row 2: 1-Tap Korean Filter Strip */}
        <FilterBarAndSheet
          filters={filters}
          onChangeFilters={(next) => void handleFiltersChange(next)}
          onResetAll={handleResetAll}
          hasAnyActive={hasAnyActiveFilter}
        />

        {/* Row 3: Count + Select All + Sort */}
        <div className="amgi-browser-status-strip">
          <div className="amgi-browser-status-left">
            <span className="tabular" style={{ fontWeight: 700, color: 'var(--text)' }}>
              {loadingSearch
                ? '검색 중...'
                : `검색 결과 ${ids.length.toLocaleString()}${isNotesMode ? '개' : '장'}`}
            </span>
            {(selectionMode || isWide) && ids.length > 0 && (
              <button
                type="button"
                className="amgi-browser-sort-btn"
                onClick={() => {
                  if (allSelected) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectionMode(true);
                    setSelectedIds(new Set(ids));
                  }
                }}
              >
                <span>{allSelected ? '모두 해제' : '모두 선택'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="amgi-browser-sort-btn"
            onClick={() => setSortSheetOpen(true)}
          >
            <span>정렬: {activeSortLabel}</span>
          </button>
        </div>
      </div>

      {searchError ? (
        <div style={{ padding: 16 }}>
          <ErrorState
            title="검색을 불러오지 못했습니다"
            message={searchError}
            onRetry={() => void runSearch()}
          />
        </div>
      ) : (
        <div
          className={`amgi-browser-workspace ${
            isWide && showWidePreview ? 'with-preview' : ''
          }`.trim()}
        >
          <div className="amgi-browser-list-pane">
            <VirtualBrowserList
              ids={ids}
              isNotesMode={isNotesMode}
              isWide={isWide}
              isEink={isEink}
              activeColumns={effectiveActiveColumns}
              allColumns={allColumns}
              selectedIds={selectedIds}
              selectionMode={selectionMode}
              activeItemId={activeItemId}
              sortColumn={sortColumn}
              sortReverse={sortReverse}
              cacheGeneration={cacheGeneration}
              loadingSearch={loadingSearch}
              onTapItem={handleTapItem}
              onToggleSelect={handleToggleSelect}
              onEnterSelectionMode={handleEnterSelectionMode}
              onSortColumn={handleSortColumn}
            />
          </div>

          {isWide && showWidePreview && (
            <BrowserPreviewPane
              activeItemId={activeItemId}
              isNotesMode={isNotesMode}
              onMutated={() => void runSearch()}
              onHidePane={() => setShowWidePreview(false)}
            />
          )}
        </div>
      )}

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        isNotesMode={isNotesMode}
        onClearSelection={() => {
          setSelectedIds(new Set());
          setSelectionMode(false);
        }}
        onMutated={() => void runSearch()}
      />

      {/* Mobile Preview Sheet */}
      {!isWide && (
        <BrowserPreviewSheet
          open={previewSheetOpen}
          onClose={() => setPreviewSheetOpen(false)}
          ids={ids}
          activeItemId={activeItemId}
          isNotesMode={isNotesMode}
          onSelectId={(nextId) => setActiveItemId(nextId)}
          onMutated={() => void runSearch()}
        />
      )}

      {/* Sort Picker Sheet */}
      <SheetOrDialog
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        title="정렬 기준"
      >
        <div className="amgi-filter-list">
          <button
            type="button"
            className={`amgi-filter-option ${sortColumn === null ? 'selected' : ''}`}
            onClick={() => {
              setSortColumn(null);
              setSortReverse(false);
              setSortSheetOpen(false);
            }}
          >
            <span>정렬 없음</span>
            {sortColumn === null && <IconCheck size={18} />}
          </button>
          {sortableColumns.map((col) => {
            const key = col.key ?? '';
            const label =
              (isNotesMode ? col.notesModeLabel : col.cardsModeLabel) || key;
            const isSelected = sortColumn === key;
            return (
              <button
                key={key}
                type="button"
                className={`amgi-filter-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  handleSortColumn(key);
                  setSortSheetOpen(false);
                }}
              >
                <span>
                  {label}{' '}
                  {isSelected ? (sortReverse ? '(내림차순 ↓)' : '(오름차순 ↑)') : ''}
                </span>
                {isSelected && <IconCheck size={18} />}
              </button>
            );
          })}
        </div>
      </SheetOrDialog>

      {/* Wide Column Visibility Sheet */}
      <SheetOrDialog
        open={columnsSheetOpen}
        onClose={() => setColumnsSheetOpen(false)}
        title="표 열 설정"
        subtitle="표에 표시할 항목을 선택하세요"
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-primary"
            onClick={() => setColumnsSheetOpen(false)}
          >
            완료
          </button>
        }
      >
        <div className="amgi-filter-list">
          {allColumns.map((col) => {
            const key = col.key ?? '';
            const label =
              (isNotesMode ? col.notesModeLabel : col.cardsModeLabel) || key;
            const visible = wideColumns.includes(key);
            return (
              <button
                key={key}
                type="button"
                className={`amgi-filter-option ${visible ? 'selected' : ''}`}
                onClick={() => handleToggleWideColumn(key)}
              >
                <span>{label}</span>
                {visible && <IconCheck size={18} />}
              </button>
            );
          })}
        </div>
      </SheetOrDialog>
    </div>
  );
};
