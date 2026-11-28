import anki from './generated';
import { rpc, toNumber } from './rpc';
import { removeCards } from './search';
import type { AnkiTypes } from './generated';

export type Preferences = AnkiTypes.config.Preferences;
export type CheckMediaResponse = AnkiTypes.media.CheckMediaResponse;
export type EmptyCardsReport = AnkiTypes.card_rendering.EmptyCardsReport;

export const ConfigKeyBool = anki.config.ConfigKey.Bool;
export const ConfigKeyString = anki.config.ConfigKey.String;
export const NewReviewMix = anki.config.Preferences.Scheduling.NewReviewMix;

export async function getPreferences(): Promise<Preferences> {
  return rpc('getPreferences', anki.generic.Empty, anki.config.Preferences, {});
}

export async function setPreferences(
  prefs: AnkiTypes.config.Preferences.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'setPreferences',
    anki.config.Preferences,
    anki.collection.OpChanges,
    prefs
  );
}

export async function checkDatabase(): Promise<string[]> {
  const res = await rpc(
    'checkDatabase',
    anki.generic.Empty,
    anki.collection.CheckDatabaseResponse,
    {}
  );
  return res.problems ?? [];
}

export async function checkMedia(): Promise<CheckMediaResponse> {
  return rpc('checkMedia', anki.generic.Empty, anki.media.CheckMediaResponse, {});
}

export async function trashMediaFiles(fnames: string[]): Promise<void> {
  await rpc(
    'trashMediaFiles',
    anki.media.TrashMediaFilesRequest,
    anki.generic.Empty,
    { fnames }
  );
}

export async function emptyMediaTrash(): Promise<void> {
  await rpc('emptyTrash', anki.generic.Empty, anki.generic.Empty, {});
}

export async function restoreMediaTrash(): Promise<void> {
  await rpc('restoreTrash', anki.generic.Empty, anki.generic.Empty, {});
}

export async function getEmptyCards(): Promise<EmptyCardsReport> {
  return rpc(
    'getEmptyCards',
    anki.generic.Empty,
    anki.card_rendering.EmptyCardsReport,
    {}
  );
}

/**
 * What "빈 카드 정리" will remove, following Anki desktop's default ("keep notes"):
 * for a note whose cards would ALL be removed (`willDeleteNote`), the first card is
 * kept so the note and its field content survive.
 */
export interface EmptyCardsPlan {
  /** Card ids that will be removed. */
  cardIds: number[];
  /** Notes that have at least one card removed. */
  noteCount: number;
  /** Notes where every card was empty; one card each is kept. */
  keptNoteCount: number;
}

export function planEmptyCardsRemoval(
  report: Pick<EmptyCardsReport, 'notes'> | null | undefined
): EmptyCardsPlan {
  const cardIds: number[] = [];
  let noteCount = 0;
  let keptNoteCount = 0;
  for (const note of report?.notes ?? []) {
    const ids = (note.cardIds ?? []).map((id) => toNumber(id));
    const toRemove = note.willDeleteNote ? ids.slice(1) : ids;
    if (note.willDeleteNote && ids.length > 0) keptNoteCount += 1;
    if (toRemove.length > 0) {
      noteCount += 1;
      cardIds.push(...toRemove);
    }
  }
  return { cardIds, noteCount, keptNoteCount };
}

/** Removes empty cards per `planEmptyCardsRemoval`; never deletes a note. */
export async function removeEmptyCards(
  report: Pick<EmptyCardsReport, 'notes'> | null | undefined
): Promise<EmptyCardsPlan> {
  const plan = planEmptyCardsRemoval(report);
  if (plan.cardIds.length > 0) {
    await removeCards(plan.cardIds);
  }
  return plan;
}
