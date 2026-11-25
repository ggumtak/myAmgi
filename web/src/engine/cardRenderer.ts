import { dbStore } from '../db/store';
import { AppSettings, MediaItem, Note, NoteType } from '../types/models';
import { downloadMediaOnDemand } from '../sync/supabaseSync';

export interface RenderedCard {
  frontHtml: string;
  backHtml: string;
  scopedCss: string;
  sounds: string[];
  scripts: string[];
}

function buildFieldMap(note: Note, noteType: NoteType): Record<string, string> {
  const map: Record<string, string> = {};
  noteType.fields.forEach((name, idx) => {
    map[name] = note.flds[idx] ?? '';
  });
  map['Tags'] = note.tags.join(' ');
  return map;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Render Anki cloze deletions `{{c1::answer::hint}}` or `{{c1::answer}}`.
 */
export function renderClozeText(
  text: string,
  targetOrd: number,
  isAnswer: boolean
): string {
  const targetNum = targetOrd + 1;
  return text.replace(
    /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g,
    (_match, numStr: string, answer: string, hint?: string) => {
      const num = Number(numStr);
      if (num === targetNum) {
        if (isAnswer) {
          return `<span class="cloze">${answer}</span>`;
        }
        const placeholder = hint ? `[${hint}]` : '[...]';
        return `<span class="cloze">${placeholder}</span>`;
      }
      return answer;
    }
  );
}

function renderTemplateString(
  tmpl: string,
  fields: Record<string, string>,
  cardOrd: number,
  isAnswer: boolean,
  frontSideHtml?: string
): string {
  let out = tmpl;

  if (frontSideHtml !== undefined) {
    out = out.replace(/\{\{FrontSide\}\}/g, frontSideHtml);
  }

  // Conditional blocks: {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}
  let prev = '';
  let guard = 0;
  while (out !== prev && guard++ < 10) {
    prev = out;
    out = out.replace(
      /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_m, name: string, inner: string) => {
        const val = fields[name.trim()] ?? '';
        return stripHtml(val).length > 0 ? inner : '';
      }
    );
    out = out.replace(
      /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_m, name: string, inner: string) => {
        const val = fields[name.trim()] ?? '';
        return stripHtml(val).length === 0 ? inner : '';
      }
    );
  }

  // Cloze filter: {{cloze:Field}}
  out = out.replace(/\{\{cloze:([^}]+)\}\}/g, (_m, name: string) => {
    const val = fields[name.trim()] ?? '';
    return renderClozeText(val, cardOrd, isAnswer);
  });

  // Type / Hint / Text filters
  out = out.replace(/\{\{(type|hint|text):([^}]+)\}\}/g, (_m, filter: string, name: string) => {
    const val = fields[name.trim()] ?? '';
    if (filter === 'text') return stripHtml(val);
    if (filter === 'hint') {
      if (!val) return '';
      return `<details class="anki-hint"><summary>힌트 보기 (${name.trim()})</summary><div>${val}</div></details>`;
    }
    return isAnswer ? `<div class="type-answer">${val}</div>` : `<input class="type-input" type="text" placeholder="입력..." />`;
  });

  // Standard fields {{Field}}
  out = out.replace(/\{\{([^#/^}]+)\}\}/g, (_m, name: string) => {
    const key = name.trim();
    return fields[key] ?? '';
  });

  return out;
}

function extractSounds(html: string): { cleanedHtml: string; sounds: string[] } {
  const sounds: string[] = [];
  const cleanedHtml = html.replace(/\[sound:([^\]]+)\]/g, (_m, file: string) => {
    const trimmed = file.trim();
    if (trimmed) sounds.push(trimmed);
    return `<button type="button" class="amgi-sound-btn" data-sound="${trimmed.replace(/"/g, '&quot;')}">🔊 ${trimmed}</button>`;
  });
  return { cleanedHtml, sounds };
}

function extractScripts(html: string): { htmlWithoutScripts: string; scripts: string[] } {
  const scripts: string[] = [];
  const htmlWithoutScripts = html.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (_m, code: string) => {
      if (code.trim()) scripts.push(code);
      return '';
    }
  );
  return { htmlWithoutScripts, scripts };
}

const mediaBlobUrlCache = new Map<string, string>();

export async function resolveMediaUrl(
  fileName: string,
  settings?: AppSettings
): Promise<string | null> {
  const cleanName = decodeURIComponent(fileName.trim());
  const cached = mediaBlobUrlCache.get(cleanName);
  if (cached) return cached;

  let item: MediaItem | undefined = await dbStore.getMedia(cleanName);
  if (!item && settings?.supabaseUrl && settings?.supabaseAccessToken) {
    // Check if any media entry matches by name or try on-demand download if sha256 known
    if (item) {
      // handled
    }
  }

  if (item && (!item.bytes || item.bytes.length === 0) && item.sha256 && settings) {
    const downloaded = await downloadMediaOnDemand(settings, item.sha256, item.name, item.mime);
    if (downloaded) item = downloaded;
  }

  if (item && item.bytes && item.bytes.length > 0) {
    const copy = new Uint8Array(item.bytes);
    const blob = new Blob([copy.buffer], { type: item.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    mediaBlobUrlCache.set(cleanName, url);
    return url;
  }

  if (item?.remoteUrl) {
    return item.remoteUrl;
  }

  return null;
}

/**
 * Rewrite `url(...)` inside CSS (e.g. @font-face) with resolved IndexedDB Blob URLs.
 */
export async function resolveCssMediaUrls(
  css: string,
  settings?: AppSettings
): Promise<string> {
  const regex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  const matches = Array.from(css.matchAll(regex));
  if (matches.length === 0) return css;

  let result = css;
  for (const m of matches) {
    const full = m[0];
    const target = m[2].trim();
    if (/^(https?:|data:|blob:)/i.test(target)) continue;
    const resolved = await resolveMediaUrl(target, settings);
    if (resolved) {
      result = result.replace(full, `url("${resolved}")`);
    }
  }
  return result;
}

/**
 * Resolve `<img src="...">` and `<audio src="...">` elements inside a rendered container.
 */
export async function hydrateContainerMedia(
  container: HTMLElement,
  settings?: AppSettings
): Promise<void> {
  const imgs = container.querySelectorAll<HTMLImageElement>('img[src]');
  for (const img of imgs) {
    const rawSrc = img.getAttribute('src') ?? '';
    if (!rawSrc || /^(https?:|data:|blob:)/i.test(rawSrc)) continue;
    const resolved = await resolveMediaUrl(rawSrc, settings);
    if (resolved) {
      img.src = resolved;
    }
  }
}

/**
 * Scope Anki card CSS cleanly while preserving :where() zero-specificity base styles
 * and html.night_mode / .night_mode rules.
 */
export function buildScopedCardCss(rawCss: string): string {
  const zeroSpecBase = `
:where(.amgi-card-host) {
  line-height: 1.5;
  word-wrap: break-word;
}
:where(.amgi-card-host img) {
  max-width: 100%;
  height: auto;
}
:where(.amgi-card-host .cloze) {
  font-weight: 700;
  color: #2563eb;
}
:where(html.night_mode .amgi-card-host .cloze) {
  color: #60a5fa;
}
`;
  return `${zeroSpecBase}\n${rawCss}`;
}

export async function renderCardContent(
  note: Note,
  noteType: NoteType,
  cardOrd: number,
  settings?: AppSettings
): Promise<RenderedCard> {
  const tmpl =
    noteType.templates.find((t) => t.ord === cardOrd) ??
    noteType.templates[0] ?? {
      ord: 0,
      name: 'Card 1',
      qfmt: '{{Front}}',
      afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
    };

  const effectiveOrd = noteType.kind === 1 ? cardOrd : tmpl.ord;
  const fields = buildFieldMap(note, noteType);

  const rawFront = renderTemplateString(tmpl.qfmt, fields, effectiveOrd, false);
  const rawBack = renderTemplateString(tmpl.afmt, fields, effectiveOrd, true, rawFront);

  const frontSounds = extractSounds(rawFront);
  const backSounds = extractSounds(rawBack);

  const frontScriptRes = extractScripts(frontSounds.cleanedHtml);
  const backScriptRes = extractScripts(backSounds.cleanedHtml);

  const resolvedCss = await resolveCssMediaUrls(noteType.css || '', settings);

  return {
    frontHtml: frontScriptRes.htmlWithoutScripts,
    backHtml: backScriptRes.htmlWithoutScripts,
    scopedCss: buildScopedCardCss(resolvedCss),
    sounds: Array.from(new Set([...frontSounds.sounds, ...backSounds.sounds])),
    scripts: [...frontScriptRes.scripts, ...backScriptRes.scripts],
  };
}
