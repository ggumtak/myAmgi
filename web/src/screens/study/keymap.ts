// Reviewer keyboard / remote mapping. One table for Anki desktop shortcuts and
// one for remote-style keys (volume keys and Bluetooth remotes arrive from the
// Android shell as DOM `keydown` events with these `key` names).

export type Side = 'question' | 'answer';

export type StudyAction =
  | 'flip'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | 'undo'
  | 'redo'
  | 'edit'
  | 'replay'
  | 'pauseAudio'
  | 'mark'
  | 'buryCard'
  | 'buryNote'
  | 'suspendCard'
  | 'suspendNote'
  | 'forget'
  | 'setDue'
  | 'deleteNote'
  | 'options'
  | 'cardInfo'
  | 'menu'
  | 'toggleAutoAdvance'
  | 'scrollUp'
  | 'scrollDown'
  | `flag${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/** What a remote button means; resolved against the side being shown. */
export type RemoteAction = 'positive' | 'negative' | 'flip' | 'replay' | 'undo' | 'scrollUp' | 'scrollDown' | 'none';

/**
 * Default remote mapping (pref `study.keyMap` overrides entries):
 * volume-down / PageDown / → = show answer, then 알맞음 (Good);
 * volume-up / PageUp / ← = show answer, then 다시 (Again).
 */
export const DEFAULT_REMOTE_MAP: Readonly<Record<string, RemoteAction>> = {
  AudioVolumeDown: 'positive',
  AudioVolumeUp: 'negative',
  PageDown: 'positive',
  PageUp: 'negative',
  ArrowRight: 'positive',
  ArrowLeft: 'negative',
  MediaPlayPause: 'positive',
  MediaPlay: 'positive',
  MediaPause: 'positive',
  MediaTrackNext: 'positive',
  MediaFastForward: 'positive',
  MediaTrackPrevious: 'negative',
  MediaRewind: 'negative',
  MediaStop: 'replay',
  ArrowDown: 'scrollDown',
  ArrowUp: 'scrollUp',
};

/** Keys that only reach the app when the shell forwards them; gated by `study.volumeKeys`. */
const VOLUME_KEYS = new Set(['AudioVolumeDown', 'AudioVolumeUp', 'VolumeDown', 'VolumeUp']);
/** Keys the shell delivers as synthetic events; `repeat` is true while held. */
export const HARDWARE_KEYS = new Set([...VOLUME_KEYS, 'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious', 'MediaFastForward', 'MediaRewind']);

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  /** undefined = either */
  shift?: boolean;
  action: StudyAction;
}

/** Anki desktop reviewer shortcuts (aqt/reviewer.py `_shortcutKeys` + Korean layout variants). */
export const SHORTCUTS: readonly Shortcut[] = [
  { key: 'e', action: 'edit' },
  { key: 'ㄷ', action: 'edit' },
  { key: 'm', action: 'menu' },
  { key: 'ㅡ', action: 'menu' },
  { key: 'r', action: 'replay' },
  { key: 'ㄱ', action: 'replay' },
  { key: 'F5', action: 'replay' },
  { key: '5', action: 'pauseAudio' },
  { key: '*', action: 'mark' },
  { key: '=', action: 'buryNote' },
  { key: '-', action: 'buryCard' },
  { key: '!', action: 'suspendNote' },
  { key: '@', action: 'suspendCard' },
  { key: 'n', ctrl: true, alt: true, action: 'forget' },
  { key: 'ㅜ', ctrl: true, alt: true, action: 'forget' },
  { key: 'Delete', ctrl: true, action: 'deleteNote' },
  { key: 'Backspace', ctrl: true, action: 'deleteNote' },
  { key: 'd', ctrl: true, shift: true, action: 'setDue' },
  { key: 'o', action: 'options' },
  { key: 'ㅐ', action: 'options' },
  { key: 'i', action: 'cardInfo' },
  { key: 'ㅑ', action: 'cardInfo' },
  { key: 'u', action: 'undo' },
  { key: 'ㅕ', action: 'undo' },
  { key: 'z', ctrl: true, shift: false, action: 'undo' },
  { key: 'z', ctrl: true, shift: true, action: 'redo' },
  { key: 'y', ctrl: true, action: 'redo' },
  { key: 'a', shift: true, action: 'toggleAutoAdvance' },
  ...([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({ key: String(n), ctrl: true, action: `flag${n}` as StudyAction })),
];

export interface KeyContext {
  side: Side;
  twoButton: boolean;
  /** Handle volume keys (pref `volumeKeys`). */
  volumeKeys: boolean;
  /** Pref `study.keyMap`: overrides for the remote table (pref `volumeKeys` gates volume keys). */
  remoteMap?: Record<string, RemoteAction> | null;
}

function remoteToAction(r: RemoteAction, side: Side): StudyAction | null {
  switch (r) {
    case 'positive':
      return side === 'question' ? 'flip' : 'good';
    case 'negative':
      return side === 'question' ? 'flip' : 'again';
    case 'flip':
      return side === 'question' ? 'flip' : null;
    case 'replay':
      return 'replay';
    case 'undo':
      return 'undo';
    case 'scrollUp':
    case 'scrollDown':
      return r;
    default:
      return null;
  }
}

function answerKey(digit: string, twoButton: boolean): StudyAction | null {
  if (twoButton) return digit === '1' ? 'again' : digit === '2' || digit === '3' ? 'good' : null;
  return (({ '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }) as Record<string, StudyAction>)[digit] ?? null;
}

/** The reviewer action for a key press, or null when the key is not ours. */
export function actionForKey(ev: KeyLike, ctx: KeyContext): StudyAction | null {
  const key = ev.key;
  const ctrl = !!(ev.ctrlKey || ev.metaKey);
  const alt = !!ev.altKey;
  const shift = !!ev.shiftKey;

  if (!ctrl && !alt) {
    if (key === ' ' || key === 'Enter' || key === 'Spacebar') return ctx.side === 'question' ? 'flip' : 'good';
    if (/^[1-4]$/.test(key)) return ctx.side === 'answer' ? answerKey(key, ctx.twoButton) : null;
    const remote = { ...DEFAULT_REMOTE_MAP, ...(ctx.remoteMap ?? {}) }[key];
    if (remote) {
      if (VOLUME_KEYS.has(key) && !ctx.volumeKeys) return null;
      return remoteToAction(remote, ctx.side);
    }
  }

  const norm = key.length === 1 ? key.toLowerCase() : key;
  for (const s of SHORTCUTS) {
    const sk = s.key.length === 1 ? s.key.toLowerCase() : s.key;
    if (sk !== norm) continue;
    if (!!s.ctrl !== ctrl || !!s.alt !== alt) continue;
    // Symbols like '*', '!' and '@' need Shift on most layouts: only check Shift where it is specified.
    if (s.shift !== undefined && s.shift !== shift) continue;
    if (s.shift === undefined && /^[a-z]$/.test(sk) && shift) continue;
    return s.action;
  }
  return null;
}

/** Keys the card frame should not act on itself (scrolling, typing a space) because the reviewer owns them. */
export const FRAME_RESERVED_KEYS = [' ', 'Enter', 'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
