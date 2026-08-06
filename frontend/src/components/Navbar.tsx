import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useState, useEffect } from 'react';
import { getUserBalance } from '../api/coinApi';

const Navbar = () => {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [coins, setCoins] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      getUserBalance(userId).then(r => setCoins(r.data)).catch(() => {});
    }
  }, [userId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/groups', label: 'Groups' },
    { to: '/heatmap', label: 'Heatmap' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ background: 'rgba(44,44,42,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #363634' }}>
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2 no-underline">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #7F77DD, #D85A30)' }}>H</div>
        <span className="text-white font-bold text-lg hidden sm:block">habition</span>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-1">
        {navLinks.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color: isActive(link.to) ? '#7F77DD' : '#B4B2A9',
              background: isActive(link.to) ? 'rgba(83,74,183,0.15)' : 'transparent',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Coin badge */}
        {coins !== null && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
            🪙 {coins}
          </div>
        )}

        {/* Avatar / logout */}
        <button
          id="navbar-logout"
          onClick={handleLogout}
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all hover:opacity-80"
          style={{ background: 'linear-gradient(135deg, #534AB7, #3C3489)', color: '#fff' }}
          title="Logout"
        >
          {userId?.toString().slice(0, 1) ?? 'U'}
        </button>

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
              className="block px-4 py-3 rounded-lg text-sm font-medium mb-1"
              style={{ color: isActive(link.to) ? '#7F77DD' : '#B4B2A9' }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
