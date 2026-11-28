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
import { IconCheck } from '../../ui';

export const OVERSCAN = 8;
export const LRU_CACHE_LIMIT = 1500;

export const MOBILE_ACTIVE_COLUMNS = [
  'question',
  'answer',
  'deck',
  'cardDue',
  'cardIvl',
  'noteTags',
  'note',
  'template',
  'noteFld',
];

export const DEFAULT_WIDE_COLUMNS = [
  'question',
  'answer',
  'deck',
  'cardDue',
  'cardIvl',
];

const COLUMN_WIDTH_MAP: Record<string, string> = {
  question: 'minmax(170px, 1.6fr)',
  answer: 'minmax(150px, 1.3fr)',
  deck: '112px',
  cardDue: '112px',
  cardIvl: '86px',
  noteFld: '140px',
  note: '120px',
  template: '110px',
  noteTags: '140px',
  cardEase: '80px',
  difficulty: '80px',
  stability: '84px',
  retrievability: '94px',
  cardReps: '72px',
  cardLapses: '72px',
  originalPosition: '80px',
  noteCrt: '116px',
  noteMod: '116px',
  cardMod: '116px',
};

export function stripBidiIsolates(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[\u2066-\u2069]/g, '');
}

function getRowStatusInfo(color: number | null | undefined): {
  className: string;
  flagNum: number;
  isMarked: boolean;
  isSuspended: boolean;
  isBuried: boolean;
} {
  const c = color ?? anki.BrowserRowColor.COLOR_DEFAULT;
  const isMarked = c === anki.BrowserRowColor.COLOR_MARKED;
  const isSuspended = c === anki.BrowserRowColor.COLOR_SUSPENDED;
  const isBuried = c === anki.BrowserRowColor.COLOR_BURIED;
  let flagNum = 0;
  if (
    c >= anki.BrowserRowColor.COLOR_FLAG_RED &&
    c <= anki.BrowserRowColor.COLOR_FLAG_PURPLE
  ) {
    flagNum = c - anki.BrowserRowColor.COLOR_FLAG_RED + 1;
  }

  const classes: string[] = [];
  if (isSuspended) classes.push('color-suspended');
  else if (isBuried) classes.push('color-buried');
  else if (isMarked) classes.push('color-marked');
  else if (flagNum >= 1 && flagNum <= 7) classes.push(`color-flag-${flagNum}`);

  return {
    className: classes.join(' '),
    flagNum,
    isMarked,
    isSuspended,
    isBuried,
  };
}

export interface VirtualBrowserListProps {
  ids: number[];
  isNotesMode: boolean;
  isWide: boolean;
  isEink: boolean;
  activeColumns: string[];
  allColumns: anki.BrowserColumn[];
  selectedIds: Set<number>;
  selectionMode: boolean;
  activeItemId: number | null;
  sortColumn: string | null;
  sortReverse: boolean;
  cacheGeneration: number;
  loadingSearch: boolean;
  /** Changes when the user runs a distinct query/sort/mode and scroll should reset to top. */
  scrollResetKey?: string;
  /** Optional scroll offset to restore after initial results load (e.g. edit round-trip). */
  initialScrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
  onTapItem: (id: number, e: MouseEvent) => void;
  onToggleSelect: (id: number, shiftKey: boolean) => void;
  onEnterSelectionMode: (initialId: number) => void;
  onSortColumn: (colKey: string) => void;
}

export function VirtualBrowserList({
  ids,
  isNotesMode,
  isWide,
  isEink,
  activeColumns,
  allColumns,
  selectedIds,
  selectionMode,
  activeItemId,
  sortColumn,
  sortReverse,
  cacheGeneration,
  loadingSearch,
  scrollResetKey,
  initialScrollTop,
  onScrollTopChange,
  onTapItem,
  onToggleSelect,
  onEnterSelectionMode,
  onSortColumn,
}: VirtualBrowserListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(520);
  const [scrollTop, setScrollTop] = useState(0);
  const [, setRenderTick] = useState(0);

  const attachScrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollEl(node);
  }, []);

  const rowHeight = isWide ? (isEink ? 56 : 48) : isEink ? 88 : 76;

  // Effective columns requested from backend (must match setActiveBrowserColumns)
  const effectiveColumns = useMemo(() => {
    return isWide ? activeColumns : MOBILE_ACTIVE_COLUMNS;
  }, [isWide, activeColumns]);

  const columnSignature = useMemo(
    () => `${isNotesMode ? 'N' : 'C'}:${effectiveColumns.join(',')}:${cacheGeneration}`,
    [isNotesMode, effectiveColumns, cacheGeneration]
  );

  // LRU cache keyed by id -> BrowserRow for current columnSignature
  const cacheRef = useRef<Map<number, anki.BrowserRow>>(new Map());
  const cacheSigRef = useRef<string>('');
  const activeColsReadySigRef = useRef<string>('');
  const pendingSetColsRef = useRef<Promise<void> | null>(null);
  const inflightRef = useRef<Set<number>>(new Set());
  const fetchTokenRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const restoredScrollRef = useRef(false);
  const prevResetKeyRef = useRef(scrollResetKey);

  if (cacheSigRef.current !== columnSignature) {
    cacheRef.current.clear();
    inflightRef.current.clear();
    cacheSigRef.current = columnSignature;
    fetchTokenRef.current += 1;
  }

  // Measure live scroll viewport height (re-attaches whenever scrollEl remounts after empty state)
  useEffect(() => {
    if (!scrollEl) return;
    const measure = () => {
      if (scrollEl.clientHeight > 0) {
        setViewportH(scrollEl.clientHeight);
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(scrollEl);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [scrollEl]);

  // Reset scroll when the query/sort/mode changes or when results become empty
  useEffect(() => {
    const keyChanged = prevResetKeyRef.current !== scrollResetKey;
    prevResetKeyRef.current = scrollResetKey;

    if (ids.length === 0 || keyChanged) {
      if (scrollEl && scrollEl.scrollTop !== 0) {
        scrollEl.scrollTop = 0;
      }
      setScrollTop(0);
      if (keyChanged && ids.length > 0) {
        restoredScrollRef.current = true;
      }
      return;
    }

    const maxScroll = scrollEl
      ? Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
      : Math.max(0, ids.length * rowHeight - viewportH);

    // Restore saved scroll offset once after initial results load (e.g. edit round-trip)
    if (!restoredScrollRef.current && initialScrollTop && initialScrollTop > 0 && scrollEl) {
      const clamped = Math.min(initialScrollTop, maxScroll);
      restoredScrollRef.current = true;
      scrollEl.scrollTop = clamped;
      setScrollTop(clamped);
      return;
    }

    // Clamp scrollTop only when list shrinks below current offset (never while user scrolls)
    const currentTop = scrollEl ? scrollEl.scrollTop : 0;
    if (currentTop > maxScroll) {
      if (scrollEl) scrollEl.scrollTop = maxScroll;
      setScrollTop(maxScroll);
    }
  }, [ids, ids.length, rowHeight, viewportH, scrollEl, scrollResetKey, initialScrollTop]);

  // Cleanup any pending long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  const { startIdx, visibleIds } = useMemo(() => {
    if (ids.length === 0) {
      return { startIdx: 0, visibleIds: [] as number[] };
    }
    const maxScroll = Math.max(0, ids.length * rowHeight - viewportH);
    const effectiveScrollTop = Math.max(0, Math.min(scrollTop, maxScroll));
    const start = Math.max(0, Math.floor(effectiveScrollTop / rowHeight) - OVERSCAN);
    const end = Math.min(
      ids.length - 1,
      Math.ceil((effectiveScrollTop + viewportH) / rowHeight) + OVERSCAN
    );
    return {
      startIdx: start,
      visibleIds: ids.slice(start, end + 1),
    };
  }, [ids, scrollTop, viewportH, rowHeight]);

  const ensureColumnsSet = useCallback(async (): Promise<void> => {
    const colKey = `${isNotesMode ? 'N' : 'C'}:${effectiveColumns.join(',')}`;
    if (activeColsReadySigRef.current === colKey) return;
    if (pendingSetColsRef.current) {
      await pendingSetColsRef.current;
      return;
    }
    const task = anki.setActiveBrowserColumns(effectiveColumns).then(() => {
      activeColsReadySigRef.current = colKey;
    });
    pendingSetColsRef.current = task;
    try {
      await task;
    } finally {
      pendingSetColsRef.current = null;
    }
  }, [effectiveColumns, isNotesMode]);

  // Fetch uncached visible rows through bounded concurrency queue
  useEffect(() => {
    if (visibleIds.length === 0) return;
    const missing = visibleIds.filter(
      (id) => !cacheRef.current.has(id) && !inflightRef.current.has(id)
    );
    if (missing.length === 0) return;

    const myToken = fetchTokenRef.current;
    let cancelled = false;
    const maxConcurrent = isEink ? 3 : 6;
    let cursor = 0;
    let flushScheduled = false;

    const scheduleFlush = () => {
      if (flushScheduled || cancelled) return;
      flushScheduled = true;
      queueMicrotask(() => {
        flushScheduled = false;
        if (!cancelled && fetchTokenRef.current === myToken) {
          setRenderTick((t) => t + 1);
        }
      });
    };

    const run = async () => {
      try {
        await ensureColumnsSet();
      } catch {
        return;
      }
      if (cancelled || fetchTokenRef.current !== myToken) return;

      const worker = async () => {
        while (!cancelled && fetchTokenRef.current === myToken) {
          const idx = cursor++;
          if (idx >= missing.length) break;
          const id = missing[idx];
          if (cacheRef.current.has(id) || inflightRef.current.has(id)) continue;
          inflightRef.current.add(id);
          try {
            const row = await anki.browserRowForId(id);
            if (!cancelled && fetchTokenRef.current === myToken) {
              if (cacheRef.current.size >= LRU_CACHE_LIMIT) {
                const oldestKey = cacheRef.current.keys().next().value;
                if (oldestKey !== undefined) {
                  cacheRef.current.delete(oldestKey);
                }
              }
              cacheRef.current.set(id, row);
              scheduleFlush();
            }
          } catch {
            // Ignore transient row fetch failures (e.g. deleted row)
          } finally {
            inflightRef.current.delete(id);
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(maxConcurrent, missing.length) },
        () => worker()
      );
      await Promise.all(workers);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [visibleIds, ensureColumnsSet, isEink, columnSignature]);

  const colIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    effectiveColumns.forEach((k, idx) => map.set(k, idx));
    return map;
  }, [effectiveColumns]);

  const colMetaMap = useMemo(() => {
    const map = new Map<string, anki.BrowserColumn>();
    for (const col of allColumns) {
      if (col.key) map.set(col.key, col);
    }
    return map;
  }, [allColumns]);

  const gridTemplateColumns = useMemo(() => {
    const parts = ['44px'];
    for (const key of effectiveColumns) {
      parts.push(COLUMN_WIDTH_MAP[key] ?? '120px');
    }
    return parts.join(' ');
  }, [effectiveColumns]);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  if (!loadingSearch && ids.length === 0) {
    return (
      <div className="amgi-browser-empty">
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          조건에 맞는 {isNotesMode ? '노트' : '카드'}가 없습니다
        </div>
        <div style={{ fontSize: 13 }}>
          검색어나 필터 조건을 바꾸어 다시 찾아보세요.
        </div>
      </div>
    );
  }

  const totalHeight = ids.length * rowHeight;

  return (
    <div
      ref={attachScrollRef}
      className="amgi-vlist-scroll"
      onScroll={(e) => {
        const nextTop = e.currentTarget.scrollTop;
        setScrollTop(nextTop);
        onScrollTopChange?.(nextTop);
      }}
      data-testid="virtual-browser-scroll"
    >
      {isWide && (
        <div
          className="amgi-table-head"
          style={{ gridTemplateColumns }}
          role="row"
        >
          <div className="amgi-table-cell center">
            <span className="amgi-sr-only">선택</span>
          </div>
          {effectiveColumns.map((colKey) => {
            const meta = colMetaMap.get(colKey);
            const label =
              (isNotesMode ? meta?.notesModeLabel : meta?.cardsModeLabel) || colKey;
            const sortingMode = isNotesMode
              ? meta?.sortingNotes
              : meta?.sortingCards;
            const sortable =
              sortingMode !== undefined &&
              sortingMode !== ankiProto.search.BrowserColumns.Sorting.SORTING_NONE;
            const isSorted = sortColumn === colKey;
            return (
              <button
                key={colKey}
                type="button"
                className="amgi-table-head-cell"
                disabled={!sortable}
                onClick={() => sortable && onSortColumn(colKey)}
                style={{ cursor: sortable ? 'pointer' : 'default' }}
              >
                <span>{label}</span>
                {isSorted && (
                  <span aria-hidden="true">{sortReverse ? '▼' : '▲'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`amgi-vlist-canvas ${!isWide ? 'is-mobile-card' : ''}`.trim()}
        style={{ height: totalHeight }}
      >
        <div
          className="amgi-vlist-window"
          style={{ transform: `translateY(${startIdx * rowHeight}px)` }}
        >
          {visibleIds.map((id, localIdx) => {
            const row = cacheRef.current.get(id);
            // Touch LRU order gently on read
            if (row) {
              cacheRef.current.delete(id);
              cacheRef.current.set(id, row);
            }
            const status = getRowStatusInfo(row?.color);
            const isSelected = selectedIds.has(id);
            const isActive = activeItemId === id;

            const cellText = (key: string): string => {
              const idx = colIndexMap.get(key);
              if (idx === undefined || !row?.cells?.[idx]) return '';
              return stripBidiIsolates(row.cells[idx].text);
            };

            if (!isWide) {
              // Mobile 2-line clean list row
              const qText = cellText('question') || cellText('noteFld') || '(내용 없음)';
              const aText = cellText('answer');
              const deckText = cellText('deck');
              const dueText = cellText('cardDue');
              const ivlText = cellText('cardIvl');

              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  data-row-id={id}
                  data-row-index={startIdx + localIdx}
                  className={`amgi-browser-mobile-row ${status.className} ${
                    isSelected ? 'is-selected' : ''
                  } ${isActive ? 'is-active' : ''}`.trim()}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    longPressFiredRef.current = false;
                    clearLongPress();
                    pointerStartRef.current = { x: e.clientX, y: e.clientY };
                    longPressTimerRef.current = window.setTimeout(() => {
                      longPressFiredRef.current = true;
                      longPressTimerRef.current = null;
                      pointerStartRef.current = null;
                      if (selectionMode || selectedIds.size > 0) {
                        onToggleSelect(id, false);
                      } else {
                        onEnterSelectionMode(id);
                      }
                    }, 450);
                  }}
                  onPointerMove={(e) => {
                    const start = pointerStartRef.current;
                    if (!start) return;
                    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
                      clearLongPress();
                    }
                  }}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onClick={(e) => {
                    if (longPressFiredRef.current) {
                      longPressFiredRef.current = false;
                      return;
                    }
                    if (selectionMode) {
                      onToggleSelect(id, e.shiftKey);
                    } else {
                      onTapItem(id, e);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (selectionMode) {
                        onToggleSelect(id, e.shiftKey);
                      } else {
                        onTapItem(id, e as unknown as MouseEvent);
                      }
                    }
                  }}
                >
                  {selectionMode && (
                    <span
                      className="amgi-browser-row-check-wrap"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(id, e.shiftKey);
                      }}
                    >
                      <span
                        className={`amgi-browser-checkbox ${isSelected ? 'checked' : ''}`}
                      >
                        {isSelected && <IconCheck size={14} />}
                      </span>
                    </span>
                  )}
                  <div className="amgi-browser-mobile-content">
                    {!row ? (
                      <>
                        <div className="amgi-skeleton-line" style={{ width: '68%' }} />
                        <div className="amgi-skeleton-line" style={{ width: '44%', height: 11 }} />
                      </>
                    ) : (
                      <>
                        <div className="amgi-browser-line1">
                          <span className="amgi-browser-q">{qText}</span>
                          <span className="amgi-browser-badges">
                            {status.flagNum > 0 && (
                              <span className={`amgi-flag-badge amgi-flag-${status.flagNum}`}>
                                {status.flagNum}
                              </span>
                            )}
                            {status.isMarked && (
                              <span className="amgi-state-pill marked">★</span>
                            )}
                            {status.isSuspended && (
                              <span className="amgi-state-pill suspended">중지</span>
                            )}
                            {status.isBuried && (
                              <span className="amgi-state-pill buried">숨김</span>
                            )}
                          </span>
                        </div>
                        <div className="amgi-browser-line2 tabular">
                          <span className="amgi-browser-a">
                            {aText || '—'}
                          </span>
                          {deckText && (
                            <>
                              <span className="amgi-browser-meta-dot">·</span>
                              <span className="amgi-browser-meta-deck">{deckText}</span>
                            </>
                          )}
                          {(dueText || ivlText) && (
                            <>
                              <span className="amgi-browser-meta-dot">·</span>
                              <span className="amgi-browser-meta-due">
                                {dueText || ivlText}
                              </span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            // Wide multi-column virtualized row
            return (
              <div
                key={id}
                role="row"
                data-row-id={id}
                data-row-index={startIdx + localIdx}
                className={`amgi-table-row ${status.className} ${
                  isSelected ? 'is-selected' : ''
                } ${isActive ? 'is-active' : ''}`.trim()}
                style={{ gridTemplateColumns }}
                onClick={(e) => onTapItem(id, e)}
              >
                <div
                  className="amgi-table-cell center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(id, e.shiftKey);
                  }}
                >
                  <span
                    role="checkbox"
                    aria-checked={isSelected}
                    className={`amgi-browser-checkbox ${isSelected ? 'checked' : ''}`}
                  >
                    {isSelected && <IconCheck size={14} />}
                  </span>
                </div>
                {effectiveColumns.map((colKey, cIdx) => {
                  const text = row ? cellText(colKey) : '';
                  const isNumericCol =
                    colKey === 'cardDue' ||
                    colKey === 'cardIvl' ||
                    colKey === 'cardEase' ||
                    colKey === 'cardReps' ||
                    colKey === 'cardLapses' ||
                    colKey === 'originalPosition' ||
                    colKey === 'difficulty' ||
                    colKey === 'stability' ||
                    colKey === 'retrievability';
                  return (
                    <div
                      key={colKey}
                      className={`amgi-table-cell ${isNumericCol ? 'tabular' : ''}`.trim()}
                    >
                      {!row ? (
                        <div className="amgi-skeleton-line" style={{ width: '75%' }} />
                      ) : (
                        <>
                          {cIdx === 0 && status.flagNum > 0 && (
                            <span className={`amgi-flag-badge amgi-flag-${status.flagNum}`}>
                              {status.flagNum}
                            </span>
                          )}
                          {cIdx === 0 && status.isMarked && (
                            <span className="amgi-state-pill marked">★</span>
                          )}
                          {cIdx === 0 && status.isSuspended && (
                            <span className="amgi-state-pill suspended">중지</span>
                          )}
                          {cIdx === 0 && status.isBuried && (
                            <span className="amgi-state-pill buried">숨김</span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {text || (cIdx === 0 ? '(내용 없음)' : '')}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
