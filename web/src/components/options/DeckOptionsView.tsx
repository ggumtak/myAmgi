import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  // Editable draft fields
  const [newPerDay, setNewPerDay] = useState(20);
  const [reviewsPerDay, setReviewsPerDay] = useState(200);
  const [learnStepsText, setLearnStepsText] = useState('1m 10m');
  const [relearnStepsText, setRelearnStepsText] = useState('10m');

  const [fsrsEnabled, setFsrsEnabled] = useState(false);
  const [initialFsrsEnabled, setInitialFsrsEnabled] = useState(false);
  const [desiredRetentionPct, setDesiredRetentionPct] = useState(90);
  const [optimizedParams, setOptimizedParams] = useState<number[] | null>(null);
  const [optimizeStatusMsg, setOptimizeStatusMsg] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const [buryNew, setBuryNew] = useState(false);
  const [buryReviews, setBuryReviews] = useState(false);
  const [buryInterdayLearning, setBuryInterdayLearning] = useState(false);

  const [disableAutoplay, setDisableAutoplay] = useState(false);
  const [skipQuestionAudio, setSkipQuestionAudio] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [stopTimerOnAnswer, setStopTimerOnAnswer] = useState(false);
  const [capAnswerSecs, setCapAnswerSecs] = useState(60);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showOfficialIframe, setShowOfficialIframe] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorLog(undefined);
    try {
      const res = await anki.getDeckConfigsForUpdate(deckId);
      setData(res);

      const targetConfigId = toNumber(res.currentDeck?.configId, 1);
      const matched =
        res.allConfig?.find((c) => toNumber(c.config?.id) === targetConfigId) ??
        res.allConfig?.[0];
      const cfg = matched?.config?.config ?? res.defaults?.config;

      setNewPerDay(cfg?.newPerDay ?? 20);
      setReviewsPerDay(cfg?.reviewsPerDay ?? 200);
      setLearnStepsText(formatStepsToText(cfg?.learnSteps) || '1m 10m');
      setRelearnStepsText(formatStepsToText(cfg?.relearnSteps) || '10m');

      const fsrsOn = Boolean(res.fsrs);
      setFsrsEnabled(fsrsOn);
      setInitialFsrsEnabled(fsrsOn);
      const rawRet = cfg?.desiredRetention ?? res.currentDeck?.limits?.desiredRetention ?? 0.9;
      const pct = Math.min(97, Math.max(70, Math.round(rawRet * 100)));
      setDesiredRetentionPct(pct);
      setOptimizedParams(null);
      setOptimizeStatusMsg(null);

      setBuryNew(Boolean(cfg?.buryNew));
      setBuryReviews(Boolean(cfg?.buryReviews));
      setBuryInterdayLearning(Boolean(cfg?.buryInterdayLearning));

      setDisableAutoplay(Boolean(cfg?.disableAutoplay));
      setSkipQuestionAudio(Boolean(cfg?.skipQuestionWhenReplayingAnswer));
      setShowTimer(Boolean(cfg?.showTimer));
      setStopTimerOnAnswer(Boolean(cfg?.stopTimerOnAnswer));
      setCapAnswerSecs(Math.max(10, Math.min(600, cfg?.capAnswerTimeToSecs ?? 60)));

      setDirty(false);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '덱 설정을 불러오는 중 오류가 발생했습니다.'
      );
      setLoadErrorLog(err instanceof Error ? err.stack || err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!showOfficialIframe) return;
    return registerBackHandler(() => {
      setShowOfficialIframe(false);
      void loadOptions();
      return true;
    });
  }, [showOfficialIframe, registerBackHandler, loadOptions]);

  const activeEntry = useMemo(() => {
    if (!data?.allConfig?.length) return null;
    const targetConfigId = toNumber(data.currentDeck?.configId, 1);
    return (
      data.allConfig.find((c) => toNumber(c.config?.id) === targetConfigId) ??
      data.allConfig[0]
    );
  }, [data]);

  const activeConfig = activeEntry?.config ?? null;
  const activeUseCount = activeEntry?.useCount ?? 1;

  const learnStepsParsed = useMemo(() => parseStepsText(learnStepsText), [learnStepsText]);
  const relearnStepsParsed = useMemo(
    () => parseStepsText(relearnStepsText),
    [relearnStepsText]
  );

  const handleApplyQuickPreset = (preset: QuickPreset) => {
    setNewPerDay(preset.newPerDay);
    setReviewsPerDay(preset.reviewsPerDay);
    setLearnStepsText(formatStepsToText(preset.learnSteps));
    setRelearnStepsText(formatStepsToText(preset.relearnSteps));
    setDesiredRetentionPct(Math.round(preset.desiredRetention * 100));
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

  const handleSave = async () => {
    if (!data || !activeConfig || saving) return;
    if (!learnStepsParsed.valid || !relearnStepsParsed.valid) {
      showToast('학습 간격 형식을 확인해 주세요. (예: 1m 10m)', 'error');
      return;
    }

    setSaving(true);
    try {
      const targetConfigId = toNumber(activeConfig.id);
      const retentionDecimal = Number((desiredRetentionPct / 100).toFixed(2));

      const updatedConfigs = (data.allConfig ?? []).map((entry) => {
        const cfg = entry.config;
        if (!cfg) return {};
        if (toNumber(cfg.id) !== targetConfigId) {
          return cfg;
        }
        const inner = cfg.config ?? {};
        const nextInner: typeof inner = {
          ...inner,
          newPerDay: Math.max(0, Math.min(9999, Math.round(newPerDay))),
          reviewsPerDay: Math.max(0, Math.min(9999, Math.round(reviewsPerDay))),
          learnSteps: learnStepsParsed.steps,
          relearnSteps: relearnStepsParsed.steps,
          desiredRetention: retentionDecimal,
          buryNew,
          buryReviews,
          buryInterdayLearning,
          disableAutoplay,
          skipQuestionWhenReplayingAnswer: skipQuestionAudio,
          showTimer,
          stopTimerOnAnswer,
          capAnswerTimeToSecs: Math.max(10, Math.min(600, Math.round(capAnswerSecs))),
        };

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

      await anki.updateDeckConfigs({
        targetDeckId: deckId,
        configs: updatedConfigs,
        removedConfigIds: [],
        mode: UpdateDeckConfigsMode.UPDATE_DECK_CONFIGS_MODE_NORMAL,
        cardStateCustomizer: data.cardStateCustomizer ?? '',
        limits: data.currentDeck?.limits ?? undefined,
        newCardsIgnoreReviewLimit: Boolean(data.newCardsIgnoreReviewLimit),
        fsrs: fsrsEnabled,
        applyAllParentLimits: Boolean(data.applyAllParentLimits),
        fsrsReschedule: false,
        fsrsHealthCheck: Boolean(data.fsrsHealthCheck),
      });

      bumpCollection();
      showToast('학습 옵션을 저장했습니다.', 'success');
      goBack(`#/deck/${deckId}`);
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
        title="학습 옵션으로 돌아가기"
        onClose={() => {
          setShowOfficialIframe(false);
          void loadOptions();
        }}
      />
    );
  }

  const deckName = data?.currentDeck?.name || '덱';
  const limits = data?.currentDeck?.limits;
  const daysSinceOpt = data?.daysSinceLastFsrsOptimize ?? 0;

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
        {loading ? (
          <div className="amgi-options-loading">
            {!isEink && <div className="spinner" aria-hidden="true" />}
            <span>덱 옵션을 불러오는 중...</span>
          </div>
        ) : loadError ? (
          <>
            <ErrorState
              title="덱 설정을 불러오지 못했습니다"
              message={loadError}
              errorLog={loadErrorLog}
              onRetry={() => void loadOptions()}
            />
            <div className="amgi-options-escape">
              <p className="amgi-options-escape-hint">
                문제가 계속되면 Anki 기본 설정 화면을 바로 열 수 있습니다.
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
            {activeUseCount > 1 && (
              <div className="amgi-options-banner">
                현재 &apos;{activeConfig?.name || '기본'}&apos; 설정을 {activeUseCount}개 덱이
                함께 쓰고 있습니다.
              </div>
            )}

            {/* Quick-start Recommended Presets */}
            <SectionCard title="빠른 추천 설정">
              <div style={{ padding: '14px 16px' }}>
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
                        setNewPerDay((v) => Math.max(0, v - 5));
                        setDirty(true);
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-new-per-day"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={9999}
                      className="amgi-num-step-input"
                      value={newPerDay}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewPerDay(
                          Number.isFinite(val) ? Math.max(0, Math.min(9999, val)) : 0
                        );
                        setDirty(true);
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 새 카드 늘리기"
                      onClick={() => {
                        setNewPerDay((v) => Math.min(9999, v + 5));
                        setDirty(true);
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
                        setReviewsPerDay((v) => Math.max(0, v - 20));
                        setDirty(true);
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-reviews-per-day"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={9999}
                      className="amgi-num-step-input"
                      value={reviewsPerDay}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setReviewsPerDay(
                          Number.isFinite(val) ? Math.max(0, Math.min(9999, val)) : 0
                        );
                        setDirty(true);
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="하루 최대 복습 늘리기"
                      onClick={() => {
                        setReviewsPerDay((v) => Math.min(9999, v + 20));
                        setDirty(true);
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
                  새 카드를 처음 볼 때의 짧은 간격입니다 (예: 1m 10m)
                </span>
                <input
                  id="opt-learn-steps"
                  type="text"
                  className="amgi-steps-input"
                  value={learnStepsText}
                  onChange={(e) => {
                    setLearnStepsText(e.target.value);
                    setDirty(true);
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
                    setDirty(true);
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

            {/* Group 3: 똑똑한 복습 간격 (FSRS) */}
            <SectionCard title="똑똑한 복습 간격 (FSRS)">
              <SettingRow
                label="FSRS 간격 켜기"
                description="기억 패턴을 분석해 꼭 필요한 시점에만 복습하게 해줍니다"
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
                <div className="amgi-options-subrow amgi-options-dimmed">
                  <span className="amgi-options-subrow-label">목표 기억률</span>
                  <span className="amgi-options-subrow-desc">
                    위 스위치를 켜면 목표 기억률을 조절할 수 있습니다
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
                      min={70}
                      max={97}
                      step={1}
                      className="amgi-retention-slider"
                      value={desiredRetentionPct}
                      onChange={(e) => {
                        setDesiredRetentionPct(Number(e.target.value));
                        setDirty(true);
                      }}
                    />
                    <span className="amgi-options-subrow-desc">
                      {getRetentionHint(desiredRetentionPct)}
                    </span>
                  </div>

                  <div className="amgi-options-subrow">
                    <div className="amgi-options-subrow-top">
                      <span className="amgi-options-subrow-label">내 기록으로 자동 최적화</span>
                    </div>
                    <span className="amgi-options-subrow-desc">
                      {daysSinceOpt > 0
                        ? `마지막 최적화: ${daysSinceOpt}일 전 · 내 복습 습관에 맞게 간격을 조정합니다`
                        : '내 복습 기록을 분석해 가장 알맞은 복습 간격을 찾습니다'}
                    </span>
                    <button
                      type="button"
                      className="amgi-btn amgi-btn-secondary"
                      disabled={optimizing}
                      onClick={() => void handleOptimizeFsrs()}
                    >
                      <IconSpark size={16} />
                      <span>{optimizing ? '기록 분석 중...' : '최적화 실행'}</span>
                    </button>
                    {optimizeStatusMsg && (
                      <span className="amgi-options-subrow-desc" style={{ color: 'var(--text)' }}>
                        {optimizeStatusMsg}
                      </span>
                    )}
                  </div>
                </>
              )}
            </SectionCard>

            {/* Group 4: 같은 날 카드 미루기 */}
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
                      setDirty(true);
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
                      setDirty(true);
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
                      setDirty(true);
                    }}
                  />
                }
              />
            </SectionCard>

            {/* Group 5: 소리 및 시간 측정 */}
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
                      setDirty(true);
                    }}
                  />
                }
              />
              <SettingRow
                label="정답 볼 때 질문 숨기기"
                description="정답 소리를 다시 들을 때 앞면 소리를 건너뜁니다"
                htmlFor="opt-skip-question-audio"
                control={
                  <Switch
                    id="opt-skip-question-audio"
                    checked={skipQuestionAudio}
                    onChange={(next) => {
                      setSkipQuestionAudio(next);
                      setDirty(true);
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
                      setDirty(true);
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
                      setDirty(true);
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
                        setCapAnswerSecs((v) => Math.max(10, v - 10));
                        setDirty(true);
                      }}
                      data-compact="true"
                    >
                      -
                    </button>
                    <input
                      id="opt-cap-answer-secs"
                      type="number"
                      inputMode="numeric"
                      min={10}
                      max={600}
                      className="amgi-num-step-input"
                      value={capAnswerSecs}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCapAnswerSecs(
                          Number.isFinite(val) ? Math.max(10, Math.min(600, val)) : 60
                        );
                        setDirty(true);
                      }}
                    />
                    <button
                      type="button"
                      className="amgi-num-step-btn"
                      aria-label="최대 기록 시간 늘리기"
                      onClick={() => {
                        setCapAnswerSecs((v) => Math.min(600, v + 10));
                        setDirty(true);
                      }}
                      data-compact="true"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="amgi-options-subrow-desc">
                  통계에 기록되는 카드당 최대 시간입니다
                </span>
              </div>
            </SectionCard>

            {/* Group 6: Bottom Escape Hatch */}
            <div className="amgi-options-escape">
              <p className="amgi-options-escape-hint">
                표시 순서, 쉬어가는 요일, 고급 간격 계산 등 세부 설정이 필요할 때 씁니다.
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
        )}
      </main>
    </div>
  );
};
