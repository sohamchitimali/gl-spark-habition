import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { checkUsername } from '../../api/authApi';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '', username: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const debouncedUsername = useDebounce(form.username, 500);

  useEffect(() => {
    if (!debouncedUsername) {
      setUsernameStatus('idle');
      return;
    }
    if (debouncedUsername.length < 5) {
      setUsernameStatus('idle');
      return;
    }
    
    const verifyUsername = async () => {
      setUsernameStatus('checking');
      try {
        const res = await checkUsername(debouncedUsername);
        setUsernameStatus(res.data ? 'available' : 'taken');
      } catch (err) {
        setUsernameStatus('idle');
      }
    };
    verifyUsername();
  }, [debouncedUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (form.username.length < 5) {
      setError('Username must be at least 5 characters.');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('Username is already taken.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, username: form.username });
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed. Email or username may already be in use.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #1a1a18 0%, #26215C 100%)' }}>
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #7F77DD, #D85A30)' }}>H</div>
            <span className="text-2xl font-bold text-white">habition</span>
          </div>
          <p style={{ color: '#B4B2A9' }} className="text-sm">Create your account to get started</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
          <h2 className="text-2xl font-bold text-white mb-6">Create account</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>Username</label>
              <input
                id="register-username"
                type="text"
                value={form.username}
                onChange={(e) => {
                  setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') });
                  if (e.target.value.length >= 5) setUsernameStatus('checking');
                  else setUsernameStatus('idle');
                }}
                placeholder="unique_username"
                required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                style={{ 
                  background: '#363634', 
                  border: `1px solid ${usernameStatus === 'available' ? '#4CAF50' : usernameStatus === 'taken' ? '#D85A30' : '#424240'}` 
                }}
                onFocus={(e) => { if (usernameStatus === 'idle') e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { if (usernameStatus === 'idle') e.target.style.borderColor = '#424240'; }}
              />
              <div className="mt-1 flex justify-between items-center text-xs">
                <span style={{ color: '#F0997B' }}>⚠️ Cannot be changed later</span>
                <span>
                  {usernameStatus === 'checking' && <span style={{ color: '#B4B2A9' }}>Checking...</span>}
                  {usernameStatus === 'available' && <span style={{ color: '#4CAF50' }}>Available!</span>}
                  {usernameStatus === 'taken' && <span style={{ color: '#D85A30' }}>Taken</span>}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Email</label>
              <input
                id="register-email"
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
                id="register-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 characters"
                required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                style={{ background: '#363634', border: '1px solid #424240' }}
                onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Confirm password</label>
              <input
                id="register-confirm"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                style={{ background: '#363634', border: '1px solid #424240' }}
                onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken'}
              className="w-full py-3 rounded-xl text-white font-medium transition-all disabled:opacity-50 mt-6"
              style={{ background: 'linear-gradient(135deg, #7F77DD, #534AB7)' }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#B4B2A9' }}>
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline transition-all hover:text-[#7F77DD]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
