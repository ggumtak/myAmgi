import { describe, expect, it } from 'vitest';
import { extractClozeNumsFallback } from './NoteEditorView';
import {
  hydrateMediaForDisplay,
  normalizeEmptyFieldHtml,
  serializeMediaForSave,
} from './RichFieldInput';

describe('normalizeEmptyFieldHtml', () => {
  it('treats <br>-only and empty wrapper markup as empty string', () => {
    expect(normalizeEmptyFieldHtml('')).toBe('');
    expect(normalizeEmptyFieldHtml('<br>')).toBe('');
    expect(normalizeEmptyFieldHtml('<br/>')).toBe('');
    expect(normalizeEmptyFieldHtml('<div><br></div>')).toBe('');
    expect(normalizeEmptyFieldHtml('<p>&nbsp;</p>')).toBe('');
    expect(normalizeEmptyFieldHtml('  <br> \u200B ')).toBe('');
  });

  it('preserves text and media/sound fields', () => {
    expect(normalizeEmptyFieldHtml('안녕')).toBe('안녕');
    expect(normalizeEmptyFieldHtml('<img src="cat.png">')).toBe('<img src="cat.png">');
    expect(normalizeEmptyFieldHtml('[sound:voice.mp3]')).toBe('[sound:voice.mp3]');
  });
});

describe('extractClozeNumsFallback', () => {
  it('extracts sorted unique cloze numbers across all fields', () => {
    expect(
      extractClozeNumsFallback([
        '{{c1::사과}}와 {{c3::포도}}',
        '추가 {{c1::과일}} 및 {{c2::바나나}}',
      ])
    ).toEqual([1, 2, 3]);
    expect(extractClozeNumsFallback(['일반 텍스트'])).toEqual([]);
  });
});

describe('media hydration and serialization', () => {
  it('round-trips bare media filenames cleanly', () => {
    const hydrated = hydrateMediaForDisplay('<img src="foo.png">');
    expect(hydrated).toBe('<img src="/media/foo.png">');
    expect(serializeMediaForSave(hydrated)).toBe('<img src="foo.png">');
  });
});
