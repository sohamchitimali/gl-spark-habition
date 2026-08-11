import { useState, useEffect } from 'react';
import { searchGroups, type GroupResponse, requestToJoin, joinGroup } from '../../api/groupApi';
import { getProfile } from '../../api/authApi';
import { useNavigate, Link } from 'react-router-dom';
import Loading from '../../components/Loading';
import Navbar from '../../components/Navbar';

const DiscoverGroupsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [joinStatus, setJoinStatus] = useState<Record<number, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupResponse | null>(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load user profile to get tags and location for personalized search
    getProfile().then((res) => {
      const fetchedTags = res.data.tags || [];
      if (fetchedTags.length === 0) {
        setProfileIncomplete(true);
      } else {
        setUserTags(fetchedTags);
        setUserLat(res.data.latitude);
        setUserLng(res.data.longitude);
        // Trigger initial search empty query for general recommendations
        handleSearch('', fetchedTags, res.data.latitude, res.data.longitude);
      }
    }).catch(() => {
      setProfileIncomplete(true);
    });
  }, []);

  const handleSearch = async (
    q: string = query,
    tags: string[] = userTags,
    lat?: number,
    lng?: number
  ) => {
    setLoading(true);
    try {
      const res = await searchGroups(q, tags, lat ?? userLat, lng ?? userLng);
      setResults(res.data);
      setJoinStatus(prev => {
        const updated = { ...prev };
        res.data.forEach(group => {
          if (group.currentUserRequested) {
            updated[group.id] = 'Requested';
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClick = async (group: GroupResponse) => {
    if (group.visibility === 'PUBLIC') {
      try {
        await joinGroup(group.inviteCode);
        setJoinStatus(prev => ({ ...prev, [group.id]: 'Joined' }));
      } catch (err: any) {
        if (err.response?.status === 409) {
          setJoinStatus(prev => ({ ...prev, [group.id]: 'Already a member' }));
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
      }
      setShowModal(false);
    }
  };

  if (profileIncomplete) {
    return (
      <div className="min-h-screen" style={{ background: '#1a1a18' }}>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12 mt-12 px-4">
            <div className="text-center bg-[#2C2C2A] p-12 rounded-3xl border border-[#363634] max-w-2xl mx-auto shadow-2xl">
              <div className="text-6xl mb-6">👤</div>
              <h2 className="text-3xl font-bold text-white mb-4">Complete Your Profile</h2>
              <p className="text-[#B4B2A9] mb-8 text-lg">
                To discover and join groups, we need to know your interests! Please add some tags to your profile so we can personalize your recommendations.
              </p>
              <button
                onClick={() => navigate('/profile')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-500/25 text-lg"
              >
                Update Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fade-in pb-12">
        <div className="mb-6 flex justify-between items-center">
          <Link to="/groups" className="inline-flex items-center text-[#B4B2A9] hover:text-white transition-colors">
            <span className="mr-2">←</span> Back to Groups
          </Link>
          <Link 
            to="/groups/my-requests"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center shadow-lg"
          >
            <span className="mr-2">📨</span> My Sent Requests
          </Link>
        </div>
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-white">
          Discover Groups
        </h1>
        <p className="text-sm text-[#B4B2A9]">
          Find your tribe. These recommendations are personalized based on your tags, interests, and location.
        </p>
      </div>

      <div className="relative w-full mb-8">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-lg">
          🔍
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by habits, goals, or keywords..."
          className="w-full pl-12 pr-4 py-3 bg-[#1E2330] border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-xl"
        />
        <button
          onClick={() => handleSearch()}
          className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/25"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loading size={16} />
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-3 rounded-xl group transition-colors hover:bg-[#363634]"
              style={{ background: '#2C2C2A' }}
            >
              <div className="flex flex-1 items-center gap-4 min-w-0 pr-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-md shrink-0 text-white"
                     style={{ background: 'linear-gradient(135deg, #534AB7, #D85A30)' }}>
                  {group.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-bold text-white text-base truncate">{group.name}</h3>
                    {group.visibility === 'PUBLIC' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                        PUBLIC
                      </span>
                    )}
                  </div>
                  <p className="text-[#B4B2A9] text-xs line-clamp-1 mb-1">
                    {group.description || "No description provided."}
                  </p>
                  <div className="flex items-center space-x-3 mt-1 hidden sm:flex">
                    <div className="flex items-center text-[11px] text-gray-400">
                      <span className="mr-1 text-indigo-400">👥</span>
                      {group.memberIds?.length || 1} members
                    </div>
                    <div className="flex items-center text-[11px] text-gray-400">
                      <span className="mr-1 text-emerald-400">🎯</span>
                      {group.habits?.length || 0} habits
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleJoinClick(group)}
                  disabled={!!joinStatus[group.id]}
                  className={`px-4 py-2 rounded-lg font-bold transition-all text-xs flex items-center gap-1 ${joinStatus[group.id]
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 cursor-not-allowed'
                      : 'bg-[#534AB7]/20 text-[#7F77DD] hover:bg-[#534AB7]/30'
                    }`}
                >
                  {joinStatus[group.id] === 'Already a member' ? (
                    <span onClick={(e) => { e.stopPropagation(); navigate(`/chats?group=${group.id}`); }} className="cursor-pointer">💬 Chat</span>
                  ) : joinStatus[group.id] ? (
                    <>
                      <span>✔️</span>
                      <span>{joinStatus[group.id]}</span>
                    </>
                  ) : (
                    <span>{group.visibility === 'PUBLIC' ? 'Join' : 'Request'}</span>
                  )}
                </button>
              </div>
            </div>
          ))}
          {results.length === 0 && !loading && (
            <div className="col-span-full text-center py-20 text-gray-400">
              <div className="bg-gray-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                🔍
              </div>
              <p className="text-xl font-medium">No groups found</p>
              <p className="text-gray-500 mt-2">Try adjusting your search query</p>
            </div>
          )}
        </div>
      )}

      {/* Join Request Modal */}
      {showModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1f2b] border border-gray-700/50 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
            <h3 className="text-2xl font-bold text-white mb-2">Join {selectedGroup.name}</h3>
            <p className="text-gray-400 text-sm mb-6">
              Introduce yourself! Share why you'd like to join this group.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Hi, I'm looking to build habits around..."
                  className="w-full bg-[#131620] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-32 resize-none"
                />
              </div>

              <div className="flex space-x-3 mt-8">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitJoinRequest}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 flex justify-center items-center"
                >
                  <span className="mr-2">💬</span>
                  Send Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DiscoverGroupsPage;
