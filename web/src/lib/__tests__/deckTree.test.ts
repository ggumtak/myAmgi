import { describe, expect, it } from 'vitest';
import { allDeckNames, findDeck, flattenDeckTree, normalizeDeckName, sameDeckName, type DeckNodeLike } from '../deckTree';

const node = (deckId: number, name: string, counts: [number, number, number], children: DeckNodeLike[] = [], extra: Partial<DeckNodeLike> = {}): DeckNodeLike => ({
  deckId,
  name,
  newCount: counts[0],
  learnCount: counts[1],
  reviewCount: counts[2],
  children,
  collapsed: false,
  filtered: false,
  ...extra,
});

const tree: DeckNodeLike = node(0, '', [0, 0, 0], [
  node(1, '영어', [4, 0, 1]),
  node(2, '일본어', [7, 2, 5], [node(3, '어휘', [3, 1, 2]), node(4, '한자', [4, 1, 3], [node(5, 'N3', [1, 0, 0])])]),
  node(6, '집중 복습', [1, 0, 0], [], { filtered: true }),
]);

describe('flattenDeckTree', () => {
  it('lists decks depth-first with full names, depth and counts', () => {
    const rows = flattenDeckTree(tree);
    expect(rows.map((r) => [r.fullName, r.depth])).toEqual([
      ['영어', 0],
      ['일본어', 0],
      ['일본어::어휘', 1],
      ['일본어::한자', 1],
      ['일본어::한자::N3', 2],
      ['집중 복습', 0],
    ]);
    const kanji = rows.find((r) => r.id === 4)!;
    expect(kanji).toMatchObject({ name: '한자', parentId: 2, hasChildren: true, newCount: 4, learnCount: 1, reviewCount: 3 });
    expect(rows.find((r) => r.id === 6)!.filtered).toBe(true);
  });

  it('hides children of collapsed decks', () => {
    const collapsed = node(0, '', [0, 0, 0], [node(2, '일본어', [7, 2, 5], [node(3, '어휘', [3, 1, 2])], { collapsed: true })]);
    const rows = flattenDeckTree(collapsed);
    expect(rows.map((r) => r.fullName)).toEqual(['일본어']);
    expect(rows[0].collapsed).toBe(true);
  });

  it('a leaf deck is never "collapsed" even if the engine flag is set', () => {
    const rows = flattenDeckTree(node(0, '', [0, 0, 0], [node(1, '영어', [1, 0, 0], [], { collapsed: true })]));
    expect(rows[0].collapsed).toBe(false);
    expect(rows[0].hasChildren).toBe(false);
  });

  it('applies optimistic collapse overrides', () => {
    const rows = flattenDeckTree(tree, new Map([[2, true]]));
    expect(rows.map((r) => r.fullName)).toEqual(['영어', '일본어', '집중 복습']);
    expect(flattenDeckTree(tree, new Map([[4, true]])).some((r) => r.id === 5)).toBe(false);
  });

  it('treats missing fields (decoded defaults) as zero/empty', () => {
    const rows = flattenDeckTree({ children: [{ deckId: 9, name: 'x' }] });
    expect(rows[0]).toMatchObject({ newCount: 0, learnCount: 0, reviewCount: 0, filtered: false, collapsed: false });
  });
});

describe('deck name helpers', () => {
  it('finds decks and full names', () => {
    expect(findDeck(tree, 5)?.fullName).toBe('일본어::한자::N3');
    expect(findDeck(tree, 99)).toBeNull();
    expect(allDeckNames(tree)).toContain('일본어::어휘');
  });

  it('normalizes and compares names like the engine', () => {
    expect(normalizeDeckName('  일본어 :: 한자 ::')).toBe('일본어::한자');
    expect(normalizeDeckName(' :: ')).toBe('');
    expect(sameDeckName('English::A', 'english :: a')).toBe(true);
    expect(sameDeckName('영어', '영어2')).toBe(false);
  });
});
