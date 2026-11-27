import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as anki from '../../anki';
import type { AnkiTypes } from '../../anki/generated';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconArrowLeft,
  IconCheck,
  IconCode,
  IconEye,
  IconImage,
  IconVolume,
  SheetOrDialog,
  useToast,
} from '../../ui';
import { CardFrame, type CardFrameHandle } from '../shared/CardFrame';
import { RichFieldInput, type RichFieldInputHandle } from './RichFieldInput';
import { TagChipInput } from './TagChipInput';
import './editor.css';

const COLOR_SWATCHES = ['#D93025', '#2F6FED', '#1E8E3E', '#B26A00', '#8B5CF6'];

function renderNodesToHtml(
  nodes: anki.RenderCardResponse['questionNodes'] | undefined
): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((n) => n.text ?? n.replacement?.currentText ?? '')
    .join('');
}

function extractClozeNumsFallback(fields: string[]): number[] {
  const nums = new Set<number>();
  const re = /\{\{c(\d+)::/gi;
  for (const f of fields) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(f)) !== null) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n >= 1) nums.add(n);
    }
  }
  return Array.from(nums).sort((a, b) => a - b);
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

export const NoteEditorView: React.FC<{
  noteId?: number;
  defaultDeckId?: number;
}> = ({ noteId, defaultDeckId }) => {
  const isAddMode = noteId === undefined || noteId === 0;
  const isWide = useIsWide(900);
  const {
    prefs,
    setPref,
    resolvedTheme,
    bumpCollection,
    navigate,
    goBack,
    registerBackHandler,
  } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [notetypeList, setNotetypeList] = useState<anki.NotetypeNameId[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number>(defaultDeckId ?? 1);
  const [initialDeckId, setInitialDeckId] = useState<number>(defaultDeckId ?? 1);
  const [cardIdsOfEditedNote, setCardIdsOfEditedNote] = useState<number[]>([]);

  const [notetype, setNotetype] = useState<anki.Notetype | null>(null);
  const [note, setNote] = useState<anki.Note | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [pinnedFields, setPinnedFields] = useState<Record<number, boolean>>({});
  const [htmlModes, setHtmlModes] = useState<Record<number, boolean>>({});
  const [focusedFieldIdx, setFocusedFieldIdx] = useState<number>(0);

  const [dirty, setDirty] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pasteStrips, setPasteStrips] = useState(false);

  const [fieldCheckState, setFieldCheckState] = useState<number>(
    anki.NoteFieldsState.NORMAL
  );
  const [clozeNums, setClozeNums] = useState<number[]>([]);

  // Toolbar popovers & file pickers
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const fieldRefs = useRef<Array<RichFieldInputHandle | null>>([]);

  // Preview state
  const [showPreview, setShowPreview] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : false
  );
  const [previewSide, setPreviewSide] = useState<'question' | 'answer'>('question');
  const [previewOrd, setPreviewOrd] = useState<number>(0);
  const [renderedPreview, setRenderedPreview] = useState<anki.RenderCardResponse | null>(
    null
  );
  const frameRef = useRef<CardFrameHandle | null>(null);

  // Change notetype dialog in Edit Mode
  const [changeNtOpen, setChangeNtOpen] = useState(false);
  const [targetNtId, setTargetNtId] = useState<number>(0);
  const [changeNtInfo, setChangeNtInfo] = useState<anki.ChangeNotetypeInfo | null>(null);
  const [ntFieldMap, setNtFieldMap] = useState<number[]>([]);
  const [ntTemplateMap, setNtTemplateMap] = useState<number[]>([]);

  const applyStickyFromNotetype = useCallback(
    (nt: anki.Notetype) => {
      const ntId = anki.toNumber(nt.id);
      const nextPins: Record<number, boolean> = {};
      (nt.fields ?? []).forEach((f, idx) => {
        const ord = f.ord?.val ?? idx;
        const prefKey = `editor.sticky.${ntId}.${ord}`;
        if (typeof prefs[prefKey] === 'boolean') {
          nextPins[idx] = prefs[prefKey] as boolean;
        } else {
          nextPins[idx] = Boolean(f.config?.sticky);
        }
      });
      setPinnedFields(nextPins);
    },
    [prefs]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [deckList, ntNames, ankiPrefs] = await Promise.all([
        anki.getDeckNames(false, true),
        anki.getNotetypeNames(),
        anki.getPreferences().catch(() => null),
      ]);
      setDecks(deckList);
      setNotetypeList(ntNames);
      setPasteStrips(Boolean(ankiPrefs?.editing?.pasteStripsFormatting));

      if (isAddMode) {
        const defaults = await anki.defaultsForAdding(defaultDeckId ?? 0);
        const prefDeck =
          typeof prefs['editor.lastDeckId'] === 'number'
            ? (prefs['editor.lastDeckId'] as number)
            : 0;
        const prefNt =
          typeof prefs['editor.lastNotetypeId'] === 'number'
            ? (prefs['editor.lastNotetypeId'] as number)
            : 0;

        const targetDeck =
          defaultDeckId ??
          (prefDeck && deckList.some((d) => anki.toNumber(d.id) === prefDeck)
            ? prefDeck
            : anki.toNumber(defaults.deckId));
        const targetNt =
          prefNt && ntNames.some((n) => anki.toNumber(n.id) === prefNt)
            ? prefNt
            : anki.toNumber(defaults.notetypeId);

        const [loadedNt, blankNote] = await Promise.all([
          anki.getNotetype(targetNt),
          anki.newNote(targetNt),
        ]);
        setSelectedDeckId(targetDeck || 1);
        setInitialDeckId(targetDeck || 1);
        setNotetype(loadedNt);
        setNote(blankNote);
        setFields(
          (loadedNt.fields ?? []).map((_, idx) => blankNote.fields?.[idx] ?? '')
        );
        setTags(blankNote.tags ?? []);
        applyStickyFromNotetype(loadedNt);
        setDirty(false);
      } else {
        const [loadedNote, cids] = await Promise.all([
          anki.getNote(noteId!),
          anki.cardsOfNote(noteId!),
        ]);
        const loadedNt = await anki.getNotetype(loadedNote.notetypeId);
        let deckForNote = 1;
        if (cids.length > 0) {
          const firstCard = await anki.getCard(cids[0]);
          deckForNote = anki.toNumber(firstCard.deckId) || 1;
        }
        setCardIdsOfEditedNote(cids);
        setSelectedDeckId(deckForNote);
        setInitialDeckId(deckForNote);
        setNotetype(loadedNt);
        setNote(loadedNote);
        setFields(
          (loadedNt.fields ?? []).map((_, idx) => loadedNote.fields?.[idx] ?? '')
        );
        setTags(loadedNote.tags ?? []);
        setDirty(false);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '노트 편집기를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAddMode, noteId, defaultDeckId, prefs, applyStickyFromNotetype]);

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, defaultDeckId]);

  const attemptGoBack = useCallback(() => {
    if (dirty) {
      setDiscardDialogOpen(true);
      return true;
    }
    goBack('#/decks');
    return true;
  }, [dirty, goBack]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (discardDialogOpen) {
        setDiscardDialogOpen(false);
        return true;
      }
      if (!isWide && showPreview) {
        setShowPreview(false);
        return true;
      }
      if (dirty) {
        setDiscardDialogOpen(true);
        return true;
      }
      return false;
    });
  }, [registerBackHandler, discardDialogOpen, isWide, showPreview, dirty]);

  const isClozeNotetype =
    notetype?.config?.kind === anki.NotetypeKind.KIND_CLOZE;

  const currentNotePayload = useMemo<AnkiTypes.notes.Note.$Properties>(() => {
    return {
      id: note?.id ?? 0,
      guid: note?.guid ?? '',
      notetypeId: notetype?.id ?? note?.notetypeId ?? 0,
      mtimeSecs: note?.mtimeSecs ?? 0,
      usn: note?.usn ?? 0,
      fields,
      tags,
    };
  }, [note, notetype, fields, tags]);

  // Live duplicate & cloze check (debounced 250ms)
  useEffect(() => {
    if (!notetype || fields.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [checkRes, clozeRes] = await Promise.all([
          anki.noteFieldsCheck(currentNotePayload),
          isClozeNotetype
            ? anki.clozeNumbersInNote(currentNotePayload).catch(() =>
                extractClozeNumsFallback(fields)
              )
            : Promise.resolve([] as number[]),
        ]);
        if (cancelled) return;
        setFieldCheckState(checkRes.state);
        if (isClozeNotetype) {
          setClozeNums(clozeRes);
        } else {
          setClozeNums([]);
        }
      } catch {
        if (!cancelled && isClozeNotetype) {
          setClozeNums(extractClozeNumsFallback(fields));
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentNotePayload, notetype, fields, isClozeNotetype]);

  // Live Card Preview rendering (debounced 200ms)
  useEffect(() => {
    if (!showPreview || !notetype || !notetype.templates?.length) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const tpl = isClozeNotetype
          ? notetype.templates[0]
          : notetype.templates[previewOrd] ?? notetype.templates[0];
        const cardOrd = isClozeNotetype
          ? Math.max(0, (clozeNums[previewOrd] ?? 1) - 1)
          : previewOrd;
        const res = await anki.renderUncommittedCard(
          currentNotePayload,
          cardOrd,
          tpl,
          true,
          false
        );
        if (!cancelled) {
          setRenderedPreview(res);
        }
      } catch {
        // Ignore transient render error while editing
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    showPreview,
    notetype,
    currentNotePayload,
    previewOrd,
    isClozeNotetype,
    clozeNums,
  ]);

  useEffect(() => {
    if (!renderedPreview || !frameRef.current) return;
    const qHtml = renderNodesToHtml(renderedPreview.questionNodes);
    const aHtml = renderNodesToHtml(renderedPreview.answerNodes);
    frameRef.current.render({
      side: previewSide,
      html: previewSide === 'question' ? qHtml : aHtml,
      preloadAnswerHtml: qHtml ? aHtml : undefined,
      css: (notetype?.config?.css ?? renderedPreview.css ?? '') as string,
      theme: resolvedTheme,
      tapToFlip: true,
    });
  }, [renderedPreview, previewSide, resolvedTheme, notetype?.config?.css]);

  const handleSelectDeck = (did: number) => {
    setSelectedDeckId(did);
    setDirty(true);
    if (isAddMode) {
      void setPref('editor.lastDeckId', did).catch(() => undefined);
    }
  };

  const handleSwitchNotetypeInAddMode = async (ntid: number) => {
    if (!isAddMode) return;
    try {
      const [loadedNt, blank] = await Promise.all([
        anki.getNotetype(ntid),
        anki.newNote(ntid),
      ]);
      setNotetype(loadedNt);
      setNote(blank);
      setFields((prev) =>
        (loadedNt.fields ?? []).map((_, idx) => prev[idx] ?? blank.fields?.[idx] ?? '')
      );
      setPreviewOrd(0);
      applyStickyFromNotetype(loadedNt);
      void setPref('editor.lastNotetypeId', ntid).catch(() => undefined);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 바꾸지 못했습니다.',
        'error'
      );
    }
  };

  const handleTogglePin = (idx: number) => {
    const nextVal = !pinnedFields[idx];
    setPinnedFields((prev) => ({ ...prev, [idx]: nextVal }));
    if (notetype) {
      const ntId = anki.toNumber(notetype.id);
      const ord = notetype.fields?.[idx]?.ord?.val ?? idx;
      void setPref(`editor.sticky.${ntId}.${ord}`, nextVal).catch(() => undefined);
    }
  };

  const handleInsertCloze = (sameNumber: boolean) => {
    const target = fieldRefs.current[focusedFieldIdx];
    if (!target) return;
    const nums = clozeNums.length > 0 ? clozeNums : extractClozeNumsFallback(fields);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    const nextNum = sameNumber ? Math.max(1, maxNum) : maxNum + 1;
    target.insertCloze(nextNum);
    setDirty(true);
  };

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const savedName = await anki.addMediaFile(file.name, data);
      fieldRefs.current[focusedFieldIdx]?.insertMediaHtml(`<img src="${savedName}">`);
      setDirty(true);
      showToast('이미지를 추가했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '이미지를 올리지 못했습니다.',
        'error'
      );
    }
  };

  const handleAudioPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const savedName = await anki.addMediaFile(file.name, data);
      fieldRefs.current[focusedFieldIdx]?.insertMediaHtml(`[sound:${savedName}]`);
      setDirty(true);
      showToast('오디오를 추가했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '오디오를 올리지 못했습니다.',
        'error'
      );
    }
  };

  const handleToggleRecord = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      audioInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const ext = (recorder.mimeType || '').includes('ogg') ? 'ogg' : 'webm';
        try {
          const data = new Uint8Array(await blob.arrayBuffer());
          const savedName = await anki.addMediaFile(`rec_${Date.now()}.${ext}`, data);
          fieldRefs.current[focusedFieldIdx]?.insertMediaHtml(`[sound:${savedName}]`);
          setDirty(true);
          showToast('녹음 파일을 추가했습니다.', 'success');
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : '녹음 저장에 실패했습니다.',
            'error'
          );
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast('마이크 권한을 사용할 수 없어 파일 선택기를 엽니다.');
      audioInputRef.current?.click();
    }
  };

  const handleSubmit = async () => {
    if (!notetype || saving) return;
    setSaving(true);
    try {
      if (isAddMode) {
        const res = await anki.addNote(currentNotePayload, selectedDeckId);
        const createdCount = res.changes?.count ?? 1;
        bumpCollection();
        showToast(
          `노트가 추가되었습니다 (카드 ${createdCount}장).`,
          'success'
        );

        const blank = await anki.newNote(notetype.id);
        setNote(blank);
        setFields((prev) =>
          (notetype.fields ?? []).map((_, idx) =>
            pinnedFields[idx] ? prev[idx] ?? '' : ''
          )
        );
        setDirty(false);
        setFocusedFieldIdx(0);
        window.setTimeout(() => fieldRefs.current[0]?.focus(), 30);
      } else {
        await anki.updateNotes([currentNotePayload], false);
        if (selectedDeckId !== initialDeckId && cardIdsOfEditedNote.length > 0) {
          await anki.setDeck(cardIdsOfEditedNote, selectedDeckId);
        }
        bumpCollection();
        setDirty(false);
        showToast('노트를 저장했습니다.', 'success');
        goBack('#/browse');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 저장하지 못했습니다.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const handleInsertClozeRef = useRef(handleInsertCloze);
  handleInsertClozeRef.current = handleInsertCloze;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmitRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleInsertClozeRef.current(e.altKey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenChangeNtInEdit = async () => {
    if (!notetype || !note) return;
    const currentId = anki.toNumber(notetype.id);
    const others = notetypeList.filter((n) => anki.toNumber(n.id) !== currentId);
    const nextId = others.length > 0 ? anki.toNumber(others[0].id) : currentId;
    try {
      const info = await anki.getChangeNotetypeInfo(currentId, nextId);
      setTargetNtId(nextId);
      setChangeNtInfo(info);
      setNtFieldMap(info.input?.newFields ?? []);
      setNtTemplateMap(info.input?.newTemplates ?? []);
      setChangeNtOpen(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형 정보를 불러오지 못했습니다.',
        'error'
      );
    }
  };

  const handleConfirmChangeNtInEdit = async () => {
    if (!changeNtInfo?.input || !note || !notetype) return;
    try {
      await anki.changeNotetype({
        noteIds: [note.id],
        newFields: ntFieldMap,
        newTemplates: ntTemplateMap,
        oldNotetypeId: notetype.id,
        newNotetypeId: targetNtId,
        currentSchema: changeNtInfo.input.currentSchema,
        oldNotetypeName: changeNtInfo.oldNotetypeName,
        isCloze: changeNtInfo.input.isCloze,
      });
      setChangeNtOpen(false);
      bumpCollection();
      showToast('노트 유형을 변경했습니다.', 'success');
      await loadInitial();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 변경하지 못했습니다.',
        'error'
      );
    }
  };

  const fieldCheckBanner = useMemo(() => {
    switch (fieldCheckState) {
      case anki.NoteFieldsState.DUPLICATE:
        return {
          text: '이미 같은 첫 번째 필드를 가진 노트가 있습니다.',
          canSearchDupes: true,
        };
      case anki.NoteFieldsState.EMPTY:
        return {
          text: '첫 번째 필드가 비어 있습니다.',
          canSearchDupes: false,
        };
      case anki.NoteFieldsState.MISSING_CLOZE:
        return {
          text: '빈칸(Cloze) 문법 {{c1::...}}이 없습니다. 카드가 생성되지 않습니다.',
          canSearchDupes: false,
        };
      case anki.NoteFieldsState.NOTETYPE_NOT_CLOZE:
        return {
          text: '일반 노트 유형에서는 빈칸 문법({{c1::...}})이 동작하지 않습니다.',
          canSearchDupes: false,
        };
      case anki.NoteFieldsState.FIELD_NOT_CLOZE:
        return {
          text: '빈칸 문법은 빈칸용 필드에서만 카드를 생성합니다.',
          canSearchDupes: false,
        };
      default:
        return null;
    }
  }, [fieldCheckState]);

  const previewTabs = useMemo(() => {
    if (!notetype) return [];
    if (isClozeNotetype) {
      const list = clozeNums.length > 0 ? clozeNums : [1];
      return list.map((n, idx) => ({ idx, label: `빈칸 ${n}` }));
    }
    return (notetype.templates ?? []).map((t, idx) => ({
      idx,
      label: t.name || `카드 ${idx + 1}`,
    }));
  }, [notetype, isClozeNotetype, clozeNums]);

  if (loading) {
    return (
      <div className="amgi-editor-root">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          편집기를 불러오는 중...
        </div>
      </div>
    );
  }

  if (loadError || !notetype) {
    return (
      <div className="amgi-editor-root" style={{ padding: 16 }}>
        <ErrorState
          title="편집기를 열 수 없습니다"
          message={loadError ?? '노트 유형 정보를 찾지 못했습니다.'}
          onRetry={() => void loadInitial()}
        />
      </div>
    );
  }

  const previewBody = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="amgi-editor-preview-bar">
        <div className="amgi-preview-side-tabs" role="tablist" aria-label="앞뒷면 전환">
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

        {previewTabs.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {previewTabs.map((tab) => (
              <button
                key={tab.idx}
                type="button"
                className={`amgi-chip ${previewOrd === tab.idx ? 'active' : ''}`}
                onClick={() => setPreviewOrd(tab.idx)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="amgi-preview-frame-box" style={{ flex: 1, minHeight: 280 }}>
        <CardFrame
          ref={frameRef}
          theme={resolvedTheme}
          title="노트 카드 미리보기"
          onCardTap={() =>
            setPreviewSide((s) => (s === 'question' ? 'answer' : 'question'))
          }
        />
      </div>
    </div>
  );

  return (
    <div className="amgi-editor-root" data-testid="note-editor-view">
      <header className="amgi-editor-topbar">
        <div className="amgi-editor-topbar-left">
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            aria-label="뒤로 가기"
            onClick={() => attemptGoBack()}
          >
            <IconArrowLeft size={20} />
          </button>
          <h1 className="amgi-topbar-title">
            {isAddMode ? '노트 추가' : '노트 편집'}
          </h1>
        </div>

        <div className="amgi-editor-topbar-right">
          <button
            type="button"
            className={`amgi-btn amgi-btn-secondary amgi-btn-sm ${
              showPreview ? 'active' : ''
            }`}
            onClick={() => setShowPreview((v) => !v)}
          >
            <IconEye size={16} />
            <span>미리보기</span>
          </button>
          <button
            type="button"
            disabled={saving}
            className="amgi-btn amgi-btn-primary amgi-btn-sm"
            onClick={() => void handleSubmit()}
          >
            <IconCheck size={16} />
            <span>{saving ? '처리 중...' : isAddMode ? '추가' : '저장'}</span>
          </button>
        </div>
      </header>

      <div
        className={`amgi-editor-workspace ${
          isWide && showPreview ? 'with-preview' : ''
        }`.trim()}
      >
        <div className="amgi-editor-form-pane">
          {/* Deck & NoteType Pickers */}
          <div className="amgi-editor-pickers">
            <div className="amgi-editor-picker-box">
              <label htmlFor="note-deck-select" className="amgi-editor-picker-label">
                덱
              </label>
              <select
                id="note-deck-select"
                className="amgi-select"
                value={selectedDeckId}
                onChange={(e) => handleSelectDeck(Number(e.target.value))}
              >
                {decks.map((d) => {
                  const id = anki.toNumber(d.id);
                  return (
                    <option key={id} value={id}>
                      {d.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="amgi-editor-picker-box">
              <label htmlFor="note-type-select" className="amgi-editor-picker-label">
                노트 유형
              </label>
              {isAddMode ? (
                <select
                  id="note-type-select"
                  className="amgi-select"
                  value={anki.toNumber(notetype.id)}
                  onChange={(e) =>
                    void handleSwitchNotetypeInAddMode(Number(e.target.value))
                  }
                >
                  {notetypeList.map((nt) => {
                    const id = anki.toNumber(nt.id);
                    return (
                      <option key={id} value={id}>
                        {nt.name}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="amgi-editor-nt-row">
                  <input
                    id="note-type-select"
                    type="text"
                    className="amgi-input"
                    readOnly
                    value={notetype.name}
                  />
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                    onClick={() => void handleOpenChangeNtInEdit()}
                  >
                    변경...
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Formatting Toolbar */}
          <div className="amgi-rich-toolbar-wrap">
            <div className="amgi-rich-toolbar" role="toolbar" aria-label="서식 도구 모음">
              <button
                type="button"
                className="amgi-rich-tool-btn"
                aria-label="굵게"
                title="굵게 (Ctrl+B)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  fieldRefs.current[focusedFieldIdx]?.execFormat('bold');
                  setDirty(true);
                }}
              >
                <strong>B</strong>
              </button>

              <button
                type="button"
                className="amgi-rich-tool-btn"
                aria-label="기울임"
                title="기울임 (Ctrl+I)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  fieldRefs.current[focusedFieldIdx]?.execFormat('italic');
                  setDirty(true);
                }}
              >
                <em>I</em>
              </button>

              <button
                type="button"
                className="amgi-rich-tool-btn"
                aria-label="밑줄"
                title="밑줄 (Ctrl+U)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  fieldRefs.current[focusedFieldIdx]?.execFormat('underline');
                  setDirty(true);
                }}
              >
                <u>U</u>
              </button>

              <button
                type="button"
                className="amgi-rich-tool-btn"
                aria-label="빈칸 추가 (새 번호)"
                title={
                  isClozeNotetype
                    ? '새 번호 빈칸 만들기 (Ctrl+Shift+C)'
                    : '빈칸 문법 {{c1::...}} 삽입 (빈칸 유형에서 동작)'
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsertCloze(false)}
              >
                <span>[...]</span>
              </button>

              <button
                type="button"
                className="amgi-rich-tool-btn"
                aria-label="이미지 첨부"
                title="이미지 첨부"
                onClick={() => imageInputRef.current?.click()}
              >
                <IconImage size={18} />
              </button>

              <button
                type="button"
                className={`amgi-rich-tool-btn ${moreToolsOpen || colorPaletteOpen || recording ? 'active' : ''}`}
                aria-label="서식 도구 더보기"
                aria-expanded={moreToolsOpen}
                title="색상 · 수식 · 오디오 · 추가 서식"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMoreToolsOpen((v) => !v)}
              >
                <span>{moreToolsOpen ? '접기' : '더보기'}</span>
              </button>
            </div>

            {moreToolsOpen && (
              <div className="amgi-rich-toolbar-extra" role="toolbar" aria-label="추가 서식 도구">
                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="취소선"
                  title="취소선"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('strikeThrough');
                    setDirty(true);
                  }}
                >
                  <s>S</s>
                </button>

                <button
                  type="button"
                  className={`amgi-rich-tool-btn ${colorPaletteOpen ? 'active' : ''}`}
                  aria-label="글자 색상"
                  title="글자 색상"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setColorPaletteOpen((v) => !v)}
                >
                  <span>가▾</span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="같은 번호 빈칸 추가"
                  title="같은 번호로 빈칸 추가 (Ctrl+Shift+Alt+C)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertCloze(true)}
                >
                  <span>[...+]</span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="위 첨자"
                  title="위 첨자"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('superscript');
                    setDirty(true);
                  }}
                >
                  <span>
                    x<sup>2</sup>
                  </span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="아래 첨자"
                  title="아래 첨자"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('subscript');
                    setDirty(true);
                  }}
                >
                  <span>
                    x<sub>2</sub>
                  </span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="글머리 기호 목록"
                  title="글머리 기호 목록"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('insertUnorderedList');
                    setDirty(true);
                  }}
                >
                  <span>• 목록</span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="수식 (MathJax)"
                  title="인라인 수식 \( ... \) 삽입"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.insertMathJax();
                    setDirty(true);
                  }}
                >
                  <span>∑</span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="서식 지우기"
                  title="선택 영역 서식 지우기"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('removeFormat');
                    setDirty(true);
                  }}
                >
                  <span>Tx</span>
                </button>

                <button
                  type="button"
                  className="amgi-rich-tool-btn"
                  aria-label="오디오 첨부"
                  title="오디오 파일 첨부"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <IconVolume size={18} />
                </button>

                <button
                  type="button"
                  className={`amgi-rich-tool-btn ${recording ? 'active' : ''}`}
                  aria-label={recording ? '녹음 중지' : '음성 녹음'}
                  title={recording ? '녹음 중지' : '음성 녹음'}
                  onClick={() => void handleToggleRecord()}
                >
                  <span>{recording ? '중지' : '녹음'}</span>
                </button>

                <button
                  type="button"
                  className={`amgi-rich-tool-btn ${
                    htmlModes[focusedFieldIdx] ? 'active' : ''
                  }`}
                  aria-label="HTML 소스 보기 전환"
                  title="HTML 소스 전환"
                  onClick={() =>
                    setHtmlModes((prev) => ({
                      ...prev,
                      [focusedFieldIdx]: !prev[focusedFieldIdx],
                    }))
                  }
                >
                  <IconCode size={17} />
                </button>
              </div>
            )}
          </div>

          {colorPaletteOpen && (
            <div className="amgi-color-palette">
              {COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="amgi-color-swatch"
                  style={{ background: hex }}
                  aria-label={`글자 색상 ${hex}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    fieldRefs.current[focusedFieldIdx]?.execFormat('foreColor', hex);
                    setColorPaletteOpen(false);
                    setDirty(true);
                  }}
                />
              ))}
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  fieldRefs.current[focusedFieldIdx]?.execFormat('foreColor', '');
                  setColorPaletteOpen(false);
                  setDirty(true);
                }}
              >
                색상 지우기
              </button>
            </div>
          )}

          {/* Hidden Media File Inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => void handleImagePick(e)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => void handleAudioPick(e)}
          />

          {/* Field Editors */}
          {(notetype.fields ?? []).map((f, idx) => (
            <div key={f.ord?.val ?? idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <RichFieldInput
                ref={(el) => {
                  fieldRefs.current[idx] = el;
                }}
                index={idx}
                label={f.name || `필드 ${idx + 1}`}
                value={fields[idx] ?? ''}
                htmlMode={Boolean(htmlModes[idx])}
                onToggleHtmlMode={() =>
                  setHtmlModes((prev) => ({ ...prev, [idx]: !prev[idx] }))
                }
                showPin={isAddMode}
                pinned={Boolean(pinnedFields[idx])}
                onTogglePin={() => handleTogglePin(idx)}
                focused={focusedFieldIdx === idx}
                rtl={Boolean(f.config?.rtl)}
                plainText={Boolean(f.config?.plainText)}
                fontSize={f.config?.fontSize ?? undefined}
                pasteStripsFormatting={pasteStrips}
                onFocus={() => setFocusedFieldIdx(idx)}
                onChange={(nextVal) => {
                  setFields((prev) => {
                    const copy = [...prev];
                    copy[idx] = nextVal;
                    return copy;
                  });
                  setDirty(true);
                }}
              />

              {idx === 0 && fieldCheckBanner && (
                <div className="amgi-field-check-banner" role="status">
                  <span>⚠ {fieldCheckBanner.text}</span>
                  {fieldCheckBanner.canSearchDupes && (
                    <button
                      type="button"
                      className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                      onClick={() => {
                        const firstPlain = (fields[0] ?? '')
                          .replace(/<[^>]+>/g, '')
                          .trim();
                        navigate(
                          `#/browse?q=${encodeURIComponent(`"${firstPlain}"`)}`
                        );
                      }}
                    >
                      브라우저에서 보기
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Tag Chip Input */}
          <TagChipInput
            tags={tags}
            onChange={(next) => {
              setTags(next);
              setDirty(true);
            }}
          />
        </div>

        {/* Wide Right Preview Pane */}
        {isWide && showPreview && (
          <aside className="amgi-editor-preview-pane" aria-label="카드 실시간 미리보기">
            {previewBody}
          </aside>
        )}
      </div>

      {/* Mobile Preview Sheet */}
      {!isWide && (
        <SheetOrDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          title="카드 미리보기"
          maxWidth={680}
        >
          <div style={{ height: 'min(62dvh, 460px)', display: 'flex', flexDirection: 'column' }}>
            {previewBody}
          </div>
        </SheetOrDialog>
      )}

      {/* Discard Unsaved Changes Confirm */}
      <SheetOrDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        title="수정 내용 확인"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setDiscardDialogOpen(false)}
            >
              계속 편집
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={() => {
                setDiscardDialogOpen(false);
                setDirty(false);
                goBack('#/decks');
              }}
            >
              버리고 나가기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          수정 중인 내용을 버릴까요?
        </p>
      </SheetOrDialog>

      {/* Change Notetype Sheet in Edit Mode */}
      <SheetOrDialog
        open={changeNtOpen}
        onClose={() => setChangeNtOpen(false)}
        title="노트 유형 변경"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setChangeNtOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleConfirmChangeNtInEdit()}
            >
              변경 적용
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-field">
            <span>새 노트 유형</span>
            <select
              className="amgi-select"
              value={targetNtId}
              onChange={async (e) => {
                const nextId = Number(e.target.value);
                setTargetNtId(nextId);
                try {
                  const info = await anki.getChangeNotetypeInfo(notetype.id, nextId);
                  setChangeNtInfo(info);
                  setNtFieldMap(info.input?.newFields ?? []);
                  setNtTemplateMap(info.input?.newTemplates ?? []);
                } catch {
                  // Ignore
                }
              }}
            >
              {notetypeList.map((n) => {
                const id = anki.toNumber(n.id);
                return (
                  <option key={id} value={id}>
                    {n.name}
                  </option>
                );
              })}
            </select>
          </label>
          {changeNtInfo && (
            <>
              {changeNtInfo.oldFieldNames.map((oldName, idx) => (
                <label key={`${oldName}-${idx}`} className="form-field">
                  <span>{oldName} →</span>
                  <select
                    className="amgi-select"
                    value={ntFieldMap[idx] ?? -1}
                    onChange={(e) => {
                      const copy = [...ntFieldMap];
                      copy[idx] = Number(e.target.value);
                      setNtFieldMap(copy);
                    }}
                  >
                    <option value={-1}>(버리기)</option>
                    {changeNtInfo.newFieldNames.map((nName, nIdx) => (
                      <option key={nIdx} value={nIdx}>
                        {nName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </>
          )}
        </div>
      </SheetOrDialog>
    </div>
  );
};
