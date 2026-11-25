import { Placeholder } from '../../ui/Placeholder';

/** Create (`new`) or edit a filtered deck — built in the next round. */
export function FilteredDeckScreen({ deckId }: { deckId: string }) {
  return <Placeholder title={deckId === 'new' ? '필터 덱 만들기' : '필터 덱 옵션'} />;
}
