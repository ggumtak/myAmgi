// Small pure helpers of the reviewer: answer-button selection, time taken,
// "set due date" input, timer text, preferences.
import type { anki } from '../../anki/proto';

export type RatingName = 'again' | 'hard' | 'good' | 'easy';
export const RATING_VALUE: Record<RatingName, 0 | 1 | 2 | 3> = { again: 0, hard: 1, good: 2, easy: 3 };
const ORDER: RatingName[] = ['again', 'hard', 'good', 'easy'];

type States = anki.scheduler.SchedulingStates.$Properties;
type State = anki.scheduler.SchedulingState.$Properties;

/** The engine state for a rating (the one `answerCard` must receive as `newState`). */
export function stateForRating(states: States, rating: RatingName): State | null | undefined {
  return states[rating];
}

export interface AnswerButton {
  rating: RatingName;
  label: string;
  /** Interval text from `describeNextStates` ('' when hidden or unknown). */
  interval: string;
  /** Anki's shortcut digit. */
  key: string;
}

const LABELS_4: Record<RatingName, string> = { again: '다시', hard: '어려움', good: '알맞음', easy: '쉬움' };
const LABELS_2: Partial<Record<RatingName, string>> = { again: '모름', good: '암기 완료' };

/**
 * The buttons to show. `labels` are describeNextStates' [again, hard, good, easy].
 * Ratings the engine did not offer a state for are left out.
 */
export function answerButtons(states: States | null | undefined, labels: string[], twoButton: boolean, showIntervals = true): AnswerButton[] {
  const out: AnswerButton[] = [];
  ORDER.forEach((rating, i) => {
    if (!states || !states[rating]) return;
    const label = twoButton ? LABELS_2[rating] : LABELS_4[rating];
    if (!label) return;
    out.push({
      rating,
      label,
      interval: showIntervals ? labels[i] ?? '' : '',
      key: twoButton ? (rating === 'again' ? '1' : '2') : String(i + 1),
    });
  });
  return out;
}

/** Milliseconds to record for an answer: elapsed time capped at the deck's "maximum answer seconds", like Anki's `card.time_taken()`. */
export function timeTakenMs(startedAt: number, now: number, capSecs: number): number {
  const total = Math.max(0, Math.round(now - startedAt));
  return Math.min(total, Math.max(0, capSecs) * 1000);
}

/** "1:05" for the visible timer. */
export function formatTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface DueDateInput {
  min: number;
  max: number;
  /** `!` suffix: also set the interval to the new due distance. */
  changeInterval: boolean;
  /** Normalized text for the engine's `setDueDate`. */
  text: string;
}

/** Parses Anki's set-due-date syntax: `0`, `3`, `3-7`, `3!`, `3-7!`. */
export function parseDueDate(input: string): DueDateInput | null {
  const m = /^\s*(\d{1,5})\s*(?:-\s*(\d{1,5})\s*)?(!)?\s*$/.exec(input);
  if (!m) return null;
  let min = Number(m[1]);
  let max = m[2] !== undefined ? Number(m[2]) : min;
  if (max < min) [min, max] = [max, min];
  const changeInterval = !!m[3];
  const text = `${min === max ? min : `${min}-${max}`}${changeInterval ? '!' : ''}`;
  return { min, max, changeInterval, text };
}

/** Remaining counts with the queue of the shown card (0 new, 1 learning, 2 review). */
export function activeQueueIndex(queue: number | null | undefined): 0 | 1 | 2 {
  return queue === 0 ? 0 : queue === 1 ? 1 : 2;
}

// ---------------------------------------------------------------------------
// Preferences (host `prefs`)
// ---------------------------------------------------------------------------

export interface StudyPrefs {
  twoButton: boolean;
  tapToFlip: boolean;
  volumeKeys: boolean;
  /** Percent. */
  fontScale: number;
  /** null = follow Anki's own preference. */
  showRemaining: boolean | null;
  showIntervals: boolean | null;
  autoAdvance: boolean;
  hanja: boolean;
  keyMap: Record<string, string> | null;
}

const bool = (...vals: unknown[]): boolean | undefined => vals.find((v) => typeof v === 'boolean') as boolean | undefined;

/** Reads the `study.*` prefs (falls back to the older settings-screen keys). */
export function readStudyPrefs(prefs: Record<string, unknown>, eink: boolean): StudyPrefs {
  const scaleRaw = [prefs['study.fontScale'], prefs.cardFontScale].find((v) => typeof v === 'number' && v > 0) as number | undefined;
  const fontScale = scaleRaw === undefined ? 100 : scaleRaw <= 4 ? Math.round(scaleRaw * 100) : Math.round(scaleRaw);
  const keyMap = prefs['study.keyMap'];
  return {
    twoButton: bool(prefs['study.twoButton'], prefs.twoButtons) ?? eink,
    tapToFlip: bool(prefs['study.tapToFlip'], prefs.tapToShowAnswer) ?? true,
    volumeKeys: bool(prefs['study.volumeKeys'], prefs.volumeKeys) ?? true,
    fontScale: Math.min(300, Math.max(50, fontScale)),
    showRemaining: bool(prefs['study.showRemaining']) ?? null,
    showIntervals: bool(prefs['study.showIntervals']) ?? null,
    autoAdvance: bool(prefs['study.autoAdvance']) ?? false,
    hanja: bool(prefs['study.hanja']) ?? true,
    keyMap: keyMap && typeof keyMap === 'object' ? (keyMap as Record<string, string>) : null,
  };
}
