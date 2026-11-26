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

/**
 * Replaces the tags on the given notes by reading their current tags,
 * removing existing ones that differ, and adding missing ones, or updating notes directly.
 */
export async function setNoteTags(
  noteIds: Array<number | Long>,
  tags: string[]
): Promise<AnkiTypes.collection.OpChanges> {
  const uniqueTags = Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))
  );
  const notes = await Promise.all(
    noteIds.map((nid) => rpc('getNote', anki.notes.NoteId, anki.notes.Note, { nid }))
  );
  const updated = notes.map((n) => ({
    id: n.id,
    guid: n.guid,
    notetypeId: n.notetypeId,
    mtimeSecs: n.mtimeSecs,
    usn: n.usn,
    fields: n.fields,
    tags: uniqueTags,
  }));
  return rpc('updateNotes', anki.notes.UpdateNotesRequest, anki.collection.OpChanges, {
    notes: updated,
    skipUndoEntry: false,
  });
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

