import { useState, useEffect, useRef } from 'react';
import { searchUsers, sendFriendRequest, type Profile } from '../../api/authApi';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const DiscoverUsersPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const navigate = useNavigate();

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true);
      try {
        const res = await searchUsers(debouncedQuery);
        setResults(res.data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
        setInitialSearchDone(true);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const getInitials = (name?: string, username?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (username) return username.charAt(0).toUpperCase();
    return '?';
  };

  const handleAddFriend = async (username?: string) => {
    if (!username) return;
    try {
      await sendFriendRequest(username);
      showToast('Friend request sent!');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send friend request');
    }
  };

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: '#1a1a18' }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl animate-fade-up"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #993C1D, #D85A30)',
            border: '1px solid rgba(216,90,48,0.5)',
          }}
        >
          {toast}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold mb-2 text-white">Discover People</h1>
          <p className="text-sm mb-8" style={{ color: '#B4B2A9' }}>Find people around the world based on your shared habits and geographic proximity.</p>
          
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by username, name, or tags..."
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 outline-none shadow-lg transition-all"
              style={{ background: '#2C2C2A', border: '1px solid #363634' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
              onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {loading && !initialSearchDone ? (
          <Loading />
        ) : (
          <div className="flex flex-col gap-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {results.map(profile => (
              <div
                key={profile.username}
                className="flex items-center justify-between p-3 rounded-xl group transition-colors hover:bg-[#363634]"
                style={{ background: '#2C2C2A' }}
              >
                <div className="flex flex-1 items-center gap-4 min-w-0 pr-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-md shrink-0 text-white"
                    style={{ background: profile.preferredColor || '#534AB7' }}
                  >
                    {getInitials(profile.name, profile.username)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-base truncate">{profile.name || profile.username}</h3>
                    <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
                    
                    {/* Tags and Location */}
                    <div className="flex items-center gap-2 mt-1 hidden sm:flex">
                      {profile.addressDisplay && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {profile.addressDisplay}
                        </span>
                      )}
                      {profile.tags && profile.tags.length > 0 && (
                        <div className="flex gap-1 overflow-hidden">
                          {profile.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(83,74,183,0.15)', color: '#7F77DD' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => navigate(`/chats?user=${profile.username}`)}
                    className="p-2.5 rounded-lg bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30 transition-colors"
                    title="Message"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleAddFriend(profile.username)}
                    className="p-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                    title="Add Friend"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {results.length === 0 && initialSearchDone && (
              <div className="col-span-full py-12 text-center" style={{ color: '#B4B2A9' }}>
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-medium mb-2 text-white">No people found</h3>
                <p>Try adjusting your search terms or adding more tags to your profile.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DiscoverUsersPage;
