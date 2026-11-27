import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import { CardFrame, type CardFrameHandle } from '../shared/CardFrame';
import { WhiteboardOverlay } from './WhiteboardOverlay';
import {
  ActionMenu,
  ErrorState,
  IconArrowLeft,
  IconDeck,
  IconEdit,
  IconEye,
  IconFlag,
  IconKeyboard,
  IconMore,
  IconPen,
  IconRedo,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpark,
  IconStar,
  IconTrash,
  IconUndo,
  IconVolume,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { CelebrationBadge } from '../decks/DeckBadge';
import './study.css';

export interface StudyViewProps {
  deckId: number;
}

interface PreparedCardData {
  cardId: number;
  rawFront: string;
  rawBack: string;
  css: string;
  qHtml: string;
  qAvTags: anki.ExtractAvTagsResponse['avTags'];
  aHtmlTemplate: string;
  aAvTags: anki.ExtractAvTagsResponse['avTags'];
  intervals: string[];
  note: anki.Note;
  notetype: anki.Notetype;
  deckConfig: anki.DeckConfig['config'] | null;
}

const FLAG_OPTIONS = [
  { flag: 0, label: '깃발 없음', shortcut: 'Ctrl+0' },
  { flag: 1, label: '빨강', shortcut: 'Ctrl+1' },
  { flag: 2, label: '주황', shortcut: 'Ctrl+2' },
  { flag: 3, label: '초록', shortcut: 'Ctrl+3' },
  { flag: 4, label: '파랑', shortcut: 'Ctrl+4' },
  { flag: 5, label: '분홍', shortcut: 'Ctrl+5' },
  { flag: 6, label: '청록', shortcut: 'Ctrl+6' },
  { flag: 7, label: '보라', shortcut: 'Ctrl+7' },
] as const;

const TYPEANS_REGEX = /\[\[type:(?:cloze:)?([^\]]+)\]\]/gi;
const PLAY_TAG_REGEX = /\[anki:play:(q|a):(\d+)\]/g;

function stripBidiIsolates(str: string): string {
  return str.replace(/[\u2066-\u2069]/g, '').trim();
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent ?? '').trim();
  }
  return html.replace(/<[^>]*>/g, '').trim();
}

function concatTemplateNodes(
  nodes: anki.RenderCardResponse['questionNodes'] | undefined
): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((n) => n.text ?? n.replacement?.currentText ?? '')
    .join('');
}

function replacePlayTags(html: string, hidePlayButtons: boolean): string {
  if (!html) return '';
  return html.replace(PLAY_TAG_REGEX, (_full, side: string, idx: string) => {
    if (hidePlayButtons) return '';
    return `<a class="replay-button soundLink tappable" href="#" data-myamgi-sound="${side}:${idx}" aria-label="오디오 재생"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/><path d="M26 20 L46 32 L26 44 Z"/></svg></a>`;
  });
}

function replaceFrontTypeInput(html: string): string {
  return html.replace(
    TYPEANS_REGEX,
    '<input id="typeans" type="text" class="tappable" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="정답을 입력하세요..." />'
  );
}

function formatDurationKo(millis: number): string {
  const totalSecs = Math.max(0, Math.round(millis / 1000));
  if (totalSecs < 60) return `${totalSecs}초`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}시간 ${remMins}분` : `${hours}시간`;
}

function formatWaitKo(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}시간 ${remM}분` : `${h}시간`;
}

function findCustomStudyDeckId(node: anki.DeckTreeNode): number | null {
  const name = node.name ?? '';
  if (node.level > 0 && node.filtered && (name.includes('맞춤') || name.includes('Custom'))) {
    return anki.toNumber(node.deckId);
  }
  for (const child of node.children ?? []) {
    const found = findCustomStudyDeckId(child as anki.DeckTreeNode);
    if (found !== null) return found;
  }
  return null;
}

export const StudyView: React.FC<StudyViewProps> = ({ deckId }) => {
  const {
    info,
    prefs,
    setPref,
    resolvedTheme,
    collectionVersion,
    bumpCollection,
    navigate,
    goBack,
    registerBackHandler,
    registerKeyHandler,
  } = useApp();
  const { showToast } = useToast();

  const cardFrameRef = useRef<CardFrameHandle | null>(null);
  const frameReadyRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const ttsActiveRef = useRef(false);
  const cardStartMsRef = useRef<number>(Date.now());
  const deckConfigCacheRef = useRef<Map<number, anki.DeckConfig['config'] | null>>(
    new Map()
  );
  const preparedCacheRef = useRef<Map<number, PreparedCardData>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deckName, setDeckName] = useState<string>('학습');
  const [ankiPrefs, setAnkiPrefs] = useState<anki.Preferences | null>(null);
  const [queued, setQueued] = useState<anki.QueuedCards | null>(null);
  const [prepared, setPrepared] = useState<PreparedCardData | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeFlag, setActiveFlag] = useState(0);
  const [isMarked, setIsMarked] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // Congrats state (when queue is empty)
  const [congratsData, setCongratsData] = useState<anki.CongratsInfoResponse | null>(
    null
  );
  const [todayStats, setTodayStats] = useState<{
    answerCount: number;
    answerMillis: number;
  }>({ answerCount: 0, answerMillis: 0 });

  // Sub-modals / pickers
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetRestorePos, setForgetRestorePos] = useState(true);
  const [forgetResetCounts, setForgetResetCounts] = useState(false);
  const [dueDialogOpen, setDueDialogOpen] = useState(false);
  const [dueDaysInput, setDueDaysInput] = useState('0');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCardCount, setDeleteCardCount] = useState(1);
  const [cardInfoId, setCardInfoId] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPreset, setCustomPreset] = useState<
    'newLimitDelta' | 'reviewLimitDelta' | 'forgotDays' | 'reviewAheadDays' | 'previewDays'
  >('newLimitDelta');
  const [customVal, setCustomVal] = useState(10);
  const [busyModal, setBusyModal] = useState(false);

  const twoButtonMode = useMemo(() => {
    const raw = prefs['study.twoButton'];
    if (typeof raw === 'boolean') return raw;
    if (typeof prefs['study.twoButtonMode'] === 'boolean') {
      return prefs['study.twoButtonMode'] as boolean;
    }
    return Boolean(info?.eink ?? true);
  }, [prefs, info?.eink]);

  const tapToFlip = prefs['study.tapToFlip'] === true;
  const leftHandedMode = prefs['study.leftHanded'] === true;
  const volumeKeysEnabled = useMemo(() => {
    if (typeof prefs['study.volumeKeys'] === 'boolean') {
      return prefs['study.volumeKeys'] as boolean;
    }
    return Boolean(info?.eink);
  }, [prefs, info?.eink]);

  const autoPlayAudio = prefs['study.autoPlayAudio'] !== false;
  const hanjaEnabled = prefs['study.hanjaTap'] !== false;
  const fontScale =
    typeof prefs['study.fontScale'] === 'number' ? (prefs['study.fontScale'] as number) : 1;
  const lineHeight =
    typeof prefs['study.lineHeight'] === 'number'
      ? (prefs['study.lineHeight'] as number)
      : 1.55;

  const stopAudio = useCallback(() => {
    audioAbortRef.current.aborted = true;
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.src = '';
      } catch {
        // Ignore audio stop errors
      }
      audioElRef.current = null;
    }
    if (ttsActiveRef.current) {
      ttsActiveRef.current = false;
      void host.host.platformTtsStop().catch(() => undefined);
    }
    setIsAudioPlaying(false);
  }, []);

  const playAvTagList = useCallback(
    async (tags: anki.ExtractAvTagsResponse['avTags']) => {
      stopAudio();
      if (!tags || tags.length === 0) return;

      const token = { aborted: false };
      audioAbortRef.current = token;
      setIsAudioPlaying(true);

      try {
        for (const tag of tags) {
          if (token.aborted) break;
          if (tag.soundOrVideo) {
            await new Promise<void>((resolve) => {
              const audio = new Audio(
                `/media/${encodeURIComponent(tag.soundOrVideo!)}`
              );
              audioElRef.current = audio;
              const done = () => {
                audio.onended = null;
                audio.onerror = null;
                resolve();
              };
              audio.onended = done;
              audio.onerror = done;
              void audio.play().catch(done);
            });
          } else if (tag.tts) {
            ttsActiveRef.current = true;
            try {
              await host.host.platformTts({
                text: tag.tts.fieldText ?? '',
                lang: tag.tts.lang ?? undefined,
                rate: tag.tts.speed || undefined,
              });
            } catch {
              // Ignore unsupported/failed TTS
            } finally {
              ttsActiveRef.current = false;
            }
          }
        }
      } finally {
        if (!token.aborted) {
          setIsAudioPlaying(false);
        }
      }
    },
    [stopAudio]
  );

  const getDeckConfigCached = useCallback(
    async (targetDeckId: number): Promise<anki.DeckConfig['config'] | null> => {
      if (deckConfigCacheRef.current.has(targetDeckId)) {
        return deckConfigCacheRef.current.get(targetDeckId) ?? null;
      }
      try {
        const res = await anki.getDeckConfigsForUpdate(targetDeckId);
        const cfgId = anki.toNumber(res.currentDeck?.configId);
        const match =
          res.allConfig?.find((c) => anki.toNumber(c.config?.id) === cfgId)?.config
            ?.config ??
          res.defaults?.config ??
          null;
        deckConfigCacheRef.current.set(targetDeckId, match);
        return match;
      } catch {
        deckConfigCacheRef.current.set(targetDeckId, null);
        return null;
      }
    },
    []
  );

  const prepareQueuedCard = useCallback(
    async (
      qCard: NonNullable<anki.QueuedCards['cards']>[number],
      hidePlayBtns: boolean
    ): Promise<PreparedCardData> => {
      const cid = anki.toNumber(qCard.card?.id);
      const cached = preparedCacheRef.current.get(cid);
      if (cached) return cached;

      const noteId = anki.toNumber(qCard.card?.noteId);
      const cardDeckId = anki.toNumber(qCard.card?.deckId) || deckId;

      const [rendered, note, deckConfig, intervalsRaw] = await Promise.all([
        anki.renderExistingCard(cid, false, false),
        anki.getNote(noteId),
        getDeckConfigCached(cardDeckId),
        qCard.states
          ? anki.describeNextStates(qCard.states).catch(() => [])
          : Promise.resolve([]),
      ]);

      const notetype = await anki.getNotetype(note.notetypeId);
      const rawFront = concatTemplateNodes(rendered.questionNodes);
      const rawBack = concatTemplateNodes(rendered.answerNodes);

      const [qAv, aAv] = await Promise.all([
        anki.extractAvTags(rawFront, true),
        anki.extractAvTags(rawBack, false),
      ]);

      const qHtml = replaceFrontTypeInput(
        replacePlayTags(qAv.text ?? '', hidePlayBtns)
      );
      const aHtmlTemplate = replacePlayTags(aAv.text ?? '', hidePlayBtns);
      const intervals = intervalsRaw.map(stripBidiIsolates);

      const result: PreparedCardData = {
        cardId: cid,
        rawFront,
        rawBack,
        css: rendered.css ?? '',
        qHtml,
        qAvTags: qAv.avTags ?? [],
        aHtmlTemplate,
        aAvTags: aAv.avTags ?? [],
        intervals,
        note,
        notetype,
        deckConfig,
      };
      preparedCacheRef.current.set(cid, result);
      return result;
    },
    [deckId, getDeckConfigCached]
  );

  const sendFrontToFrame = useCallback(
    (data: PreparedCardData) => {
      cardFrameRef.current?.render({
        side: 'question',
        html: data.qHtml,
        preloadAnswerHtml: data.aHtmlTemplate,
        css: data.css,
        theme: resolvedTheme,
        fontScale,
        lineHeight,
        tapToFlip,
        hanjaEnabled,
      });
    },
    [resolvedTheme, fontScale, lineHeight, tapToFlip, hanjaEnabled]
  );

  const loadQueueAndActiveCard = useCallback(
    async (preserveCurrentCache = false) => {
      if (!preserveCurrentCache) {
        preparedCacheRef.current.clear();
      }
      setError(null);
      try {
        await anki.setCurrentDeck(deckId);
        const fetchLimit = info?.eink ? 2 : 3;
        const [deckObj, prefsRes, qRes, undoRes] = await Promise.all([
          anki.getDeck(deckId),
          anki.getPreferences().catch(() => null),
          anki.getQueuedCards(fetchLimit, false),
          anki.undoStatus().catch(() => null),
        ]);

        const shortTitle = deckObj.name?.split('::').pop() || deckObj.name || '학습';
        setDeckName(shortTitle);
        setAnkiPrefs(prefsRes);
        setQueued(qRes);
        setCanUndo(Boolean(undoRes?.undo));
        setCanRedo(Boolean(undoRes?.redo));

        const cards = qRes.cards ?? [];
        if (cards.length === 0) {
          setPrepared(null);
          setShowAnswer(false);
          setActiveFlag(0);
          setIsMarked(false);
          const [cg, g] = await Promise.all([
            anki.congratsInfo().catch(() => null),
            anki
              .graphs(deckObj.name ? `deck:"${deckObj.name}"` : '', 1)
              .catch(() => null),
          ]);
          setCongratsData(cg);
          setTodayStats({
            answerCount: g?.today?.answerCount ?? 0,
            answerMillis: g?.today?.answerMillis ?? 0,
          });
          setLoading(false);
          return;
        }

        const hidePlayBtns = Boolean(prefsRes?.reviewing?.hideAudioPlayButtons);
        const firstCard = cards[0];
        const firstPrepared = await prepareQueuedCard(firstCard, hidePlayBtns);

        setPrepared(firstPrepared);
        setShowAnswer(false);
        setActiveFlag((firstCard.card?.flags ?? 0) & 0b111);
        setIsMarked((firstPrepared.note.tags ?? []).includes('marked'));
        cardStartMsRef.current = Date.now();
        setElapsedSecs(0);
        setLoading(false);

        // Send question immediately if iframe ready
        if (frameReadyRef.current) {
          sendFrontToFrame(firstPrepared);
        }

        // Auto-play front audio if allowed
        const deckDisableAutoplay = Boolean(firstPrepared.deckConfig?.disableAutoplay);
        if (autoPlayAudio && !deckDisableAutoplay && firstPrepared.qAvTags.length > 0) {
          void playAvTagList(firstPrepared.qAvTags);
        }

        // Background pre-render next 1-2 cards
        for (let i = 1; i < cards.length; i++) {
          void prepareQueuedCard(cards[i], hidePlayBtns).catch(() => undefined);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '학습 카드를 불러오지 못했습니다.'
        );
        setLoading(false);
      }
    },
    [
      deckId,
      info?.eink,
      prepareQueuedCard,
      sendFrontToFrame,
      autoPlayAudio,
      playAvTagList,
    ]
  );

  useEffect(() => {
    stopAudio();
    deckConfigCacheRef.current.clear();
    setLoading(true);
    void loadQueueAndActiveCard(false);
    return () => {
      stopAudio();
    };
  }, [deckId, collectionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render current card cleanly on return from note edit or deck options
  useEffect(() => {
    const onFocus = () => {
      const currentCardId = queued?.cards?.[0]?.card?.id;
      if (currentCardId !== undefined) {
        preparedCacheRef.current.delete(anki.toNumber(currentCardId));
        void loadQueueAndActiveCard(true);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [queued, loadQueueAndActiveCard]);

  // Card timer when deck config showTimer is enabled
  const activeCard = queued?.cards?.[0] ?? null;
  const showTimer = Boolean(prepared?.deckConfig?.showTimer);
  const stopTimerOnAnswer = Boolean(prepared?.deckConfig?.stopTimerOnAnswer);
  const capSecs = prepared?.deckConfig?.capAnswerTimeToSecs ?? 60;

  useEffect(() => {
    if (!activeCard || !showTimer) return;
    if (showAnswer && stopTimerOnAnswer) return;
    const id = window.setInterval(() => {
      const secs = Math.min(
        capSecs,
        Math.floor((Date.now() - cardStartMsRef.current) / 1000)
      );
      setElapsedSecs(secs);
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeCard, showTimer, showAnswer, stopTimerOnAnswer, capSecs]);

  const resolveTypeAnswerHtml = useCallback(
    async (data: PreparedCardData, typedAnswer: string): Promise<string> => {
      if (!TYPEANS_REGEX.test(data.aHtmlTemplate)) {
        TYPEANS_REGEX.lastIndex = 0;
        return data.aHtmlTemplate;
      }
      TYPEANS_REGEX.lastIndex = 0;

      const card = activeCard?.card;
      const fields = data.notetype.fields ?? [];
      const noteFields = data.note.fields ?? [];
      const rawMatches = Array.from(data.aHtmlTemplate.matchAll(TYPEANS_REGEX));
      let resultHtml = data.aHtmlTemplate;

      for (const m of rawMatches) {
        const fullMatch = m[0];
        const fieldName = m[1];
        const isCloze = fullMatch.toLowerCase().includes('[[type:cloze:');
        const fieldIdx = fields.findIndex(
          (f) => (f.name ?? '').toLowerCase() === fieldName.toLowerCase()
        );
        const rawFieldVal = fieldIdx >= 0 ? noteFields[fieldIdx] ?? '' : '';

        let expectedSource = rawFieldVal;
        if (isCloze && card) {
          try {
            expectedSource = await anki.extractClozeForTyping(
              rawFieldVal,
              (card.templateIdx ?? 0) + 1
            );
          } catch {
            expectedSource = rawFieldVal;
          }
        }
        const expectedPlain = stripHtmlTags(expectedSource);
        let diffHtml = '';
        try {
          diffHtml = await anki.compareAnswer(expectedPlain, typedAnswer, true);
        } catch {
          diffHtml = `<code id="typeans">${expectedPlain}</code>`;
        }
        resultHtml = resultHtml.replace(fullMatch, diffHtml);
      }

      return resultHtml;
    },
    [activeCard]
  );

  const handleShowAnswer = useCallback(
    async (explicitTyped?: string) => {
      if (!prepared || showAnswer) return;
      if (ankiPrefs?.reviewing?.interruptAudioWhenAnswering !== false) {
        stopAudio();
      }

      let typed = explicitTyped;
      if (typed === undefined && TYPEANS_REGEX.test(prepared.qHtml || prepared.rawFront)) {
        TYPEANS_REGEX.lastIndex = 0;
        typed = (await cardFrameRef.current?.getTypedAnswer()) ?? '';
      } else {
        TYPEANS_REGEX.lastIndex = 0;
      }

      const answerHtml = await resolveTypeAnswerHtml(prepared, typed ?? '');
      setShowAnswer(true);

      cardFrameRef.current?.render({
        side: 'answer',
        html: answerHtml,
        css: prepared.css,
        theme: resolvedTheme,
        fontScale,
        lineHeight,
        tapToFlip: false,
        hanjaEnabled,
      });

      const deckDisableAutoplay = Boolean(prepared.deckConfig?.disableAutoplay);
      if (autoPlayAudio && !deckDisableAutoplay && prepared.aAvTags.length > 0) {
        const skipQ = Boolean(prepared.deckConfig?.skipQuestionWhenReplayingAnswer);
        const tagsToPlay = skipQ
          ? prepared.aAvTags.filter(
              (t) =>
                !prepared.qAvTags.some(
                  (qt) => qt.soundOrVideo && qt.soundOrVideo === t.soundOrVideo
                )
            )
          : prepared.aAvTags;
        if (tagsToPlay.length > 0) {
          void playAvTagList(tagsToPlay);
        }
      }
    },
    [
      prepared,
      showAnswer,
      ankiPrefs,
      stopAudio,
      resolveTypeAnswerHtml,
      resolvedTheme,
      fontScale,
      lineHeight,
      hanjaEnabled,
      autoPlayAudio,
      playAvTagList,
    ]
  );

  const handleRate = useCallback(
    async (rating: anki.Rating) => {
      if (!activeCard || !activeCard.card || !activeCard.states || answering) return;
      setAnswering(true);
      stopAudio();
      try {
        const msTaken = Date.now() - cardStartMsRef.current;
        const cid = activeCard.card.id!;
        await anki.answerCard(cid, activeCard.states, rating, msTaken);
        preparedCacheRef.current.delete(anki.toNumber(cid));
        setSessionDone((c) => c + 1);
        await loadQueueAndActiveCard(true);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '답변을 저장하지 못했습니다.',
          'error'
        );
      } finally {
        setAnswering(false);
      }
    },
    [activeCard, answering, stopAudio, loadQueueAndActiveCard, showToast]
  );

  const handleUndo = useCallback(async () => {
    if (!canUndo || answering) return;
    stopAudio();
    setAnswering(true);
    try {
      await anki.undo();
      preparedCacheRef.current.clear();
      setSessionDone((c) => Math.max(0, c - 1));
      showToast('방금 한 작업을 되돌렸습니다.', 'info');
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '되돌릴 수 있는 작업이 없습니다.',
        'error'
      );
    } finally {
      setAnswering(false);
    }
  }, [canUndo, answering, stopAudio, loadQueueAndActiveCard, showToast]);

  const handleRedo = useCallback(async () => {
    if (!canRedo || answering) return;
    stopAudio();
    setAnswering(true);
    try {
      await anki.redo();
      preparedCacheRef.current.clear();
      showToast('작업을 다시 실행했습니다.', 'info');
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '다시 실행할 작업이 없습니다.',
        'error'
      );
    } finally {
      setAnswering(false);
    }
  }, [canRedo, answering, stopAudio, loadQueueAndActiveCard, showToast]);

  const undoToastAction = useMemo(
    () => ({
      label: '되돌리기',
      onClick: async () => {
        try {
          await anki.undo();
          preparedCacheRef.current.clear();
          await loadQueueAndActiveCard(false);
          showToast('작업을 되돌렸습니다.', 'info');
        } catch {
          showToast('되돌리지 못했습니다.', 'error');
        }
      },
    }),
    [loadQueueAndActiveCard, showToast]
  );

  const handleSetFlag = useCallback(
    async (flag: number) => {
      const cid = activeCard?.card?.id;
      if (cid == null) return;
      const nextFlag = activeFlag === flag && flag !== 0 ? 0 : flag;
      try {
        await anki.setFlag([cid], nextFlag);
        setActiveFlag(nextFlag);
        setFlagPickerOpen(false);
        const label = FLAG_OPTIONS.find((f) => f.flag === nextFlag)?.label ?? '깃발';
        showToast(
          nextFlag === 0 ? '깃발을 해제했습니다.' : `${label} 깃발을 표시했습니다.`,
          'info'
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '깃발을 바꾸지 못했습니다.',
          'error'
        );
      }
    },
    [activeCard, activeFlag, showToast]
  );

  const handleToggleMark = useCallback(async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null) return;
    try {
      if (isMarked) {
        await anki.removeNoteTags([nid], 'marked');
        setIsMarked(false);
        showToast('별표 표시를 해제했습니다.', 'info');
      } else {
        await anki.addNoteTags([nid], 'marked');
        setIsMarked(true);
        showToast('노트에 별표를 표시했습니다.', 'info');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '별표를 변경하지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, isMarked, showToast]);

  const handleReplayAudio = useCallback(() => {
    if (!prepared) return;
    const tags = showAnswer ? prepared.aAvTags : prepared.qAvTags;
    if (tags.length > 0) {
      void playAvTagList(tags);
    } else {
      showToast('이 카드에는 재생할 오디오가 없습니다.', 'info');
    }
  }, [prepared, showAnswer, playAvTagList, showToast]);

  const handleBuryCard = useCallback(async () => {
    const cid = activeCard?.card?.id;
    if (cid == null) return;
    stopAudio();
    try {
      await anki.buryOrSuspendCards([cid], [], anki.BuryOrSuspendMode.BURY_USER);
      showToast('이 카드를 내일까지 숨겼습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드를 숨기지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleBuryNote = useCallback(async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null) return;
    stopAudio();
    try {
      await anki.buryOrSuspendCards([], [nid], anki.BuryOrSuspendMode.BURY_USER);
      showToast('이 노트의 카드를 내일까지 숨겼습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 숨기지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleSuspendCard = useCallback(async () => {
    const cid = activeCard?.card?.id;
    if (cid == null) return;
    stopAudio();
    try {
      await anki.buryOrSuspendCards([cid], [], anki.BuryOrSuspendMode.SUSPEND);
      showToast('카드를 일시 중지했습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드를 일시 중지하지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleSuspendNote = useCallback(async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null) return;
    stopAudio();
    try {
      await anki.buryOrSuspendCards([], [nid], anki.BuryOrSuspendMode.SUSPEND);
      showToast('이 노트의 모든 카드를 일시 중지했습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 일시 중지하지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const openForgetDialog = async () => {
    try {
      const defs = await anki.scheduleCardsAsNewDefaults(1);
      setForgetRestorePos(defs.restorePosition ?? true);
      setForgetResetCounts(defs.resetCounts ?? false);
    } catch {
      setForgetRestorePos(true);
      setForgetResetCounts(false);
    }
    setForgetOpen(true);
  };

  const handleConfirmForget = async () => {
    const cid = activeCard?.card?.id;
    if (cid == null) return;
    setBusyModal(true);
    stopAudio();
    try {
      await anki.forgetCards([cid], forgetRestorePos, forgetResetCounts, true, 1);
      setForgetOpen(false);
      showToast('카드를 새 카드 상태로 되돌렸습니다.', 'success');
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드를 초기화하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const openSetDueDialog = async () => {
    try {
      const prev = await anki.getConfigString(
        anki.ConfigKeyString.SET_DUE_REVIEWER
      );
      setDueDaysInput(prev || '0');
    } catch {
      setDueDaysInput('0');
    }
    setDueDialogOpen(true);
  };

  const handleConfirmSetDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = activeCard?.card?.id;
    if (cid == null) return;
    const days = dueDaysInput.trim();
    if (!days) {
      showToast('날짜 값을 입력해 주세요.', 'error');
      return;
    }
    setBusyModal(true);
    stopAudio();
    try {
      await anki.setDueDate([cid], days, anki.ConfigKeyString.SET_DUE_REVIEWER);
      setDueDialogOpen(false);
      showToast('복습 날짜를 변경했습니다.', 'success');
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '복습 날짜를 바꾸지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  const openDeleteDialog = async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null) return;
    try {
      const cids = await anki.cardsOfNote(nid);
      setDeleteCardCount(Math.max(1, cids.length));
    } catch {
      setDeleteCardCount(1);
    }
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteNote = async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null) return;
    setBusyModal(true);
    stopAudio();
    try {
      await anki.removeNotes([nid], []);
      setDeleteConfirmOpen(false);
      showToast('노트를 삭제했습니다.', 'success');
      await loadQueueAndActiveCard(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  // Back handler for open study modals
  useEffect(() => {
    return registerBackHandler(() => {
      if (busyModal) return true;
      if (cardInfoId !== null) {
        setCardInfoId(null);
        return true;
      }
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return true;
      }
      if (dueDialogOpen) {
        setDueDialogOpen(false);
        return true;
      }
      if (forgetOpen) {
        setForgetOpen(false);
        return true;
      }
      if (customOpen) {
        setCustomOpen(false);
        return true;
      }
      if (overflowOpen) {
        setOverflowOpen(false);
        return true;
      }
      if (flagPickerOpen) {
        setFlagPickerOpen(false);
        return true;
      }
      stopAudio();
      return false;
    });
  }, [
    busyModal,
    cardInfoId,
    deleteConfirmOpen,
    dueDialogOpen,
    forgetOpen,
    customOpen,
    overflowOpen,
    flagPickerOpen,
    stopAudio,
    registerBackHandler,
  ]);

  // Unified action dispatcher for keyboard & Host SSE remote/volume keys
  const handleStudyKeyAction = useCallback(
    (keyRaw: string, opts: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => {
      const key = keyRaw.trim();
      const lower = key.toLowerCase();
      const hasCtrl = Boolean(opts.ctrl || opts.meta);
      const hasShift = Boolean(opts.shift);

      // Volume / Page remote keys
      if (
        lower === 'volumedown' ||
        lower === 'volume_down' ||
        lower === 'keycode_volume_down' ||
        lower === 'pagedown' ||
        lower === 'page_down' ||
        lower === 'keycode_page_down' ||
        lower === 'dpad_right' ||
        lower === 'keycode_dpad_right'
      ) {
        if (!volumeKeysEnabled && lower.includes('volume')) return false;
        if (!showAnswer) {
          void handleShowAnswer();
        } else {
          void handleRate(anki.Rating.GOOD);
        }
        return true;
      }

      if (
        lower === 'volumeup' ||
        lower === 'volume_up' ||
        lower === 'keycode_volume_up' ||
        lower === 'pageup' ||
        lower === 'page_up' ||
        lower === 'keycode_page_up' ||
        lower === 'dpad_left' ||
        lower === 'keycode_dpad_left'
      ) {
        if (!volumeKeysEnabled && lower.includes('volume')) return false;
        if (!showAnswer) {
          void handleShowAnswer();
        } else {
          void handleRate(anki.Rating.AGAIN);
        }
        return true;
      }

      if (lower === 'dpad_center' || lower === 'keycode_dpad_center') {
        if (!showAnswer) {
          void handleShowAnswer();
        } else {
          void handleRate(anki.Rating.GOOD);
        }
        return true;
      }

      if (hasCtrl && /^[0-7]$/.test(key)) {
        void handleSetFlag(Number(key));
        return true;
      }

      if (hasCtrl && lower === 'z' && hasShift) {
        void handleRedo();
        return true;
      }

      if (hasCtrl && lower === 'y') {
        void handleRedo();
        return true;
      }

      if (hasCtrl && lower === 'z') {
        void handleUndo();
        return true;
      }

      if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
        if (!showAnswer) {
          void handleShowAnswer();
        } else {
          void handleRate(anki.Rating.GOOD);
        }
        return true;
      }

      if (key === '1') {
        if (showAnswer) void handleRate(anki.Rating.AGAIN);
        return showAnswer;
      }

      if (key === '2') {
        if (!showAnswer) return false;
        void handleRate(twoButtonMode ? anki.Rating.GOOD : anki.Rating.HARD);
        return true;
      }

      if (key === '3') {
        if (!showAnswer || twoButtonMode) return twoButtonMode;
        void handleRate(anki.Rating.GOOD);
        return true;
      }

      if (key === '4') {
        if (!showAnswer || twoButtonMode) return twoButtonMode;
        void handleRate(anki.Rating.EASY);
        return true;
      }

      if (lower === 'u' && !hasCtrl) {
        void handleUndo();
        return true;
      }

      if (lower === 'b' && !hasCtrl) {
        setWhiteboardOpen((v) => !v);
        return true;
      }

      if (key === '?') {
        setShortcutsOpen((v) => !v);
        return true;
      }

      if (lower === 'e' && !hasCtrl) {
        const nid = activeCard?.card?.noteId;
        if (nid !== undefined) {
          stopAudio();
          navigate(`#/note/${anki.toNumber(nid)}?from=study`);
          return true;
        }
      }

      if (lower === 'r' && !hasCtrl) {
        handleReplayAudio();
        return true;
      }

      if (key === '*') {
        void handleToggleMark();
        return true;
      }

      if (key === '-') {
        void handleBuryCard();
        return true;
      }

      if (key === '=') {
        void handleBuryNote();
        return true;
      }

      if (key === '@') {
        void handleSuspendCard();
        return true;
      }

      if (key === '!') {
        void handleSuspendNote();
        return true;
      }

      if (lower === 'q' && !hasCtrl) {
        cardFrameRef.current?.hanjaKey('open');
        return true;
      }

      if (lower === 'w' && !hasCtrl) {
        cardFrameRef.current?.hanjaKey(hasShift ? 'prev' : 'next');
        return true;
      }

      return false;
    },
    [
      volumeKeysEnabled,
      showAnswer,
      twoButtonMode,
      activeCard,
      handleShowAnswer,
      handleRate,
      handleSetFlag,
      handleUndo,
      handleRedo,
      stopAudio,
      navigate,
      handleReplayAudio,
      handleToggleMark,
      handleBuryCard,
      handleBuryNote,
      handleSuspendCard,
      handleSuspendNote,
    ]
  );

  // Window keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (!activeCard) return;

      const handled = handleStudyKeyAction(e.key, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
      });
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCard, handleStudyKeyAction]);

  // Host SSE hardware key listener
  useEffect(() => {
    return registerKeyHandler((ev) => {
      if (document.querySelector('[role="dialog"]')) return false;
      const keyStr = ev.action || ev.key || '';
      if (!keyStr) return false;
      return handleStudyKeyAction(keyStr, { shift: ev.shift, ctrl: ev.ctrl });
    });
  }, [registerKeyHandler, handleStudyKeyAction]);

  const handlePlaySoundTag = useCallback(
    (tag: string) => {
      if (!prepared) return;
      // tag format "q:0" or "a:1" or filename
      const match = tag.match(/^(q|a):(\d+)$/);
      if (match) {
        const list = match[1] === 'q' ? prepared.qAvTags : prepared.aAvTags;
        const item = list[Number(match[2])];
        if (item) {
          void playAvTagList([item]);
          return;
        }
      }
      if (tag) {
        void playAvTagList([{ soundOrVideo: tag }]);
      }
    },
    [prepared, playAvTagList]
  );

  const handleBridgeCommand = useCallback(
    (cmd: string) => {
      if (cmd === 'ease1') void handleRate(anki.Rating.AGAIN);
      else if (cmd === 'ease2') void handleRate(anki.Rating.HARD);
      else if (cmd === 'ease3') void handleRate(anki.Rating.GOOD);
      else if (cmd === 'ease4') void handleRate(anki.Rating.EASY);
    },
    [handleRate]
  );

  const showRemainingCounts = ankiPrefs?.reviewing?.showRemainingDueCounts !== false;
  const showIntervals = ankiPrefs?.reviewing?.showIntervalsOnButtons !== false;
  const activeQueue = activeCard?.queue ?? -1;
  const currentSideAvTags = prepared
    ? showAnswer
      ? prepared.aAvTags
      : prepared.qAvTags
    : [];

  const intervals = prepared?.intervals ?? ['', '', '', ''];

  return (
    <div className="amgi-study-screen">
      {/* Slim 48px (46px E-Ink) Top Bar */}
      <header className="amgi-study-topbar">
        <button
          type="button"
          className="amgi-study-top-btn amgi-btn-icon"
          aria-label="뒤로 가기"
          onClick={() => {
            stopAudio();
            goBack('#/decks');
          }}
        >
          <IconArrowLeft size={20} />
        </button>

        <div className="amgi-study-title-group">
          <div className="amgi-study-deck-name">{deckName}</div>
          {queued && showRemainingCounts && (queued.cards?.length ?? 0) > 0 && (
            <div className="amgi-study-counts tabular" aria-label="남은 카드 수">
              <span
                className={`amgi-study-q-num amgi-study-q-new ${
                  activeQueue === 0 ? 'amgi-study-q-active' : ''
                }`}
              >
                {queued.newCount ?? 0}
              </span>
              <span
                className={`amgi-study-q-num amgi-study-q-learn ${
                  activeQueue === 1 ? 'amgi-study-q-active' : ''
                }`}
              >
                {queued.learningCount ?? 0}
              </span>
              <span
                className={`amgi-study-q-num amgi-study-q-review ${
                  activeQueue === 2 ? 'amgi-study-q-active' : ''
                }`}
              >
                {queued.reviewCount ?? 0}
              </span>
            </div>
          )}
        </div>

        <div className="amgi-study-actions">
          <button
            type="button"
            className="amgi-study-top-btn amgi-btn-icon"
            aria-label="되돌리기"
            title="되돌리기 (Ctrl+Z)"
            disabled={!canUndo || answering}
            onClick={() => void handleUndo()}
          >
            <IconUndo size={19} />
          </button>

          {activeCard && (
            <>
              <button
                type="button"
                className={`amgi-study-top-btn amgi-btn-icon ${whiteboardOpen ? 'is-active' : ''}`}
                aria-label={whiteboardOpen ? '필기장 끄기' : '필기장 켜기'}
                title="필기장 (B)"
                onClick={() => setWhiteboardOpen((v) => !v)}
              >
                <IconPen size={18} />
              </button>

              <button
                type="button"
                className="amgi-study-top-btn amgi-btn-icon"
                aria-label="깃발 지정"
                onClick={() => setFlagPickerOpen(true)}
              >
                {activeFlag > 0 && resolvedTheme === 'eink' ? (
                  <span className="amgi-flag-badge">{activeFlag}</span>
                ) : (
                  <IconFlag
                    size={19}
                    style={
                      activeFlag > 0
                        ? { color: `var(--flag-${activeFlag})`, fill: `var(--flag-${activeFlag})` }
                        : undefined
                    }
                  />
                )}
              </button>

              <button
                type="button"
                className="amgi-study-top-btn amgi-btn-icon"
                aria-label="학습 메뉴"
                onClick={() => setOverflowOpen(true)}
              >
                <IconMore size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Session Progress Bar */}
      {activeCard && queued && (
        <div
          className="amgi-study-progress-track"
          aria-hidden="true"
        >
          <div
            className="amgi-study-progress-fill"
            style={{
              width: `${(() => {
                const remaining =
                  (queued.newCount ?? 0) +
                  (queued.learningCount ?? 0) +
                  (queued.reviewCount ?? 0);
                const total = sessionDone + remaining;
                if (total <= 0) return 0;
                return Math.min(100, Math.max(sessionDone > 0 ? 4 : 0, Math.round((sessionDone / total) * 100)));
              })()}%`,
            }}
          />
        </div>
      )}

      {/* Flag Accent Stripe */}
      {activeCard && activeFlag > 0 && (
        <div
          className={`amgi-study-flag-stripe amgi-study-flag-stripe-${activeFlag}`}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area: Loading / Error / Congrats / Card Stage */}
      {loading ? (
        <div className="amgi-study-loading-box">
          <strong>카드를 불러오는 중입니다...</strong>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>잠시만 기다려 주세요.</span>
        </div>
      ) : error ? (
        <div className="amgi-study-congrats-wrap">
          <div style={{ width: '100%', maxWidth: 480 }}>
            <ErrorState
              title="학습 화면을 불러오지 못했습니다"
              message={error}
              onRetry={() => {
                setLoading(true);
                void loadQueueAndActiveCard(false);
              }}
            />
          </div>
        </div>
      ) : !activeCard || !prepared ? (
        <div className="amgi-study-congrats-wrap">
          <div className="amgi-study-congrats-card">
            <CelebrationBadge size={44} />
            <h2 className="amgi-study-congrats-title">오늘 학습을 모두 마쳤습니다!</h2>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{deckName}</div>

            {todayStats.answerCount > 0 && (
              <div className="amgi-study-congrats-stats tabular">
                오늘 {todayStats.answerCount.toLocaleString()}장 학습 ·{' '}
                {formatDurationKo(todayStats.answerMillis)}
              </div>
            )}

            {congratsData && congratsData.secsUntilNextLearn > 0 && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>
                다음 학습 카드가 {formatWaitKo(congratsData.secsUntilNextLearn)} 뒤에 열립니다.
              </p>
            )}

            {(congratsData?.haveSchedBuried || congratsData?.haveUserBuried) && (
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                onClick={() => {
                  void anki
                    .unburyDeck(deckId, anki.UnburyDeckMode.ALL)
                    .then(() => loadQueueAndActiveCard(false))
                    .catch((err) =>
                      showToast(
                        err instanceof Error ? err.message : '숨긴 카드를 불러오지 못했습니다.',
                        'error'
                      )
                    );
                }}
              >
                미룬 카드 다시 보기
              </button>
            )}

            <div className="amgi-study-congrats-actions">
              <button
                type="button"
                className="amgi-btn amgi-btn-primary"
                onClick={() => navigate('#/decks')}
              >
                <IconDeck size={18} />
                <span>덱 목록으로</span>
              </button>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => setCustomOpen(true)}
              >
                <IconSpark size={18} />
                <span>맞춤 학습</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <main className="amgi-study-stage">
            <div className="amgi-study-card-shell">
              {(currentSideAvTags.length > 0 || isMarked || showTimer) && (
                <div className="amgi-study-stage-overlay">
                  <div className="amgi-study-overlay-left">
                    {currentSideAvTags.length > 0 && (
                      <button
                        type="button"
                        className="amgi-audio-pill compact"
                        onClick={handleReplayAudio}
                      >
                        <IconVolume size={16} />
                        <span>{isAudioPlaying ? '재생 중' : '다시 듣기'}</span>
                      </button>
                    )}
                  </div>
                  <div className="amgi-study-overlay-right">
                    {showTimer && (
                      <span className="amgi-timer-pill tabular">{elapsedSecs}초</span>
                    )}
                    {isMarked && (
                      <span className="amgi-mark-pill" aria-label="별표 표시됨">
                        ★
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="amgi-study-frame-wrap">
                <CardFrame
                  ref={cardFrameRef}
                  theme={resolvedTheme}
                  fontScale={fontScale}
                  lineHeight={lineHeight}
                  tapToFlip={!showAnswer && tapToFlip}
                  hanjaEnabled={hanjaEnabled}
                  onFrameReady={() => {
                    frameReadyRef.current = true;
                    if (prepared && !showAnswer) {
                      sendFrontToFrame(prepared);
                    }
                  }}
                  onCardTap={() => {
                    if (!showAnswer && tapToFlip) {
                      void handleShowAnswer();
                    }
                  }}
                  onPlaySound={handlePlaySoundTag}
                  onTypeAnsSubmit={(val) => {
                    if (!showAnswer) {
                      void handleShowAnswer(val);
                    }
                  }}
                  onHanjaLookup={(text, sentence) => {
                    void host.host
                      .hanjaLookup({ text, sentence })
                      .catch(() => undefined);
                  }}
                  onBridgeCommand={handleBridgeCommand}
                />
              </div>

              <WhiteboardOverlay
                open={whiteboardOpen}
                cardKey={prepared.cardId}
                theme={resolvedTheme}
                onClose={() => setWhiteboardOpen(false)}
              />
            </div>
            <div className="amgi-study-card-stack-peek" aria-hidden="true" />
          </main>

          {/* Bottom Answer Bar */}
          <footer className="amgi-answer-bar">
            <div className="amgi-answer-bar-inner">
              {!showAnswer ? (
                <button
                  type="button"
                  className="amgi-btn amgi-btn-primary amgi-show-answer-btn"
                  onClick={() => void handleShowAnswer()}
                >
                  <span>정답 보기</span>
                </button>
              ) : twoButtonMode ? (
                <div
                  className={`amgi-rate-grid-2 ${leftHandedMode ? 'is-left-handed' : ''}`}
                >
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-again"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.AGAIN)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">1</span>
                    {showIntervals && intervals[0] && (
                      <span className="amgi-rate-ivl tabular">{intervals[0]}</span>
                    )}
                    <span className="amgi-rate-label">모름</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-good"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.GOOD)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">2</span>
                    {showIntervals && intervals[2] && (
                      <span className="amgi-rate-ivl tabular">{intervals[2]}</span>
                    )}
                    <span className="amgi-rate-label">암기 완료</span>
                  </button>
                </div>
              ) : (
                <div className="amgi-rate-grid-4">
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-again"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.AGAIN)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">1</span>
                    {showIntervals && intervals[0] && (
                      <span className="amgi-rate-ivl tabular">{intervals[0]}</span>
                    )}
                    <span className="amgi-rate-label">다시</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-hard"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.HARD)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">2</span>
                    {showIntervals && intervals[1] && (
                      <span className="amgi-rate-ivl tabular">{intervals[1]}</span>
                    )}
                    <span className="amgi-rate-label">어려움</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-good"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.GOOD)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">3</span>
                    {showIntervals && intervals[2] && (
                      <span className="amgi-rate-ivl tabular">{intervals[2]}</span>
                    )}
                    <span className="amgi-rate-label">알맞음</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-easy"
                    disabled={answering}
                    onClick={() => void handleRate(anki.Rating.EASY)}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">4</span>
                    {showIntervals && intervals[3] && (
                      <span className="amgi-rate-ivl tabular">{intervals[3]}</span>
                    )}
                    <span className="amgi-rate-label">쉬움</span>
                  </button>
                </div>
              )}
            </div>
          </footer>
        </>
      )}

      {/* Flag Picker Sheet */}
      <SheetOrDialog
        open={flagPickerOpen}
        onClose={() => setFlagPickerOpen(false)}
        title="깃발 선택"
      >
        <div className="amgi-flag-list">
          {FLAG_OPTIONS.map((opt) => (
            <button
              key={opt.flag}
              type="button"
              className={`amgi-flag-option ${activeFlag === opt.flag ? 'active' : ''}`}
              onClick={() => void handleSetFlag(opt.flag)}
            >
              <span className="amgi-flag-option-left">
                {opt.flag === 0 ? (
                  <IconFlag size={18} />
                ) : (
                  <span className={`amgi-flag-badge amgi-flag-${opt.flag}`}>
                    {opt.flag}
                  </span>
                )}
                <span>{opt.label}</span>
              </span>
              <span className="amgi-flag-shortcut">{opt.shortcut}</span>
            </button>
          ))}
        </div>
      </SheetOrDialog>

      {/* Overflow Menu (Anki Complete Study Actions) */}
      <ActionMenu
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        title="학습 도구"
        subtitle={deckName}
        items={[
          ...(canRedo
            ? [
                {
                  id: 'redo',
                  label: '다시 실행',
                  description: '방금 되돌린 작업을 다시 적용합니다 (Ctrl+Shift+Z)',
                  icon: <IconRedo size={18} />,
                  onSelect: () => void handleRedo(),
                },
              ]
            : []),
          {
            id: 'edit-note',
            label: '노트 편집',
            icon: <IconEdit size={18} />,
            onSelect: () => {
              const nid = activeCard?.card?.noteId;
              if (nid !== undefined) {
                stopAudio();
                navigate(`#/note/${anki.toNumber(nid)}?from=study`);
              }
            },
          },
          {
            id: 'toggle-whiteboard',
            label: whiteboardOpen ? '필기장 끄기' : '필기장 켜기 (S펜·손글씨)',
            description: '화면 위에 직접 써보며 한자·단어를 연습합니다 (B)',
            icon: <IconPen size={18} />,
            onSelect: () => setWhiteboardOpen((v) => !v),
          },
          {
            id: 'toggle-mark',
            label: isMarked ? '표시 해제 (별표)' : '표시(별표)',
            icon: <IconStar size={18} />,
            onSelect: () => void handleToggleMark(),
          },
          {
            id: 'bury-card',
            label: '카드 숨기기',
            description: '내일까지 이 카드를 건너뜁니다 (-)',
            icon: <IconEye size={18} />,
            onSelect: () => void handleBuryCard(),
          },
          {
            id: 'bury-note',
            label: '노트 숨기기',
            description: '같은 노트의 다른 카드도 내일까지 숨깁니다 (=)',
            icon: <IconEye size={18} />,
            onSelect: () => void handleBuryNote(),
          },
          {
            id: 'suspend-card',
            label: '카드 일시 중지',
            description: '직접 풀기 전까지 이 카드가 나오지 않습니다 (@)',
            icon: <IconRefresh size={18} />,
            onSelect: () => void handleSuspendCard(),
          },
          {
            id: 'suspend-note',
            label: '노트 전체 일시 중지',
            description: '이 노트에 속한 모든 카드를 일시 중지합니다 (!)',
            icon: <IconRefresh size={18} />,
            onSelect: () => void handleSuspendNote(),
          },
          {
            id: 'forget-card',
            label: '처음부터 다시',
            description: '이 카드를 새 카드 상태로 초기화합니다',
            icon: <IconRefresh size={18} />,
            onSelect: () => void openForgetDialog(),
          },
          {
            id: 'set-due',
            label: '복습 날짜 지정',
            icon: <IconDeck size={18} />,
            onSelect: () => void openSetDueDialog(),
          },
          {
            id: 'card-info',
            label: '카드 정보',
            icon: <IconSearch size={18} />,
            onSelect: () => {
              const cid = activeCard?.card?.id;
              if (cid !== undefined) setCardInfoId(anki.toNumber(cid));
            },
          },
          {
            id: 'replay-audio',
            label: '오디오 다시 재생',
            icon: <IconVolume size={18} />,
            onSelect: () => handleReplayAudio(),
          },
          {
            id: 'toggle-two-button',
            label: twoButtonMode ? '4버튼 모드로 전환' : '2버튼 모드로 전환',
            description: twoButtonMode
              ? '다시 · 어려움 · 알맞음 · 쉬움 4개 버튼 사용'
              : '모름 · 암기 완료 2개 버튼만 사용',
            icon: <IconSettings size={18} />,
            onSelect: () => {
              void setPref('study.twoButton', !twoButtonMode);
            },
          },
          {
            id: 'deck-options',
            label: '덱 설정',
            icon: <IconSettings size={18} />,
            onSelect: () => {
              const targetDid = activeCard?.card?.deckId
                ? anki.toNumber(activeCard.card.deckId)
                : deckId;
              stopAudio();
              navigate(`#/deck-options/${targetDid}`);
            },
          },
          {
            id: 'shortcuts-help',
            label: '키보드 단축키 안내',
            icon: <IconKeyboard size={18} />,
            onSelect: () => setShortcutsOpen(true),
          },
          {
            id: 'delete-note',
            label: '노트 삭제',
            icon: <IconTrash size={18} />,
            destructive: true,
            onSelect: () => void openDeleteDialog(),
          },
        ]}
      />

      {/* Keyboard Shortcuts Guide Sheet */}
      <SheetOrDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="학습 키보드 단축키"
        subtitle="Anki 표준 단축키를 그대로 사용할 수 있습니다"
      >
        <div className="amgi-shortcut-grid">
          {[
            ['정답 보기 / 알맞음', 'Space / Enter'],
            ['다시 · 어려움 · 알맞음 · 쉬움', '1 · 2 · 3 · 4'],
            ['되돌리기 / 다시 실행', 'Ctrl+Z / Ctrl+Shift+Z'],
            ['필기장 (화이트보드) 켜기/끄기', 'B'],
            ['노트 편집', 'E'],
            ['오디오 다시 재생', 'R'],
            ['별표 표시 토글', '*'],
            ['카드 숨기기 / 노트 숨기기', '- / ='],
            ['카드 일시 중지 / 노트 일시 중지', '@ / !'],
            ['깃발 1~7 / 해제', 'Ctrl+1~7 / Ctrl+0'],
            ['한자 조회 / 다음·이전 한자', 'Q / W · Shift+W'],
          ].map(([label, keys]) => (
            <div key={label} className="amgi-shortcut-row">
              <span>{label}</span>
              <span className="amgi-kbd">{keys}</span>
            </div>
          ))}
        </div>
      </SheetOrDialog>

      {/* Forget Card Modal */}
      <SheetOrDialog
        open={forgetOpen}
        onClose={() => {
          if (!busyModal) setForgetOpen(false);
        }}
        title="처음부터 다시 (새 카드로 되돌리기)"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setForgetOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
              onClick={() => void handleConfirmForget()}
            >
              {busyModal ? '적용 중...' : '처음부터 다시'}
            </button>
          </>
        }
      >
        <div className="amgi-modal-form">
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">원래 위치로 복원</div>
              <div className="amgi-field-hint">새 카드 대기열의 기존 순서를 유지합니다</div>
            </div>
            <Switch
              checked={forgetRestorePos}
              onChange={setForgetRestorePos}
              aria-label="원래 위치로 복원"
            />
          </div>
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">복습·실패 횟수 초기화</div>
              <div className="amgi-field-hint">누적 복습 기록 횟수를 0으로 초기화합니다</div>
            </div>
            <Switch
              checked={forgetResetCounts}
              onChange={setForgetResetCounts}
              aria-label="복습·실패 횟수 초기화"
            />
          </div>
        </div>
      </SheetOrDialog>

      {/* Set Due Date Modal */}
      <SheetOrDialog
        open={dueDialogOpen}
        onClose={() => {
          if (!busyModal) setDueDialogOpen(false);
        }}
        title="복습 날짜 지정"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setDueDialogOpen(false)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-set-due-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
            >
              {busyModal ? '저장 중...' : '적용'}
            </button>
          </>
        }
      >
        <form
          id="amgi-set-due-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleConfirmSetDue(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="set-due-days-input">
              며칠 뒤로 지정할까요?
            </label>
            <input
              id="set-due-days-input"
              type="text"
              className="amgi-input tabular"
              autoFocus
              value={dueDaysInput}
              onChange={(e) => setDueDaysInput(e.target.value)}
              placeholder="예: 0 (오늘), 3 (3일 뒤), 1-7 (무작위), 7! (간격 재설정)"
            />
            <span className="amgi-field-hint">
              <code>0</code>=오늘, <code>3</code>=3일 뒤, <code>1-7</code>=1~7일 사이 무작위,{' '}
              <code>7!</code>=간격도 7일로 재설정
            </span>
          </div>
        </form>
      </SheetOrDialog>

      {/* Delete Note Confirm Modal */}
      <SheetOrDialog
        open={deleteConfirmOpen}
        onClose={() => {
          if (!busyModal) setDeleteConfirmOpen(false);
        }}
        title="노트 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={busyModal}
              onClick={() => void handleConfirmDeleteNote()}
            >
              {busyModal ? '삭제 중...' : '삭제'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          이 노트(카드 <strong className="tabular">{deleteCardCount}장</strong>)를 삭제할까요?
          되돌리기(Ctrl+Z)로 복구할 수 있습니다.
        </p>
      </SheetOrDialog>

      {/* Card Info Modal */}
      <SheetOrDialog
        open={cardInfoId !== null}
        onClose={() => setCardInfoId(null)}
        title="카드 정보"
        maxWidth={640}
      >
        {cardInfoId !== null && (
          <iframe
            className="amgi-cardinfo-frame"
            title="카드 정보"
            src={`/card-info/${cardInfoId}?theme=${encodeURIComponent(resolvedTheme)}`}
          />
        )}
      </SheetOrDialog>

      {/* Custom Study Modal from Congrats Screen */}
      <SheetOrDialog
        open={customOpen}
        onClose={() => {
          if (!busyModal) setCustomOpen(false);
        }}
        title="맞춤 학습"
        subtitle={deckName}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busyModal}
              onClick={() => setCustomOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busyModal}
              onClick={() => {
                setBusyModal(true);
                const val = Math.max(1, customVal);
                const req: Parameters<typeof anki.customStudy>[0] =
                  customPreset === 'newLimitDelta'
                    ? { deckId, newLimitDelta: val }
                    : customPreset === 'reviewLimitDelta'
                      ? { deckId, reviewLimitDelta: val }
                      : customPreset === 'forgotDays'
                        ? { deckId, forgotDays: val }
                        : customPreset === 'reviewAheadDays'
                          ? { deckId, reviewAheadDays: val }
                          : { deckId, previewDays: val };

                void anki
                  .customStudy(req)
                  .then(async () => {
                    setCustomOpen(false);
                    bumpCollection();
                    if (
                      customPreset === 'newLimitDelta' ||
                      customPreset === 'reviewLimitDelta'
                    ) {
                      await loadQueueAndActiveCard(false);
                    } else {
                      const tree = await anki.deckTree();
                      const filteredId = findCustomStudyDeckId(tree);
                      if (filteredId) {
                        navigate(`#/study/${filteredId}`);
                      } else {
                        await loadQueueAndActiveCard(false);
                      }
                    }
                  })
                  .catch((err) =>
                    showToast(
                      err instanceof Error ? err.message : '맞춤 학습을 시작하지 못했습니다.',
                      'error'
                    )
                  )
                  .finally(() => setBusyModal(false));
              }}
            >
              {busyModal ? '준비 중...' : '맞춤 학습 시작'}
            </button>
          </>
        }
      >
        <div className="amgi-modal-form">
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'newLimitDelta' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('newLimitDelta');
              setCustomVal(10);
            }}
          >
            <span className="amgi-radio-card-title">오늘 새 카드 더 공부하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'reviewLimitDelta' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('reviewLimitDelta');
              setCustomVal(20);
            }}
          >
            <span className="amgi-radio-card-title">오늘 복습 카드 더 공부하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'forgotDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('forgotDays');
              setCustomVal(1);
            }}
          >
            <span className="amgi-radio-card-title">최근 틀린 카드 다시 보기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'reviewAheadDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('reviewAheadDays');
              setCustomVal(1);
            }}
          >
            <span className="amgi-radio-card-title">미리 복습하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'previewDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('previewDays');
              setCustomVal(1);
            }}
          >
            <span className="amgi-radio-card-title">최근 새 카드 미리 보기</span>
          </button>

          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="study-cs-val">
              {customPreset === 'newLimitDelta' || customPreset === 'reviewLimitDelta'
                ? '추가할 카드 수'
                : '일수 (일)'}
            </label>
            <input
              id="study-cs-val"
              type="number"
              min={1}
              max={9999}
              className="amgi-input tabular"
              value={customVal}
              onChange={(e) => setCustomVal(Number(e.target.value) || 1)}
            />
          </div>
        </div>
      </SheetOrDialog>
    </div>
  );
};

export default StudyView;
