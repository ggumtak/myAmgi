import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import { useApp } from '../../context/AppContext';
import {
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

const MAX_DECKS_WITHOUT_QUERY = 8;

interface PaletteEntry {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onOpenTags,
  onRunSync,
}) => {
  const { navigate, prefTheme, setPref } = useApp();
  const [query, setQuery] = useState('');
  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(0);
    anki
      .getDeckNames(false, true)
      .then(setDecks)
      .catch(() => setDecks([]));
  }, [open]);

  const items = useMemo<PaletteEntry[]>(() => {
    const actions: PaletteEntry[] = [
      {
        id: 'act-add-note',
        label: '새 노트 추가',
        hint: '단어장 카드 작성',
        group: '빠른 실행',
        icon: <IconEdit size={18} />,
        run: () => navigate('#/note/new'),
      },
      {
        id: 'act-browse',
        label: '카드 찾아보기',
        hint: '검색 · 일괄 편집',
        group: '빠른 실행',
        icon: <IconSearch size={18} />,
        run: () => navigate('#/browse'),
      },
      {
        id: 'act-stats',
        label: '학습 통계 보기',
        hint: '잔디 · 복습 예정 · 정답률',
        group: '빠른 실행',
        icon: <IconStats size={18} />,
        run: () => navigate('#/stats'),
      },
      {
        id: 'act-notetypes',
        label: '노트 유형 관리',
        hint: '필드 · 카드 템플릿 · 스타일',
        group: '빠른 실행',
        icon: <IconSpark size={18} />,
        run: () => navigate('#/notetypes'),
      },
      {
        id: 'act-tags',
        label: '태그 관리',
        hint: '태그 이름 변경 · 정리',
        group: '빠른 실행',
        icon: <IconTag size={18} />,
        run: () => onOpenTags(),
      },
      {
        id: 'act-sync',
        label: '지금 동기화',
        hint: 'AnkiWeb 계정 동기화',
        group: '빠른 실행',
        icon: <IconSync size={18} />,
        run: () => onRunSync(),
      },
      {
        id: 'act-theme',
        label:
          prefTheme === 'dark'
            ? '밝은 화면으로 전환'
            : prefTheme === 'light'
              ? '어두운 화면으로 전환'
              : '다크 모드로 전환',
        hint: '화면 테마 변경',
        group: '빠른 실행',
        icon: <IconSettings size={18} />,
        run: () => {
          void setPref('theme', prefTheme === 'dark' ? 'light' : 'dark');
        },
      },
      {
        id: 'act-settings',
        label: '설정 열기',
        hint: '학습 · 화면 · 백업',
        group: '빠른 실행',
        icon: <IconSettings size={18} />,
        run: () => navigate('#/settings'),
      },
    ];

    const deckEntries: PaletteEntry[] = decks.map((d) => {
      const id = anki.toNumber(d.id);
      const name = d.name ?? '덱';
      return {
        id: `deck-${id}`,
        label: name,
        hint: '바로 학습 시작',
        group: '덱 바로가기',
        icon: <IconPlay size={17} />,
        run: () => {
          void anki.setCurrentDeck(id).finally(() => navigate(`#/study/${id}`));
        },
      };
    });

    const q = query.trim().toLowerCase();
    // Empty query: every action, then a capped deck list (typing searches all decks).
    if (!q) return [...actions, ...deckEntries.slice(0, MAX_DECKS_WITHOUT_QUERY)];
    const all = [...deckEntries, ...actions];
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint ?? '').toLowerCase().includes(q)
    );
  }, [decks, query, navigate, onOpenTags, onRunSync, prefTheme, setPref]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Keep the keyboard selection visible in the scrolling list.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx]);

  const execute = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  return (
    <SheetOrDialog
      open={open}
      onClose={onClose}
      title="빠른 이동"
      subtitle="덱 이름이나 기능을 입력하세요"
      maxWidth={520}
    >
      <div className="amgi-cmd-search">
        <IconSearch size={18} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(items.length - 1, i + 1));
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
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: '20px 8px',
            textAlign: 'center',
            color: 'var(--text-2)',
            fontSize: 14,
          }}
        >
          <IconDeck size={24} style={{ marginBottom: 6, opacity: 0.6 }} />
          <div>일치하는 덱이나 기능이 없습니다.</div>
        </div>
      ) : (
        <div
          ref={listRef}
          className="amgi-cmd-list"
          role="listbox"
          aria-label="빠른 이동 목록"
        >
          {items.map((item, idx) => (
            <button
              key={item.id}
              data-idx={idx}
              type="button"
              role="option"
              aria-selected={idx === activeIdx}
              className={`amgi-cmd-row ${idx === activeIdx ? 'active' : ''}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => execute(item)}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span style={{ color: 'var(--primary)', display: 'inline-flex', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </span>
              {item.hint && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-2)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </SheetOrDialog>
  );
};

export default CommandPalette;
