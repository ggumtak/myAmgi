import type Long from 'long';
import anki from './generated';
import { rpc, toNumber } from './rpc';
import type { AnkiTypes } from './generated';

export type Card = AnkiTypes.cards.Card;
export type SortOrder = AnkiTypes.search.SortOrder.$Properties;
export type BrowserColumn = AnkiTypes.search.BrowserColumns.Column.$Properties;
export type BrowserRow = AnkiTypes.search.BrowserRow;
export type TagTreeNode = AnkiTypes.tags.TagTreeNode;

export const BrowserRowColor = anki.search.BrowserRow.Color;

export async function searchCards(
  query: string,
  order: SortOrder = { none: {} }
): Promise<number[]> {
  const res = await rpc(
    'searchCards',
    anki.search.SearchRequest,
    anki.search.SearchResponse,
    { search: query, order }
  );
  return (res.ids ?? []).map((id) => toNumber(id));
}

export async function searchNotes(
  query: string,
  order: SortOrder = { none: {} }
): Promise<number[]> {
  const res = await rpc(
    'searchNotes',
    anki.search.SearchRequest,
    anki.search.SearchResponse,
    { search: query, order }
  );
  return (res.ids ?? []).map((id) => toNumber(id));
}

export async function getCard(cid: number | Long): Promise<Card> {
  return rpc('getCard', anki.cards.CardId, anki.cards.Card, { cid });
}

export async function updateCards(
  cards: AnkiTypes.cards.Card.$Properties[],
  skipUndoEntry = false
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('updateCards', anki.cards.UpdateCardsRequest, anki.collection.OpChanges, {
    cards,
    skipUndoEntry,
  });
}

export async function removeCards(
  cardIds: Array<number | Long>
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'removeCards',
    anki.cards.RemoveCardsRequest,
    anki.collection.OpChangesWithCount,
    { cardIds }
  );
}

export async function setDeck(
  cardIds: Array<number | Long>,
  deckId: number | Long
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc('setDeck', anki.cards.SetDeckRequest, anki.collection.OpChangesWithCount, {
    cardIds,
    deckId,
  });
}

export async function browserColumns(): Promise<BrowserColumn[]> {
  const res = await rpc(
    'allBrowserColumns',
    anki.generic.Empty,
    anki.search.BrowserColumns,
    {}
  );
  return res.columns ?? [];
}

export async function browserRowForId(id: number | Long): Promise<BrowserRow> {
  return rpc('browserRowForId', anki.generic.Int64, anki.search.BrowserRow, {
    val: id,
  });
}

export async function setActiveBrowserColumns(columns: string[]): Promise<void> {
  await rpc(
    'setActiveBrowserColumns',
    anki.generic.StringList,
    anki.generic.Empty,
    { vals: columns }
  );
}

export async function findAndReplace(params: {
  nids: Array<number | Long>;
  search: string;
  replacement: string;
  regex?: boolean;
  matchCase?: boolean;
  fieldName?: string;
}): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'findAndReplace',
    anki.search.FindAndReplaceRequest,
    anki.collection.OpChangesWithCount,
    {
      nids: params.nids,
      search: params.search,
      replacement: params.replacement,
      regex: params.regex ?? false,
      matchCase: params.matchCase ?? false,
      fieldName: params.fieldName ?? '',
    }
  );
}

export async function getAllTags(): Promise<string[]> {
  const res = await rpc('allTags', anki.generic.Empty, anki.generic.StringList, {});
  return res.vals ?? [];
}

export async function getTagTree(): Promise<TagTreeNode> {
  return rpc('tagTree', anki.generic.Empty, anki.tags.TagTreeNode, {});
}

export async function renameTags(
  currentPrefix: string,
  newPrefix: string
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'renameTags',
    anki.tags.RenameTagsRequest,
    anki.collection.OpChangesWithCount,
    { currentPrefix, newPrefix }
  );
}

export async function reparentTags(
  tags: string[],
  newParent: string
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'reparentTags',
    anki.tags.ReparentTagsRequest,
    anki.collection.OpChangesWithCount,
    { tags, newParent }
  );
}

export async function removeTags(
  tags: string
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'removeTags',
    anki.generic.String,
    anki.collection.OpChangesWithCount,
    { val: tags }
  );
}

export async function clearUnusedTags(): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'clearUnusedTags',
    anki.generic.Empty,
    anki.collection.OpChangesWithCount,
    {}
  );
}

export async function addNoteTags(
  noteIds: Array<number | Long>,
  tags: string
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'addNoteTags',
    anki.tags.NoteIdsAndTagsRequest,
    anki.collection.OpChangesWithCount,
    { noteIds, tags }
  );
}

export async function removeNoteTags(
  noteIds: Array<number | Long>,
  tags: string
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'removeNoteTags',
    anki.tags.NoteIdsAndTagsRequest,
    anki.collection.OpChangesWithCount,
    { noteIds, tags }
  );
}

export async function completeTag(
  input: string,
  matchLimit = 20
): Promise<string[]> {
  const res = await rpc(
    'completeTag',
    anki.tags.CompleteTagRequest,
    anki.tags.CompleteTagResponse,
    { input, matchLimit }
  );
  return res.tags ?? [];
}

export type SearchNode = AnkiTypes.search.SearchNode.$Properties;
export const SearchNodeJoiner = anki.search.SearchNode.Group.Joiner;
export const SearchFlag = anki.search.SearchNode.Flag;
export const SearchCardState = anki.search.SearchNode.CardState;
export const ScheduleCardsAsNewContext = anki.scheduler.ScheduleCardsAsNewRequest.Context;

export async function getConfigBool(
  key: AnkiTypes.config.ConfigKey.Bool
): Promise<boolean> {
  const res = await rpc(
    'getConfigBool',
    anki.config.GetConfigBoolRequest,
    anki.generic.Bool,
    { key }
  );
  return Boolean(res.val);
}

export async function setConfigBool(
  key: AnkiTypes.config.ConfigKey.Bool,
  value: boolean,
  undoable = false
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'setConfigBool',
    anki.config.SetConfigBoolRequest,
    anki.collection.OpChanges,
    { key, value, undoable }
  );
}

export async function getConfigString(
  key: AnkiTypes.config.ConfigKey.String
): Promise<string> {
  const res = await rpc(
    'getConfigString',
    anki.config.GetConfigStringRequest,
    anki.generic.String,
    { key }
  );
  return res.val ?? '';
}

/**
 * Synchronous equivalent of `buildSearchString({deck})` / `buildSearchString({tag})` for one
 * exact name: escapes the wildcards `*` `_` and `\` `"`, and quotes the whole term when it
 * contains whitespace or parentheses (verified against the engine's own output).
 */
export function buildSearchTerm(kind: 'deck' | 'tag', name: string): string {
  const escaped = name.replace(/[\\*_"]/g, (c) => `\\${c}`);
  const term = `${kind}:${escaped}`;
  // The engine quotes on spaces/parentheses but not on a tab.
  return /[^\S\t]|[()]/.test(term) ? `"${term}"` : term;
}

const ID_SEARCH_CHUNK = 1000;

async function searchByIdChunks(
  ids: readonly number[],
  prefix: 'cid' | 'nid',
  run: (query: string) => Promise<number[]>
): Promise<number[]> {
  const out = new Set<number>();
  for (let i = 0; i < ids.length; i += ID_SEARCH_CHUNK) {
    const chunk = ids.slice(i, i + ID_SEARCH_CHUNK);
    const res = await run(`${prefix}:${chunk.join(',')}`);
    for (const id of res) out.add(id);
  }
  return Array.from(out);
}

/** Note ids of the given cards, resolved with `cid:` searches (one RPC per 1000 cards). */
export async function noteIdsOfCards(cardIds: readonly number[]): Promise<number[]> {
  if (cardIds.length === 0) return [];
  return searchByIdChunks(cardIds, 'cid', (q) => searchNotes(q));
}

/** All card ids of the given notes, resolved with `nid:` searches (one RPC per 1000 notes). */
export async function cardIdsOfNotes(noteIds: readonly number[]): Promise<number[]> {
  if (noteIds.length === 0) return [];
  return searchByIdChunks(noteIds, 'nid', (q) => searchCards(q));
}

export async function buildSearchString(node: SearchNode): Promise<string> {
  const res = await rpc(
    'buildSearchString',
    anki.search.SearchNode,
    anki.generic.String,
    node
  );
  return res.val ?? '';
}

export async function joinSearchNodes(params: {
  joiner?: AnkiTypes.search.SearchNode.Group.Joiner;
  existingNode: SearchNode;
  additionalNode: SearchNode;
}): Promise<string> {
  const res = await rpc(
    'joinSearchNodes',
    anki.search.JoinSearchNodesRequest,
    anki.generic.String,
    {
      joiner: params.joiner ?? anki.search.SearchNode.Group.Joiner.AND,
      existingNode: params.existingNode,
      additionalNode: params.additionalNode,
    }
  );
  return res.val ?? '';
}

export async function fieldNamesForNotes(
  nids: Array<number | Long>
): Promise<string[]> {
  const res = await rpc(
    'fieldNamesForNotes',
    anki.notes.FieldNamesForNotesRequest,
    anki.notes.FieldNamesForNotesResponse,
    { nids }
  );
  return res.fields ?? [];
}

export async function getSingleNotetypeOfNotes(
  noteIds: Array<number | Long>
): Promise<number> {
  const res = await rpc(
    'getSingleNotetypeOfNotes',
    anki.notes.NoteIds,
    anki.notetypes.NotetypeId,
    { noteIds }
  );
  return toNumber(res.ntid);
}

export async function restoreBuriedAndSuspendedCards(
  cids: Array<number | Long>
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'restoreBuriedAndSuspendedCards',
    anki.cards.CardIds,
    anki.collection.OpChanges,
    { cids }
  );
}

export async function scheduleCardsAsNew(
  req: AnkiTypes.scheduler.ScheduleCardsAsNewRequest.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'scheduleCardsAsNew',
    anki.scheduler.ScheduleCardsAsNewRequest,
    anki.collection.OpChanges,
    req
  );
}

export async function scheduleCardsAsNewDefaults(
  context: AnkiTypes.scheduler.ScheduleCardsAsNewRequest.Context = anki.scheduler
    .ScheduleCardsAsNewRequest.Context.BROWSER
): Promise<AnkiTypes.scheduler.ScheduleCardsAsNewDefaultsResponse> {
  return rpc(
    'scheduleCardsAsNewDefaults',
    anki.scheduler.ScheduleCardsAsNewDefaultsRequest,
    anki.scheduler.ScheduleCardsAsNewDefaultsResponse,
    { context }
  );
}

