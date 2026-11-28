import React, { useEffect, useState } from 'react';
import * as anki from '../../anki';
import {
  IconChevronDown,
  IconChevronRight,
  IconDeck,
  IconFlag,
  IconSpark,
  IconTag,
} from '../../ui';

export interface BrowserSidebarProps {
  currentQuery: string;
  onSelectQuery: (query: string) => void;
  collectionVersion: number;
}

const QUICK_VIEWS = [
  { id: 'all', label: '전체 카드', query: '' },
  { id: 'due', label: '오늘 만기', query: 'is:due' },
  { id: 'new', label: '새 카드', query: 'is:new' },
  { id: 'learn', label: '학습 중', query: 'is:learn' },
  { id: 'review', label: '복습', query: 'is:review' },
  { id: 'added', label: '오늘 추가', query: 'added:1' },
  { id: 'rated', label: '오늘 학습함', query: 'rated:1' },
  { id: 'marked', label: '별표 표시', query: 'tag:marked' },
  { id: 'suspended', label: '일시 중지', query: 'is:suspended' },
  { id: 'buried', label: '숨김', query: 'is:buried' },
];

const SIDEBAR_FLAGS = [
  { flag: 1, label: '빨강' },
  { flag: 2, label: '주황' },
  { flag: 3, label: '초록' },
  { flag: 4, label: '파랑' },
  { flag: 5, label: '분홍' },
  { flag: 6, label: '청록' },
  { flag: 7, label: '보라' },
];

export const BrowserSidebar: React.FC<BrowserSidebarProps> = ({
  currentQuery,
  onSelectQuery,
  collectionVersion,
}) => {
  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [notetypes, setNotetypes] = useState<anki.NotetypeNameId[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quick: true,
    decks: true,
    flags: false,
    notetypes: false,
    tags: true,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      anki.getDeckNames(false, true).catch(() => []),
      anki.getNotetypeNames().catch(() => []),
      anki.getAllTags().catch(() => []),
    ]).then(([d, nt, t]) => {
      if (cancelled) return;
      setDecks(d);
      setNotetypes(nt);
      setTags(t.slice().sort((a, b) => a.localeCompare(b, 'ko')));
    });
    return () => {
      cancelled = true;
    };
  }, [collectionVersion]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const normCurrent = currentQuery.trim();
  const isDeckQueryActive = (name: string) =>
    normCurrent === `deck:"${name}"` || normCurrent === `deck:${name}`;
  const isTagQueryActive = (tag: string) =>
    normCurrent === `tag:"${tag}"` || normCurrent === `tag:${tag}`;

  return (
    <aside className="amgi-browser-sidebar" aria-label="Anki 탐색 사이드바">
      {/* Quick Views */}
      <div className="amgi-bs-section">
        <button
          type="button"
          className="amgi-bs-heading"
          aria-expanded={openSections.quick}
          onClick={() => toggleSection('quick')}
        >
          {openSections.quick ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
          <span>빠른 보기</span>
        </button>
        {openSections.quick && (
          <div className="amgi-bs-items">
            {QUICK_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`amgi-bs-item ${normCurrent === item.query ? 'active' : ''}`}
                onClick={() => onSelectQuery(item.query)}
              >
                <span className="amgi-bs-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Decks */}
      <div className="amgi-bs-section">
        <button
          type="button"
          className="amgi-bs-heading"
          aria-expanded={openSections.decks}
          onClick={() => toggleSection('decks')}
        >
          {openSections.decks ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
          <IconDeck size={14} />
          <span>덱 ({decks.length})</span>
        </button>
        {openSections.decks && (
          <div className="amgi-bs-items">
            {decks.map((d) => {
              const name = d.name ?? '';
              const q = `deck:"${name.replace(/"/g, '\\"')}"`;
              const depth = Math.min(3, name.split('::').length - 1);
              const short = name.split('::').pop() || name;
              return (
                <button
                  key={anki.toNumber(d.id)}
                  type="button"
                  className={`amgi-bs-item ${isDeckQueryActive(name) ? 'active' : ''}`}
                  style={{ paddingLeft: `${12 + depth * 12}px` }}
                  title={name}
                  onClick={() => onSelectQuery(q)}
                >
                  <span className="amgi-bs-item-label">{short}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Flags */}
      <div className="amgi-bs-section">
        <button
          type="button"
          className="amgi-bs-heading"
          aria-expanded={openSections.flags}
          onClick={() => toggleSection('flags')}
        >
          {openSections.flags ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
          <IconFlag size={14} />
          <span>깃발</span>
        </button>
        {openSections.flags && (
          <div className="amgi-bs-items">
            {SIDEBAR_FLAGS.map((f) => {
              const q = `flag:${f.flag}`;
              return (
                <button
                  key={f.flag}
                  type="button"
                  className={`amgi-bs-item ${normCurrent === q ? 'active' : ''}`}
                  onClick={() => onSelectQuery(q)}
                >
                  <span className={`amgi-flag-badge amgi-flag-${f.flag}`}>{f.flag}</span>
                  <span className="amgi-bs-item-label">{f.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Types */}
      <div className="amgi-bs-section">
        <button
          type="button"
          className="amgi-bs-heading"
          aria-expanded={openSections.notetypes}
          onClick={() => toggleSection('notetypes')}
        >
          {openSections.notetypes ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
          <IconSpark size={14} />
          <span>노트 유형 ({notetypes.length})</span>
        </button>
        {openSections.notetypes && (
          <div className="amgi-bs-items">
            {notetypes.map((nt) => {
              const id = anki.toNumber(nt.id);
              const q = `mid:${id}`;
              return (
                <button
                  key={id}
                  type="button"
                  className={`amgi-bs-item ${normCurrent === q ? 'active' : ''}`}
                  onClick={() => onSelectQuery(q)}
                >
                  <span className="amgi-bs-item-label">{nt.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="amgi-bs-section">
          <button
            type="button"
            className="amgi-bs-heading"
            aria-expanded={openSections.tags}
            onClick={() => toggleSection('tags')}
          >
            {openSections.tags ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
            <IconTag size={14} />
            <span>태그 ({tags.length})</span>
          </button>
          {openSections.tags && (
            <div className="amgi-bs-items">
              {tags.slice(0, 60).map((t) => {
                const q = `tag:"${t.replace(/"/g, '\\"')}"`;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`amgi-bs-item ${isTagQueryActive(t) ? 'active' : ''}`}
                    onClick={() => onSelectQuery(q)}
                  >
                    <span className="amgi-bs-item-label">{t}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default BrowserSidebar;
