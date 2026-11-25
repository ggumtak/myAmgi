// Row menu for a deck and the dialogs behind it (rename, sub-deck, delete, ...).
import { useState, type ReactElement } from 'react';
import { decks, search } from '../../anki';
import { normalizeDeckName, type DeckRow } from '../../lib/deckTree';
import { describeError } from '../../lib/errors';
import { formatCount } from '../../lib/format';
import { notifyCollectionChanged } from '../../lib/hooks';
import { href, navigate } from '../../lib/router';
import { useCreateDeckDialog, validateNewDeckName } from '../../shell/AddMenu';
import { ConfirmDialog, PromptDialog } from '../../ui/Dialogs';
import { Menu, type MenuAnchor, type MenuItem } from '../../ui/Menu';
import { toast } from '../../ui/Toast';

export type DeckRef = Pick<DeckRow, 'id' | 'name' | 'fullName' | 'filtered'>;

export function deckMenuItems(deck: DeckRef, act: { rename: () => void; subdeck: () => void; remove: () => void }): MenuItem[] {
  const items: MenuItem[] = [
    { label: '학습', testId: 'menu-study', onSelect: () => navigate(`/study/${deck.id}`) },
    { label: '이름 바꾸기', testId: 'menu-rename', onSelect: act.rename },
  ];
  if (deck.filtered) {
    items.push(
      { label: '다시 만들기', testId: 'menu-rebuild', onSelect: () => void rebuild(deck) },
      { label: '비우기', testId: 'menu-empty', onSelect: () => void empty(deck) },
    );
  } else {
    items.push({ label: '덱 옵션', testId: 'menu-options', onSelect: () => navigate(`/deck-options/${deck.id}`) });
  }
  items.push(
    { label: '맞춤 학습', testId: 'menu-custom-study', onSelect: () => navigate(`/custom-study/${deck.id}`) },
    { label: '하위 덱 만들기', testId: 'menu-subdeck', onSelect: act.subdeck },
    { label: '카드 찾아보기', testId: 'menu-browse', onSelect: () => navigate(href('/browse', { q: search.deckSearch(deck.fullName) }).slice(1)) },
    { label: '내보내기', testId: 'menu-export', onSelect: () => navigate(`/export?deck=${deck.id}`) },
    { label: '삭제', testId: 'menu-delete', danger: true, onSelect: act.remove },
  );
  return items;
}

export async function rebuild(deck: DeckRef) {
  try {
    const n = await decks.rebuildFilteredDeck(deck.id);
    notifyCollectionChanged();
    toast(`'${deck.fullName}' 덱을 다시 만들었습니다 (카드 ${formatCount(n)}장)`);
  } catch (err) {
    toast(describeError(err).message, { kind: 'error' });
  }
}

export async function empty(deck: DeckRef) {
  try {
    await decks.emptyFilteredDeck(deck.id);
    notifyCollectionChanged();
    toast(`'${deck.fullName}' 덱을 비웠습니다`);
  } catch (err) {
    toast(describeError(err).message, { kind: 'error' });
  }
}

/** Menu + dialogs for one deck at a time. `open(deck, anchor)` shows the menu. */
export function useDeckActions(): { open: (deck: DeckRef, anchor: MenuAnchor) => void; element: ReactElement; actions: (deck: DeckRef) => { rename: () => void; subdeck: () => void; remove: () => void } } {
  const [menu, setMenu] = useState<{ deck: DeckRef; anchor: MenuAnchor } | null>(null);
  const [renaming, setRenaming] = useState<DeckRef | null>(null);
  const [deleting, setDeleting] = useState<{ deck: DeckRef; cards: number } | null>(null);
  const create = useCreateDeckDialog();

  const actions = (deck: DeckRef) => ({
    rename: () => setRenaming(deck),
    subdeck: () => create.open(`${deck.fullName}::`),
    remove: async () => {
      let cards = 0;
      try {
        cards = (await search.searchCards(`did:${deck.id}`)).length;
      } catch {
        // still allow deleting; the count is informational
      }
      setDeleting({ deck, cards });
    },
  });

  const element = (
    <>
      <Menu
        open={!!menu}
        anchor={menu?.anchor ?? null}
        label={menu ? `${menu.deck.fullName} 메뉴` : undefined}
        items={menu ? deckMenuItems(menu.deck, actions(menu.deck)) : []}
        onClose={() => setMenu(null)}
      />
      <PromptDialog
        open={!!renaming}
        title="덱 이름 바꾸기"
        label="새 이름"
        initialValue={renaming?.fullName ?? ''}
        hint="'::'로 다른 덱 아래로 옮길 수 있습니다"
        confirmLabel="바꾸기"
        validate={(v) => (normalizeDeckName(v) ? null : '덱 이름을 입력하세요')}
        onSubmit={async (v) => {
          const deck = renaming!;
          const name = normalizeDeckName(v);
          if (name === deck.fullName) {
            setRenaming(null);
            return;
          }
          const err = await validateNewDeckName(name, deck.id);
          if (err) throw new Error(err);
          try {
            await decks.renameDeck(deck.id, name);
          } catch (e) {
            throw new Error(describeError(e).message);
          }
          setRenaming(null);
          notifyCollectionChanged();
          toast(`'${name}'(으)로 이름을 바꿨습니다`);
        }}
        onClose={() => setRenaming(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title="덱 삭제"
        danger
        confirmLabel="삭제"
        message={
          deleting && (
            <>
              <p data-testid="delete-message">
                '{deleting.deck.fullName}' 덱과 카드 {formatCount(deleting.cards)}장을 삭제합니다
              </p>
              <p className="field__hint">하위 덱도 함께 삭제됩니다. 삭제한 뒤 실행 취소로 되돌릴 수 있습니다.</p>
            </>
          )
        }
        onConfirm={async () => {
          const d = deleting!;
          try {
            const n = await decks.removeDecks([d.deck.id]);
            toast(`'${d.deck.fullName}' 덱을 삭제했습니다 (카드 ${formatCount(n)}장)`);
            if (window.location.hash.includes(`deck=${d.deck.id}`) || window.location.hash.startsWith(`#/deck/${d.deck.id}`)) {
              navigate('/decks', { replace: true });
            }
          } catch (err) {
            toast(describeError(err).message, { kind: 'error' });
          }
          setDeleting(null);
          notifyCollectionChanged();
        }}
        onClose={() => setDeleting(null)}
      />
      {create.dialog}
    </>
  );

  return { open: (deck, anchor) => setMenu({ deck, anchor }), element, actions };
}
