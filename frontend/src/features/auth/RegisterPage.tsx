import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      await register({ email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed. Email may already be in use.';
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
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 mt-2"
              style={{ background: loading ? '#424240' : 'linear-gradient(135deg, #D85A30, #993C1D)' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: '#B4B2A9' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: '#7F77DD' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
