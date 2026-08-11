import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPendingRequests, approveRequest, rejectRequest } from '../../api/groupApi';
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

const GroupJoinRequestsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (groupId) {
      loadRequests();
    }
  }, [groupId]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await getPendingRequests(Number(groupId));
      const reqs = res.data;
      setRequests(reqs);

      // Fetch user profiles for applicants
      if (reqs.length > 0) {
        const applicantIds = reqs.map((r: JoinRequest) => r.applicantId);
        const usersRes = await getUsers(applicantIds);
        const pMap: Record<number, UserProfile> = {};
        usersRes.data.forEach(u => pMap[u.id] = u);
        setProfiles(pMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      await approveRequest(Number(groupId), requestId);
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      await rejectRequest(Number(groupId), requestId);
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col min-h-[calc(100vh-80px)]">
        <div className="mb-8">
          <Link to={`/groups/${groupId}`} className="text-[#7F77DD] hover:opacity-80 flex items-center mb-4 transition-colors w-fit text-sm">
            <span className="mr-2">←</span> Back to Group
          </Link>
          <h1 className="text-3xl font-bold text-white">Pending Join Requests</h1>
          <p className="text-gray-400 mt-2">Review applications and chat with applicants before approving them.</p>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loading size={16} />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <div className="text-6xl mb-4 opacity-50">📬</div>
            <h3 className="text-xl font-medium text-gray-400">No pending requests</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">Share your group invite code or set your group to PUBLIC to attract more members.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const profile = profiles[req.applicantId];
              return (
                <div key={req.id} className="bg-[#2C2C2A] border border-[#363634] rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
                    
                    {/* Applicant Info */}
                    <div className="flex gap-4 items-start flex-1">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0" 
                        style={{ background: profile?.preferredColor || '#424240' }}>
                        {(profile?.name || profile?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {profile?.name || 'Unknown User'}
                          <span className="text-sm font-normal text-gray-400">@{profile?.username}</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Applied {new Date(req.createdAt).toLocaleDateString()}</p>
                        
                        <div className="mt-4 p-4 bg-[#1a1a18] rounded-xl border border-[#363634]">
                          <p className="text-xs text-[#7F77DD] font-bold uppercase mb-2">Message</p>
                          <p className="text-gray-300 text-sm">"{req.initialMessage}"</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row md:flex-col gap-3 shrink-0">
                      <button
                        onClick={() => navigate(`/chats?user=${profile?.username}`)}
                        className="px-6 py-2.5 bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#7F77DD] rounded-xl font-bold transition-colors flex-1"
                      >
                        💬 Chat
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="px-6 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 rounded-xl font-bold transition-colors disabled:opacity-50 flex-1"
                      >
                        ✔️ Approve
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-xl font-bold transition-colors disabled:opacity-50 flex-1"
                      >
                        ❌ Reject
                      </button>
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

export default GroupJoinRequestsPage;
