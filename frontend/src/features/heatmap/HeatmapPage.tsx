import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getHeatmap } from '../../api/habitApi';
import type { HeatmapDay } from '../../api/habitApi';
import Navbar from '../../components/Navbar';

type ViewMode = 'monthly' | 'yearly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TRAILING_MONTH_COUNT = 12;

const getHeatColor = (count: number): string => {
  if (count === 0) return '#2C2C2A';
  if (count <= 1) return '#3B4D2B';
  if (count <= 2) return '#4A7C3F';
  if (count <= 4) return '#5A9E50';
  return '#6FCF5B';
};

// Builds the calendar grid for any given month: leading blanks for offset + one entry per day.
const buildGridForMonth = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
};

// Returns the last `count` (year, month) pairs ending at the reference month, oldest first.
const getTrailingMonths = (ref: Date, count: number): { year: number; month: number }[] => {
  const result: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
};

const HeatmapPage = () => {
  const { userId } = useAuth();
  const [view, setView] = useState<ViewMode>('monthly');
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [stats, setStats] = useState({ daysCompleted: 0, totalDays: 0, consistency: 0 });
  const [yearStats, setYearStats] = useState({ activeDays: 0, totalDays: 0, consistency: 0 });

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const generateMockData = (): Map<string, number> => {
    const map = new Map<string, number>();
    for (let d = 0; d < 365; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const key = date.toISOString().split('T')[0];
      if (Math.random() > 0.3) map.set(key, Math.ceil(Math.random() * 5));
    }
    return map;
  };

  useEffect(() => {
    if (!userId) return;
    getHeatmap(userId)
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionCount));
        setHeatmapData(map);
      })
      .catch(() => setHeatmapData(generateMockData()));
  }, [userId]);

  // Monthly stats (for the single-month detail view)
  useEffect(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let completed = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const key = date.toISOString().split('T')[0];
      if ((heatmapData.get(key) ?? 0) > 0) completed++;
    }
    setStats({
      daysCompleted: completed,
      totalDays: daysInMonth,
      consistency: Math.round((completed / daysInMonth) * 100),
    });
  }, [heatmapData, currentMonth, currentYear]);

  // Trailing-12-month stats (for the yearly overview) — only as accurate as the data returned
  // by getHeatmap. If that endpoint doesn't return a full year, these numbers will undercount.
  useEffect(() => {
    let active = 0;
    let total = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      if ((heatmapData.get(key) ?? 0) > 0) active++;
      total++;
    }
    setYearStats({
      activeDays: active,
      totalDays: total,
      consistency: Math.round((active / total) * 100),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmapData]);

  const monthCells = buildGridForMonth(currentYear, currentMonth);
  const trailingMonths = getTrailingMonths(today, TRAILING_MONTH_COUNT);

  const getMonthActiveDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let active = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = new Date(year, month, d).toISOString().split('T')[0];
      if ((heatmapData.get(key) ?? 0) > 0) active++;
    }
    return active;
  };

  const displayedStats = view === 'monthly'
    ? { primary: `${stats.daysCompleted}/${stats.totalDays}`, primaryLabel: 'days completed', consistency: stats.consistency }
    : { primary: `${yearStats.activeDays}/${yearStats.totalDays}`, primaryLabel: 'active days (year)', consistency: yearStats.consistency };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className={`mx-auto px-4 py-8 ${view === 'yearly' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="animate-fade-up">
          <div className="mb-6">
            <p className="text-sm font-medium" style={{ color: '#B4B2A9' }}>My consistency</p>
            <h1 className="text-2xl font-bold text-white">
              {view === 'monthly' ? `${MONTHS[currentMonth]} heatmap` : 'Past year overview'}
            </h1>
          </div>

          <div className="rounded-3xl p-6 animate-fade-up delay-100"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>

            {/* Toggle */}
            <div className="flex rounded-xl p-1 mb-6" style={{ background: '#363634' }}>
              {(['monthly', 'yearly'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: view === v ? '#F1EFE8' : 'transparent',
                    color: view === v ? '#1a1a18' : '#B4B2A9',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Monthly View */}
            {view === 'monthly' && (
              <div className="animate-fade-up">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div key={i} className="text-center text-xs font-medium" style={{ color: '#5F5E5A' }}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthCells.map((date, i) => {
                    if (!date) return <div key={i} />;
                    const key = date.toISOString().split('T')[0];
                    const count = heatmapData.get(key) ?? 0;
                    const isToday = date.toDateString() === today.toDateString();
                    return (
                      <div key={i} title={`${key}: ${count} completions`}
                        className="aspect-square rounded-lg transition-all hover:scale-110 cursor-pointer"
                        style={{
                          background: getHeatColor(count),
                          outline: isToday ? '2px solid #534AB7' : 'none',
                          outlineOffset: 1,
                        }} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Yearly View — responsive grid of mini month-calendars.
                repeat(auto-fit, minmax(150px, 1fr)) fluidly reflows the column count based on
                the container's real width: 1 column on a phone, more as the screen widens,
                rather than hardcoded breakpoints. */}
            {view === 'yearly' && (
              <div className="animate-fade-up">
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
                >
                  {trailingMonths.map(({ year, month }) => {
                    const cells = buildGridForMonth(year, month);
                    const activeDays = getMonthActiveDays(year, month);
                    const showYear = year !== currentYear;
                    const isCurrentMonth = year === currentYear && month === currentMonth;
                    return (
                      <div key={`${year}-${month}`} className="rounded-xl p-2.5"
                        style={{
                          background: '#242422',
                          border: isCurrentMonth ? '1px solid #534AB7' : '1px solid transparent',
                        }}>
                        <div className="flex items-baseline justify-between mb-1.5 px-0.5">
                          <span className="text-xs font-semibold text-white">
                            {MONTHS[month]}{showYear ? ` '${String(year).slice(2)}` : ''}
                          </span>
                          <span className="text-[10px]" style={{ color: '#5F5E5A' }}>{activeDays}d</span>
                        </div>
                        <div className="grid grid-cols-7 gap-[3px]">
                          {cells.map((date, i) => {
                            if (!date) return <div key={i} className="aspect-square" />;
                            const key = date.toISOString().split('T')[0];
                            const count = heatmapData.get(key) ?? 0;
                            const isToday = date.toDateString() === today.toDateString();
                            return (
                              <div key={i} title={`${key}: ${count} completions`}
                                className="aspect-square rounded-[3px] transition-all hover:scale-125 cursor-pointer"
                                style={{
                                  background: getHeatColor(count),
                                  outline: isToday ? '1.5px solid #534AB7' : 'none',
                                  outlineOffset: 0.5,
                                }} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-5">
              <span className="text-xs" style={{ color: '#5F5E5A' }}>Less</span>
              {[0, 1, 2, 4, 5].map(c => (
                <div key={c} className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(c) }} />
              ))}
              <span className="text-xs" style={{ color: '#5F5E5A' }}>More</span>
            </div>
          </div>

          {/* Stats — reflect whichever view is active */}
          <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-up delay-200">
            <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <p className="text-2xl font-bold text-white">{displayedStats.primary}</p>
              <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>{displayedStats.primaryLabel}</p>
            </div>
            <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <p className="text-2xl font-bold text-white">{displayedStats.consistency}%</p>
              <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>consistency</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapPage;