import { describe, expect, it } from 'vitest';
import { resolveStudyKeyAction } from './studyKeys';

describe('resolveStudyKeyAction', () => {
  const questionCtx = { showAnswer: false, twoButtonMode: false, volumeKeysEnabled: true };
  const answer4Ctx = { showAnswer: true, twoButtonMode: false, volumeKeysEnabled: true };
  const answer2Ctx = { showAnswer: true, twoButtonMode: true, volumeKeysEnabled: true };

  it('reveals on Space/Enter and grades Good after reveal', () => {
    expect(resolveStudyKeyAction(' ', { code: 'Space' }, questionCtx)).toEqual({
      type: 'showAnswer',
    });
    expect(resolveStudyKeyAction('Enter', { code: 'Enter' }, questionCtx)).toEqual({
      type: 'showAnswer',
    });
    expect(resolveStudyKeyAction(' ', { code: 'Space' }, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'good',
    });
    expect(resolveStudyKeyAction('Enter', { code: 'Enter' }, answer2Ctx)).toEqual({
      type: 'rate',
      rating: 'good',
    });
  });

  it('handles Korean keyboard layout via e.code for letter shortcuts', () => {
    // Korean Hangul keys: ㅠ(KeyB), ㄷ(KeyE), ㄱ(KeyR), ㅕ(KeyU), ㅂ(KeyQ), ㅈ(KeyW), ㅋ(Ctrl+Z)
    expect(resolveStudyKeyAction('ㅠ', { code: 'KeyB' }, questionCtx)).toEqual({
      type: 'toggleWhiteboard',
    });
    expect(resolveStudyKeyAction('ㄷ', { code: 'KeyE' }, questionCtx)).toEqual({
      type: 'editNote',
    });
    expect(resolveStudyKeyAction('ㄱ', { code: 'KeyR' }, questionCtx)).toEqual({
      type: 'replayAudio',
    });
    expect(resolveStudyKeyAction('ㅕ', { code: 'KeyU' }, questionCtx)).toEqual({
      type: 'undo',
    });
    expect(resolveStudyKeyAction('ㅂ', { code: 'KeyQ' }, questionCtx)).toEqual({
      type: 'hanja',
      action: 'open',
    });
    expect(resolveStudyKeyAction('ㅈ', { code: 'KeyW' }, questionCtx)).toEqual({
      type: 'hanja',
      action: 'next',
    });
    expect(
      resolveStudyKeyAction('ㅈ', { code: 'KeyW', shift: true }, questionCtx)
    ).toEqual({
      type: 'hanja',
      action: 'prev',
    });
    expect(
      resolveStudyKeyAction('ㅋ', { code: 'KeyZ', ctrl: true }, questionCtx)
    ).toEqual({
      type: 'undo',
    });
    expect(
      resolveStudyKeyAction('ㅋ', { code: 'KeyZ', ctrl: true, shift: true }, questionCtx)
    ).toEqual({
      type: 'redo',
    });
  });

  it('handles Android MainActivity canonical hardware key names', () => {
    expect(resolveStudyKeyAction('ArrowLeft', {}, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'again',
    });
    expect(resolveStudyKeyAction('ArrowRight', {}, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'good',
    });
    expect(resolveStudyKeyAction('KeyQ', {}, questionCtx)).toEqual({
      type: 'hanja',
      action: 'open',
    });
    expect(resolveStudyKeyAction('KeyW', { shift: true }, questionCtx)).toEqual({
      type: 'hanja',
      action: 'prev',
    });
    expect(resolveStudyKeyAction('MediaPlayPause', {}, questionCtx)).toEqual({
      type: 'showAnswer',
    });
    expect(resolveStudyKeyAction('MediaTrackNext', {}, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'good',
    });
    expect(resolveStudyKeyAction('MediaTrackPrevious', {}, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'again',
    });
    expect(resolveStudyKeyAction('MediaStop', {}, answer4Ctx)).toEqual({
      type: 'stopAudio',
    });
  });

  it('never consumes ArrowUp or ArrowDown so cards scroll naturally', () => {
    expect(resolveStudyKeyAction('ArrowUp', { code: 'ArrowUp' }, questionCtx)).toBeNull();
    expect(resolveStudyKeyAction('ArrowDown', { code: 'ArrowDown' }, answer4Ctx)).toBeNull();
  });

  it('respects volumeKeysEnabled setting and does not intercept Ctrl+C / Alt+ArrowLeft', () => {
    expect(
      resolveStudyKeyAction('VolumeDown', {}, { ...questionCtx, volumeKeysEnabled: false })
    ).toBeNull();
    expect(
      resolveStudyKeyAction('VolumeDown', {}, { ...questionCtx, volumeKeysEnabled: true })
    ).toEqual({ type: 'showAnswer' });
    expect(resolveStudyKeyAction('c', { code: 'KeyC', ctrl: true }, answer4Ctx)).toBeNull();
    expect(resolveStudyKeyAction('ArrowLeft', { alt: true }, answer4Ctx)).toBeNull();
  });

  it('maps 1..4 in 4-button mode, 1..2 in 2-button mode, and Shift symbols !/@/*', () => {
    expect(resolveStudyKeyAction('2', { code: 'Digit2' }, answer4Ctx)).toEqual({
      type: 'rate',
      rating: 'hard',
    });
    expect(resolveStudyKeyAction('2', { code: 'Digit2' }, answer2Ctx)).toEqual({
      type: 'rate',
      rating: 'good',
    });
    expect(resolveStudyKeyAction('3', { code: 'Digit3' }, answer2Ctx)).toBeNull();
    expect(resolveStudyKeyAction('4', { code: 'Digit4' }, answer2Ctx)).toBeNull();
    expect(
      resolveStudyKeyAction('!', { code: 'Digit1', shift: true }, answer4Ctx)
    ).toEqual({ type: 'suspendNote' });
    expect(
      resolveStudyKeyAction('@', { code: 'Digit2', shift: true }, answer4Ctx)
    ).toEqual({ type: 'suspendCard' });
  });
});
