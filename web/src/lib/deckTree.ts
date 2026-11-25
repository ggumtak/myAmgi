// Flattening the engine's deck tree into visible list rows.

/** Structural subset of `anki.decks.DeckTreeNode` (decoded nested fields are typed optional). */
export interface DeckNodeLike {
  deckId?: number | null;
  name?: string | null;
  level?: number | null;
  collapsed?: boolean | null;
  newCount?: number | null;
  learnCount?: number | null;
  reviewCount?: number | null;
  filtered?: boolean | null;
  children?: DeckNodeLike[] | null;
}

export interface DeckRow {
  id: number;
  /** Leaf name, e.g. "한자". */
  name: string;
  /** Full path, e.g. "일본어::한자". */
  fullName: string;
  /** 0 for top-level decks. */
  depth: number;
  parentId: number | null;
  hasChildren: boolean;
  collapsed: boolean;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  filtered: boolean;
}

/**
 * Depth-first list of rows under the (nameless) root node, skipping the
 * children of collapsed decks. `collapsedOverride` lets the UI show a toggle
 * immediately while the engine call is in flight.
 */
export function flattenDeckTree(root: DeckNodeLike, collapsedOverride?: ReadonlyMap<number, boolean>): DeckRow[] {
  const rows: DeckRow[] = [];
  const walk = (node: DeckNodeLike, prefix: string, depth: number, parentId: number | null) => {
    for (const child of node.children ?? []) {
      const id = child.deckId ?? 0;
      const name = child.name ?? '';
      const fullName = prefix ? `${prefix}::${name}` : name;
      const hasChildren = (child.children?.length ?? 0) > 0;
      const collapsed = hasChildren && (collapsedOverride?.get(id) ?? !!child.collapsed);
      rows.push({
        id,
        name,
        fullName,
        depth,
        parentId,
        hasChildren,
        collapsed,
        newCount: child.newCount ?? 0,
        learnCount: child.learnCount ?? 0,
        reviewCount: child.reviewCount ?? 0,
        filtered: !!child.filtered,
      });
      if (hasChildren && !collapsed) walk(child, fullName, depth + 1, id);
    }
  };
  walk(root, '', 0, null);
  return rows;
}

/** Find a deck node and its full name. */
export function findDeck(root: DeckNodeLike, id: number): { node: DeckNodeLike; fullName: string } | null {
  const walk = (node: DeckNodeLike, prefix: string): { node: DeckNodeLike; fullName: string } | null => {
    for (const child of node.children ?? []) {
      const fullName = prefix ? `${prefix}::${child.name ?? ''}` : (child.name ?? '');
      if (child.deckId === id) return { node: child, fullName };
      const found = walk(child, fullName);
      if (found) return found;
    }
    return null;
  };
  return walk(root, '');
}

/** All full deck names in the tree (lower-cased compare helpers use this). */
export function allDeckNames(root: DeckNodeLike): string[] {
  const out: string[] = [];
  const walk = (node: DeckNodeLike, prefix: string) => {
    for (const child of node.children ?? []) {
      const full = prefix ? `${prefix}::${child.name ?? ''}` : (child.name ?? '');
      out.push(full);
      walk(child, full);
    }
  };
  walk(root, '');
  return out;
}

export function dueTotal(r: { newCount: number; learnCount: number; reviewCount: number }): number {
  return r.newCount + r.learnCount + r.reviewCount;
}

/** Normalizes user input for a deck name: trims each "::" component, drops empties. */
export function normalizeDeckName(input: string): string {
  return input
    .split('::')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('::');
}

/** Engine deck names compare case-insensitively (Unicode-aware). */
export function sameDeckName(a: string, b: string): boolean {
  return normalizeDeckName(a).toLocaleLowerCase() === normalizeDeckName(b).toLocaleLowerCase();
}
