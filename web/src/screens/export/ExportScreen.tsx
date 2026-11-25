import { Placeholder } from '../../ui/Placeholder';

/** Export a deck or the collection — built in the next round. */
export function ExportScreen({ deckId }: { deckId: number }) {
  return <Placeholder title="내보내기" detail={deckId ? `덱 ${deckId}` : '전체 컬렉션'} />;
}
