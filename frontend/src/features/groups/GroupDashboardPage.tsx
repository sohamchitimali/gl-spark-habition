import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getGroup, addHabit, deleteGroupHabit, changeDeadline, promoteToAdmin, deleteGroup, leaveGroup, type GroupResponse, type GroupHabit } from '../../api/groupApi';
import { completeHabit, getTasks, createTask, toggleTask, deleteTask, getHabits, createGroupTrackingHabit, getGroupStreak, type HabitTask } from '../../api/habitApi';
import { getLeaderboard, resetGroupCoins, type LeaderboardEntry } from '../../api/coinApi';
import { getUsers, type UserProfile } from '../../api/authApi';
import { getGroupHeatmap, type HeatmapDay } from '../../api/habitApi';
import Navbar from '../../components/Navbar';
import habitionCoin from '../../assets/habition_coin.png';
import SpinningCoin3D from '../../components/SpinningCoin3D';
import HeatmapView from '../../components/HeatmapView';
import Loading from '../../components/Loading';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupHabitWithTasks extends GroupHabit {
  trackingHabitId: number | null;
  tasks: HabitTask[];
  tasksLoaded: boolean;
  completedToday: boolean;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

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

const GroupDashboardPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [habits, setHabits] = useState<GroupHabitWithTasks[]>([]);
  const [loading, setLoading] = useState(true);

  const [coins, setCoins] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);

  const [streak, setStreak] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [todayEarned, setTodayEarned] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());

  // Create habit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);

  // Change deadline modal
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [dlMode, setDlMode] = useState<'ADD' | 'REDUCE' | 'SET'>('ADD');
  const [dlYears, setDlYears] = useState(0);
  const [dlMonths, setDlMonths] = useState(0);
  const [dlWeeks, setDlWeeks] = useState(0);
  const [dlDays, setDlDays] = useState(0);
  const [dlSetDate, setDlSetDate] = useState('');
  const [extending, setExtending] = useState(false);

  // Group Details Modal
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Live Timer
  const [now, setNow] = useState(new Date().getTime());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ─── Load group data ────────────────────────────────────────────────────────

  const loadLeaderboard = () => {
    if (!groupId || !userId) return;
    getLeaderboard(Number(groupId))
      .then(r => {
        setLeaderboard(r.data.entries);
        const entry = r.data.entries.find(e => e.userId === userId);
        if (entry) {
          setMyRank(entry.rank);
          setCoins(entry.totalCoins); // Use group coins instead of global coins
        } else {
          const maxRank = r.data.entries.length > 0 ? r.data.entries[r.data.entries.length - 1].rank : 0;
          setMyRank(maxRank + 1);
          setCoins(0);
        }
      })
      .catch(() => { setMyRank(1); setCoins(0); });
  };

  const loadGroupStats = () => {
    if (!groupId || !userId) return;
    getGroupStreak(Number(groupId), userId)
      .then(r => {
        setStreak(r.data.currentStreak);
        setPersonalBest(r.data.personalBest);
        setTodayEarned(r.data.todayEarned);
      })
      .catch(() => { });
  };

  useEffect(() => {
    if (!groupId || !userId) return;
    Promise.all([
      getGroup(Number(groupId)),
      getHabits(userId)
    ])
      .then(([groupRes, habitsRes]) => {
        setGroup(groupRes.data);
        const userHabits = habitsRes.data;

        setHabits(groupRes.data.habits.map(h => {
          const matchingHabit = userHabits.find(uh => uh.groupHabitId === h.id);
          return {
            ...h,
            trackingHabitId: matchingHabit ? matchingHabit.id : null,
            tasks: matchingHabit ? matchingHabit.tasks || [] : [],
            tasksLoaded: !!matchingHabit,
            completedToday: matchingHabit ? matchingHabit.completedToday : false,
          };
        }));

        // Fetch members
        if (groupRes.data.memberIds && groupRes.data.memberIds.length > 0) {
          getUsers(groupRes.data.memberIds).then(r => setMembers(r.data)).catch(() => { });
        }
      })
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));

    const generateMockData = (): Map<string, number> => {
      const map = new Map<string, number>();
      for (let d = 0; d < 365 * 3; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const key = date.toISOString().split('T')[0];
        if (Math.random() > 0.3) map.set(key, Math.ceil(Math.random() * 100));
      }
      return map;
    };

    getGroupHeatmap(Number(groupId))
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionPercentage));
        setHeatmapData(map);
      })
      .catch(() => setHeatmapData(generateMockData()));

    loadLeaderboard();
    loadGroupStats();
    const interval = setInterval(() => {
      loadLeaderboard();
      loadGroupStats();
    }, 5000); // Poll leaderboard every 5 seconds

    return () => clearInterval(interval);
  }, [groupId, userId]);

  // ─── Expand — lazy load tasks ───────────────────────────────────────────────

  const handleExpand = async (habitId: number) => {
    if (expandedId === habitId) { setExpandedId(null); return; }
    setExpandedId(habitId);

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habit.trackingHabitId && groupId) {
      try {
        const res = await createGroupTrackingHabit(Number(groupId), habitId, habit.title, habit.description || '');
        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, trackingHabitId: res.data.id, tasks: [], tasksLoaded: true } : h));
      } catch {
        showToast('⚠️ Failed to initialize tracking');
      }
    } else if (!habit.tasksLoaded && habit.trackingHabitId) {
      getTasks(habit.trackingHabitId).then(r => {
        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, tasks: r.data, tasksLoaded: true } : h));
      }).catch(() => { });
    }
  };

  // ─── Task interactions ──────────────────────────────────────────────────────

  const handleToggleTask = async (habitId: number, taskId: number) => {
    const updated = await toggleTask(taskId);
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, tasks: h.tasks.map(t => t.id === taskId ? updated.data : t) } : h
    ));
  };

  const handleAddTask = async (habitId: number) => {
    const title = (taskInputs[habitId] ?? '').trim();
    if (!title) return;
    const habit = habits.find(h => h.id === habitId);
    if (!habit?.trackingHabitId) return;

    const res = await createTask(habit.trackingHabitId, title);
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, tasks: [...h.tasks, res.data] } : h
    ));
    setTaskInputs(prev => ({ ...prev, [habitId]: '' }));
  };

  const handleDeleteTask = async (habitId: number, taskId: number) => {
    await deleteTask(taskId);
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, tasks: h.tasks.filter(t => t.id !== taskId) } : h
    ));
  };

  const handleAddGroupHabit = async () => {
    if (!newTitle.trim() || !groupId) return;
    setCreating(true);
    try {
      const res = await addHabit(Number(groupId), newTitle.trim(), newDesc.trim());
      setHabits(prev => [...prev, { ...res.data, trackingHabitId: null, tasks: [], tasksLoaded: true, completedToday: false }]);
      setNewTitle('');
      setNewDesc('');
      setShowCreateModal(false);
      showToast('Habit created!');
    } catch (err) {
      showToast('⚠️ Failed to create habit');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroupHabit = async (e: React.MouseEvent, habitId: number) => {
    e.stopPropagation();
    if (!groupId || !window.confirm('Are you sure you want to delete this group habit?')) return;
    try {
      await deleteGroupHabit(Number(groupId), habitId);
      setHabits(prev => prev.filter(h => h.id !== habitId));
      if (expandedId === habitId) setExpandedId(null);
      showToast('Habit deleted');
    } catch (err) {
      showToast('⚠️ Failed to delete habit');
    }
  };

  // ─── Complete habit ─────────────────────────────────────────────────────────

  const handleCompleteHabit = async (habit: GroupHabitWithTasks) => {
    if (!habit.trackingHabitId) return;
    try {
      const res = await completeHabit(habit.trackingHabitId);
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, completedToday: true } : h));
      loadLeaderboard();

      setShowCoinAnimation(true);
      setTimeout(() => setShowCoinAnimation(false), 2500);

      showToast(`+${res.data.coinsEarned} coins earned for the group!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) showToast(`⚠️ ${msg}`);
    }
  };

  // ─── Change Deadline ────────────────────────────────────────────────────────

  const handleChangeDeadline = async () => {
    if (!groupId) return;
    setExtending(true);
    try {
      let requestPayload: any = { mode: dlMode };
      if (dlMode === 'SET') {
        if (!dlSetDate) {
          showToast('⚠️ Please select a date');
          setExtending(false);
          return;
        }
        requestPayload.newDate = new Date(dlSetDate).toISOString();
      } else {
        if (dlYears === 0 && dlMonths === 0 && dlWeeks === 0 && dlDays === 0) {
          showToast('⚠️ Please enter at least one duration value');
          setExtending(false);
          return;
        }
        requestPayload = { ...requestPayload, years: dlYears, months: dlMonths, weeks: dlWeeks, days: dlDays };
      }

      const res = await changeDeadline(Number(groupId), requestPayload);
      setGroup(res.data);
      setShowExtendModal(false);
      showToast('Deadline updated successfully!');
    } catch (err) {
      showToast('⚠️ Failed to update deadline');
    } finally {
      setExtending(false);
    }
  };

  const handleResetCoins = async () => {
    if (!groupId || !window.confirm('Are you sure you want to reset all coins for this group? This cannot be undone.')) return;
    setResetting(true);
    try {
      await resetGroupCoins(Number(groupId));
      loadLeaderboard();
      setShowGroupDetailsModal(false);
      showToast('Group coins have been reset!');
    } catch (err) {
      showToast('⚠️ Failed to reset coins');
    } finally {
      setResetting(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await leaveGroup(Number(groupId));
      navigate('/groups');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Failed to leave group';
      showToast(`⚠️ ${msg}`);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !window.confirm('WARNING: Are you sure you want to permanently delete this group? All habits, coins, and members will be removed.')) return;
    try {
      await deleteGroup(Number(groupId));
      navigate('/groups');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Failed to delete group';
      showToast(`⚠️ ${msg}`);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const completedCount = habits.filter(h => h.completedToday).length;
  const isOwner = group?.ownerId === userId;
  const isAdmin = isOwner || (group?.adminIds && group.adminIds.includes(userId!));

  let timeLeftString = 'No Deadline';
  if (group?.competitionEndDate) {
    const end = new Date(group.competitionEndDate).getTime();
    const diff = end - now;
    if (diff <= 0) {
      timeLeftString = 'Competition Ended';
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${mins}m`);
      parts.push(`${secs}s`);

      timeLeftString = parts.join(' ');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a18' }}>
        <Loading size={32} />
      </div>
    );
  }

  if (!group) return null;

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
            background: 'linear-gradient(135deg, #993C1D, #D85A30)',
            border: '1px solid rgba(216,90,48,0.5)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex justify-between items-center mb-3">
            <Link to="/groups" className="text-sm inline-flex items-center gap-1 no-underline hover:opacity-80"
              style={{ color: '#7F77DD' }}>
              ← Back to Groups
            </Link>
            <Link to={`/chats?group=${groupId}`} className="text-sm px-4 py-1.5 rounded-lg bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30 transition-colors flex items-center gap-2">
              💬 Group Chat
            </Link>
          </div>
          <div className="flex flex-col mt-2">
            <div
              className="flex items-center gap-4 cursor-pointer group bg-[#2C2C2A] p-4 rounded-2xl border border-[#363634] hover:border-[#5F5E5A] transition-colors w-full relative"
              onClick={() => setShowGroupDetailsModal(true)}
              title="Click to view Group Details and Members"
            >
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl transition-transform group-hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
                  {group.name[0].toUpperCase()}
                </div>
                {group.hasPendingRequests && isAdmin && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)] border-2 border-[#2C2C2A]" />
                )}
              </div>
              <div className="group-hover:opacity-80 transition-opacity flex-1 min-w-0 pr-2">
                <h1 className="text-3xl font-bold text-white leading-tight flex items-center gap-2 truncate">
                  {group.name}
                  <svg className="w-5 h-5 text-[#7F77DD] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </h1>
                {group.description && <p className="text-sm mt-1 truncate" style={{ color: '#B4B2A9' }}>{group.description}</p>}
                <p className="text-sm mt-1 truncate" style={{ color: '#7F77DD' }}>{today}</p>
              </div>

              {/* Time Left Box Embedded in Title Card */}
              <div className="flex items-center gap-3 bg-[#1A1A18] rounded-xl p-3 border border-[#363634] ml-auto hidden sm:flex relative flex-shrink-0 group-hover:border-[#5F5E5A] transition-colors">
                {group.competitionEndDate && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                )}
                <div className="flex flex-col justify-center text-right pr-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B4B2A9] mb-0.5">Time Left</span>
                  <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap">{timeLeftString}</span>
                </div>
              </div>
            </div>

            {/* Mobile Time Left Box */}
            <div className="flex sm:hidden items-center justify-between bg-[#2C2C2A] rounded-2xl p-4 border border-[#363634] mt-3 relative">
              {group.competitionEndDate && (
                <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-[#B4B2A9]">Time Left</span>
              <span className="text-sm font-bold text-white tabular-nums mr-4">{timeLeftString}</span>
            </div>
          </div>
        </div>

        {/* Show spinning coin on complete */}
        {showCoinAnimation && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="animate-coin-pop" style={{ transform: 'scale(1.5)' }}>
              <SpinningCoin3D />
            </div>
          </div>
        )}

        {/* Create Modal */}
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Streak */}
          <div className="col-span-2 rounded-2xl p-5 animate-fade-up delay-100"
            style={{ background: 'linear-gradient(135deg, #26215C, #534AB7)', border: '1px solid rgba(83,74,183,0.5)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: '#AFA9EC' }}>
                  Group streak {todayEarned ? ' (Today: Completed ✅)' : ' (Today: Pending ⏳)'}
                </p>
                <p className="text-4xl font-bold text-white">{streak} <span className="text-2xl">🔥</span></p>
                <p className="text-xs mt-1" style={{ color: '#AFA9EC' }}>Personal Best: {personalBest} days</p>
              </div>
              <div className="text-5xl select-none hidden sm:block">🔥</div>
            </div>
          </div>

          {/* Coins */}
          <div className="rounded-2xl p-5 animate-fade-up delay-100 flex flex-col justify-center h-full"
            style={{ background: 'linear-gradient(135deg, #712B13, #993C1D)', border: '1px solid rgba(216,90,48,0.4)' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#F0997B' }}>My Coins</p>
            <p className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-2">
              {coins !== null ? coins : '—'} <img src={habitionCoin} alt="coin" className="w-8 h-8 sm:w-10 sm:h-10" />
            </p>
            <p className="text-xs mt-1" style={{ color: '#F0997B' }}>earned in group</p>
          </div>

          {/* Rank */}
          <div className="rounded-2xl p-5 animate-fade-up delay-200 h-full flex flex-col justify-center"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>My Rank</p>
            <p className="text-3xl font-bold text-white">
              {myRank !== null ? `#${myRank}` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>in this group</p>
          </div>
        </div>

        {/* Group Habits */}
        <div className="mb-8 animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-3">
              Group Habits
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC', borderColor: 'rgba(83,74,183,0.3)' }}>
                {completedCount} / {habits.length} Completed
              </span>
            </h2>
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 flex items-center gap-2"
                style={{ background: '#534AB7', color: '#fff' }}
              >
                <span className="text-lg leading-none">+</span> New Habit
              </button>
            )}
          </div>

          {habits.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
              <div className="text-4xl mb-3">📋</div>
              <p className="text-white font-semibold mb-1">No habits in this group yet</p>
              <p className="text-sm" style={{ color: '#B4B2A9' }}>The group owner can add habits from the group settings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map(habit => {
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
                    {/* Header row */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer select-none group"
                      onClick={() => handleExpand(habit.id)}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: habit.completedToday ? '#534AB7' : 'transparent',
                          border: habit.completedToday ? '2px solid #534AB7' : '2px solid #5F5E5A',
                        }}>
                        {habit.completedToday && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate"
                          style={{
                            color: habit.completedToday ? '#AFA9EC' : '#F1EFE8',
                            textDecoration: habit.completedToday ? 'line-through' : 'none',
                          }}>
                          {habit.title}
                        </p>
                        {habit.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#5F5E5A' }}>
                            {totalTasks > 0 ? `${doneTasks}/${totalTasks} tasks · ` : ''}{habit.description}
                          </p>
                        )}
                        {!habit.description && totalTasks > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: '#5F5E5A' }}>
                            {doneTasks}/{totalTasks} tasks · tap to expand
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOwner && (
                          <button
                            onClick={(e) => handleDeleteGroupHabit(e, habit.id)}
                            className="p-2 rounded-xl text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                            style={{ color: '#D85A30' }}
                            title="Delete habit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        {habit.completedToday && (
                          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                            style={{ background: 'rgba(216,90,48,0.2)', color: '#F0997B' }}>
                            +1 <img src={habitionCoin} alt="coin" className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <svg
                          className="w-4 h-4 transition-transform duration-200"
                          style={{ color: '#5F5E5A', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {totalTasks > 0 && (
                      <div className="px-4">
                        <ProgressBar done={doneTasks} total={totalTasks} />
                      </div>
                    )}

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 animate-fade-up" onClick={e => e.stopPropagation()}>
                        <div style={{ borderTop: '1px solid #363634' }} className="pt-3">
                          {habit.description && (
                            <p className="text-sm mb-4 leading-relaxed" style={{ color: '#B4B2A9' }}>
                              {habit.description}
                            </p>
                          )}

                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5F5E5A' }}>
                            Tasks {totalTasks > 0 ? `(${doneTasks}/${totalTasks})` : ''}
                          </p>

                          {!habit.tasksLoaded ? (
                            <p className="text-xs" style={{ color: '#5F5E5A' }}>Loading…</p>
                          ) : totalTasks === 0 ? (
                            <p className="text-xs mb-3" style={{ color: '#5F5E5A' }}>No tasks yet.</p>
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

                          {!habit.completedToday && (
                            <button
                              onClick={() => handleCompleteHabit(habit)}
                              disabled={!allTasksDone}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                              style={{
                                background: allTasksDone
                                  ? 'linear-gradient(135deg, #993C1D, #D85A30)'
                                  : '#363634',
                                color: allTasksDone ? '#fff' : '#5F5E5A',
                                cursor: allTasksDone ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {allTasksDone
                                ? '✓ Mark done & earn coins'
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

        {/* Group Heatmap */}
        <div className="mt-12 animate-fade-up delay-100">
          <HeatmapView heatmapData={heatmapData} title="Group consistency" />
        </div>

        {/* Leaderboard preview */}
        {leaderboard.length > 0 && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">🏆 Leaderboard</h2>
              <Link to={`/groups/${groupId}/leaderboard`}
                className="text-sm no-underline hover:underline" style={{ color: '#7F77DD' }}>
                View full →
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #363634' }}>
              {leaderboard.slice(0, 3).map((entry, i) => {
                const isMe = entry.userId === userId;
                const medal = ['🥇', '🥈', '🥉'][entry.rank - 1] ?? `#${entry.rank}`;
                return (
                  <div key={entry.userId}
                    className="flex items-center justify-between px-5 py-3.5"
                    style={{
                      background: isMe ? 'rgba(83,74,183,0.12)' : i % 2 === 0 ? '#2C2C2A' : '#262624',
                      borderBottom: i < 2 ? '1px solid #363634' : 'none',
                    }}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-6 text-center">{medal}</span>
                      <span className="text-sm font-medium" style={{ color: isMe ? '#AFA9EC' : '#F1EFE8' }}>
                        User {entry.userId} {isMe && <span style={{ color: '#7F77DD' }}>(you)</span>}
                      </span>
                    </div>
                    <span className="text-sm font-bold flex items-center gap-1" style={{ color: '#F0997B' }}>
                      {entry.totalCoins} <img src={habitionCoin} alt="coin" className="w-5 h-5" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <h2 className="text-xl font-bold text-white mb-6">Create Group Habit</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Habit Title</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g., Morning Run"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none"
                  style={{ background: '#1A1A18', border: '1px solid #363634' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Description (optional)</label>
                <textarea
                  placeholder="e.g., 5km run before breakfast"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none min-h-[100px] resize-none"
                  style={{ background: '#1A1A18', border: '1px solid #363634' }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold transition-all hover:bg-white/5 text-white"
                style={{ border: '1px solid #363634' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddGroupHabit}
                disabled={!newTitle.trim() || creating}
                className="flex-1 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                style={{ background: '#534AB7', color: '#fff' }}
              >
                {creating ? 'Creating...' : 'Create Habit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Deadline Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <h2 className="text-xl font-bold text-white mb-4">Change Deadline</h2>
            <p className="text-sm text-[#B4B2A9] mb-4">Update the competition deadline.</p>

            <div className="flex rounded-xl p-1 mb-4" style={{ background: '#1A1A18' }}>
              {(['ADD', 'REDUCE', 'SET'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setDlMode(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${dlMode === mode ? 'text-white' : 'text-[#5F5E5A] hover:text-[#B4B2A9]'}`}
                  style={{ background: dlMode === mode ? '#363634' : 'transparent' }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {dlMode === 'SET' ? (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Select Date</label>
                <input
                  type="datetime-local"
                  value={dlSetDate}
                  onChange={e => setDlSetDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none"
                  style={{ background: '#1A1A18', border: '1px solid #424240' }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Years</label>
                  <input type="number" min="0" value={dlYears} onChange={e => setDlYears(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-white outline-none" style={{ background: '#1A1A18', border: '1px solid #424240' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Months</label>
                  <input type="number" min="0" value={dlMonths} onChange={e => setDlMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-white outline-none" style={{ background: '#1A1A18', border: '1px solid #424240' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Weeks</label>
                  <input type="number" min="0" value={dlWeeks} onChange={e => setDlWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-white outline-none" style={{ background: '#1A1A18', border: '1px solid #424240' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Days</label>
                  <input type="number" min="0" value={dlDays} onChange={e => setDlDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-white outline-none" style={{ background: '#1A1A18', border: '1px solid #424240' }} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtendModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold transition-all hover:bg-white/5 text-white"
                style={{ border: '1px solid #363634' }}
              >
                Cancel
              </button>
              <button
                onClick={handleChangeDeadline}
                disabled={extending}
                className="flex-1 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                style={{ background: '#534AB7', color: '#fff' }}
              >
                {extending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {showGroupDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowGroupDetailsModal(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Group Details</h2>
                <p className="text-sm text-[#B4B2A9]">Invite Code: <span className="font-mono text-white bg-[#1A1A18] px-2 py-1 rounded select-all">{group.inviteCode}</span></p>
                {isAdmin && (
                  <Link
                    to={`/groups/${group.id}/join-requests`}
                    className="mt-3 inline-flex px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 rounded-lg font-semibold transition-colors items-center text-xs relative"
                  >
                    {group.hasPendingRequests && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Pending Join Requests" />
                    )}
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    View Join Requests
                  </Link>
                )}
              </div>
              <button onClick={() => setShowGroupDetailsModal(false)} className="text-[#5F5E5A] hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-6 scrollbar-hide space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#B4B2A9]">Members ({members.length})</h3>
              <div className="space-y-3">
                {members.map(member => {
                  const isMemberOwner = member.id === group.ownerId;
                  const isMemberAdmin = isMemberOwner || (group.adminIds && group.adminIds.includes(member.id));

                  return (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A18] border border-[#363634]">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-inner"
                        style={{ background: member.preferredColor || '#534AB7' }}>
                        {(member.name ? member.name[0] : 'U').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#F1EFE8] truncate flex items-center gap-2">
                          {member.name || `User ${member.id}`}
                          {member.id === userId && <span className="text-[#7F77DD] text-xs">(You)</span>}
                          {isMemberOwner ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D85A30]/20 text-[#D85A30]">Owner</span>
                          ) : isMemberAdmin ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#534AB7]/20 text-[#7F77DD]">Admin</span>
                          ) : null}
                        </p>
                        {member.bio && <p className="text-xs text-[#5F5E5A] truncate">{member.bio}</p>}
                      </div>

                      {isAdmin && !isMemberAdmin && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await promoteToAdmin(Number(groupId), member.id);
                              setGroup(res.data);
                              showToast(`${member.name || 'User'} is now an admin`);
                            } catch (e) {
                              showToast('⚠️ Failed to promote user');
                            }
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#363634] text-white hover:bg-[#534AB7] transition-colors"
                        >
                          Make Admin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <div className="pt-4 border-t border-[#363634]">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#D85A30] mb-3">Admin Controls</h3>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setShowExtendModal(true)}
                    className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
                    style={{ background: '#534AB7', color: '#fff' }}
                  >
                    Change Deadline
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-[rgba(216,90,48,0.3)] bg-[rgba(216,90,48,0.1)]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#D85A30] mb-2">Danger Zone</p>
                  <button
                    onClick={handleResetCoins}
                    disabled={resetting}
                    className="w-full py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 mb-3 bg-[#D85A30]/20 text-[#D85A30] hover:bg-[#D85A30]/30 hover:text-[#D85A30] border border-transparent hover:border-[#D85A30]/30"
                  >
                    {resetting ? 'Resetting...' : 'Reset All Group Coins'}
                  </button>
                  {isOwner && (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 bg-red-500/20 text-red-500 hover:bg-red-500/30"
                    >
                      Delete Group
                    </button>
                  )}
                  <p className="text-[10px] text-[#5F5E5A] mt-2 text-center leading-tight">Actions here are permanent and cannot be undone.</p>
                </div>
              </div>
            )}

            {!isOwner && (
              <div className="pt-4 border-t border-[#363634]">
                <button
                  onClick={handleLeaveGroup}
                  className="w-full py-3 rounded-xl font-semibold transition-all bg-[#363634] text-[#B4B2A9] hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 border border-transparent"
                >
                  Leave Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDashboardPage;
