export interface StudyKeyOptions {
  code?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
}

export interface StudyKeyContext {
  showAnswer: boolean;
  twoButtonMode: boolean;
  volumeKeysEnabled: boolean;
}

export type StudyKeyAction =
  | { type: 'showAnswer' }
  | { type: 'rate'; rating: 'again' | 'hard' | 'good' | 'easy' }
  | { type: 'setFlag'; flag: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'toggleWhiteboard' }
  | { type: 'toggleShortcuts' }
  | { type: 'editNote' }
  | { type: 'replayAudio' }
  | { type: 'stopAudio' }
  | { type: 'toggleMark' }
  | { type: 'buryCard' }
  | { type: 'buryNote' }
  | { type: 'suspendCard' }
  | { type: 'suspendNote' }
  | { type: 'hanja'; action: 'open' | 'next' | 'prev' };

/**
 * Extracts a normalized lowercase ASCII letter from physical `code` (so Korean/IME keyboard
 * layouts still trigger letter shortcuts) or canonical native names like `KeyQ`/`KeyW`.
 */
function extractLetter(key: string, code: string): string | null {
  const codeMatch = code.match(/^Key([A-Z])$/);
  if (codeMatch) return codeMatch[1].toLowerCase();

  const keyCodeMatch = key.match(/^Key([A-Z])$/i);
  if (keyCodeMatch) return keyCodeMatch[1].toLowerCase();

  if (key.length === 1 && /^[a-z]$/i.test(key)) {
    return key.toLowerCase();
  }
  return null;
}

function extractDigit(key: string, code: string): number | null {
  if (/^[0-9]$/.test(key)) {
    return Number(key);
  }
  const codeMatch = code.match(/^(?:Digit|Numpad)([0-9])$/);
  if (codeMatch) {
    return Number(codeMatch[1]);
  }
  return null;
}

/**
 * Resolves a browser keyboard event or Android Host SSE hardware key event into a study action.
 * Returns `null` when the key should not be consumed (e.g., ArrowUp/ArrowDown for card scrolling,
 * browser shortcuts like Ctrl+C, or Alt-modified navigation).
 */
export function resolveStudyKeyAction(
  keyRaw: string,
  opts: StudyKeyOptions,
  ctx: StudyKeyContext
): StudyKeyAction | null {
  if (opts.alt) return null;

  const key = keyRaw === ' ' ? ' ' : keyRaw.trim();
  const code = (opts.code ?? '').trim();
  const lower = key.toLowerCase();
  const hasCtrl = Boolean(opts.ctrl || opts.meta);
  const hasShift = Boolean(opts.shift);

  // Never consume vertical arrows so cards scroll naturally
  if (
    lower === 'arrowup' ||
    lower === 'arrowdown' ||
    lower === 'dpad_up' ||
    lower === 'dpad_down' ||
    lower === 'keycode_dpad_up' ||
    lower === 'keycode_dpad_down'
  ) {
    return null;
  }

  // Volume, Page, Horizontal D-Pad/Arrow, and Bluetooth Media remote keys
  if (!hasCtrl) {
    if (
      lower === 'volumedown' ||
      lower === 'volume_down' ||
      lower === 'keycode_volume_down'
    ) {
      if (!ctx.volumeKeysEnabled) return null;
      return ctx.showAnswer
        ? { type: 'rate', rating: 'good' }
        : { type: 'showAnswer' };
    }

    if (
      lower === 'volumeup' ||
      lower === 'volume_up' ||
      lower === 'keycode_volume_up'
    ) {
      if (!ctx.volumeKeysEnabled) return null;
      return ctx.showAnswer
        ? { type: 'rate', rating: 'again' }
        : { type: 'showAnswer' };
    }

    if (
      lower === 'pagedown' ||
      lower === 'page_down' ||
      lower === 'keycode_page_down' ||
      lower === 'arrowright' ||
      lower === 'dpad_right' ||
      lower === 'keycode_dpad_right' ||
      lower === 'mediaplaypause' ||
      lower === 'media_play_pause' ||
      lower === 'keycode_media_play_pause' ||
      lower === 'mediatracknext' ||
      lower === 'media_next' ||
      lower === 'keycode_media_next' ||
      lower === 'dpad_center' ||
      lower === 'keycode_dpad_center'
    ) {
      return ctx.showAnswer
        ? { type: 'rate', rating: 'good' }
        : { type: 'showAnswer' };
    }

    if (
      lower === 'pageup' ||
      lower === 'page_up' ||
      lower === 'keycode_page_up' ||
      lower === 'arrowleft' ||
      lower === 'dpad_left' ||
      lower === 'keycode_dpad_left' ||
      lower === 'mediatrackprevious' ||
      lower === 'media_previous' ||
      lower === 'keycode_media_previous'
    ) {
      return ctx.showAnswer
        ? { type: 'rate', rating: 'again' }
        : { type: 'showAnswer' };
    }

    if (
      lower === 'mediastop' ||
      lower === 'media_stop' ||
      lower === 'keycode_media_stop'
    ) {
      return { type: 'stopAudio' };
    }
  }

  const letter = extractLetter(key, code);

  // Ctrl / Cmd shortcuts
  if (hasCtrl) {
    const flagDigit = extractDigit(key, code);
    if (flagDigit !== null && flagDigit >= 0 && flagDigit <= 7 && !hasShift) {
      return { type: 'setFlag', flag: flagDigit };
    }
    if (letter === 'z' && hasShift) {
      return { type: 'redo' };
    }
    if (letter === 'y') {
      return { type: 'redo' };
    }
    if (letter === 'z') {
      return { type: 'undo' };
    }
    return null;
  }

  // Space / Enter: reveal answer, or grade Good after reveal
  if (
    !hasShift &&
    (key === ' ' ||
      key === 'Spacebar' ||
      key === 'Space' ||
      code === 'Space' ||
      key === 'Enter' ||
      code === 'NumpadEnter')
  ) {
    return ctx.showAnswer
      ? { type: 'rate', rating: 'good' }
      : { type: 'showAnswer' };
  }

  // Symbol shortcuts (checked before digits because Shift+1='!', Shift+2='@', Shift+8='*')
  if (key === '?') return { type: 'toggleShortcuts' };
  if (key === '*') return { type: 'toggleMark' };
  if (key === '-') return { type: 'buryCard' };
  if (key === '=') return { type: 'buryNote' };
  if (key === '@') return { type: 'suspendCard' };
  if (key === '!') return { type: 'suspendNote' };

  // Rating digit shortcuts (1..4 in 4-button mode, 1..2 in 2-button mode)
  if (!hasShift) {
    const digit = extractDigit(key, code);
    if (digit === 1) {
      return ctx.showAnswer ? { type: 'rate', rating: 'again' } : null;
    }
    if (digit === 2) {
      if (!ctx.showAnswer) return null;
      return {
        type: 'rate',
        rating: ctx.twoButtonMode ? 'good' : 'hard',
      };
    }
    if (digit === 3) {
      if (!ctx.showAnswer || ctx.twoButtonMode) return null;
      return { type: 'rate', rating: 'good' };
    }
    if (digit === 4) {
      if (!ctx.showAnswer || ctx.twoButtonMode) return null;
      return { type: 'rate', rating: 'easy' };
    }
  }

  // Letter shortcuts (physical code aware for Korean keyboard layouts)
  if (letter === 'u' && !hasShift) return { type: 'undo' };
  if (letter === 'b' && !hasShift) return { type: 'toggleWhiteboard' };
  if (letter === 'e' && !hasShift) return { type: 'editNote' };
  if (letter === 'r' && !hasShift) return { type: 'replayAudio' };
  if (letter === 'q' && !hasShift) return { type: 'hanja', action: 'open' };
  if (letter === 'w') return { type: 'hanja', action: hasShift ? 'prev' : 'next' };

  return null;
}
