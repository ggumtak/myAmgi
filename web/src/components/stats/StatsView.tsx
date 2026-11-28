import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import type { AnkiTypes } from '../../anki/generated';
import { toNumber } from '../../anki';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  ErrorState,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconPlay,
  IconStats,
} from '../../ui';
import { AnkiIframeView } from '../shared/AnkiIframeView';
import { ankiToday } from './statsDates';
import './stats.css';

type ReviewsEntry = AnkiTypes.stats.GraphsResponse.ReviewCountsAndTimes.Reviews.$Properties;
type TrueRetention = AnkiTypes.stats.GraphsResponse.TrueRetentionStats.TrueRetention.$Properties;

function formatDurationKo(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}초`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}시간 ${remMins}분` : `${hrs}시간`;
}

function sumReviewsEntry(r: ReviewsEntry | undefined): number {
  if (!r) return 0;
  return (
    (r.learn ?? 0) +
    (r.relearn ?? 0) +
    (r.young ?? 0) +
    (r.mature ?? 0) +
    (r.filtered ?? 0)
  );
}

function calcTrueRetentionPct(tr: TrueRetention | null | undefined): string {
  if (!tr) return '—';
  const passed = (tr.youngPassed ?? 0) + (tr.maturePassed ?? 0);
  const failed = (tr.youngFailed ?? 0) + (tr.matureFailed ?? 0);
  const total = passed + failed;
  if (total === 0) return '—';
  return `${Math.round((passed / total) * 100)}%`;
}

function addDaysToDate(base: Date, offsetDays: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function formatKoFullDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatKoShortDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface HeatCell {
  offset: number;
  date: Date;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface HeatWeek {
  cells: Array<HeatCell | null>;
  monthLabel: string;
}

function computeHeatLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  const denom = Math.max(4, maxCount);
  const ratio = count / denom;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export const StatsView: React.FC = () => {
  const { resolvedTheme, collectionVersion, navigate, registerBackHandler } = useApp();
  const isEink = resolvedTheme === 'eink';

  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);

  const [graphsData, setGraphsData] = useState<anki.GraphsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorLog, setLoadErrorLog] = useState<string | undefined>(undefined);

  const [selectedHeatCell, setSelectedHeatCell] = useState<HeatCell | null>(null);
  const [selectedDueDay, setSelectedDueDay] = useState<number | null>(null);
  const [selectedReviewDay, setSelectedReviewDay] = useState<number | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showOfficialIframe, setShowOfficialIframe] = useState(false);

  const heatScrollRef = useRef<HTMLDivElement | null>(null);

  const searchQuery = selectedDeck ? anki.buildSearchTerm('deck', selectedDeck) : '';

  const loadStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorLog(undefined);
    try {
      const [deckList, statsRes] = await Promise.all([
        anki.getDeckNames(false, true).catch(() => [] as anki.DeckNameId[]),
        anki.graphs(searchQuery, 365),
      ]);
      setDecks(deckList);
      setGraphsData(statsRes);
      setSelectedHeatCell(null);
      setSelectedDueDay(null);
      setSelectedReviewDay(null);
      setSelectedHour(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '통계 데이터를 불러오는 중 오류가 발생했습니다.'
      );
      setLoadErrorLog(err instanceof Error ? err.stack || err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, collectionVersion]);

  useEffect(() => {
    if (!showOfficialIframe) return;
    return registerBackHandler(() => {
      setShowOfficialIframe(false);
      return true;
    });
  }, [showOfficialIframe, registerBackHandler]);

  // Auto-scroll 1-year heatmap to the rightmost (most recent) week
  useEffect(() => {
    if (!loading && heatScrollRef.current) {
      const el = heatScrollRef.current;
      el.scrollLeft = el.scrollWidth;
    }
  }, [loading, graphsData]);

  // Build 365-day calendar heatmap + streaks
  const heatmapInfo = useMemo(() => {
    const countMap = graphsData?.reviews?.count ?? {};
    const today = ankiToday(new Date(), graphsData?.rolloverHour ?? 0);
    const dayCounts = new Map<number, number>();
    let totalYearReviews = 0;
    let activeDays = 0;
    let maxCount = 0;

    for (let offset = -364; offset <= 0; offset++) {
      const c = sumReviewsEntry(countMap[String(offset)]);
      dayCounts.set(offset, c);
      totalYearReviews += c;
      if (c > 0) activeDays++;
      if (c > maxCount) maxCount = c;
    }

    const todayTotal = dayCounts.get(0) ?? 0;

    // Current streak: backward from today (forgive today === 0 if yesterday > 0)
    let currentStreak = 0;
    let cursor = todayTotal > 0 ? 0 : -1;
    while (cursor >= -364 && (dayCounts.get(cursor) ?? 0) > 0) {
      currentStreak++;
      cursor--;
    }

    // Longest streak across past 365 days
    let longestStreak = 0;
    let run = 0;
    for (let offset = -364; offset <= 0; offset++) {
      if ((dayCounts.get(offset) ?? 0) > 0) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 0;
      }
    }

    // Group into 53 Sunday..Saturday columns
    const startDate = addDaysToDate(today, -364);
    const startDow = startDate.getDay(); // 0=Sun..6=Sat
    const paddedSlots: Array<HeatCell | null> = [];
    for (let i = 0; i < startDow; i++) {
      paddedSlots.push(null);
    }
    for (let offset = -364; offset <= 0; offset++) {
      const count = dayCounts.get(offset) ?? 0;
      paddedSlots.push({
        offset,
        date: addDaysToDate(today, offset),
        count,
        level: computeHeatLevel(count, maxCount),
      });
    }
    while (paddedSlots.length % 7 !== 0) {
      paddedSlots.push(null);
    }

    const weeks: HeatWeek[] = [];
    let lastLabeledMonth = -1;
    const monthStarts: Array<{ weekIdx: number; month: number }> = [];
    for (let w = 0; w < paddedSlots.length; w += 7) {
      const cells = paddedSlots.slice(w, w + 7);
      const firstReal = cells.find((c): c is HeatCell => c !== null);
      if (firstReal) {
        const m = firstReal.date.getMonth();
        if (m !== lastLabeledMonth) {
          monthStarts.push({ weekIdx: weeks.length, month: m });
          lastLabeledMonth = m;
        }
      }
      weeks.push({ cells, monthLabel: '' });
    }

    for (let i = 0; i < monthStarts.length; i++) {
      const curr = monthStarts[i];
      const next = monthStarts[i + 1];
      if (next && next.weekIdx - curr.weekIdx < 3) {
        continue;
      }
      weeks[curr.weekIdx].monthLabel = `${curr.month + 1}월`;
    }

    return {
      weeks,
      totalYearReviews,
      activeDays,
      todayTotal,
      currentStreak,
      longestStreak,
    };
  }, [graphsData]);

  // Past 30-day Review Trend (offsets -29..0 stacked: learning / young / mature)
  const past30Reviews = useMemo(() => {
    const countMap = graphsData?.reviews?.count ?? {};
    const today = ankiToday(new Date(), graphsData?.rolloverHour ?? 0);
    const days = Array.from({ length: 30 }, (_, i) => {
      const offset = i - 29;
      const entry = countMap[String(offset)];
      const learning = (entry?.learn ?? 0) + (entry?.relearn ?? 0) + (entry?.filtered ?? 0);
      const young = entry?.young ?? 0;
      const mature = entry?.mature ?? 0;
      const total = learning + young + mature;
      return {
        idx: i,
        offset,
        date: addDaysToDate(today, offset),
        learning,
        young,
        mature,
        total,
      };
    });
    const sum30 = days.reduce((acc, d) => acc + d.total, 0);
    const activeDays30 = days.filter((d) => d.total > 0).length;
    const avg30 = Math.round(sum30 / 30);
    const maxVal = Math.max(...days.map((d) => d.total), 1);
    return {
      days,
      sum30,
      activeDays30,
      avg30,
      maxVal,
      hasAny: sum30 > 0,
    };
  }, [graphsData]);

  // Answer Button Distribution (1-year or all-time fallback)
  const buttonStats = useMemo(() => {
    const src =
      graphsData?.buttons?.oneYear ??
      graphsData?.buttons?.allTime ??
      graphsData?.buttons?.oneMonth;
    const buildRow = (label: string, arr: number[] | null | undefined) => {
      const again = arr?.[0] ?? 0;
      const hard = arr?.[1] ?? 0;
      const good = arr?.[2] ?? 0;
      const easy = arr?.[3] ?? 0;
      const total = again + hard + good + easy;
      const passRate = total > 0 ? Math.round(((hard + good + easy) / total) * 100) : 0;
      return { label, again, hard, good, easy, total, passRate };
    };
    const rows = [
      buildRow('배우는 중', src?.learning),
      buildRow('익히는 중', src?.young),
      buildRow('장기 기억', src?.mature),
    ];
    const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
    return { rows, grandTotal };
  }, [graphsData]);

  // Hourly Breakdown (24 hours accuracy & volume)
  const hourlyStats = useMemo(() => {
    const raw =
      graphsData?.hours?.oneYear ??
      graphsData?.hours?.allTime ??
      graphsData?.hours?.oneMonth ??
      [];
    const hours = Array.from({ length: 24 }, (_, h) => {
      const entry = raw[h];
      const total = entry?.total ?? 0;
      const correct = entry?.correct ?? 0;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { hour: h, total, correct, pct };
    });
    const activeHours = hours.filter((h) => h.total > 0);
    const maxTotal = Math.max(...hours.map((h) => h.total), 1);
    let bestHour: { hour: number; pct: number; total: number } | null = null;
    for (const h of activeHours) {
      if (h.total >= 3 && (!bestHour || h.pct > bestHour.pct || (h.pct === bestHour.pct && h.total > bestHour.total))) {
        bestHour = h;
      }
    }
    return {
      hours,
      hasAny: activeHours.length > 0,
      maxTotal,
      bestHour,
    };
  }, [graphsData]);

  // Future Due (Next 30 days: keys 0..29)
  const futureDueInfo = useMemo(() => {
    const fd = graphsData?.futureDue;
    const dueMap = fd?.futureDue ?? {};
    const days = Array.from({ length: 30 }, (_, day) => ({
      day,
      count: dueMap[String(day)] ?? 0,
      date: addDaysToDate(ankiToday(new Date(), graphsData?.rolloverHour ?? 0), day),
    }));
    const tomorrowCount = days[1]?.count ?? 0;
    const sum30Days = days.reduce((acc, d) => acc + d.count, 0);
    const dailyLoad = Math.round(fd?.dailyLoad ?? (sum30Days / 30));
    const maxVal = Math.max(dailyLoad, ...days.map((d) => d.count), 1);
    const hasAny = sum30Days > 0;
    return {
      days,
      tomorrowCount,
      sum30Days,
      dailyLoad,
      haveBacklog: Boolean(fd?.haveBacklog),
      maxVal,
      hasAny,
    };
  }, [graphsData]);

  // Card Counts distribution
  const cardDist = useMemo(() => {
    const src = includeInactive
      ? graphsData?.cardCounts?.includingInactive ?? graphsData?.cardCounts?.excludingInactive
      : graphsData?.cardCounts?.excludingInactive ?? graphsData?.cardCounts?.includingInactive;

    const newCards = src?.newCards ?? 0;
    const learning = (src?.learn ?? 0) + (src?.relearn ?? 0);
    const young = src?.young ?? 0;
    const mature = src?.mature ?? 0;
    const suspended = graphsData?.cardCounts?.includingInactive?.suspended ?? src?.suspended ?? 0;
    const buried = graphsData?.cardCounts?.includingInactive?.buried ?? src?.buried ?? 0;

    const activeTotal = newCards + learning + young + mature;
    const totalCards = includeInactive ? activeTotal + suspended + buried : activeTotal;

    const pct = (val: number) =>
      activeTotal > 0 ? Math.round((val / activeTotal) * 100) : 0;

    return {
      newCards,
      learning,
      young,
      mature,
      suspended,
      buried,
      activeTotal,
      totalCards,
      pct,
    };
  }, [graphsData, includeInactive]);

  if (showOfficialIframe) {
    const officialPath = searchQuery
      ? `/graphs?search=${encodeURIComponent(searchQuery)}`
      : '/graphs';
    return (
      <AnkiIframeView
        path={officialPath}
        title="간편 통계로 돌아가기"
        onClose={() => setShowOfficialIframe(false)}
      />
    );
  }

  const today = graphsData?.today;
  const answerCount = today?.answerCount ?? 0;
  const answerMillis = today?.answerMillis ?? 0;
  const correctCount = today?.correctCount ?? 0;
  const matureCount = today?.matureCount ?? 0;
  const matureCorrect = today?.matureCorrect ?? 0;
  const learnCount = today?.learnCount ?? 0;
  const relearnCount = today?.relearnCount ?? 0;
  const reviewCount = today?.reviewCount ?? 0;

  const avgSec = answerCount > 0 ? (answerMillis / 1000 / answerCount).toFixed(1) : '0';
  const correctPct = answerCount > 0 ? Math.round((correctCount / answerCount) * 100) : 0;
  const maturePctStr =
    matureCount > 0 ? `${Math.round((matureCorrect / matureCount) * 100)}%` : '—';

  const retention = graphsData?.trueRetention;
  const hasRetentionData = Boolean(
    retention &&
      ((retention.today?.youngPassed ?? 0) +
        (retention.today?.youngFailed ?? 0) +
        (retention.today?.maturePassed ?? 0) +
        (retention.today?.matureFailed ?? 0) +
        (retention.week?.youngPassed ?? 0) +
        (retention.week?.youngFailed ?? 0) +
        (retention.week?.maturePassed ?? 0) +
        (retention.week?.matureFailed ?? 0) +
        (retention.month?.youngPassed ?? 0) +
        (retention.month?.youngFailed ?? 0) +
        (retention.month?.maturePassed ?? 0) +
        (retention.month?.matureFailed ?? 0) >
        0)
  );

  const selectedDueInfo =
    selectedDueDay !== null ? futureDueInfo.days[selectedDueDay] ?? null : null;

  return (
    <div className="amgi-stats-page">
      {/* Scope Filter Bar */}
      <div className="amgi-stats-scope-bar">
        <div className="amgi-stats-scope-seg">
          <button
            type="button"
            className={`amgi-stats-scope-btn ${selectedDeck === null ? 'active' : ''}`}
            aria-pressed={selectedDeck === null}
            onClick={() => setSelectedDeck(null)}
          >
            전체 덱
          </button>
          <button
            type="button"
            className={`amgi-stats-scope-btn ${selectedDeck !== null ? 'active' : ''}`}
            aria-pressed={selectedDeck !== null}
            onClick={() => setDeckPickerOpen(true)}
          >
            <span className="amgi-stats-scope-btn-label">
              {selectedDeck ? `덱별: ${selectedDeck}` : '덱 선택'}
            </span>
            <IconChevronDown size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="amgi-stats-loading">
          {!isEink && <div className="spinner" aria-hidden="true" />}
          <span>통계를 계산하는 중...</span>
        </div>
      ) : loadError ? (
        <ErrorState
          title="통계를 불러오지 못했습니다"
          message={loadError}
          errorLog={loadErrorLog}
          onRetry={() => void loadStats()}
        />
      ) : (
        <>
          <div className="amgi-stats-grid">
            {/* Card 1: 오늘의 학습 요약 */}
            <section className="amgi-stats-card amgi-stats-span-2">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">오늘의 학습 요약</h2>
                </div>
                {selectedDeck && <span className="amgi-stats-badge">{selectedDeck}</span>}
              </div>

              {answerCount === 0 ? (
                <div className="amgi-stats-empty-box">
                  <div className="amgi-stats-empty-title">오늘 아직 공부한 카드가 없어요</div>
                  <div className="amgi-stats-empty-sub">
                    가볍게 카드 몇 장부터 시작해 볼까요?
                  </div>
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-primary amgi-stats-study-btn"
                    onClick={() => navigate('#/decks')}
                  >
                    <IconPlay size={16} />
                    <span>학습하러 가기</span>
                  </button>
                </div>
              ) : (
                <>
                  <p className="amgi-stats-summary-sentence">
                    오늘 총 {answerCount.toLocaleString('ko-KR')}장을{' '}
                    {formatDurationKo(answerMillis)} 동안 복습했어요.
                  </p>
                  <div className="amgi-stats-metric-grid">
                    <div className="amgi-stats-metric-box">
                      <span className="amgi-stats-metric-label">학습 카드</span>
                      <span className="amgi-stats-metric-val">
                        {answerCount.toLocaleString('ko-KR')}장
                      </span>
                      <span className="amgi-stats-metric-sub">카드당 {avgSec}초</span>
                    </div>
                    <div className="amgi-stats-metric-box">
                      <span className="amgi-stats-metric-label">오늘 정답률</span>
                      <span className="amgi-stats-metric-val">{correctPct}%</span>
                      <span className="amgi-stats-metric-sub">
                        {correctCount}/{answerCount}개 기억
                      </span>
                    </div>
                    <div className="amgi-stats-metric-box">
                      <span className="amgi-stats-metric-label">새 카드 · 학습</span>
                      <span className="amgi-stats-metric-val">
                        {learnCount.toLocaleString('ko-KR')}장
                      </span>
                      <span className="amgi-stats-metric-sub">
                        다시 외운 카드 {relearnCount.toLocaleString('ko-KR')}장
                      </span>
                    </div>
                    <div className="amgi-stats-metric-box">
                      <span className="amgi-stats-metric-label">복습 완료</span>
                      <span className="amgi-stats-metric-val">
                        {reviewCount.toLocaleString('ko-KR')}장
                      </span>
                      <span className="amgi-stats-metric-sub">장기 기억 {maturePctStr}</span>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Card 2: 1년 학습 잔디 */}
            <section className="amgi-stats-card amgi-stats-span-2">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">1년 학습 잔디</h2>
                  <p className="amgi-stats-card-sub">
                    지난 1년간 {heatmapInfo.totalYearReviews.toLocaleString('ko-KR')}번 복습 ·{' '}
                    {heatmapInfo.activeDays.toLocaleString('ko-KR')}일 학습
                  </p>
                </div>
                <div className="amgi-heat-chips">
                  <div className="amgi-heat-chip">
                    <span className="amgi-heat-chip-label">오늘</span>
                    <span className="amgi-heat-chip-val">
                      {heatmapInfo.todayTotal.toLocaleString('ko-KR')}장
                    </span>
                  </div>
                  <div className="amgi-heat-chip">
                    <span className="amgi-heat-chip-label">연속</span>
                    <span className="amgi-heat-chip-val">{heatmapInfo.currentStreak}일</span>
                  </div>
                  <div className="amgi-heat-chip">
                    <span className="amgi-heat-chip-label">최장</span>
                    <span className="amgi-heat-chip-val">{heatmapInfo.longestStreak}일</span>
                  </div>
                </div>
              </div>

              <div className="amgi-heat-scroll" ref={heatScrollRef}>
                <div className="amgi-heat-inner">
                  <div className="amgi-heat-months" aria-hidden="true">
                    {heatmapInfo.weeks.map((week, wIdx) => (
                      <span key={wIdx} className="amgi-heat-month-cell">
                        {week.monthLabel}
                      </span>
                    ))}
                  </div>
                  <div className="amgi-heat-grid" role="grid" aria-label="1년 학습 잔디">
                    {heatmapInfo.weeks.map((week, wIdx) => (
                      <div key={wIdx} className="amgi-heat-col" role="row">
                        {week.cells.map((cell, dIdx) =>
                          cell === null ? (
                            <span
                              key={`pad-${wIdx}-${dIdx}`}
                              className="amgi-heat-cell is-pad"
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              key={cell.offset}
                              role="gridcell"
                              tabIndex={0}
                              data-level={cell.level}
                              aria-selected={selectedHeatCell?.offset === cell.offset}
                              className={`amgi-heat-cell level-${cell.level} ${
                                selectedHeatCell?.offset === cell.offset ? 'is-selected' : ''
                              }`}
                              aria-label={`${formatKoFullDate(cell.date)} ${cell.count}장 학습`}
                              onClick={() => setSelectedHeatCell(cell)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedHeatCell(cell);
                                }
                              }}
                            />
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="amgi-heat-footer">
                <span className="amgi-heat-inspect">
                  {selectedHeatCell
                    ? `${formatKoFullDate(selectedHeatCell.date)} · ${selectedHeatCell.count.toLocaleString('ko-KR')}장 학습`
                    : '칸을 누르면 날짜별 학습량을 볼 수 있어요'}
                </span>
                <span className="amgi-heat-legend" aria-hidden="true">
                  <span>적음</span>
                  <span className="amgi-heat-legend-box level-0" />
                  <span className="amgi-heat-legend-box level-1" />
                  <span className="amgi-heat-legend-box level-2" />
                  <span className="amgi-heat-legend-box level-3" />
                  <span className="amgi-heat-legend-box level-4" />
                  <span>많음</span>
                </span>
              </div>
            </section>

            {/* Card 3: 앞으로 30일 복습 예정 */}
            <section className="amgi-stats-card">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">앞으로 30일 복습 예정</h2>
                </div>
                <span className="amgi-stats-badge">
                  하루 평균 {futureDueInfo.dailyLoad.toLocaleString('ko-KR')}장
                </span>
              </div>

              <div className="amgi-future-strip">
                <span>내일 예정: {futureDueInfo.tomorrowCount.toLocaleString('ko-KR')}장</span>
                <span>·</span>
                <span>30일 합계: {futureDueInfo.sum30Days.toLocaleString('ko-KR')}장</span>
                {futureDueInfo.haveBacklog && (
                  <span className="amgi-future-warn-chip">밀린 카드가 포함되어 있어요</span>
                )}
              </div>

              {!futureDueInfo.hasAny ? (
                <div className="amgi-future-empty">앞으로 예정된 복습 카드가 없습니다.</div>
              ) : (
                <>
                  <div className="amgi-future-svg-wrap">
                    <svg
                      className="amgi-future-svg"
                      viewBox="0 0 320 140"
                      role="img"
                      aria-label="앞으로 30일 복습 예정 막대 그래프"
                    >
                      {(() => {
                        const plotLeft = 8;
                        const plotRight = 312;
                        const plotTop = 14;
                        const plotBottom = 114;
                        const plotH = plotBottom - plotTop;
                        const plotW = plotRight - plotLeft;
                        const slotW = plotW / 30;
                        const barW = Math.max(4, slotW - 3);
                        const avgY =
                          plotBottom -
                          Math.min(1, futureDueInfo.dailyLoad / futureDueInfo.maxVal) * plotH;

                        return (
                          <>
                            <line
                              x1={plotLeft}
                              x2={plotRight}
                              y1={avgY}
                              y2={avgY}
                              className="amgi-future-guide"
                            />
                            <text
                              x={plotRight}
                              y={Math.max(10, avgY - 4)}
                              textAnchor="end"
                              className="amgi-future-axis-text"
                            >
                              평균 {futureDueInfo.dailyLoad}장
                            </text>

                            {futureDueInfo.days.map((d, idx) => {
                              const barH =
                                d.count > 0
                                  ? Math.max(3, (d.count / futureDueInfo.maxVal) * plotH)
                                  : 0;
                              const x = plotLeft + idx * slotW + 1.5;
                              const y = plotBottom - barH;
                              return (
                                <g key={d.day}>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barW}
                                    height={barH}
                                    rx={isEink ? 0 : 2}
                                    className={`amgi-future-bar ${
                                      d.day === 0 ? 'is-today' : ''
                                    } ${selectedDueDay === d.day ? 'is-selected' : ''}`}
                                  />
                                  {/* Invisible wider hit target for reliable touch tapping */}
                                  <rect
                                    x={plotLeft + idx * slotW}
                                    y={plotTop}
                                    width={slotW}
                                    height={plotH + 10}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedDueDay(d.day)}
                                  />
                                </g>
                              );
                            })}

                            {[
                              { idx: 0, label: '오늘' },
                              { idx: 5, label: '+5일' },
                              { idx: 10, label: '+10일' },
                              { idx: 15, label: '+15일' },
                              { idx: 20, label: '+20일' },
                              { idx: 25, label: '+25일' },
                              { idx: 29, label: '+30일' },
                            ].map((tick) => (
                              <text
                                key={tick.idx}
                                x={plotLeft + tick.idx * slotW + slotW / 2}
                                y={132}
                                textAnchor={
                                  tick.idx === 0
                                    ? 'start'
                                    : tick.idx === 29
                                      ? 'end'
                                      : 'middle'
                                }
                                className="amgi-future-axis-text"
                              >
                                {tick.label}
                              </text>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="amgi-heat-inspect">
                    {selectedDueInfo
                      ? `${
                          selectedDueInfo.day === 0
                            ? '오늘'
                            : `${selectedDueInfo.day}일 뒤`
                        } (${formatKoShortDate(selectedDueInfo.date)}) · 복습 예정 ${selectedDueInfo.count.toLocaleString('ko-KR')}장`
                      : '막대를 누르면 날짜별 예정량을 볼 수 있어요'}
                  </div>
                </>
              )}
            </section>

            {/* Card 4: 카드 숙련도 분포 */}
            <section className="amgi-stats-card">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">카드 숙련도 분포</h2>
                  <p className="amgi-stats-card-sub">
                    전체 카드 {cardDist.totalCards.toLocaleString('ko-KR')}장
                  </p>
                </div>
                <button
                  type="button"
                  className="amgi-chip amgi-stats-filter-chip"
                  aria-pressed={includeInactive}
                  onClick={() => setIncludeInactive((prev) => !prev)}
                >
                  중단·미룬 카드 포함
                </button>
              </div>

              <div className="amgi-maturity-bar" aria-label="카드 숙련도 비율 막대">
                {cardDist.activeTotal > 0 && (
                  <>
                    {cardDist.newCards > 0 && (
                      <div
                        className="amgi-maturity-seg amgi-maturity-seg--new"
                        style={{ width: `${(cardDist.newCards / cardDist.activeTotal) * 100}%` }}
                      />
                    )}
                    {cardDist.learning > 0 && (
                      <div
                        className="amgi-maturity-seg amgi-maturity-seg--learning"
                        style={{ width: `${(cardDist.learning / cardDist.activeTotal) * 100}%` }}
                      />
                    )}
                    {cardDist.young > 0 && (
                      <div
                        className="amgi-maturity-seg amgi-maturity-seg--young"
                        style={{ width: `${(cardDist.young / cardDist.activeTotal) * 100}%` }}
                      />
                    )}
                    {cardDist.mature > 0 && (
                      <div
                        className="amgi-maturity-seg amgi-maturity-seg--mature"
                        style={{ width: `${(cardDist.mature / cardDist.activeTotal) * 100}%` }}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="amgi-maturity-legend">
                <div className="amgi-maturity-row">
                  <span className="amgi-maturity-left">
                    <span className="amgi-maturity-swatch amgi-maturity-swatch--new" />
                    <span className="amgi-maturity-name">새 카드</span>
                    <span className="amgi-maturity-hint">아직 안 본 카드</span>
                  </span>
                  <span className="amgi-maturity-count">
                    {cardDist.newCards.toLocaleString('ko-KR')}장 ({cardDist.pct(cardDist.newCards)}%)
                  </span>
                </div>

                <div className="amgi-maturity-row">
                  <span className="amgi-maturity-left">
                    <span className="amgi-maturity-swatch amgi-maturity-swatch--learning" />
                    <span className="amgi-maturity-name">배우는 중</span>
                    <span className="amgi-maturity-hint">초기 암기 단계</span>
                  </span>
                  <span className="amgi-maturity-count">
                    {cardDist.learning.toLocaleString('ko-KR')}장 ({cardDist.pct(cardDist.learning)}%)
                  </span>
                </div>

                <div className="amgi-maturity-row">
                  <span className="amgi-maturity-left">
                    <span className="amgi-maturity-swatch amgi-maturity-swatch--young" />
                    <span className="amgi-maturity-name">익히는 중</span>
                    <span className="amgi-maturity-hint">간격 21일 미만</span>
                  </span>
                  <span className="amgi-maturity-count">
                    {cardDist.young.toLocaleString('ko-KR')}장 ({cardDist.pct(cardDist.young)}%)
                  </span>
                </div>

                <div className="amgi-maturity-row">
                  <span className="amgi-maturity-left">
                    <span className="amgi-maturity-swatch amgi-maturity-swatch--mature" />
                    <span className="amgi-maturity-name">장기 기억</span>
                    <span className="amgi-maturity-hint">간격 21일 이상</span>
                  </span>
                  <span className="amgi-maturity-count">
                    {cardDist.mature.toLocaleString('ko-KR')}장 ({cardDist.pct(cardDist.mature)}%)
                  </span>
                </div>
              </div>

              {(includeInactive || cardDist.suspended > 0 || cardDist.buried > 0) && (
                <div className="amgi-maturity-inactive">
                  일시 중단: {cardDist.suspended.toLocaleString('ko-KR')}장 · 오늘 미룸:{' '}
                  {cardDist.buried.toLocaleString('ko-KR')}장
                </div>
              )}
            </section>

            {/* Card 5: 최근 30일 학습량 추이 */}
            <section className="amgi-stats-card amgi-stats-span-2">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">최근 30일 학습량 추이</h2>
                  <p className="amgi-stats-card-sub">
                    총 {past30Reviews.sum30.toLocaleString('ko-KR')}회 복습 · {past30Reviews.activeDays30}일 활동
                  </p>
                </div>
                <span className="amgi-stats-badge">
                  일 평균 {past30Reviews.avg30.toLocaleString('ko-KR')}회
                </span>
              </div>

              {!past30Reviews.hasAny ? (
                <div className="amgi-future-empty">최근 30일간 복습 기록이 없습니다.</div>
              ) : (
                <>
                  <div className="amgi-future-svg-wrap">
                    <svg
                      className="amgi-future-svg"
                      viewBox="0 0 360 138"
                      role="img"
                      aria-label="최근 30일 학습량 막대 그래프"
                    >
                      {(() => {
                        const plotLeft = 8;
                        const plotRight = 352;
                        const plotTop = 12;
                        const plotBottom = 112;
                        const plotH = plotBottom - plotTop;
                        const plotW = plotRight - plotLeft;
                        const slotW = plotW / 30;
                        const barW = Math.max(5, slotW - 3);

                        return (
                          <>
                            {past30Reviews.days.map((d) => {
                              const x = plotLeft + d.idx * slotW + 1.5;
                              const matureH = (d.mature / past30Reviews.maxVal) * plotH;
                              const youngH = (d.young / past30Reviews.maxVal) * plotH;
                              const learnH = (d.learning / past30Reviews.maxVal) * plotH;
                              const yMature = plotBottom - matureH;
                              const yYoung = yMature - youngH;
                              const yLearn = yYoung - learnH;
                              const isSel = selectedReviewDay === d.idx;
                              return (
                                <g key={d.offset}>
                                  {matureH > 0 && (
                                    <rect
                                      x={x}
                                      y={yMature}
                                      width={barW}
                                      height={Math.max(2, matureH)}
                                      className={`amgi-rev-bar amgi-rev-bar--mature ${isSel ? 'is-selected' : ''}`}
                                    />
                                  )}
                                  {youngH > 0 && (
                                    <rect
                                      x={x}
                                      y={yYoung}
                                      width={barW}
                                      height={Math.max(2, youngH)}
                                      className={`amgi-rev-bar amgi-rev-bar--young ${isSel ? 'is-selected' : ''}`}
                                    />
                                  )}
                                  {learnH > 0 && (
                                    <rect
                                      x={x}
                                      y={yLearn}
                                      width={barW}
                                      height={Math.max(2, learnH)}
                                      className={`amgi-rev-bar amgi-rev-bar--learn ${isSel ? 'is-selected' : ''}`}
                                    />
                                  )}
                                  <rect
                                    x={plotLeft + d.idx * slotW}
                                    y={plotTop}
                                    width={slotW}
                                    height={plotH + 10}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedReviewDay(d.idx)}
                                  />
                                </g>
                              );
                            })}
                            {[
                              { idx: 0, label: '30일 전' },
                              { idx: 14, label: '15일 전' },
                              { idx: 29, label: '오늘' },
                            ].map((tick) => (
                              <text
                                key={tick.idx}
                                x={plotLeft + tick.idx * slotW + slotW / 2}
                                y={130}
                                textAnchor={
                                  tick.idx === 0 ? 'start' : tick.idx === 29 ? 'end' : 'middle'
                                }
                                className="amgi-future-axis-text"
                              >
                                {tick.label}
                              </text>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  <div className="amgi-heat-footer">
                    <span className="amgi-heat-inspect">
                      {selectedReviewDay !== null && past30Reviews.days[selectedReviewDay]
                        ? (() => {
                            const d = past30Reviews.days[selectedReviewDay];
                            return `${formatKoShortDate(d.date)} · 총 ${d.total}회 (학습 ${d.learning} · 익힘 ${d.young} · 장기 ${d.mature})`;
                          })()
                        : '막대를 누르면 날짜별 세부 학습량을 볼 수 있어요'}
                    </span>
                    <span className="amgi-rev-legend">
                      <span><i className="amgi-rev-dot amgi-rev-dot--learn" />학습</span>
                      <span><i className="amgi-rev-dot amgi-rev-dot--young" />익힘</span>
                      <span><i className="amgi-rev-dot amgi-rev-dot--mature" />장기</span>
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* Card 6: 답변 버튼 분포 */}
            <section className="amgi-stats-card">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">답변 버튼 분포</h2>
                  <p className="amgi-stats-card-sub">
                    최근 1년 기준 총 {buttonStats.grandTotal.toLocaleString('ko-KR')}회 응답
                  </p>
                </div>
              </div>

              {buttonStats.grandTotal === 0 ? (
                <div className="amgi-future-empty">아직 답변 버튼 기록이 없습니다.</div>
              ) : (
                <div className="amgi-btn-dist-list">
                  {buttonStats.rows.map((row) => (
                    <div key={row.label} className="amgi-btn-dist-row">
                      <div className="amgi-btn-dist-top">
                        <span className="amgi-btn-dist-name">{row.label}</span>
                        <span className="amgi-btn-dist-pass">
                          {row.total > 0 ? `정답 ${row.passRate}% (${row.total}회)` : '기록 없음'}
                        </span>
                      </div>
                      <div className="amgi-btn-dist-bar">
                        {row.total > 0 && (
                          <>
                            {row.again > 0 && (
                              <span
                                className="amgi-btn-dist-seg amgi-btn-dist-seg--again"
                                style={{ width: `${(row.again / row.total) * 100}%` }}
                              />
                            )}
                            {row.hard > 0 && (
                              <span
                                className="amgi-btn-dist-seg amgi-btn-dist-seg--hard"
                                style={{ width: `${(row.hard / row.total) * 100}%` }}
                              />
                            )}
                            {row.good > 0 && (
                              <span
                                className="amgi-btn-dist-seg amgi-btn-dist-seg--good"
                                style={{ width: `${(row.good / row.total) * 100}%` }}
                              />
                            )}
                            {row.easy > 0 && (
                              <span
                                className="amgi-btn-dist-seg amgi-btn-dist-seg--easy"
                                style={{ width: `${(row.easy / row.total) * 100}%` }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="amgi-rev-legend" style={{ marginTop: 2 }}>
                    <span><i className="amgi-rev-dot amgi-btn-dot--again" />다시</span>
                    <span><i className="amgi-rev-dot amgi-btn-dot--hard" />어려움</span>
                    <span><i className="amgi-rev-dot amgi-btn-dot--good" />알맞음</span>
                    <span><i className="amgi-rev-dot amgi-btn-dot--easy" />쉬움</span>
                  </div>
                </div>
              )}
            </section>

            {/* Card 7: 시간대별 학습 정답률 */}
            <section className="amgi-stats-card">
              <div className="amgi-stats-card-head">
                <div>
                  <h2 className="amgi-stats-card-title">시간대별 정답률</h2>
                  <p className="amgi-stats-card-sub">어느 시간대에 집중력이 가장 높은지 보여줍니다</p>
                </div>
                {hourlyStats.bestHour && (
                  <span className="amgi-stats-badge">
                    최고 {hourlyStats.bestHour.hour}시 ({hourlyStats.bestHour.pct}%)
                  </span>
                )}
              </div>

              {!hourlyStats.hasAny ? (
                <div className="amgi-future-empty">아직 시간대별 학습 기록이 없습니다.</div>
              ) : (
                <>
                  <div className="amgi-future-svg-wrap">
                    <svg
                      className="amgi-future-svg"
                      viewBox="0 0 320 132"
                      role="img"
                      aria-label="시간대별 학습 정답률 막대 그래프"
                    >
                      {(() => {
                        const plotLeft = 8;
                        const plotRight = 312;
                        const plotTop = 10;
                        const plotBottom = 108;
                        const plotH = plotBottom - plotTop;
                        const plotW = plotRight - plotLeft;
                        const slotW = plotW / 24;
                        const barW = Math.max(5, slotW - 3);
                        return (
                          <>
                            <line
                              x1={plotLeft}
                              x2={plotRight}
                              y1={plotBottom - 0.8 * plotH}
                              y2={plotBottom - 0.8 * plotH}
                              className="amgi-future-guide"
                            />
                            {hourlyStats.hours.map((h) => {
                              const barH = h.total > 0 ? Math.max(4, (h.pct / 100) * plotH) : 0;
                              const x = plotLeft + h.hour * slotW + 1.5;
                              const y = plotBottom - barH;
                              return (
                                <g key={h.hour}>
                                  {barH > 0 && (
                                    <rect
                                      x={x}
                                      y={y}
                                      width={barW}
                                      height={barH}
                                      rx={isEink ? 0 : 2}
                                      className={`amgi-hour-bar ${selectedHour === h.hour ? 'is-selected' : ''}`}
                                    />
                                  )}
                                  <rect
                                    x={plotLeft + h.hour * slotW}
                                    y={plotTop}
                                    width={slotW}
                                    height={plotH + 8}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedHour(h.hour)}
                                  />
                                </g>
                              );
                            })}
                            {[0, 6, 12, 18, 23].map((hr) => (
                              <text
                                key={hr}
                                x={plotLeft + hr * slotW + slotW / 2}
                                y={125}
                                textAnchor={hr === 0 ? 'start' : hr === 23 ? 'end' : 'middle'}
                                className="amgi-future-axis-text"
                              >
                                {hr}시
                              </text>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="amgi-heat-inspect">
                    {selectedHour !== null && hourlyStats.hours[selectedHour]
                      ? (() => {
                          const h = hourlyStats.hours[selectedHour];
                          return h.total > 0
                            ? `${h.hour}시 · 정답률 ${h.pct}% (${h.correct}/${h.total}회)`
                            : `${h.hour}시 · 학습 기록 없음`;
                        })()
                      : '시간대 막대를 누르면 상세 정답률을 볼 수 있어요'}
                  </div>
                </>
              )}
            </section>

            {/* Card 8 (Optional): 최근 기억 유지율 */}
            {hasRetentionData && (
              <section className="amgi-stats-card amgi-stats-span-2">
                <div className="amgi-stats-card-head">
                  <div>
                    <h2 className="amgi-stats-card-title">최근 기억 유지율</h2>
                    <p className="amgi-stats-card-sub">복습 카드를 얼마나 잘 기억하고 있는지 보여줍니다</p>
                  </div>
                </div>
                <div className="amgi-retention-strip">
                  <div className="amgi-retention-cell">
                    <span className="amgi-retention-label">오늘 정답률</span>
                    <span className="amgi-retention-val">
                      {calcTrueRetentionPct(retention?.today)}
                    </span>
                  </div>
                  <div className="amgi-retention-cell">
                    <span className="amgi-retention-label">최근 7일</span>
                    <span className="amgi-retention-val">
                      {calcTrueRetentionPct(retention?.week)}
                    </span>
                  </div>
                  <div className="amgi-retention-cell">
                    <span className="amgi-retention-label">최근 30일</span>
                    <span className="amgi-retention-val">
                      {calcTrueRetentionPct(retention?.month)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Bottom Toggle Card: Anki 상세 통계 원본 보기 */}
          <div className="amgi-stats-official-card">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Anki 상세 통계 원본 보기
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>
                시간대별 정답률, 복습 간격 분포, 버튼 통계 등 세부 그래프를 봅니다.
              </div>
            </div>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setShowOfficialIframe(true)}
            >
              <IconStats size={17} />
              <span>원본 보기</span>
              <IconChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* Deck Picker Sheet */}
      <ActionMenu
        open={deckPickerOpen}
        onClose={() => setDeckPickerOpen(false)}
        title="통계를 볼 덱 선택"
        items={[
          {
            id: '__all__',
            label: '전체 덱',
            icon: selectedDeck === null ? <IconCheck size={18} /> : undefined,
            onSelect: () => setSelectedDeck(null),
          },
          ...decks.map((d) => ({
            id: String(toNumber(d.id)),
            label: d.name || '덱',
            icon: selectedDeck === d.name ? <IconCheck size={18} /> : undefined,
            onSelect: () => setSelectedDeck(d.name ?? null),
          })),
        ]}
      />
    </div>
  );
};
