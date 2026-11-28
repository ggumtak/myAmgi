import type Long from 'long';
import anki from './generated';
import { rpc } from './rpc';
import type { AnkiTypes } from './generated';

export type QueuedCards = AnkiTypes.scheduler.QueuedCards;
export type QueuedCard = AnkiTypes.scheduler.QueuedCards.QueuedCard;
export type SchedulingStates = AnkiTypes.scheduler.SchedulingStates;
export type SchedulingState = AnkiTypes.scheduler.SchedulingState;
export type CardAnswer = AnkiTypes.scheduler.CardAnswer;
export type RenderCardResponse = AnkiTypes.card_rendering.RenderCardResponse;
export type ExtractAvTagsResponse = AnkiTypes.card_rendering.ExtractAvTagsResponse;
export type UndoStatus = AnkiTypes.collection.UndoStatus;
export type OpChangesAfterUndo = AnkiTypes.collection.OpChangesAfterUndo;

export const Rating = anki.scheduler.CardAnswer.Rating;
export type Rating = AnkiTypes.scheduler.CardAnswer.Rating;
export const BuryOrSuspendMode = anki.scheduler.BuryOrSuspendCardsRequest.Mode;
export type BuryOrSuspendMode = AnkiTypes.scheduler.BuryOrSuspendCardsRequest.Mode;
export const UnburyDeckMode = anki.scheduler.UnburyDeckRequest.Mode;

export async function getQueuedCards(
  fetchLimit = 5,
  intradayLearningOnly = false
): Promise<QueuedCards> {
  return rpc(
    'getQueuedCards',
    anki.scheduler.GetQueuedCardsRequest,
    anki.scheduler.QueuedCards,
    { fetchLimit, intradayLearningOnly }
  );
}

export async function describeNextStates(states: SchedulingStates): Promise<string[]> {
  const res = await rpc(
    'describeNextStates',
    anki.scheduler.SchedulingStates,
    anki.generic.StringList,
    states
  );
  return res.vals ?? [];
}

export async function answerCard(
  cardId: number | Long,
  states: SchedulingStates,
  rating: Rating,
  msTaken: number,
  maxTakenSecs = 60
): Promise<AnkiTypes.collection.OpChanges> {
  let newState: AnkiTypes.scheduler.SchedulingState.$Properties | null | undefined;
  switch (rating) {
    case Rating.AGAIN:
      newState = states.again;
      break;
    case Rating.HARD:
      newState = states.hard;
      break;
    case Rating.GOOD:
      newState = states.good;
      break;
    case Rating.EASY:
      newState = states.easy;
      break;
    default:
      newState = states.good;
      break;
  }

  const effectiveCapSecs =
    typeof maxTakenSecs === 'number' && Number.isFinite(maxTakenSecs) && maxTakenSecs > 0
      ? maxTakenSecs
      : 60;
  const maxMs = Math.max(100, Math.round(effectiveCapSecs * 1000));

  return rpc('answerCard', anki.scheduler.CardAnswer, anki.collection.OpChanges, {
    cardId,
    currentState: states.current,
    newState,
    rating,
    answeredAtMillis: Date.now(),
    millisecondsTaken: Math.max(100, Math.min(maxMs, Math.round(msTaken))),
  });
}

export async function renderExistingCard(
  cardId: number | Long,
  browser = false,
  partialRender = false
): Promise<RenderCardResponse> {
  return rpc(
    'renderExistingCard',
    anki.card_rendering.RenderExistingCardRequest,
    anki.card_rendering.RenderCardResponse,
    { cardId, browser, partialRender }
  );
}

export async function renderUncommittedCard(
  note: AnkiTypes.notes.Note.$Properties,
  cardOrd: number,
  template: AnkiTypes.notetypes.Notetype.Template.$Properties,
  fillEmpty = false,
  partialRender = false
): Promise<RenderCardResponse> {
  return rpc(
    'renderUncommittedCard',
    anki.card_rendering.RenderUncommittedCardRequest,
    anki.card_rendering.RenderCardResponse,
    { note, cardOrd, template, fillEmpty, partialRender }
  );
}

export async function extractAvTags(
  text: string,
  questionSide: boolean
): Promise<ExtractAvTagsResponse> {
  return rpc(
    'extractAvTags',
    anki.card_rendering.ExtractAvTagsRequest,
    anki.card_rendering.ExtractAvTagsResponse,
    { text, questionSide }
  );
}

export async function compareAnswer(
  expected: string,
  provided: string,
  combining = true
): Promise<string> {
  const res = await rpc(
    'compareAnswer',
    anki.card_rendering.CompareAnswerRequest,
    anki.generic.String,
    { expected, provided, combining }
  );
  return res.val ?? '';
}

export async function buryOrSuspendCards(
  cardIds: Array<number | Long>,
  noteIds: Array<number | Long>,
  mode: BuryOrSuspendMode
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'buryOrSuspendCards',
    anki.scheduler.BuryOrSuspendCardsRequest,
    anki.collection.OpChangesWithCount,
    { cardIds, noteIds, mode }
  );
}

export async function unburyDeck(
  deckId: number,
  mode: AnkiTypes.scheduler.UnburyDeckRequest.Mode = UnburyDeckMode.ALL
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'unburyDeck',
    anki.scheduler.UnburyDeckRequest,
    anki.collection.OpChanges,
    { deckId, mode }
  );
}

export async function setFlag(
  cardIds: Array<number | Long>,
  flag: number
): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'setFlag',
    anki.cards.SetFlagRequest,
    anki.collection.OpChangesWithCount,
    { cardIds, flag }
  );
}

export async function setDueDate(
  cardIds: Array<number | Long>,
  days: string,
  configKey?: AnkiTypes.config.ConfigKey.String
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'setDueDate',
    anki.scheduler.SetDueDateRequest,
    anki.collection.OpChanges,
    {
      cardIds,
      days,
      configKey: configKey !== undefined ? { key: configKey } : undefined,
    }
  );
}

export async function forgetCards(
  cardIds: Array<number | Long>,
  restorePosition = false,
  resetCounts = false,
  log = true,
  context: AnkiTypes.scheduler.ScheduleCardsAsNewRequest.Context = anki.scheduler
    .ScheduleCardsAsNewRequest.Context.REVIEWER
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'scheduleCardsAsNew',
    anki.scheduler.ScheduleCardsAsNewRequest,
    anki.collection.OpChanges,
    { cardIds, log, restorePosition, resetCounts, context }
  );
}

export async function repositionNewCards(params: {
  cardIds: Array<number | Long>;
  startingFrom?: number;
  stepSize?: number;
  randomize?: boolean;
  shiftExisting?: boolean;
}): Promise<AnkiTypes.collection.OpChangesWithCount> {
  return rpc(
    'sortCards',
    anki.scheduler.SortCardsRequest,
    anki.collection.OpChangesWithCount,
    {
      cardIds: params.cardIds,
      startingFrom: params.startingFrom ?? 0,
      stepSize: params.stepSize ?? 1,
      randomize: params.randomize ?? false,
      shiftExisting: params.shiftExisting ?? false,
    }
  );
}

export async function customStudyDefaults(
  deckId: number
): Promise<AnkiTypes.scheduler.CustomStudyDefaultsResponse> {
  return rpc(
    'customStudyDefaults',
    anki.scheduler.CustomStudyDefaultsRequest,
    anki.scheduler.CustomStudyDefaultsResponse,
    { deckId }
  );
}

export async function customStudy(
  req: AnkiTypes.scheduler.CustomStudyRequest.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'customStudy',
    anki.scheduler.CustomStudyRequest,
    anki.collection.OpChanges,
    req
  );
}

export async function undoStatus(): Promise<UndoStatus> {
  return rpc('getUndoStatus', anki.generic.Empty, anki.collection.UndoStatus, {});
}

export async function undo(): Promise<OpChangesAfterUndo> {
  return rpc('undo', anki.generic.Empty, anki.collection.OpChangesAfterUndo, {});
}

export async function redo(): Promise<OpChangesAfterUndo> {
  return rpc('redo', anki.generic.Empty, anki.collection.OpChangesAfterUndo, {});
}

export async function extractClozeForTyping(
  text: string,
  ordinal: number
): Promise<string> {
  const res = await rpc(
    'extractClozeForTyping',
    anki.card_rendering.ExtractClozeForTypingRequest,
    anki.generic.String,
    { text, ordinal }
  );
  return res.val ?? '';
}

export { restoreBuriedAndSuspendedCards } from './search';

