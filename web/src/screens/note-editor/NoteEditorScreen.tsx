import { Placeholder } from '../../ui/Placeholder';

/** Note editor (`#/note/new?deck=`, `#/note/:id`) — built in the next round. */
export function NoteEditorScreen(props: { mode: 'add' | 'edit'; deckId?: number; noteId?: number }) {
  return props.mode === 'add' ? (
    <Placeholder title="노트 추가" detail={props.deckId ? `덱 ${props.deckId}` : undefined} />
  ) : (
    <Placeholder title="노트 편집" detail={`노트 ${props.noteId}`} />
  );
}
