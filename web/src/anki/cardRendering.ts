// Card rendering: question/answer HTML of existing cards, AV tags.
import { anki } from './proto';
import { invoke } from './rpc';

export type RenderedCard = { question: string; answer: string; css: string; latexSvg: boolean; isEmpty: boolean };

/** Joins rendered template nodes. Replacement nodes carry already-filtered text. */
export function nodesToHtml(nodes: anki.card_rendering.RenderedTemplateNode.$Properties[]): string {
  return nodes
    .map((n) => (n.text != null ? n.text : n.replacement ? (n.replacement.currentText ?? '') : ''))
    .join('');
}

export async function renderExistingCard(cardId: number, browser = false): Promise<RenderedCard> {
  const res = await invoke('renderExistingCard', { cardId, browser, partialRender: false });
  return {
    question: nodesToHtml(res.questionNodes),
    answer: nodesToHtml(res.answerNodes),
    css: res.css,
    latexSvg: res.latexSvg,
    isEmpty: res.isEmpty,
  };
}

export function extractAvTags(text: string, questionSide: boolean) {
  return invoke('extractAvTags', { text, questionSide });
}
