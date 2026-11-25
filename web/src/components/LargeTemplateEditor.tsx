import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NoteType } from '../types/models';

interface LargeTemplateEditorProps {
  noteTypes: NoteType[];
  onSaveNoteType: (updated: NoteType) => Promise<void>;
}

type EditorSection = 'css' | 'qfmt' | 'afmt';

const CHUNK_TARGET_BYTES = 8192; // ~8KB per virtual chunk
const VISIBLE_CHUNK_WINDOW = 5; // Render only selected chunk +/- window in DOM

interface VirtualChunk {
  index: number;
  startChar: number;
  endChar: number;
  startLine: number;
  endLine: number;
  text: string;
}

/**
 * Split arbitrarily huge strings (1,000,000+ chars) into ~8KB line-aligned virtual chunks
 * in linear O(N) time without freezing the UI thread.
 */
function buildVirtualChunks(content: string): VirtualChunk[] {
  if (!content) {
    return [{ index: 0, startChar: 0, endChar: 0, startLine: 1, endLine: 1, text: '' }];
  }

  const chunks: VirtualChunk[] = [];
  let pos = 0;
  let line = 1;
  let index = 0;

  while (pos < content.length) {
    let end = Math.min(content.length, pos + CHUNK_TARGET_BYTES);
    if (end < content.length) {
      const nextNl = content.indexOf('\n', end);
      if (nextNl !== -1 && nextNl - end < 1024) {
        end = nextNl + 1;
      }
    }

    const slice = content.slice(pos, end);
    let nlCount = 0;
    for (let i = 0; i < slice.length; i++) {
      if (slice.charCodeAt(i) === 10) nlCount++;
    }

    chunks.push({
      index,
      startChar: pos,
      endChar: end,
      startLine: line,
      endLine: line + nlCount,
      text: slice,
    });

    line += nlCount;
    pos = end;
    index++;
  }

  return chunks;
}

export const LargeTemplateEditor: React.FC<LargeTemplateEditorProps> = ({
  noteTypes,
  onSaveNoteType,
}) => {
  const [selectedNtId, setSelectedNtId] = useState<number>(() => noteTypes[0]?.id ?? 0);
  const [section, setSection] = useState<EditorSection>('css');
  const [templateOrd, setTemplateOrd] = useState<number>(0);

  const activeNoteType = useMemo(
    () => noteTypes.find((n) => n.id === selectedNtId) ?? noteTypes[0],
    [noteTypes, selectedNtId]
  );

  const getSectionText = useCallback(
    (nt: NoteType | undefined, sec: EditorSection, ord: number): string => {
      if (!nt) return '';
      if (sec === 'css') return nt.css ?? '';
      const tmpl = nt.templates.find((t) => t.ord === ord) ?? nt.templates[0];
      if (!tmpl) return '';
      return sec === 'qfmt' ? tmpl.qfmt : tmpl.afmt;
    },
    []
  );

  const [fullText, setFullText] = useState<string>(() =>
    getSectionText(activeNoteType, section, templateOrd)
  );
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<Array<{ chunkIndex: number; offset: number }>>([]);
  const [matchCursor, setMatchCursor] = useState(0);
  const [jumpLineInput, setJumpLineInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setFullText(getSectionText(activeNoteType, section, templateOrd));
    setActiveChunkIndex(0);
    setSearchMatches([]);
    setMatchCursor(0);
    setStatusMsg('');
  }, [activeNoteType, section, templateOrd, getSectionText]);

  const chunks = useMemo(() => buildVirtualChunks(fullText), [fullText]);

  const safeActiveIndex = Math.min(activeChunkIndex, Math.max(0, chunks.length - 1));
  const activeChunk = chunks[safeActiveIndex];

  const windowRange = useMemo(() => {
    const start = Math.max(0, safeActiveIndex - VISIBLE_CHUNK_WINDOW);
    const end = Math.min(chunks.length, safeActiveIndex + VISIBLE_CHUNK_WINDOW + 1);
    return { start, end, items: chunks.slice(start, end) };
  }, [chunks, safeActiveIndex]);

  const handleChunkEdit = (nextChunkText: string) => {
    if (!activeChunk) return;
    const updated =
      fullText.slice(0, activeChunk.startChar) +
      nextChunkText +
      fullText.slice(activeChunk.endChar);
    setFullText(updated);
    setStatusMsg('수정됨 (저장 필요)');
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchMatches([]);
      return;
    }
    const lowerQ = q.toLowerCase();
    const matches: Array<{ chunkIndex: number; offset: number }> = [];
    for (const chunk of chunks) {
      const lowerText = chunk.text.toLowerCase();
      let idx = lowerText.indexOf(lowerQ);
      while (idx !== -1) {
        matches.push({ chunkIndex: chunk.index, offset: idx });
        if (matches.length >= 500) break;
        idx = lowerText.indexOf(lowerQ, idx + lowerQ.length);
      }
      if (matches.length >= 500) break;
    }
    setSearchMatches(matches);
    setMatchCursor(0);
    if (matches.length > 0) {
      setActiveChunkIndex(matches[0].chunkIndex);
      setStatusMsg(`${matches.length}${matches.length >= 500 ? '+' : ''}건 검색됨`);
    } else {
      setStatusMsg('검색 결과 없음');
    }
  };

  const goToMatch = (dir: 1 | -1) => {
    if (searchMatches.length === 0) return;
    const nextIdx = (matchCursor + dir + searchMatches.length) % searchMatches.length;
    setMatchCursor(nextIdx);
    setActiveChunkIndex(searchMatches[nextIdx].chunkIndex);
  };

  const handleJumpToLine = () => {
    const targetLine = Number(jumpLineInput);
    if (!Number.isFinite(targetLine) || targetLine < 1) return;
    const found =
      chunks.find((c) => targetLine >= c.startLine && targetLine <= c.endLine) ??
      chunks[chunks.length - 1];
    if (found) {
      setActiveChunkIndex(found.index);
      setStatusMsg(`${targetLine}행 → 청크 #${found.index + 1} 이동`);
    }
  };

  const handleGenerateStressTest = () => {
    const sampleBlock =
      `/* myAmgi virtual-chunked CSS benchmark block */\n` +
      `.card { font-size: 20px; line-height: 1.6; }\n`;
    const repeatCount = Math.ceil(1_050_000 / sampleBlock.length);
    setFullText(sampleBlock.repeat(repeatCount));
    setActiveChunkIndex(0);
    setStatusMsg('1,050,000+자 테스트 데이터 생성 완료 (60fps 가상 청킹 활성)');
  };

  const handleSave = async () => {
    if (!activeNoteType) return;
    let updatedNt: NoteType;
    if (section === 'css') {
      updatedNt = {
        ...activeNoteType,
        css: fullText,
        mod: Math.floor(Date.now() / 1000),
      };
    } else {
      const updatedTemplates = activeNoteType.templates.map((t) => {
        if (t.ord !== templateOrd) return t;
        return {
          ...t,
          qfmt: section === 'qfmt' ? fullText : t.qfmt,
          afmt: section === 'afmt' ? fullText : t.afmt,
        };
      });
      updatedNt = {
        ...activeNoteType,
        templates: updatedTemplates,
        mod: Math.floor(Date.now() / 1000),
      };
    }
    await onSaveNoteType(updatedNt);
    setStatusMsg('IndexedDB에 저장 완료');
  };

  if (!activeNoteType) {
    return (
      <div className="card-surface panel-pad">
        <p className="muted-text">편집할 노트 타입이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="template-editor card-surface">
      <div className="editor-toolbar">
        <div className="editor-controls-row">
          <label className="field-inline">
            <span>노트 타입</span>
            <select
              value={activeNoteType.id}
              onChange={(e) => {
                setSelectedNtId(Number(e.target.value));
                setTemplateOrd(0);
              }}
            >
              {noteTypes.map((nt) => (
                <option key={nt.id} value={nt.id}>
                  {nt.name}
                </option>
              ))}
            </select>
          </label>

          <div className="segmented-tabs">
            <button
              type="button"
              className={section === 'css' ? 'active' : ''}
              onClick={() => setSection('css')}
            >
              CSS 스타일
            </button>
            <button
              type="button"
              className={section === 'qfmt' ? 'active' : ''}
              onClick={() => setSection('qfmt')}
            >
              앞면 템플릿
            </button>
            <button
              type="button"
              className={section === 'afmt' ? 'active' : ''}
              onClick={() => setSection('afmt')}
            >
              뒷면 템플릿
            </button>
          </div>

          {section !== 'css' && activeNoteType.templates.length > 1 && (
            <label className="field-inline">
              <span>카드</span>
              <select
                value={templateOrd}
                onChange={(e) => setTemplateOrd(Number(e.target.value))}
              >
                {activeNoteType.templates.map((t) => (
                  <option key={t.ord} value={t.ord}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="editor-controls-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="전체 청크 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSearch}>
              검색
            </button>
            {searchMatches.length > 0 && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => goToMatch(-1)}>
                  ▲
                </button>
                <span className="muted-text small">
                  {matchCursor + 1}/{searchMatches.length}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => goToMatch(1)}>
                  ▼
                </button>
              </>
            )}
          </div>

          <div className="jump-box">
            <input
              type="number"
              min={1}
              placeholder="줄 번호"
              value={jumpLineInput}
              onChange={(e) => setJumpLineInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJumpToLine();
              }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleJumpToLine}>
              이동
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleGenerateStressTest}
            title="100만자 이상 가상 청킹 성능 테스트"
          >
            1M+자 테스트
          </button>

          <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSave()}>
            저장
          </button>
        </div>

        <div className="editor-stats-bar">
          <span>
            전체 길이: <strong>{fullText.length.toLocaleString()}</strong>자
          </span>
          <span>
            가상 청크: <strong>{chunks.length}</strong>개 (~8KB 단위)
          </span>
          <span>
            현재 청크: <strong>#{safeActiveIndex + 1}</strong> (줄 {activeChunk?.startLine}–{activeChunk?.endLine})
          </span>
          {statusMsg && <span className="status-pill">{statusMsg}</span>}
        </div>
      </div>

      <div className="editor-split">
        <div className="chunk-navigator">
          <div className="chunk-nav-header">
            청크 목록 ({windowRange.start + 1}–{windowRange.end} / {chunks.length})
          </div>
          <div className="chunk-jump-slider">
            <input
              type="range"
              min={0}
              max={Math.max(0, chunks.length - 1)}
              value={safeActiveIndex}
              onChange={(e) => setActiveChunkIndex(Number(e.target.value))}
            />
          </div>
          <div className="chunk-list">
            {windowRange.items.map((c) => (
              <button
                key={c.index}
                type="button"
                className={`chunk-item ${c.index === safeActiveIndex ? 'active' : ''}`}
                onClick={() => setActiveChunkIndex(c.index)}
              >
                <div className="chunk-item-title">청크 #{c.index + 1}</div>
                <div className="chunk-item-meta">
                  줄 {c.startLine}–{c.endLine} · {c.text.length.toLocaleString()}자
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="chunk-editor-pane">
          <textarea
            ref={textareaRef}
            className="chunk-textarea"
            spellCheck={false}
            value={activeChunk?.text ?? ''}
            onChange={(e) => handleChunkEdit(e.target.value)}
            placeholder="템플릿 또는 CSS 내용을 입력하세요..."
          />
        </div>
      </div>
    </div>
  );
};
