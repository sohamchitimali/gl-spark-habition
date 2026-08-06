import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLeaderboard } from '../../api/coinApi';
import type { LeaderboardEntry, LeaderboardResponse } from '../../api/coinApi';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../auth/AuthContext';
import { getGroup, type GroupResponse } from '../../api/groupApi';
import { getUsers, type UserProfile } from '../../api/authApi';
import habitionCoin from '../../assets/habition_coin.png';

const AVATAR_COLORS = ['#534AB7', '#D85A30', '#3C3489', '#993C1D', '#7F77DD', '#F0997B'];
const BAR_COLORS = ['#7F77DD', '#F0997B', '#D85A30', '#AFA9EC', '#FAECE7', '#534AB7'];

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

  const mockEntries: LeaderboardEntry[] = [];

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
          .catch(() => {});
      }
    }).catch(() => {});
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
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxCoins = podium[0]?.totalCoins ?? 1;

  // Display order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <Link to="/groups" className="p-2 rounded-xl transition-all hover:opacity-70"
            style={{ background: '#2C2C2A', color: '#B4B2A9', textDecoration: 'none' }}>←</Link>
          <div>
            <p className="text-xs font-medium" style={{ color: '#B4B2A9' }}>{group?.name ?? 'Competition'}</p>
            <h1 className="text-xl font-bold text-white">Group Leaderboard</h1>
          </div>
          <div className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(216,90,48,0.2)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
            ⏱ 4 days left
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-3xl overflow-hidden animate-fade-up delay-100"
          style={{ background: '#2C2C2A', border: '1px solid #363634' }}>

          {/* Podium */}
          <div className="p-6 pb-0" style={{ background: '#242422' }}>
            <div className="flex items-end justify-center gap-4 h-52">
              {podiumOrder.map((entry) => {
                const isFirst = entry.rank === 1;
                const barH = isFirst ? 140 : entry.rank === 2 ? 100 : 80;
                const email = users[entry.userId]?.email ?? `user${entry.userId}@example.com`;
                const initials = getInitials(email);
                const avatarColor = isFirst ? '#D85A30' : entry.rank === 2 ? '#B4B2A9' : '#AFA9EC';

                return (
                  <div key={entry.userId} className="flex flex-col items-center gap-2">
                    {/* Avatar */}
                    <div className="relative">
                      {isFirst && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-lg">👑</span>
                      )}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: avatarColor, border: `3px solid ${isFirst ? '#D85A30' : 'transparent'}` }}>
                        {initials}
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="w-16 rounded-t-xl flex flex-col items-center justify-end pb-2 transition-all"
                      style={{ height: barH, background: isFirst ? 'linear-gradient(180deg, #D85A30, #712B13)' : '#363634' }}>
                      <span className="text-xs text-white font-bold">{entry.rank}</span>
                    </div>
                    {/* Label */}
                    <div className="text-center">
                      <p className="text-xs font-medium text-white truncate max-w-[60px]">{getDisplayName(email)}</p>
                      <p className="text-xs flex items-center gap-1" style={{ color: '#B4B2A9' }}>
                        {entry.totalCoins} <img src={habitionCoin} alt="coins" className="w-4 h-4" />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rest of rankings */}
          <div className="divide-y" style={{ borderColor: '#363634' }}>
            {rest.map((entry, i) => {
              const isMe = entry.userId === userId;
              const email = users[entry.userId]?.email ?? `user${entry.userId}@example.com`;
              const initials = getInitials(email);
              const displayName = isMe ? 'You' : getDisplayName(email);
              const barPct = Math.round((entry.totalCoins / maxCoins) * 100);
              const barColor = BAR_COLORS[(i + 3) % BAR_COLORS.length];

              return (
                <div key={entry.userId}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{ background: isMe ? 'rgba(83,74,183,0.1)' : 'transparent' }}>
                  <span className="w-4 text-center text-sm font-medium" style={{ color: '#5F5E5A' }}>
                    {entry.rank}
                  </span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {displayName}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full" style={{ background: '#363634' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${barPct}%`, background: barColor }} />
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
