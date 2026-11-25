import { decks, scheduler } from '../../anki';
import { useAsync, useCollectionChanges, useOnFocus } from '../../lib/hooks';

/** Deck tree (with counts for "now") + the studied-today sentence; reloads on changes/focus. */
export function useDeckData() {
  const changes = useCollectionChanges();
  const state = useAsync(async () => {
    const [tree, studied] = await Promise.all([decks.deckTree(), scheduler.studiedToday().catch(() => '')]);
    return { tree, studied };
  }, [changes]);
  useOnFocus(state.reload);
  return state;
}
