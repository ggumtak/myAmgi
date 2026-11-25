// Pure card-text transforms used by the reviewer, mirroring aqt:
// - av refs `[anki:play:q:0]` -> Anki's replay buttons (aqt/sound.py av_refs_to_play_icons)
// - type-in-the-answer `[[type:Field]]` (aqt/reviewer.py typeAnsQuestionFilter / typeAnsAnswerFilter)
// - body classes for the card (aqt/theme.py body_classes_for_card_ord + AnkiDroid's platform classes)

import type { Theme } from '../../lib/theme';

export const AV_REF_RE = /\[anki:(play:(.):(\d+))\]/g;

/** Anki's replay button markup; clicking calls `pycmd('play:q:0')`. */
export function avRefsToPlayIcons(text: string): string {
  return text.replace(
    AV_REF_RE,
    (_m, cmd: string) => `
<a class="replay-button soundLink" href=# onclick="pycmd('${cmd}'); return false;" draggable="false">
    <svg class="playImage" viewBox="0 0 64 64" version="1.1">
        <circle cx="32" cy="32" r="29" />
        <path d="M56.502,32.301l-37.502,20.101l0.329,-40.804l37.173,20.703Z" />
    </svg>
</a>`,
  );
}

export function stripAvRefs(text: string): string {
  return text.replace(AV_REF_RE, '');
}

/** `play:q:1` -> {side: 'q', index: 1}; null for anything else. */
export function parsePlayCommand(cmd: string): { side: 'q' | 'a'; index: number } | null {
  const m = /^play:([qa]):(\d+)$/.exec(cmd);
  return m ? { side: m[1] as 'q' | 'a', index: Number(m[2]) } : null;
}

// ---------------------------------------------------------------------------
// Type in the answer
// ---------------------------------------------------------------------------

export const TYPE_ANS_RE = /\[\[type:(.+?)\]\]/;
const TYPE_ANS_RE_G = /\[\[type:(.+?)\]\]/g;

export interface TypeAnswerSpec {
  /** Field name with the `cloze:` / `nc:` prefixes removed. */
  field: string;
  cloze: boolean;
  /** false for `nc:` (ignore combining characters when comparing). */
  combining: boolean;
}

export function parseTypeAnswer(html: string): TypeAnswerSpec | null {
  const m = TYPE_ANS_RE.exec(html);
  if (!m) return null;
  let fld = m[1];
  let cloze = false;
  let combining = true;
  if (fld.startsWith('cloze:')) {
    cloze = true;
    fld = fld.split(':')[1];
  }
  if (fld.startsWith('nc:')) {
    combining = false;
    fld = fld.split(':')[1];
  }
  return { field: fld, cloze, combining };
}

export interface TypeAnswerTarget {
  /** Expected text; null = field not found (or cloze without content), '' = empty field. */
  expected: string | null;
  font: string;
  size: number;
}

const escapeAttr = (s: string) => s.replace(/[&'"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Question side: replace the tag with the input box (or a warning / nothing). */
export function typeAnsQuestionFilter(html: string, spec: TypeAnswerSpec | null, target: TypeAnswerTarget | null): string {
  if (!spec) return html;
  if (!target || target.expected === null) {
    const warn = spec.cloze
      ? '빈 카드가 있습니다. 도구 › 빈 카드 정리를 실행하세요.'
      : `입력할 필드를 찾을 수 없습니다: ${spec.field}`;
    return html.replace(TYPE_ANS_RE_G, warn);
  }
  if (!target.expected) return html.replace(TYPE_ANS_RE_G, '');
  return html.replace(
    TYPE_ANS_RE_G,
    `
<center>
<input type=text id=typeans onkeypress="_typeAnsPress();" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
   style="font-family: '${escapeAttr(target.font)}'; font-size: ${target.size}px;">
</center>
`,
  );
}

/** Answer side: replace the tag with the backend's comparison markup. */
export function typeAnsAnswerFilter(html: string, target: TypeAnswerTarget | null, compared: string): string {
  if (!target || !target.expected) return html.replace(TYPE_ANS_RE_G, '');
  const orig = html;
  const withoutHr = html.replace('<hr id=answer>', '');
  const hadHR = withoutHr.length !== html.length;
  if (hadHR && !TYPE_ANS_RE.test(withoutHr)) return orig;
  return withoutHr.replace(TYPE_ANS_RE_G, () => {
    const s = `
<div style="font-family: '${escapeAttr(target.font)}'; font-size: ${target.size}px">${compared}</div>`;
    return hadHR ? `<hr id=answer>${s}` : s;
  });
}

// ---------------------------------------------------------------------------
// Body classes
// ---------------------------------------------------------------------------

/**
 * `card card<ord+1>` like Anki, plus `nightMode night_mode` in dark, `eink` on
 * e-ink, `mobile android` on Android (what AnkiDroid templates test for), and
 * Anki desktop's `isWin` / `isMac` / `isLin` elsewhere.
 */
export function cardBodyClass(ord: number, theme: Theme, platform: string, userAgent = ''): string {
  const classes = ['card', `card${ord + 1}`];
  if (platform === 'android') classes.push('mobile', 'android');
  else if (/windows/i.test(userAgent)) classes.push('isWin');
  else if (/mac os|macintosh/i.test(userAgent)) classes.push('isMac');
  else classes.push('isLin');
  if (theme === 'dark') classes.push('nightMode', 'night_mode');
  if (theme === 'eink') classes.push('eink');
  return classes.join(' ');
}
