import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getGroup, addHabit, deleteGroupHabit, deleteGroup, leaveGroup, changeDeadline, promoteToAdmin, demoteMember, updateGroupSettings, kickMember, kickAndBlockMember, type GroupResponse, type GroupHabit } from '../../api/groupApi';
import { completeHabit, getTasks, createTask, toggleTask, deleteTask, getHabits, createGroupTrackingHabit, getGroupStreak, type HabitTask } from '../../api/habitApi';
import { getLeaderboard, resetGroupCoins, type LeaderboardEntry } from '../../api/coinApi';
import { getUsers, type UserProfile } from '../../api/authApi';
import { getGroupInsights, type GroupInsightDTO } from '../../api/insightsApi';
import ConsistencyRings, { computeRingsFromHeatmap } from '../../components/ConsistencyRings';
import { getUserGroupHeatmap, getGroupHeatmap, getIndividualGroupConsistency, getGroupOverallConsistency, type HeatmapDay } from '../../api/habitApi';
import Navbar from '../../components/Navbar';
import habitionCoin from '../../assets/habition_coin.png';
import LocationSelector from '../../components/LocationSelector';
import CelebrationModal from '../../components/CelebrationModal';
import confetti from 'canvas-confetti';
import HeatmapView from '../../components/HeatmapView';
import Loading from '../../components/Loading';
import { useConfirm } from '../../context/ConfirmContext';

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
  const { confirm } = useConfirm();

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [habits, setHabits] = useState<GroupHabitWithTasks[]>([]);
  const [loading, setLoading] = useState(true);

  const [coins, setCoins] = useState<number | null>(null);
  const [_leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);

  const [streak, setStreak] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [todayEarned, setTodayEarned] = useState(false);
  const [individualOverallConsistency, setIndividualOverallConsistency] = useState<number | null>(null);
  const [groupOverallConsistency, setGroupOverallConsistency] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [overallHeatmapData, setOverallHeatmapData] = useState<Map<string, number>>(new Map());
  const [groupInsight, setGroupInsight] = useState<GroupInsightDTO | null>(null);

  // Create habit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [celebration, setCelebration] = useState<{ showCoin: boolean; showFire: boolean; message: string } | null>(null);
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
  const [activeModalTab, setActiveModalTab] = useState<'OVERVIEW' | 'MEMBERS' | 'SETTINGS'>('OVERVIEW');
  const [editGroupLocLat, setEditGroupLocLat] = useState<number | null>(null);
  const [editGroupLocLng, setEditGroupLocLng] = useState<number | null>(null);
  const [editGroupLocName, setEditGroupLocName] = useState('');
  const [editGroupTags, setEditGroupTags] = useState<string[]>([]);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupTagsInput, setEditGroupTagsInput] = useState('');
  const [editGroupNotificationsEnabled, setEditGroupNotificationsEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
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
    const cleanMsg = msg.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    setToast(cleanMsg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ─── Load group data ────────────────────────────────────────────────────────

  const loadLeaderboard = () => {
    if (!groupId || !userId) return;
    getLeaderboard(Number(groupId))
      .then(r => {
        setLeaderboard(r.data.entries);
        const entry = r.data.entries.find(e => String(e.userId) === String(userId));
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

    getIndividualGroupConsistency(Number(groupId), userId)
      .then(r => setIndividualOverallConsistency(r.data.score))
      .catch(() => { });

    getGroupOverallConsistency(Number(groupId))
      .then(r => setGroupOverallConsistency(r.data.score))
      .catch(() => { });
  };

  const loadHeatmaps = () => {
    if (!groupId || !userId) return;
    getUserGroupHeatmap(Number(groupId), Number(userId))
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionPercentage));
        setHeatmapData(map);
      })
      .catch(() => { /* keep existing data on error */ });

    getGroupHeatmap(Number(groupId))
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionPercentage));
        setOverallHeatmapData(map);
      })
      .catch(() => { /* keep existing data on error */ });
  };

  useEffect(() => {
    if (!groupId || !userId) return;
    Promise.all([
      getGroup(Number(groupId)),
      getHabits(userId),
      getGroupInsights(Number(groupId)).catch(() => ({ data: null }))
    ])
      .then(([groupRes, habitsRes, insightRes]) => {
        setGroup(groupRes.data);
        if (insightRes.data) {
          setGroupInsight(insightRes.data as GroupInsightDTO);
        }

        // Global Group Streak Check
        if (groupId) {
          const lsKey = `lastSeenGroupStreak_${groupId}`;
          const lastStreak = parseInt(localStorage.getItem(lsKey) || '0', 10);
          const currentStreak = groupRes.data.currentGlobalHabitGroupStreak || 0;

          if (currentStreak > lastStreak && currentStreak > 0) {
            setCelebration({ showCoin: false, showFire: true, message: `Group Streak reached ${currentStreak}!` });
            setTimeout(() => setCelebration(null), 3500);
            confetti({
              particleCount: 200,
              spread: 90,
              origin: { y: 0.6 },
              colors: ['#26215C', '#534AB7', '#AFA9EC', '#F0997B']
            });
          }
          localStorage.setItem(lsKey, currentStreak.toString());
        }

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

    loadHeatmaps();
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
        loadHeatmaps();
      } catch {
        showToast('Failed to initialize tracking');
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
      loadHeatmaps();
      showToast('Habit created!');
    } catch {
      showToast('Failed to create habit');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroupHabit = async (e: React.MouseEvent, habitId: number) => {
    e.stopPropagation();
    const confirmed = await confirm('Are you sure you want to delete this group habit?', { isDestructive: true });
    if (!groupId || !confirmed) return;
    try {
      await deleteGroupHabit(Number(groupId), habitId);
      setHabits(prev => prev.filter(h => h.id !== habitId));
      if (expandedId === habitId) setExpandedId(null);
      loadHeatmaps();
      showToast('Habit deleted');
    } catch {
      showToast('Failed to delete habit');
    }
  };

  // ─── Complete habit ─────────────────────────────────────────────────────────

  const handleCompleteHabit = async (habit: GroupHabitWithTasks) => {
    if (!habit.trackingHabitId) return;
    try {
      const res = await completeHabit(habit.trackingHabitId);
      const updatedHabits = habits.map(h => h.id === habit.id ? { ...h, completedToday: true } : h);
      setHabits(updatedHabits);
      loadLeaderboard();
      loadGroupStats();
      loadHeatmaps();

      let groupStreakAchieved = false;
      let newGroupStreak = 0;

      if (groupId) {
        try {
          const groupRes = await getGroup(Number(groupId));
          setGroup(groupRes.data);
          const lsKey = `lastSeenGroupStreak_${groupId}`;
          const lastStreak = parseInt(localStorage.getItem(lsKey) || '0', 10);
          newGroupStreak = groupRes.data.currentGlobalHabitGroupStreak || 0;
          if (newGroupStreak > lastStreak && newGroupStreak > 0) {
            groupStreakAchieved = true;
            localStorage.setItem(lsKey, newGroupStreak.toString());
          }
        } catch { }
      }

      // ALWAYS fire confetti
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#26215C', '#534AB7', '#AFA9EC', '#F0997B']
      });

      const allDone = updatedHabits.every(h => h.completedToday);

      if (allDone) {
        setCelebration({ showCoin: true, showFire: true, message: `Personal Streak is now ${res.data.currentStreak}` });
      } else {
        setCelebration({ showCoin: true, showFire: false, message: `Habit Completed` });
      }

      const personalDuration = allDone ? 3500 : 2500;
      setTimeout(() => {
        if (groupStreakAchieved) {
          setCelebration({ showCoin: false, showFire: true, message: `Group Streak reached ${newGroupStreak}!` });
          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#26215C', '#534AB7', '#AFA9EC', '#F0997B']
          });
          setTimeout(() => setCelebration(null), 3500);
        } else {
          setCelebration(null);
        }
      }, personalDuration);

    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) showToast(msg);
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
          showToast('Please select a date');
          setExtending(false);
          return;
        }
        const dateOnly = dlSetDate.split('T')[0];
        requestPayload.newDate = `${dateOnly}T12:00:00`;
      } else {
        if (dlYears === 0 && dlMonths === 0 && dlWeeks === 0 && dlDays === 0) {
          showToast('Please enter at least one duration value');
          setExtending(false);
          return;
        }
        requestPayload = { ...requestPayload, years: dlYears, months: dlMonths, weeks: dlWeeks, days: dlDays };
      }

      const res = await changeDeadline(Number(groupId), requestPayload);
      setGroup(res.data);
      setShowExtendModal(false);
      showToast('Deadline updated successfully!');
    } catch {
      showToast('Failed to update deadline');
    } finally {
      setExtending(false);
    }
  };

  const handleResetCoins = async () => {
    const confirmed = await confirm('Are you sure you want to reset all coins for this group? This cannot be undone.', { isDestructive: true });
    if (!groupId || !confirmed) return;
    setResetting(true);
    try {
      await resetGroupCoins(Number(groupId));
      loadLeaderboard();
      setShowGroupDetailsModal(false);
      showToast('Group coins have been reset!');
    } catch {
      showToast('Failed to reset coins');
    } finally {
      setResetting(false);
    }
  };

  const handleLeaveGroup = async () => {
    const confirmed = await confirm('Are you sure you want to leave this group?', { isDestructive: true });
    if (!groupId || !confirmed) return;
    try {
      await leaveGroup(Number(groupId));
      navigate('/groups');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Failed to leave group';
      showToast(msg);
    }
  };

  const handleDeleteGroup = async () => {
    const confirmed = await confirm('WARNING: Are you sure you want to permanently delete this group? All habits, coins, and members will be removed.', { isDestructive: true });
    if (!groupId || !confirmed) return;
    try {
      await deleteGroup(Number(groupId));
      navigate('/groups');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Failed to delete group';
      showToast(msg);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const completedCount = habits.filter(h => h.completedToday).length;
  const isOwner = group?.ownerId === userId;
  const isAdmin = isOwner || (group?.adminIds && group.adminIds.includes(userId!));

  const handleCloseModal = async () => {
    if (activeModalTab === 'SETTINGS' && group && isAdmin) {
      const hasChanges =
        editGroupName !== group.name ||
        editGroupDesc !== (group.description || '') ||
        editGroupLocLat !== group.latitude ||
        editGroupLocLng !== group.longitude ||
        editGroupLocName !== (group.addressDisplay || '') ||
        JSON.stringify(editGroupTags) !== JSON.stringify(group.tags || []) ||
        editGroupNotificationsEnabled !== (group.notificationsEnabled ?? false);

      if (hasChanges) {
        const confirmed = await confirm('You have unsaved changes in the settings. Are you sure you want to discard them?', { isDestructive: true });
        if (!confirmed) return;
      }
    }
    setShowGroupDetailsModal(false);
  };

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

      {celebration && (
        <CelebrationModal
          showCoin={celebration.showCoin}
          showFire={celebration.showFire}
          message={celebration.message}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex justify-between items-center mb-3">
            <Link to="/groups" className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors">
              ← Back to Habit Groups
            </Link>
            <Link to={`/chats?group=${groupId}`} className="text-sm px-4 py-1.5 rounded-lg bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30 transition-colors flex items-center gap-2">
              Group Chat
            </Link>
          </div>
          <div className="flex flex-col mt-2">
            <div
              className="flex items-center gap-4 cursor-pointer group bg-[#2C2C2A] p-4 rounded-2xl border border-[#363634] hover:border-[#5F5E5A] transition-colors w-full relative"
              onClick={() => {
                setShowGroupDetailsModal(true);
                setActiveModalTab('OVERVIEW');
                setEditGroupName(group.name);
                setEditGroupDesc(group.description || '');
                setEditGroupLocLat(group.latitude || null);
                setEditGroupLocLng(group.longitude || null);
                setEditGroupLocName(group.addressDisplay || '');
                setEditGroupTags(group.tags || []);
                setEditGroupTagsInput('');
                setEditGroupNotificationsEnabled(group.notificationsEnabled ?? true);
              }}
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

              <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 ml-auto">
                <Link to={`/groups/${groupId}/leaderboard`}
                  className="hidden sm:flex items-center justify-center px-5 rounded-xl text-2xl transition-all hover:opacity-80"
                  style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.4)' }}
                  title="Leaderboard">
                  🏆
                </Link>

                {/* Time Left Box Embedded in Title Card */}
                <div className="flex items-center gap-3 bg-[#1A1A18] rounded-xl p-3 border border-[#363634] hidden sm:flex relative flex-shrink-0 group-hover:border-[#5F5E5A] transition-colors">
                  {group.competitionEndDate && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  )}
                  <div className="flex flex-col justify-center text-right pr-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B4B2A9] mb-0.5">Time Left</span>
                    <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap">{timeLeftString}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Time Left & Leaderboard */}
            <div className="flex sm:hidden items-stretch justify-between gap-3 mt-3">
              <div className="flex items-center justify-between bg-[#2C2C2A] rounded-2xl p-4 border border-[#363634] relative flex-1">
                {group.competitionEndDate && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-[#B4B2A9]">Time Left</span>
                <span className="text-sm font-bold text-white tabular-nums mr-4">{timeLeftString}</span>
              </div>
              <Link to={`/groups/${groupId}/leaderboard`}
                className="flex items-center justify-center px-6 rounded-2xl text-2xl transition-all flex-shrink-0"
                style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.4)' }}
                title="Leaderboard">
                🏆
              </Link>
            </div>
          </div>
        </div>

        {/* Stats + Consistency Rings — unified layout */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">

          {/* LEFT: streak on top, coins + rank row below */}
          <div className="flex flex-col gap-4 flex-1">

            {/* Streak */}
            <div className={`rounded-2xl p-5 animate-fade-up delay-100 transition-all duration-700 ${(todayEarned && habits.length > 0) ? 'animate-border-pulse' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #26215C, #534AB7)',
                border: (todayEarned && habits.length > 0) ? '2px solid #F97316' : '1px solid rgba(83,74,183,0.5)',
                boxShadow: (todayEarned && habits.length > 0) ? '0 0 0 0 rgba(249, 115, 22, 0.9)' : 'none',
                animation: (todayEarned && habits.length > 0) ? 'orangePulse 1.8s ease-out infinite' : 'none',
                filter: (todayEarned && habits.length > 0) ? 'none' : 'grayscale(100%) opacity(70%)'
              }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#AFA9EC' }}>Individual Streak</p>
                  <p className="text-4xl font-bold text-white">{streak} <span className="text-2xl">🔥</span></p>
                  <p className="text-xs mt-1" style={{ color: '#AFA9EC' }}>Max Streak : {personalBest} days</p>
                </div>
                <div className="text-5xl select-none hidden sm:block">🔥</div>
              </div>
            </div>

            {/* Individual Overall Consistency Card */}
            {individualOverallConsistency !== null && (
              <div className="rounded-2xl p-5 animate-fade-up delay-100 flex-1 flex flex-col justify-center"
                style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
                <p className="text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Individual Overall Consistency</p>
                <p className="text-3xl font-bold text-white">
                  {individualOverallConsistency.toFixed(1)}<span className="text-lg" style={{ color: '#5F5E5A' }}>%</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: '#363634' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${individualOverallConsistency}%`, background: 'linear-gradient(90deg, #7F77DD, #534AB7)' }} />
                </div>
              </div>
            )}

            {/* Coins + Rank side-by-side below streak */}
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="rounded-2xl p-5 animate-fade-up delay-100 flex flex-col justify-center h-full"
                style={{ background: 'linear-gradient(135deg, #712B13, #993C1D)', border: '1px solid rgba(216,90,48,0.4)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: '#F0997B' }}>My Coins</p>
                <p className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-2">
                  {coins !== null ? coins : '—'} <img src={habitionCoin} alt="coin" className="w-8 h-8 sm:w-10 sm:h-10" />
                </p>
                <p className="text-xs mt-1" style={{ color: '#F0997B' }}>earned in group</p>
              </div>

              <div className="rounded-2xl p-5 animate-fade-up delay-200 h-full flex flex-col justify-center"
                style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
                <p className="text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>My Rank</p>
                <p className="text-3xl font-bold text-white">
                  {myRank !== null ? `#${myRank}` : '—'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>in this group</p>
              </div>
            </div>
          </div>

          {/* RIGHT: Individual Consistency Rings */}
          <div className="rounded-2xl p-6 flex flex-col justify-center animate-fade-up delay-200 flex-1"
            style={{ background: '#2C2C2A', border: '1px solid #363634', minWidth: 0 }}>
            <p className="text-sm font-semibold mb-5" style={{ color: '#B4B2A9' }}>Individual Consistency Rings</p>
            <ConsistencyRings
              {...computeRingsFromHeatmap(heatmapData)}
              size={180}
            />
          </div>
        </div>

        {/* AI Group Insights */}
        {groupInsight && (
          <div className="mb-8 animate-fade-up delay-200">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <span className="text-xl">✨</span> AI Group Insights
            </h2>
            <div className="p-5 rounded-2xl border" style={{ background: 'linear-gradient(145deg, #2C2C2A, #242422)', borderColor: '#363634' }}>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Health Status & Score */}
                <div className="flex-1 flex items-center gap-4 border-b md:border-b-0 md:border-r border-[#363634] pb-4 md:pb-0 pr-0 md:pr-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-lg ${groupInsight.healthStatus === 'EXCELLENT' ? 'border-green-500 bg-green-500/20 text-green-400' : groupInsight.healthStatus === 'HEALTHY' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-orange-500 bg-orange-500/20 text-orange-400'}`}>
                    <span className="text-xl font-bold">{Math.round(groupInsight.overallConsistencyScore)}</span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#B4B2A9' }}>Health Status</p>
                    <p className={`text-lg font-bold ${groupInsight.healthStatus === 'EXCELLENT' ? 'text-green-400' : groupInsight.healthStatus === 'HEALTHY' ? 'text-blue-400' : 'text-orange-400'}`}>
                      {groupInsight.healthStatus}
                    </p>
                  </div>
                </div>

                {/* AI Suggestion & Dynamics */}
                <div className="flex-[2] flex flex-col justify-center">
                  <p className="text-sm italic text-white mb-3 pl-3 border-l-2 border-[#534AB7]">"{groupInsight.suggestedAction}"</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    {groupInsight.topPerformers.length > 0 && (
                      <div>
                        <span className="text-green-400 font-semibold">📈 Trending Up: </span>
                        <span className="text-[#B4B2A9]">{groupInsight.topPerformers.join(', ')}</span>
                      </div>
                    )}
                    {groupInsight.strugglingMembers.length > 0 && (
                      <div>
                        <span className="text-orange-400 font-semibold">⚠️ Needs Support: </span>
                        <span className="text-[#B4B2A9]">{groupInsight.strugglingMembers.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Individual Heatmap */}
        <div className="mt-10 animate-fade-up delay-100">
          <HeatmapView heatmapData={heatmapData} title="Individual Heatmap" />
        </div>


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
                  type="date"
                  value={dlSetDate}
                  onChange={e => setDlSetDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none"
                  style={{ background: '#1A1A18', border: '1px solid #424240' }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Years */}
                <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Years</span>
                  <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                    <button
                      type="button"
                      onClick={() => setDlYears(prev => Math.max(0, prev - 1))}
                      disabled={dlYears <= 0}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                      aria-label="Decrease years"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={dlYears}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setDlYears(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-10 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDlYears(prev => prev + 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                      aria-label="Increase years"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Months */}
                <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Months</span>
                  <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                    <button
                      type="button"
                      onClick={() => setDlMonths(prev => Math.max(0, prev - 1))}
                      disabled={dlMonths <= 0}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                      aria-label="Decrease months"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={dlMonths}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setDlMonths(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-10 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDlMonths(prev => prev + 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                      aria-label="Increase months"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Weeks */}
                <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Weeks</span>
                  <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                    <button
                      type="button"
                      onClick={() => setDlWeeks(prev => Math.max(0, prev - 1))}
                      disabled={dlWeeks <= 0}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                      aria-label="Decrease weeks"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={dlWeeks}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setDlWeeks(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-10 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDlWeeks(prev => prev + 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                      aria-label="Increase weeks"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Days */}
                <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Days</span>
                  <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                    <button
                      type="button"
                      onClick={() => setDlDays(prev => Math.max(0, prev - 1))}
                      disabled={dlDays <= 0}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                      aria-label="Decrease days"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      value={dlDays}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setDlDays(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-10 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDlDays(prev => prev + 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                      aria-label="Increase days"
                    >
                      +
                    </button>
                  </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => handleCloseModal()}>
          <div className="w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[85vh]"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Group Details</h2>
                <div className="text-sm text-[#B4B2A9] flex items-center gap-2">
                  Invite Code:
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(group.inviteCode);
                      showToast('Invite code copied!');
                    }}
                    className="group relative font-mono text-white bg-[#1A1A18] px-3 py-1.5 rounded-lg border border-[#363634] hover:border-[#534AB7] transition-all flex items-center gap-2"
                  >
                    <span>{group.inviteCode}</span>
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-[#7F77DD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Click to copy</span>
                  </button>
                </div>
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
              <button onClick={() => handleCloseModal()} className="text-[#5F5E5A] hover:text-white text-xl">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#363634] mb-4">
              {['OVERVIEW', 'MEMBERS', ...(isAdmin ? ['SETTINGS'] : [])].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveModalTab(tab as any)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    activeModalTab === tab
                      ? 'text-white border-b-2'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={{ borderColor: activeModalTab === tab ? '#7F77DD' : 'transparent' }}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-6 scrollbar-hide space-y-6">
              {activeModalTab === 'OVERVIEW' && (
                <div className="animate-fade-in space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                    <div className="flex flex-col gap-3 aspect-square">
                      {/* Group Streak */}
                      <div className={`rounded-2xl p-2 px-3 border shadow-inner flex-1 flex flex-col justify-center transition-all duration-700 ${!(todayEarned && habits.length > 0) ? 'grayscale opacity-80' : 'animate-border-pulse'}`}
                        style={{
                          background: 'linear-gradient(135deg, #26215C, #534AB7)',
                          border: (todayEarned && habits.length > 0) ? '2px solid #F97316' : '1px solid rgba(83,74,183,0.5)',
                          animation: (todayEarned && habits.length > 0) ? 'orangePulse 1.8s ease-out infinite' : 'none'
                        }}>
                        <p className="text-xs font-semibold text-[#AFA9EC] mb-1">Group Streak</p>
                        <div className="flex items-baseline gap-2">
                          <p className={`text-2xl font-bold text-white`}>
                            {group.currentGlobalHabitGroupStreak || 0} {(todayEarned && habits.length > 0) && '🔥'}
                          </p>
                        </div>
                        <p className="text-[10px] text-[#AFA9EC] mt-0.5 font-medium">Max Streak : {group.highestHabitGroupStreak || 0}</p>
                      </div>

                      {/* Group Overall Consistency Card */}
                      {groupOverallConsistency !== null && (
                        <div className="rounded-2xl p-2 px-3 border border-[#363634] shadow-inner flex-1 flex flex-col justify-center"
                          style={{ background: '#2C2C2A' }}>
                          <p className="text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Group Overall Consistency</p>
                          <p className="text-2xl font-bold text-white">
                            {groupOverallConsistency.toFixed(1)}<span className="text-sm" style={{ color: '#5F5E5A' }}>%</span>
                          </p>
                          <div className="mt-1 h-1.5 rounded-full" style={{ background: '#363634' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${groupOverallConsistency}%`, background: 'linear-gradient(90deg, #7F77DD, #534AB7)' }} />
                          </div>
                        </div>
                      )}

                      {/* Group Today Card */}
                      {(() => {
                        const dateString = new Date().toISOString().split('T')[0];
                        const groupCompletionRate = overallHeatmapData.get(dateString) || 0;
                        const numHabits = group?.habits?.length || habits.length || 0;
                        const numMembers = group?.memberIds?.length || group?.memberCount || 1;
                        const totalGroupHabits = numHabits * numMembers;
                        const groupCompletedCount = Math.round((groupCompletionRate / 100) * totalGroupHabits);

                        return (
                          <div className="rounded-2xl p-2 px-3 border border-[#363634] shadow-inner flex-1 flex flex-col justify-center"
                            style={{ background: '#2C2C2A' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Today</p>
                            <p className="text-2xl font-bold text-white">
                              {groupCompletedCount}<span className="text-sm" style={{ color: '#5F5E5A' }}>/{totalGroupHabits}</span>
                            </p>
                            <div className="mt-1 h-1.5 rounded-full" style={{ background: '#363634' }}>
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${groupCompletionRate}%`, background: 'linear-gradient(90deg, #7F77DD, #534AB7)' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-[#1A1A18] rounded-2xl p-4 border border-[#363634] shadow-inner flex flex-col justify-center aspect-square">
                      <p className="text-xs font-semibold text-[#B4B2A9] mb-4 self-start">Group Consistency Rings</p>
                      <ConsistencyRings
                        {...computeRingsFromHeatmap(overallHeatmapData)}
                        size={180}
                      />
                    </div>
                  </div>

                  <div className="bg-[#1A1A18] rounded-2xl p-5 border border-[#363634] shadow-inner">
                    <HeatmapView heatmapData={overallHeatmapData} title="Group Heatmap" />
                  </div>

                  {group.tags && group.tags.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {group.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white bg-[#534AB7]/30 border border-[#534AB7]/50 uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {group.addressDisplay && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Location</h3>
                      <div className="flex items-center gap-2 text-sm text-[#F1EFE8] bg-[#1A1A18] p-3 rounded-xl border border-[#363634]">
                        <svg className="w-4 h-4 text-[#7F77DD] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="break-words whitespace-normal">{group.addressDisplay}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'MEMBERS' && (
                <div className="animate-fade-in space-y-3">
                  {members.map(member => {
                    const isMemberOwner = member.id === group.ownerId;
                    const isMemberAdmin = isMemberOwner || (group.adminIds && group.adminIds.includes(member.id));

                    return (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A18] border border-[#363634]">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-inner"
                          style={{ background: member.userTheme || '#534AB7' }}>
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

                        <div className="flex gap-2">
                          {isAdmin && !isMemberAdmin && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await promoteToAdmin(Number(groupId), member.id);
                                  setGroup(res.data);
                                  showToast(`${member.name || 'User'} is now an admin`);
                                } catch {
                                  showToast('Failed to promote user');
                                }
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#363634] text-white hover:bg-[#534AB7] transition-colors"
                            >
                              Make Admin
                            </button>
                          )}
                          {isOwner && isMemberAdmin && !isMemberOwner && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await demoteMember(Number(groupId), member.id);
                                  setGroup(res.data);
                                  showToast(`${member.name || 'User'} is no longer an admin`);
                                } catch {
                                  showToast('Failed to remove admin');
                                }
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#363634] text-white hover:bg-orange-500 transition-colors"
                            >
                              Remove Admin
                            </button>
                          )}
                          {(isOwner || (isAdmin && !isMemberAdmin)) && member.id !== userId && (
                            <>
                              <button
                                onClick={async () => {
                                  const confirmed = await confirm(`Kick ${member.name || 'this member'}?`, { isDestructive: true });
                                  if (confirmed) {
                                    try {
                                      await kickMember(Number(groupId), member.id);
                                      setMembers(prev => prev.filter(m => m.id !== member.id));
                                      showToast("Member kicked.");
                                    } catch {
                                      showToast("Failed to kick member");
                                    }
                                  }
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors border border-red-900/50"
                              >
                                Kick
                              </button>
                              <button
                                onClick={async () => {
                                  const confirmed = await confirm(`Kick AND Block ${member.name || 'this member'}? They will not be able to apply again.`, { isDestructive: true });
                                  if (confirmed) {
                                    try {
                                      await kickAndBlockMember(Number(groupId), member.id);
                                      setMembers(prev => prev.filter(m => m.id !== member.id));
                                      showToast("Member kicked and blocked.");
                                    } catch {
                                      showToast("Failed to kick and block member");
                                    }
                                  }
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-600/40 text-red-200 hover:bg-red-600/60 transition-colors border border-red-600/50"
                              >
                                Kick & Block
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeModalTab === 'SETTINGS' && isAdmin && (
                <div className="animate-fade-in space-y-5">
                  {/* Settings Cluster Box */}
                  <div className="p-5 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Group Name</label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={e => setEditGroupName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all"
                      style={{ background: '#1A1A18', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Description</label>
                    <textarea
                      value={editGroupDesc}
                      onChange={e => setEditGroupDesc(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all resize-none"
                      style={{ background: '#1A1A18', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                    <p className="text-xs mt-1 text-right text-[#5F5E5A]">{editGroupDesc.length}/1000</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Location</label>
                    <div style={{ background: '#1A1A18', padding: '12px', borderRadius: '12px', border: '1px solid #424240' }}>
                      <LocationSelector
                        latitude={editGroupLocLat}
                        longitude={editGroupLocLng}
                        addressDisplay={editGroupLocName}
                        onChange={(lat, lng, address) => {
                          setEditGroupLocLat(lat);
                          setEditGroupLocLng(lng);
                          setEditGroupLocName(address);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#B4B2A9] mb-2">Tags (Max 10)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editGroupTags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white flex items-center bg-[#534AB7]/30 border border-[#534AB7]/50 uppercase tracking-wider">
                          {tag}
                          <button type="button" onClick={() => setEditGroupTags(editGroupTags.filter(t => t !== tag))} className="ml-2 hover:text-red-300">×</button>
                        </span>
                      ))}
                    </div>
                    {editGroupTags.length < 10 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={editGroupTagsInput}
                          onChange={e => setEditGroupTagsInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const val = editGroupTagsInput.trim().toLowerCase();
                              if (val && !editGroupTags.includes(val) && editGroupTags.length < 10 && val.length <= 50) {
                                setEditGroupTags([...editGroupTags, val]);
                                setEditGroupTagsInput('');
                              }
                            }
                          }}
                          maxLength={50}
                          placeholder="Type a tag and press Enter"
                          className="w-full px-4 py-2 rounded-xl text-sm text-white outline-none transition-all"
                          style={{ background: '#1A1A18', border: '1px solid #424240' }}
                        />
                        <p className="text-xs mt-1 text-right text-[#5F5E5A]">{editGroupTagsInput.length}/50</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={editGroupNotificationsEnabled}
                          onChange={(e) => setEditGroupNotificationsEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[#363634] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white block">Enable Group Notification Insights</span>
                        <span className="text-xs text-[#B4B2A9]">When enabled, this group's progress will be included in the daily digests sent to members.</span>
                      </div>
                    </label>
                  </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!editGroupName.trim()) {
                        showToast('Name is required');
                        return;
                      }
                      if (editGroupDesc.length > 1000) {
                        showToast('Description cannot exceed 1000 characters');
                        return;
                      }
                      setSavingSettings(true);
                      const finalEditTags = [...editGroupTags];
                      const trimmedEditTag = editGroupTagsInput.trim().toLowerCase();
                      if (trimmedEditTag && !finalEditTags.includes(trimmedEditTag) && finalEditTags.length < 10 && trimmedEditTag.length <= 50) {
                        finalEditTags.push(trimmedEditTag);
                      }
                      try {
                        const res = await updateGroupSettings(Number(groupId), {
                          name: editGroupName.trim(),
                          description: editGroupDesc.trim(),
                          latitude: editGroupLocLat,
                          longitude: editGroupLocLng,
                          addressDisplay: editGroupLocName,
                          tags: finalEditTags,
                          notificationsEnabled: editGroupNotificationsEnabled
                        });
                        setGroup(res.data);
                        showToast('Settings saved successfully');
                        setShowGroupDetailsModal(false);
                      } catch {
                        showToast('Failed to save settings');
                      } finally {
                        setSavingSettings(false);
                      }
                    }}
                    disabled={savingSettings}
                    className="w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #534AB7, #7F77DD)', color: 'white' }}
                  >
                    {savingSettings ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Save Settings'}
                  </button>

                  <div className="mt-8 pt-6 border-t border-[#363634]">
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
                </div>
              )}
            </div>

            {!isOwner && activeModalTab !== 'SETTINGS' && (
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
