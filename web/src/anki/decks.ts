// Decks: tree with counts, names, create/rename/remove, collapse, current deck, filtered decks.
import { anki } from './proto';
import { invoke } from './rpc';

export type DeckTreeNode = anki.decks.DeckTreeNode;
export type Deck = anki.decks.Deck;
export const CollapseScope = anki.decks.SetDeckCollapsedRequest.Scope;

/** Current time in whole seconds, as the engine expects for `deckTree.now`. */
export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * The deck tree with due counts. `now` MUST be non-zero (seconds since epoch):
 * with `now = 0` the engine skips count calculation and every count is 0.
 */
export function deckTree(now: number = nowSecs()): Promise<DeckTreeNode> {
  return invoke('deckTree', { now });
}

export async function deckNames(opts: { skipEmptyDefault?: boolean; includeFiltered?: boolean } = {}) {
  const res = await invoke('getDeckNames', {
    skipEmptyDefault: opts.skipEmptyDefault ?? true,
    includeFiltered: opts.includeFiltered ?? true,
  });
  return res.entries.map((e) => ({ id: e.id ?? 0, name: e.name ?? '' }));
}

export function getDeck(did: number): Promise<Deck> {
  return invoke('getDeck', { did });
}

export async function deckIdByName(name: string): Promise<number> {
  return (await invoke('getDeckIdByName', { val: name })).did;
}

/**
 * Create a normal deck. `name` uses "::" for nesting. Note: the engine does not
 * reject duplicates, it renames them ("영어" -> "영어+"); check names first.
 */
export async function addDeck(name: string): Promise<number> {
  const deck = await invoke('newDeck', {});
  deck.name = name;
  const res = await invoke('addDeck', deck);
  return res.id;
}

/** Rename (full "::" path; also moves the deck). Empty names become "blank" in the engine. */
export async function renameDeck(deckId: number, newName: string): Promise<void> {
  await invoke('renameDeck', { deckId, newName });
}

/** Remove decks (with children and their cards). Returns the number of cards deleted. */
export async function removeDecks(dids: number[]): Promise<number> {
  return (await invoke('removeDecks', { dids })).count;
}

export async function reparentDecks(deckIds: number[], newParent: number): Promise<number> {
  return (await invoke('reparentDecks', { deckIds, newParent })).count;
}

export async function setDeckCollapsed(
  deckId: number,
  collapsed: boolean,
  scope: anki.decks.SetDeckCollapsedRequest.Scope = CollapseScope.REVIEWER,
): Promise<void> {
  await invoke('setDeckCollapsed', { deckId, collapsed, scope });
}

export async function setCurrentDeck(did: number): Promise<void> {
  await invoke('setCurrentDeck', { did });
}

export function getCurrentDeck(): Promise<Deck> {
  return invoke('getCurrentDeck', {});
}

export async function rebuildFilteredDeck(did: number): Promise<number> {
  return (await invoke('rebuildFilteredDeck', { did })).count;
}

export async function emptyFilteredDeck(did: number): Promise<void> {
  await invoke('emptyFilteredDeck', { did });
}
