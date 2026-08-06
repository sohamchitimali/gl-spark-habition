import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import habitionCoin from '../../assets/habition_coin.png';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1a1a18 0%, #26215C 100%)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16">
        <div className="animate-fade-up">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #7F77DD, #D85A30)' }}>H</div>
            <span className="text-2xl font-bold text-white">habition</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Build habits.<br />
            <span style={{ color: '#F0997B' }}>Beat your squad.</span>
          </h1>
          <p style={{ color: '#B4B2A9' }} className="text-lg leading-relaxed">
            Track daily habits, earn coins for consistency, and compete with friends in time-bound challenges.
          </p>
          <div className="mt-10 flex gap-4">
            {['🔥 Streaks', '🪙 Coins', '🏆 Leaderboards'].map((badge) => (
              <span key={badge} className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
                style={{ background: 'rgba(83,74,183,0.3)', color: '#AFA9EC', border: '1px solid rgba(127,119,221,0.3)' }}>
                {badge === '🪙 Coins' ? <img src={habitionCoin} alt="coins" className="w-4 h-4" /> : null}
                {badge === '🪙 Coins' ? 'Coins' : badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up delay-100">
          <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p style={{ color: '#B4B2A9' }} className="mb-8 text-sm">Sign in to your account</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                style={{ background: loading ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm" style={{ color: '#B4B2A9' }}>
              Don't have an account?{' '}
              <Link to="/register" className="font-medium hover:underline" style={{ color: '#7F77DD' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
