import { describe, expect, it } from 'vitest';

import { buildSearchTerm } from '../anki/search';
import { pruneSelection } from '../components/browser/browserLogic';
import {
  buildFilterNode,
  joinStructuredAndFree,
  parseQueryToFilters,
  tokenizeQuery,
  unescapeExactValue,
} from '../components/browser/FilterBarAndSheet';
import { mergeTags, splitTagInput } from '../components/editor/TagChipInput';
import {
  NO_OLD_INDEX,
  normaliseMap,
  setOldIndex,
  unusedOldIndices,
} from '../components/notetypes/changeNotetypeMapping';
import {
  adoptSavedOrds,
  type FieldItem,
  newFieldItem,
  newTemplateItem,
  toPayloadItems,
  withKeys,
} from '../components/notetypes/notetypeItems';
import { applyTouchedDraft, orderConfigsForSave } from '../components/options/deckOptionsLogic';
import { ankiToday } from '../components/stats/statsDates';
import * as anki from '../anki';

describe('deck options: config ordering', () => {
  it('moves the selected config to the end (the engine assigns the last one)', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(orderConfigsForSave(list, (c) => c.id === 1).map((c) => c.id)).toEqual([2, 3, 1]);
    expect(orderConfigsForSave(list, (c) => c.id === 2).map((c) => c.id)).toEqual([1, 3, 2]);
    expect(orderConfigsForSave(list, (c) => c.id === 3).map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it('leaves the list alone when nothing is selected and does not mutate the input', () => {
    const list = [{ id: 1 }, { id: 2 }];
    expect(orderConfigsForSave(list, () => false)).toEqual(list);
    orderConfigsForSave(list, (c) => c.id === 1);
    expect(list.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe('deck options: only touched values are written', () => {
  const loaded = {
    newPerDay: 15,
    learnSteps: [],
    desiredRetention: 0.985,
    leechThreshold: 1,
    capAnswerTimeToSecs: 3600,
  };
  const draft = {
    newPerDay: 30,
    learnSteps: [1, 10],
    desiredRetention: 0.97,
    leechThreshold: 2,
    capAnswerTimeToSecs: 600,
  };

  it('keeps untouched (display-normalised) values exactly as loaded', () => {
    expect(applyTouchedDraft(loaded, draft, new Set())).toEqual(loaded);
  });

  it('writes the touched keys only', () => {
    const out = applyTouchedDraft(loaded, draft, new Set(['newPerDay'] as const));
    expect(out).toEqual({ ...loaded, newPerDay: 30 });
  });
});

describe('browser filters: parse is exact and lossless', () => {
  it('unescapes backend-escaped values', () => {
    expect(unescapeExactValue('JLPT\\_N5')).toBe('JLPT_N5');
    expect(unescapeExactValue('a\\*b')).toBe('a*b');
    expect(unescapeExactValue('a_b')).toBeNull();
    expect(unescapeExactValue('a*')).toBeNull();
    expect(parseQueryToFilters('tag:JLPT\\_N5').tags).toEqual(['JLPT_N5']);
  });

  it('round-trips engine-built chips with buildSearchTerm', () => {
    for (const name of ['JLPT_N5', '일본어::단어 장', 'a*b', 'x"y', '(괄호)']) {
      expect(parseQueryToFilters(buildSearchTerm('tag', name)).tags).toEqual([name]);
      expect(parseQueryToFilters(buildSearchTerm('deck', name)).deck).toBe(name);
    }
  });

  it('keeps two tag terms (AND) as free text instead of turning them into OR chips', () => {
    const f = parseQueryToFilters('tag:a tag:b');
    expect(f.tags).toEqual([]);
    expect(f.freeText).toBe('tag:a tag:b');
  });

  it('keeps OR / parenthesised queries verbatim', () => {
    for (const q of ['deck:a or deck:b', 'is:new OR is:due', '(tag:a tag:b) dog']) {
      const f = parseQueryToFilters(q);
      expect(f.deck).toBeUndefined();
      expect(f.tags).toEqual([]);
      expect(f.states).toEqual([]);
      expect(f.freeText).toBe(q);
    }
  });

  it('keeps a second deck term in free text', () => {
    const f = parseQueryToFilters('deck:a deck:b');
    expect(f.deck).toBeUndefined();
    expect(f.freeText).toBe('deck:a deck:b');
  });

  it('extracts single exact chips and leaves the rest untouched', () => {
    const f = parseQueryToFilters('deck:"Lang::日本 語" is:due flag:1 added:1 -tag:x dog*');
    expect(f.deck).toBe('Lang::日本 語');
    expect(f.states).toEqual([anki.SearchCardState.CARD_STATE_DUE]);
    expect(f.flag).toBe(anki.SearchFlag.FLAG_RED);
    expect(f.addedToday).toBe(true);
    expect(f.freeText).toBe('-tag:x dog*');
  });

  it('leaves wildcard deck/tag values as free text', () => {
    expect(parseQueryToFilters('deck:Lang*').freeText).toBe('deck:Lang*');
    expect(parseQueryToFilters('tag:a_b').freeText).toBe('tag:a_b');
  });

  it('tokenizes quotes and escapes without splitting them', () => {
    expect(tokenizeQuery('"deck:a b" tag:x\\ y').tokens).toEqual(['"deck:a b"', 'tag:x\\ y']);
  });

  it('parenthesises free text with a top-level OR when ANDed with chips', () => {
    expect(joinStructuredAndFree('deck:a', 'dog or cat')).toBe('deck:a (dog or cat)');
    expect(joinStructuredAndFree('deck:a', 'dog cat')).toBe('deck:a dog cat');
    expect(joinStructuredAndFree('', 'dog or cat')).toBe('dog or cat');
    expect(joinStructuredAndFree('deck:a', '')).toBe('deck:a');
  });

  it('builds one AND node from the chips', () => {
    expect(buildFilterNode({ states: [], tags: [], addedToday: false, freeText: 'x' })).toBeNull();
    expect(buildFilterNode({ deck: 'a', states: [], tags: [], addedToday: false, freeText: '' })).toEqual({
      deck: 'a',
    });
    const node = buildFilterNode({ deck: 'a', states: [], tags: ['t1', 't2'], addedToday: false, freeText: '' });
    expect(node?.group?.joiner).toBe(anki.SearchNodeJoiner.AND);
    expect(node?.group?.nodes?.[1]?.group?.joiner).toBe(anki.SearchNodeJoiner.OR);
  });
});

describe('buildSearchTerm (matches the engine output)', () => {
  it('escapes wildcards and quotes on spaces/parentheses', () => {
    expect(buildSearchTerm('deck', 'a_b')).toBe('deck:a\\_b');
    expect(buildSearchTerm('deck', 'a*b')).toBe('deck:a\\*b');
    expect(buildSearchTerm('tag', 'x"y')).toBe('tag:x\\"y');
    expect(buildSearchTerm('deck', 'a\\b')).toBe('deck:a\\\\b');
    expect(buildSearchTerm('deck', 'Lang::日本 語')).toBe('"deck:Lang::日本 語"');
    expect(buildSearchTerm('deck', '(x)')).toBe('"deck:(x)"');
    expect(buildSearchTerm('deck', '-x')).toBe('deck:-x');
  });
});

describe('browser selection pruning', () => {
  it('drops ids that are no longer in the results', () => {
    const next = pruneSelection(new Set([1, 2, 3]), [2, 3, 4]);
    expect(Array.from(next)).toEqual([2, 3]);
  });

  it('returns the same set when nothing changed', () => {
    const prev = new Set([1, 2]);
    expect(pruneSelection(prev, [1, 2, 3])).toBe(prev);
  });
});

describe('change notetype mapping (indexed by NEW item, value = OLD index)', () => {
  it('normalises the backend default to the new item count', () => {
    expect(normaliseMap([0, 1], 3)).toEqual([0, 1, NO_OLD_INDEX]);
    expect(normaliseMap([2, -1, null], 3)).toEqual([2, NO_OLD_INDEX, NO_OLD_INDEX]);
    expect(normaliseMap(undefined, 2)).toEqual([NO_OLD_INDEX, NO_OLD_INDEX]);
  });

  it('lets one old field feed several new fields', () => {
    expect(setOldIndex([0, 1], 1, 0, false)).toEqual([0, 0]);
  });

  it('keeps an old template mapped to at most one new template', () => {
    expect(setOldIndex([0, 1], 1, 0, true)).toEqual([NO_OLD_INDEX, 0]);
    expect(setOldIndex([0, 1], 0, NO_OLD_INDEX, true)).toEqual([NO_OLD_INDEX, 1]);
  });

  it('lists old items whose content/cards would be dropped', () => {
    expect(unusedOldIndices([2, 0], 3)).toEqual([1]);
    expect(unusedOldIndices([NO_OLD_INDEX], 2)).toEqual([0, 1]);
  });
});

describe('notetype editor items', () => {
  it('creates new fields/templates without an ord', () => {
    expect(newFieldItem('Extra').ord).toBeUndefined();
    expect(newTemplateItem('Card 3', '{{Front}}', '{{Back}}').ord).toBeUndefined();
  });

  it('gives every item a distinct client key that is not sent to the engine', () => {
    const items = withKeys<FieldItem>([
      { name: 'A', ord: { val: 0 } },
      { name: 'B', ord: { val: 1 } },
    ]);
    const added = [...items, newFieldItem('C')];
    expect(new Set(added.map((i) => i.clientKey)).size).toBe(3);
    const payload = toPayloadItems(added);
    expect(payload.every((p) => !('clientKey' in p))).toBe(true);
    expect(payload[0]).toEqual({ name: 'A', ord: { val: 0 } });
    expect(payload[2].ord).toBeUndefined();
  });

  it('adopts engine-assigned ords after save, keeping client keys', () => {
    const local = [...withKeys<FieldItem>([{ name: 'A', ord: { val: 0 } }]), newFieldItem('C')];
    const adopted = adoptSavedOrds(local, [
      { name: 'A', ord: { val: 0 } },
      { name: 'C', ord: { val: 1 } },
    ]);
    expect(adopted?.map((i) => i.ord?.val)).toEqual([0, 1]);
    expect(adopted?.map((i) => i.clientKey)).toEqual(local.map((i) => i.clientKey));
    expect(adoptSavedOrds(local, [{ name: 'A', ord: { val: 0 } }])).toBeNull();
    expect(
      adoptSavedOrds(local, [
        { name: 'A', ord: { val: 0 } },
        { name: 'Renamed', ord: { val: 1 } },
      ])
    ).toBeNull();
  });
});

describe('stats: Anki day rollover', () => {
  it('counts the hours before the rollover as the previous day', () => {
    const d = ankiToday(new Date(2026, 10, 28, 2, 30), 4);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 27, 0]);
  });

  it('uses the calendar day after the rollover hour', () => {
    const d = ankiToday(new Date(2026, 10, 28, 4, 0), 4);
    expect([d.getMonth(), d.getDate()]).toEqual([10, 28]);
    const e = ankiToday(new Date(2026, 10, 28, 23, 59), 4);
    expect(e.getDate()).toBe(28);
  });

  it('handles month/year boundaries and a zero rollover', () => {
    const d = ankiToday(new Date(2027, 0, 1, 1, 0), 4);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
    const z = ankiToday(new Date(2026, 10, 28, 0, 5), 0);
    expect(z.getDate()).toBe(28);
  });
});

describe('tag input splitting', () => {
  it('commits pieces followed by a separator and keeps the unfinished rest', () => {
    expect(splitTagInput('문법 ')).toEqual({ complete: ['문법'], rest: '' });
    expect(splitTagInput('a,b c')).toEqual({ complete: ['a', 'b'], rest: 'c' });
    expect(splitTagInput('문법')).toEqual({ complete: [], rest: '문법' });
    expect(splitTagInput('a　b')).toEqual({ complete: ['a'], rest: 'b' });
  });

  it('merges without duplicates', () => {
    expect(mergeTags(['a'], ['a', 'b', ''])).toEqual(['a', 'b']);
  });
});
