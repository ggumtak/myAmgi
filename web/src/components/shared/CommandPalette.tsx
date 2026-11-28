import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import { useApp } from '../../context/AppContext';
import {
  IconClose,
  IconDeck,
  IconEdit,
  IconPlay,
  IconSearch,
  IconSettings,
  IconSpark,
  IconStats,
  IconSync,
  IconTag,
  SheetOrDialog,
} from '../../ui';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenTags: () => void;
  onRunSync: () => void;
}

interface PaletteEntry {
  id: string;
  label: string;
  subLabel?: string;
  hint?: string;
  /** Extra text indexed for search (e.g. full deck path). */
  searchText: string;
  group: '덱' | '기능';
  icon: React.ReactNode;
  run: () => void;
}

function splitDeckPath(fullName: string): { leaf: string; parent?: string } {
  const parts = fullName.split('::').filter(Boolean);
  if (parts.length <= 1) {
    return { leaf: fullName };
  }
  return {
    leaf: parts[parts.length - 1],
    parent: parts.slice(0, -1).join(' · '),
  };
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onOpenTags,
  onRunSync,
}) => {
  const { navigate, prefTheme, resolvedTheme, setPref } = useApp();
  const [query, setQuery] = useState('');
  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuery('');
    setActiveIdx(0);
    // skipEmptyDefault = true hides the unused "기본" deck once real decks exist.
    anki
      .getDeckNames(true, true)
      .then((list) => {
        if (!cancelled) setDecks(list);
      })
      .catch(() => {
        if (!cancelled) setDecks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const { items, deckItems, actionItems } = useMemo(() => {
    const themeLabel =
      prefTheme === 'eink'
        ? '일반 화면으로 전환'
        : resolvedTheme === 'dark'
          ? '밝은 화면으로 전환'
          : '어두운 화면으로 전환';
    const nextTheme =
      prefTheme === 'eink'
        ? 'light'
        : resolvedTheme === 'dark'
          ? 'light'
          : 'dark';

    const actions: PaletteEntry[] = [
      {
        id: 'act-add-note',
        label: '새 노트 추가',
        subLabel: '단어장 카드 작성',
        searchText: '새 노트 추가 단어장 카드 작성',
        group: '기능',
        icon: <IconEdit size={18} />,
        run: () => navigate('#/note/new'),
      },
      {
        id: 'act-browse',
        label: '카드 찾아보기',
        subLabel: '검색 · 일괄 편집',
        searchText: '카드 찾아보기 검색 일괄 편집',
        group: '기능',
        icon: <IconSearch size={18} />,
        run: () => navigate('#/browse'),
      },
      {
        id: 'act-stats',
        label: '학습 통계 보기',
        subLabel: '잔디 · 복습 예정 · 정답률',
        searchText: '학습 통계 보기 잔디 복습 예정 정답률',
        group: '기능',
        icon: <IconStats size={18} />,
        run: () => navigate('#/stats'),
      },
      {
        id: 'act-notetypes',
        label: '노트 유형 관리',
        subLabel: '필드 · 카드 템플릿 · 스타일',
        searchText: '노트 유형 관리 필드 카드 템플릿 스타일',
        group: '기능',
        icon: <IconSpark size={18} />,
        run: () => navigate('#/notetypes'),
      },
      {
        id: 'act-tags',
        label: '태그 관리',
        subLabel: '태그 이름 변경 · 정리',
        searchText: '태그 관리 태그 이름 변경 정리',
        group: '기능',
        icon: <IconTag size={18} />,
        run: () => onOpenTags(),
      },
      {
        id: 'act-sync',
        label: '지금 동기화',
        subLabel: 'AnkiWeb 계정 동기화',
        searchText: '지금 동기화 AnkiWeb 계정 동기화',
        group: '기능',
        icon: <IconSync size={18} />,
        run: () => onRunSync(),
      },
      {
        id: 'act-theme',
        label: themeLabel,
        subLabel: '화면 테마 변경',
        searchText: `${themeLabel} 화면 테마 변경 다크 라이트 e-ink`,
        group: '기능',
        icon: <IconSettings size={18} />,
        run: () => {
          void setPref('theme', nextTheme).catch(() => undefined);
        },
      },
      {
        id: 'act-settings',
        label: '설정 열기',
        subLabel: '학습 · 화면 · 백업',
        searchText: '설정 열기 학습 화면 백업',
        group: '기능',
        icon: <IconSettings size={18} />,
        run: () => navigate('#/settings'),
      },
    ];

    const deckEntries: PaletteEntry[] = decks.map((d) => {
      const id = anki.toNumber(d.id);
      const fullName = d.name ?? '덱';
      const { leaf, parent } = splitDeckPath(fullName);
      return {
        id: `deck-${id}`,
        label: leaf,
        subLabel: parent,
        searchText: `${fullName} ${leaf}`,
        group: '덱',
        icon: <IconPlay size={16} />,
        run: () => {
          void anki
            .setCurrentDeck(id)
            .catch(() => undefined)
            .finally(() => navigate(`#/study/${id}`));
        },
      };
    });

    const q = query.trim().toLowerCase();
    const filteredDecks = q
      ? deckEntries.filter((item) => item.searchText.toLowerCase().includes(q))
      : deckEntries.slice(0, 10);
    const filteredActions = q
      ? actions.filter((item) => item.searchText.toLowerCase().includes(q))
      : actions;

    return {
      deckItems: filteredDecks,
      actionItems: filteredActions,
      items: [...filteredDecks, ...filteredActions],
    };
  }, [decks, query, navigate, onOpenTags, onRunSync, prefTheme, resolvedTheme, setPref]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const execute = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  let runningIdx = 0;

  return (
    <SheetOrDialog
      open={open}
      onClose={onClose}
      title="빠른 이동"
      subtitle="덱 이름이나 기능을 검색하세요"
      maxWidth={520}
      variant="full"
    >
      <div className="amgi-cmd-search">
        <IconSearch size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(Math.max(0, items.length - 1), i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              execute(items[activeIdx]);
            }
          }}
          placeholder="덱 이름, 노트 추가, 통계, 태그..."
          aria-label="빠른 이동 검색"
        />
        {query && (
          <button
            type="button"
            className="amgi-cmd-clear"
            aria-label="검색어 지우기"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <IconClose size={16} />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="amgi-cmd-empty">
          <IconDeck size={24} style={{ marginBottom: 8, color: 'var(--text-3)' }} />
          <div>일치하는 덱이나 기능이 없습니다.</div>
        </div>
      ) : (
        <div className="amgi-cmd-list" role="listbox" aria-label="빠른 이동 목록">
          {deckItems.length > 0 && (
            <>
              <div className="amgi-cmd-group-label" role="presentation">
                덱{!query.trim() && decks.length > deckItems.length ? ` (${deckItems.length}/${decks.length})` : ''}
              </div>
              {deckItems.map((item) => {
                const idx = runningIdx++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIdx}
                    className={`amgi-cmd-row ${idx === activeIdx ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => execute(item)}
                  >
                    <span className="amgi-cmd-icon amgi-cmd-icon--deck" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="amgi-cmd-main">
                      <span className="amgi-cmd-label">{item.label}</span>
                      {item.subLabel && <span className="amgi-cmd-sub">{item.subLabel}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {actionItems.length > 0 && (
            <>
              <div className="amgi-cmd-group-label" role="presentation">
                기능
              </div>
              {actionItems.map((item) => {
                const idx = runningIdx++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIdx}
                    className={`amgi-cmd-row ${idx === activeIdx ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => execute(item)}
                  >
                    <span className="amgi-cmd-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="amgi-cmd-main">
                      <span className="amgi-cmd-label">{item.label}</span>
                      {item.subLabel && <span className="amgi-cmd-sub">{item.subLabel}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </SheetOrDialog>
  );
};

export default CommandPalette;
