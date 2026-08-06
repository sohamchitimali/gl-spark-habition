import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';

interface Group { id: number; name: string; inviteCode: string; memberIds: number[]; }

const GroupsPage = () => {
  const [groups] = useState<Group[]>(() => {
    const stored = localStorage.getItem('myGroups');
    return stored ? JSON.parse(stored) : [];
  });

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-3xl font-bold text-white">My Groups</h1>
            <p className="text-sm mt-1" style={{ color: '#B4B2A9' }}>Compete, collaborate, and hold each other accountable</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-up delay-100">
          <Link to="/groups/create"
            className="flex items-center justify-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #534AB7, #3C3489)', border: '1px solid #534AB7' }}>
            <span className="text-2xl">✚</span>
            <div className="text-left">
              <p className="text-white font-semibold">Create Group</p>
              <p className="text-xs" style={{ color: '#AFA9EC' }}>Be the group owner</p>
            </div>
          </Link>
          <Link to="/groups/join"
            className="flex items-center justify-center gap-3 p-5 rounded-2xl transition-all hover:opacity-90 no-underline"
            style={{ background: 'linear-gradient(135deg, #993C1D, #D85A30)', border: '1px solid #D85A30' }}>
            <span className="text-2xl">🔗</span>
            <div className="text-left">
              <p className="text-white font-semibold">Join Group</p>
              <p className="text-xs" style={{ color: '#FAECE7' }}>Enter an invite code</p>
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
            {groups.map((group, i) => (
              <div key={group.id}
                className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
                style={{ background: '#2C2C2A', border: '1px solid #363634', animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
                      {group.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{group.name}</h3>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
