/**
 * Mapping helpers for `ChangeNotetypeRequest`.
 *
 * `newFields[i]` / `newTemplates[i]` are indexed by the NEW notetype's field/template `i`
 * and hold the index of the OLD field/template whose content (or cards) it receives,
 * or -1 for none. (Verified against the engine: newFields [2, 0] on old A,B,C -> new X,Y
 * puts C's text into X and A's into Y.)
 */

export const NO_OLD_INDEX = -1;

/** Normalises a backend default map to exactly `newCount` entries. */
export function normaliseMap(raw: readonly (number | null | undefined)[] | null | undefined, newCount: number): number[] {
  return Array.from({ length: newCount }, (_, i) => {
    const v = raw?.[i];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : NO_OLD_INDEX;
  });
}

/**
 * Sets which old item feeds new item `newIdx`. With `unique` (templates: one old card can
 * only become one new card), any other new item that used the same old index is cleared,
 * matching the official change-notetype page.
 */
export function setOldIndex(
  map: readonly number[],
  newIdx: number,
  oldIdx: number,
  unique: boolean
): number[] {
  const next = [...map];
  if (unique && oldIdx >= 0) {
    for (let i = 0; i < next.length; i++) {
      if (i !== newIdx && next[i] === oldIdx) next[i] = NO_OLD_INDEX;
    }
  }
  next[newIdx] = oldIdx >= 0 ? oldIdx : NO_OLD_INDEX;
  return next;
}

/** Old indices no new item takes from (their field content / cards are discarded). */
export function unusedOldIndices(map: readonly number[], oldCount: number): number[] {
  const used = new Set(map.filter((v) => v >= 0));
  return Array.from({ length: oldCount }, (_, i) => i).filter((i) => !used.has(i));
}
