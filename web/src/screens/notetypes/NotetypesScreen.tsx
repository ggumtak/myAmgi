import { Placeholder } from '../../ui/Placeholder';

/** Note types (`#/notetypes`) — built in the next round. */
export function NotetypesScreen() {
  return <Placeholder title="노트 유형" />;
}

/** One note type: fields and templates (`#/notetype/:id`) — built in the next round. */
export function NotetypeScreen({ notetypeId }: { notetypeId: number }) {
  return <Placeholder title="노트 유형 편집" detail={`노트 유형 ${notetypeId}`} />;
}
