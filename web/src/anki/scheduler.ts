// Scheduler: study queue, next-state descriptions, answering, bury/suspend,
// undo/redo, congrats info, "studied today".
import { anki } from './proto';
import { invoke } from './rpc';

export type QueuedCards = anki.scheduler.QueuedCards;
export type QueuedCard = anki.scheduler.QueuedCards.QueuedCard;
export type CongratsInfo = anki.scheduler.CongratsInfoResponse;
export const Rating = anki.scheduler.CardAnswer.Rating;
export type Rating = anki.scheduler.CardAnswer.Rating;
export const Queue = anki.scheduler.QueuedCards.Queue;
export const BuryOrSuspendMode = anki.scheduler.BuryOrSuspendCardsRequest.Mode;

/** Cards of the current deck, in study order, plus the remaining counts. */
export function queuedCards(fetchLimit = 1, intradayLearningOnly = false): Promise<QueuedCards> {
  return invoke('getQueuedCards', { fetchLimit, intradayLearningOnly });
}

/** Interval labels for again/hard/good/easy, e.g. ["<1분", "<10분", "1일", "4일"]. */
export async function describeNextStates(states: anki.scheduler.SchedulingStates.$Properties): Promise<string[]> {
  return (await invoke('describeNextStates', states)).vals;
}

/** Answer a queued card with `rating`; `millisecondsTaken` is the time shown. */
export async function answerCard(card: QueuedCard, rating: Rating, millisecondsTaken: number): Promise<void> {
  const states = card.states!;
  const newState =
    rating === Rating.AGAIN ? states.again : rating === Rating.HARD ? states.hard : rating === Rating.GOOD ? states.good : states.easy;
  await invoke('answerCard', {
    cardId: card.card!.id,
    currentState: states.current,
    newState,
    rating,
    answeredAtMillis: Date.now(),
    millisecondsTaken: Math.max(0, Math.round(millisecondsTaken)),
  });
}

export async function buryOrSuspend(
  mode: anki.scheduler.BuryOrSuspendCardsRequest.Mode,
  ids: { cardIds?: number[]; noteIds?: number[] },
): Promise<number> {
  return (await invoke('buryOrSuspendCards', { cardIds: ids.cardIds ?? [], noteIds: ids.noteIds ?? [], mode })).count;
}

export async function restoreBuriedAndSuspended(cardIds: number[]): Promise<void> {
  await invoke('restoreBuriedAndSuspendedCards', { cids: cardIds });
}

export function undo() {
  return invoke('undo', {});
}

export function redo() {
  return invoke('redo', {});
}

export function undoStatus() {
  return invoke('getUndoStatus', {});
}

/** Why the current deck has nothing due (call `setCurrentDeck` first). */
export function congratsInfo(): Promise<CongratsInfo> {
  return invoke('congratsInfo', {});
}

/** Removes Unicode bidi isolation marks (U+2066..U+2069) the backend puts around arguments. */
export function stripIsolates(text: string): string {
  return text.replace(/[⁦-⁩]/g, '');
}

/** The backend's localized "studied N cards in M minutes today" sentence. */
export async function studiedToday(): Promise<string> {
  return stripIsolates((await invoke('studiedToday', {})).val);
}

export function schedTimingToday() {
  return invoke('schedTimingToday', {});
}

export async function unburyDeck(deckId: number, mode = anki.scheduler.UnburyDeckRequest.Mode.ALL): Promise<void> {
  await invoke('unburyDeck', { deckId, mode });
}

/** `days` uses Anki syntax: "0", "1-7", "3!" ... */
export async function setDueDate(cardIds: number[], days: string): Promise<void> {
  await invoke('setDueDate', { cardIds, days });
}

export async function forgetCards(cardIds: number[], opts: { restorePosition?: boolean; resetCounts?: boolean } = {}) {
  await invoke('scheduleCardsAsNew', {
    cardIds,
    log: true,
    restorePosition: opts.restorePosition ?? true,
    resetCounts: opts.resetCounts ?? false,
  });
}
