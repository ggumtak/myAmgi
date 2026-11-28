import { useEffect, useMemo, useState } from 'react';
import * as anki from '../../anki';
import { IconCheck, IconChevronDown, IconClose, IconSearch, SheetOrDialog } from '../../ui';

export interface BrowserFilterState {
  deck?: string;
  states: number[];
  flag?: number;
  tags: string[];
  addedToday: boolean;
  freeText: string;
}

export const STATE_OPTIONS: Array<{ value: number; label: string; token: string }> = [
  { value: anki.SearchCardState.CARD_STATE_NEW, label: '새 카드', token: 'is:new' },
  { value: anki.SearchCardState.CARD_STATE_LEARN, label: '학습 중', token: 'is:learn' },
  { value: anki.SearchCardState.CARD_STATE_REVIEW, label: '복습', token: 'is:review' },
  { value: anki.SearchCardState.CARD_STATE_DUE, label: '오늘 만기', token: 'is:due' },
  { value: anki.SearchCardState.CARD_STATE_SUSPENDED, label: '일시 중지', token: 'is:suspended' },
  { value: anki.SearchCardState.CARD_STATE_BURIED, label: '숨김', token: 'is:buried' },
];

export const FLAG_OPTIONS: Array<{
  searchFlag: number;
  cardFlag: number;
  label: string;
  cssVar: string;
}> = [
  { searchFlag: anki.SearchFlag.FLAG_ANY, cardFlag: 0, label: '깃발 있음 (전체)', cssVar: 'var(--text)' },
  { searchFlag: anki.SearchFlag.FLAG_RED, cardFlag: 1, label: '1 빨강', cssVar: 'var(--flag-1)' },
  { searchFlag: anki.SearchFlag.FLAG_ORANGE, cardFlag: 2, label: '2 주황', cssVar: 'var(--flag-2)' },
  { searchFlag: anki.SearchFlag.FLAG_GREEN, cardFlag: 3, label: '3 초록', cssVar: 'var(--flag-3)' },
  { searchFlag: anki.SearchFlag.FLAG_BLUE, cardFlag: 4, label: '4 파랑', cssVar: 'var(--flag-4)' },
  { searchFlag: anki.SearchFlag.FLAG_PINK, cardFlag: 5, label: '5 분홍', cssVar: 'var(--flag-5)' },
  { searchFlag: anki.SearchFlag.FLAG_TURQUOISE, cardFlag: 6, label: '6 청록', cssVar: 'var(--flag-6)' },
  { searchFlag: anki.SearchFlag.FLAG_PURPLE, cardFlag: 7, label: '7 보라', cssVar: 'var(--flag-7)' },
];

/** Splits a search string into top-level tokens, keeping quotes and escapes verbatim. */
export function tokenizeQuery(query: string): { tokens: string[]; hasGrouping: boolean } {
  const tokens: string[] = [];
  let cur = '';
  let inQuotes = false;
  let depth = 0;
  let hasGrouping = false;
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (ch === '\\' && i + 1 < query.length) {
      cur += ch + query[i + 1];
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (!inQuotes && (ch === '(' || ch === ')')) {
      hasGrouping = true;
      depth += ch === '(' ? 1 : -1;
      cur += ch;
      continue;
    }
    if (!inQuotes && depth <= 0 && /\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  if (tokens.some((t) => t.toLowerCase() === 'or')) hasGrouping = true;
  return { tokens, hasGrouping };
}

/**
 * Unescapes a search value (`JLPT\_N5` -> `JLPT_N5`). Returns null when the value
 * contains an unescaped wildcard (`*`, `_`), i.e. it is a pattern rather than one exact name.
 */
export function unescapeExactValue(raw: string): string | null {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\') {
      if (i + 1 >= raw.length) return null;
      out += raw[i + 1];
      i++;
    } else if (ch === '*' || ch === '_') {
      return null;
    } else if (ch === '"') {
      return null;
    } else {
      out += ch;
    }
  }
  return out;
}

/** `deck:x`, `deck:"x y"` or `"deck:x y"` -> exact value after `prefix`, or null. */
function exactValueFor(tok: string, prefix: string): string | null {
  let body = tok;
  if (body.length >= 2 && body.startsWith('"') && body.endsWith('"')) {
    body = body.slice(1, -1);
  }
  if (!body.toLowerCase().startsWith(prefix)) return null;
  let val = body.slice(prefix.length);
  if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1);
  }
  if (!val) return null;
  return unescapeExactValue(val);
}

const EMPTY_FILTERS: BrowserFilterState = {
  states: [],
  tags: [],
  addedToday: false,
  freeText: '',
};

/**
 * Splits an incoming search (URL, sidebar) into chip state and free text. Only exact,
 * unambiguous forms become chips; everything else stays verbatim in `freeText`, so
 * `compose(parse(q))` always searches for the same thing as `q`:
 * - queries with `OR` or parentheses are left entirely as free text;
 * - a chip is extracted only when its kind appears exactly once (two `tag:` terms are an
 *   AND, which the multi-select chips — an OR — cannot represent);
 * - wildcard values and negated terms stay free text.
 */
export function parseQueryToFilters(query: string): BrowserFilterState {
  const trimmed = query.trim();
  if (!trimmed) return { ...EMPTY_FILTERS, states: [], tags: [] };
  const { tokens, hasGrouping } = tokenizeQuery(trimmed);
  if (hasGrouping) return { ...EMPTY_FILTERS, states: [], tags: [], freeText: trimmed };

  const lowerOf = (t: string) => t.toLowerCase().replace(/^"/, '');
  const countKind = (prefix: string) => tokens.filter((t) => lowerOf(t).startsWith(prefix)).length;

  const result: BrowserFilterState = { states: [], tags: [], addedToday: false, freeText: '' };
  const leftover: string[] = [];
  const singleDeck = countKind('deck:') === 1;
  const singleTag = countKind('tag:') === 1;
  const singleState = countKind('is:') === 1;
  const singleFlag = countKind('flag:') === 1;

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (singleDeck && lowerOf(tok).startsWith('deck:')) {
      const val = exactValueFor(tok, 'deck:');
      if (val) {
        result.deck = val;
        continue;
      }
    } else if (singleTag && lowerOf(tok).startsWith('tag:')) {
      const val = exactValueFor(tok, 'tag:');
      if (val && val.toLowerCase() !== 'none') {
        result.tags = [val];
        continue;
      }
    } else if (singleState && lower.startsWith('is:')) {
      const st = STATE_OPTIONS.find((o) => o.token === lower);
      if (st) {
        result.states = [st.value];
        continue;
      }
    } else if (singleFlag && lower.startsWith('flag:')) {
      const num = Number(lower.slice(5));
      const found = FLAG_OPTIONS.find((f) => f.cardFlag === num && num >= 1);
      if (found) {
        result.flag = found.searchFlag;
        continue;
      }
    } else if (lower === 'added:1' && !result.addedToday) {
      result.addedToday = true;
      continue;
    }
    leftover.push(tok);
  }
  result.freeText = leftover.join(' ');
  return result;
}

/** The structured (chip) part of the filters as one SearchNode, or null when no chip is set. */
export function buildFilterNode(filters: BrowserFilterState): anki.SearchNode | null {
  const nodes: anki.SearchNode[] = [];

  if (filters.deck) {
    nodes.push({ deck: filters.deck });
  }
  if (filters.states.length === 1) {
    nodes.push({ cardState: filters.states[0] });
  } else if (filters.states.length > 1) {
    nodes.push({
      group: {
        joiner: anki.SearchNodeJoiner.OR,
        nodes: filters.states.map((s) => ({ cardState: s })),
      },
    });
  }
  if (filters.flag !== undefined) {
    nodes.push({ flag: filters.flag });
  }
  if (filters.tags.length === 1) {
    nodes.push({ tag: filters.tags[0] });
  } else if (filters.tags.length > 1) {
    nodes.push({
      group: {
        joiner: anki.SearchNodeJoiner.OR,
        nodes: filters.tags.map((t) => ({ tag: t })),
      },
    });
  }
  if (filters.addedToday) {
    nodes.push({ addedInDays: 1 });
  }

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return { group: { joiner: anki.SearchNodeJoiner.AND, nodes } };
}

/**
 * ANDs the structured part with the user's free text. Free text with a top-level OR is
 * parenthesised, because implicit AND binds tighter than OR in Anki searches.
 */
export function joinStructuredAndFree(structured: string, freeText: string): string {
  const s = structured.trim();
  const f = freeText.trim();
  if (!s) return f;
  if (!f) return s;
  const { tokens } = tokenizeQuery(f);
  const needsParens = tokens.some((t) => t.toLowerCase() === 'or');
  return `${s} ${needsParens ? `(${f})` : f}`;
}

export async function composeQueryFromFilters(filters: BrowserFilterState): Promise<string> {
  const node = buildFilterNode(filters);
  const structured = node ? await anki.buildSearchString(node) : '';
  return joinStructuredAndFree(structured, filters.freeText);
}

export interface FilterBarAndSheetProps {
  filters: BrowserFilterState;
  onChangeFilters: (next: BrowserFilterState) => void;
  onResetAll: () => void;
  hasAnyActive: boolean;
}

type ActiveSheet = null | 'deck' | 'state' | 'flag' | 'tag';

export function FilterBarAndSheet({
  filters,
  onChangeFilters,
  onResetAll,
  hasAnyActive,
}: FilterBarAndSheetProps) {
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [deckFilter, setDeckFilter] = useState('');

  useEffect(() => {
    if (sheet === 'deck') {
      anki
        .getDeckNames(false, true)
        .then((list) => setDecks(list))
        .catch(() => setDecks([]));
    } else if (sheet === 'tag') {
      anki
        .getAllTags()
        .then((list) => setAllTags(list))
        .catch(() => setAllTags([]));
    }
  }, [sheet]);

  const filteredDecks = useMemo(() => {
    const q = deckFilter.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((d) => (d.name ?? '').toLowerCase().includes(q));
  }, [decks, deckFilter]);

  const filteredTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase();
    const list = allTags.includes('marked') ? allTags : ['marked', ...allTags];
    if (!q) return list;
    return list.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, tagFilter]);

  const deckLabel = filters.deck ? `덱: ${filters.deck}` : '덱: 전체';
  const stateLabel =
    filters.states.length === 0
      ? '상태'
      : filters.states.length === 1
        ? `상태: ${STATE_OPTIONS.find((s) => s.value === filters.states[0])?.label ?? '선택됨'}`
        : `상태: ${filters.states.length}개`;
  const flagOption = FLAG_OPTIONS.find((f) => f.searchFlag === filters.flag);
  const flagLabel = flagOption ? `깃발: ${flagOption.label}` : '깃발';
  const tagLabel =
    filters.tags.length === 0
      ? '태그'
      : filters.tags.length === 1
        ? `태그: ${filters.tags[0] === 'marked' ? '표시됨(별표)' : filters.tags[0]}`
        : `태그: ${filters.tags.length}개`;

  const toggleState = (val: number) => {
    const exists = filters.states.includes(val);
    const nextStates = exists
      ? filters.states.filter((v) => v !== val)
      : [...filters.states, val];
    onChangeFilters({ ...filters, states: nextStates });
  };

  const toggleTag = (tag: string) => {
    const exists = filters.tags.includes(tag);
    const nextTags = exists
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChangeFilters({ ...filters, tags: nextTags });
  };

  return (
    <>
      <div className="amgi-filter-strip" role="toolbar" aria-label="빠른 필터">
        <button
          type="button"
          className={`amgi-filter-chip ${filters.deck ? 'active' : ''}`}
          aria-pressed={Boolean(filters.deck)}
          onClick={() => {
            setDeckFilter('');
            setSheet('deck');
          }}
        >
          <span>{deckLabel}</span>
          <IconChevronDown size={14} />
        </button>

        <button
          type="button"
          className={`amgi-filter-chip ${filters.states.length > 0 ? 'active' : ''}`}
          aria-pressed={filters.states.length > 0}
          onClick={() => setSheet('state')}
        >
          <span>{stateLabel}</span>
          <IconChevronDown size={14} />
        </button>

        <button
          type="button"
          className={`amgi-filter-chip ${filters.flag !== undefined ? 'active' : ''}`}
          aria-pressed={filters.flag !== undefined}
          onClick={() => setSheet('flag')}
        >
          <span>{flagLabel}</span>
          <IconChevronDown size={14} />
        </button>

        <button
          type="button"
          className={`amgi-filter-chip ${filters.tags.length > 0 ? 'active' : ''}`}
          aria-pressed={filters.tags.length > 0}
          onClick={() => {
            setTagFilter('');
            setSheet('tag');
          }}
        >
          <span>{tagLabel}</span>
          <IconChevronDown size={14} />
        </button>

        <button
          type="button"
          className={`amgi-filter-chip ${filters.addedToday ? 'active' : ''}`}
          aria-pressed={filters.addedToday}
          onClick={() => onChangeFilters({ ...filters, addedToday: !filters.addedToday })}
        >
          <span>오늘 추가</span>
        </button>

        {hasAnyActive && (
          <button
            type="button"
            className="amgi-filter-chip amgi-filter-chip-reset"
            onClick={onResetAll}
          >
            <IconClose size={14} />
            <span>초기화</span>
          </button>
        )}
      </div>

      {/* Deck Picker Sheet */}
      <SheetOrDialog
        open={sheet === 'deck'}
        onClose={() => setSheet(null)}
        title="덱 선택"
        subtitle="특정 덱의 카드만 모아 봅니다"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="amgi-browser-search-wrap">
            <span className="amgi-browser-search-icon">
              <IconSearch size={16} />
            </span>
            <input
              type="search"
              className="amgi-browser-search-input"
              placeholder="덱 이름 찾기..."
              value={deckFilter}
              onChange={(e) => setDeckFilter(e.target.value)}
            />
          </div>
          <div className="amgi-filter-list">
            <button
              type="button"
              className={`amgi-filter-option ${!filters.deck ? 'selected' : ''}`}
              onClick={() => {
                onChangeFilters({ ...filters, deck: undefined });
                setSheet(null);
              }}
            >
              <span>전체 덱</span>
              {!filters.deck && <IconCheck size={18} />}
            </button>
            {filteredDecks.map((d) => {
              const name = d.name ?? '';
              const depth = Math.max(0, name.split('::').length - 1);
              const isSelected = filters.deck === name;
              return (
                <button
                  key={String(d.id ?? name)}
                  type="button"
                  className={`amgi-filter-option ${isSelected ? 'selected' : ''}`}
                  style={{ paddingLeft: 14 + depth * 16 }}
                  onClick={() => {
                    onChangeFilters({ ...filters, deck: name });
                    setSheet(null);
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                  </span>
                  {isSelected && <IconCheck size={18} />}
                </button>
              );
            })}
          </div>
        </div>
      </SheetOrDialog>

      {/* State Picker Sheet */}
      <SheetOrDialog
        open={sheet === 'state'}
        onClose={() => setSheet(null)}
        title="카드 상태 필터"
        subtitle="여러 상태를 함께 선택할 수 있습니다"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => onChangeFilters({ ...filters, states: [] })}
            >
              전체 해제
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              onClick={() => setSheet(null)}
            >
              적용
            </button>
          </>
        }
      >
        <div className="amgi-filter-list">
          {STATE_OPTIONS.map((opt) => {
            const selected = filters.states.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`amgi-filter-option ${selected ? 'selected' : ''}`}
                onClick={() => toggleState(opt.value)}
              >
                <span>{opt.label}</span>
                {selected && <IconCheck size={18} />}
              </button>
            );
          })}
        </div>
      </SheetOrDialog>

      {/* Flag Picker Sheet */}
      <SheetOrDialog
        open={sheet === 'flag'}
        onClose={() => setSheet(null)}
        title="깃발 필터"
      >
        <div className="amgi-filter-list">
          <button
            type="button"
            className={`amgi-filter-option ${filters.flag === undefined ? 'selected' : ''}`}
            onClick={() => {
              onChangeFilters({ ...filters, flag: undefined });
              setSheet(null);
            }}
          >
            <span>모든 카드 (깃발 필터 해제)</span>
            {filters.flag === undefined && <IconCheck size={18} />}
          </button>
          {FLAG_OPTIONS.map((opt) => {
            const selected = filters.flag === opt.searchFlag;
            return (
              <button
                key={opt.searchFlag}
                type="button"
                className={`amgi-filter-option ${selected ? 'selected' : ''}`}
                onClick={() => {
                  onChangeFilters({ ...filters, flag: opt.searchFlag });
                  setSheet(null);
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {opt.cardFlag > 0 ? (
                    <span className={`amgi-flag-badge amgi-flag-${opt.cardFlag}`}>
                      {opt.cardFlag}
                    </span>
                  ) : (
                    <span className="amgi-flag-dot" style={{ background: opt.cssVar }} />
                  )}
                  <span>{opt.label}</span>
                </span>
                {selected && <IconCheck size={18} />}
              </button>
            );
          })}
        </div>
      </SheetOrDialog>

      {/* Tag Picker Sheet */}
      <SheetOrDialog
        open={sheet === 'tag'}
        onClose={() => setSheet(null)}
        title="태그 필터"
        subtitle="선택한 태그가 포함된 카드를 봅니다"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => onChangeFilters({ ...filters, tags: [] })}
            >
              전체 해제
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              onClick={() => setSheet(null)}
            >
              적용
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="amgi-browser-search-wrap">
            <span className="amgi-browser-search-icon">
              <IconSearch size={16} />
            </span>
            <input
              type="search"
              className="amgi-browser-search-input"
              placeholder="태그 검색..."
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </div>
          <div className="amgi-filter-list">
            {filteredTags.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)' }}>
                일치하는 태그가 없습니다.
              </div>
            ) : (
              filteredTags.map((tag) => {
                const selected = filters.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`amgi-filter-option ${selected ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    <span>{tag === 'marked' ? '표시됨 (별표 ★)' : tag}</span>
                    {selected && <IconCheck size={18} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SheetOrDialog>
    </>
  );
}
