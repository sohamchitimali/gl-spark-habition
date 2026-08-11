import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

import { getMyGroups, type GroupResponse } from '../../api/groupApi';
import { useAuth } from '../../auth/AuthContext';

const GroupsPage = () => {
  const { userId } = useAuth();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyGroups()
      .then(r => setGroups(r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a18' }}>
        <Loading size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-3xl font-bold text-white">My Habit Groups</h1>
            <p className="text-sm mt-1" style={{ color: '#B4B2A9' }}>Compete, collaborate, and hold each other accountable</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-up delay-100">
          <Link to="/groups/create"
            className="flex items-center justify-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #534AB7, #3C3489)', border: '1px solid #534AB7' }}>
            <span className="text-2xl">✚</span>
            <div className="text-left">
              <p className="text-white font-semibold">Create Habit Group</p>
              <p className="text-xs" style={{ color: '#AFA9EC' }}>Be the group owner</p>
            </div>
          </Link>
          <Link to="/groups/join"
            className="flex items-center justify-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #993C1D, #D85A30)', border: '1px solid #D85A30' }}>
            <span className="text-2xl">🔗</span>
            <div className="text-left">
              <p className="text-white font-semibold">Join Habit Group</p>
              <p className="text-xs" style={{ color: '#FAECE7' }}>Enter an invite code</p>
            </div>
          </Link>
          <Link to="/groups/discover"
            className="flex items-center justify-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #1D997C, #30D8A2)', border: '1px solid #30D8A2' }}>
            <span className="text-2xl">🌍</span>
            <div className="text-left">
              <p className="text-white font-semibold">Discover</p>
              <p className="text-xs" style={{ color: '#E7FAF5' }}>Find public groups</p>
            </div>
          </Link>
        </div>

        {/* Group list */}
        {groups.length === 0 ? (
          <div className="text-center py-20 animate-fade-up delay-200">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-white mb-2">No groups yet</h3>
            <p style={{ color: '#B4B2A9' }} className="text-sm">Create or join a group to start competing with friends.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up delay-200">
            {groups.map((group, i) => {
              const isOwner = group.ownerId === (/* need userId here... let's just show it if adminIds includes us or just for anyone who is admin */ group.adminIds?.[0]);
              // Wait, I need userId. Let's import useAuth in GroupsPage.
              return (
                <div key={group.id}
                  className="rounded-2xl p-5 transition-all hover:scale-[1.01] relative"
                  style={{ background: '#2C2C2A', border: '1px solid #363634', animationDelay: `${i * 80}ms` }}>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
                        {group.name[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {group.name}
                          {group.hasPendingRequests && group.adminIds?.includes(userId || 0) && (
                            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Pending Join Requests" />
                          )}
                        </h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs" style={{ color: '#B4B2A9' }}>
                            👥 {group.memberIds?.length ?? 1} member{group.memberIds?.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                            style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC' }}>
                            {group.inviteCode}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/groups/${group.id}/leaderboard`}
                        className="px-3 py-2 rounded-xl text-xs font-semibold no-underline transition-all hover:opacity-80"
                        style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC' }}>
                        🏆 Leaderboard
                      </Link>
                      <Link to={`/groups/${group.id}`}
                        className="px-3 py-2 rounded-xl text-xs font-semibold no-underline transition-all"
                        style={{ background: '#363634', color: '#F1EFE8' }}>
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
