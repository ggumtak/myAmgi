// Search with Anki syntax; building search strings from structured nodes.
import { anki } from './proto';
import { invoke } from './rpc';

export type SearchNode = anki.search.SearchNode.$Properties;

export async function searchCards(search: string, order?: anki.search.SortOrder.$Properties): Promise<number[]> {
  return (await invoke('searchCards', { search, order: order ?? { none: {} } })).ids;
}

export async function searchNotes(search: string, order?: anki.search.SortOrder.$Properties): Promise<number[]> {
  return (await invoke('searchNotes', { search, order: order ?? { none: {} } })).ids;
}

/** Normalized Anki search text for a node, e.g. `{deck: '일본어'}` -> `deck:일본어`. */
export async function buildSearchString(node: SearchNode): Promise<string> {
  return (await invoke('buildSearchString', node)).val;
}

/** Search text matching a deck and its sub-decks, quoting as Anki does. */
export function deckSearch(fullName: string): string {
  return `"deck:${fullName.replace(/([\\"*_])/g, '\\$1')}"`;
}
