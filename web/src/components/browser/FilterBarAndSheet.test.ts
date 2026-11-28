import { describe, expect, it } from 'vitest';
import * as anki from '../../anki';
import { parseQueryToFilters } from './FilterBarAndSheet';

describe('parseQueryToFilters', () => {
  it('parses single deck, state, flag, tag, added:1, and free text', () => {
    const res = parseQueryToFilters('deck:"일본어::N2" is:due flag:3 tag:중요 added:1 食べる');
    expect(res.deck).toBe('일본어::N2');
    expect(res.states).toEqual([anki.SearchCardState.CARD_STATE_DUE]);
    expect(res.flag).toBe(anki.SearchFlag.FLAG_GREEN);
    expect(res.tags).toEqual(['중요']);
    expect(res.addedToday).toBe(true);
    expect(res.freeText).toBe('食べる');
  });

  it('parses parenthesized OR state and tag groups emitted by buildSearchString without drifting freeText', () => {
    const res = parseQueryToFilters(
      'deck:"Default" (is:new OR is:learn) (tag:vocab OR tag:"jlpt::n2") hello'
    );
    expect(res.deck).toBe('Default');
    expect(res.states).toEqual([
      anki.SearchCardState.CARD_STATE_NEW,
      anki.SearchCardState.CARD_STATE_LEARN,
    ]);
    expect(res.tags).toEqual(['vocab', 'jlpt::n2']);
    expect(res.freeText).toBe('hello');
  });

  it('preserves complex or negated expressions in freeText untouched', () => {
    const res = parseQueryToFilters('-is:suspended (deck:A OR flag:1) mid:42');
    expect(res.deck).toBeUndefined();
    expect(res.states).toEqual([]);
    expect(res.flag).toBeUndefined();
    expect(res.freeText).toBe('-is:suspended (deck:A OR flag:1) mid:42');
  });
});
