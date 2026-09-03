import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  getHabits, createHabit, completeHabit, deleteHabit,
  createTask, toggleTask, deleteTask,
  getStreak, getHeatmap, getPersonalConsistency, type Habit, type HeatmapDay
} from '../../api/habitApi';
import { getUserInsights, type UserInsightDTO } from '../../api/insightsApi';
import Navbar from '../../components/Navbar';
import CelebrationModal from '../../components/CelebrationModal';
import ConsistencyRings, { computeRingsFromHeatmap } from '../../components/ConsistencyRings';
import { useConfirm } from '../../context/ConfirmContext';
import confetti from 'canvas-confetti';
import Loading from '../../components/Loading';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HabitWithTasks extends Habit {
  tasksLoaded: boolean;
}

// ─── Small sub-components ─────────────────────────────────────────────────────

const ProgressBar = ({ done, total }: { done: number; total: number }) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="h-0.5 w-full rounded-full mt-3" style={{ background: '#363634' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)' }}
      />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { userId } = useAuth();
  const { confirm } = useConfirm();

  // Stats
  const [streak, setStreak] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [todayEarned, setTodayEarned] = useState(false);
  const [overallConsistency, setOverallConsistency] = useState<number | null>(null);
  const [userInsight, setUserInsight] = useState<UserInsightDTO | null>(null);

  // Consistency rings — computed from personal heatmap
  const [personalHeatmap, setPersonalHeatmap] = useState<Map<string, number>>(new Map());

  // Habits
  const [habits, setHabits] = useState<HabitWithTasks[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);

  // Expanded state
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create habit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Add task inputs per habit (habitId → input value)
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  // Celebration Modal state
  const [celebration, setCelebration] = useState<{ showCoin: boolean; showFire: boolean; message: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadStats = () => {
    if (!userId) return;
    getStreak(userId).then(r => {
      setStreak(r.data.currentStreak);
      setPersonalBest(r.data.personalBest);
      setTodayEarned(r.data.todayEarned);
    }).catch(() => { });

    getPersonalConsistency(userId).then(r => {
      setOverallConsistency(r.data.score);
    }).catch(() => { });
  };

  useEffect(() => {
    if (!userId) return;
    loadStats();
    getHabits(userId).then(r => {
      setHabits(r.data.filter(h => !h.groupId).map(h => ({ ...h, tasksLoaded: true })));
    }).catch(() => { }).finally(() => setHabitsLoading(false));

    getUserInsights().then(r => {
      setUserInsight(r.data);
    }).catch(() => { });

    // Load personal heatmap for consistency rings
    getHeatmap(userId).then(r => {
      const map = new Map<string, number>();
      (r.data.days as HeatmapDay[]).forEach(d => map.set(d.date, d.completionPercentage));
      setPersonalHeatmap(map);
    }).catch(() => { });

    const interval = setInterval(() => {
      loadStats();
    }, 5000); // Poll user stats every 5 seconds

    return () => clearInterval(interval);
  }, [userId]);

  // ─── Expand a habit — lazy-load its tasks ──────────────────────────────────

  const handleExpand = (habitId: number) => {
    if (expandedId === habitId) {
      setExpandedId(null);
    } else {
      setExpandedId(habitId);
    }
  };

  // ─── Toggle a single task ──────────────────────────────────────────────────

  const handleToggleTask = async (habitId: number, taskId: number) => {
    const updated = await toggleTask(taskId);
    setHabits(prev => prev.map(h =>
      h.id === habitId
        ? { ...h, tasks: h.tasks.map(t => t.id === taskId ? updated.data : t) }
        : h
    ));
  };

  // ─── Add a task ────────────────────────────────────────────────────────────

  const handleAddTask = async (habitId: number) => {
    const title = (taskInputs[habitId] ?? '').trim();
    if (!title) return;
    const res = await createTask(habitId, title);
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, tasks: [...h.tasks, res.data] } : h
    ));
    setTaskInputs(prev => ({ ...prev, [habitId]: '' }));
  };

  // ─── Delete a task ─────────────────────────────────────────────────────────

  const handleDeleteTask = async (habitId: number, taskId: number) => {
    await deleteTask(taskId);
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, tasks: h.tasks.filter(t => t.id !== taskId) } : h
    ));
  };

  // ─── Complete a habit ──────────────────────────────────────────────────────

  const handleCompleteHabit = async (habit: HabitWithTasks) => {
    try {
      const res = await completeHabit(habit.id);
      const updatedHabits = habits.map(h =>
        h.id === habit.id ? { ...h, completedToday: true } : h
      );
      setHabits(updatedHabits);
      setStreak(res.data.currentStreak);
      loadStats(); // refresh coins

      const allDone = updatedHabits.every(h => h.completedToday);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#26215C', '#534AB7', '#AFA9EC', '#F0997B']
      });

      if (allDone) {
        setCelebration({ showCoin: false, showFire: true, message: `All Habits Done Streak is ${res.data.currentStreak}` });
        setTimeout(() => setCelebration(null), 3000);
      } else {
        showToast(`Habit Completed`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) showToast(`⚠️ ${msg}`);
    }
  };

  // ─── Delete habit ──────────────────────────────────────────────────────────

  const handleDeleteHabit = async (habitId: number) => {
    const confirmed = await confirm('Are you sure you want to delete this habit and all its history?', { isDestructive: true });
    if (!confirmed) return;
    try {
      await deleteHabit(habitId);
      setHabits(prev => prev.filter(h => h.id !== habitId));
      showToast('🗑️ Habit deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) showToast(`⚠️ ${msg}`);
    }
  };

  // ─── Create habit ──────────────────────────────────────────────────────────

  const handleCreateHabit = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await createHabit(newTitle.trim(), newDesc.trim() || '');
      setHabits(prev => [...prev, { ...res.data, tasksLoaded: true }]);
      setNewTitle('');
      setNewDesc('');
      setShowCreateModal(false);
      showToast('Habit created!');
    } finally {
      setCreating(false);
    }
  };

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const completedCount = habits.filter(h => h.completedToday).length;
  const completionRate = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl animate-fade-up"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #26215C, #534AB7)',
            border: '1px solid rgba(127,119,221,0.5)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p style={{ color: '#B4B2A9' }} className="text-sm mb-1">{today}</p>
          <h1 className="text-3xl font-bold text-white">{greeting} 👋</h1>
        </div>

        {/* Stats + Consistency Rings — unified layout */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">

          {/* LEFT: streak on top, coins+rank row below */}
          <div className="flex flex-col gap-4 flex-1">

            {/* Streak */}
            <div className={`rounded-2xl p-5 transition-all duration-700 ${(todayEarned && habits.length > 0) ? 'animate-border-pulse' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #26215C, #534AB7)',
                border: (todayEarned && habits.length > 0) ? '2px solid #F97316' : '1px solid rgba(83,74,183,0.5)',
                boxShadow: (todayEarned && habits.length > 0) ? '0 0 0 0 rgba(249, 115, 22, 0.9)' : 'none',
                animation: (todayEarned && habits.length > 0) ? 'orangePulse 1.8s ease-out infinite' : 'none',
                filter: (todayEarned && habits.length > 0) ? 'none' : 'grayscale(100%) opacity(70%)'
              }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1" style={{ color: '#AFA9EC' }}>Personal Streak</p>
                  <p className="text-4xl font-bold text-white">{streak} <span className="text-2xl">🔥</span></p>
                  <p className="text-xs mt-1" style={{ color: '#AFA9EC' }}>Max Streak : {personalBest} days</p>
                </div>
                <div className="text-5xl select-none">🔥</div>
              </div>
            </div>

            {/* Overall Consistency Card */}
            {overallConsistency !== null && (
              <div className="rounded-2xl p-5 animate-fade-up delay-100 flex-1 flex flex-col justify-center"
                style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
                <p className="text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Personal Overall Consistency</p>
                <p className="text-3xl font-bold text-white">
                  {overallConsistency.toFixed(1)}<span className="text-lg" style={{ color: '#5F5E5A' }}>%</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: '#363634' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${overallConsistency}%`, background: 'linear-gradient(90deg, #7F77DD, #534AB7)' }} />
                </div>
              </div>
            )}

            {/* Today card below streak */}
            <div className="rounded-2xl p-5 animate-fade-up delay-200 flex-1"
              style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <p className="text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Today</p>
              <p className="text-3xl font-bold text-white">
                {completedCount}<span className="text-lg" style={{ color: '#5F5E5A' }}>/{habits.length}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full" style={{ background: '#363634' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${completionRate}%`, background: 'linear-gradient(90deg, #7F77DD, #534AB7)' }} />
              </div>
            </div>
          </div>

          {/* RIGHT: Personal Consistency Rings */}
          <div className="rounded-2xl p-6 flex flex-col justify-center animate-fade-up delay-300 flex-1"
            style={{ background: '#2C2C2A', border: '1px solid #363634', minWidth: 0 }}>
            <p className="text-sm font-semibold mb-5" style={{ color: '#B4B2A9' }}>Personal Consistency Rings</p>
            <ConsistencyRings
              {...computeRingsFromHeatmap(personalHeatmap)}
              size={180}
            />
          </div>
        </div>

        {/* AI Personal Insights */}
        {userInsight && (
          <div className="mb-8 animate-fade-up delay-200">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <span className="text-xl">✨</span> AI Progress Insights
            </h2>
            <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(145deg, #2C2C2A, #242422)', borderColor: '#363634' }}>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Score & Next Milestone */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2 border-b md:border-b-0 md:border-r border-[#363634] pb-4 md:pb-0 pr-0 md:pr-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-center" style={{ color: '#B4B2A9' }}>Consistency Score</p>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-[#534AB7] bg-[#534AB7]/20 text-[#AFA9EC] shadow-[0_0_15px_rgba(83,74,183,0.3)]">
                    <span className="text-xl font-bold">{Math.round(userInsight.personalConsistencyScore || 0)}</span>
                  </div>
                  <p className="text-xs text-center mt-2 text-white"><span className="text-[#AFA9EC]">🎯 Next Milestone:</span><br />{userInsight.predictedNextMilestone || 'Keep tracking habits!'}</p>
                </div>

                {/* Achievements & Improvements */}
                <div className="flex-[2] flex flex-col justify-center text-sm space-y-3">
                  {(userInsight.recentAchievements || []).length > 0 && (
                    <div>
                      <span className="text-green-400 font-semibold mb-1 block">🏆 Recent Achievements:</span>
                      <ul className="list-disc list-inside text-[#B4B2A9] space-y-1">
                        {(userInsight.recentAchievements || []).map((ach, idx) => <li key={idx}>{ach}</li>)}
                      </ul>
                    </div>
                  )}
                  {(userInsight.areasForImprovement || []).length > 0 && (
                    <div>
                      <span className="text-[#F0997B] font-semibold mb-1 block">💡 Focus Areas:</span>
                      <ul className="list-disc list-inside text-[#B4B2A9] space-y-1">
                        {(userInsight.areasForImprovement || []).map((area, idx) => <li key={idx}>{area}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Habits list */}
        <div className="animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Today's habits</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.3)' }}
            >
              <span className="text-base leading-none">＋</span> New habit
            </button>
          </div>

          {habitsLoading ? (
            <div className="flex justify-center py-12">
              <Loading size={24} />
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <div className="text-5xl mb-3">📋</div>
              <p className="font-semibold text-white mb-1">No habits yet</p>
              <p className="text-sm" style={{ color: '#B4B2A9' }}>Click <strong>＋ New habit</strong> to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => {
                const isExpanded = expandedId === habit.id;
                const doneTasks = habit.tasks.filter(t => t.completed).length;
                const totalTasks = habit.tasks.length;
                const allTasksDone = totalTasks === 0 || doneTasks === totalTasks;

                return (
                  <div
                    key={habit.id}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: habit.completedToday ? 'rgba(83,74,183,0.12)' : '#2C2C2A',
                      border: habit.completedToday
                        ? '1px solid rgba(83,74,183,0.4)'
                        : isExpanded
                          ? '1px solid rgba(127,119,221,0.4)'
                          : '1px solid #363634',
                    }}
                  >
                    {/* ── Habit header row (always visible, click to expand) ── */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer select-none group"
                      onClick={() => handleExpand(habit.id)}
                    >
                      {/* Completion circle */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: habit.completedToday ? '#534AB7' : 'transparent',
                          border: habit.completedToday ? '2px solid #534AB7' : '2px solid #5F5E5A',
                        }}
                      >
                        {habit.completedToday && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Title + subtitle hint */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate"
                          style={{
                            color: habit.completedToday ? '#AFA9EC' : '#F1EFE8',
                            textDecoration: habit.completedToday ? 'line-through' : 'none',
                          }}>
                          {habit.title}
                        </p>
                        {/* Contextual hint to encourage expanding */}
                        {!habit.completedToday && (totalTasks > 0 || habit.description) && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#5F5E5A' }}>
                            {totalTasks > 0
                              ? `${doneTasks}/${totalTasks} tasks · tap to expand`
                              : 'tap to expand'}
                          </p>
                        )}
                        {!habit.completedToday && totalTasks === 0 && !habit.description && !habit.tasksLoaded && (
                          <p className="text-xs mt-0.5" style={{ color: '#5F5E5A' }}>tap to add tasks</p>
                        )}
                      </div>

                      {/* Right side: chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Delete habit button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                          style={{ color: '#D85A30' }}
                          title="Delete habit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        {/* Chevron — rotates when expanded */}
                        <svg
                          className="w-4 h-4 transition-transform duration-200"
                          style={{
                            color: '#5F5E5A',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Task progress bar (always visible if tasks exist) */}
                    {totalTasks > 0 && (
                      <div className="px-4">
                        <ProgressBar done={doneTasks} total={totalTasks} />
                      </div>
                    )}

                    {/* ── Expanded panel ── */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 animate-fade-up" onClick={e => e.stopPropagation()}>
                        <div style={{ borderTop: '1px solid #363634' }} className="pt-3">

                          {/* Description */}
                          {habit.description && (
                            <p className="text-sm mb-4 leading-relaxed" style={{ color: '#B4B2A9' }}>
                              {habit.description}
                            </p>
                          )}

                          {/* Tasks section */}
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: '#5F5E5A' }}>
                            Tasks {totalTasks > 0 ? `(${doneTasks}/${totalTasks})` : ''}
                          </p>

                          {/* Task list */}
                          {!habit.tasksLoaded ? (
                            <p className="text-xs" style={{ color: '#5F5E5A' }}>Loading…</p>
                          ) : totalTasks === 0 ? (
                            <p className="text-xs mb-3" style={{ color: '#5F5E5A' }}>No tasks yet. Add one below.</p>
                          ) : (
                            <div className="space-y-2 mb-3">
                              {habit.tasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3 group/task">
                                  <button
                                    onClick={() => handleToggleTask(habit.id, task.id)}
                                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                      background: task.completed ? '#22c55e' : 'transparent',
                                      border: task.completed ? '2px solid #22c55e' : '2px solid #5F5E5A',
                                    }}
                                  >
                                    {task.completed && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                  <span className="flex-1 text-sm"
                                    style={{
                                      color: task.completed ? '#5F5E5A' : '#F1EFE8',
                                      textDecoration: task.completed ? 'line-through' : 'none',
                                    }}>
                                    {task.title}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteTask(habit.id, task.id)}
                                    className="opacity-0 group-hover/task:opacity-100 transition-opacity text-xs px-1.5 rounded"
                                    style={{ color: '#D85A30' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add task input */}
                          {!habit.completedToday && (
                            <div className="flex gap-2 mb-4">
                              <input
                                type="text"
                                placeholder="Add a task…"
                                value={taskInputs[habit.id] ?? ''}
                                onChange={e => setTaskInputs(prev => ({ ...prev, [habit.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleAddTask(habit.id)}
                                className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-gray-500 outline-none"
                                style={{ background: '#363634', border: '1px solid #424240' }}
                              />
                              <button
                                onClick={() => handleAddTask(habit.id)}
                                className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                                style={{ background: 'rgba(83,74,183,0.25)', color: '#AFA9EC' }}
                              >
                                Add
                              </button>
                            </div>
                          )}

                          {/* Mark habit done button */}
                          {!habit.completedToday && (
                            <button
                              onClick={() => handleCompleteHabit(habit)}
                              disabled={!allTasksDone}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                              style={{
                                background: allTasksDone
                                  ? 'linear-gradient(135deg, #534AB7, #3C3489)'
                                  : '#363634',
                                color: allTasksDone ? '#fff' : '#5F5E5A',
                                cursor: allTasksDone ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {allTasksDone
                                ? '✓ Mark habit done'
                                : `Complete ${totalTasks - doneTasks} remaining task${totalTasks - doneTasks !== 1 ? 's' : ''} first`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 mt-8 animate-fade-up">
          <Link to="/groups" className="p-5 rounded-2xl flex items-center gap-3 transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #534AB7, #3C3489)' }}>
            <span className="text-2xl">👥</span>
            <div>
              <p className="text-white font-semibold text-sm">My Groups</p>
              <p className="text-xs" style={{ color: '#AFA9EC' }}>View competitions</p>
            </div>
          </Link>
          <Link to="/heatmap" className="p-5 rounded-2xl flex items-center gap-3 transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #993C1D, #D85A30)' }}>
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-white font-semibold text-sm">My Heatmap</p>
              <p className="text-xs" style={{ color: '#FAECE7' }}>View consistency</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Show animations on complete */}
      {celebration && (
        <CelebrationModal
          showCoin={celebration.showCoin}
          showFire={celebration.showFire}
          message={celebration.message}
        />
      )}

      {/* ── Create Habit Modal ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-fade-up"
            style={{ background: '#2C2C2A', border: '1px solid #424240' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">New Habit</h3>

            <label className="block text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>Title *</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Morning Run"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateHabit()}
              className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none mb-4"
              style={{ background: '#363634', border: '1px solid #424240' }}
            />

            <label className="block text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>
              Description <span style={{ color: '#5F5E5A' }}>(optional)</span>
            </label>
            <textarea
              placeholder="What does this habit involve?"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none resize-none mb-6"
              style={{ background: '#363634', border: '1px solid #424240' }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#363634', color: '#B4B2A9' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateHabit}
                disabled={!newTitle.trim() || creating}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{
                  background: newTitle.trim() ? 'linear-gradient(135deg, #534AB7, #3C3489)' : '#424240',
                }}
              >
                {creating ? 'Creating…' : 'Create Habit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
