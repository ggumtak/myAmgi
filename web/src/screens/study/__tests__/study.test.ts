import { describe, expect, it } from 'vitest';
import { actionForKey, type KeyContext } from '../keymap';
import { avRefsToPlayIcons, cardBodyClass, parsePlayCommand, parseTypeAnswer, stripAvRefs, typeAnsAnswerFilter, typeAnsQuestionFilter } from '../cardText';
import { answerButtons, formatTimer, parseDueDate, readStudyPrefs, stateForRating, timeTakenMs } from '../studyLogic';
import { toAvTags } from '../avPlayer';

const q: KeyContext = { side: 'question', twoButton: false, volumeKeys: true };
const a: KeyContext = { side: 'answer', twoButton: false, volumeKeys: true };

describe('key mapping', () => {
  it('space/enter flip on the question and rate Good on the answer', () => {
    expect(actionForKey({ key: ' ' }, q)).toBe('flip');
    expect(actionForKey({ key: 'Enter' }, q)).toBe('flip');
    expect(actionForKey({ key: ' ' }, a)).toBe('good');
  });
  it('digits answer only on the answer side; two-button mode maps 1/2', () => {
    expect(actionForKey({ key: '1' }, q)).toBeNull();
    expect(['1', '2', '3', '4'].map((k) => actionForKey({ key: k }, a))).toEqual(['again', 'hard', 'good', 'easy']);
    const two = { ...a, twoButton: true };
    expect(['1', '2', '3', '4'].map((k) => actionForKey({ key: k }, two))).toEqual(['again', 'good', 'good', null]);
  });
  it('Anki desktop shortcuts incl. Korean layout and modifiers', () => {
    expect(actionForKey({ key: 'u' }, a)).toBe('undo');
    expect(actionForKey({ key: 'ㅕ' }, a)).toBe('undo');
    expect(actionForKey({ key: 'z', ctrlKey: true }, a)).toBe('undo');
    expect(actionForKey({ key: 'Z', ctrlKey: true, shiftKey: true }, a)).toBe('redo');
    expect(actionForKey({ key: 'e' }, q)).toBe('edit');
    expect(actionForKey({ key: 'E', shiftKey: true }, q)).toBeNull();
    expect(actionForKey({ key: 'r' }, q)).toBe('replay');
    expect(actionForKey({ key: '*', shiftKey: true }, q)).toBe('mark');
    expect(actionForKey({ key: '-' }, q)).toBe('buryCard');
    expect(actionForKey({ key: '=' }, q)).toBe('buryNote');
    expect(actionForKey({ key: '@', shiftKey: true }, q)).toBe('suspendCard');
    expect(actionForKey({ key: '!', shiftKey: true }, q)).toBe('suspendNote');
    expect(actionForKey({ key: '3', ctrlKey: true }, q)).toBe('flag3');
    expect(actionForKey({ key: 'n', ctrlKey: true, altKey: true }, q)).toBe('forget');
    expect(actionForKey({ key: 'D', ctrlKey: true, shiftKey: true }, q)).toBe('setDue');
    expect(actionForKey({ key: 'Delete', ctrlKey: true }, q)).toBe('deleteNote');
    expect(actionForKey({ key: 'A', shiftKey: true }, q)).toBe('toggleAutoAdvance');
    expect(actionForKey({ key: 'x' }, q)).toBeNull();
  });
  it('remote keys: positive = show answer then Good, negative = show answer then Again', () => {
    for (const k of ['AudioVolumeDown', 'PageDown', 'ArrowRight', 'MediaPlayPause']) {
      expect(actionForKey({ key: k }, q)).toBe('flip');
      expect(actionForKey({ key: k }, a)).toBe('good');
    }
    for (const k of ['AudioVolumeUp', 'PageUp', 'ArrowLeft']) {
      expect(actionForKey({ key: k }, q)).toBe('flip');
      expect(actionForKey({ key: k }, a)).toBe('again');
    }
    expect(actionForKey({ key: 'ArrowDown' }, a)).toBe('scrollDown');
  });
  it('volume keys are ignored when the pref is off; the table can be overridden', () => {
    expect(actionForKey({ key: 'AudioVolumeDown' }, { ...a, volumeKeys: false })).toBeNull();
    expect(actionForKey({ key: 'PageDown' }, { ...a, volumeKeys: false })).toBe('good');
    expect(actionForKey({ key: 'AudioVolumeDown' }, { ...a, remoteMap: { AudioVolumeDown: 'negative' } })).toBe('again');
    expect(actionForKey({ key: 'MediaPlayPause' }, { ...a, remoteMap: { MediaPlayPause: 'replay' } })).toBe('replay');
    expect(actionForKey({ key: 'MediaTrackPrevious' }, a)).toBe('again');
    expect(actionForKey({ key: 'MediaFastForward' }, a)).toBe('good');
    expect(actionForKey({ key: 'MediaStop' }, a)).toBe('replay');
  });
});

describe('av tags', () => {
  it('rewrites [anki:play:q:0] refs to Anki play buttons calling pycmd', () => {
    const out = avRefsToPlayIcons('앞 [anki:play:q:0] 뒤 [anki:play:a:12]');
    expect(out).toContain(`onclick="pycmd('play:q:0'); return false;"`);
    expect(out).toContain(`pycmd('play:a:12')`);
    expect(out.match(/class="replay-button soundLink"/g)).toHaveLength(2);
    expect(out).not.toContain('[anki:');
    expect(stripAvRefs('a[anki:play:q:3]b')).toBe('ab');
  });
  it('parses play commands', () => {
    expect(parsePlayCommand('play:q:2')).toEqual({ side: 'q', index: 2 });
    expect(parsePlayCommand('play:a:0')).toEqual({ side: 'a', index: 0 });
    expect(parsePlayCommand('ease1')).toBeNull();
  });
  it('converts engine av tags', () => {
    expect(toAvTags([{ soundOrVideo: 'a.mp3' }, { tts: { fieldText: '<b>日本</b>', lang: 'ja_JP', speed: 1.2, voices: [] } }])).toEqual([
      { kind: 'sound', filename: 'a.mp3' },
      { kind: 'tts', text: '日本', lang: 'ja_JP', speed: 1.2, voices: [] },
    ]);
  });
});

describe('type in the answer', () => {
  it('parses prefixes', () => {
    expect(parseTypeAnswer('x [[type:Back]] y')).toEqual({ field: 'Back', cloze: false, combining: true });
    expect(parseTypeAnswer('[[type:cloze:Text]]')).toEqual({ field: 'Text', cloze: true, combining: true });
    expect(parseTypeAnswer('[[type:nc:Back]]')).toEqual({ field: 'Back', cloze: false, combining: false });
    expect(parseTypeAnswer('none')).toBeNull();
  });
  it('question filter: input, warning for unknown field, nothing for an empty field', () => {
    const spec = parseTypeAnswer('[[type:Back]]');
    expect(typeAnsQuestionFilter('A [[type:Back]]', spec, { expected: 'x', font: 'Arial', size: 20 })).toMatch(/<input type=text id=typeans onkeypress="_typeAnsPress\(\);"/);
    expect(typeAnsQuestionFilter('A [[type:Back]]', spec, null)).toContain('찾을 수 없습니다: Back');
    expect(typeAnsQuestionFilter('A [[type:Back]]', spec, { expected: '', font: 'Arial', size: 20 })).toBe('A ');
  });
  it('answer filter places the comparison after <hr id=answer> like Anki', () => {
    const t = { expected: 'x', font: 'Arial', size: 20 };
    const out = typeAnsAnswerFilter('Q<hr id=answer>[[type:Back]] A', t, '<code id=typeans>cmp</code>');
    expect(out.startsWith('Q<hr id=answer>\n<div')).toBe(true);
    expect(out).toContain('cmp');
    expect(typeAnsAnswerFilter('Q [[type:Back]]', null, '')).toBe('Q ');
  });
});

describe('body class', () => {
  it('matches Anki/AnkiDroid conventions', () => {
    expect(cardBodyClass(0, 'light', 'desktop', 'X11; Linux')).toBe('card card1 isLin');
    expect(cardBodyClass(2, 'dark', 'android')).toBe('card card3 mobile android nightMode night_mode');
    expect(cardBodyClass(0, 'eink', 'android')).toBe('card card1 mobile android eink');
  });
});

describe('scheduling helpers', () => {
  it('caps time taken at the deck maximum', () => {
    expect(timeTakenMs(1000, 5000, 60)).toBe(4000);
    expect(timeTakenMs(0, 120_000, 60)).toBe(60_000);
    expect(timeTakenMs(5000, 1000, 60)).toBe(0);
    expect(formatTimer(65_000)).toBe('1:05');
  });
  it('parses set-due-date input like Anki', () => {
    expect(parseDueDate('3')).toMatchObject({ min: 3, max: 3, changeInterval: false, text: '3' });
    expect(parseDueDate(' 3-7 ')).toMatchObject({ min: 3, max: 7, text: '3-7' });
    expect(parseDueDate('7-3!')).toMatchObject({ min: 3, max: 7, changeInterval: true, text: '3-7!' });
    expect(parseDueDate('0')).toMatchObject({ text: '0' });
    for (const bad of ['', 'a', '-3', '3-', '3!!', '1.5']) expect(parseDueDate(bad)).toBeNull();
  });
  it('selects states and builds buttons for 4- and 2-button modes', () => {
    const s = { current: {}, again: { normal: {} }, hard: { normal: {} }, good: { normal: {} }, easy: { normal: {} } };
    expect(stateForRating(s, 'good')).toBe(s.good);
    const labels = ['<1분', '<6분', '<10분', '4일'];
    expect(answerButtons(s, labels, false).map((b) => [b.rating, b.label, b.interval, b.key])).toEqual([
      ['again', '다시', '<1분', '1'],
      ['hard', '어려움', '<6분', '2'],
      ['good', '알맞음', '<10분', '3'],
      ['easy', '쉬움', '4일', '4'],
    ]);
    expect(answerButtons(s, labels, true).map((b) => [b.label, b.interval])).toEqual([
      ['모름', '<1분'],
      ['암기 완료', '<10분'],
    ]);
    expect(answerButtons({ ...s, hard: null }, labels, false).map((b) => b.rating)).toEqual(['again', 'good', 'easy']);
    expect(answerButtons(s, labels, false, false)[0].interval).toBe('');
  });
  it('reads study prefs with defaults and legacy keys', () => {
    expect(readStudyPrefs({}, true).twoButton).toBe(true);
    expect(readStudyPrefs({}, false)).toMatchObject({ twoButton: false, tapToFlip: true, volumeKeys: true, fontScale: 100, hanja: true });
    expect(readStudyPrefs({ twoButtons: false }, true).twoButton).toBe(false);
    expect(readStudyPrefs({ twoButtons: true }, false).twoButton).toBe(true);
    expect(readStudyPrefs({ tapToShowAnswer: false, volumeKeys: false }, false)).toMatchObject({ tapToFlip: false, volumeKeys: false });
    expect(readStudyPrefs({ 'study.fontScale': 1.25 }, false).fontScale).toBe(125);
    expect(readStudyPrefs({ 'study.fontScale': 130 }, false).fontScale).toBe(130);
  });
});
