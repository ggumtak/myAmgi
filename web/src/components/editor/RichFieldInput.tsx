import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
} from 'react';
import * as anki from '../../anki';
import { IconCode, IconPin, useToast } from '../../ui';

/**
 * Hydrates bare relative media filenames inside `<img src="foo.png">` into `/media/foo.png`
 * so images render inside `/ui/`.
 */
export function hydrateMediaForDisplay(html: string): string {
  if (!html) return '';
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_m, prefix: string, quote: string, src: string) => {
      const trimmed = src.trim();
      if (
        !trimmed ||
        trimmed.startsWith('/media/') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:')
      ) {
        return `${prefix}${quote}${src}${quote}`;
      }
      const clean = trimmed.replace(/^\.?\//, '');
      return `${prefix}${quote}/media/${clean}${quote}`;
    }
  );
}

/**
 * Normalizes `/media/foo.png` (including origin-qualified URLs produced by contentEditable)
 * back to bare Anki-portable filenames `foo.png` before saving `note.fields[]`.
 */
export function serializeMediaForSave(html: string): string {
  if (!html) return '';
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_m, prefix: string, quote: string, src: string) => {
      const trimmed = src.trim();
      let next = trimmed;
      try {
        if (/^https?:\/\//i.test(trimmed) && typeof window !== 'undefined') {
          const u = new URL(trimmed);
          if (u.origin === window.location.origin && u.pathname.startsWith('/media/')) {
            next = decodeURIComponent(u.pathname.slice('/media/'.length));
          }
        } else if (trimmed.startsWith('/media/')) {
          next = decodeURIComponent(trimmed.slice('/media/'.length));
        }
      } catch {
        if (trimmed.startsWith('/media/')) {
          next = trimmed.slice('/media/'.length);
        }
      }
      return `${prefix}${quote}${next}${quote}`;
    }
  );
}

export function sanitizePastedHtml(html: string, stripFormatting: boolean): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocked = doc.querySelectorAll('script, iframe, object, embed, style, link, meta');
  blocked.forEach((el) => el.remove());

  if (stripFormatting) {
    return doc.body.textContent ?? '';
  }

  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
      }
      if (name === 'href' || name === 'src') {
        const val = attr.value.trim().toLowerCase();
        if (val.startsWith('javascript:') || val.startsWith('vbscript:')) {
          el.removeAttribute(attr.name);
        }
      }
    }
  });
  return doc.body.innerHTML;
}

export interface RichFieldInputHandle {
  focus: () => void;
  execFormat: (cmd: 'bold' | 'italic' | 'underline' | 'foreColor', value?: string) => void;
  insertCloze: (clozeNumber: number) => void;
  insertMediaHtml: (portableHtml: string) => void;
}

export interface RichFieldInputProps {
  index: number;
  label: string;
  value: string;
  htmlMode: boolean;
  onToggleHtmlMode: () => void;
  showPin?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  focused: boolean;
  rtl?: boolean;
  plainText?: boolean;
  fontSize?: number;
  pasteStripsFormatting?: boolean;
  onFocus: () => void;
  onChange: (nextSerializedValue: string) => void;
}

export const RichFieldInput = forwardRef<RichFieldInputHandle, RichFieldInputProps>(
  function RichFieldInput(
    {
      index,
      label,
      value,
      htmlMode,
      onToggleHtmlMode,
      showPin = false,
      pinned = false,
      onTogglePin,
      focused,
      rtl = false,
      plainText = false,
      fontSize,
      pasteStripsFormatting = false,
      onFocus,
      onChange,
    },
    ref
  ) {
    const { showToast } = useToast();
    const editableRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const lastSerializedRef = useRef<string>(value);
    const savedRangeRef = useRef<Range | null>(null);

    // Sync external value updates (e.g. clearing non-sticky fields or loading a note)
    useEffect(() => {
      if (htmlMode) {
        lastSerializedRef.current = value;
        return;
      }
      const el = editableRef.current;
      if (!el) return;
      if (value !== lastSerializedRef.current) {
        el.innerHTML = hydrateMediaForDisplay(value);
        lastSerializedRef.current = value;
      }
    }, [value, htmlMode]);

    // Initialize innerHTML when switching back from HTML source mode
    useEffect(() => {
      if (!htmlMode && editableRef.current) {
        editableRef.current.innerHTML = hydrateMediaForDisplay(value);
        lastSerializedRef.current = value;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [htmlMode]);

    const saveSelection = () => {
      const el = editableRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };

    const restoreSelection = () => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    };

    const emitEditableChange = useCallback(() => {
      const el = editableRef.current;
      if (!el) return;
      const serialized = serializeMediaForSave(el.innerHTML);
      lastSerializedRef.current = serialized;
      onChange(serialized);
    }, [onChange]);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          if (htmlMode) {
            textareaRef.current?.focus();
          } else {
            editableRef.current?.focus();
          }
        },
        execFormat(cmd, arg) {
          if (htmlMode && textareaRef.current) {
            const ta = textareaRef.current;
            const start = ta.selectionStart ?? ta.value.length;
            const end = ta.selectionEnd ?? ta.value.length;
            const sel = ta.value.slice(start, end);
            let wrapped = sel;
            if (cmd === 'bold') wrapped = `<b>${sel}</b>`;
            else if (cmd === 'italic') wrapped = `<i>${sel}</i>`;
            else if (cmd === 'underline') wrapped = `<u>${sel}</u>`;
            else if (cmd === 'foreColor') {
              wrapped = arg ? `<span style="color:${arg}">${sel}</span>` : sel;
            }
            const next = ta.value.slice(0, start) + wrapped + ta.value.slice(end);
            lastSerializedRef.current = next;
            onChange(next);
            return;
          }

          restoreSelection();
          if (cmd === 'foreColor' && !arg) {
            document.execCommand('removeFormat', false);
          } else {
            document.execCommand(cmd, false, arg);
          }
          saveSelection();
          emitEditableChange();
        },
        insertCloze(clozeNumber: number) {
          const prefix = `{{c${clozeNumber}::`;
          const suffix = `}}`;

          if (htmlMode && textareaRef.current) {
            const ta = textareaRef.current;
            const start = ta.selectionStart ?? ta.value.length;
            const end = ta.selectionEnd ?? ta.value.length;
            const selected = ta.value.slice(start, end);
            const snippet = `${prefix}${selected}${suffix}`;
            const next = ta.value.slice(0, start) + snippet + ta.value.slice(end);
            lastSerializedRef.current = next;
            onChange(next);
            requestAnimationFrame(() => {
              ta.focus();
              const caret = selected ? start + snippet.length : start + prefix.length;
              ta.setSelectionRange(caret, caret);
            });
            return;
          }

          restoreSelection();
          const sel = window.getSelection();
          const el = editableRef.current;
          if (!el || !sel) return;

          if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            const range = sel.getRangeAt(0);
            const selectedText = range.toString();
            const snippet = `${prefix}${selectedText}${suffix}`;
            range.deleteContents();
            const textNode = document.createTextNode(snippet);
            range.insertNode(textNode);

            const nextRange = document.createRange();
            if (selectedText.length === 0) {
              nextRange.setStart(textNode, prefix.length);
              nextRange.setEnd(textNode, prefix.length);
            } else {
              nextRange.setStartAfter(textNode);
              nextRange.setEndAfter(textNode);
            }
            sel.removeAllRanges();
            sel.addRange(nextRange);
            savedRangeRef.current = nextRange.cloneRange();
          } else {
            const textNode = document.createTextNode(`${prefix}${suffix}`);
            el.appendChild(textNode);
            const nextRange = document.createRange();
            nextRange.setStart(textNode, prefix.length);
            nextRange.setEnd(textNode, prefix.length);
            sel.removeAllRanges();
            sel.addRange(nextRange);
            savedRangeRef.current = nextRange.cloneRange();
          }
          emitEditableChange();
        },
        insertMediaHtml(portableHtml: string) {
          if (htmlMode && textareaRef.current) {
            const ta = textareaRef.current;
            const start = ta.selectionStart ?? ta.value.length;
            const end = ta.selectionEnd ?? ta.value.length;
            const next = ta.value.slice(0, start) + portableHtml + ta.value.slice(end);
            lastSerializedRef.current = next;
            onChange(next);
            return;
          }
          restoreSelection();
          const hydrated = hydrateMediaForDisplay(portableHtml);
          document.execCommand('insertHTML', false, hydrated);
          saveSelection();
          emitEditableChange();
        },
      }),
      [htmlMode, onChange, emitEditableChange]
    );

    const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
      // Intercept pasted image files -> upload via addMediaFile
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              try {
                const buf = new Uint8Array(await file.arrayBuffer());
                const ext = file.type.split('/')[1] || 'png';
                const desiredName = file.name || `paste_${Date.now()}.${ext}`;
                const savedName = await anki.addMediaFile(desiredName, buf);
                const hydrated = hydrateMediaForDisplay(`<img src="${savedName}">`);
                document.execCommand('insertHTML', false, hydrated);
                emitEditableChange();
              } catch (err) {
                showToast(
                  err instanceof Error ? err.message : '이미지 첨부에 실패했습니다.',
                  'error'
                );
              }
              return;
            }
          }
        }
      }

      const html = e.clipboardData?.getData('text/html');
      const plain = e.clipboardData?.getData('text/plain') ?? '';

      if (plainText || pasteStripsFormatting) {
        e.preventDefault();
        document.execCommand('insertText', false, plain);
        emitEditableChange();
        return;
      }

      if (html) {
        e.preventDefault();
        const clean = sanitizePastedHtml(html, false);
        document.execCommand('insertHTML', false, clean);
        emitEditableChange();
      }
    };

    return (
      <div className={`amgi-field-card ${focused ? 'is-focused' : ''}`}>
        <div className="amgi-field-header">
          <span className="amgi-field-name">
            {index + 1}. {label}
          </span>
          <div className="amgi-field-actions">
            {showPin && onTogglePin && (
              <button
                type="button"
                className={`amgi-field-icon-btn ${pinned ? 'active' : ''}`}
                aria-pressed={pinned}
                aria-label={`${label} 값 고정`}
                title="추가 후에도 입력값 유지"
                onClick={onTogglePin}
              >
                <IconPin size={15} />
                <span>고정</span>
              </button>
            )}
            <button
              type="button"
              className={`amgi-field-icon-btn ${htmlMode ? 'active' : ''}`}
              aria-pressed={htmlMode}
              aria-label={`${label} HTML 소스 보기`}
              onClick={onToggleHtmlMode}
            >
              <IconCode size={15} />
              <span>HTML</span>
            </button>
          </div>
        </div>

        {htmlMode ? (
          <textarea
            ref={textareaRef}
            className="amgi-rich-html-source"
            dir={rtl ? 'rtl' : 'ltr'}
            spellCheck={false}
            value={value}
            onFocus={onFocus}
            onChange={(e) => {
              const next = e.target.value;
              lastSerializedRef.current = next;
              onChange(next);
            }}
            placeholder={`${label} HTML 소스 입력...`}
          />
        ) : (
          <div
            ref={editableRef}
            className="amgi-rich-editable"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            dir={rtl ? 'rtl' : 'ltr'}
            data-placeholder={`${label} 내용을 입력하세요...`}
            style={
              fontSize && fontSize > 0
                ? { fontSize: Math.max(14, Math.min(28, fontSize)) }
                : undefined
            }
            onFocus={() => {
              onFocus();
              saveSelection();
            }}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onInput={emitEditableChange}
            onBlur={() => {
              saveSelection();
              emitEditableChange();
            }}
            onPaste={(e) => void handlePaste(e)}
          />
        )}
      </div>
    );
  }
);
