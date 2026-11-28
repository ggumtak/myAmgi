import anki from './generated';
import { rpc, toNumber } from './rpc';
import type { AnkiTypes } from './generated';

export type Deck = AnkiTypes.decks.Deck;
export type DeckTreeNode = AnkiTypes.decks.DeckTreeNode;
export type DeckNameId = AnkiTypes.decks.DeckNameId.$Properties;
export type FilteredDeckForUpdate = AnkiTypes.decks.FilteredDeckForUpdate;
export type DeckConfigsForUpdate = AnkiTypes.deck_config.DeckConfigsForUpdate;
export type DeckConfig = AnkiTypes.deck_config.DeckConfig;
export type UpdateDeckConfigsRequest = AnkiTypes.deck_config.UpdateDeckConfigsRequest;
export type CongratsInfoResponse = AnkiTypes.scheduler.CongratsInfoResponse;
export type ComputeFsrsParamsResponse = AnkiTypes.scheduler.ComputeFsrsParamsResponse;

export const SetDeckCollapsedScope = anki.decks.SetDeckCollapsedRequest.Scope;
export const UpdateDeckConfigsMode = anki.deck_config.UpdateDeckConfigsMode;
export const FilteredSearchOrder = anki.decks.Deck.Filtered.SearchTerm.Order;

export async function deckTree(nowSecs = Math.floor(Date.now() / 1000)): Promise<DeckTreeNode> {
  return rpc('deckTree', anki.decks.DeckTreeRequest, anki.decks.DeckTreeNode, {
    now: nowSecs,
  });
}

export async function getDeckNames(
  skipEmptyDefault = false,
  includeFiltered = true
): Promise<DeckNameId[]> {
  const res = await rpc(
    'getDeckNames',
    anki.decks.GetDeckNamesRequest,
    anki.decks.DeckNames,
    { skipEmptyDefault, includeFiltered }
  );
  return res.entries ?? [];
}

export async function getDeck(did: number): Promise<Deck> {
  return rpc('getDeck', anki.decks.DeckId, anki.decks.Deck, { did });
}

export async function newDeck(): Promise<Deck> {
  return rpc('newDeck', anki.generic.Empty, anki.decks.Deck, {});
}

export async function addDeck(
  deck: AnkiTypes.decks.Deck.$Properties
): Promise<AnkiTypes.collection.OpChangesWithId> {
  return rpc('addDeck', anki.decks.Deck, anki.collection.OpChangesWithId, deck);
}

export async function createSimpleDeck(name: string, configId = 1): Promise<number> {
  const res = await addDeck({
    name: name.trim(),
    common: {},
    normal: { configId },
  });
  return toNumber(res.id);
}

export async function updateDeck(
  deck: AnkiTypes.decks.Deck.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('updateDeck', anki.decks.Deck, anki.collection.OpChanges, deck);
}

export async function renameDeck(
  deckId: number,
  newName: string
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('renameDeck', anki.decks.RenameDeckRequest, anki.collection.OpChanges, {
    deckId,
    newName: newName.trim(),
  });
}

export async function removeDecks(
  dids: number[]
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc('removeDecks', anki.decks.DeckIds, anki.collection.OpChangesWithCount, {
    dids,
  });
}

export async function reparentDecks(
  deckIds: number[],
  newParent: number
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'reparentDecks',
    anki.decks.ReparentDecksRequest,
    anki.collection.OpChangesWithCount,
    { deckIds, newParent }
  );
}

export async function setDeckCollapsed(
  deckId: number,
  collapsed: boolean,
  scope: AnkiTypes.decks.SetDeckCollapsedRequest.Scope = anki.decks.SetDeckCollapsedRequest.Scope
    .REVIEWER
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'setDeckCollapsed',
    anki.decks.SetDeckCollapsedRequest,
    anki.collection.OpChanges,
    { deckId, collapsed, scope }
  );
}

export async function getCurrentDeck(): Promise<Deck> {
  return rpc('getCurrentDeck', anki.generic.Empty, anki.decks.Deck, {});
}

/**
 * Id of the session deck that `customStudy` just built: the backend selects the new
 * filtered deck as the current deck. Returns null when the current deck is not filtered
 * (e.g. the request only raised today's limits).
 */
export async function customStudySessionDeckId(): Promise<number | null> {
  try {
    const cur = await getCurrentDeck();
    if (cur.filtered) return toNumber(cur.id);
  } catch {
    // Treat as unknown
  }
  return null;
}

/**
 * Ids (of `deckIds`) whose own or subdecks' cards were answered today, from the per-deck
 * "studied today" counters the scheduler keeps (`Deck.common`). Answering updates the
 * home deck and its parents. The backend exposes no day index, so "today" is the latest
 * `lastDayStudied` among decks with studied counts; call only when something was answered
 * today (e.g. `graphs().today.answerCount > 0`), otherwise that is an earlier day.
 */
export async function decksStudiedToday(deckIds: number[]): Promise<Set<number>> {
  const decks = await Promise.all(deckIds.map((id) => getDeck(id).catch(() => null)));
  let today = -1;
  const studied: Array<{ id: number; day: number }> = [];
  decks.forEach((deck, i) => {
    const c = deck?.common;
    if (!c) return;
    const count = (c.newStudied ?? 0) + (c.reviewStudied ?? 0) + (c.learningStudied ?? 0);
    if (count <= 0) return;
    const day = c.lastDayStudied ?? 0;
    studied.push({ id: deckIds[i], day });
    if (day > today) today = day;
  });
  return new Set(studied.filter((s) => s.day === today).map((s) => s.id));
}

export async function setCurrentDeck(did: number): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('setCurrentDeck', anki.decks.DeckId, anki.collection.OpChanges, { did });
}

export async function congratsInfo(): Promise<CongratsInfoResponse> {
  return rpc(
    'congratsInfo',
    anki.generic.Empty,
    anki.scheduler.CongratsInfoResponse,
    {}
  );
}

export async function studiedToday(): Promise<string> {
  const res = await rpc('studiedToday', anki.generic.Empty, anki.generic.String, {});
  return res.val ?? '';
}

export async function getDeckConfigsForUpdate(did: number): Promise<DeckConfigsForUpdate> {
  return rpc(
    'getDeckConfigsForUpdate',
    anki.decks.DeckId,
    anki.deck_config.DeckConfigsForUpdate,
    { did }
  );
}

export async function updateDeckConfigs(
  req: AnkiTypes.deck_config.UpdateDeckConfigsRequest.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'updateDeckConfigs',
    anki.deck_config.UpdateDeckConfigsRequest,
    anki.collection.OpChanges,
    req
  );
}

export async function getOrCreateFilteredDeck(did: number): Promise<FilteredDeckForUpdate> {
  return rpc(
    'getOrCreateFilteredDeck',
    anki.decks.DeckId,
    anki.decks.FilteredDeckForUpdate,
    { did }
  );
}

export async function addOrUpdateFilteredDeck(
  deck: AnkiTypes.decks.FilteredDeckForUpdate.$Properties
): Promise<AnkiTypes.collection.OpChangesWithId> {
  return rpc(
    'addOrUpdateFilteredDeck',
    anki.decks.FilteredDeckForUpdate,
    anki.collection.OpChangesWithId,
    deck
  );
}

export async function emptyFilteredDeck(did: number): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('emptyFilteredDeck', anki.decks.DeckId, anki.collection.OpChanges, { did });
}

export async function rebuildFilteredDeck(
  did: number
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'rebuildFilteredDeck',
    anki.decks.DeckId,
    anki.collection.OpChangesWithCount,
    { did }
  );
}

export async function computeFsrsWeights(
  params: AnkiTypes.scheduler.ComputeFsrsParamsRequest.$Properties
): Promise<ComputeFsrsParamsResponse> {
  return rpc(
    'computeFsrsParams',
    anki.scheduler.ComputeFsrsParamsRequest,
    anki.scheduler.ComputeFsrsParamsResponse,
    params
  );
}

export const computeFsrsParams = computeFsrsWeights;

export async function computeOptimalRetention(
  params: AnkiTypes.scheduler.SimulateFsrsReviewRequest.$Properties
): Promise<number> {
  const res = await rpc(
    'computeOptimalRetention',
    anki.scheduler.SimulateFsrsReviewRequest,
    anki.scheduler.ComputeOptimalRetentionResponse,
    params
  );
  return res.optimalRetention ?? 0.9;
}
