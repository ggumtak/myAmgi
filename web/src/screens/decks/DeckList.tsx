// Deck browser list: header row, nested rows with counts, studied-today footer.
import { useMemo, useState } from 'react';
import { decks } from '../../anki';
import { flattenDeckTree, type DeckNodeLike, type DeckRow } from '../../lib/deckTree';
import { describeError } from '../../lib/errors';
import { formatCount } from '../../lib/format';
import { useLongPress } from '../../lib/useLongPress';
import { IconButton } from '../../ui/IconButton';
import { IconChevronDown, IconChevronRight, IconMore } from '../../ui/icons';
import type { MenuAnchor } from '../../ui/Menu';
import { toast } from '../../ui/Toast';
import './DeckList.css';

export function DeckList({
  tree,
  studied,
  selectedId,
  onOpen,
  onMenu,
  onCollapsedChanged,
}: {
  tree: DeckNodeLike;
  studied: string;
  selectedId?: number;
  onOpen: (row: DeckRow) => void;
  onMenu: (row: DeckRow, anchor: MenuAnchor) => void;
  onCollapsedChanged: () => void;
}) {
  const [override, setOverride] = useState<Map<number, boolean>>(new Map());
  // Drop overrides once the engine's tree reflects them.
  const rows = useMemo(() => flattenDeckTree(tree, override), [tree, override]);

  const toggle = async (row: DeckRow) => {
    const collapsed = !row.collapsed;
    setOverride((m) => new Map(m).set(row.id, collapsed));
    try {
      await decks.setDeckCollapsed(row.id, collapsed);
      onCollapsedChanged();
    } catch (err) {
      setOverride((m) => {
        const n = new Map(m);
        n.delete(row.id);
        return n;
      });
      toast(describeError(err).message, { kind: 'error' });
    }
  };

  return (
    <div className="deck-list" role="table" aria-label="덱 목록">
      <div className="deck-list__header" role="row">
        <span aria-hidden="true" />
        <span className="deck-list__h-name" role="columnheader">
          덱
        </span>
        <span className="deck-list__h-count" role="columnheader">
          새 카드
        </span>
        <span className="deck-list__h-count" role="columnheader">
          학습
        </span>
        <span className="deck-list__h-count" role="columnheader">
          복습
        </span>
        <span className="deck-list__h-menu" aria-hidden="true" />
      </div>
      <div className="deck-list__rows" role="rowgroup">
        {rows.map((row) => (
          <DeckListRow
            key={row.id}
            row={row}
            selected={row.id === selectedId}
            onOpen={onOpen}
            onMenu={onMenu}
            onToggle={toggle}
          />
        ))}
      </div>
      {studied && (
        <p className="deck-list__footer" data-testid="studied-today">
          {studied}
        </p>
      )}
    </div>
  );
}

function Count({ value, kind, label }: { value: number; kind: 'new' | 'learn' | 'review'; label: string }) {
  return (
    <span className={`deck-row__count deck-row__count--${kind} ${value === 0 ? 'is-zero' : ''} num`} role="cell" aria-label={`${label} ${value}`} data-count={kind}>
      {formatCount(value)}
    </span>
  );
}

function DeckListRow({
  row,
  selected,
  onOpen,
  onMenu,
  onToggle,
}: {
  row: DeckRow;
  selected: boolean;
  onOpen: (row: DeckRow) => void;
  onMenu: (row: DeckRow, anchor: MenuAnchor) => void;
  onToggle: (row: DeckRow) => void;
}) {
  const lp = useLongPress((pt) => onMenu(row, pt));
  return (
    <div
      className={`deck-row ${selected ? 'deck-row--selected' : ''} ${row.filtered ? 'deck-row--filtered' : ''}`}
      role="row"
      data-testid="deck-row"
      data-deck-id={row.id}
      data-deck-name={row.fullName}
      aria-selected={selected || undefined}
      style={{ '--depth': row.depth } as React.CSSProperties}
      {...lp.handlers}
      onClick={() => {
        if (lp.consumeClick()) return;
        onOpen(row);
      }}
    >
      <span className="deck-row__lead" role="cell">
        {row.hasChildren ? (
          <button
            type="button"
            className="deck-row__chevron"
            aria-label={row.collapsed ? `${row.name} 펼치기` : `${row.name} 접기`}
            aria-expanded={!row.collapsed}
            data-testid="deck-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(row);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {row.collapsed ? <IconChevronRight size={20} /> : <IconChevronDown size={20} />}
          </button>
        ) : (
          <span className="deck-row__chevron-spacer" />
        )}
      </span>
      <button
        type="button"
        className="deck-row__name"
        role="cell"
        title={row.fullName}
        onClick={(e) => {
          e.stopPropagation();
          if (lp.consumeClick()) return;
          onOpen(row);
        }}
      >
        <span className="deck-row__name-text">{row.name}</span>
      </button>
      <Count value={row.newCount} kind="new" label="새 카드" />
      <Count value={row.learnCount} kind="learn" label="학습" />
      <Count value={row.reviewCount} kind="review" label="복습" />
      <span className="deck-row__menu" role="cell">
        <IconButton
          label={`${row.fullName} 메뉴`}
          data-testid="deck-menu"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(row, e.currentTarget.getBoundingClientRect());
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconMore size={20} />
        </IconButton>
      </span>
    </div>
  );
}
