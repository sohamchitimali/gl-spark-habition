import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getHeatmap } from '../../api/habitApi';
import type { HeatmapDay } from '../../api/habitApi';
import Navbar from '../../components/Navbar';

type ViewMode = 'monthly' | 'yearly';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['S','M','T','W','T','F','S'];

const getHeatColor = (count: number): string => {
  if (count === 0) return '#2C2C2A';
  if (count <= 1)  return '#3B4D2B';
  if (count <= 2)  return '#4A7C3F';
  if (count <= 4)  return '#5A9E50';
  return '#6FCF5B';
};

const HeatmapPage = () => {
  const { userId } = useAuth();
  const [view, setView] = useState<ViewMode>('monthly');
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [stats, setStats] = useState({ daysCompleted: 0, totalDays: 0, consistency: 0 });

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

  const buildMonthGrid = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const cells: (null | Date)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(currentYear, currentMonth, d));
    return cells;
  };

  const buildYearGrid = () => {
    const weeks: (Date | null)[][] = [];
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() - start.getDay());
    for (let w = 0; w < 53; w++) {
      const week: (Date | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        week.push(date <= today ? date : null);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const monthCells = buildMonthGrid();
  const yearWeeks = buildYearGrid();

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-fade-up">
          <div className="mb-6">
            <p className="text-sm font-medium" style={{ color: '#B4B2A9' }}>My consistency</p>
            <h1 className="text-2xl font-bold text-white">
              {view === 'monthly' ? `${MONTHS[currentMonth]} heatmap` : `${currentYear} overview`}
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

            {/* Yearly View */}
            {view === 'yearly' && (
              <div className="animate-fade-up overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                  {yearWeeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {week.map((date, di) => {
                        if (!date) return <div key={di} className="w-3 h-3" />;
                        const key = date.toISOString().split('T')[0];
                        const count = heatmapData.get(key) ?? 0;
                        return (
                          <div key={di} title={`${key}: ${count}`}
                            className="w-3 h-3 rounded-sm transition-all hover:scale-125 cursor-pointer"
                            style={{ background: getHeatColor(count) }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-2 min-w-max">
                  {MONTHS.map((m) => (
                    <div key={m} className="text-xs" style={{ color: '#5F5E5A', width: 40 }}>{m}</div>
                  ))}
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

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-up delay-200">
            <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <p className="text-2xl font-bold text-white">{stats.daysCompleted}/{stats.totalDays}</p>
              <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>days completed</p>
            </div>
            <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <p className="text-2xl font-bold text-white">{stats.consistency}%</p>
              <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>consistency</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapPage;
