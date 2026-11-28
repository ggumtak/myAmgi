import type Long from 'long';
import anki from './generated';
import { rpc, toNumber } from './rpc';
import type { AnkiTypes } from './generated';

export type Note = AnkiTypes.notes.Note;
export type AddNoteResponse = AnkiTypes.notes.AddNoteResponse;
export type DeckAndNotetype = AnkiTypes.notes.DeckAndNotetype;
export type NoteFieldsCheckResponse = AnkiTypes.notes.NoteFieldsCheckResponse;

export const NoteFieldsState = anki.notes.NoteFieldsCheckResponse.State;

export async function newNote(ntid: number | Long): Promise<Note> {
  return rpc('newNote', anki.notetypes.NotetypeId, anki.notes.Note, { ntid });
}

export async function addNote(
  note: AnkiTypes.notes.Note.$Properties,
  deckId: number | Long
): Promise<AddNoteResponse> {
  return rpc('addNote', anki.notes.AddNoteRequest, anki.notes.AddNoteResponse, {
    note,
    deckId,
  });
}

export async function getNote(nid: number | Long): Promise<Note> {
  return rpc('getNote', anki.notes.NoteId, anki.notes.Note, { nid });
}

export async function updateNotes(
  notes: AnkiTypes.notes.Note.$Properties[],
  skipUndoEntry = false
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc('updateNotes', anki.notes.UpdateNotesRequest, anki.collection.OpChanges, {
    notes,
    skipUndoEntry,
  });
}

export async function removeNotes(
  noteIds: Array<number | Long>,
  cardIds: Array<number | Long> = []
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'removeNotes',
    anki.notes.RemoveNotesRequest,
    anki.collection.OpChangesWithCount,
    { noteIds, cardIds }
  );
}

export async function noteFieldsCheck(
  note: AnkiTypes.notes.Note.$Properties
): Promise<NoteFieldsCheckResponse> {
  return rpc(
    'noteFieldsCheck',
    anki.notes.Note,
    anki.notes.NoteFieldsCheckResponse,
    note
  );
}

export async function defaultsForAdding(
  homeDeckOfCurrentReviewCard = 0
): Promise<DeckAndNotetype> {
  return rpc(
    'defaultsForAdding',
    anki.notes.DefaultsForAddingRequest,
    anki.notes.DeckAndNotetype,
    { homeDeckOfCurrentReviewCard }
  );
}

export async function cardsOfNote(nid: number | Long): Promise<number[]> {
  const res = await rpc('cardsOfNote', anki.notes.NoteId, anki.cards.CardIds, { nid });
  return (res.cids ?? []).map((id) => toNumber(id));
}

export async function addMediaFile(
  desiredName: string,
  data: Uint8Array
): Promise<string> {
  const res = await rpc(
    'addMediaFile',
    anki.media.AddMediaFileRequest,
    anki.generic.String,
    { desiredName, data }
  );
  return res.val ?? '';
}

export async function clozeNumbersInNote(
  note: AnkiTypes.notes.Note.$Properties
): Promise<number[]> {
  const res = await rpc(
    'clozeNumbersInNote',
    anki.notes.Note,
    anki.notes.ClozeNumbersInNoteResponse,
    note
  );
  return res.numbers ?? [];
}

