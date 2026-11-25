import React, { useMemo, useState } from 'react';
import { Revlog } from '../types/models';

interface HeatmapProps {
  revlogs: Revlog[];
}

interface DayCell {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

function toLocalDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const Heatmap: React.FC<HeatmapProps> = ({ revlogs }) => {
  const [hovered, setHovered] = useState<DayCell | null>(null);

  const { weeks, totalReviews, activeDays, currentStreak, longestStreak, todayCount } =
    useMemo(() => {
      const countsByDay = new Map<string, number>();
      for (const r of revlogs) {
        const key = toLocalDateKey(r.id);
        countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayKey = toLocalDateKey(today.getTime());

      const totalDays = 365;
      const startDate = new Date(today.getTime() - (totalDays - 1) * 86_400_000);
      const padStart = startDate.getDay(); // 0=Sun..6=Sat

      const cells: Array<DayCell | null> = [];
      for (let i = 0; i < padStart; i++) {
        cells.push(null);
      }

      let maxCount = 0;
      let total = 0;
      let active = 0;
      let longest = 0;
      let running = 0;

      const dayList: DayCell[] = [];
      for (let i = 0; i < totalDays; i++) {
        const dt = new Date(startDate.getTime() + i * 86_400_000);
        const key = toLocalDateKey(dt.getTime());
        const count = countsByDay.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        if (count > 0) {
          active++;
          running++;
          if (running > longest) longest = running;
        } else {
          running = 0;
        }
        total += count;
        dayList.push({ dateKey: key, count, level: 0 });
      }

      // Compute current streak backward from today (or yesterday if today is 0)
      let curStreak = 0;
      for (let i = dayList.length - 1; i >= 0; i--) {
        if (dayList[i].count > 0) {
          curStreak++;
        } else if (i === dayList.length - 1) {
          continue;
        } else {
          break;
        }
      }

      const classify = (c: number): 0 | 1 | 2 | 3 | 4 => {
        if (c <= 0) return 0;
        const norm = maxCount > 0 ? c / maxCount : 0;
        if (norm <= 0.25) return 1;
        if (norm <= 0.5) return 2;
        if (norm <= 0.75) return 3;
        return 4;
      };

      for (const cell of dayList) {
        cell.level = classify(cell.count);
        cells.push(cell);
      }

      const weekCols: Array<Array<DayCell | null>> = [];
      for (let i = 0; i < cells.length; i += 7) {
        weekCols.push(cells.slice(i, i + 7));
      }

      return {
        weeks: weekCols,
        totalReviews: total,
        activeDays: active,
        currentStreak: curStreak,
        longestStreak: longest,
        todayCount: countsByDay.get(todayKey) ?? 0,
      };
    }, [revlogs]);

  return (
    <div className="heatmap-card card-surface">
      <div className="heatmap-header">
        <div>
          <h3>365일 학습 잔디</h3>
          <p className="muted-text small">
            최근 1년간 총 <strong>{totalReviews.toLocaleString()}</strong>회 복습 · 학습일{' '}
            <strong>{activeDays}</strong>일
          </p>
        </div>
        <div className="heatmap-metrics">
          <div className="metric-chip">
            <span className="metric-label">오늘</span>
            <strong>{todayCount}</strong>
          </div>
          <div className="metric-chip">
            <span className="metric-label">연속 학습</span>
            <strong>{currentStreak}일</strong>
          </div>
          <div className="metric-chip">
            <span className="metric-label">최장 기록</span>
            <strong>{longestStreak}일</strong>
          </div>
        </div>
      </div>

      <div className="heatmap-scroll">
        <div className="heatmap-grid" role="grid" aria-label="365-day review heatmap">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="heatmap-col">
              {Array.from({ length: 7 }).map((_, dIdx) => {
                const cell = week[dIdx] ?? null;
                if (!cell) {
                  return <div key={dIdx} className="heatmap-cell empty-pad" />;
                }
                return (
                  <div
                    key={cell.dateKey}
                    className={`heatmap-cell level-${cell.level}`}
                    title={`${cell.dateKey}: ${cell.count}회 복습`}
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-footer">
        <span className="muted-text small">
          {hovered
            ? `${hovered.dateKey}: ${hovered.count}회 복습`
            : '날짜 셀에 마우스를 올리면 상세 복습 수를 볼 수 있습니다.'}
        </span>
        <div className="heatmap-legend">
          <span className="muted-text small">적음</span>
          <span className="heatmap-cell level-0" />
          <span className="heatmap-cell level-1" />
          <span className="heatmap-cell level-2" />
          <span className="heatmap-cell level-3" />
          <span className="heatmap-cell level-4" />
          <span className="muted-text small">많음</span>
        </div>
      </div>
    </div>
  );
};
