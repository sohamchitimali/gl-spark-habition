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

  useEffect(() => {
    if (!userId) return;

    const fetchNotifs = async () => {
      try {
        const res = await getNotifications();
        setUnreadChats(res.data.unreadMessagesCount);
        setPendingRequests(res.data.pendingJoinRequestsCount);
        
        // Also fetch pending friend requests
        const { getFriendships } = await import('../api/authApi');
        const friendsRes = await getFriendships();
        setPendingFriendRequests(friendsRes.data.filter((f: any) => f.status === 'PENDING' && !f.isRequester).length);
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
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/groups', label: 'Habit Groups', badge: pendingRequests > 0 },
    { to: '/heatmap', label: 'Heatmap' },
    { to: '/chats', label: 'Chats', badge: unreadChats > 0 },
    { to: '/people', label: 'People' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(44,44,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #363634' }}>
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 no-underline">
          <img src={habitionCoin} alt="Habition Logo" className="w-8 h-8" />
          <span className="text-white font-bold text-lg hidden sm:block">habition</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all relative"
              style={{
                color: isActive(link.to) ? '#7F77DD' : '#B4B2A9',
                background: isActive(link.to) ? 'rgba(83,74,183,0.15)' : 'transparent',
              }}
            >
              {link.label}
              {link.badge && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
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
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#534AB7] focus:ring-offset-[#2C2C2A]"
              style={{ background: 'linear-gradient(135deg, #534AB7, #3C3489)', color: '#fff' }}
              title="Profile Menu"
            >
              {userId?.toString().slice(0, 1) ?? 'U'}
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

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: '#B4B2A9' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 py-3 px-4 md:hidden"
            style={{ background: '#2C2C2A', borderBottom: '1px solid #363634' }}>
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="block px-4 py-3 rounded-lg text-sm font-medium mb-1 relative"
                style={{ color: isActive(link.to) ? '#7F77DD' : '#B4B2A9' }}
                onClick={() => setMenuOpen(false)}
              >
                <div className="flex justify-between items-center">
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
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
