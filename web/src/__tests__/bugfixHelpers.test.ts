import { describe, expect, it } from 'vitest';
import { planEmptyCardsRemoval } from '../anki/tools';
import { resolveTwoButtonMode } from '../studyPrefs';

describe('planEmptyCardsRemoval', () => {
  it('keeps the first card of notes whose cards are all empty', () => {
    const plan = planEmptyCardsRemoval({
      notes: [
        { noteId: 1, cardIds: [11, 12], willDeleteNote: false },
        { noteId: 2, cardIds: [21, 22, 23], willDeleteNote: true },
        { noteId: 3, cardIds: [31], willDeleteNote: true },
      ],
    });
    expect(plan.cardIds).toEqual([11, 12, 22, 23]);
    expect(plan.noteCount).toBe(2);
    expect(plan.keptNoteCount).toBe(2);
  });

  it('handles an empty or missing report', () => {
    expect(planEmptyCardsRemoval(null)).toEqual({ cardIds: [], noteCount: 0, keptNoteCount: 0 });
    expect(planEmptyCardsRemoval({ notes: [] }).cardIds).toEqual([]);
  });
});

describe('resolveTwoButtonMode', () => {
  it('prefers study.twoButton, then the legacy key, then true', () => {
    expect(resolveTwoButtonMode({ 'study.twoButton': false, 'study.twoButtonMode': true })).toBe(false);
    expect(resolveTwoButtonMode({ 'study.twoButtonMode': false })).toBe(false);
    expect(resolveTwoButtonMode({})).toBe(true);
    expect(resolveTwoButtonMode({}, { eink: true })).toBe(true);
    expect(resolveTwoButtonMode({ 'study.twoButton': 'yes' })).toBe(true);
  });
});
