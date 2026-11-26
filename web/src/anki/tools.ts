import anki from './generated';
import { rpc } from './rpc';
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
