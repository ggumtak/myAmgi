import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import { toNumber, UpdateDeckConfigsMode } from '../../anki';
import { useApp } from '../../context/AppContext';
import {
  ErrorState,
  IconArrowLeft,
  IconCheck,
  IconSpark,
  SectionCard,
  SettingRow,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { AnkiIframeView } from '../shared/AnkiIframeView';
import './options.css';

interface QuickPreset {
  id: string;
  title: string;
  counts: string;
  newPerDay: number;
  reviewsPerDay: number;
  learnSteps: number[];
  relearnSteps: number[];
  desiredRetention: number;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'lang',
    title: '어학 · 단어',
    counts: '20 / 200',
    newPerDay: 20,
    reviewsPerDay: 200,
    learnSteps: [1, 10],
    relearnSteps: [10],
    desiredRetention: 0.9,
  },
  {
    id: 'exam',
    title: '시험 집중',
    counts: '40 / 400',
    newPerDay: 40,
    reviewsPerDay: 400,
    learnSteps: [1, 10],
    relearnSteps: [10],
    desiredRetention: 0.93,
  },
  {
    id: 'light',
    title: '가벼운 유지',
    counts: '10 / 100',
    newPerDay: 10,
    reviewsPerDay: 100,
    learnSteps: [10],
    relearnSteps: [10],
    desiredRetention: 0.87,
  },
];

// Wide bounds matching Anki's own deck options limits (applied only on user edit blur/save, never on load)
const RANGE_NEW_PER_DAY = { min: 0, max: 9999 } as const;
const RANGE_REVIEWS_PER_DAY = { min: 0, max: 9999 } as const;
const RANGE_RETENTION_PCT = { min: 70, max: 99 } as const;
const RANGE_MAX_INTERVAL = { min: 1, max: 36500 } as const;
const RANGE_LEECH_THRESHOLD = { min: 0, max: 999 } as const;
const RANGE_CAP_ANSWER_SECS = { min: 1, max: 3600 } as const;

function parseAndClampInt(raw: string, fallback: number, min: number, max: number): number {
  const trimmed = raw.trim();
  if (!trimmed) return Math.min(max, Math.max(min, Math.round(fallback)));
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return Math.min(max, Math.max(min, Math.round(fallback)));
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function formatStepsToText(steps: number[] | null | undefined): string {
  if (!steps || steps.length === 0) return '';
  return steps
    .map((mins) => {
      if (mins > 0 && mins < 1) {
        const secs = Math.round(mins * 60);
        return `${secs}s`;
      }
      if (mins >= 1440 && mins % 1440 === 0) {
        return `${mins / 1440}d`;
      }
      if (mins >= 60 && mins % 60 === 0) {
        return `${mins / 60}h`;
      }
      return `${Number(mins.toFixed(2))}m`;
    })
    .join(' ');
}

function parseStepsText(text: string): { valid: boolean; steps: number[] } {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, steps: [] };
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const parsed: number[] = [];
  for (const tok of tokens) {
    const m = /^(\d+(?:\.\d+)?)(s|m|h|d)?$/i.exec(tok);
    if (!m) {
      return { valid: false, steps: [] };
    }
    const num = Number(m[1]);
    if (!Number.isFinite(num) || num <= 0) {
      return { valid: false, steps: [] };
    }
    const unit = (m[2] || 'm').toLowerCase();
    let mins = num;
    if (unit === 's') mins = num / 60;
    else if (unit === 'h') mins = num * 60;
    else if (unit === 'd') mins = num * 1440;
    parsed.push(mins);
  }
  return { valid: true, steps: parsed };
}

function getRetentionHint(pct: number): string {
  if (pct <= 83) return '복습 부담은 적지만 가끔 잊을 수 있어요';
  if (pct <= 87) return '가볍게 오래 유지하기 좋습니다';
  if (pct <= 91) return '기억률과 복습량의 가장 이상적인 균형 (권장)';
  if (pct <= 94) return '시험 대비용으로 높은 기억률을 유지합니다';
  return '거의 잊지 않지만 복습량이 크게 늘어납니다';
}

function parseDateToMs(dateStr: string | null | undefined): number {
  if (!dateStr || !dateStr.trim()) return 0;
  const parsed = Date.parse(dateStr.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const DeckOptionsView: React.FC<{ deckId: number }> = ({ deckId }) => {
  const { resolvedTheme, bumpCollection, goBack, registerBackHandler } = useApp();
  const { showToast } = useToast();

  const isEink = resolvedTheme === 'eink';

  const [data, setData] = useState<anki.DeckConfigsForUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorLog, setLoadErrorLog] = useState<string | undefined>(undefined);

  const [initialConfigId, setInitialConfigId] = useState<number>(1);
  const [selectedConfigId, setSelectedConfigId] = useState<number>(1);
  const [applyToSubdecks, setApplyToSubdecks] = useState(false);

  // Editable draft values + string drafts for numeric inputs so typing never fights the user
  const [newPerDay, setNewPerDay] = useState(20);
  const [newPerDayDraft, setNewPerDayDraft] = useState('20');
  const [reviewsPerDay, setReviewsPerDay] = useState(200);
  const [reviewsPerDayDraft, setReviewsPerDayDraft] = useState('200');
  const [learnStepsText, setLearnStepsText] = useState('1m 10m');
  const [relearnStepsText, setRelearnStepsText] = useState('10m');

  const [fsrsEnabled, setFsrsEnabled] = useState(false);
  const [initialFsrsEnabled, setInitialFsrsEnabled] = useState(false);
  const [desiredRetentionPct, setDesiredRetentionPct] = useState(90);
  const [maxReviewInterval, setMaxReviewInterval] = useState(36500);
  const [maxReviewIntervalDraft, setMaxReviewIntervalDraft] = useState('36500');
  const [optimizedParams, setOptimizedParams] = useState<number[] | null>(null);
  const [optimizeStatusMsg, setOptimizeStatusMsg] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [computingRetention, setComputingRetention] = useState(false);

  // Display order
  const [newGatherPriority, setNewGatherPriority] = useState(0);
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [newMix, setNewMix] = useState(0);
  const [reviewOrder, setReviewOrder] = useState(0);

  // Lapses / Leech
  const [leechThreshold, setLeechThreshold] = useState(8);
  const [leechThresholdDraft, setLeechThresholdDraft] = useState('8');
  const [leechAction, setLeechAction] = useState(1);

  const [buryNew, setBuryNew] = useState(false);
  const [buryReviews, setBuryReviews] = useState(false);
  const [buryInterdayLearning, setBuryInterdayLearning] = useState(false);

  const [disableAutoplay, setDisableAutoplay] = useState(false);
  const [skipQuestionAudio, setSkipQuestionAudio] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [stopTimerOnAnswer, setStopTimerOnAnswer] = useState(false);
  const [capAnswerSecs, setCapAnswerSecs] = useState(60);
  const [capAnswerSecsDraft, setCapAnswerSecsDraft] = useState('60');

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showOfficialIframe, setShowOfficialIframe] = useState(false);

  // Unsaved-changes guard dialogs
  const [discardOpen, setDiscardOpen] = useState(false);
  const [officialConfirmOpen, setOfficialConfirmOpen] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<number | null>(null);

  // Track which config keys the user actually touched so untouched fields keep original Anki values
  const editedFieldsRef = useRef<Set<string>>(new Set());
  const loadSeqRef = useRef(0);

  const markEdited = useCallback((fieldKey: string) => {
    editedFieldsRef.current.add(fieldKey);
    setDirty(true);
  }, []);

  const hydrateDraftFromConfig = useCallback(
    (
      cfg: anki.DeckConfig['config'] | undefined,
      fallbackLimits?: anki.DeckConfigsForUpdate['currentDeck']
    ) => {
      editedFieldsRef.current.clear();

      // Do not clamp loaded values so custom Anki settings are preserved verbatim until edited.
      const loadedNew = cfg?.newPerDay ?? 20;
      const loadedRev = cfg?.reviewsPerDay ?? 200;
      setNewPerDay(loadedNew);
      setNewPerDayDraft(String(loadedNew));
      setReviewsPerDay(loadedRev);
      setReviewsPerDayDraft(String(loadedRev));

      setLearnStepsText(
        cfg?.learnSteps !== undefined ? formatStepsToText(cfg.learnSteps) : '1m 10m'
      );
      setRelearnStepsText(
        cfg?.relearnSteps !== undefined ? formatStepsToText(cfg.relearnSteps) : '10m'
      );

      const rawRet = cfg?.desiredRetention ?? fallbackLimits?.limits?.desiredRetention ?? 0.9;
      setDesiredRetentionPct(Math.round(rawRet * 100));

      const loadedMaxInt = cfg?.maximumReviewInterval ?? 36500;
      setMaxReviewInterval(loadedMaxInt);
      setMaxReviewIntervalDraft(String(loadedMaxInt));
      setOptimizedParams(null);
      setOptimizeStatusMsg(null);

      setNewGatherPriority(cfg?.newCardGatherPriority ?? 0);
      setNewSortOrder(cfg?.newCardSortOrder ?? 0);
      setNewMix(cfg?.newMix ?? 0);
      setReviewOrder(cfg?.reviewOrder ?? 0);

      const loadedLeech = cfg?.leechThreshold ?? 8;
      setLeechThreshold(loadedLeech);
      setLeechThresholdDraft(String(loadedLeech));
      setLeechAction(cfg?.leechAction ?? 1);

      setBuryNew(Boolean(cfg?.buryNew));
      setBuryReviews(Boolean(cfg?.buryReviews));
      setBuryInterdayLearning(Boolean(cfg?.buryInterdayLearning));

      setDisableAutoplay(Boolean(cfg?.disableAutoplay));
      setSkipQuestionAudio(Boolean(cfg?.skipQuestionWhenReplayingAnswer));
      setShowTimer(Boolean(cfg?.showTimer));
      setStopTimerOnAnswer(Boolean(cfg?.stopTimerOnAnswer));

      const loadedCap = cfg?.capAnswerTimeToSecs ?? 60;
      setCapAnswerSecs(loadedCap);
      setCapAnswerSecsDraft(String(loadedCap));
    },
    []
  );

  const loadOptions = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (!opts?.quiet) {
        setLoading(true);
      }
      setLoadError(null);
      setLoadErrorLog(undefined);
      try {
        const res = await anki.getDeckConfigsForUpdate(deckId);
        if (seq !== loadSeqRef.current) return;
        setData(res);

        const targetConfigId = toNumber(res.currentDeck?.configId, 1);
        const matched =
          res.allConfig?.find((c) => toNumber(c.config?.id) === targetConfigId) ??
          res.allConfig?.[0];
        const matchedId = toNumber(matched?.config?.id, targetConfigId);
        setInitialConfigId(matchedId);
        setSelectedConfigId(matchedId);
        setApplyToSubdecks(false);

        const fsrsOn = Boolean(res.fsrs);
        setFsrsEnabled(fsrsOn);
        setInitialFsrsEnabled(fsrsOn);

        const cfg = matched?.config?.config ?? res.defaults?.config;
        hydrateDraftFromConfig(cfg, res.currentDeck);
        setDirty(false);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setLoadError(
          err instanceof Error ? err.message : '덱 설정을 불러오는 중 오류가 발생했습니다.'
        );
        setLoadErrorLog(err instanceof Error ? err.stack || err.message : String(err));
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [deckId, hydrateDraftFromConfig]
  );

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  // Guard unsaved changes on hardware back and topbar back (when official iframe is not open).
  useEffect(() => {
    if (showOfficialIframe) return;
    return registerBackHandler(() => {
      if (dirty) {
        setDiscardOpen(true);
        return true;
      }
      return false;
    });
  }, [showOfficialIframe, dirty, registerBackHandler]);

  const activeEntry = useMemo(() => {
    if (!data?.allConfig?.length) return null;
    return (
      data.allConfig.find((c) => toNumber(c.config?.id) === selectedConfigId) ??
      data.allConfig[0]
    );
  }, [data, selectedConfigId]);

  const activeConfig = activeEntry?.config ?? null;
  const activeUseCount = activeEntry?.useCount ?? 1;

  const learnStepsParsed = useMemo(() => parseStepsText(learnStepsText), [learnStepsText]);
  const relearnStepsParsed = useMemo(
    () => parseStepsText(relearnStepsText),
    [relearnStepsText]
  );

  const applyPresetSelection = useCallback(
    (nextConfigId: number) => {
      setSelectedConfigId(nextConfigId);
      const matched = data?.allConfig?.find((c) => toNumber(c.config?.id) === nextConfigId);
      if (matched?.config?.config) {
        hydrateDraftFromConfig(matched.config.config, data?.currentDeck);
      }
      setDirty(nextConfigId !== initialConfigId || applyToSubdecks || fsrsEnabled !== initialFsrsEnabled);
    },
    [data, hydrateDraftFromConfig, initialConfigId, applyToSubdecks, fsrsEnabled, initialFsrsEnabled]
  );

  const handleSelectPreset = (nextConfigId: number) => {
    if (nextConfigId === selectedConfigId) return;
    if (editedFieldsRef.current.size > 0 || optimizedParams !== null) {
      setPendingPresetId(nextConfigId);
      return;
    }
    applyPresetSelection(nextConfigId);
  };

  const handleOpenOfficialIframe = () => {
    if (dirty) {
      setOfficialConfirmOpen(true);
      return;
    }
    setShowOfficialIframe(true);
  };

  const handleApplyQuickPreset = (preset: QuickPreset) => {
    setNewPerDay(preset.newPerDay);
    setNewPerDayDraft(String(preset.newPerDay));
    setReviewsPerDay(preset.reviewsPerDay);
    setReviewsPerDayDraft(String(preset.reviewsPerDay));
    setLearnStepsText(formatStepsToText(preset.learnSteps));
    setRelearnStepsText(formatStepsToText(preset.relearnSteps));
    setDesiredRetentionPct(Math.round(preset.desiredRetention * 100));

    editedFieldsRef.current.add('newPerDay');
    editedFieldsRef.current.add('reviewsPerDay');
    editedFieldsRef.current.add('learnSteps');
    editedFieldsRef.current.add('relearnSteps');
    editedFieldsRef.current.add('desiredRetention');
    setDirty(true);
    showToast("추천 값을 채웠습니다. 오른쪽 위 '저장'을 눌러 주세요.", 'info');
  };

  const handleOptimizeFsrs = async () => {
    if (!activeConfig?.config || optimizing) return;
    if (!relearnStepsParsed.valid) {
      showToast('틀린 카드 재학습 간격을 먼저 올바르게 입력해 주세요.', 'error');
      return;
    }
    setOptimizing(true);
    setOptimizeStatusMsg(null);
    try {
      const inner = activeConfig.config;
      const currentParams =
        optimizedParams ??
        (inner.fsrsParams_6 && inner.fsrsParams_6.length > 0
          ? inner.fsrsParams_6
          : inner.fsrsParams_5 && inner.fsrsParams_5.length > 0
            ? inner.fsrsParams_5
            : inner.fsrsParams_4 && inner.fsrsParams_4.length > 0
              ? inner.fsrsParams_4
              : []);
      const search = inner.paramSearch?.trim() || `preset:"${activeConfig.name || 'Default'}"`;
      const res = await anki.computeFsrsWeights({
        search,
        currentParams,
        ignoreRevlogsBeforeMs: parseDateToMs(inner.ignoreRevlogsBeforeDate),
        numOfRelearningSteps: relearnStepsParsed.steps.length,
        healthCheck: Boolean(data?.fsrsHealthCheck),
      });

      const count = res.fsrsItems ?? 0;
      if (res.params && res.params.length > 0) {
        setOptimizedParams(res.params);
        setDirty(true);
        setOptimizeStatusMsg(
          `학습 기록 ${count.toLocaleString('ko-KR')}건을 분석해 맞춤 간격을 계산했습니다. '저장'을 누르면 적용됩니다.`
        );
      } else {
        setOptimizeStatusMsg(
          `아직 복습 기록이 부족합니다(${count.toLocaleString('ko-KR')}건). 카드가 더 쌓이면 자동으로 더 정확해집니다.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('부족') || msg.includes('enough') || msg.includes('review')) {
        setOptimizeStatusMsg(
          '아직 복습 기록이 부족합니다. 카드가 더 쌓이면 자동으로 더 정확해집니다.'
        );
      } else {
        setOptimizeStatusMsg(
          msg || '복습 기록을 분석하지 못했습니다. 기록이 더 쌓인 뒤 다시 시도해 주세요.'
        );
      }
    } finally {
      setOptimizing(false);
    }
  };

  const handleComputeOptimalRetention = async () => {
    if (!activeConfig?.config || computingRetention) return;
    setComputingRetention(true);
    setOptimizeStatusMsg(null);
    try {
      const inner = activeConfig.config;
      const currentParams =
        optimizedParams ??
        (inner.fsrsParams_6 && inner.fsrsParams_6.length > 0
          ? inner.fsrsParams_6
          : inner.fsrsParams_5 && inner.fsrsParams_5.length > 0
            ? inner.fsrsParams_5
            : inner.fsrsParams_4 && inner.fsrsParams_4.length > 0
              ? inner.fsrsParams_4
              : []);
      const search = inner.paramSearch?.trim() || `preset:"${activeConfig.name || 'Default'}"`;
      const committedNew = parseAndClampInt(
        newPerDayDraft,
        newPerDay,
        RANGE_NEW_PER_DAY.min,
        RANGE_NEW_PER_DAY.max
      );
      const committedRev = parseAndClampInt(
        reviewsPerDayDraft,
        reviewsPerDay,
        RANGE_REVIEWS_PER_DAY.min,
        RANGE_REVIEWS_PER_DAY.max
      );
      const committedMaxInt = parseAndClampInt(
        maxReviewIntervalDraft,
        maxReviewInterval,
        RANGE_MAX_INTERVAL.min,
        RANGE_MAX_INTERVAL.max
      );
      const committedLeech = parseAndClampInt(
        leechThresholdDraft,
        leechThreshold,
        RANGE_LEECH_THRESHOLD.min,
        RANGE_LEECH_THRESHOLD.max
      );
      const optimal = await anki.computeOptimalRetention({
        params: currentParams,
        desiredRetention: Number(
          (
            Math.min(
              RANGE_RETENTION_PCT.max,
              Math.max(RANGE_RETENTION_PCT.min, desiredRetentionPct)
            ) / 100
          ).toFixed(2)
        ),
        deckSize: 1000,
        daysToSimulate: 365,
        newLimit: Math.max(1, committedNew),
        reviewLimit: Math.max(1, committedRev),
        maxInterval: Math.max(1, committedMaxInt),
        search,
        newCardsIgnoreReviewLimit: Boolean(data?.newCardsIgnoreReviewLimit),
        easyDaysPercentages: inner.easyDaysPercentages ?? [1, 1, 1, 1, 1, 1, 1],
        reviewOrder,
        suspendAfterLapseCount: leechAction === 0 ? committedLeech : 0,
        historicalRetention: inner.historicalRetention ?? 0.9,
        learningStepCount: learnStepsParsed.steps.length,
        relearningStepCount: relearnStepsParsed.steps.length,
      });
      const pct = Math.min(
        RANGE_RETENTION_PCT.max,
        Math.max(RANGE_RETENTION_PCT.min, Math.round(optimal * 100))
      );
      setDesiredRetentionPct(pct);
      markEdited('desiredRetention');
      setOptimizeStatusMsg(
        `최소 시간으로 최대 암기 효율을 내는 추천 목표 기억률은 ${pct}%입니다.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setOptimizeStatusMsg(
        msg || '복습 기록이 더 쌓이면 최적 목표 기억률을 계산할 수 있습니다.'
      );
    } finally {
      setComputingRetention(false);
    }
  };

  const handleSave = async () => {
    if (!data || !activeConfig || saving) return;
    if (
      (editedFieldsRef.current.has('learnSteps') && !learnStepsParsed.valid) ||
      (editedFieldsRef.current.has('relearnSteps') && !relearnStepsParsed.valid)
    ) {
      showToast('학습 간격 형식을 확인해 주세요. (예: 1m 10m)', 'error');
      return;
    }

    // Commit any active string drafts before building the save payload
    const committedNew = parseAndClampInt(
      newPerDayDraft,
      newPerDay,
      RANGE_NEW_PER_DAY.min,
      RANGE_NEW_PER_DAY.max
    );
    const committedRev = parseAndClampInt(
      reviewsPerDayDraft,
      reviewsPerDay,
      RANGE_REVIEWS_PER_DAY.min,
      RANGE_REVIEWS_PER_DAY.max
    );
    const committedMaxInt = parseAndClampInt(
      maxReviewIntervalDraft,
      maxReviewInterval,
      RANGE_MAX_INTERVAL.min,
      RANGE_MAX_INTERVAL.max
    );
    const committedLeech = parseAndClampInt(
      leechThresholdDraft,
      leechThreshold,
      RANGE_LEECH_THRESHOLD.min,
      RANGE_LEECH_THRESHOLD.max
    );
    const committedCap = parseAndClampInt(
      capAnswerSecsDraft,
      capAnswerSecs,
      RANGE_CAP_ANSWER_SECS.min,
      RANGE_CAP_ANSWER_SECS.max
    );

    setNewPerDay(committedNew);
    setNewPerDayDraft(String(committedNew));
    setReviewsPerDay(committedRev);
    setReviewsPerDayDraft(String(committedRev));
    setMaxReviewInterval(committedMaxInt);
    setMaxReviewIntervalDraft(String(committedMaxInt));
    setLeechThreshold(committedLeech);
    setLeechThresholdDraft(String(committedLeech));
    setCapAnswerSecs(committedCap);
    setCapAnswerSecsDraft(String(committedCap));

    setSaving(true);
    try {
      const targetConfigId = toNumber(activeConfig.id);
      const edited = editedFieldsRef.current;

      const updatedList = (data.allConfig ?? []).map((entry) => {
        const cfg = entry.config;
        if (!cfg) return {};
        if (toNumber(cfg.id) !== targetConfigId) {
          return cfg;
        }
        const inner = cfg.config ?? {};
        // Preserve every untouched Anki field verbatim; only overwrite fields the user edited.
        const nextInner: typeof inner = { ...inner };

        if (edited.has('newPerDay')) nextInner.newPerDay = committedNew;
        if (edited.has('reviewsPerDay')) nextInner.reviewsPerDay = committedRev;
        if (edited.has('learnSteps')) nextInner.learnSteps = learnStepsParsed.steps;
        if (edited.has('relearnSteps')) nextInner.relearnSteps = relearnStepsParsed.steps;
        if (edited.has('desiredRetention')) {
          const clampedPct = Math.min(
            RANGE_RETENTION_PCT.max,
            Math.max(RANGE_RETENTION_PCT.min, desiredRetentionPct)
          );
          nextInner.desiredRetention = Number((clampedPct / 100).toFixed(2));
        }
        if (edited.has('maximumReviewInterval')) nextInner.maximumReviewInterval = committedMaxInt;
        if (edited.has('newCardGatherPriority')) nextInner.newCardGatherPriority = newGatherPriority;
        if (edited.has('newCardSortOrder')) nextInner.newCardSortOrder = newSortOrder;
        if (edited.has('newMix')) nextInner.newMix = newMix;
        if (edited.has('reviewOrder')) nextInner.reviewOrder = reviewOrder;
        if (edited.has('leechThreshold')) nextInner.leechThreshold = committedLeech;
        if (edited.has('leechAction')) nextInner.leechAction = leechAction;
        if (edited.has('buryNew')) nextInner.buryNew = buryNew;
        if (edited.has('buryReviews')) nextInner.buryReviews = buryReviews;
        if (edited.has('buryInterdayLearning')) {
          nextInner.buryInterdayLearning = buryInterdayLearning;
        }
        if (edited.has('disableAutoplay')) nextInner.disableAutoplay = disableAutoplay;
        if (edited.has('skipQuestionWhenReplayingAnswer')) {
          nextInner.skipQuestionWhenReplayingAnswer = skipQuestionAudio;
        }
        if (edited.has('showTimer')) nextInner.showTimer = showTimer;
        if (edited.has('stopTimerOnAnswer')) nextInner.stopTimerOnAnswer = stopTimerOnAnswer;
        if (edited.has('capAnswerTimeToSecs')) nextInner.capAnswerTimeToSecs = committedCap;

        if (optimizedParams && optimizedParams.length > 0) {
          if (optimizedParams.length >= 21 || (inner.fsrsParams_6?.length ?? 0) > 0) {
            nextInner.fsrsParams_6 = optimizedParams;
          } else {
            nextInner.fsrsParams_5 = optimizedParams;
          }
        }

        return {
          ...cfg,
          config: nextInner,
        };
      });

      // Anki assigns configs[0] to targetDeckId (and children when APPLY_TO_CHILDREN).
      const selectedIdx = updatedList.findIndex(
        (c) => toNumber((c as anki.DeckConfig).id) === targetConfigId
      );
      const orderedConfigs =
        selectedIdx > 0
          ? [
              updatedList[selectedIdx],
              ...updatedList.slice(0, selectedIdx),
              ...updatedList.slice(selectedIdx + 1),
            ]
          : updatedList;

      await anki.updateDeckConfigs({
        targetDeckId: deckId,
        configs: orderedConfigs,
        removedConfigIds: [],
        mode: applyToSubdecks
          ? UpdateDeckConfigsMode.UPDATE_DECK_CONFIGS_MODE_APPLY_TO_CHILDREN
          : UpdateDeckConfigsMode.UPDATE_DECK_CONFIGS_MODE_NORMAL,
        cardStateCustomizer: data.cardStateCustomizer ?? '',
        limits: data.currentDeck?.limits ?? undefined,
        newCardsIgnoreReviewLimit: Boolean(data.newCardsIgnoreReviewLimit),
        fsrs: fsrsEnabled,
        applyAllParentLimits: Boolean(data.applyAllParentLimits),
        fsrsReschedule: false,
        fsrsHealthCheck: Boolean(data.fsrsHealthCheck),
      });

      bumpCollection();
      setDirty(false);
      showToast(
        applyToSubdecks
          ? '학습 옵션을 저장하고 하위 덱에도 적용했습니다.'
          : '학습 옵션을 저장했습니다.',
        'success'
      );
      goBack(`#/deck/${deckId}`, { force: true });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '학습 옵션을 저장하지 못했습니다.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  if (showOfficialIframe) {
    return (
      <AnkiIframeView
        path={`/deck-options/${deckId}`}
        title="Anki 원본 고급 설정"
        onClose={() => {
          setShowOfficialIframe(false);
          void loadOptions({ quiet: Boolean(data) });
        }}
      />
    );
  }

  const deckName = data?.currentDeck?.name || '덱';
  const limits = data?.currentDeck?.limits;
  const daysSinceOpt = data?.daysSinceLastFsrsOptimize ?? 0;
  const sliderRetentionValue = Math.min(
    RANGE_RETENTION_PCT.max,
    Math.max(RANGE_RETENTION_PCT.min, desiredRetentionPct)
  );

  return (
    <div className="amgi-options-shell">
      <header className="amgi-topbar amgi-options-topbar">
        <div className="amgi-topbar-left">
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            onClick={() => goBack(`#/deck/${deckId}`)}
            aria-label="뒤로 가기"
          >
            <IconArrowLeft size={20} />
          </button>
          <div className="amgi-options-topbar-title-wrap">
            <h1 className="amgi-topbar-title">학습 옵션</h1>
            <span className="amgi-options-deck-sub">{deckName}</span>
          </div>
        </div>
        <div className="amgi-topbar-right">
          <button
            type="button"
            className="amgi-btn amgi-btn-primary amgi-options-save-btn"
            data-dirty={dirty ? 'true' : undefined}
            disabled={loading || saving || Boolean(loadError)}
            onClick={() => void handleSave()}
          >
            {!saving && <IconCheck size={16} />}
            <span>{saving ? '저장 중...' : '저장'}</span>
          </button>
        </div>
      </header>

      <main className="amgi-options-body">
        {loading && !data ? (
          <div className="amgi-options-loading">
            {!isEink && <div className="spinner" aria-hidden="true" />}
            <span>덱 옵션을 불러오는 중...</span>
          </div>
        ) : loadError && !data ? (
          <>
            <ErrorState
              title="덱 설정을 불러오지 못했습니다"
              message={loadError}
              errorLog={loadErrorLog}
              onRetry={() => void loadOptions()}
            />
            <div className="amgi-options-escape">
              <p className="amgi-options-escape-hint">
                문제가 계속되면 Anki 원본 고급 설정 화면을 바로 열 수 있습니다.
              </p>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={() => setShowOfficialIframe(true)}
              >
                Anki 원본 고급 설정 열기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Preset Selector & Subdeck Apply */}
            <SectionCard title="설정 묶음(프리셋) 및 적용 범위">
              {(data?.allConfig?.length ?? 0) > 1 ? (
                <div className="amgi-options-subrow">
                  <label htmlFor="opt-preset-select" className="amgi-options-subrow-label">
                    사용 중인 설정 묶음 (프리셋)
                  </label>
                  <span className="amgi-options-subrow-desc">
                    여러 덱이 함께 공유하는 학습 설정 묶음입니다
                  </span>
                  <select
                    id="opt-preset-select"
                    className="amgi-select amgi-options-select"
                    value={selectedConfigId}
                    onChange={(e) => handleSelectPreset(Number(e.target.value))}
                  >
                    {(data?.allConfig ?? []).map((entry) => {
                      const cid = toNumber(entry.config?.id);
                      const count = entry.useCount ?? 0;
                      return (
                        <option key={cid} value={cid}>
                          {entry.config?.name || '기본'} ({count}개 덱 사용)
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="amgi-options-subrow">
                  <div className="amgi-options-subrow-top">
                    <span className="amgi-options-subrow-label">현재 설정 묶음 (프리셋)</span>
                    <span
                      className="amgi-options-subrow-desc"
                      style={{ fontWeight: 700, color: 'var(--text)' }}
                    >
                      {activeConfig?.name || '기본'} ({activeUseCount}개 덱)
                    </span>
                  </div>
                  <span className="amgi-options-subrow-desc">
                    여러 덱이 함께 공유하는 학습 설정 묶음입니다
                  </span>
                </div>
              )}
              <SettingRow
                label="하위 덱 모두에 적용"
                description="저장할 때 이 덱 아래에 있는 모든 하위 덱에도 같은 설정 묶음을 적용합니다"
                htmlFor="opt-apply-subdecks"
                control={
                  <Switch
                    id="opt-apply-subdecks"
                    checked={applyToSubdecks}
                    onChange={(next) => {
                      setApplyToSubdecks(next);
                      setDirty(true);
                    }}
                  />
                }
              />
            </SectionCard>

            {/* Quick-start Recommended Presets */}
            <SectionCard title="빠른 추천 설정">
              <div className="amgi-preset-strip-wrap">
                <div className="amgi-preset-strip">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="amgi-preset-chip"
                      onClick={() => handleApplyQuickPreset(preset)}
                    >
                      <span className="amgi-preset-chip-title">{preset.title}</span>
                      <span className="amgi-preset-chip-counts">{preset.counts}</span>
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Group 1: 하루 학습량 */}
            <SectionCard title="하루 학습량">
              <div className="amgi-options-subrow">
                <div className="amgi-options-subrow-top">
                  <label htmlFor="opt-new-per-day" className="amgi-options-subrow-label">
                    하루 새 카드
                  </label>
                  <div className="amgi-num-stepper">
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 새 카드 줄이기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          newPerDayDraft,
                          newPerDay,
                          RANGE_NEW_PER_DAY.min,
                          RANGE_NEW_PER_DAY.max
                        );
                        const next = Math.max(RANGE_NEW_PER_DAY.min, base - 5);
                        setNewPerDay(next);
                        setNewPerDayDraft(String(next));
                        markEdited('newPerDay');
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-new-per-day"
                      type="text"
                      inputMode="numeric"
                      className="amgi-num-step-input"
                      value={newPerDayDraft}
                      onChange={(e) => {
                        setNewPerDayDraft(e.target.value);
                        markEdited('newPerDay');
                      }}
                      onBlur={() => {
                        const committed = parseAndClampInt(
                          newPerDayDraft,
                          newPerDay,
                          RANGE_NEW_PER_DAY.min,
                          RANGE_NEW_PER_DAY.max
                        );
                        setNewPerDay(committed);
                        setNewPerDayDraft(String(committed));
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 새 카드 늘리기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          newPerDayDraft,
                          newPerDay,
                          RANGE_NEW_PER_DAY.min,
                          RANGE_NEW_PER_DAY.max
                        );
                        const next = Math.min(RANGE_NEW_PER_DAY.max, base + 5);
                        setNewPerDay(next);
                        setNewPerDayDraft(String(next));
                        markEdited('newPerDay');
                      }}
                      data-compact="true"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="amgi-options-subrow-desc">
                  매일 새로 시작할 카드 수 (보통 10~30장)
                </span>
              </div>
              {limits?.newTodayActive && (
                <div className="amgi-options-inline-note">
                  <span className="amgi-options-today-badge">
                    오늘만 {limits.newToday ?? newPerDay}장으로 임시 변경됨
                  </span>
                </div>
              )}

              <div className="amgi-options-subrow">
                <div className="amgi-options-subrow-top">
                  <label htmlFor="opt-reviews-per-day" className="amgi-options-subrow-label">
                    하루 최대 복습
                  </label>
                  <div className="amgi-num-stepper">
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 최대 복습 줄이기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          reviewsPerDayDraft,
                          reviewsPerDay,
                          RANGE_REVIEWS_PER_DAY.min,
                          RANGE_REVIEWS_PER_DAY.max
                        );
                        const next = Math.max(RANGE_REVIEWS_PER_DAY.min, base - 20);
                        setReviewsPerDay(next);
                        setReviewsPerDayDraft(String(next));
                        markEdited('reviewsPerDay');
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-reviews-per-day"
                      type="text"
                      inputMode="numeric"
                      className="amgi-num-step-input"
                      value={reviewsPerDayDraft}
                      onChange={(e) => {
                        setReviewsPerDayDraft(e.target.value);
                        markEdited('reviewsPerDay');
                      }}
                      onBlur={() => {
                        const committed = parseAndClampInt(
                          reviewsPerDayDraft,
                          reviewsPerDay,
                          RANGE_REVIEWS_PER_DAY.min,
                          RANGE_REVIEWS_PER_DAY.max
                        );
                        setReviewsPerDay(committed);
                        setReviewsPerDayDraft(String(committed));
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 최대 복습 늘리기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          reviewsPerDayDraft,
                          reviewsPerDay,
                          RANGE_REVIEWS_PER_DAY.min,
                          RANGE_REVIEWS_PER_DAY.max
                        );
                        const next = Math.min(RANGE_REVIEWS_PER_DAY.max, base + 20);
                        setReviewsPerDay(next);
                        setReviewsPerDayDraft(String(next));
                        markEdited('reviewsPerDay');
                      }}
                      data-compact="true"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="amgi-options-subrow-desc">
                  밀리지 않도록 새 카드의 10배(예: 200) 권장
                </span>
              </div>
              {limits?.reviewTodayActive && (
                <div className="amgi-options-inline-note">
                  <span className="amgi-options-today-badge">
                    오늘만 {limits.reviewToday ?? reviewsPerDay}장으로 임시 변경됨
                  </span>
                </div>
              )}
            </SectionCard>

            {/* Group 2: 처음 외우는 간격 */}
            <SectionCard title="처음 외우는 간격">
              <div className="amgi-options-subrow">
                <label htmlFor="opt-learn-steps" className="amgi-options-subrow-label">
                  새 카드 학습 단계
                </label>
                <span className="amgi-options-subrow-desc">
                  새 카드를 처음 볼 때의 짧은 간격입니다 (예: 1m 10m · 비우면 FSRS 자동)
                </span>
                <input
                  id="opt-learn-steps"
                  type="text"
                  className="amgi-steps-input"
                  value={learnStepsText}
                  onChange={(e) => {
                    setLearnStepsText(e.target.value);
                    markEdited('learnSteps');
                  }}
                  placeholder="1m 10m"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {!learnStepsParsed.valid && (
                  <span className="amgi-options-error-hint">
                    예시처럼 숫자+단위(1m 10m)로 입력해 주세요.
                  </span>
                )}
              </div>

              <div className="amgi-options-subrow">
                <label htmlFor="opt-relearn-steps" className="amgi-options-subrow-label">
                  틀린 카드 재학습
                </label>
                <span className="amgi-options-subrow-desc">
                  외웠던 카드를 틀렸을 때 다시 확인하는 간격입니다 (예: 10m)
                </span>
                <input
                  id="opt-relearn-steps"
                  type="text"
                  className="amgi-steps-input"
                  value={relearnStepsText}
                  onChange={(e) => {
                    setRelearnStepsText(e.target.value);
                    markEdited('relearnSteps');
                  }}
                  placeholder="10m"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {!relearnStepsParsed.valid && (
                  <span className="amgi-options-error-hint">
                    예시처럼 숫자+단위(1m 10m)로 입력해 주세요.
                  </span>
                )}
              </div>
            </SectionCard>

            {/* Group 3: 스마트 복습 간격 (FSRS) */}
            <SectionCard title="스마트 복습 간격 (FSRS)">
              <SettingRow
                label="FSRS 간격 계산 켜기"
                description="기억 곡선을 분석해 잊기 직전에만 복습하도록 간격을 계산하는 차세대 방식입니다"
                htmlFor="opt-fsrs-enabled"
                control={
                  <Switch
                    id="opt-fsrs-enabled"
                    checked={fsrsEnabled}
                    onChange={(next) => {
                      setFsrsEnabled(next);
                      setDirty(true);
                    }}
                  />
                }
              />

              {fsrsEnabled && !initialFsrsEnabled && (
                <div className="amgi-options-inline-note">
                  켜더라도 기존 카드 일정이 갑자기 바뀌지 않고, 앞으로 학습할 때부터 반영됩니다.
                </div>
              )}

              {!fsrsEnabled ? (
                <div className="amgi-options-subrow amgi-options-inactive-hint">
                  <div className="amgi-options-subrow-top">
                    <span className="amgi-options-subrow-label">목표 기억률</span>
                    <span className="amgi-options-status-tag">꺼짐</span>
                  </div>
                  <span className="amgi-options-subrow-desc">
                    위 스위치를 켜면 목표 기억률과 개인 맞춤 최적화를 사용할 수 있습니다
                  </span>
                </div>
              ) : (
                <>
                  <div className="amgi-options-subrow">
                    <div className="amgi-options-subrow-top">
                      <label htmlFor="opt-retention-slider" className="amgi-options-subrow-label">
                        목표 기억률
                      </label>
                      <span className="amgi-retention-badge">{desiredRetentionPct}%</span>
                    </div>
                    <input
                      id="opt-retention-slider"
                      type="range"
                      min={RANGE_RETENTION_PCT.min}
                      max={RANGE_RETENTION_PCT.max}
                      step={1}
                      className="amgi-retention-slider"
                      value={sliderRetentionValue}
                      onChange={(e) => {
                        setDesiredRetentionPct(Number(e.target.value));
                        markEdited('desiredRetention');
                      }}
                    />
                    <span className="amgi-options-subrow-desc">
                      {getRetentionHint(desiredRetentionPct)}
                    </span>
                  </div>

                  <div className="amgi-options-subrow">
                    <div className="amgi-options-subrow-top">
                      <label htmlFor="opt-max-interval" className="amgi-options-subrow-label">
                        최대 복습 간격(일)
                      </label>
                      <input
                        id="opt-max-interval"
                        type="text"
                        inputMode="numeric"
                        className="amgi-num-step-input"
                        style={{ width: 92 }}
                        value={maxReviewIntervalDraft}
                        onChange={(e) => {
                          setMaxReviewIntervalDraft(e.target.value);
                          markEdited('maximumReviewInterval');
                        }}
                        onBlur={() => {
                          const committed = parseAndClampInt(
                            maxReviewIntervalDraft,
                            maxReviewInterval,
                            RANGE_MAX_INTERVAL.min,
                            RANGE_MAX_INTERVAL.max
                          );
                          setMaxReviewInterval(committed);
                          setMaxReviewIntervalDraft(String(committed));
                        }}
                      />
                    </div>
                    <span className="amgi-options-subrow-desc">
                      카드가 이 일수보다 더 멀리 밀리지 않도록 상한을 둡니다 (기본 36500일)
                    </span>
                  </div>

                  <div className="amgi-options-subrow">
                    <div className="amgi-options-subrow-top">
                      <span className="amgi-options-subrow-label">내 기록으로 간격 최적화</span>
                    </div>
                    <span className="amgi-options-subrow-desc">
                      {daysSinceOpt > 0
                        ? `마지막 최적화: ${daysSinceOpt}일 전 · 내 복습 기록을 분석해 FSRS 계산 수치를 개인화합니다`
                        : '내 복습 기록을 분석해 FSRS 계산 수치(파라미터)를 나에게 맞게 조정합니다'}
                    </span>
                    <div className="amgi-options-btn-row">
                      <button
                        type="button"
                        className="amgi-btn amgi-btn-secondary"
                        disabled={optimizing || computingRetention}
                        onClick={() => void handleOptimizeFsrs()}
                      >
                        <IconSpark size={16} />
                        <span>{optimizing ? '기록 분석 중...' : '맞춤 간격 최적화'}</span>
                      </button>
                      <button
                        type="button"
                        className="amgi-btn amgi-btn-secondary"
                        disabled={optimizing || computingRetention}
                        onClick={() => void handleComputeOptimalRetention()}
                      >
                        <span>
                          {computingRetention ? '계산 중...' : '최적 기억률 계산'}
                        </span>
                      </button>
                    </div>
                    {optimizeStatusMsg && (
                      <span className="amgi-options-subrow-desc" style={{ color: 'var(--text)' }}>
                        {optimizeStatusMsg}
                      </span>
                    )}
                  </div>
                </>
              )}
            </SectionCard>

            {/* Group 4: 카드 표시 순서 (Display Order) */}
            <SectionCard title="카드 표시 순서">
              <div className="amgi-options-subrow">
                <label htmlFor="opt-new-gather" className="amgi-options-subrow-label">
                  새 카드 수집 순서
                </label>
                <select
                  id="opt-new-gather"
                  className="amgi-select amgi-options-select"
                  value={newGatherPriority}
                  onChange={(e) => {
                    setNewGatherPriority(Number(e.target.value));
                    markEdited('newCardGatherPriority');
                  }}
                >
                  <option value={0}>덱 순서대로</option>
                  <option value={1}>먼저 추가한 카드부터 (오름차순)</option>
                  <option value={2}>최근 추가한 카드부터 (내림차순)</option>
                  <option value={3}>무작위 노트</option>
                  <option value={4}>무작위 카드</option>
                  <option value={5}>덱 순서 + 무작위 노트</option>
                </select>
              </div>

              <div className="amgi-options-subrow">
                <label htmlFor="opt-new-sort" className="amgi-options-subrow-label">
                  새 카드 정렬 순서
                </label>
                <select
                  id="opt-new-sort"
                  className="amgi-select amgi-options-select"
                  value={newSortOrder}
                  onChange={(e) => {
                    setNewSortOrder(Number(e.target.value));
                    markEdited('newCardSortOrder');
                  }}
                >
                  <option value={0}>카드 템플릿 순서대로</option>
                  <option value={1}>수집 순서 그대로 유지</option>
                  <option value={2}>템플릿 순 + 무작위</option>
                  <option value={3}>무작위 노트 + 템플릿 순</option>
                  <option value={4}>완전 무작위</option>
                </select>
              </div>

              <div className="amgi-options-subrow">
                <label htmlFor="opt-new-mix" className="amgi-options-subrow-label">
                  새 카드와 복습 순서
                </label>
                <select
                  id="opt-new-mix"
                  className="amgi-select amgi-options-select"
                  value={newMix}
                  onChange={(e) => {
                    setNewMix(Number(e.target.value));
                    markEdited('newMix');
                  }}
                >
                  <option value={0}>복습 카드와 섞어서 표시</option>
                  <option value={1}>복습 완료 후 새 카드 표시</option>
                  <option value={2}>새 카드 먼저 표시</option>
                </select>
              </div>

              <div className="amgi-options-subrow">
                <label htmlFor="opt-review-order" className="amgi-options-subrow-label">
                  복습 카드 정렬 순서
                </label>
                <select
                  id="opt-review-order"
                  className="amgi-select amgi-options-select"
                  value={reviewOrder}
                  onChange={(e) => {
                    setReviewOrder(Number(e.target.value));
                    markEdited('reviewOrder');
                  }}
                >
                  <option value={0}>예정일 순 + 무작위</option>
                  <option value={1}>예정일 순 + 덱 순서</option>
                  <option value={2}>덱 순서 + 예정일 순</option>
                  <option value={3}>짧은 복습 간격 먼저</option>
                  <option value={4}>긴 복습 간격 먼저</option>
                  <option value={7}>기억률 낮은 카드 먼저 (FSRS 추천)</option>
                  <option value={11}>기억률 높은 카드 먼저</option>
                  <option value={12}>상대적 연체 비율 높은 순</option>
                  <option value={8}>무작위</option>
                </select>
              </div>
            </SectionCard>

            {/* Group 5: 자주 틀리는 카드 (거머리 / Leech) */}
            <SectionCard title="자주 틀리는 카드 (거머리)">
              <div className="amgi-options-subrow">
                <div className="amgi-options-subrow-top">
                  <label htmlFor="opt-leech-threshold" className="amgi-options-subrow-label">
                    반복 오답 기준 횟수
                  </label>
                  <div className="amgi-num-stepper">
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="반복 오답 기준 횟수 줄이기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          leechThresholdDraft,
                          leechThreshold,
                          RANGE_LEECH_THRESHOLD.min,
                          RANGE_LEECH_THRESHOLD.max
                        );
                        const next = Math.max(RANGE_LEECH_THRESHOLD.min, base - 1);
                        setLeechThreshold(next);
                        setLeechThresholdDraft(String(next));
                        markEdited('leechThreshold');
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-leech-threshold"
                      type="text"
                      inputMode="numeric"
                      className="amgi-num-step-input"
                      value={leechThresholdDraft}
                      onChange={(e) => {
                        setLeechThresholdDraft(e.target.value);
                        markEdited('leechThreshold');
                      }}
                      onBlur={() => {
                        const committed = parseAndClampInt(
                          leechThresholdDraft,
                          leechThreshold,
                          RANGE_LEECH_THRESHOLD.min,
                          RANGE_LEECH_THRESHOLD.max
                        );
                        setLeechThreshold(committed);
                        setLeechThresholdDraft(String(committed));
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="반복 오답 기준 횟수 늘리기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          leechThresholdDraft,
                          leechThreshold,
                          RANGE_LEECH_THRESHOLD.min,
                          RANGE_LEECH_THRESHOLD.max
                        );
                        const next = Math.min(RANGE_LEECH_THRESHOLD.max, base + 1);
                        setLeechThreshold(next);
                        setLeechThresholdDraft(String(next));
                        markEdited('leechThreshold');
                      }}
                      data-compact="true"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="amgi-options-subrow-desc">
                  외웠던 카드를 이 횟수만큼 반복해서 틀리면 자주 틀리는 카드(거머리)로 표시합니다
                </span>
              </div>

              <div className="amgi-options-subrow">
                <label htmlFor="opt-leech-action" className="amgi-options-subrow-label">
                  자주 틀리는 카드 처리 방법
                </label>
                <select
                  id="opt-leech-action"
                  className="amgi-select amgi-options-select"
                  value={leechAction}
                  onChange={(e) => {
                    setLeechAction(Number(e.target.value));
                    markEdited('leechAction');
                  }}
                >
                  <option value={1}>태그만 붙이고 계속 학습</option>
                  <option value={0}>자동으로 일시 중단</option>
                </select>
              </div>
            </SectionCard>

            {/* Group 6: 같은 날 카드 미루기 */}
            <SectionCard title="같은 날 카드 미루기">
              <SettingRow
                label="같은 노트 새 카드 미루기"
                description="같은 단어의 앞·뒤 새 카드가 같은 날 연달아 나오지 않게 내일로 미룹니다"
                htmlFor="opt-bury-new"
                control={
                  <Switch
                    id="opt-bury-new"
                    checked={buryNew}
                    onChange={(next) => {
                      setBuryNew(next);
                      markEdited('buryNew');
                    }}
                  />
                }
              />
              <SettingRow
                label="같은 노트 복습 미루기"
                description="같은 노트의 복습 카드를 내일로 분산해 힌트가 겹치지 않게 합니다"
                htmlFor="opt-bury-reviews"
                control={
                  <Switch
                    id="opt-bury-reviews"
                    checked={buryReviews}
                    onChange={(next) => {
                      setBuryReviews(next);
                      markEdited('buryReviews');
                    }}
                  />
                }
              />
              <SettingRow
                label="학습 중인 형제 미루기"
                description="하루 이상 학습 중인 같은 노트의 다른 카드도 내일로 미룹니다"
                htmlFor="opt-bury-interday"
                control={
                  <Switch
                    id="opt-bury-interday"
                    checked={buryInterdayLearning}
                    onChange={(next) => {
                      setBuryInterdayLearning(next);
                      markEdited('buryInterdayLearning');
                    }}
                  />
                }
              />
            </SectionCard>

            {/* Group 7: 소리 및 시간 측정 */}
            <SectionCard title="소리 및 시간 측정">
              <SettingRow
                label="소리 자동 재생 끄기"
                description="이 덱에서는 카드를 열어도 음성이 자동으로 나오지 않습니다"
                htmlFor="opt-disable-autoplay"
                control={
                  <Switch
                    id="opt-disable-autoplay"
                    checked={disableAutoplay}
                    onChange={(next) => {
                      setDisableAutoplay(next);
                      markEdited('disableAutoplay');
                    }}
                  />
                }
              />
              <SettingRow
                label="정답 음성 재생 시 질문 음성 건너뛰기"
                description="정답 화면에서 소리를 다시 들을 때 앞면(질문) 음성은 건너뛰고 정답 음성만 재생합니다"
                htmlFor="opt-skip-question-audio"
                control={
                  <Switch
                    id="opt-skip-question-audio"
                    checked={skipQuestionAudio}
                    onChange={(next) => {
                      setSkipQuestionAudio(next);
                      markEdited('skipQuestionWhenReplayingAnswer');
                    }}
                  />
                }
              />
              <SettingRow
                label="카드 타이머 표시"
                description="카드를 푸는 동안 걸린 시간을 화면 위에 작게 보여줍니다"
                htmlFor="opt-show-timer"
                control={
                  <Switch
                    id="opt-show-timer"
                    checked={showTimer}
                    onChange={(next) => {
                      setShowTimer(next);
                      markEdited('showTimer');
                    }}
                  />
                }
              />
              <SettingRow
                label="정답 확인 시 멈춤"
                description="정답 버튼을 누르기 전, 정답을 본 순간에 시간 측정을 멈춥니다"
                htmlFor="opt-stop-timer-answer"
                control={
                  <Switch
                    id="opt-stop-timer-answer"
                    checked={stopTimerOnAnswer}
                    onChange={(next) => {
                      setStopTimerOnAnswer(next);
                      markEdited('stopTimerOnAnswer');
                    }}
                  />
                }
              />
              <div className="amgi-options-subrow">
                <div className="amgi-options-subrow-top">
                  <label htmlFor="opt-cap-answer-secs" className="amgi-options-subrow-label">
                    최대 기록 시간(초)
                  </label>
                  <div className="amgi-num-stepper">
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="최대 기록 시간 줄이기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          capAnswerSecsDraft,
                          capAnswerSecs,
                          RANGE_CAP_ANSWER_SECS.min,
                          RANGE_CAP_ANSWER_SECS.max
                        );
                        const next = Math.max(RANGE_CAP_ANSWER_SECS.min, base - 10);
                        setCapAnswerSecs(next);
                        setCapAnswerSecsDraft(String(next));
                        markEdited('capAnswerTimeToSecs');
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-cap-answer-secs"
                      type="text"
                      inputMode="numeric"
                      className="amgi-num-step-input"
                      value={capAnswerSecsDraft}
                      onChange={(e) => {
                        setCapAnswerSecsDraft(e.target.value);
                        markEdited('capAnswerTimeToSecs');
                      }}
                      onBlur={() => {
                        const committed = parseAndClampInt(
                          capAnswerSecsDraft,
                          capAnswerSecs,
                          RANGE_CAP_ANSWER_SECS.min,
                          RANGE_CAP_ANSWER_SECS.max
                        );
                        setCapAnswerSecs(committed);
                        setCapAnswerSecsDraft(String(committed));
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="최대 기록 시간 늘리기"
                      onClick={() => {
                        const base = parseAndClampInt(
                          capAnswerSecsDraft,
                          capAnswerSecs,
                          RANGE_CAP_ANSWER_SECS.min,
                          RANGE_CAP_ANSWER_SECS.max
                        );
                        const next = Math.min(RANGE_CAP_ANSWER_SECS.max, base + 10);
                        setCapAnswerSecs(next);
                        setCapAnswerSecsDraft(String(next));
                        markEdited('capAnswerTimeToSecs');
                      }}
                      data-compact="true"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="amgi-options-subrow-desc">
                  통계에 기록되는 카드당 최대 시간입니다 (1~3600초)
                </span>
              </div>
            </SectionCard>

            {/* Bottom Escape Hatch */}
            <div className="amgi-options-escape">
              <p className="amgi-options-escape-hint">
                쉬어가는 요일, 프리셋 추가·삭제, 고급 간격 계산 등 세부 설정이 필요할 때 씁니다.
              </p>
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary"
                onClick={handleOpenOfficialIframe}
              >
                Anki 원본 고급 설정 열기
              </button>
            </div>
          </>
        )}
      </main>

      {/* Discard unsaved changes confirm */}
      <SheetOrDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="저장하지 않고 나갈까요?"
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
                goBack(`#/deck/${deckId}`, { force: true });
              }}
            >
              버리고 나가기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          저장하지 않은 학습 옵션 변경 사항이 사라집니다.
        </p>
      </SheetOrDialog>

      {/* Confirm before opening official Anki iframe while dirty */}
      <SheetOrDialog
        open={officialConfirmOpen}
        onClose={() => setOfficialConfirmOpen(false)}
        title="변경 사항을 버리고 고급 설정을 열까요?"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setOfficialConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={() => {
                setOfficialConfirmOpen(false);
                setDirty(false);
                setShowOfficialIframe(true);
              }}
            >
              버리고 열기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          Anki 원본 고급 설정 화면을 열면 현재 화면에서 아직 저장하지 않은 변경 사항은
          사라집니다. 먼저 저장하거나 변경 사항을 버리고 이동해 주세요.
        </p>
      </SheetOrDialog>

      {/* Confirm before switching preset while current preset has unsaved edits */}
      <SheetOrDialog
        open={pendingPresetId !== null}
        onClose={() => setPendingPresetId(null)}
        title="변경 사항을 버리고 설정 묶음을 바꿀까요?"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setPendingPresetId(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={() => {
                const nextId = pendingPresetId;
                setPendingPresetId(null);
                if (nextId !== null) {
                  applyPresetSelection(nextId);
                }
              }}
            >
              버리고 바꾸기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          현재 설정 묶음에서 수정한 내용이 저장되지 않았습니다. 다른 설정 묶음으로 바꾸면
          지금 수정 중인 값은 사라집니다.
        </p>
      </SheetOrDialog>
    </div>
  );
};
