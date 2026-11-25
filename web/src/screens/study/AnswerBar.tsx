// Bottom bar: "정답 보기" on the question, answer buttons (with the engine's
// next intervals above the labels) on the answer. Same height on both sides.
import type { ReviewerView } from './reviewer';
import type { RatingName } from './studyLogic';

export function AnswerBar({
  view,
  twoButton,
  onShowAnswer,
  onAnswer,
}: {
  view: ReviewerView;
  twoButton: boolean;
  onShowAnswer: () => void;
  onAnswer: (r: RatingName) => void;
}) {
  const disabled = view.busy || !view.card;
  return (
    <footer className={`answer-bar ${twoButton ? 'answer-bar--two' : ''}`} data-testid="answer-bar">
      <div className="answer-bar__inner">
        {view.phase === 'answer' ? (
          <div className="answer-bar__buttons" role="group" aria-label="답 평가">
            {view.buttons.map((b) => (
              <button
                key={b.rating}
                type="button"
                className={`answer-btn answer-btn--${b.rating}`}
                disabled={disabled}
                onClick={() => onAnswer(b.rating)}
                data-testid={`answer-${b.rating}`}
                data-interval={b.interval}
                title={`${b.label} (${b.key})`}
              >
                <span className="answer-btn__interval num" aria-hidden={!b.interval}>
                  {b.interval || ' '}
                </span>
                <span className="answer-btn__label">{b.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="answer-btn answer-btn--show"
            disabled={disabled || view.phase !== 'question'}
            onClick={onShowAnswer}
            data-testid="show-answer"
            title="정답 보기 (Space)"
          >
            <span className="answer-btn__label">정답 보기</span>
          </button>
        )}
      </div>
    </footer>
  );
}
