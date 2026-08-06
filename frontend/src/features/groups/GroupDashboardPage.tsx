import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getGroup, addHabit, deleteGroupHabit, type GroupResponse, type GroupHabit } from '../../api/groupApi';
import { completeHabit, getTasks, createTask, toggleTask, deleteTask, type HabitTask } from '../../api/habitApi';
import { getUserBalance, getLeaderboard, type LeaderboardEntry } from '../../api/coinApi';
import Navbar from '../../components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupHabitWithTasks extends GroupHabit {
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

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  // Create habit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ─── Load group data ────────────────────────────────────────────────────────

  const loadCoins = () => {
    if (!userId) return;
    getUserBalance(userId).then(r => setCoins(r.data)).catch(() => {});
  };

  const loadLeaderboard = () => {
    if (!groupId) return;
    getLeaderboard(Number(groupId)).then(r => {
      setLeaderboard(r.data.entries);
      const rank = r.data.entries.findIndex(e => e.userId === userId);
      setMyRank(rank >= 0 ? rank + 1 : null);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!groupId) return;
    getGroup(Number(groupId))
      .then(r => {
        setGroup(r.data);
        setHabits(r.data.habits.map(h => ({
          ...h,
          tasks: [],
          tasksLoaded: false,
          completedToday: false,
        })));
      })
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));
    loadCoins();
    loadLeaderboard();
  }, [groupId, userId]);

  // ─── Expand — lazy load tasks ───────────────────────────────────────────────

  const handleExpand = (habitId: number) => {
    if (expandedId === habitId) { setExpandedId(null); return; }
    setExpandedId(habitId);
    const habit = habits.find(h => h.id === habitId);
    if (!habit?.tasksLoaded) {
      getTasks(habitId).then(r => {
        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, tasks: r.data, tasksLoaded: true } : h));
      }).catch(() => {});
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
    const res = await createTask(habitId, title);
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
      setHabits(prev => [...prev, { ...res.data, tasks: [], tasksLoaded: true, completedToday: false }]);
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
    try {
      const res = await completeHabit(habit.id);
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, completedToday: true } : h));
      loadCoins();
      loadLeaderboard();
      showToast(`+${res.data.coinsEarned} 🪙 earned for the group!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) showToast(`⚠️ ${msg}`);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const completedCount = habits.filter(h => h.completedToday).length;
  const isOwner = group?.ownerId === userId;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a18' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#534AB7', borderTopColor: 'transparent' }} />
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
          <Link to="/groups" className="text-sm mb-3 inline-flex items-center gap-1 no-underline hover:opacity-80"
            style={{ color: '#7F77DD' }}>
            ← Back to Groups
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
              style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
              {group.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{group.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#B4B2A9' }}>
                {group.memberIds?.length ?? 1} member{(group.memberIds?.length ?? 1) !== 1 ? 's' : ''} · {today}
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Coins */}
          <div className="rounded-2xl p-5 animate-fade-up delay-100"
            style={{ background: 'linear-gradient(135deg, #712B13, #993C1D)', border: '1px solid rgba(216,90,48,0.4)' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#F0997B' }}>My Coins</p>
            <p className="text-3xl font-bold text-white">{coins !== null ? coins : '—'} <span className="text-xl">🪙</span></p>
            <p className="text-xs mt-1" style={{ color: '#F0997B' }}>earned total</p>
          </div>

          {/* Rank */}
          <div className="rounded-2xl p-5 animate-fade-up delay-200"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>My Rank</p>
            <p className="text-3xl font-bold text-white">
              {myRank !== null ? `#${myRank}` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>in this group</p>
          </div>

          {/* Today's habits */}
          <div className="rounded-2xl p-5 animate-fade-up delay-300"
            style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>Today</p>
            <p className="text-3xl font-bold text-white">
              {completedCount}<span className="text-lg" style={{ color: '#5F5E5A' }}>/{habits.length}</span>
            </p>
            <p className="text-xs mt-1" style={{ color: '#B4B2A9' }}>habits done</p>
          </div>
        </div>

        {/* Group Habits */}
        <div className="mb-8 animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Group Habits</h2>
            {isOwner && (
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
                          <span className="text-xs font-medium px-2 py-1 rounded-full"
                            style={{ background: 'rgba(216,90,48,0.2)', color: '#F0997B' }}>
                            +10 🪙
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
                const medal = ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;
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
                    <span className="text-sm font-bold" style={{ color: '#F0997B' }}>
                      {entry.totalCoins} 🪙
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
    </div>
  );
};

export default GroupDashboardPage;
