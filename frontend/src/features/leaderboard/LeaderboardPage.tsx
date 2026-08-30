import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../../api/coinApi';
import type { LeaderboardEntry, LeaderboardResponse } from '../../api/coinApi';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../auth/AuthContext';
import { getGroup, type GroupResponse } from '../../api/groupApi';
import { getUsers, type UserProfile } from '../../api/authApi';
import habitionCoin from '../../assets/habition_coin.png';

const getDisplayName = (email: string) => email.split('@')[0];

const getInitials = (email: string) => {
  const name = getDisplayName(email);
  return name.substring(0, 2).toUpperCase();
};

const LeaderboardPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { userId } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [users, setUsers] = useState<Record<number, UserProfile>>({});


  const navigate = useNavigate();

  useEffect(() => {
    if (!groupId) return;

    Promise.all([
      getGroup(Number(groupId)),
      getLeaderboard(Number(groupId)).catch(() => ({ data: { groupId: Number(groupId), entries: [], winnerId: null } }))
    ]).then(([groupRes, boardRes]) => {
      setGroup(groupRes.data);
      setData(boardRes.data as LeaderboardResponse);

      const memberIds = groupRes.data.memberIds || [];
      if (memberIds.length > 0) {
        getUsers(memberIds)
          .then(ur => {
            const userMap: Record<number, UserProfile> = {};
            ur.data.forEach(u => userMap[u.id] = u);
            setUsers(userMap);
          })
          .catch(() => { });
      }
    }).catch(() => { });
  }, [groupId]);

  let entries = data?.entries ?? [];
  if (group && group.memberIds) {
    const existingIds = new Set(entries.map(e => e.userId));
    const missingIds = group.memberIds.filter(id => !existingIds.has(id));
    const lastRank = entries.length > 0 ? entries[entries.length - 1].rank : 0;

    const missingEntries: LeaderboardEntry[] = missingIds.map(id => ({
      userId: id,
      totalCoins: 0,
      rank: lastRank + 1
    }));
    entries = [...entries, ...missingEntries];
  }
  
  // Mock previousRank if undefined
  entries = entries.map((e, idx) => ({
    ...e,
    previousRank: e.previousRank ?? e.rank + (idx % 3 === 0 ? 1 : idx % 3 === 1 ? -1 : 0)
  }));
  const podium = entries.slice(0, 3);
  const maxCoins = podium[0]?.totalCoins ?? 1;

  // Display order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  const totalGroupCoins = entries.reduce((acc, e) => acc + e.totalCoins, 0);
  const totalMembers = group?.memberIds?.length || 0;

  let timeLeftString = 'Ended';
  if (group?.competitionEndDate) {
    const end = new Date(group.competitionEndDate).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      timeLeftString = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="animate-fade-up">
          <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors mb-6 cursor-pointer bg-transparent border-none p-0">
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Group Leaderboard</h1>
          <p className="text-sm mb-8" style={{ color: '#B4B2A9' }}>{group?.name ?? 'Competition'}</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
          <div className="p-3 rounded-2xl flex flex-col items-center justify-center text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <span className="text-xs tracking-wider font-semibold mb-1" style={{ color: '#B4B2A9' }}>Total coins</span>
            <div className="flex items-center gap-1 text-lg md:text-xl font-bold text-white">
              {totalGroupCoins} <img src={habitionCoin} alt="coins" className="w-4 h-4" />
            </div>
          </div>
          <div className="p-3 rounded-2xl flex flex-col items-center justify-center text-center" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <span className="text-xs tracking-wider font-semibold mb-1" style={{ color: '#B4B2A9' }}>Members</span>
            <div className="text-lg md:text-xl font-bold text-white">
              {totalMembers} 👥
            </div>
          </div>
          <div className="p-3 rounded-2xl flex flex-col items-center justify-center text-center" style={{ background: 'rgba(216,90,48,0.1)', border: '1px solid rgba(216,90,48,0.2)' }}>
            <span className="text-xs tracking-wider font-semibold mb-1" style={{ color: '#F0997B' }}>Time left</span>
            <div className="text-lg md:text-xl font-bold" style={{ color: '#D85A30' }}>
              ⏱ {timeLeftString}
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-3xl overflow-hidden animate-fade-up delay-100"
          style={{ background: '#2C2C2A', border: '1px solid #363634' }}>

          {/* Podium */}
          <div className="p-6 pb-4" style={{ background: '#242422' }}>
            <div className="flex items-end justify-center gap-2 md:gap-4 h-[360px] md:h-96">
              {podiumOrder.map((entry) => {
                const isFirst = entry.rank === 1;
                const barH = isFirst ? 260 : entry.rank === 2 ? 190 : 140;
                const email = users[entry.userId]?.email ?? `user${entry.userId}@example.com`;
                const initials = getInitials(email);
                const prefColor = users[entry.userId]?.userTheme || (isFirst ? '#D85A30' : entry.rank === 2 ? '#B4B2A9' : '#AFA9EC');

                return (
                  <div key={entry.userId} className="flex flex-col items-center gap-2 w-1/3 max-w-[80px]">
                    {/* Avatar */}
                    <div className="relative">
                      {isFirst && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-lg">👑</span>
                      )}
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg"
                        style={{ background: prefColor, border: `2px solid ${isFirst ? '#FFFFFF' : 'transparent'}` }}
                        title={email}>
                        {initials}
                      </div>
                    </div>
                    <div className="w-full rounded-t-xl flex flex-col items-center justify-end pb-2 transition-all shadow-md"
                      style={{ height: barH, background: prefColor, opacity: isFirst ? 1 : 0.85 }}
                      title={`${entry.totalCoins} coins`}>
                      <span className="text-xs text-white font-bold">{entry.rank}</span>
                    </div>
                    {/* Label */}
                    <div className="text-center w-full">
                      <p className="text-[10px] md:text-xs font-medium text-white truncate w-full px-1">{getDisplayName(email)}</p>
                      <p className="text-[10px] md:text-xs flex items-center justify-center gap-1" style={{ color: '#B4B2A9' }}>
                        {entry.totalCoins} <img src={habitionCoin} alt="coins" className="w-3 h-3 md:w-4 md:h-4" />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full List */}
          <div className="divide-y" style={{ borderColor: '#363634' }}>
            {entries.map((entry, i) => {
              const isMe = String(entry.userId) === String(userId);
              const email = users[entry.userId]?.email ?? `user${entry.userId}@example.com`;
              const initials = getInitials(email);
              const displayName = getDisplayName(email);
              const medal = ['🥇', '🥈', '🥉'][entry.rank - 1] ?? `#${entry.rank}`;

              const barPct = Math.round((entry.totalCoins / maxCoins) * 100);
              const userColor = users[entry.userId]?.userTheme || '#534AB7';
              
              const prevRank = entry.previousRank ?? entry.rank;
              const rankDiff = prevRank - entry.rank;
              let movementIcon = <span className="text-[#5F5E5A] text-[10px]">-</span>;
              if (rankDiff > 0) {
                movementIcon = <span className="text-green-400 text-[10px] flex items-center">▲ {rankDiff}</span>;
              } else if (rankDiff < 0) {
                movementIcon = <span className="text-red-400 text-[10px] flex items-center">▼ {Math.abs(rankDiff)}</span>;
              }

              return (
                <div key={entry.userId}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{
                    background: isMe ? 'rgba(83,74,183,0.12)' : i % 2 === 0 ? '#2C2C2A' : '#262624',
                    borderBottom: i < entries.length - 1 ? '1px solid #363634' : 'none',
                  }}>

                  <div className="w-10 flex flex-col items-center justify-center">
                    <span className="text-lg leading-none" style={{ color: '#5F5E5A' }}>{medal}</span>
                    <div className="mt-1">{movementIcon}</div>
                  </div>

                  <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: userColor }}
                    title={email}>
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate flex items-center gap-2">
                      {displayName} {isMe && <span className="text-xs" style={{ color: '#7F77DD' }}>(you)</span>}
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full" style={{ background: '#363634' }}
                      title={`${entry.totalCoins} coins`}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${barPct}%`, background: userColor }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#F1EFE8' }}>
                    {entry.totalCoins} <img src={habitionCoin} alt="coins" className="w-5 h-5 inline-block" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;