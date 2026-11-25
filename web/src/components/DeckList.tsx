import React, { useMemo, useState } from 'react';
import { Card, Deck, Note, NoteType } from '../types/models';
import { DeckCounts } from '../engine/scheduler';

interface DeckListProps {
  decks: Deck[];
  counts: Map<number, DeckCounts>;
  cards: Card[];
  notes: Note[];
  noteTypes: NoteType[];
  onStartStudy: (deckId: number) => void;
  onCreateDeck: (name: string) => Promise<void>;
  onToggleCollapse: (deck: Deck) => Promise<void>;
  onAddCard: (deckId: number, noteTypeId: number, fields: string[]) => Promise<void>;
  onToggleDeckFsrs: (deck: Deck) => Promise<void>;
}

interface DeckTreeNode {
  deck: Deck;
  depth: number;
  shortName: string;
  hasChildren: boolean;
}

export const DeckList: React.FC<DeckListProps> = ({
  decks,
  counts,
  cards,
  noteTypes,
  onStartStudy,
  onCreateDeck,
  onToggleCollapse,
  onAddCard,
  onToggleDeckFsrs,
}) => {
  const [newDeckName, setNewDeckName] = useState('');
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<number>(() => decks[0]?.id ?? 1);
  const [selectedNtId, setSelectedNtId] = useState<number>(() => noteTypes[0]?.id ?? 0);
  const [fieldValues, setFieldValues] = useState<string[]>(['', '']);

  const selectedNoteType = useMemo(
    () => noteTypes.find((nt) => nt.id === selectedNtId) ?? noteTypes[0],
    [noteTypes, selectedNtId]
  );

  const visibleNodes = useMemo<DeckTreeNode[]>(() => {
    const sorted = [...decks].sort((a, b) => a.name.localeCompare(b.name));
    const namesSet = new Set(sorted.map((d) => d.name));

    const nodes: DeckTreeNode[] = [];
    for (const d of sorted) {
      const parts = d.name.split('::');
      const depth = parts.length - 1;
      const shortName = parts[parts.length - 1];

      // Check if any ancestor is collapsed
      let hiddenByAncestor = false;
      for (let i = 1; i < parts.length; i++) {
        const ancestorName = parts.slice(0, i).join('::');
        const ancestor = sorted.find((x) => x.name === ancestorName);
        if (ancestor?.collapsed) {
          hiddenByAncestor = true;
          break;
        }
      }
      if (hiddenByAncestor) continue;

      let hasChildren = false;
      for (const n of namesSet) {
        if (n.startsWith(`${d.name}::`)) {
          hasChildren = true;
          break;
        }
      }

      nodes.push({ deck: d, depth, shortName, hasChildren });
    }
    return nodes;
  }, [decks]);

  const cardCountByDeck = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cards) {
      m.set(c.did, (m.get(c.did) ?? 0) + 1);
    }
    return m;
  }, [cards]);

  const handleCreateDeckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDeckName.trim();
    if (!trimmed) return;
    await onCreateDeck(trimmed);
    setNewDeckName('');
  };

  const openAddCardFor = (deckId: number) => {
    setSelectedDeckId(deckId);
    const nt = noteTypes[0];
    if (nt) {
      setSelectedNtId(nt.id);
      setFieldValues(nt.fields.map(() => ''));
    }
    setShowAddCardModal(true);
  };

  const handleNoteTypeChange = (ntId: number) => {
    setSelectedNtId(ntId);
    const nt = noteTypes.find((x) => x.id === ntId);
    if (nt) {
      setFieldValues(nt.fields.map((_, idx) => fieldValues[idx] ?? ''));
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoteType) return;
    if (fieldValues.every((v) => v.trim() === '')) return;
    await onAddCard(selectedDeckId, selectedNoteType.id, fieldValues);
    setFieldValues(selectedNoteType.fields.map(() => ''));
    setShowAddCardModal(false);
  };

  return (
    <div className="deck-panel">
      <div className="deck-toolbar card-surface">
        <form className="deck-create-form" onSubmit={(e) => void handleCreateDeckSubmit(e)}>
          <input
            type="text"
            placeholder="새 덱 이름 (하위 덱은 :: 사용, 예: 영어::단어)"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            + 덱 만들기
          </button>
        </form>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => openAddCardFor(decks[0]?.id ?? 1)}
          disabled={decks.length === 0 || noteTypes.length === 0}
        >
          + 카드 추가
        </button>
      </div>

      <div className="deck-table-card card-surface">
        <div className="deck-table-header">
          <span>덱</span>
          <span className="col-num">새 카드</span>
          <span className="col-num">학습</span>
          <span className="col-num">복습</span>
          <span className="col-actions">작업</span>
        </div>

        {visibleNodes.length === 0 ? (
          <div className="empty-state">
            <p className="muted-text">덱이 없습니다. 새 덱을 만들거나 .apkg / CSV를 가져오세요.</p>
          </div>
        ) : (
          <div className="deck-rows">
            {visibleNodes.map(({ deck, depth, shortName, hasChildren }) => {
              const c = counts.get(deck.id) ?? {
                deckId: deck.id,
                newCount: 0,
                learnCount: 0,
                reviewCount: 0,
                totalDue: 0,
              };
              const totalCards = cardCountByDeck.get(deck.id) ?? 0;

              return (
                <div key={deck.id} className="deck-row">
                  <div
                    className="deck-name-cell"
                    style={{ paddingLeft: `${depth * 22 + 8}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        className="collapse-btn"
                        onClick={() => void onToggleCollapse(deck)}
                        aria-label="하위 덱 접기/펼치기"
                      >
                        {deck.collapsed ? '▶' : '▼'}
                      </button>
                    ) : (
                      <span className="collapse-spacer" />
                    )}
                    <button
                      type="button"
                      className="deck-title-btn"
                      onClick={() => onStartStudy(deck.id)}
                    >
                      <span className="deck-title-text">{shortName}</span>
                      <span className="deck-total-badge">{totalCards}</span>
                    </button>
                  </div>

                  <div className="col-num count-new">{c.newCount}</div>
                  <div className="col-num count-learn">{c.learnCount}</div>
                  <div className="col-num count-review">{c.reviewCount}</div>

                  <div className="col-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => void onToggleDeckFsrs(deck)}
                      title="FSRS-5 / SM-2 전환"
                    >
                      {deck.fsrsEnabled ? 'FSRS-5' : 'SM-2'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => openAddCardFor(deck.id)}
                    >
                      +카드
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => onStartStudy(deck.id)}
                    >
                      학습
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddCardModal && selectedNoteType && (
        <div className="modal-backdrop" onClick={() => setShowAddCardModal(false)}>
          <div className="modal-card card-surface" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 카드 추가</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAddCardModal(false)}
              >
                ✕
              </button>
            </div>
            <form className="modal-form" onSubmit={(e) => void handleSaveCard(e)}>
              <div className="form-grid-2">
                <label className="form-field">
                  <span>덱</span>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                  >
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>노트 타입</span>
                  <select
                    value={selectedNoteType.id}
                    onChange={(e) => handleNoteTypeChange(Number(e.target.value))}
                  >
                    {noteTypes.map((nt) => (
                      <option key={nt.id} value={nt.id}>
                        {nt.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedNoteType.fields.map((fieldName, idx) => (
                <label key={fieldName + idx} className="form-field">
                  <span>{fieldName}</span>
                  <textarea
                    rows={idx === 0 ? 3 : 2}
                    value={fieldValues[idx] ?? ''}
                    onChange={(e) => {
                      const next = [...fieldValues];
                      next[idx] = e.target.value;
                      setFieldValues(next);
                    }}
                    placeholder={`${fieldName} 입력 (Cloze는 {{c1::정답}} 형식)`}
                  />
                </label>
              ))}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCardModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  카드 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
