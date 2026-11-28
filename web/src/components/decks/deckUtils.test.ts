import { describe, expect, it } from 'vitest';
import {
  buildDeckSearchQuery,
  getLeafNameSelectionRange,
  isImeComposing,
  parseClampedInt,
  sanitizeDeckHtml,
} from './deckUtils';

describe('deckUtils', () => {
  describe('buildDeckSearchQuery', () => {
    it('wraps simple and hierarchical deck names', () => {
      expect(buildDeckSearchQuery('일본어')).toBe('deck:"일본어"');
      expect(buildDeckSearchQuery('일본어::한자')).toBe('deck:"일본어::한자"');
    });

    it('escapes quotes, backslashes, and Anki wildcards (* and _)', () => {
      expect(buildDeckSearchQuery('My "Special" Deck')).toBe('deck:"My \\"Special\\" Deck"');
      expect(buildDeckSearchQuery('A\\B*C_D')).toBe('deck:"A\\\\B\\*C\\_D"');
    });
  });

  describe('getLeafNameSelectionRange', () => {
    it('selects the full name for root decks', () => {
      expect(getLeafNameSelectionRange('일본어')).toEqual([0, 3]);
    });

    it('selects only the leaf segment after the last ::', () => {
      const full = '일본어::JLPT::N2';
      const [start, end] = getLeafNameSelectionRange(full);
      expect(full.slice(start, end)).toBe('N2');
    });

    it('handles empty leaf cleanly', () => {
      expect(getLeafNameSelectionRange('A::')).toEqual([3, 3]);
    });
  });

  describe('parseClampedInt', () => {
    it('parses valid integers and clamps to bounds', () => {
      expect(parseClampedInt('25', 1, 100, 10)).toBe(25);
      expect(parseClampedInt('0', 1, 100, 10)).toBe(1);
      expect(parseClampedInt('-5', 1, 100, 10)).toBe(1);
      expect(parseClampedInt('99999', 1, 9999, 100)).toBe(9999);
    });

    it('returns fallback on empty or non-numeric draft', () => {
      expect(parseClampedInt('', 1, 100, 10)).toBe(10);
      expect(parseClampedInt('   ', 1, 100, 10)).toBe(10);
      expect(parseClampedInt('abc', 1, 100, 10)).toBe(10);
    });
  });

  describe('isImeComposing', () => {
    it('detects nativeEvent.isComposing and keyCode 229', () => {
      expect(isImeComposing({ nativeEvent: { isComposing: true }, keyCode: 13 })).toBe(true);
      expect(isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 229 })).toBe(true);
      expect(isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 13 })).toBe(false);
    });
  });

  describe('sanitizeDeckHtml', () => {
    it('never leaves raw executable HTML when DOMParser is unavailable (Node fallback)', () => {
      const result = sanitizeDeckHtml('<img src=x onerror=alert(1)><a href="java&#x09;script:alert(2)">x</a>');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('<a');
      expect(result).toContain('&lt;img');
    });
  });
});
