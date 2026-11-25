import { Placeholder } from '../../ui/Placeholder';

/** Reviewer (`#/study/:id`) — built in the next round. */
export function StudyScreen({ deckId }: { deckId: number }) {
  return <Placeholder title="학습" detail={`#/study/${deckId}`} />;
}
