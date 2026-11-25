// Notes: read, create, update, delete, duplicate check.
import { anki } from './proto';
import { invoke } from './rpc';

export type Note = anki.notes.Note;
export const FieldsCheckState = anki.notes.NoteFieldsCheckResponse.State;

export function getNote(nid: number): Promise<Note> {
  return invoke('getNote', { nid });
}

export function newNote(ntid: number): Promise<Note> {
  return invoke('newNote', { ntid });
}

export async function addNote(note: anki.notes.Note.$Properties, deckId: number): Promise<number> {
  return (await invoke('addNote', { note, deckId })).noteId;
}

export async function updateNotes(notes: anki.notes.Note.$Properties[], skipUndoEntry = false): Promise<void> {
  await invoke('updateNotes', { notes, skipUndoEntry });
}

export async function removeNotes(noteIds: number[], cardIds: number[] = []): Promise<number> {
  return (await invoke('removeNotes', { noteIds, cardIds })).count;
}

/** Deck and note type the add screen should start with. */
export function defaultsForAdding(homeDeckOfCurrentReviewCard = 0) {
  return invoke('defaultsForAdding', { homeDeckOfCurrentReviewCard });
}

export async function fieldsCheck(note: anki.notes.Note.$Properties) {
  return (await invoke('noteFieldsCheck', note)).state;
}

export async function cardsOfNote(nid: number): Promise<number[]> {
  return (await invoke('cardsOfNote', { nid })).cids;
}
