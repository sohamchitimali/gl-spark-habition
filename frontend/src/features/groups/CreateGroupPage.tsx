import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../../api/groupApi';
import { getFriendships, type FriendshipDto } from '../../api/authApi';
import { sendMessage } from '../../api/chatApi';
import Navbar from '../../components/Navbar';

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('INVITE_ONLY');
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(0);
  const [weeks, setWeeks] = useState(0);
  const [days, setDays] = useState(7);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Friends inviting
  const [friends, setFriends] = useState<FriendshipDto[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]); // array of friendship IDs to invite

  useEffect(() => {
    // Load friends
    getFriendships().then(res => {
      setFriends(res.data.filter(f => f.status === 'ACCEPTED'));
    }).catch(console.error);
  }, []);

  const toggleFriend = (friendId: number) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await createGroup(name.trim(), description.trim(), visibility, years, months, weeks, days, selectedFriends);
      
      navigate('/groups');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create habit group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="animate-fade-up">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-6 text-sm transition-all hover:opacity-70"
            style={{ color: '#B4B2A9', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Create Habit Group</h1>
          <p className="text-sm mb-8" style={{ color: '#B4B2A9' }}>
            A unique invite code will be auto-generated for you to share with friends.
          </p>

          <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Group name</label>
                <input
                  id="create-group-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Morning Warriors"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
                <p className="text-xs mt-1 text-right" style={{ color: '#5F5E5A' }}>{name.length}/50</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all resize-none"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Visibility</label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all appearance-none cursor-pointer"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                >
                  <option value="PUBLIC">Public (Anyone can discover & join)</option>
                  <option value="OPEN">Open (Anyone can discover & request to join)</option>
                  <option value="INVITE_ONLY">Invite Only (Hidden from search)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Duration (Leave as 0 for Indefinite)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Years</label>
                    <input type="number" min="0" value={years} onChange={e => setYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-white outline-none transition-all"
                      style={{ background: '#363634', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Months</label>
                    <input type="number" min="0" value={months} onChange={e => setMonths(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-white outline-none transition-all"
                      style={{ background: '#363634', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Weeks</label>
                    <input type="number" min="0" value={weeks} onChange={e => setWeeks(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-white outline-none transition-all"
                      style={{ background: '#363634', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#B4B2A9' }}>Days</label>
                    <input type="number" min="0" value={days} onChange={e => setDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-white outline-none transition-all"
                      style={{ background: '#363634', border: '1px solid #424240' }}
                      onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Invite Friends section */}
              {friends.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Add Friends to Group</label>
                  <p className="text-xs text-gray-400 mb-3">Selected friends will be added directly to the group.</p>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {friends.map(f => (
                      <div 
                        key={f.id} 
                        onClick={() => toggleFriend(f.friendId)}
                        className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors border ${
                          selectedFriends.includes(f.friendId) 
                            ? 'bg-[#534AB7]/20 border-[#534AB7]' 
                            : 'bg-[#1a1a18] border-[#363634] hover:border-[#5F5E5A]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 border ${
                          selectedFriends.includes(f.friendId)
                            ? 'bg-[#534AB7] border-[#534AB7]'
                            : 'border-gray-500'
                        }`}>
                          {selectedFriends.includes(f.friendId) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{f.friendProfile.name || f.friendProfile.username}</p>
                          <p className="text-xs text-gray-500 truncate">@{f.friendProfile.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl" style={{ background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.2)' }}>
                <p className="text-xs" style={{ color: '#AFA9EC' }}>
                  ✨ After creating the group, you can add habits and start a time-bound competition with your friends.
                </p>
              </div>

              <button
                id="create-group-submit"
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center"
                style={{ 
                  background: loading ? '#5F5E5A' : 'linear-gradient(135deg, #534AB7, #7F77DD)', 
                  color: 'white',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupPage;
