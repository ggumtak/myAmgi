import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, Card, Deck, Ease, Note, NoteType } from '../types/models';
import { previewCardScheduling } from '../engine/scheduler';
import {
  hydrateContainerMedia,
  renderCardContent,
  RenderedCard,
  resolveMediaUrl,
} from '../engine/cardRenderer';

interface StudyViewProps {
  deck: Deck;
  queue: Card[];
  notesById: Map<number, Note>;
  noteTypesById: Map<number, NoteType>;
  settings: AppSettings;
  canUndo: boolean;
  onAnswer: (card: Card, ease: Ease, elapsedMs: number) => Promise<void>;
  onUndo: () => Promise<void>;
  onExit: () => void;
}

declare global {
  interface Window {
    onUpdateHook?: Array<() => void>;
    onShownHook?: Array<() => void>;
  }
}

export const StudyView: React.FC<StudyViewProps> = ({
  deck,
  queue,
  notesById,
  noteTypesById,
  settings,
  canUndo,
  onAnswer,
  onUndo,
  onExit,
}) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [rendered, setRendered] = useState<RenderedCard | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const cardStartTimeRef = useRef<number>(Date.now());
  const cardHostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentCard = queue[0];
  const currentNote = currentCard ? notesById.get(currentCard.nid) : undefined;
  const currentNoteType = currentNote ? noteTypesById.get(currentNote.mid) : undefined;

  const previews = useMemo(() => {
    if (!currentCard) return null;
    return previewCardScheduling(currentCard, deck);
  }, [currentCard, deck]);

  const playSound = useCallback(
    async (fileName: string) => {
      const url = await resolveMediaUrl(fileName, settings);
      if (!url) return;
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        await audio.play();
      } catch {
        // Ignore autoplay restrictions
      }
    },
    [settings]
  );

  // Reset card view on card change
  useEffect(() => {
    setShowAnswer(false);
    cardStartTimeRef.current = Date.now();
  }, [currentCard?.id]);

  // Render template + CSS
  useEffect(() => {
    let active = true;
    if (!currentCard || !currentNote || !currentNoteType) {
      setRendered(null);
      return;
    }
    renderCardContent(currentNote, currentNoteType, currentCard.ord, settings).then((res) => {
      if (active) setRendered(res);
    });
    return () => {
      active = false;
    };
  }, [currentCard, currentNote, currentNoteType, settings]);

  // Hydrate media, wire sound buttons, and run onUpdateHook / onShownHook
  useEffect(() => {
    const host = cardHostRef.current;
    if (!host || !rendered) return;

    let cancelled = false;
    hydrateContainerMedia(host, settings);

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('.amgi-sound-btn') as HTMLElement | null;
      if (btn) {
        const sound = btn.getAttribute('data-sound');
        if (sound) void playSound(sound);
      }
    };
    host.addEventListener('click', handleClick);

    // Initialize Anki global hooks and execute deck JS
    window.onUpdateHook = [];
    window.onShownHook = [];

    for (const scriptCode of rendered.scripts) {
      try {
        const fn = new Function(scriptCode);
        fn();
      } catch (err) {
        console.warn('Card script execution error:', err);
      }
    }

    if (!cancelled) {
      for (const cb of window.onUpdateHook ?? []) {
        try {
          cb();
        } catch {
          // ignore
        }
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        for (const cb of window.onShownHook ?? []) {
          try {
            cb();
          } catch {
            // ignore
          }
        }
      });
    }

    return () => {
      cancelled = true;
      host.removeEventListener('click', handleClick);
    };
  }, [rendered, showAnswer, playSound, settings]);

  const submitEase = useCallback(
    async (ease: Ease) => {
      if (!currentCard || isAnswering) return;
      setIsAnswering(true);
      try {
        const elapsed = Date.now() - cardStartTimeRef.current;
        await onAnswer(currentCard, ease, elapsed);
      } finally {
        setIsAnswering(false);
      }
    },
    [currentCard, isAnswering, onAnswer]
  );

  // Keyboard shortcuts:
  // 2-button mode (default ON): Space = Show Answer; after answer, Space/Enter = Good (3), 1 = Again (1), 2 = Good (3), 3/4 IGNORED
  // 4-button mode: Space/Enter = Show Answer or Good (3), 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!currentCard) return;

      if (!showAnswer) {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          setShowAnswer(true);
        }
        return;
      }

      if (settings.twoButtonMode) {
        if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          void submitEase(3);
        } else if (e.key === '1') {
          e.preventDefault();
          void submitEase(1);
        } else if (e.key === '2') {
          e.preventDefault();
          void submitEase(3);
        } else if (e.key === '3' || e.key === '4') {
          // Explicitly ignored in 2-button mode
          e.preventDefault();
        }
      } else {
        if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          void submitEase(3);
        } else if (e.key === '1') {
          e.preventDefault();
          void submitEase(1);
        } else if (e.key === '2') {
          e.preventDefault();
          void submitEase(2);
        } else if (e.key === '3') {
          e.preventDefault();
          void submitEase(3);
        } else if (e.key === '4') {
          e.preventDefault();
          void submitEase(4);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, showAnswer, settings.twoButtonMode, submitEase]);

  if (!currentCard) {
    return (
      <div className="study-empty card-surface">
        <div className="study-empty-icon">🎉</div>
        <h2>오늘 학습을 모두 완료했습니다!</h2>
        <p className="muted-text">
          <strong>{deck.name}</strong> 덱에 남은 복습 카드가 없습니다.
        </p>
        <div className="study-empty-actions">
          {canUndo && (
            <button type="button" className="btn btn-secondary" onClick={onUndo}>
              ↩ 마지막 복습 되돌리기
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onExit}>
            덱 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-container">
      <div className="study-header">
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          ← 덱 목록
        </button>
        <div className="study-deck-title">
          <span>{deck.name}</span>
          <span className="badge badge-neutral">남은 카드 {queue.length}</span>
          {settings.twoButtonMode && (
            <span className="badge badge-accent">2버튼 고속 모드</span>
          )}
        </div>
        <div className="study-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canUndo || isAnswering}
            onClick={onUndo}
            title="마지막 평가 되돌리기"
          >
            ↩ 되돌리기
          </button>
        </div>
      </div>

      <div className="study-card-stage card-surface">
        {rendered && <style>{rendered.scopedCss}</style>}
        <div
          ref={cardHostRef}
          className="amgi-card-host card"
          dangerouslySetInnerHTML={{
            __html: showAnswer
              ? rendered?.backHtml ?? ''
              : rendered?.frontHtml ?? '',
          }}
        />
      </div>

      <div className="study-controls">
        {!showAnswer ? (
          <button
            type="button"
            className="btn btn-primary btn-show-answer"
            onClick={() => setShowAnswer(true)}
          >
            정답 보기 <span className="kbd-hint">Space</span>
          </button>
        ) : settings.twoButtonMode ? (
          <div className="answer-buttons two-btn">
            <button
              type="button"
              className="btn-rate rate-again"
              disabled={isAnswering}
              onClick={() => void submitEase(1)}
            >
              <span className="rate-label">다시</span>
              <span className="rate-meta">
                {previews?.[1].label ?? '1분'} · <kbd>1</kbd>
              </span>
            </button>
            <button
              type="button"
              className="btn-rate rate-good"
              disabled={isAnswering}
              onClick={() => void submitEase(3)}
            >
              <span className="rate-label">괜찮음</span>
              <span className="rate-meta">
                {previews?.[3].label ?? '1일'} · <kbd>Space / 2</kbd>
              </span>
            </button>
          </div>
        ) : (
          <div className="answer-buttons four-btn">
            <button
              type="button"
              className="btn-rate rate-again"
              disabled={isAnswering}
              onClick={() => void submitEase(1)}
            >
              <span className="rate-label">다시</span>
              <span className="rate-meta">
                {previews?.[1].label ?? '1분'} · <kbd>1</kbd>
              </span>
            </button>
            <button
              type="button"
              className="btn-rate rate-hard"
              disabled={isAnswering}
              onClick={() => void submitEase(2)}
            >
              <span className="rate-label">어려움</span>
              <span className="rate-meta">
                {previews?.[2].label ?? '6분'} · <kbd>2</kbd>
              </span>
            </button>
            <button
              type="button"
              className="btn-rate rate-good"
              disabled={isAnswering}
              onClick={() => void submitEase(3)}
            >
              <span className="rate-label">괜찮음</span>
              <span className="rate-meta">
                {previews?.[3].label ?? '1일'} · <kbd>3</kbd>
              </span>
            </button>
            <button
              type="button"
              className="btn-rate rate-easy"
              disabled={isAnswering}
              onClick={() => void submitEase(4)}
            >
              <span className="rate-label">쉬움</span>
              <span className="rate-meta">
                {previews?.[4].label ?? '4일'} · <kbd>4</kbd>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
