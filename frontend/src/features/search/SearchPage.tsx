import { useState, useEffect, useRef } from 'react';
import { searchGroups, type GroupResponse, requestToJoin, joinGroup } from '../../api/groupApi';
import { searchUsers, sendFriendRequest, type Profile, getProfile } from '../../api/authApi';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';
import { useAuth } from '../../auth/AuthContext';
import {
  ChatIcon,
  UserPlusIcon,
  UserIcon,
  LocationPinIcon,
  SparklesIcon,
  TargetIcon,
  FireIcon,
  CheckIcon,
  BlockedIcon,
  SearchIcon,
} from '../../components/icons';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const SearchPage: React.FC = () => {
  const { userId } = useAuth();
  const [searchParams] = useSearchParams();
  const initialMode = ['ALL', 'PEOPLE', 'GROUPS'].includes(searchParams.get('tab')?.toUpperCase() || '')
    ? (searchParams.get('tab')?.toUpperCase() as 'ALL' | 'PEOPLE' | 'GROUPS')
    : 'ALL';

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [searchMode, setSearchMode] = useState<'ALL' | 'PEOPLE' | 'GROUPS'>(initialMode);
  const [sortMode, setSortMode] = useState<string>('RELEVANCE');

  const [groupResults, setGroupResults] = useState<GroupResponse[]>([]);
  const [userResults, setUserResults] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(false);
  const [initialSearchDone, setInitialSearchDone] = useState(false);

  const [userTags, setUserTags] = useState<string[]>([]);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const [joinStatus, setJoinStatus] = useState<Record<number, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupResponse | null>(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    getProfile().then((res) => {
      setUserTags(res.data.tags || []);
      setUserLat(res.data.latitude);
      setUserLng(res.data.longitude);
    }).catch(() => { });
  }, []);

  const performSearch = async (currentQuery: string, currentSearchMode: string, currentSortMode: string) => {
    setLoading(true);
    try {
      if (currentSearchMode === 'ALL' || currentSearchMode === 'GROUPS') {
        const groupRes = await searchGroups(currentQuery, userTags, userLat, userLng, 20, currentSortMode);
        const nonJoinedGroups = groupRes.data.filter(group => {
          if (!userId) return true;
          return !group.memberIds || !group.memberIds.includes(userId);
        });
        setGroupResults(nonJoinedGroups);
        setJoinStatus(prev => {
          const updated = { ...prev };
          nonJoinedGroups.forEach(group => {
            if (group.currentUserRequested) {
              updated[group.id] = 'Requested';
            }
          });
          return updated;
        });
      } else {
        setGroupResults([]);
      }

      if (currentSearchMode === 'ALL' || currentSearchMode === 'PEOPLE') {
        const userRes = await searchUsers(currentQuery);
        setUserResults(userRes.data);
      } else {
        setUserResults([]);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
      setInitialSearchDone(true);
    }
  };

  useEffect(() => {
    performSearch(debouncedQuery, searchMode, sortMode);
  }, [debouncedQuery, searchMode, sortMode, userTags, userLat, userLng, userId]);

  const handleJoinClick = async (group: GroupResponse) => {
    if (group.visibility === 'PUBLIC') {
      try {
        await joinGroup(group.inviteCode);
        setJoinStatus(prev => ({ ...prev, [group.id]: 'Joined' }));
        showToast('Successfully joined group!');
        setTimeout(() => {
          setGroupResults(prev => prev.filter(g => g.id !== group.id));
        }, 800);
      } catch (err: any) {
        if (err.response?.status === 409) {
          setJoinStatus(prev => ({ ...prev, [group.id]: 'Already a member' }));
          setGroupResults(prev => prev.filter(g => g.id !== group.id));
        } else if (err.response?.data?.message === 'BLOCKED' || err.response?.data?.error === 'BLOCKED' || err.response?.data?.message?.includes('BLOCKED')) {
          setJoinStatus(prev => ({ ...prev, [group.id]: 'Blocked' }));
          showToast('You have been blocked from this group by its admins.');
        } else {
          showToast(err.response?.data?.message || 'Failed to join group');
        }
      }
    } else {
      setSelectedGroup(group);
      setShowModal(true);
    }
  };

  const submitJoinRequest = async () => {
    if (!selectedGroup) return;
    try {
      await requestToJoin(selectedGroup.id, initialMessage);
      setJoinStatus(prev => ({ ...prev, [selectedGroup.id]: 'Requested' }));
      setShowModal(false);
      setInitialMessage('');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setJoinStatus(prev => ({ ...prev, [selectedGroup.id]: 'Already a member' }));
      } else if (err.response?.data?.message === 'BLOCKED' || err.response?.data?.error === 'BLOCKED' || err.response?.data?.message?.includes('BLOCKED')) {
        showToast("You've been blocked from this group by its admins.");
        setJoinStatus(prev => ({ ...prev, [selectedGroup.id]: 'Blocked' }));
      } else {
        showToast(err.response?.data?.message || 'Failed to send request');
      }
      setShowModal(false);
    }
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

  const getInitials = (name?: string, username?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (username) return username.charAt(0).toUpperCase();
    return '?';
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: '#1a1a18' }}>
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl animate-fade-up" style={{ transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #993C1D, #D85A30)', border: '1px solid rgba(216,90,48,0.5)' }}>
          {toast}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in pb-12">
        <div className="mb-8 animate-fade-up flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Search</h1>
            <p style={{ color: '#B4B2A9' }} className="text-sm">
              Find and connect with people or habit groups.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b" style={{ borderColor: '#363634' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PEOPLE', label: 'People' },
            { id: 'GROUPS', label: 'Groups' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSearchMode(tab.id as any)}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${searchMode === tab.id ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
              style={{ borderColor: searchMode === tab.id ? '#7F77DD' : 'transparent' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative w-full flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full pl-11 pr-4 py-3 bg-[#1A1A18] border border-[#363634] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7F77DD] transition-all shadow-xl"
              />
            </div>

            {searchMode !== 'PEOPLE' && (
              <div className="relative flex-shrink-0 w-48">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="w-full h-full px-4 py-3 bg-[#1A1A18] border border-[#363634] rounded-xl text-sm text-white focus:outline-none focus:border-[#7F77DD] transition-all appearance-none cursor-pointer shadow-xl hover:bg-[#2C2C2A]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237F77DD'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em' }}
                >
                  <option value="RELEVANCE">Relevance (Default)</option>
                  <option value="MOST_CONSISTENT">Most Consistent</option>
                  <option value="CURRENT_STREAK">Longest Streak</option>
                  <option value="MOST_MEMBERS">Most Members</option>
                  {userLat != null && userLng != null ? (
                    <option value="NEAREST_TO_ME">Nearest to Me</option>
                  ) : (
                    <option value="NEAREST_TO_ME" disabled>Nearest to Me (Requires Location)</option>
                  )}
                  <option value="NEWEST">Newest</option>
                  <option value="OLDEST">Oldest</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {loading && !initialSearchDone ? (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Loading />
          </div>
        ) : (
          <div className="space-y-8">
            {/* People Results */}
            {(searchMode === 'ALL' || searchMode === 'PEOPLE') && (
              <div>
                {searchMode === 'ALL' && userResults.length > 0 && <h2 className="text-xl font-bold text-white mb-4">People</h2>}
                <div className="space-y-4">
                  {userResults.map(profile => (
                    <div key={profile.username} className="flex items-center justify-between p-3 rounded-xl hover:bg-[#363634] transition-colors" style={{ background: '#2C2C2A' }}>
                      <div className="flex flex-1 items-center gap-4 min-w-0 pr-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ background: profile.userTheme || '#534AB7' }}>
                          {getInitials(profile.name, profile.username)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-base truncate">{profile.name || profile.username}</h3>
                          <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
                          <div className="flex items-center gap-2 mt-1 hidden sm:flex">
                            {profile.addressDisplay && (
                              <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                                <LocationPinIcon className="w-3 h-3 text-gray-500 shrink-0" />
                                {profile.addressDisplay}
                              </span>
                            )}
                            {profile.tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => navigate(`/chats?user=${profile.username}`)} className="p-2.5 rounded-lg bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30 transition-colors" title="Message">
                          <ChatIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAddFriend(profile.username)} className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Add Friend">
                          <UserPlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {searchMode === 'PEOPLE' && userResults.length === 0 && initialSearchDone && (
                    <div className="text-center py-12 text-gray-400"><p>No people found.</p></div>
                  )}
                </div>
              </div>
            )}

            {/* Group Results */}
            {(searchMode === 'ALL' || searchMode === 'GROUPS') && (
              <div>
                {searchMode === 'ALL' && groupResults.length > 0 && <h2 className="text-xl font-bold text-white mb-4">Groups</h2>}
                <div className="space-y-4">
                  {groupResults.map(group => (
                    <div key={group.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-[#363634] transition-colors" style={{ background: '#2C2C2A' }}>
                      <div className="flex flex-1 items-center gap-4 min-w-0 pr-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
                          {group.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <h3 className="font-bold text-white text-lg truncate">{group.name}</h3>
                            {group.visibility === 'PUBLIC' && (
                              <span className="inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                                Public
                              </span>
                            )}
                            {group.visibility === 'OPEN' && (
                              <span className="inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                                Open
                              </span>
                            )}
                            {group.consistencyScore === null ? (
                              <span className="inline-flex items-center justify-center gap-1.5 h-5 px-2.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/20">
                                <SparklesIcon className="w-3 h-3" /> New
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5 h-5 px-2.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/20">
                                <TargetIcon className="w-3 h-3" /> {Math.round(group.consistencyScore || 0)}%
                              </span>
                            )}
                            <div className="inline-flex items-center justify-center gap-1.5 h-5 px-2.5 rounded-full border text-[10px] font-semibold bg-amber-400/15 text-amber-300 border-amber-400/20">
                              <UserIcon className="w-3 h-3" /> {group.memberCount || 1} Members
                            </div>
                          </div>
                          <p className="text-[#B4B2A9] text-sm line-clamp-1 mb-2">{group.description || "No description provided."}</p>

                          <div className="flex flex-col gap-2 mt-1">
                            {/* Dual Streaks */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                              <span className="inline-flex items-center gap-1">
                                Max Group Streak : <span className="font-bold text-white">{group.highestHabitGroupStreak || 0}</span>
                                <FireIcon className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                              <span className="inline-flex items-center gap-1">
                                Current Group Streak : <span className="font-bold text-white">{group.currentGlobalHabitGroupStreak || 0}</span>
                                <FireIcon className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                              {group.createdAt && (
                                <span>Created: <span className="font-bold text-white">{new Date(group.createdAt).toLocaleDateString()}</span></span>
                              )}
                            </div>
                            {/* Tags */}
                            {group.tags && group.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {group.tags.map(tag => (
                                  <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider" style={{ background: 'rgba(83,74,183,0.3)', border: '1px solid rgba(83,74,183,0.5)' }}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0">
                        <button
                          onClick={() => handleJoinClick(group)}
                          disabled={!!joinStatus[group.id]}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center gap-1 ${joinStatus[group.id] ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed border border-emerald-500/20' : 'bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30'}`}
                        >
                          {joinStatus[group.id] === 'Already a member' ? (
                            <span onClick={(e) => { e.stopPropagation(); navigate(`/chats?group=${group.id}`); }} className="cursor-pointer inline-flex items-center gap-1.5">
                              <ChatIcon className="w-4 h-4" /> Chat
                            </span>
                          ) : joinStatus[group.id] === 'Blocked' ? (
                            <span className="inline-flex items-center gap-1 text-red-400">
                              <BlockedIcon className="w-4 h-4" /> Blocked
                            </span>
                          ) : joinStatus[group.id] === 'Requested' ? (
                            <>{joinStatus[group.id]}</>
                          ) : joinStatus[group.id] ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckIcon className="w-4 h-4" /> {joinStatus[group.id]}
                            </span>
                          ) : (
                            <span>{group.visibility === 'PUBLIC' ? 'Join' : 'Request'}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  {searchMode === 'GROUPS' && groupResults.length === 0 && initialSearchDone && (
                    <div className="text-center py-12 text-gray-400"><p>No groups found.</p></div>
                  )}
                </div>
              </div>
            )}

            {searchMode === 'ALL' && userResults.length === 0 && groupResults.length === 0 && initialSearchDone && (
              <div className="text-center py-20 text-gray-400">
                <h3 className="text-xl font-medium text-white">No results found</h3>
                <p>Try adjusting your search terms.</p>
              </div>
            )}
          </div>
        )}

        {/* Join Request Modal */}
        {showModal && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1f2b] border border-gray-700/50 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
              <h3 className="text-2xl font-bold text-white mb-2">Join {selectedGroup.name}</h3>
              <p className="text-gray-400 text-sm mb-6">Introduce yourself! Share why you'd like to join this group.</p>
              <div className="space-y-4">
                <textarea value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} placeholder="Hi, I'm looking to build habits around..." className="w-full bg-[#131620] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none" />
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-gray-400 hover:text-white transition-colors">Cancel</button>
                  <button onClick={submitJoinRequest} disabled={!initialMessage.trim()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">Send Request</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage;
