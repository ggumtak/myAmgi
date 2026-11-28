import type React from 'react';

/**
 * Escapes a deck name for Anki's `deck:"..."` search syntax.
 * Escapes backslashes, double quotes, and Anki wildcard characters (`*`, `_`).
 */
export function buildDeckSearchQuery(deckName: string): string {
  const escaped = deckName.replace(/([\\"*_])/g, '\\$1');
  return `deck:"${escaped}"`;
}

/**
 * Returns the `[start, end]` selection range covering only the leaf deck name
 * (the segment after the last `::`, or the whole name if top-level).
 */
export function getLeafNameSelectionRange(fullName: string): [number, number] {
  const sepIdx = fullName.lastIndexOf('::');
  const start = sepIdx >= 0 ? sepIdx + 2 : 0;
  return [start, fullName.length];
}

/**
 * Parses a numeric input draft into an integer clamped to `[min, max]`.
 * Returns `fallback` when the draft is empty or not a finite number.
 */
export function parseClampedInt(
  raw: string,
  min: number,
  max: number,
  fallback: number
): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Detects whether a keyboard event occurred during IME composition (Korean/CJK).
 */
export function isImeComposing(e: {
  nativeEvent?: { isComposing?: boolean };
  keyCode?: number;
}): boolean {
  return Boolean(e.nativeEvent?.isComposing || e.keyCode === 229);
}

/**
 * Prevents the Enter key from submitting a form while IME composition is active.
 */
export function preventImeEnterSubmit(e: React.KeyboardEvent): void {
  if (e.key === 'Enter' && isImeComposing(e)) {
    e.preventDefault();
  }
}

const ALLOWED_DECK_HTML_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
]);

const DROPPED_DECK_HTML_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'svg',
  'math',
  'noscript',
  'template',
]);

function escapePlainHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeDeckHref(raw: string): boolean {
  // Strip ASCII control chars & whitespace that browsers ignore when parsing URL schemes.
  const normalized = raw.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!normalized) return false;
  if (/^(https?:|mailto:|#)/.test(normalized)) return true;
  // Allow relative paths that contain no scheme colon before the first slash/query/hash.
  const firstDelimiter = normalized.search(/[/?#]/);
  const colonIdx = normalized.indexOf(':');
  return colonIdx === -1 || (firstDelimiter !== -1 && colonIdx > firstDelimiter);
}

/**
 * Sanitizes untrusted Anki deck description HTML using a strict tag & attribute allowlist
 * so shared `.apkg` descriptions can never run scripts inside the main app origin.
 */
export function sanitizeDeckHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof DOMParser === 'undefined') {
    return escapePlainHtml(rawHtml);
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const out = doc.createElement('div');

    const cloneSafe = (node: Node, target: HTMLElement) => {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(doc.createTextNode(node.textContent ?? ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (DROPPED_DECK_HTML_TAGS.has(tag)) return;

      if (!ALLOWED_DECK_HTML_TAGS.has(tag)) {
        // Unwrap unknown/disallowed formatting elements while preserving text children.
        for (const child of Array.from(el.childNodes)) {
          cloneSafe(child, target);
        }
        return;
      }

      const clean = doc.createElement(tag);
      if (tag === 'a') {
        const href = el.getAttribute('href');
        if (href && isSafeDeckHref(href)) {
          clean.setAttribute('href', href.trim());
          clean.setAttribute('rel', 'noopener noreferrer');
          clean.setAttribute('target', '_blank');
        }
      }
      for (const child of Array.from(el.childNodes)) {
        cloneSafe(child, clean);
      }
      target.appendChild(clean);
    };

    for (const child of Array.from(doc.body.childNodes)) {
      cloneSafe(child, out);
    }
    return out.innerHTML;
  } catch {
    return escapePlainHtml(rawHtml);
  }
}

/**
 * Returns true if the touch event target is inside a modal overlay/dialog
 * or inside a nested scrollable container that is currently scrolled past its top.
 */
export function isTouchInsideScrollableOrOverlay(
  target: EventTarget | null,
  boundary: HTMLElement | null
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('.amgi-overlay, .amgi-sheet-dialog, [role="dialog"]')) {
    return true;
  }
  let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  while (el && el !== boundary) {
    if (el.scrollTop > 0) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}
