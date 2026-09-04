import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../../api/groupApi';
import { getFriendships, type FriendshipDto } from '../../api/authApi';
import Loading from '../../components/Loading';
import Navbar from '../../components/Navbar';
import LocationSelector from '../../components/LocationSelector';
import { SparklesIcon } from '../../components/icons';

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('INVITE_ONLY');
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(0);
  const [weeks, setWeeks] = useState(0);
  const [days, setDays] = useState(7);
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Location
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressDisplay, setAddressDisplay] = useState('');

  // Tags
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  // Friends inviting
  const [friends, setFriends] = useState<FriendshipDto[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]); // array of friendship IDs to invite
  
  // Notification preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    // Load friends
    getFriendships().then(res => {
      setFriends(res.data.filter(f => f.status === 'ACCEPTED'));
    }).catch(console.error);

    // Auto-fill user's profile location
    const profileData = localStorage.getItem('profile');
    if (profileData) {
      try {
        const parsed = JSON.parse(profileData);
        if (parsed.latitude && parsed.longitude) {
          setLatitude(parsed.latitude);
          setLongitude(parsed.longitude);
          setAddressDisplay(parsed.locationDisplay || `${parsed.latitude}, ${parsed.longitude}`);
        }
      } catch {}
    }
  }, []);

  const toggleFriend = (friendId: number) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagsInput.trim().toLowerCase();
      if (val && !tags.includes(val) && tags.length < 10 && val.length <= 50) {
        setTags([...tags, val]);
        setTagsInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    if (description.length > 1000) { setError('Description cannot exceed 1000 characters.'); return; }
    setLoading(true);
    setError('');
    const finalTags = [...tags];
    const trimmedTag = tagsInput.trim().toLowerCase();
    if (trimmedTag && !finalTags.includes(trimmedTag) && finalTags.length < 10 && trimmedTag.length <= 50) {
      finalTags.push(trimmedTag);
    }

    try {
      await createGroup(
        name.trim(), description.trim(), visibility, 
        isIndefinite ? 0 : years, 
        isIndefinite ? 0 : months, 
        isIndefinite ? 0 : weeks, 
        isIndefinite ? 0 : days, 
        selectedFriends, latitude, longitude, addressDisplay, finalTags,
        notificationsEnabled
      );
      
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
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-fade-up">
          <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors mb-6">
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
                  rows={6}
                  maxLength={1000}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all resize-none"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
                <p className="text-xs mt-1 text-right text-[#5F5E5A]">{description.length}/1000</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Visibility</label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all appearance-none cursor-pointer"
                  style={{ 
                    background: '#363634', 
                    border: '1px solid #424240',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237F77DD'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                    backgroundRepeat: 'no-repeat', 
                    backgroundPosition: 'right 1rem center', 
                    backgroundSize: '1.2em' 
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                >
                  <option value="PUBLIC">Public (Anyone can discover & join)</option>
                  <option value="OPEN">Open (Anyone can discover & request to join)</option>
                  <option value="INVITE_ONLY">Invite Only (Hidden from search)</option>
                </select>
              </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Group Location (Optional)</label>
                    <p className="text-xs text-gray-400 mb-3">Helps local users discover your group.</p>
                    <div style={{ background: '#222220', padding: '16px', borderRadius: '12px', border: '1px solid #363634' }}>
                      <LocationSelector
                        latitude={latitude}
                        longitude={longitude}
                        addressDisplay={addressDisplay}
                        onChange={(lat, lng, address) => {
                          setLatitude(lat);
                          setLongitude(lng);
                          setAddressDisplay(address);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Tags (Max 10)</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tags.map(tag => (
                        <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium text-white flex items-center bg-[#534AB7]">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="ml-2 hover:text-red-300">×</button>
                        </span>
                      ))}
                    </div>
                    {tags.length < 10 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={tagsInput}
                          onChange={e => setTagsInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          maxLength={50}
                          placeholder="Type a tag and press Enter (e.g. running, coding, reading)"
                          className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all"
                          style={{ background: '#363634', border: '1px solid #424240' }}
                          onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                          onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                        />
                        <p className="text-xs mt-1 text-right text-[#5F5E5A]">{tagsInput.length}/50</p>
                      </div>
                    )}
                  </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium" style={{ color: '#B4B2A9' }}>Set a timer</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-semibold" style={{ color: isIndefinite ? '#AFA9EC' : '#5F5E5A' }}>Indefinite Group</span>
                    <div className="relative inline-block w-10 h-6 select-none transition duration-200 ease-in">
                      <input type="checkbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer z-10 transition-transform duration-200" style={{ transform: isIndefinite ? 'translateX(100%)' : 'translateX(0)', borderColor: isIndefinite ? '#534AB7' : '#424240' }} checked={isIndefinite} onChange={(e) => setIsIndefinite(e.target.checked)} />
                      <div className="toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200" style={{ background: isIndefinite ? '#534AB7' : '#363634' }}></div>
                    </div>
                  </label>
                </div>
                
                
                {!isIndefinite && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
                    {/* Years */}
                    <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Years</span>
                      <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                        <button
                          type="button"
                          onClick={() => setYears(prev => Math.max(0, prev - 1))}
                          disabled={years <= 0}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                          aria-label="Decrease years"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={years}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setYears(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-12 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setYears(prev => prev + 1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                          aria-label="Increase years"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Months */}
                    <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Months</span>
                      <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                        <button
                          type="button"
                          onClick={() => setMonths(prev => Math.max(0, prev - 1))}
                          disabled={months <= 0}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                          aria-label="Decrease months"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={months}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setMonths(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-12 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setMonths(prev => prev + 1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                          aria-label="Increase months"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Weeks */}
                    <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Weeks</span>
                      <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                        <button
                          type="button"
                          onClick={() => setWeeks(prev => Math.max(0, prev - 1))}
                          disabled={weeks <= 0}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                          aria-label="Decrease weeks"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={weeks}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setWeeks(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-12 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setWeeks(prev => prev + 1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                          aria-label="Increase weeks"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Days */}
                    <div className="p-3 rounded-xl border flex flex-col items-center" style={{ background: '#1a1a18', borderColor: '#363634' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B4B2A9' }}>Days</span>
                      <div className="flex items-center w-full justify-between rounded-lg border p-1" style={{ background: '#2C2C2A', borderColor: '#424240' }}>
                        <button
                          type="button"
                          onClick={() => setDays(prev => Math.max(0, prev - 1))}
                          disabled={days <= 0}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none disabled:opacity-20 disabled:cursor-not-allowed"
                          aria-label="Decrease days"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={days}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setDays(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-12 text-center font-bold text-white bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setDays(prev => prev + 1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-lg font-bold select-none"
                          aria-label="Increase days"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Notification Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#1a1a18', border: '1px solid #363634' }}>
                <div>
                  <p className="text-sm font-semibold text-white">Notification Emails</p>
                  <p className="text-xs mt-0.5" style={{ color: '#B4B2A9' }}>
                    Send daily habit reminders to group members
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(prev => !prev)}
                  className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                  style={{ background: notificationsEnabled ? '#534AB7' : '#363634' }}
                  aria-checked={notificationsEnabled}
                  role="switch"
                >
                  <span
                    className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    style={{ transform: notificationsEnabled ? 'translateX(20px)' : 'translateX(0px)' }}
                  />
                </button>
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
                {loading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Create Habit Group'}
              </button>

              <div className="p-4 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.2)' }}>
                <SparklesIcon className="w-4 h-4 text-[#AFA9EC] shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed" style={{ color: '#AFA9EC' }}>
                  After creating the group, you can add habits and start a time-bound competition with your friends.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupPage;
