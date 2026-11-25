// Deck overview: name, description, the three counts, "학습 시작" (disabled with
// the reason when nothing is due), and secondary actions.
import { decks, scheduler, search } from '../../anki';
import { findDeck } from '../../lib/deckTree';
import { formatCount, formatWait } from '../../lib/format';
import { useAsync, useCollectionChanges, useOnFocus } from '../../lib/hooks';
import { href, navigate } from '../../lib/router';
import { sanitizeHtml } from '../../lib/sanitize';
import { Button } from '../../ui/Button';
import { LoadingState } from '../../ui/Spinner';
import { ErrorState } from '../../ui/States';
import { toast } from '../../ui/Toast';
import { empty, rebuild } from '../decks/useDeckActions';
import type { CongratsInfo } from '../../anki/scheduler';
import './DeckOverview.css';

export interface OverviewData {
  id: number;
  fullName: string;
  filtered: boolean;
  description: string;
  markdown: boolean;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  congrats: CongratsInfo | null;
}

export async function loadOverview(deckId: number): Promise<OverviewData> {
  const deck = await decks.getDeck(deckId);
  // Selecting a deck makes it current, as in Anki (congrats info is per current deck).
  await decks.setCurrentDeck(deckId);
  const tree = await decks.deckTree();
  const found = findDeck(tree, deckId);
  const node = found?.node;
  const due = node ? (node.newCount ?? 0) + (node.learnCount ?? 0) + (node.reviewCount ?? 0) : 0;
  const congrats = due === 0 ? await scheduler.congratsInfo() : null;
  return {
    id: deckId,
    fullName: found?.fullName ?? deck.name,
    filtered: !!deck.filtered,
    description: deck.normal?.description ?? '',
    markdown: !!deck.normal?.markdownDescription,
    newCount: node?.newCount ?? 0,
    learnCount: node?.learnCount ?? 0,
    reviewCount: node?.reviewCount ?? 0,
    congrats,
  };
}

/** Korean explanation of why nothing is due, from the engine's congrats info. */
export function nothingDueMessage(c: CongratsInfo | null): string[] {
  if (!c) return ['오늘 이 덱의 학습을 모두 마쳤습니다.'];
  const lines = ['오늘 이 덱의 학습을 모두 마쳤습니다.'];
  if (c.learnRemaining > 0) {
    lines.push(
      c.secsUntilNextLearn > 0
        ? `학습 중인 카드 ${formatCount(c.learnRemaining)}장이 ${formatWait(c.secsUntilNextLearn)} 후에 다시 나옵니다.`
        : `학습 중인 카드 ${formatCount(c.learnRemaining)}장이 곧 다시 나옵니다.`,
    );
  }
  if (c.newRemaining || c.reviewRemaining) {
    lines.push('오늘의 한도에 도달했습니다. 덱 옵션에서 한도를 늘리거나 맞춤 학습으로 더 공부할 수 있습니다.');
  }
  if (c.haveSchedBuried || c.haveUserBuried) lines.push('숨긴 카드가 있습니다.');
  return lines;
}

function Description({ html, markdown }: { html: string; markdown: boolean }) {
  if (!html.trim()) return null;
  if (markdown) return <p className="overview__desc overview__desc--plain">{html}</p>;
  return <div className="overview__desc" data-testid="deck-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

export function DeckOverview({ deckId, showTitle = true }: { deckId: number; showTitle?: boolean }) {
  const changes = useCollectionChanges();
  const state = useAsync(() => loadOverview(deckId), [deckId, changes]);
  useOnFocus(state.reload);

  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data || state.data.id !== deckId) return <LoadingState />;
  const d = state.data;
  const due = d.newCount + d.learnCount + d.reviewCount;
  const parts = d.fullName.split('::');
  const leaf = parts.pop()!;

  return (
    <div className="overview" data-testid="deck-overview" data-deck-id={d.id}>
      {showTitle && (
        <header className="overview__head">
          {parts.length > 0 && <div className="overview__path">{parts.join(' › ')}</div>}
          <h2 className={`overview__title ${d.filtered ? 'overview__title--filtered' : ''}`}>{leaf}</h2>
        </header>
      )}
      <Description html={d.description} markdown={d.markdown} />

      <div className="overview__counts" role="group" aria-label="오늘 학습할 카드">
        <div className="overview__count overview__count--new" data-count="new">
          <span className="overview__count-value num">{formatCount(d.newCount)}</span>
          <span className="overview__count-label">새 카드</span>
        </div>
        <div className="overview__count overview__count--learn" data-count="learn">
          <span className="overview__count-value num">{formatCount(d.learnCount)}</span>
          <span className="overview__count-label">학습</span>
        </div>
        <div className="overview__count overview__count--review" data-count="review">
          <span className="overview__count-value num">{formatCount(d.reviewCount)}</span>
          <span className="overview__count-label">복습</span>
        </div>
      </div>

      <div className="overview__start">
        <Button variant="primary" block disabled={due === 0} onClick={() => navigate(`/study/${d.id}`)} data-testid="start-study">
          학습 시작
        </Button>
        {due === 0 && (
          <div className="overview__done" data-testid="nothing-due">
            {nothingDueMessage(d.congrats).map((l) => (
              <p key={l}>{l}</p>
            ))}
            {d.congrats && (d.congrats.haveSchedBuried || d.congrats.haveUserBuried) && (
              <Button
                variant="text"
                onClick={async () => {
                  await scheduler.unburyDeck(d.id);
                  toast('숨긴 카드를 다시 보이게 했습니다');
                  state.reload();
                }}
              >
                숨긴 카드 다시 보이기
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="overview__actions">
        {d.filtered ? (
          <>
            <Button onClick={() => void rebuild({ id: d.id, fullName: d.fullName, name: leaf, filtered: true })}>다시 만들기</Button>
            <Button onClick={() => void empty({ id: d.id, fullName: d.fullName, name: leaf, filtered: true })}>비우기</Button>
          </>
        ) : (
          <Button onClick={() => navigate(`/deck-options/${d.id}`)}>덱 옵션</Button>
        )}
        <Button onClick={() => navigate(`/custom-study/${d.id}`)}>맞춤 학습</Button>
        <Button onClick={() => navigate(href('/browse', { q: search.deckSearch(d.fullName) }).slice(1))}>카드 찾아보기</Button>
        <Button onClick={() => navigate('/stats')}>통계</Button>
      </div>
    </div>
  );
}
