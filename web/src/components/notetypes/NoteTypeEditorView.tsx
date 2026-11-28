import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import type { AnkiTypes } from '../../anki/generated';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconPlus,
  IconTrash,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { CardFrame, type CardFrameHandle } from '../shared/CardFrame';
import { ChunkedCodeEditor, type ChunkedCodeEditorHandle } from './ChunkedCodeEditor';
import {
  adoptSavedOrds,
  newFieldItem,
  newTemplateItem,
  toPayloadItems,
  withKeys,
  type FieldItem as BaseFieldItem,
  type Keyed,
  type TemplateItem as BaseTemplateItem,
} from './notetypeItems';
import './notetypes.css';

type EditorTab = 'fields' | 'templates' | 'css';
type TemplateSide = 'q' | 'a';

function renderNodesToHtml(
  nodes: anki.RenderCardResponse['questionNodes'] | undefined
): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((n) => n.text ?? n.replacement?.currentText ?? '')
    .join('');
}

function useIsWide(breakpoint = 900): boolean {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setIsWide(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [breakpoint]);
  return isWide;
}

type FieldItem = Keyed<BaseFieldItem>;
type TemplateItem = Keyed<BaseTemplateItem>;

export const NoteTypeEditorView: React.FC<{ notetypeId: number }> = ({
  notetypeId,
}) => {
  const isWide = useIsWide(900);
  const { resolvedTheme, bumpCollection, goBack, registerBackHandler } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Ref-backed so the back handler and save/discard paths never read a stale value.
  const dirtyRef = useRef(false);
  const [dirty, setDirtyState] = useState(false);
  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirtyState(next);
  }, []);

  const [notetype, setNotetype] = useState<anki.Notetype | null>(null);
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [cssText, setCssText] = useState('');

  const [activeTab, setActiveTab] = useState<EditorTab>('fields');
  const [selectedTplIdx, setSelectedTplIdx] = useState(0);
  const [templateSide, setTemplateSide] = useState<TemplateSide>('q');

  // Field modals
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [renameFieldIdx, setRenameFieldIdx] = useState<number | null>(null);
  const [renameFieldInput, setRenameFieldInput] = useState('');
  const [optionFieldIdx, setOptionFieldIdx] = useState<number | null>(null);
  const [deleteFieldIdx, setDeleteFieldIdx] = useState<number | null>(null);

  // Template modals
  const [addTplOpen, setAddTplOpen] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [renameTplOpen, setRenameTplOpen] = useState(false);
  const [renameTplInput, setRenameTplInput] = useState('');
  const [deleteTplOpen, setDeleteTplOpen] = useState(false);

  // Discard confirm
  const [discardOpen, setDiscardOpen] = useState(false);

  // Code editor ref + live preview state
  const codeEditorRef = useRef<ChunkedCodeEditorHandle | null>(null);
  const frameRef = useRef<CardFrameHandle | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<'question' | 'answer'>('question');
  const [sampleNote, setSampleNote] = useState<AnkiTypes.notes.Note.$Properties | null>(
    null
  );
  const [rendered, setRendered] = useState<anki.RenderCardResponse | null>(null);
  const [codeDocVersion, setCodeDocVersion] = useState(0);

  const loadNotetype = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nt = await anki.getNotetype(notetypeId);
      setNotetype(nt);
      setFields(
        withKeys(
          (nt.fields ?? []).map((f) => ({
            ord: f.ord ? { val: f.ord.val } : undefined,
            name: f.name,
            config: f.config ? { ...f.config } : { fontName: 'Arial', fontSize: 20 },
          }))
        )
      );
      setTemplates(
        withKeys(
          (nt.templates ?? []).map((t) => ({
            ord: t.ord ? { val: t.ord.val } : undefined,
            name: t.name,
            mtimeSecs: t.mtimeSecs,
            usn: t.usn,
            config: t.config ? { ...t.config } : { qFormat: '', aFormat: '' },
          }))
        )
      );
      setCssText(nt.config?.css ?? '');
      setSelectedTplIdx(0);
      setDirty(false);
      setCodeDocVersion((v) => v + 1);

      // Load one real sample note of this notetype for live preview if available
      const nids = await anki.searchNotes(`mid:${notetypeId}`).catch(() => []);
      if (nids.length > 0) {
        const realNote = await anki.getNote(nids[0]).catch(() => null);
        if (realNote) {
          setSampleNote(realNote);
          return;
        }
      }
      const isCloze = nt.config?.kind === anki.NotetypeKind.KIND_CLOZE;
      setSampleNote({
        id: 0,
        guid: 'sample',
        notetypeId: nt.id,
        mtimeSecs: 0,
        usn: 0,
        tags: ['예시'],
        fields: (nt.fields ?? []).map((f, idx) =>
          isCloze && idx === 0
            ? '예시 {{c1::빈칸}} 문장입니다.'
            : `${f.name || `필드 ${idx + 1}`} 예시 내용`
        ),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '노트 유형을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, [notetypeId, setDirty]);

  useEffect(() => {
    void loadNotetype();
  }, [loadNotetype]);

  // Flush current ChunkedCodeEditor buffer back into React state before switching tabs/cards or saving
  const flushActiveCodeEditor = useCallback(() => {
    if (!codeEditorRef.current) return;
    const text = codeEditorRef.current.getFullText();
    if (activeTab === 'css') {
      setCssText(text);
    } else if (activeTab === 'templates') {
      setTemplates((prev) =>
        prev.map((t, idx) => {
          if (idx !== selectedTplIdx) return t;
          const cfg = { ...(t.config ?? {}) };
          if (templateSide === 'q') cfg.qFormat = text;
          else cfg.aFormat = text;
          return { ...t, config: cfg };
        })
      );
    }
  }, [activeTab, selectedTplIdx, templateSide]);

  const handleSwitchTab = (nextTab: EditorTab) => {
    if (nextTab === activeTab) return;
    flushActiveCodeEditor();
    setActiveTab(nextTab);
    setCodeDocVersion((v) => v + 1);
  };

  const handleSelectTemplate = (nextIdx: number) => {
    if (nextIdx === selectedTplIdx) return;
    flushActiveCodeEditor();
    setSelectedTplIdx(nextIdx);
    setCodeDocVersion((v) => v + 1);
  };

  const handleSelectTemplateSide = (nextSide: TemplateSide) => {
    if (nextSide === templateSide) return;
    flushActiveCodeEditor();
    setTemplateSide(nextSide);
    setPreviewSide(nextSide === 'q' ? 'question' : 'answer');
    setCodeDocVersion((v) => v + 1);
  };

  // Open sheets take Android back first via SheetOrDialog; this only guards unsaved edits.
  useEffect(() => {
    return registerBackHandler(() => {
      if (dirtyRef.current) {
        setDiscardOpen(true);
        return true;
      }
      return false;
    });
  }, [registerBackHandler]);

  const isCloze = notetype?.config?.kind === anki.NotetypeKind.KIND_CLOZE;
  const activeTemplate = templates[selectedTplIdx] ?? templates[0];

  const currentEditorKey = useMemo(() => {
    if (activeTab === 'css') return `css:${notetypeId}:${codeDocVersion}`;
    return `tpl:${notetypeId}:${selectedTplIdx}:${templateSide}:${codeDocVersion}`;
  }, [activeTab, notetypeId, selectedTplIdx, templateSide, codeDocVersion]);

  const currentEditorInitialValue = useMemo(() => {
    if (activeTab === 'css') return cssText;
    if (!activeTemplate) return '';
    return templateSide === 'q'
      ? activeTemplate.config?.qFormat ?? ''
      : activeTemplate.config?.aFormat ?? '';
  }, [activeTab, cssText, activeTemplate, templateSide]);

  const refreshLivePreview = useCallback(
    async (overrideText?: string) => {
      if (!notetype || !sampleNote || !activeTemplate) return;
      const shouldShow =
        (isWide && (activeTab === 'templates' || activeTab === 'css')) ||
        showMobilePreview;
      if (!shouldShow) return;

      let nextCss = cssText;
      let tplConfig = { ...(activeTemplate.config ?? {}) };
      if (overrideText !== undefined) {
        if (activeTab === 'css') nextCss = overrideText;
        else if (activeTab === 'templates') {
          if (templateSide === 'q') tplConfig.qFormat = overrideText;
          else tplConfig.aFormat = overrideText;
        }
      } else if (codeEditorRef.current) {
        const liveText = codeEditorRef.current.getFullText();
        if (activeTab === 'css') nextCss = liveText;
        else if (activeTab === 'templates') {
          if (templateSide === 'q') tplConfig.qFormat = liveText;
          else tplConfig.aFormat = liveText;
        }
      }

      const hydratedFields = (fields ?? []).map((f, idx) => {
        const existing = sampleNote.fields?.[idx];
        if (existing && existing.trim()) return existing;
        return isCloze && idx === 0
          ? '예시 {{c1::빈칸}} 문장입니다.'
          : `${f.name || `필드 ${idx + 1}`} 예시`;
      });

      try {
        const res = await anki.renderUncommittedCard(
          { ...sampleNote, fields: hydratedFields },
          0,
          { ...activeTemplate, config: tplConfig },
          true,
          false
        );
        setRendered({
          questionNodes: res.questionNodes,
          answerNodes: res.answerNodes,
          css: nextCss,
          latexSvg: res.latexSvg,
          isEmpty: res.isEmpty,
        } as anki.RenderCardResponse);
      } catch {
        // Ignore live template syntax errors while user is typing
      }
    },
    [
      notetype,
      sampleNote,
      activeTemplate,
      isWide,
      activeTab,
      showMobilePreview,
      cssText,
      templateSide,
      fields,
      isCloze,
    ]
  );

  useEffect(() => {
    void refreshLivePreview();
  }, [refreshLivePreview]);

  useEffect(() => {
    if (!rendered || !frameRef.current) return;
    const qHtml = renderNodesToHtml(rendered.questionNodes);
    const aHtml = renderNodesToHtml(rendered.answerNodes);
    frameRef.current.render({
      side: previewSide,
      html: previewSide === 'question' ? qHtml : aHtml,
      preloadAnswerHtml: aHtml,
      css: rendered.css ?? '',
      theme: resolvedTheme,
      tapToFlip: true,
    });
  }, [rendered, previewSide, resolvedTheme]);

  const handleSave = async () => {
    if (!notetype || saving) return;
    setSaving(true);
    try {
      let nextCss = cssText;
      let nextTemplates = templates;
      if (codeEditorRef.current) {
        const live = codeEditorRef.current.getFullText();
        if (activeTab === 'css') {
          nextCss = live;
          setCssText(live);
        } else if (activeTab === 'templates') {
          nextTemplates = templates.map((t, idx) => {
            if (idx !== selectedTplIdx) return t;
            const cfg = { ...(t.config ?? {}) };
            if (templateSide === 'q') cfg.qFormat = live;
            else cfg.aFormat = live;
            return { ...t, config: cfg };
          });
          setTemplates(nextTemplates);
        }
      }

      const payload: AnkiTypes.notetypes.Notetype.$Properties = {
        id: notetype.id,
        name: notetype.name,
        mtimeSecs: notetype.mtimeSecs,
        usn: notetype.usn,
        config: {
          ...(notetype.config ?? {}),
          css: nextCss,
        },
        fields: toPayloadItems(fields),
        templates: toPayloadItems(nextTemplates),
      };
      await anki.updateNotetype(payload);
      bumpCollection();
      showToast('노트 유형 변경 사항을 저장했습니다.', 'success');
      // Refresh mtime/usn and the engine-assigned ords quietly, keeping the selected
      // template, the code editor's caret/scroll and the current tab.
      const fresh = await anki.getNotetype(notetypeId);
      const nextFields = adoptSavedOrds(fields, fresh.fields ?? []);
      const savedTemplates = adoptSavedOrds(nextTemplates, fresh.templates ?? []);
      if (nextFields && savedTemplates) {
        setNotetype(fresh);
        setFields(nextFields);
        setTemplates(savedTemplates);
        setDirty(false);
      } else {
        await loadNotetype();
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 저장하지 못했습니다.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // --- Field operations (preserve each field's original ord!) ---
  const handleAddField = () => {
    const clean = newFieldName.trim();
    if (!clean) return;
    if (fields.some((f) => f.name === clean)) {
      showToast('같은 이름의 필드가 이미 있습니다.', 'error');
      return;
    }
    // New fields carry no ord (see newFieldItem).
    setFields((prev) => [...prev, newFieldItem(clean)]);
    setNewFieldName('');
    setAddFieldOpen(false);
    setDirty(true);
  };

  const handleMoveField = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      // Preserve each field's original `ord`!
      return next;
    });
    setDirty(true);
  };

  const handleRenameField = () => {
    if (renameFieldIdx === null) return;
    const clean = renameFieldInput.trim();
    if (!clean) return;
    if (fields.some((f, idx) => idx !== renameFieldIdx && f.name === clean)) {
      showToast('같은 이름의 필드가 이미 있습니다.', 'error');
      return;
    }
    setFields((prev) =>
      prev.map((f, idx) => (idx === renameFieldIdx ? { ...f, name: clean } : f))
    );
    setRenameFieldIdx(null);
    setDirty(true);
  };

  const handleDeleteField = () => {
    if (deleteFieldIdx === null) return;
    if (fields.length <= 1) {
      showToast('최소 1개의 필드가 필요합니다.', 'error');
      setDeleteFieldIdx(null);
      return;
    }
    setFields((prev) => prev.filter((_, idx) => idx !== deleteFieldIdx));
    setDeleteFieldIdx(null);
    setDirty(true);
  };

  // --- Card template operations ---
  const handleAddTemplate = () => {
    const clean = newTplName.trim();
    if (!clean) return;
    flushActiveCodeEditor();
    const firstFieldName = fields[0]?.name || 'Front';
    // New templates carry no ord (see newTemplateItem).
    setTemplates((prev) => [
      ...prev,
      newTemplateItem(clean, `{{${firstFieldName}}}`, `{{FrontSide}}\n\n<hr id=answer>\n\n`),
    ]);
    setSelectedTplIdx(templates.length);
    setNewTplName('');
    setAddTplOpen(false);
    setDirty(true);
    setCodeDocVersion((v) => v + 1);
  };

  const handleRenameTemplate = () => {
    const clean = renameTplInput.trim();
    if (!clean) return;
    setTemplates((prev) =>
      prev.map((t, idx) => (idx === selectedTplIdx ? { ...t, name: clean } : t))
    );
    setRenameTplOpen(false);
    setDirty(true);
  };

  const handleDeleteTemplate = () => {
    if (templates.length <= 1) {
      showToast('최소 1개의 카드 템플릿이 필요합니다.', 'error');
      setDeleteTplOpen(false);
      return;
    }
    setTemplates((prev) => prev.filter((_, idx) => idx !== selectedTplIdx));
    setSelectedTplIdx(0);
    setDeleteTplOpen(false);
    setDirty(true);
    setCodeDocVersion((v) => v + 1);
  };

  const previewNode = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="amgi-editor-preview-bar">
        <div className="amgi-preview-side-tabs" role="tablist" aria-label="미리보기 면">
          <button
            type="button"
            role="tab"
            aria-selected={previewSide === 'question'}
            className={`amgi-preview-side-btn ${previewSide === 'question' ? 'active' : ''}`}
            onClick={() => setPreviewSide('question')}
          >
            앞면
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={previewSide === 'answer'}
            className={`amgi-preview-side-btn ${previewSide === 'answer' ? 'active' : ''}`}
            onClick={() => setPreviewSide('answer')}
          >
            뒷면
          </button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
          실시간 미리보기
        </span>
      </div>
      <div className="amgi-preview-frame-box" style={{ flex: 1, minHeight: 280 }}>
        <CardFrame
          ref={frameRef}
          theme={resolvedTheme}
          title="템플릿 미리보기"
          onCardTap={() =>
            setPreviewSide((s) => (s === 'question' ? 'answer' : 'question'))
          }
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="amgi-nt-editor-root">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          노트 유형을 불러오는 중...
        </div>
      </div>
    );
  }

  if (error || !notetype) {
    return (
      <div className="amgi-nt-editor-root" style={{ padding: 16 }}>
        <ErrorState
          title="노트 유형을 열 수 없습니다"
          message={error ?? '노트 유형을 찾지 못했습니다.'}
          onRetry={() => void loadNotetype()}
        />
      </div>
    );
  }

  const editingOptionField =
    optionFieldIdx !== null ? fields[optionFieldIdx] ?? null : null;

  return (
    <div className="amgi-nt-editor-root" data-testid="notetype-editor-view">
      <header className="amgi-nt-topbar amgi-nt-editor-topbar">
        <div className="amgi-editor-topbar-left">
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            aria-label="뒤로 가기"
            onClick={() => goBack('#/notetypes')}
          >
            <IconArrowLeft size={20} />
          </button>
          <h1 className="amgi-topbar-title">{notetype.name}</h1>
          <span className={`amgi-nt-dirty-pill ${dirty ? 'dirty' : ''}`}>
            {dirty ? '● 수정됨' : '저장됨'}
          </span>
        </div>

        <div className="amgi-editor-topbar-right">
          {!isWide && activeTab !== 'fields' && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => {
                setShowMobilePreview(true);
                void refreshLivePreview();
              }}
            >
              <IconEye size={16} />
              <span>미리보기</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            className="amgi-btn amgi-btn-primary amgi-btn-sm"
            onClick={() => void handleSave()}
          >
            <IconCheck size={16} />
            <span>{saving ? '저장 중...' : '저장'}</span>
          </button>
        </div>
      </header>

      <div className="amgi-nt-tabs-bar" role="tablist" aria-label="노트 유형 편집 탭">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'fields'}
          className={`amgi-nt-tab-btn ${activeTab === 'fields' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('fields')}
        >
          필드 ({fields.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          className={`amgi-nt-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('templates')}
        >
          카드 템플릿 ({templates.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'css'}
          className={`amgi-nt-tab-btn ${activeTab === 'css' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('css')}
        >
          스타일(CSS)
        </button>
      </div>

      {activeTab === 'fields' ? (
        <div className="amgi-nt-fields-wrap">
          <div className="amgi-nt-header-bar">
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
              필드 순서를 바꾸거나 옵션을 설정한 뒤 상단 ‘저장’을 누르세요.
            </span>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary amgi-btn-sm"
              onClick={() => {
                setNewFieldName('');
                setAddFieldOpen(true);
              }}
            >
              <IconPlus size={16} />
              <span>필드 추가</span>
            </button>
          </div>

          {fields.map((f, idx) => (
            <div key={f.clientKey} className="amgi-nt-field-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {idx + 1}. {f.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  글꼴 {f.config?.fontSize ?? 20}px
                  {f.config?.sticky ? ' · 값 고정' : ''}
                  {f.config?.rtl ? ' · 오른쪽→왼쪽' : ''}
                  {f.config?.plainText ? ' · 일반 텍스트' : ''}
                </div>
              </div>

              <div className="amgi-nt-field-controls">
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  aria-label={`${f.name} 위로`}
                  disabled={idx === 0}
                  onClick={() => handleMoveField(idx, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  aria-label={`${f.name} 아래로`}
                  disabled={idx === fields.length - 1}
                  onClick={() => handleMoveField(idx, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  onClick={() => {
                    setRenameFieldInput(f.name ?? '');
                    setRenameFieldIdx(idx);
                  }}
                >
                  이름
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  onClick={() => setOptionFieldIdx(idx)}
                >
                  옵션
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-danger amgi-btn-sm"
                  aria-label={`${f.name} 삭제`}
                  disabled={fields.length <= 1 || Boolean(f.config?.preventDeletion)}
                  onClick={() => setDeleteFieldIdx(idx)}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`amgi-nt-split ${isWide ? 'with-preview' : ''}`}>
          <div className="amgi-nt-template-pane">
            {activeTab === 'templates' && (
              <>
                <div className="amgi-nt-card-bar">
                  <select
                    className="amgi-select"
                    style={{ flex: 1, minWidth: 160 }}
                    aria-label="카드 템플릿 선택"
                    value={selectedTplIdx}
                    onChange={(e) => handleSelectTemplate(Number(e.target.value))}
                  >
                    {templates.map((t, idx) => (
                      <option key={t.clientKey} value={idx}>
                        {t.name || `카드 ${idx + 1}`}
                      </option>
                    ))}
                  </select>

                  <div className="amgi-preview-side-tabs">
                    <button
                      type="button"
                      className={`amgi-preview-side-btn ${
                        templateSide === 'q' ? 'active' : ''
                      }`}
                      onClick={() => handleSelectTemplateSide('q')}
                    >
                      앞면 템플릿
                    </button>
                    <button
                      type="button"
                      className={`amgi-preview-side-btn ${
                        templateSide === 'a' ? 'active' : ''
                      }`}
                      onClick={() => handleSelectTemplateSide('a')}
                    >
                      뒷면 템플릿
                    </button>
                  </div>

                  {!isCloze && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                        onClick={() => {
                          setNewTplName(`카드 ${templates.length + 1}`);
                          setAddTplOpen(true);
                        }}
                      >
                        + 카드 추가
                      </button>
                      <button
                        type="button"
                        className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                        onClick={() => {
                          setRenameTplInput(activeTemplate?.name ?? '');
                          setRenameTplOpen(true);
                        }}
                      >
                        이름
                      </button>
                      {templates.length > 1 && (
                        <button
                          type="button"
                          className="amgi-btn amgi-btn-danger amgi-btn-sm"
                          onClick={() => setDeleteTplOpen(true)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Field Insert Chips */}
                <div className="amgi-nt-insert-chips" aria-label="필드 태그 빠른 삽입">
                  {fields.map((f) => (
                    <button
                      key={f.clientKey}
                      type="button"
                      className="amgi-chip"
                      onClick={() =>
                        codeEditorRef.current?.insertAtCaret(`{{${f.name}}}`)
                      }
                    >
                      {`{{${f.name}}}`}
                    </button>
                  ))}
                  {templateSide === 'a' && (
                    <button
                      type="button"
                      className="amgi-chip"
                      onClick={() =>
                        codeEditorRef.current?.insertAtCaret('{{FrontSide}}')
                      }
                    >
                      {'{{FrontSide}}'}
                    </button>
                  )}
                  {isCloze && fields[0]?.name && (
                    <button
                      type="button"
                      className="amgi-chip"
                      onClick={() =>
                        codeEditorRef.current?.insertAtCaret(
                          `{{cloze:${fields[0].name}}}`
                        )
                      }
                    >
                      {`{{cloze:${fields[0].name}}}`}
                    </button>
                  )}
                  {fields[0]?.name && (
                    <>
                      <button
                        type="button"
                        className="amgi-chip"
                        onClick={() =>
                          codeEditorRef.current?.insertAtCaret(
                            `{{hint:${fields[0].name}}}`
                          )
                        }
                      >
                        {`{{hint:${fields[0].name}}}`}
                      </button>
                      <button
                        type="button"
                        className="amgi-chip"
                        onClick={() =>
                          codeEditorRef.current?.insertAtCaret(
                            `{{type:${fields[0].name}}}`
                          )
                        }
                      >
                        {`{{type:${fields[0].name}}}`}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            <ChunkedCodeEditor
              ref={codeEditorRef}
              docKey={currentEditorKey}
              initialValue={currentEditorInitialValue}
              placeholder={
                activeTab === 'css'
                  ? '.card { font-size: 20px; }'
                  : '카드 템플릿 HTML 입력...'
              }
              onUserEdit={() => setDirty(true)}
              onPreviewText={(liveText) => void refreshLivePreview(liveText)}
            />
          </div>

          {isWide && (
            <aside className="amgi-nt-preview-pane" aria-label="카드 템플릿 미리보기">
              {previewNode}
            </aside>
          )}
        </div>
      )}

      {/* Mobile Live Preview Sheet */}
      {!isWide && (
        <SheetOrDialog
          open={showMobilePreview}
          onClose={() => setShowMobilePreview(false)}
          title="카드 미리보기"
          maxWidth={680}
        >
          <div style={{ height: 'min(62dvh, 460px)', display: 'flex', flexDirection: 'column' }}>
            {previewNode}
          </div>
        </SheetOrDialog>
      )}

      {/* Add Field Modal */}
      <SheetOrDialog
        open={addFieldOpen}
        onClose={() => setAddFieldOpen(false)}
        title="필드 추가"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setAddFieldOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!newFieldName.trim()}
              className="amgi-btn amgi-btn-primary"
              onClick={handleAddField}
            >
              추가
            </button>
          </>
        }
      >
        <label className="form-field">
          <span>새 필드 이름</span>
          <input
            type="text"
            className="amgi-input"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
          />
        </label>
      </SheetOrDialog>

      {/* Rename Field Modal */}
      <SheetOrDialog
        open={renameFieldIdx !== null}
        onClose={() => setRenameFieldIdx(null)}
        title="필드 이름 바꾸기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setRenameFieldIdx(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!renameFieldInput.trim()}
              className="amgi-btn amgi-btn-primary"
              onClick={handleRenameField}
            >
              변경
            </button>
          </>
        }
      >
        <label className="form-field">
          <span>필드 이름</span>
          <input
            type="text"
            className="amgi-input"
            value={renameFieldInput}
            onChange={(e) => setRenameFieldInput(e.target.value)}
          />
        </label>
      </SheetOrDialog>

      {/* Field Options Modal */}
      <SheetOrDialog
        open={editingOptionField !== null}
        onClose={() => setOptionFieldIdx(null)}
        title={`필드 옵션: ${editingOptionField?.name ?? ''}`}
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-primary"
            onClick={() => setOptionFieldIdx(null)}
          >
            완료
          </button>
        }
      >
        {editingOptionField && optionFieldIdx !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="form-field">
              <span>기본 글꼴 크기 (px)</span>
              <input
                type="number"
                min={8}
                max={72}
                className="amgi-input tabular"
                value={editingOptionField.config?.fontSize ?? 20}
                onChange={(e) => {
                  const val = Math.max(8, Math.min(72, Number(e.target.value) || 20));
                  setFields((prev) =>
                    prev.map((f, idx) =>
                      idx === optionFieldIdx
                        ? { ...f, config: { ...(f.config ?? {}), fontSize: val } }
                        : f
                    )
                  );
                  setDirty(true);
                }}
              />
            </label>

            <div className="amgi-setting-row" style={{ padding: '8px 0' }}>
              <div className="amgi-setting-text">
                <span className="amgi-setting-label">기억하기 (값 고정)</span>
                <span className="amgi-setting-desc">
                  노트 추가 후에도 마지막 입력값을 유지합니다
                </span>
              </div>
              <Switch
                checked={Boolean(editingOptionField.config?.sticky)}
                onChange={(next) => {
                  setFields((prev) =>
                    prev.map((f, idx) =>
                      idx === optionFieldIdx
                        ? { ...f, config: { ...(f.config ?? {}), sticky: next } }
                        : f
                    )
                  );
                  setDirty(true);
                }}
              />
            </div>

            <div className="amgi-setting-row" style={{ padding: '8px 0' }}>
              <div className="amgi-setting-text">
                <span className="amgi-setting-label">오른쪽에서 왼쪽 (RTL)</span>
                <span className="amgi-setting-desc">
                  아랍어 등 오른쪽에서 왼쪽으로 쓰는 언어에 사용합니다
                </span>
              </div>
              <Switch
                checked={Boolean(editingOptionField.config?.rtl)}
                onChange={(next) => {
                  setFields((prev) =>
                    prev.map((f, idx) =>
                      idx === optionFieldIdx
                        ? { ...f, config: { ...(f.config ?? {}), rtl: next } }
                        : f
                    )
                  );
                  setDirty(true);
                }}
              />
            </div>

            <div className="amgi-setting-row" style={{ padding: '8px 0' }}>
              <div className="amgi-setting-text">
                <span className="amgi-setting-label">서식 없는 일반 텍스트</span>
                <span className="amgi-setting-desc">
                  붙여넣기 시 글꼴과 색상을 자동으로 지웁니다
                </span>
              </div>
              <Switch
                checked={Boolean(editingOptionField.config?.plainText)}
                onChange={(next) => {
                  setFields((prev) =>
                    prev.map((f, idx) =>
                      idx === optionFieldIdx
                        ? { ...f, config: { ...(f.config ?? {}), plainText: next } }
                        : f
                    )
                  );
                  setDirty(true);
                }}
              />
            </div>
          </div>
        )}
      </SheetOrDialog>

      {/* Delete Field Confirm */}
      <SheetOrDialog
        open={deleteFieldIdx !== null}
        onClose={() => setDeleteFieldIdx(null)}
        title="필드 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setDeleteFieldIdx(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={handleDeleteField}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          <strong>{deleteFieldIdx !== null ? fields[deleteFieldIdx]?.name : ''}</strong>{' '}
          필드를 삭제하면 이 필드의 모든 노트 내용이 영구 삭제됩니다. 계속할까요?
        </p>
      </SheetOrDialog>

      {/* Add Template Modal */}
      <SheetOrDialog
        open={addTplOpen}
        onClose={() => setAddTplOpen(false)}
        title="카드 템플릿 추가"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setAddTplOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!newTplName.trim()}
              className="amgi-btn amgi-btn-primary"
              onClick={handleAddTemplate}
            >
              추가
            </button>
          </>
        }
      >
        <label className="form-field">
          <span>카드 템플릿 이름</span>
          <input
            type="text"
            className="amgi-input"
            value={newTplName}
            onChange={(e) => setNewTplName(e.target.value)}
          />
        </label>
      </SheetOrDialog>

      {/* Rename Template Modal */}
      <SheetOrDialog
        open={renameTplOpen}
        onClose={() => setRenameTplOpen(false)}
        title="카드 템플릿 이름 바꾸기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setRenameTplOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!renameTplInput.trim()}
              className="amgi-btn amgi-btn-primary"
              onClick={handleRenameTemplate}
            >
              변경
            </button>
          </>
        }
      >
        <label className="form-field">
          <span>카드 템플릿 이름</span>
          <input
            type="text"
            className="amgi-input"
            value={renameTplInput}
            onChange={(e) => setRenameTplInput(e.target.value)}
          />
        </label>
      </SheetOrDialog>

      {/* Delete Template Confirm */}
      <SheetOrDialog
        open={deleteTplOpen}
        onClose={() => setDeleteTplOpen(false)}
        title="카드 템플릿 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setDeleteTplOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={handleDeleteTemplate}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          <strong>{activeTemplate?.name}</strong> 카드 템플릿과 해당 템플릿으로 생성된 카드가
          삭제됩니다. 계속할까요?
        </p>
      </SheetOrDialog>

      {/* Discard Changes Confirm */}
      <SheetOrDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="저장하지 않고 나가기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setDiscardOpen(false)}
            >
              계속 편집
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={() => {
                setDiscardOpen(false);
                setDirty(false);
                goBack('#/notetypes', { force: true });
              }}
            >
              버리고 나가기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          저장하지 않은 변경 사항을 버리고 나갈까요?
        </p>
      </SheetOrDialog>
    </div>
  );
};
