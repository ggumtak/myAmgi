import type { EmptyCardsPlan } from '../../anki';

/** Korean explanation of what "빈 카드 정리" will do, shared by the overflow menu and Settings. */
export function EmptyCardsSummary({ plan }: { plan: EmptyCardsPlan }) {
  const { cardIds, noteCount, keptNoteCount } = plan;
  if (cardIds.length === 0) {
    return (
      <p className="amgi-prose" style={{ margin: 0 }}>
        {keptNoteCount > 0
          ? `정리할 빈 카드가 없습니다. 모든 카드가 비어 있는 노트 ${keptNoteCount}개는 노트를 지키기 위해 그대로 둡니다.`
          : '정리할 빈 카드가 없습니다. 모든 카드가 정상입니다.'}
      </p>
    );
  }
  return (
    <p className="amgi-prose" style={{ margin: 0 }}>
      노트 {noteCount}개에서 앞면이 비어 있는 카드 <strong>{cardIds.length}장</strong>을
      삭제합니다. 노트와 필드 내용은 그대로 남습니다.
      {keptNoteCount > 0 &&
        ` 모든 카드가 비어 있는 노트 ${keptNoteCount}개는 노트가 지워지지 않도록 첫 카드 1장씩을 남깁니다.`}
    </p>
  );
}
