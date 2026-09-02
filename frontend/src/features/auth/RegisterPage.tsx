import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { checkUsername } from '../../api/authApi';
import habitionLogoGreen from '../../assets/habition_logo_green.svg';
import Loading from '../../components/Loading';
import { ConsistencyCascade } from '../../components/ConsistencyCascade';

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
  const [emailStatus, setEmailStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const debouncedUsername = useDebounce(form.username, 500);

  // Generate a random session ID once when the component mounts
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!debouncedUsername) {
      setUsernameStatus('idle');
      return;
    }
    if (debouncedUsername.length < 5) {
      setUsernameStatus('idle');
      return;
    }

    let active = true;
    const verifyUsername = async () => {
      setUsernameStatus('checking');
      try {
        const res = await checkUsername(debouncedUsername, sessionId);
        if (active) setUsernameStatus(res.data ? 'available' : 'taken');
      } catch (err) {
        console.error("Username check failed:", err);
        if (active) setUsernameStatus('idle');
      }
    };
    verifyUsername();
    return () => { active = false; };
  }, [debouncedUsername, sessionId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (form.username.length < 5) {
      setError('Username must be at least 5 characters.');
      return;
    }
    if (usernameStatus !== 'available') {
      setError('Please choose an available username.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (emailStatus === 'invalid') {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, username: form.username });
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative"
      style={{ background: 'linear-gradient(135deg, #1a1a18 0%, #26215C 100%)' }}>
      <ConsistencyCascade />
      <div className="w-full max-w-md animate-fade-up relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src={habitionLogoGreen} alt="Habition Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-white tracking-wide">habition</span>
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
                <label className="block text-sm font-medium mb-1" style={{ color: '#B4B2A9' }}>Email</label>
                <input
                  id="register-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, email: value });
                    if (!value) {
                      setEmailStatus('idle');
                    } else {
                      const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                      if (value.endsWith('.colm') || value.endsWith('.con') || value.endsWith('.cmo')) {
                        setEmailStatus('invalid');
                      } else {
                        setEmailStatus(regex.test(value) ? 'valid' : 'invalid');
                      }
                    }
                  }}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                  style={{
                    background: '#363634',
                    border: `1px solid ${emailStatus === 'valid' ? '#4CAF50' : emailStatus === 'invalid' ? '#D85A30' : '#424240'}`
                  }}
                  onFocus={(e) => { if (emailStatus === 'idle') e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { if (emailStatus === 'idle') e.target.style.borderColor = '#424240'; }}
                />
                <div className="mt-1 flex justify-end items-center text-xs min-h-[16px]">
                  <span>
                    {emailStatus === 'valid' && <span style={{ color: '#4CAF50' }}>Valid email</span>}
                    {emailStatus === 'invalid' && <span style={{ color: '#D85A30' }}>Invalid email address</span>}
                  </span>
                </div>
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
                {loading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Create Account'}
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
