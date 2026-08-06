import React, { useEffect, useState } from 'react';

type ViewMode = 'monthly' | 'yearly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TRAILING_MONTH_COUNT = 12;

interface HeatmapViewProps {
  heatmapData: Map<string, number>;
  title: string;
}

const getHeatColor = (percentage: number): string => {
  if (percentage <= 0) return '#2C2C2A';
  if (percentage <= 20) return '#3B4D2B';
  if (percentage <= 40) return '#4A7C3F';
  if (percentage <= 60) return '#5A9E50';
  if (percentage <= 80) return '#6FCF5B';
  return '#86E971'; // 100%
};

const buildGridForMonth = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
};

const getMonthsForYear = (year: number | 'trailing', ref: Date): { year: number; month: number }[] => {
  const result: { year: number; month: number }[] = [];
  if (year === 'trailing') {
    for (let i = TRAILING_MONTH_COUNT - 1; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else {
    for (let i = 0; i < 12; i++) {
      result.push({ year, month: i });
    }
  }
  return result;
};

const HeatmapView: React.FC<HeatmapViewProps> = ({ heatmapData, title }) => {
  const [view, setView] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState<number | 'trailing'>('trailing');
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const [stats, setStats] = useState({ daysCompleted: 0, totalDays: 0, consistency: 0 });
  const [yearStats, setYearStats] = useState({ activeDays: 0, totalDays: 0, consistency: 0 });

  // Monthly stats
  useEffect(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let completed = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = new Date(currentYear, currentMonth, d).toISOString().split('T')[0];
      if ((heatmapData.get(key) ?? 0) > 0) completed++;
    }
    setStats({
      daysCompleted: completed,
      totalDays: daysInMonth,
      consistency: Math.round((completed / daysInMonth) * 100),
    });
  }, [heatmapData, currentMonth, currentYear]);

  // Yearly stats based on selected year
  useEffect(() => {
    let active = 0;
    let total = 0;
    
    if (selectedYear === 'trailing') {
      for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        if ((heatmapData.get(key) ?? 0) > 0) active++;
        total++;
      }
    } else {
      const isLeap = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || (selectedYear % 400 === 0);
      total = isLeap ? 366 : 365;
      
      // We loop through the year
      for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const key = new Date(selectedYear, m, d).toISOString().split('T')[0];
          if ((heatmapData.get(key) ?? 0) > 0) active++;
        }
      }
    }
    
    setYearStats({
      activeDays: active,
      totalDays: total,
      consistency: Math.round((active / total) * 100),
    });
  }, [heatmapData, selectedYear, today]);

  const monthCells = buildGridForMonth(currentYear, currentMonth);
  const yearMonths = getMonthsForYear(selectedYear, today);

  const getMonthActiveDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let active = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = new Date(year, month, d).toISOString().split('T')[0];
      if ((heatmapData.get(key) ?? 0) > 0) active++;
    }
    return active;
  };

  const yearsWithData = Array.from(heatmapData.keys())
    .map(dateStr => parseInt(dateStr.split('-')[0], 10))
    .filter(y => !isNaN(y));
  
  const earliestYearData = yearsWithData.length > 0 ? Math.min(...yearsWithData) : currentYear;
  const earliest = Math.min(currentYear, earliestYearData);
  
  const availableYears = [];
  for (let y = currentYear; y >= earliest; y--) {
    availableYears.push(y);
  }

  return (
    <div className={`mx-auto ${view === 'yearly' ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <div className="animate-fade-up">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <p className="text-sm font-medium" style={{ color: '#B4B2A9' }}>{title}</p>
            <h1 className="text-2xl font-bold text-white">
              {view === 'monthly' ? `${MONTHS[currentMonth]} heatmap` : 'Yearly overview'}
            </h1>
          </div>
          {view === 'yearly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'trailing' ? 'trailing' : Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all focus:outline-none"
              style={{ background: '#363634', color: '#F1EFE8', border: '1px solid #4A4A48' }}
            >
              <option value="trailing">Current (Trailing 12 Months)</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-3xl p-6 animate-fade-up delay-100" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
          
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

          {view === 'monthly' && (
            <div className="animate-fade-up p-5 rounded-2xl" style={{ background: '#242422' }}>
              <div className="grid grid-cols-7 gap-2 mb-3">
                {DAYS_OF_WEEK.map((d, i) => (
                  <div key={i} className="text-center text-xs font-semibold" style={{ color: '#5F5E5A' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthCells.map((date, i) => {
                  if (!date) return <div key={i} className="aspect-square" />; // Added aspect-square to fix structural issue
                  const key = date.toISOString().split('T')[0];
                  const percentage = heatmapData.get(key) ?? 0;
                  const isToday = date && date.toDateString() === today.toDateString();
                  return (
                    <div key={i} title={`${key}: ${percentage}% tasks completed`}
                      className="aspect-square rounded-lg transition-all hover:scale-110 cursor-pointer"
                      style={{
                        background: getHeatColor(percentage),
                        outline: isToday ? '2px solid #534AB7' : 'none',
                        outlineOffset: 1,
                      }} />
                  );
                })}
              </div>
            </div>
          )}

          {view === 'yearly' && (
            <div className="animate-fade-up">
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {yearMonths.map(({ year, month }) => {
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
                          const percentage = heatmapData.get(key) ?? 0;
                          const isToday = date && date.toDateString() === today.toDateString();
                          return (
                            <div key={i} title={`${key}: ${percentage}% tasks completed`}
                              className="aspect-square rounded-[3px] transition-all hover:scale-125 cursor-pointer"
                              style={{
                                background: getHeatColor(percentage),
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

          <div className="flex items-center gap-2 mt-5">
            <span className="text-xs" style={{ color: '#5F5E5A' }}>0%</span>
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(0) }} title="0%" />
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(20) }} title="1-20%" />
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(40) }} title="21-40%" />
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(60) }} title="41-60%" />
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(80) }} title="61-80%" />
            <div className="w-3 h-3 rounded-sm" style={{ background: getHeatColor(100) }} title="81-100%" />
            <span className="text-xs" style={{ color: '#5F5E5A' }}>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-up delay-200">
          <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <p className="text-2xl font-bold text-white">
              {view === 'monthly' ? `${stats.daysCompleted}/${stats.totalDays}` : `${yearStats.activeDays}/${yearStats.totalDays}`}
            </p>
            <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>
              {view === 'monthly' ? 'days completed' : 'active days'}
            </p>
          </div>
          <div className="rounded-2xl p-5 text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <p className="text-2xl font-bold text-white">
              {view === 'monthly' ? stats.consistency : yearStats.consistency}%
            </p>
            <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>consistency</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapView;
