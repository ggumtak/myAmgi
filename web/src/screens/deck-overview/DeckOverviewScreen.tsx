import { decks } from '../../anki';
import { useAsync, useCollectionChanges } from '../../lib/hooks';
import { AppBar } from '../../ui/AppBar';
import { DeckOverview } from './DeckOverview';

/** `#/deck/:id` (phone): deck overview with a back arrow. */
export function DeckOverviewScreen({ deckId }: { deckId: number }) {
  const changes = useCollectionChanges();
  const name = useAsync(async () => (await decks.getDeck(deckId)).name, [deckId, changes]);
  const parts = name.data?.split('::') ?? [];
  const leaf = parts.pop() ?? '';
  return (
    <div className="screen">
      <AppBar title={leaf || '덱'} subtitle={parts.join(' › ') || undefined} back />
      <div className="screen__body">
        <DeckOverview deckId={deckId} showTitle={false} />
      </div>
    </div>
  );
}
