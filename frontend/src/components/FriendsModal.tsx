import { useState, useEffect } from 'react';
import { getFriendships, acceptFriendRequest, removeFriend, type FriendshipDto } from '../api/authApi';
import { useNavigate } from 'react-router-dom';

interface FriendsModalProps {
  onClose: () => void;
  onUpdate?: () => void;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ onClose, onUpdate }) => {
  const [friendships, setFriendships] = useState<FriendshipDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFriendships();
  }, []);

  const fetchFriendships = async () => {
    try {
      const res = await getFriendships();
      setFriendships(res.data);
    } catch (err) {
      console.error('Failed to load friendships', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await acceptFriendRequest(id);
      fetchFriendships();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to accept', err);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeFriend(id);
      fetchFriendships();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to remove', err);
    }
  };

  // Filter based on search query
  const q = searchQuery.toLowerCase();
  const filterFn = (f: FriendshipDto) => 
    (f.friendProfile.name || '').toLowerCase().includes(q) || 
    (f.friendProfile.username || '').toLowerCase().includes(q);

  const pendingRequests = friendships.filter(f => f.status === 'PENDING' && !f.isRequester).filter(filterFn);
  const sentRequests = friendships.filter(f => f.status === 'PENDING' && f.isRequester).filter(filterFn);
  const friends = friendships.filter(f => f.status === 'ACCEPTED').filter(filterFn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#1a1a18', border: '1px solid #363634', maxHeight: '85vh' }}>
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid #363634' }}>
          <h2 className="text-2xl font-bold text-white">Friends</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4" style={{ borderBottom: '1px solid #363634' }}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
              style={{ background: '#2C2C2A', border: '1px solid #424240' }}
              onFocus={(e) => { e.target.style.borderColor = '#7F77DD'; }}
              onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
            />
            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="text-center text-gray-500 py-4">Loading...</div>
          ) : (
            <>
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#F0997B' }}>Incoming Requests</h3>
                  <div className="space-y-2">
                    {pendingRequests.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#2C2C2A' }}>
                        <div>
                          <p className="text-white font-bold text-sm">{f.friendProfile.name || f.friendProfile.username}</p>
                          <p className="text-xs text-gray-400">@{f.friendProfile.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAccept(f.id)} className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button onClick={() => handleRemove(f.id)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent Requests */}
              {sentRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7F77DD' }}>Sent Requests</h3>
                  <div className="space-y-2">
                    {sentRequests.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#2C2C2A' }}>
                        <div>
                          <p className="text-white font-bold text-sm">{f.friendProfile.name || f.friendProfile.username}</p>
                          <p className="text-xs text-gray-400">@{f.friendProfile.username}</p>
                        </div>
                        <button onClick={() => handleRemove(f.id)} className="text-xs text-red-400 hover:text-red-300">
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends List */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#B4B2A9' }}>My Friends ({friends.length})</h3>
                {friends.length === 0 ? (
                  <p className="text-gray-500 text-sm italic py-2">
                    {searchQuery ? 'No friends found matching your search.' : 'No friends yet. Head to the Discover People page to make some!'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friends.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl group transition-colors hover:bg-[#363634]" style={{ background: '#2C2C2A' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md shrink-0" style={{ background: f.friendProfile.preferredColor || '#534AB7' }}>
                            {(f.friendProfile.name || f.friendProfile.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{f.friendProfile.name || f.friendProfile.username}</p>
                            <p className="text-xs text-gray-400">@{f.friendProfile.username}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              onClose();
                              navigate(`/chats?user=${f.friendProfile.username}`);
                            }} 
                            className="p-2 rounded-lg bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30"
                            title="Message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          </button>
                          <button 
                            onClick={() => handleRemove(f.id)} 
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            title="Remove Friend"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsModal;
