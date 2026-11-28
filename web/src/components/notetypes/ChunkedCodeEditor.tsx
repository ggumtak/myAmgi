import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

const CHUNK_TARGET_BYTES = 8192;
const LARGE_THRESHOLD = 50_000;
const FULL_VIEW_LIMIT = 120_000;
const MAX_SEARCH_MATCHES = 10_000;

function countNewlines(str: string): number {
  let count = 0;
  let idx = -1;
  while ((idx = str.indexOf('\n', idx + 1)) !== -1) {
    count++;
  }
  return count;
}

/**
 * Splits a large string into ~8KB line-aligned chunks so lines rarely get cut mid-token.
 */
function splitLineAlignedChunks(text: string): string[] {
  if (!text) return [''];
  const out: string[] = [];
  let pos = 0;
  const len = text.length;
  while (pos < len) {
    const targetEnd = pos + CHUNK_TARGET_BYTES;
    if (targetEnd >= len) {
      out.push(text.slice(pos));
      break;
    }
    // Look for a newline near targetEnd to keep lines aligned
    let nl = text.indexOf('\n', targetEnd);
    if (nl === -1 || nl - targetEnd > 1024) {
      nl = text.lastIndexOf('\n', targetEnd);
      if (nl <= pos) {
        nl = targetEnd - 1;
      }
    }
    const end = nl + 1;
    out.push(text.slice(pos, end));
    pos = end;
  }
  return out.length > 0 ? out : [''];
}

function scrollTextareaToLocalOffset(
  textarea: HTMLTextAreaElement,
  text: string,
  localOffset: number
): void {
  const before = text.slice(0, localOffset);
  const lineIdx = countNewlines(before);
  const computed =
    typeof window !== 'undefined' ? window.getComputedStyle(textarea) : null;
  const parsed = computed ? parseFloat(computed.lineHeight) : 20;
  const lineHeight = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  const targetTop = Math.max(0, lineIdx * lineHeight - textarea.clientHeight * 0.3);
  textarea.scrollTop = targetTop;
}

interface SearchMatch {
  chunkIndex: number;
  localOffset: number;
  length: number;
}

export interface ChunkedCodeEditorHandle {
  getFullText: () => string;
  insertAtCaret: (snippet: string) => void;
}

export interface ChunkedCodeEditorProps {
  docKey: string;
  initialValue: string;
  placeholder?: string;
  onUserEdit?: () => void;
  onPreviewText?: (text: string) => void;
}

export const ChunkedCodeEditor = forwardRef<
  ChunkedCodeEditorHandle,
  ChunkedCodeEditorProps
>(function ChunkedCodeEditor(
  { docKey, initialValue, placeholder, onUserEdit, onPreviewText },
  ref
) {
  // Mutable chunk storage for O(1) edits without 1MB string concatenation per keystroke
  const chunksRef = useRef<string[]>(['']);
  const lineCountsRef = useRef<number[]>([0]);
  const totalCharsRef = useRef<number>(0);
  const totalLinesRef = useRef<number>(1);
  const activeChunkRef = useRef<number>(0);
  const directModeRef = useRef<boolean>(true);
  const forceFullViewRef = useRef<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Latest callbacks, so the imperative handle (insertAtCaret) never runs first-render closures.
  const onUserEditRef = useRef(onUserEdit);
  onUserEditRef.current = onUserEdit;
  const onPreviewTextRef = useRef(onPreviewText);
  onPreviewTextRef.current = onPreviewText;
  const previewTimerRef = useRef<number | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const lastDocKeyRef = useRef<string>('');

  const [activeChunk, setActiveChunk] = useState(0);
  const [chunkCount, setChunkCount] = useState(1);
  const [isLargeDoc, setIsLargeDoc] = useState(false);
  const [isFullView, setIsFullView] = useState(true);
  const [textareaValue, setTextareaValue] = useState('');
  const [totalChars, setTotalChars] = useState(0);
  const [totalLines, setTotalLines] = useState(1);
  const [chunkMeta, setChunkMeta] = useState({ startChar: 0, endChar: 0, startLine: 1, endLine: 1 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(-1);
  const [lineJumpInput, setLineJumpInput] = useState('');

  const recomputeTotals = useCallback((chunkIdx: number, fullView: boolean) => {
    const chunks = chunksRef.current;
    const lineCounts = lineCountsRef.current;
    let chars = 0;
    let lines = 1;
    let startChar = 0;
    let startLine = 1;
    for (let i = 0; i < chunks.length; i++) {
      if (i === chunkIdx) {
        startChar = chars;
        startLine = lines;
      }
      chars += chunks[i].length;
      lines += lineCounts[i];
    }
    totalCharsRef.current = chars;
    totalLinesRef.current = lines;
    setTotalChars(chars);
    setTotalLines(lines);
    setChunkCount(chunks.length);

    if (fullView) {
      setChunkMeta({
        startChar: 0,
        endChar: chars,
        startLine: 1,
        endLine: lines,
      });
    } else {
      const len = chunks[chunkIdx]?.length ?? 0;
      const lc = lineCounts[chunkIdx] ?? 0;
      setChunkMeta({
        startChar,
        endChar: startChar + len,
        startLine,
        endLine: startLine + lc,
      });
    }
  }, []);

  const loadDocument = useCallback(
    (text: string) => {
      const len = text.length;
      const large = len >= LARGE_THRESHOLD;
      directModeRef.current = !large;
      forceFullViewRef.current = !large;

      if (!large) {
        chunksRef.current = [text];
        lineCountsRef.current = [countNewlines(text)];
        activeChunkRef.current = 0;
        setActiveChunk(0);
        setIsLargeDoc(false);
        setIsFullView(true);
        setTextareaValue(text);
        recomputeTotals(0, true);
      } else {
        const split = splitLineAlignedChunks(text);
        chunksRef.current = split;
        lineCountsRef.current = split.map(countNewlines);
        activeChunkRef.current = 0;
        setActiveChunk(0);
        setIsLargeDoc(true);
        setIsFullView(false);
        setTextareaValue(split[0] ?? '');
        recomputeTotals(0, false);
      }
      setMatches([]);
      setMatchIndex(-1);
    },
    [recomputeTotals]
  );

  // Load when docKey changes (or initialValue changes when docKey is unchanged and untouched)
  useEffect(() => {
    if (lastDocKeyRef.current !== docKey) {
      lastDocKeyRef.current = docKey;
      loadDocument(initialValue);
    }
  }, [docKey, initialValue, loadDocument]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
      if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    };
  }, []);

  const getFullText = useCallback((): string => {
    if (forceFullViewRef.current) {
      return textareaRef.current ? textareaRef.current.value : chunksRef.current.join('');
    }
    return chunksRef.current.join('');
  }, []);

  const schedulePreview = useCallback(() => {
    if (!onPreviewTextRef.current) return;
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      onPreviewTextRef.current?.(getFullText());
    }, 350);
  }, [getFullText]);

  const handleTextareaChange = (nextVal: string) => {
    setTextareaValue(nextVal);
    onUserEditRef.current?.();

    if (forceFullViewRef.current) {
      // Direct mode (< 50k chars) or temporary full view (<= 120k chars)
      chunksRef.current = [nextVal];
      lineCountsRef.current = [countNewlines(nextVal)];
      recomputeTotals(0, true);
    } else {
      // O(1) 8KB chunk edit! Zero 1MB string concatenation!
      const idx = activeChunkRef.current;
      chunksRef.current[idx] = nextVal;
      lineCountsRef.current[idx] = countNewlines(nextVal);
      recomputeTotals(idx, false);
    }

    schedulePreview();
  };

  const goToChunk = useCallback(
    (nextIdx: number, scrollToBottom = false) => {
      if (forceFullViewRef.current) {
        if (nextIdx >= 0 && textareaRef.current && scrollToBottom) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
        return;
      }
      const clamped = Math.max(0, Math.min(chunksRef.current.length - 1, nextIdx));
      activeChunkRef.current = clamped;
      setActiveChunk(clamped);
      const val = chunksRef.current[clamped] ?? '';
      setTextareaValue(val);
      recomputeTotals(clamped, false);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.scrollTop = scrollToBottom ? ta.scrollHeight : 0;
      });
    },
    [recomputeTotals]
  );

  const toggleFullView = () => {
    const total = totalCharsRef.current;
    if (!forceFullViewRef.current && total > FULL_VIEW_LIMIT) {
      return;
    }
    if (forceFullViewRef.current) {
      // Switch from full view into chunked mode
      const full = chunksRef.current.join('');
      const split = splitLineAlignedChunks(full);
      chunksRef.current = split;
      lineCountsRef.current = split.map(countNewlines);
      forceFullViewRef.current = false;
      activeChunkRef.current = 0;
      setActiveChunk(0);
      setIsFullView(false);
      setTextareaValue(split[0] ?? '');
      recomputeTotals(0, false);
    } else {
      // Switch from chunked mode into full view (only <= 120k chars)
      const full = chunksRef.current.join('');
      chunksRef.current = [full];
      lineCountsRef.current = [countNewlines(full)];
      forceFullViewRef.current = true;
      activeChunkRef.current = 0;
      setActiveChunk(0);
      setIsFullView(true);
      setTextareaValue(full);
      recomputeTotals(0, true);
    }
  };

  const focusMatch = useCallback(
    (match: SearchMatch) => {
      if (!forceFullViewRef.current && activeChunkRef.current !== match.chunkIndex) {
        activeChunkRef.current = match.chunkIndex;
        setActiveChunk(match.chunkIndex);
        const val = chunksRef.current[match.chunkIndex] ?? '';
        setTextareaValue(val);
        recomputeTotals(match.chunkIndex, false);
      }
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const text = chunksRef.current[match.chunkIndex] ?? '';
        ta.focus();
        ta.setSelectionRange(match.localOffset, match.localOffset + match.length);
        scrollTextareaToLocalOffset(ta, text, match.localOffset);
      });
    },
    [recomputeTotals]
  );

  const runSearch = useCallback(
    (q: string, autoJump: boolean) => {
      if (!q) {
        setMatches([]);
        setMatchIndex(-1);
        return;
      }
      const needle = q.toLowerCase();
      const found: SearchMatch[] = [];
      const chunks = chunksRef.current;

      for (let c = 0; c < chunks.length; c++) {
        const hay = chunks[c].toLowerCase();
        let pos = 0;
        while (found.length < MAX_SEARCH_MATCHES) {
          const idx = hay.indexOf(needle, pos);
          if (idx === -1) break;
          found.push({ chunkIndex: c, localOffset: idx, length: q.length });
          pos = idx + Math.max(1, q.length);
        }
        if (found.length >= MAX_SEARCH_MATCHES) break;
      }

      setMatches(found);
      if (found.length > 0) {
        setMatchIndex(0);
        if (autoJump) focusMatch(found[0]);
      } else {
        setMatchIndex(-1);
      }
    },
    [focusMatch]
  );

  const stepMatch = (delta: number) => {
    if (matches.length === 0) {
      if (searchQuery) runSearch(searchQuery, true);
      return;
    }
    const nextIdx = (matchIndex + delta + matches.length) % matches.length;
    setMatchIndex(nextIdx);
    focusMatch(matches[nextIdx]);
  };

  const handleJumpToLine = () => {
    const targetLine = Number(lineJumpInput.trim());
    if (!Number.isInteger(targetLine) || targetLine < 1) return;

    if (forceFullViewRef.current) {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = ta.value.split('\n');
      const clampedLine = Math.min(lines.length, targetLine);
      let offset = 0;
      for (let i = 0; i < clampedLine - 1; i++) {
        offset += lines[i].length + 1;
      }
      ta.focus();
      ta.setSelectionRange(offset, offset);
      scrollTextareaToLocalOffset(ta, ta.value, offset);
      return;
    }

    let accLine = 1;
    let targetChunk = chunksRef.current.length - 1;
    let localLine = 0;
    for (let i = 0; i < chunksRef.current.length; i++) {
      const lc = lineCountsRef.current[i] ?? 0;
      if (targetLine <= accLine + lc || i === chunksRef.current.length - 1) {
        targetChunk = i;
        localLine = Math.max(0, targetLine - accLine);
        break;
      }
      accLine += lc;
    }

    const chunkText = chunksRef.current[targetChunk] ?? '';
    const lines = chunkText.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(localLine, lines.length - 1); i++) {
      offset += lines[i].length + 1;
    }
    activeChunkRef.current = targetChunk;
    setActiveChunk(targetChunk);
    setTextareaValue(chunkText);
    recomputeTotals(targetChunk, false);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(offset, offset);
      scrollTextareaToLocalOffset(ta, chunkText, offset);
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      getFullText,
      insertAtCaret(snippet: string) {
        const ta = textareaRef.current;
        if (!ta) {
          const idx = activeChunkRef.current;
          const next = (chunksRef.current[idx] ?? '') + snippet;
          handleTextareaChange(next);
          return;
        }
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        const next = ta.value.slice(0, start) + snippet + ta.value.slice(end);
        handleTextareaChange(next);
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + snippet.length;
          ta.setSelectionRange(pos, pos);
        });
      },
    }),
    // handleTextareaChange only reads refs and stable callbacks, so this handle stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getFullText]
  );

  return (
    <div className="amgi-chunked-editor" data-testid="chunked-code-editor">
      <div className="amgi-chunked-toolbar">
        <div className="amgi-chunked-row">
          <div className="amgi-chunked-stats tabular">
            <span>총 {totalChars.toLocaleString()}자</span>
            <span>{totalLines.toLocaleString()}줄</span>
            {isLargeDoc && !isFullView && (
              <span>분할 {chunkCount}구간</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {totalChars <= FULL_VIEW_LIMIT && isLargeDoc && (
              <button
                type="button"
                className={`amgi-btn amgi-btn-secondary amgi-btn-sm ${
                  isFullView ? 'active' : ''
                }`}
                onClick={toggleFullView}
              >
                {isFullView ? '구간 분할 보기' : '전체 보기'}
              </button>
            )}
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => goToChunk(chunksRef.current.length - 1, true)}
            >
              맨 끝으로
            </button>
          </div>
        </div>

        {/* Chunk Navigation Bar (visible in chunked mode >= 50k chars) */}
        {!isFullView && chunkCount > 1 && (
          <div className="amgi-chunked-nav">
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              disabled={activeChunk <= 0}
              onClick={() => goToChunk(activeChunk - 1)}
            >
              ◀ 이전
            </button>
            <span className="tabular" style={{ fontSize: 13, fontWeight: 700, minWidth: 68, textAlign: 'center' }}>
              {activeChunk + 1} / {chunkCount}
            </span>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              disabled={activeChunk >= chunkCount - 1}
              onClick={() => goToChunk(activeChunk + 1)}
            >
              다음 ▶
            </button>
            <input
              type="range"
              className="amgi-chunked-slider"
              aria-label="구간 이동 슬라이더"
              min={0}
              max={Math.max(0, chunkCount - 1)}
              value={activeChunk}
              onChange={(e) => goToChunk(Number(e.target.value))}
            />
          </div>
        )}

        {/* Full-Text Search & Line Jump */}
        <div className="amgi-chunked-row">
          <input
            type="search"
            className="amgi-input"
            style={{ flex: 1, minWidth: 130, minHeight: 44 }}
            placeholder="전체 코드 검색 (Enter: 이동)"
            spellCheck={false}
            autoCapitalize="off"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              if (searchTimerRef.current !== null) {
                window.clearTimeout(searchTimerRef.current);
              }
              searchTimerRef.current = window.setTimeout(() => {
                runSearch(q, false);
              }, 200);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matches.length > 0) {
                  stepMatch(e.shiftKey ? -1 : 1);
                } else {
                  runSearch(searchQuery, true);
                }
              }
            }}
          />
          <span
            className="tabular"
            style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 52, textAlign: 'center' }}
          >
            {matches.length > 0 ? `${matchIndex + 1} / ${matches.length}` : '0 / 0'}
          </span>
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary amgi-btn-sm"
            aria-label="이전 검색 결과"
            disabled={matches.length === 0}
            onClick={() => stepMatch(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary amgi-btn-sm"
            aria-label="다음 검색 결과"
            disabled={matches.length === 0}
            onClick={() => stepMatch(1)}
          >
            ▼
          </button>

          <input
            type="number"
            min={1}
            className="amgi-input tabular"
            style={{ width: 92, minHeight: 44 }}
            placeholder="줄 번호"
            aria-label="줄 번호 이동"
            value={lineJumpInput}
            onChange={(e) => setLineJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleJumpToLine();
              }
            }}
          />
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary amgi-btn-sm"
            onClick={handleJumpToLine}
          >
            줄 이동
          </button>
        </div>
      </div>

      <div className="amgi-chunked-meta-strip tabular">
        <span>
          {isFullView
            ? `전체 ${totalChars.toLocaleString()}자 · 1~${totalLines.toLocaleString()}줄`
            : `구간 ${activeChunk + 1}/${chunkCount} · ${chunkMeta.startChar.toLocaleString()}~${chunkMeta.endChar.toLocaleString()}자 · ${chunkMeta.startLine.toLocaleString()}~${chunkMeta.endLine.toLocaleString()}줄`}
        </span>
        <span>
          {isFullView ? '직접 편집 모드' : '대용량 분할 편집 모드 (8KB 단위)'}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        className="amgi-chunked-textarea"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        placeholder={placeholder}
        value={textareaValue}
        onChange={(e) => handleTextareaChange(e.target.value)}
      />
    </div>
  );
});
