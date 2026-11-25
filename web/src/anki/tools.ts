// Collection maintenance: check database, check media, empty cards.
import { invoke } from './rpc';

/** Problems found and fixed (backend-localized sentences); empty = nothing wrong. */
export async function checkDatabase(): Promise<string[]> {
  return (await invoke('checkDatabase', {})).problems ?? [];
}

export function checkMedia() {
  return invoke('checkMedia', {});
}

/** Moves media files to the media trash (Anki's "delete unused"). */
export async function trashMediaFiles(fnames: string[]): Promise<void> {
  await invoke('trashMediaFiles', { fnames });
}

export function emptyCards() {
  return invoke('getEmptyCards', {});
}

/**
 * Card ids to delete for an empty-cards report. With `keepNotes` (Anki's default), a note whose
 * cards would all go keeps its first card, so no note is lost.
 */
export function emptyCardIdsToRemove(
  notes: { cardIds?: number[] | null; willDeleteNote?: boolean | null }[],
  keepNotes: boolean,
): number[] {
  const ids: number[] = [];
  for (const n of notes) {
    const cards = n.cardIds ?? [];
    ids.push(...(keepNotes && n.willDeleteNote ? cards.slice(1) : cards));
  }
  return ids;
}

/** Deletes cards (and notes left without cards). Returns the number of cards removed. */
export async function removeCards(cardIds: number[]): Promise<number> {
  return (await invoke('removeCards', { cardIds })).count;
}
