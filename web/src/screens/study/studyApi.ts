// Engine calls used by the reviewer (thin wrappers over `/_anki/<method>`).
import { anki } from '../../anki/proto';
import { invoke } from '../../anki/rpc';
import { nodesToHtml } from '../../anki/cardRendering';
import { toAvTags, type AvTag } from './avPlayer';
import { avRefsToPlayIcons, parseTypeAnswer, stripAvRefs, typeAnsQuestionFilter, type TypeAnswerSpec, type TypeAnswerTarget } from './cardText';

export type QueuedCards = anki.scheduler.QueuedCards;
export type QueuedCard = anki.scheduler.QueuedCards.QueuedCard.$Properties;
export type States = anki.scheduler.SchedulingStates.$Properties;
export type DeckConfig = anki.deck_config.DeckConfig.Config.$Properties;
export const ConfigString = anki.config.ConfigKey.String;
export const ConfigBool = anki.config.ConfigKey.Bool;

export function getQueuedCards(fetchLimit = 2): Promise<QueuedCards> {
  return invoke('getQueuedCards', { fetchLimit, intradayLearningOnly: false });
}

/** A card prepared for display: final question HTML, answer HTML before the type-answer comparison, AV tags. */
export interface PreparedCard {
  cardId: number;
  noteId: number;
  ord: number;
  css: string;
  question: string;
  /** Answer HTML (play buttons, encoded media paths), still containing `[[type:...]]`. */
  answer: string;
  questionAv: AvTag[];
  answerAv: AvTag[];
  typeSpec: TypeAnswerSpec | null;
  typeTarget: TypeAnswerTarget | null;
  marked: boolean;
  tags: string[];
}

const notetypeCache = new Map<number, anki.notetypes.Notetype>();

async function notetype(id: number) {
  let nt = notetypeCache.get(id);
  if (!nt) {
    nt = await invoke('getNotetype', { ntid: id });
    notetypeCache.set(id, nt);
  }
  return nt;
}

export function clearNotetypeCache() {
  notetypeCache.clear();
}

/** Joins rendered nodes, putting the rendered question in for `{{FrontSide}}` (like anki/template.py apply_custom_filters). */
function joinNodes(nodes: anki.card_rendering.RenderedTemplateNode.$Properties[], frontSide: string | null): string {
  if (frontSide === null) return nodesToHtml(nodes);
  return nodes
    .map((n) => {
      if (n.text != null) return n.text;
      if (n.replacement?.fieldName === 'FrontSide') return frontSide;
      return n.replacement?.currentText ?? '';
    })
    .join('');
}

async function prepareText(text: string, hidePlayButtons: boolean): Promise<string> {
  const escaped = (await invoke('encodeIriPaths', { val: text })).val;
  return hidePlayButtons ? stripAvRefs(escaped) : avRefsToPlayIcons(escaped);
}

/** Renders a card the way aqt's reviewer does: render → extract AV tags → escape media names → play buttons → type answer. */
export async function prepareCard(card: anki.cards.Card.$Properties, hidePlayButtons: boolean): Promise<PreparedCard> {
  const cardId = card.id ?? 0;
  const [rendered, note] = await Promise.all([
    invoke('renderExistingCard', { cardId, browser: false, partialRender: false }),
    invoke('getNote', { nid: card.noteId ?? 0 }),
  ]);
  const qText = joinNodes(rendered.questionNodes, null);
  const qOut = await invoke('extractAvTags', { text: qText, questionSide: true });
  const aText = joinNodes(rendered.answerNodes, qOut.text);
  const aOut = await invoke('extractAvTags', { text: aText, questionSide: false });

  let question = await prepareText(qOut.text, hidePlayButtons);
  const answer = await prepareText(aOut.text, hidePlayButtons);

  const ord = card.templateIdx ?? 0;
  const typeSpec = parseTypeAnswer(question);
  let typeTarget: TypeAnswerTarget | null = null;
  if (typeSpec) {
    const nt = await notetype(note.notetypeId);
    const idx = nt.fields.findIndex((f) => f.name === typeSpec.field);
    if (idx >= 0) {
      let expected: string | null = note.fields[idx] ?? '';
      if (typeSpec.cloze) {
        expected = (await invoke('extractClozeForTyping', { text: expected, ordinal: ord + 1 })).val || null;
      }
      const cfg = nt.fields[idx].config;
      typeTarget = { expected, font: cfg?.fontName || 'Arial', size: cfg?.fontSize || 20 };
    }
    question = typeAnsQuestionFilter(question, typeSpec, typeTarget);
  }

  const tags = note.tags ?? [];
  return {
    cardId,
    noteId: card.noteId ?? 0,
    ord,
    css: rendered.css,
    question,
    answer,
    questionAv: toAvTags(qOut.avTags),
    answerAv: toAvTags(aOut.avTags),
    typeSpec,
    typeTarget,
    marked: tags.some((t) => t.toLowerCase() === 'marked'),
    tags,
  };
}

export async function compareAnswer(expected: string, provided: string, combining: boolean): Promise<string> {
  return (await invoke('compareAnswer', { expected, provided, combining })).val;
}

const deckConfigCache = new Map<number, DeckConfig>();

/** The options preset that applies to a card (its original deck when it is in a filtered deck, like Anki). */
export async function deckConfigForCard(card: anki.cards.Card.$Properties): Promise<DeckConfig> {
  const did = card.originalDeckId || card.deckId || 1;
  const deck = await invoke('getDeck', { did });
  const confId = deck.normal?.configId ?? 1;
  let conf = deckConfigCache.get(confId);
  if (!conf) {
    const res = await invoke('getDeckConfig', { dcid: confId });
    conf = res.config ?? {};
    deckConfigCache.set(confId, conf);
  }
  return conf;
}

export function clearDeckConfigCache() {
  deckConfigCache.clear();
}

/** `cardStateCustomizer` (deck options › advanced › custom scheduling), or '' when unset. */
export async function cardStateCustomizer(): Promise<string> {
  try {
    return (await invoke('getConfigString', { key: ConfigString.CARD_STATE_CUSTOMIZER })).val ?? '';
  } catch {
    return '';
  }
}

export async function describeNextStates(states: States): Promise<string[]> {
  return (await invoke('describeNextStates', states)).vals;
}

export async function answerCard(cardId: number, states: States, rating: 0 | 1 | 2 | 3, millisecondsTaken: number) {
  const newState = rating === 0 ? states.again : rating === 1 ? states.hard : rating === 2 ? states.good : states.easy;
  await invoke('answerCard', {
    cardId,
    currentState: states.current,
    newState,
    rating,
    answeredAtMillis: Date.now(),
    millisecondsTaken: Math.max(0, Math.round(millisecondsTaken)),
  });
  return newState;
}

export async function stateIsLeech(state: anki.scheduler.SchedulingState.$Properties): Promise<boolean> {
  try {
    return (await invoke('stateIsLeech', state)).val;
  } catch {
    return false;
  }
}

export function getCard(cid: number) {
  return invoke('getCard', { cid });
}

export async function setFlag(cardIds: number[], flag: number) {
  await invoke('setFlag', { cardIds, flag });
}

export async function setMarked(noteId: number, marked: boolean) {
  if (marked) await invoke('addNoteTags', { noteIds: [noteId], tags: 'marked' });
  else await invoke('removeNoteTags', { noteIds: [noteId], tags: 'marked' });
}

export async function buryOrSuspend(kind: 'bury' | 'suspend', ids: { cardIds?: number[]; noteIds?: number[] }) {
  const Mode = anki.scheduler.BuryOrSuspendCardsRequest.Mode;
  return (
    await invoke('buryOrSuspendCards', {
      cardIds: ids.cardIds ?? [],
      noteIds: ids.noteIds ?? [],
      mode: kind === 'bury' ? Mode.BURY_USER : Mode.SUSPEND,
    })
  ).count;
}

export async function forgetCard(cardId: number, restorePosition: boolean, resetCounts: boolean) {
  await invoke('scheduleCardsAsNew', {
    cardIds: [cardId],
    log: true,
    restorePosition,
    resetCounts,
    context: anki.scheduler.ScheduleCardsAsNewRequest.Context.REVIEWER,
  });
}

export async function setDueDate(cardId: number, days: string) {
  await invoke('setDueDate', { cardIds: [cardId], days, configKey: { key: ConfigString.SET_DUE_REVIEWER } });
}

export async function getConfigString(key: anki.config.ConfigKey.String): Promise<string> {
  try {
    return (await invoke('getConfigString', { key })).val;
  } catch {
    return '';
  }
}

export async function getConfigBool(key: anki.config.ConfigKey.Bool): Promise<boolean> {
  try {
    return (await invoke('getConfigBool', { key })).val;
  } catch {
    return false;
  }
}

export async function removeNote(noteId: number) {
  return (await invoke('removeNotes', { noteIds: [noteId], cardIds: [] })).count;
}

export async function cardsOfNote(nid: number) {
  return (await invoke('cardsOfNote', { nid })).cids;
}

export function undoStatus() {
  return invoke('getUndoStatus', {});
}

export function undo() {
  return invoke('undo', {});
}

export function redo() {
  return invoke('redo', {});
}

export function reviewingPrefs() {
  return invoke('getPreferences', {}).then((p) => p.reviewing ?? null);
}

/** Proto bytes for the frame's state-mutation hook (what Anki's mediasrv answers for getSchedulingStatesWithContext). */
export function encodeStatesWithContext(states: States, context: anki.scheduler.SchedulingContext.$Properties | null | undefined): Uint8Array {
  return anki.frontend.SchedulingStatesWithContext.encode({ states, context: context ?? undefined }).finish().slice();
}

export function decodeSetStatesRequest(bytes: Uint8Array): anki.frontend.SetSchedulingStatesRequest {
  return anki.frontend.SetSchedulingStatesRequest.decode(bytes);
}
