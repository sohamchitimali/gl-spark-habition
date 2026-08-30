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
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col min-h-[calc(100vh-80px)]">
        <div className="mb-8">
          <Link to={`/groups`} className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors mb-4">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-white">My Sent Requests</h1>
          <p className="text-gray-400 text-sm mt-2">Track the status of your join requests. Any messages from the group admins will appear in your Chats tab.</p>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loading size={16} />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-center my-auto">
            <h3 className="text-xl font-medium text-gray-400">No sent requests</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">You haven't requested to join any private groups yet.</p>
            <Link to="/search" className="mt-6 px-6 py-3 bg-[#534AB7] hover:bg-[#534AB7]/80 text-white rounded-xl font-bold transition-colors">
              Discover Groups
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-[#2C2C2A] border border-[#363634] rounded-2xl p-6 shadow-lg">
                <div className="flex flex-col gap-4">
                  {/* Header & Action */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{req.groupName}</h3>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                          req.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                            'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Sent on {new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>

                    <button
                      onClick={() => navigate(`/chats`)}
                      className="px-5 py-2 bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#7F77DD] rounded-xl font-bold transition-colors text-sm"
                    >
                      Chat
                    </button>
                  </div>

                  {/* Group Info */}
                  {(req.groupDescription || (req.groupTags && req.groupTags.length > 0)) && (
                    <div className="py-2">
                      {req.groupDescription && (
                        <p className="text-sm text-gray-400 line-clamp-2">{req.groupDescription}</p>
                      )}
                      {req.groupTags && req.groupTags.length > 0 && (
                        <div className={`flex flex-wrap gap-2 ${req.groupDescription ? 'mt-3' : ''}`}>
                          {req.groupTags.slice(0, 5).map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider" style={{ background: 'rgba(83,74,183,0.3)', border: '1px solid rgba(83,74,183,0.5)' }}>
                              {tag}
                            </span>
                          ))}
                          {req.groupTags.length > 5 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-gray-400 uppercase tracking-wider" style={{ background: '#363634' }}>
                              +{req.groupTags.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Box */}
                  <div className="p-4 bg-[#1a1a18] rounded-xl border border-[#363634] w-full">
                    <p className="text-xs text-[#7F77DD] font-bold uppercase mb-2">Your Application Message</p>
                    <p className="text-gray-300 text-sm break-words whitespace-pre-wrap">{req.initialMessage}</p>
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
