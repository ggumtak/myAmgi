import { Placeholder } from '../../ui/Placeholder';

/** Custom study for a deck — built in the next round. */
export function CustomStudyScreen({ deckId }: { deckId: number }) {
  return <Placeholder title="맞춤 학습" detail={`덱 ${deckId}`} />;
}
