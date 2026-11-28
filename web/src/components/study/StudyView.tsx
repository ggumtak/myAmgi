import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  CardFrame,
  type CardFrameHandle,
  type CardFrameKeyEvent,
} from '../shared/CardFrame';
import { WhiteboardOverlay } from './WhiteboardOverlay';
import { resolveStudyKeyAction } from './studyKeys';
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
import { closeTopOverlay, hasBlockingOverlay, openOverlayCount } from '../../ui/overlayStack';
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

type UndoActionKind = 'rate' | 'other';

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

function hasTypeAnsToken(raw: string): boolean {
  TYPEANS_REGEX.lastIndex = 0;
  const matched = TYPEANS_REGEX.test(raw);
  TYPEANS_REGEX.lastIndex = 0;
  return matched;
}

function hasMarkedTag(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => t.toLowerCase() === 'marked');
}

function isSameAvTag(
  a: anki.ExtractAvTagsResponse['avTags'][number],
  b: anki.ExtractAvTagsResponse['avTags'][number]
): boolean {
  if (a.soundOrVideo && b.soundOrVideo) {
    return a.soundOrVideo === b.soundOrVideo;
  }
  if (a.tts && b.tts) {
    return (
      (a.tts.fieldText ?? '') === (b.tts.fieldText ?? '') &&
      (a.tts.lang ?? '') === (b.tts.lang ?? '')
    );
  }
  return false;
}

function getAnswerOnlyAvTags(
  data: PreparedCardData
): anki.ExtractAvTagsResponse['avTags'] {
  if (data.aAvTags.length === 0) return [];
  if (data.qAvTags.length === 0) return data.aAvTags;
  return data.aAvTags.filter((t) => !data.qAvTags.some((qt) => isSameAvTag(qt, t)));
}

function getReplayAvTags(
  data: PreparedCardData | null,
  showAnswer: boolean
): anki.ExtractAvTagsResponse['avTags'] {
  if (!data) return [];
  if (!showAnswer) return data.qAvTags;
  const skipQuestion = Boolean(data.deckConfig?.skipQuestionWhenReplayingAnswer);
  const answerOnly = getAnswerOnlyAvTags(data);
  if (skipQuestion) {
    return answerOnly;
  }
  return [...data.qAvTags, ...answerOnly];
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
  const audioStopResolveRef = useRef<(() => void) | null>(null);
  const audioAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const ttsActiveRef = useRef(false);
  const unmountedRef = useRef(false);
  const loadSeqRef = useRef(0);
  const answeringRef = useRef(false);
  const revealingRef = useRef(false);
  const showAnswerRef = useRef(false);
  const activeCardIdRef = useRef<number | null>(null);
  const hasLoadedDeckRef = useRef<number | null>(null);
  const undoActionKindsRef = useRef<UndoActionKind[]>([]);
  const redoActionKindsRef = useRef<UndoActionKind[]>([]);
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
  const [customValInput, setCustomValInput] = useState('10');
  const [busyModal, setBusyModal] = useState(false);

  const twoButtonKnown =
    typeof prefs['study.twoButton'] === 'boolean' ||
    typeof prefs['study.twoButtonMode'] === 'boolean' ||
    info !== null;

  const twoButtonMode = useMemo(() => {
    const raw = prefs['study.twoButton'];
    if (typeof raw === 'boolean') return raw;
    if (typeof prefs['study.twoButtonMode'] === 'boolean') {
      return prefs['study.twoButtonMode'] as boolean;
    }
    return Boolean(info?.eink);
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
    const pendingResolve = audioStopResolveRef.current;
    audioStopResolveRef.current = null;
    if (audioElRef.current) {
      try {
        audioElRef.current.onended = null;
        audioElRef.current.onerror = null;
        audioElRef.current.pause();
        audioElRef.current.removeAttribute('src');
        audioElRef.current.load();
      } catch {
        // Ignore audio stop errors
      }
      audioElRef.current = null;
    }
    if (pendingResolve) {
      pendingResolve();
    }
    if (ttsActiveRef.current) {
      ttsActiveRef.current = false;
      void host.host.platformTtsStop().catch(() => undefined);
    }
    if (!unmountedRef.current) {
      setIsAudioPlaying(false);
    }
  }, []);

  // Ensure audio stops and in-flight loads cancel cleanly on unmount or route change
  useEffect(() => {
    unmountedRef.current = false;
    const onHashChange = () => {
      stopAudio();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      unmountedRef.current = true;
      loadSeqRef.current += 1;
      window.removeEventListener('hashchange', onHashChange);
      stopAudio();
    };
  }, [stopAudio]);

  const playAvTagList = useCallback(
    async (tags: anki.ExtractAvTagsResponse['avTags']) => {
      stopAudio();
      if (unmountedRef.current || !tags || tags.length === 0) return;

      const token = { aborted: false };
      audioAbortRef.current = token;
      setIsAudioPlaying(true);

      try {
        for (const tag of tags) {
          if (token.aborted || unmountedRef.current) break;
          if (tag.soundOrVideo) {
            await new Promise<void>((resolve) => {
              if (token.aborted || unmountedRef.current) {
                resolve();
                return;
              }
              const audio = new Audio(
                `/media/${encodeURIComponent(tag.soundOrVideo!)}`
              );
              audioElRef.current = audio;
              let settled = false;
              const done = () => {
                if (settled) return;
                settled = true;
                audio.onended = null;
                audio.onerror = null;
                if (audioStopResolveRef.current === done) {
                  audioStopResolveRef.current = null;
                }
                if (audioElRef.current === audio) {
                  audioElRef.current = null;
                }
                resolve();
              };
              audioStopResolveRef.current = done;
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
        if (!token.aborted && !unmountedRef.current) {
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
        forwardKeys: true,
      });
    },
    [resolvedTheme, fontScale, lineHeight, tapToFlip, hanjaEnabled]
  );

  const loadQueueAndActiveCard = useCallback(
    async (opts?: { preserveCurrentCache?: boolean; quiet?: boolean }) => {
      const preserveCurrentCache = Boolean(opts?.preserveCurrentCache);
      const quiet = Boolean(opts?.quiet);
      const seq = ++loadSeqRef.current;

      if (!preserveCurrentCache) {
        preparedCacheRef.current.clear();
      }
      if (!quiet) {
        setError(null);
      }

      try {
        await anki.setCurrentDeck(deckId);
        if (seq !== loadSeqRef.current || unmountedRef.current) return;

        const fetchLimit = info?.eink ? 2 : 3;
        const [deckObj, prefsRes, qRes, undoRes] = await Promise.all([
          anki.getDeck(deckId),
          anki.getPreferences().catch(() => null),
          anki.getQueuedCards(fetchLimit, false),
          anki.undoStatus().catch(() => null),
        ]);
        if (seq !== loadSeqRef.current || unmountedRef.current) return;

        const shortTitle = deckObj.name?.split('::').pop() || deckObj.name || '학습';
        setDeckName(shortTitle);
        setAnkiPrefs(prefsRes);
        setQueued(qRes);
        setCanUndo(Boolean(undoRes?.undo));
        setCanRedo(Boolean(undoRes?.redo));

        const cards = qRes.cards ?? [];
        if (cards.length === 0) {
          activeCardIdRef.current = null;
          showAnswerRef.current = false;
          frameReadyRef.current = false;
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
          if (seq !== loadSeqRef.current || unmountedRef.current) return;
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
        const firstCardId = anki.toNumber(firstCard.card?.id);
        const keepingSameCardQuietly =
          quiet && activeCardIdRef.current !== null && activeCardIdRef.current === firstCardId;

        const firstPrepared = await prepareQueuedCard(firstCard, hidePlayBtns);
        if (seq !== loadSeqRef.current || unmountedRef.current) return;

        activeCardIdRef.current = firstPrepared.cardId;
        setPrepared(firstPrepared);
        setActiveFlag((firstCard.card?.flags ?? 0) & 0b111);
        setIsMarked(hasMarkedTag(firstPrepared.note.tags));
        setLoading(false);

        if (!keepingSameCardQuietly) {
          showAnswerRef.current = false;
          setShowAnswer(false);
          cardStartMsRef.current = Date.now();
          setElapsedSecs(0);

          // Send question immediately if iframe is mounted & ready
          if (frameReadyRef.current) {
            sendFrontToFrame(firstPrepared);
          }

          // Auto-play front audio if allowed
          const deckDisableAutoplay = Boolean(firstPrepared.deckConfig?.disableAutoplay);
          if (autoPlayAudio && !deckDisableAutoplay && firstPrepared.qAvTags.length > 0) {
            void playAvTagList(firstPrepared.qAvTags);
          }
        }

        // Background pre-render next 1-2 cards
        for (let i = 1; i < cards.length; i++) {
          void prepareQueuedCard(cards[i], hidePlayBtns).catch(() => undefined);
        }
      } catch (err) {
        if (seq !== loadSeqRef.current || unmountedRef.current) return;
        if (!quiet) {
          setError(
            err instanceof Error ? err.message : '학습 카드를 불러오지 못했습니다.'
          );
          setLoading(false);
        }
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

  // Full session load on mount or deckId change; quiet refresh when collectionVersion bumps (sync)
  useEffect(() => {
    const isDeckChange = hasLoadedDeckRef.current !== deckId;
    hasLoadedDeckRef.current = deckId;

    if (isDeckChange) {
      stopAudio();
      activeCardIdRef.current = null;
      showAnswerRef.current = false;
      frameReadyRef.current = false;
      undoActionKindsRef.current = [];
      redoActionKindsRef.current = [];
      deckConfigCacheRef.current.clear();
      setSessionDone(0);
      setLoading(true);
      void loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } else {
      deckConfigCacheRef.current.clear();
      void loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: true });
    }
  }, [deckId, collectionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Card timer when deck config showTimer is enabled
  const activeCard = queued?.cards?.[0] ?? null;
  const showTimer = Boolean(prepared?.deckConfig?.showTimer);
  const stopTimerOnAnswer = Boolean(prepared?.deckConfig?.stopTimerOnAnswer);
  const rawCapSecs = prepared?.deckConfig?.capAnswerTimeToSecs;
  const capSecs =
    typeof rawCapSecs === 'number' && Number.isFinite(rawCapSecs) && rawCapSecs > 0
      ? rawCapSecs
      : 60;

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
      if (!hasTypeAnsToken(data.aHtmlTemplate)) {
        return data.aHtmlTemplate;
      }

      const card = activeCard?.card;
      const fields = data.notetype.fields ?? [];
      const noteFields = data.note.fields ?? [];
      TYPEANS_REGEX.lastIndex = 0;
      const rawMatches = Array.from(data.aHtmlTemplate.matchAll(TYPEANS_REGEX));
      TYPEANS_REGEX.lastIndex = 0;
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
      if (
        !prepared ||
        showAnswerRef.current ||
        revealingRef.current ||
        answeringRef.current
      ) {
        return;
      }
      revealingRef.current = true;
      const seqAtStart = loadSeqRef.current;

      try {
        if (ankiPrefs?.reviewing?.interruptAudioWhenAnswering !== false) {
          stopAudio();
        }

        let typed = explicitTyped;
        if (
          typed === undefined &&
          (hasTypeAnsToken(prepared.rawFront) || prepared.qHtml.includes('id="typeans"'))
        ) {
          typed = (await cardFrameRef.current?.getTypedAnswer()) ?? '';
        }
        if (seqAtStart !== loadSeqRef.current || unmountedRef.current) return;

        const answerHtml = await resolveTypeAnswerHtml(prepared, typed ?? '');
        if (seqAtStart !== loadSeqRef.current || unmountedRef.current) return;

        showAnswerRef.current = true;
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
          forwardKeys: true,
        });

        // Auto-play answer-side audio only (skipQuestionWhenReplayingAnswer applies to replay, not initial reveal)
        const deckDisableAutoplay = Boolean(prepared.deckConfig?.disableAutoplay);
        if (autoPlayAudio && !deckDisableAutoplay && prepared.aAvTags.length > 0) {
          const answerAudio = getAnswerOnlyAvTags(prepared);
          if (answerAudio.length > 0) {
            void playAvTagList(answerAudio);
          }
        }
      } finally {
        revealingRef.current = false;
      }
    },
    [
      prepared,
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
      if (
        !activeCard ||
        !activeCard.card ||
        !activeCard.states ||
        answeringRef.current ||
        revealingRef.current
      ) {
        return;
      }
      answeringRef.current = true;
      setAnswering(true);
      stopAudio();
      try {
        const msTaken = Date.now() - cardStartMsRef.current;
        const cid = activeCard.card.id!;
        await anki.answerCard(cid, activeCard.states, rating, msTaken, capSecs);
        preparedCacheRef.current.delete(anki.toNumber(cid));
        undoActionKindsRef.current.push('rate');
        redoActionKindsRef.current = [];
        setSessionDone((c) => c + 1);
        await loadQueueAndActiveCard({ preserveCurrentCache: true, quiet: false });
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '답변을 저장하지 못했습니다.',
          'error'
        );
      } finally {
        answeringRef.current = false;
        if (!unmountedRef.current) {
          setAnswering(false);
        }
      }
    },
    [activeCard, capSecs, stopAudio, loadQueueAndActiveCard, showToast]
  );

  const handleUndo = useCallback(async () => {
    if (!canUndo || answeringRef.current || revealingRef.current) return;
    answeringRef.current = true;
    stopAudio();
    setAnswering(true);
    try {
      await anki.undo();
      preparedCacheRef.current.clear();
      const undoneKind = undoActionKindsRef.current.pop();
      if (undoneKind) {
        redoActionKindsRef.current.push(undoneKind);
        if (undoneKind === 'rate') {
          setSessionDone((c) => Math.max(0, c - 1));
        }
      }
      showToast('방금 한 작업을 되돌렸습니다.', 'info');
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '되돌릴 수 있는 작업이 없습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) {
        setAnswering(false);
      }
    }
  }, [canUndo, stopAudio, loadQueueAndActiveCard, showToast]);

  const handleRedo = useCallback(async () => {
    if (!canRedo || answeringRef.current || revealingRef.current) return;
    answeringRef.current = true;
    stopAudio();
    setAnswering(true);
    try {
      await anki.redo();
      preparedCacheRef.current.clear();
      const redoneKind = redoActionKindsRef.current.pop();
      if (redoneKind) {
        undoActionKindsRef.current.push(redoneKind);
        if (redoneKind === 'rate') {
          setSessionDone((c) => c + 1);
        }
      }
      showToast('작업을 다시 실행했습니다.', 'info');
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '다시 실행할 작업이 없습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) {
        setAnswering(false);
      }
    }
  }, [canRedo, stopAudio, loadQueueAndActiveCard, showToast]);

  const undoToastAction = useMemo(
    () => ({
      label: '되돌리기',
      onClick: async () => {
        if (answeringRef.current || revealingRef.current) return;
        answeringRef.current = true;
        setAnswering(true);
        try {
          await anki.undo();
          preparedCacheRef.current.clear();
          const undoneKind = undoActionKindsRef.current.pop();
          if (undoneKind) {
            redoActionKindsRef.current.push(undoneKind);
            if (undoneKind === 'rate') {
              setSessionDone((c) => Math.max(0, c - 1));
            }
          }
          await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
          showToast('작업을 되돌렸습니다.', 'info');
        } catch {
          showToast('되돌리지 못했습니다.', 'error');
        } finally {
          answeringRef.current = false;
          if (!unmountedRef.current) {
            setAnswering(false);
          }
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
        undoActionKindsRef.current.push('other');
        redoActionKindsRef.current = [];
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
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '별표를 변경하지 못했습니다.',
        'error'
      );
    }
  }, [activeCard, isMarked, showToast]);

  const replayAvTags = useMemo(
    () => getReplayAvTags(prepared, showAnswer),
    [prepared, showAnswer]
  );

  const handleReplayAudio = useCallback(() => {
    if (!prepared) return;
    const tags = getReplayAvTags(prepared, showAnswerRef.current);
    if (tags.length > 0) {
      void playAvTagList(tags);
    } else {
      showToast('이 카드에는 재생할 오디오가 없습니다.', 'info');
    }
  }, [prepared, playAvTagList, showToast]);

  const handleBuryCard = useCallback(async () => {
    const cid = activeCard?.card?.id;
    if (cid == null || answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);
    stopAudio();
    try {
      await anki.buryOrSuspendCards([cid], [], anki.BuryOrSuspendMode.BURY_USER);
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      showToast('이 카드를 내일까지 숨겼습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드를 숨기지 못했습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) setAnswering(false);
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleBuryNote = useCallback(async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null || answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);
    stopAudio();
    try {
      await anki.buryOrSuspendCards([], [nid], anki.BuryOrSuspendMode.BURY_USER);
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      showToast('이 노트의 카드를 내일까지 숨겼습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 숨기지 못했습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) setAnswering(false);
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleSuspendCard = useCallback(async () => {
    const cid = activeCard?.card?.id;
    if (cid == null || answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);
    stopAudio();
    try {
      await anki.buryOrSuspendCards([cid], [], anki.BuryOrSuspendMode.SUSPEND);
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      showToast('카드를 일시 중지했습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드를 일시 중지하지 못했습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) setAnswering(false);
    }
  }, [activeCard, stopAudio, loadQueueAndActiveCard, showToast, undoToastAction]);

  const handleSuspendNote = useCallback(async () => {
    const nid = activeCard?.card?.noteId;
    if (nid == null || answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);
    stopAudio();
    try {
      await anki.buryOrSuspendCards([], [nid], anki.BuryOrSuspendMode.SUSPEND);
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      showToast('이 노트의 모든 카드를 일시 중지했습니다.', 'info', undoToastAction);
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 일시 중지하지 못했습니다.',
        'error'
      );
    } finally {
      answeringRef.current = false;
      if (!unmountedRef.current) setAnswering(false);
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
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      setForgetOpen(false);
      showToast('카드를 새 카드 상태로 되돌렸습니다.', 'success');
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
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
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      setDueDialogOpen(false);
      showToast('복습 날짜를 변경했습니다.', 'success');
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
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
      undoActionKindsRef.current.push('other');
      redoActionKindsRef.current = [];
      setDeleteConfirmOpen(false);
      showToast('노트를 삭제했습니다.', 'success');
      await loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트를 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusyModal(false);
    }
  };

  // Back handler: block while a modal mutation is in flight; otherwise stop audio on exit
  useEffect(() => {
    return registerBackHandler(() => {
      if (busyModal) return true;
      stopAudio();
      return false;
    });
  }, [busyModal, stopAudio, registerBackHandler]);

  // Unified action dispatcher for keyboard, iframe-forwarded keys, and Host SSE hardware keys
  const handleStudyKeyAction = useCallback(
    (
      keyRaw: string,
      opts: { code?: string; shift?: boolean; ctrl?: boolean; meta?: boolean; alt?: boolean }
    ): boolean => {
      const action = resolveStudyKeyAction(keyRaw, opts, {
        showAnswer: showAnswerRef.current,
        twoButtonMode,
        volumeKeysEnabled,
      });
      if (!action) return false;

      switch (action.type) {
        case 'showAnswer':
          void handleShowAnswer();
          return true;
        case 'rate': {
          const ratingMap = {
            again: anki.Rating.AGAIN,
            hard: anki.Rating.HARD,
            good: anki.Rating.GOOD,
            easy: anki.Rating.EASY,
          } as const;
          void handleRate(ratingMap[action.rating]);
          return true;
        }
        case 'setFlag':
          void handleSetFlag(action.flag);
          return true;
        case 'undo':
          void handleUndo();
          return true;
        case 'redo':
          void handleRedo();
          return true;
        case 'toggleWhiteboard':
          setWhiteboardOpen((v) => !v);
          return true;
        case 'toggleShortcuts':
          setShortcutsOpen((v) => !v);
          return true;
        case 'editNote': {
          const nid = activeCard?.card?.noteId;
          if (nid !== undefined) {
            stopAudio();
            navigate(`#/note/${anki.toNumber(nid)}?from=study`);
            return true;
          }
          return false;
        }
        case 'replayAudio':
          handleReplayAudio();
          return true;
        case 'stopAudio':
          stopAudio();
          return true;
        case 'toggleMark':
          void handleToggleMark();
          return true;
        case 'buryCard':
          void handleBuryCard();
          return true;
        case 'buryNote':
          void handleBuryNote();
          return true;
        case 'suspendCard':
          void handleSuspendCard();
          return true;
        case 'suspendNote':
          void handleSuspendNote();
          return true;
        case 'hanja':
          cardFrameRef.current?.hanjaKey(action.action);
          return true;
      }
    },
    [
      volumeKeysEnabled,
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
      if (e.isComposing || e.keyCode === 229 || e.repeat) return;
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
      // Do not hijack Space/Enter when focus is explicitly on a button or link (e.g. Tab to "다시" or "뒤로").
      if (
        (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') &&
        target?.closest('button, a[href], [role="button"], summary')
      ) {
        return;
      }
      if (hasBlockingOverlay()) return;
      if (!activeCard) return;

      const handled = handleStudyKeyAction(e.key, {
        code: e.code,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
      });
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCard, handleStudyKeyAction]);

  // Host SSE hardware key listener (Android volume, page, dpad, media, Q/W keys)
  useEffect(() => {
    return registerKeyHandler((ev) => {
      if (hasBlockingOverlay()) return false;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return false;
      }
      if (!activeCard) return false;
      const keyStr = ev.action || ev.key || '';
      if (!keyStr) return false;
      return handleStudyKeyAction(keyStr, { shift: ev.shift, ctrl: ev.ctrl });
    });
  }, [activeCard, registerKeyHandler, handleStudyKeyAction]);

  // Forwarded keyboard events from inside the card iframe
  const handleFrameKeyDown = useCallback(
    (ev: CardFrameKeyEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'Escape' && openOverlayCount() > 0) {
        closeTopOverlay();
        return;
      }
      if (hasBlockingOverlay() || !activeCard) return;
      handleStudyKeyAction(ev.key, {
        code: ev.code,
        shift: ev.shift,
        ctrl: ev.ctrl,
        meta: ev.meta,
        alt: ev.alt,
      });
    },
    [activeCard, handleStudyKeyAction]
  );

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
  const intervals = prepared?.intervals ?? ['', '', '', ''];
  const currentFlagMeta = FLAG_OPTIONS.find((f) => f.flag === activeFlag);

  const shortcutItems = useMemo<Array<[string, string]>>(
    () => [
      [
        twoButtonMode ? '정답 보기 / 암기 완료' : '정답 보기 / 알맞음',
        'Space / Enter',
      ],
      twoButtonMode
        ? ['모름 · 암기 완료', '1 · 2']
        : ['다시 · 어려움 · 알맞음 · 쉬움', '1 · 2 · 3 · 4'],
      [
        twoButtonMode ? '모름 · 암기 완료 (방향/페이지)' : '다시 · 알맞음 (방향/페이지)',
        '← / → · PgUp / PgDn',
      ],
      ['되돌리기 / 다시 실행', 'U · Ctrl+Z / Ctrl+Shift+Z'],
      ['필기장 켜기 / 닫기', 'B / Esc'],
      ['노트 편집', 'E'],
      ['오디오 다시 재생', 'R'],
      ['별표 표시 토글', '*'],
      ['카드 숨기기 / 노트 숨기기', '- / ='],
      ['카드 일시 중지 / 노트 일시 중지', '@ / !'],
      ['깃발 1~7 / 해제', 'Ctrl+1~7 / Ctrl+0'],
      ['한자 조회 / 다음·이전 한자', 'Q / W · Shift+W'],
    ],
    [twoButtonMode]
  );

  const clampCustomVal = (raw: string): number => {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(9999, parsed);
  };

  return (
    <div className="amgi-study-screen">
      {/* Slim, calm top bar */}
      <header className="amgi-study-topbar">
        <button
          type="button"
          className="amgi-study-top-btn"
          aria-label="뒤로 가기"
          onClick={(e) => {
            e.currentTarget.blur();
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
                title="새 카드"
                className={`amgi-study-q-num amgi-study-q-new ${
                  activeQueue === 0 ? 'amgi-study-q-active' : ''
                }`}
              >
                {queued.newCount ?? 0}
              </span>
              <span
                title="학습 중"
                className={`amgi-study-q-num amgi-study-q-learn ${
                  activeQueue === 1 ? 'amgi-study-q-active' : ''
                }`}
              >
                {queued.learningCount ?? 0}
              </span>
              <span
                title="복습"
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
            className="amgi-study-top-btn"
            aria-label="되돌리기"
            title="되돌리기 (Ctrl+Z)"
            disabled={!canUndo || answering}
            onClick={(e) => {
              e.currentTarget.blur();
              void handleUndo();
            }}
          >
            <IconUndo size={19} />
          </button>

          {activeCard && (
            <>
              <button
                type="button"
                className={`amgi-study-top-btn amgi-study-top-wide-only ${whiteboardOpen ? 'is-active' : ''}`}
                aria-label={whiteboardOpen ? '필기장 끄기' : '필기장 켜기'}
                title="필기장 (B)"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setWhiteboardOpen((v) => !v);
                }}
              >
                <IconPen size={18} />
              </button>

              <button
                type="button"
                className={`amgi-study-top-btn amgi-study-top-wide-only ${activeFlag > 0 ? 'has-flag' : ''}`}
                aria-label="깃발 지정"
                title="깃발 지정 (Ctrl+1~7)"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setFlagPickerOpen(true);
                }}
              >
                {activeFlag > 0 && resolvedTheme === 'eink' ? (
                  <span className="amgi-flag-badge">{activeFlag}</span>
                ) : (
                  <IconFlag
                    size={18}
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
                className="amgi-study-top-btn"
                aria-label="학습 메뉴"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setOverflowOpen(true);
                }}
              >
                <IconMore size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Whisper-thin Session Progress Bar */}
      {activeCard && queued && (
        <div className="amgi-study-progress-track" aria-hidden="true">
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
                return Math.min(
                  100,
                  Math.max(sessionDone > 0 ? 4 : 0, Math.round((sessionDone / total) * 100))
                );
              })()}%`,
            }}
          />
        </div>
      )}

      {/* Main Content Area: Loading / Error / Congrats / Card Stage */}
      {loading ? (
        <div className="amgi-study-loading-box">
          <strong>카드를 불러오고 있어요</strong>
          <span className="amgi-study-loading-sub">잠시만 기다려 주세요.</span>
        </div>
      ) : error ? (
        <div className="amgi-study-congrats-wrap">
          <div style={{ width: '100%', maxWidth: 480 }}>
            <ErrorState
              title="학습 화면을 불러오지 못했습니다"
              message={error}
              onRetry={() => {
                setLoading(true);
                void loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false });
              }}
            />
          </div>
        </div>
      ) : !activeCard || !prepared ? (
        <div className="amgi-study-congrats-wrap">
          <div className="amgi-study-congrats-card">
            <CelebrationBadge size={44} />
            <div className="amgi-study-congrats-header">
              <h2 className="amgi-study-congrats-title">오늘 학습 완료</h2>
              <div className="amgi-study-congrats-deck">{deckName}</div>
            </div>

            {todayStats.answerCount > 0 && (
              <div className="amgi-study-congrats-chips tabular">
                <span className="amgi-study-congrats-chip">
                  오늘 <strong>{todayStats.answerCount.toLocaleString()}</strong>장 학습
                </span>
                <span className="amgi-study-congrats-chip">
                  <strong>{formatDurationKo(todayStats.answerMillis)}</strong> 집중
                </span>
              </div>
            )}

            {congratsData && congratsData.secsUntilNextLearn > 0 && (
              <p className="amgi-study-congrats-wait">
                다음 학습 카드가 {formatWaitKo(congratsData.secsUntilNextLearn)} 뒤에 열려요.
              </p>
            )}

            {(congratsData?.haveSchedBuried || congratsData?.haveUserBuried) && (
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary amgi-btn-sm amgi-study-unbury-btn"
                onClick={() => {
                  void anki
                    .unburyDeck(deckId, anki.UnburyDeckMode.ALL)
                    .then(() =>
                      loadQueueAndActiveCard({ preserveCurrentCache: false, quiet: false })
                    )
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

            {canUndo && (
              <button
                type="button"
                className="amgi-btn amgi-btn-ghost amgi-study-congrats-undo"
                disabled={answering}
                onClick={() => void handleUndo()}
              >
                <IconUndo size={16} />
                <span>방금 카드 되돌리기</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <main className="amgi-study-stage">
            <div className="amgi-study-card-shell">
              {activeFlag > 0 && (
                <div
                  className={`amgi-study-flag-stripe amgi-study-flag-stripe-${activeFlag}`}
                  aria-hidden="true"
                />
              )}

              {(replayAvTags.length > 0 || isMarked || showTimer) && (
                <div className="amgi-study-card-meta">
                  <div className="amgi-study-meta-left">
                    {replayAvTags.length > 0 && (
                      <button
                        type="button"
                        className={`amgi-audio-pill ${isAudioPlaying ? 'is-playing' : ''}`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          handleReplayAudio();
                        }}
                      >
                        <IconVolume size={15} />
                        <span>{isAudioPlaying ? '재생 중' : '다시 듣기'}</span>
                      </button>
                    )}
                  </div>
                  <div className="amgi-study-meta-right">
                    {showTimer && (
                      <span className="amgi-timer-pill tabular">{elapsedSecs}초</span>
                    )}
                    {isMarked && (
                      <span className="amgi-mark-pill" aria-label="별표 표시됨">
                        <IconStar size={14} fill="currentColor" />
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
                    if (prepared && !showAnswerRef.current) {
                      sendFrontToFrame(prepared);
                    }
                  }}
                  onCardTap={() => {
                    if (!showAnswerRef.current && tapToFlip) {
                      void handleShowAnswer();
                    }
                  }}
                  onPlaySound={handlePlaySoundTag}
                  onTypeAnsSubmit={(val) => {
                    if (!showAnswerRef.current) {
                      void handleShowAnswer(val);
                    }
                  }}
                  onHanjaLookup={(text, sentence) => {
                    void host.host
                      .hanjaLookup({ text, sentence })
                      .catch(() => undefined);
                  }}
                  onBridgeCommand={handleBridgeCommand}
                  onKeyDown={handleFrameKeyDown}
                />
              </div>

              <WhiteboardOverlay
                open={whiteboardOpen}
                cardKey={prepared.cardId}
                theme={resolvedTheme}
                onClose={() => setWhiteboardOpen(false)}
              />
            </div>
          </main>

          {/* Bottom Answer & Rating Dock (unified 56px height / 64px e-ink) */}
          <footer className="amgi-answer-bar">
            <div className="amgi-answer-bar-inner">
              {!showAnswer ? (
                <div className="amgi-show-answer-row">
                  {canUndo && (
                    <button
                      type="button"
                      className="amgi-study-undo-btn"
                      aria-label="방금 평가 되돌리기"
                      title="되돌리기 (Ctrl+Z)"
                      disabled={answering}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        void handleUndo();
                      }}
                    >
                      <IconUndo size={18} />
                      <span className="amgi-study-undo-label">되돌리기</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="amgi-show-answer-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleShowAnswer();
                    }}
                  >
                    <span>정답 보기</span>
                    <span className="amgi-show-answer-key" aria-hidden="true">
                      Space
                    </span>
                  </button>
                </div>
              ) : !twoButtonKnown ? (
                <div className="amgi-answer-bar-placeholder" aria-hidden="true" />
              ) : twoButtonMode ? (
                <div
                  className={`amgi-rate-grid-2 ${leftHandedMode ? 'is-left-handed' : ''}`}
                >
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-again"
                    disabled={answering}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.AGAIN);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      1
                    </span>
                    {showIntervals && intervals[0] && (
                      <span className="amgi-rate-ivl tabular">{intervals[0]}</span>
                    )}
                    <span className="amgi-rate-label">모름</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-good"
                    disabled={answering}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.GOOD);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      2
                    </span>
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
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.AGAIN);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      1
                    </span>
                    {showIntervals && intervals[0] && (
                      <span className="amgi-rate-ivl tabular">{intervals[0]}</span>
                    )}
                    <span className="amgi-rate-label">다시</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-hard"
                    disabled={answering}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.HARD);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      2
                    </span>
                    {showIntervals && intervals[1] && (
                      <span className="amgi-rate-ivl tabular">{intervals[1]}</span>
                    )}
                    <span className="amgi-rate-label">어려움</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-good"
                    disabled={answering}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.GOOD);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      3
                    </span>
                    {showIntervals && intervals[2] && (
                      <span className="amgi-rate-ivl tabular">{intervals[2]}</span>
                    )}
                    <span className="amgi-rate-label">알맞음</span>
                  </button>
                  <button
                    type="button"
                    className="amgi-rate-btn amgi-rate-easy"
                    disabled={answering}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void handleRate(anki.Rating.EASY);
                    }}
                  >
                    <span className="amgi-rate-key" aria-hidden="true">
                      4
                    </span>
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
            id: 'toggle-whiteboard',
            label: whiteboardOpen ? '필기장 끄기' : '필기장 켜기 (S펜·손글씨)',
            description: '화면 위에 직접 써보며 한자·단어를 연습합니다 (B)',
            icon: <IconPen size={18} />,
            onSelect: () => setWhiteboardOpen((v) => !v),
          },
          {
            id: 'set-flag',
            label: '깃발 지정',
            description:
              activeFlag > 0 && currentFlagMeta
                ? `현재: ${currentFlagMeta.label} (${activeFlag}번)`
                : '카드에 색깔 깃발을 표시합니다 (Ctrl+1~7)',
            icon: <IconFlag size={18} />,
            onSelect: () => setFlagPickerOpen(true),
          },
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
        subtitle={
          twoButtonMode
            ? '현재 2버튼 모드가 적용되어 있습니다'
            : 'Anki 표준 단축키를 그대로 사용할 수 있습니다'
        }
      >
        <div className="amgi-shortcut-grid">
          {shortcutItems.map(([label, keys]) => (
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
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) {
                  e.stopPropagation();
                }
              }}
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
                const val = clampCustomVal(customValInput);
                setCustomValInput(String(val));
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
                      await loadQueueAndActiveCard({
                        preserveCurrentCache: false,
                        quiet: false,
                      });
                    } else {
                      const tree = await anki.deckTree();
                      const filteredId = findCustomStudyDeckId(tree);
                      if (filteredId) {
                        navigate(`#/study/${filteredId}`);
                      } else {
                        await loadQueueAndActiveCard({
                          preserveCurrentCache: false,
                          quiet: false,
                        });
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
              setCustomValInput('10');
            }}
          >
            <span className="amgi-radio-card-title">오늘 새 카드 더 공부하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'reviewLimitDelta' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('reviewLimitDelta');
              setCustomValInput('20');
            }}
          >
            <span className="amgi-radio-card-title">오늘 복습 카드 더 공부하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'forgotDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('forgotDays');
              setCustomValInput('1');
            }}
          >
            <span className="amgi-radio-card-title">최근 틀린 카드 다시 보기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'reviewAheadDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('reviewAheadDays');
              setCustomValInput('1');
            }}
          >
            <span className="amgi-radio-card-title">미리 복습하기</span>
          </button>
          <button
            type="button"
            className={`amgi-radio-card ${customPreset === 'previewDays' ? 'active' : ''}`}
            onClick={() => {
              setCustomPreset('previewDays');
              setCustomValInput('1');
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="amgi-input tabular"
              value={customValInput}
              onChange={(e) => setCustomValInput(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => setCustomValInput(String(clampCustomVal(customValInput)))}
            />
          </div>
        </div>
      </SheetOrDialog>
    </div>
  );
};

export default StudyView;
