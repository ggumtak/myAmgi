/**
 * Keeps only the selected ids that are still in the current results. Returns `prev`
 * itself when nothing was removed, so React can skip the re-render.
 */
export function pruneSelection(prev: Set<number>, resultIds: readonly number[]): Set<number> {
  if (prev.size === 0) return prev;
  const visible = new Set(resultIds);
  let removed = false;
  const next = new Set<number>();
  for (const id of prev) {
    if (visible.has(id)) next.add(id);
    else removed = true;
  }
  return removed ? next : prev;
}
