import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMySentRequests } from '../../api/groupApi';
import type { SentJoinRequestResponse } from '../../api/groupApi';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

const MySentRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<SentJoinRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await getMySentRequests();
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col min-h-[calc(100vh-80px)]">
        <div className="mb-8">
          <Link to={`/groups`} className="text-[#7F77DD] hover:opacity-80 flex items-center mb-4 transition-colors w-fit text-sm">
            <span className="mr-2">←</span> Back to Groups
          </Link>
          <h1 className="text-3xl font-bold text-white">My Sent Requests</h1>
          <p className="text-gray-400 mt-2">Track the status of your join requests. Any messages from the group admins will appear in your Chats tab.</p>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loading size={16} />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <div className="text-6xl mb-4 opacity-50">📨</div>
            <h3 className="text-xl font-medium text-gray-400">No sent requests</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">You haven't requested to join any private groups yet.</p>
            <Link to="/groups/discover" className="mt-6 px-6 py-3 bg-[#534AB7] hover:bg-[#534AB7]/80 text-white rounded-xl font-bold transition-colors">
              Discover Groups
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-[#2C2C2A] border border-[#363634] rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  
                  {/* Request Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{req.groupName}</h3>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 
                        req.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                        'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Sent on {new Date(req.createdAt).toLocaleDateString()}</p>
                    
                    <div className="p-4 bg-[#1a1a18] rounded-xl border border-[#363634]">
                      <p className="text-xs text-[#7F77DD] font-bold uppercase mb-2">Your Application Message</p>
                      <p className="text-gray-300 text-sm">"{req.initialMessage}"</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
                    <button
                      onClick={() => navigate(`/chats`)}
                      className="px-6 py-3 bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#7F77DD] rounded-xl font-bold transition-colors text-center"
                    >
                      💬 Go to Chats
                    </button>
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

export default MySentRequestsPage;
