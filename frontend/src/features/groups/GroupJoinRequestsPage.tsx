import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPendingRequests, getGroupRequestHistory, getBlockedGroupUsers, unblockGroupUser, approveRequest, rejectRequest, blockRequester } from '../../api/groupApi';
import { getUsers, type UserProfile } from '../../api/authApi';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

interface JoinRequest {
  id: number;
  groupId: number;
  applicantId: number;
  status: string;
  initialMessage: string;
  createdAt: string;
}

interface GroupBlock {
  id: number;
  groupId: number;
  blockedUserId: number;
  blockedByUserId: number;
  blockedAt: string;
}

const GroupJoinRequestsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'BLOCKED'>('PENDING');
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [history, setHistory] = useState<JoinRequest[]>([]);
  const [blocks, setBlocks] = useState<GroupBlock[]>([]);
  const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (groupId) {
      loadData();
    }
  }, [groupId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userIds = new Set<number>();

      if (activeTab === 'PENDING') {
        const res = await getPendingRequests(Number(groupId));
        setRequests(res.data);
        res.data.forEach((r: any) => userIds.add(r.applicantId));
      } else if (activeTab === 'HISTORY') {
        const res = await getGroupRequestHistory(Number(groupId));
        setHistory(res.data);
        res.data.forEach((r: any) => userIds.add(r.applicantId));
      } else if (activeTab === 'BLOCKED') {
        const res = await getBlockedGroupUsers(Number(groupId));
        setBlocks(res.data);
        res.data.forEach((b: any) => userIds.add(b.blockedUserId));
      }

      if (userIds.size > 0) {
        const usersRes = await getUsers(Array.from(userIds));
        setProfiles(prev => {
          const updated = { ...prev };
          usersRes.data.forEach(u => updated[u.id] = u);
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (targetId: number) => {
    try {
      setActionLoading(targetId);
      await unblockGroupUser(Number(groupId), targetId);
      setBlocks(blocks.filter(b => b.blockedUserId !== targetId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const renderProfileInfo = (userId: number, dateStr: string, subtitlePrefix: string) => {
    const profile = profiles[userId];
    return (
      <div className="flex gap-4 items-center flex-1 min-w-0">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
          style={{ background: profile?.userTheme || '#424240' }}>
          {(profile?.name || profile?.username || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
            {profile?.name || 'Unknown User'}
            <span className="text-sm font-normal text-gray-400 truncate">@{profile?.username}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{subtitlePrefix} {new Date(dateStr).toLocaleDateString()}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col min-h-[calc(100vh-80px)]">
        <div className="mb-6">
          <Link to={`/groups/${groupId}`} className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors mb-4">
            ← Back to Group
          </Link>
          <h1 className="text-3xl font-bold text-white">Join Requests</h1>
          <p className="text-gray-400 text-sm mt-2">Manage applications, history, and blocked users.</p>
        </div>

        <div className="flex gap-4 mb-6 border-b border-[#363634]">
          {['PENDING', 'HISTORY', 'BLOCKED'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-2 text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === tab ? 'text-[#7F77DD] border-b-2 border-[#7F77DD]' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab === 'BLOCKED' ? 'Blocked Users' : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center"><Loading size={16} /></div>
        ) : (
          <div className="space-y-4 pb-12 animate-fade-in">
            {activeTab === 'PENDING' && (
              requests.length === 0 ? (
                <div className="text-center py-12"><p className="text-gray-400">No pending requests</p></div>
              ) : (
                requests.map(req => {
                  const profile = profiles[req.applicantId];
                  return (
                    <div key={req.id} className="bg-[#2C2C2A] border border-[#363634] rounded-2xl p-6 shadow-lg">
                      <div className="flex flex-col gap-5">
                        <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            {renderProfileInfo(req.applicantId, req.createdAt, 'Applied')}
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <button
                              onClick={() => navigate(`/chats?user=${profile?.username}&requestId=${req.id}&groupId=${groupId}`)}
                              className="px-5 py-2 bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#7F77DD] border border-red-[#534AB7]/20 rounded-xl text-sm font-bold transition-colors flex-1 sm:flex-none text-center">Chat
                            </button>
                            <button onClick={async () => {
                              try {
                                await approveRequest(Number(groupId), req.id);
                                setRequests(prev => prev.filter(r => r.id !== req.id));
                              } catch (e) { }
                            }} className="px-5 py-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-xl text-sm font-bold transition-colors border border-green-500/20 flex-1 sm:flex-none text-center">Approve</button>
                            <button onClick={async () => {
                              try {
                                await rejectRequest(Number(groupId), req.id);
                                setRequests(prev => prev.filter(r => r.id !== req.id));
                              } catch (e) { }
                            }} className="px-5 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-sm font-bold transition-colors border border-red-500/20 flex-1 sm:flex-none text-center">Reject</button>
                            <button onClick={async () => {
                              try {
                                await blockRequester(Number(groupId), req.id);
                                setRequests(prev => prev.filter(r => r.id !== req.id));
                              } catch (e) { }
                            }} className="px-5 py-2 bg-[#1a1a18] text-gray-400 border border-gray-100/20 hover:text-red-400 rounded-xl text-sm font-bold transition-colors border border-[#363634] hover:border-red-900/50 flex-1 sm:flex-none text-center">Block</button>
                          </div>
                        </div>
                        <div className="p-4 bg-[#1a1a18] rounded-xl border border-[#363634] w-full">
                          <p className="text-[10px] text-[#7F77DD] font-bold uppercase mb-2">Message</p>
                          <p className="text-gray-300 text-sm break-words whitespace-pre-wrap">{req.initialMessage}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {activeTab === 'HISTORY' && (
              history.length === 0 ? (
                <div className="text-center py-12"><p className="text-gray-400">No request history</p></div>
              ) : (
                history.map(req => (
                  <div key={req.id} className="bg-[#1A1A18] border border-[#363634] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {renderProfileInfo(req.applicantId, req.createdAt, 'Applied')}
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                        'bg-red-500/20 text-red-400 border border-red-500/20'
                        }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}

            {activeTab === 'BLOCKED' && (
              blocks.length === 0 ? (
                <div className="text-center py-12"><p className="text-gray-400">No blocked users</p></div>
              ) : (
                blocks.map(block => (
                  <div key={block.id} className="bg-[#1A1A18] border border-[#363634] rounded-xl p-4 flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {renderProfileInfo(block.blockedUserId, block.blockedAt, 'Blocked on')}
                    </div>
                    <button
                      onClick={() => handleUnblock(block.blockedUserId)}
                      disabled={actionLoading === block.blockedUserId}
                      className="px-5 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupJoinRequestsPage;
