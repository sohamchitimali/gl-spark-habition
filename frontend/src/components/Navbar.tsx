import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getNotifications } from '../api/chatApi';
import habitionCoin from '../assets/habition_logo_green.svg';
import FriendsModal from './FriendsModal';

const Navbar = () => {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [pendingSentRequestsUpdates, setPendingSentRequestsUpdates] = useState(0);
  const [themeColor, setThemeColor] = useState<string>(() => localStorage.getItem('userThemeColor') || '#534AB7');
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    if (!userId) return;

    const fetchNotifs = async () => {
      try {
        const res = await getNotifications();
        setUnreadChats(res.data.unreadMessagesCount);
        setPendingRequests(res.data.pendingJoinRequestsCount);

        const { getMySentRequests } = await import('../api/groupApi');
        const sentRequestsRes = await getMySentRequests();
        const lastViewed = localStorage.getItem('lastViewedSentRequests') || '1970-01-01T00:00:00Z';
        const updates = sentRequestsRes.data.filter(r => new Date(r.updatedAt) > new Date(lastViewed) && r.status !== 'PENDING').length;
        setPendingSentRequestsUpdates(updates);

        // Also fetch pending friend requests
        const { getFriendships } = await import('../api/authApi');
        const friendsRes = await getFriendships();
        setPendingFriendRequests(friendsRes.data.filter((f: any) => f.status === 'PENDING' && !f.isRequester).length);

        const { getProfile } = await import('../api/authApi');
        const profileRes = await getProfile();
        if (profileRes.data) {
          if (profileRes.data.userTheme) {
            setThemeColor(profileRes.data.userTheme);
            localStorage.setItem('userThemeColor', profileRes.data.userTheme);
          }
          setUsername(profileRes.data.username || '');
        }
      } catch (err) { }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { 
      to: '/dashboard', 
      label: 'Dashboard',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    },
    { 
      to: '/heatmap', 
      label: 'Heatmap',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    { 
      to: '/groups', 
      label: 'Habit Groups', 
      badge: pendingRequests > 0,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    { 
      to: '/search', 
      label: 'Search',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    },
    { 
      to: '/chats', 
      label: 'Chats', 
      badge: unreadChats > 0,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 py-3 md:py-4"
        style={{ background: 'rgba(44,44,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #363634' }}>
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 no-underline shrink-0">
          <img src={habitionCoin} alt="Habition Logo" className="w-8 h-8" />
          <span className="text-white font-bold text-lg hidden lg:block">habition</span>
        </Link>

        {/* Nav links - Center */}
        <div className="flex items-center justify-center flex-1 gap-3 md:gap-4 px-2">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              title={link.label}
              className={`flex items-center justify-center p-2.5 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-all relative ${
                isActive(link.to) 
                  ? 'text-white bg-[#534AB7]/25' 
                  : 'text-[#B4B2A9] hover:bg-[#534AB7]/15 hover:text-white'
              }`}
            >
              <span className="md:hidden block">{link.icon}</span>
              <span className="hidden md:block">{link.label}</span>
              {link.badge && (
                <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              )}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Friends Panel Toggle */}
          <button
            onClick={() => setFriendsOpen(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all relative"
            title="Friends"
          >
            {pendingFriendRequests > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            )}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {/* Avatar / Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2C2C2A] relative"
              style={{
                background: themeColor,
                color: '#fff',
                outlineColor: themeColor
              }}
              title="Profile Menu"
            >
              {username ? username.charAt(0).toUpperCase() : 'U'}
              {pendingSentRequestsUpdates > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)] border-2 border-[#1a1a18]" />
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-50 animate-fade-up"
                style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{ color: '#F1EFE8' }}
                  onClick={() => setDropdownOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/groups/my-requests"
                  className="block px-4 py-2 text-sm transition-colors hover:bg-white/5 relative"
                  style={{ color: '#F1EFE8' }}
                  onClick={() => {
                    setDropdownOpen(false);
                    localStorage.setItem('lastViewedSentRequests', new Date().toISOString());
                    setPendingSentRequestsUpdates(0);
                  }}
                >
                  Sent Requests
                  {pendingSentRequestsUpdates > 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{ color: '#F0997B' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {friendsOpen && (
        <FriendsModal
          onClose={() => setFriendsOpen(false)}
          onUpdate={async () => {
            const { getFriendships } = await import('../api/authApi');
            const friendsRes = await getFriendships();
            setPendingFriendRequests(friendsRes.data.filter((f: any) => f.status === 'PENDING' && !f.isRequester).length);
          }}
        />
      )}
    </>
  );
};

export default Navbar;
