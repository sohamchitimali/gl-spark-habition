import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../../api/authApi';
import Loading from '../../components/Loading';
import habitionLogoGreen from '../../assets/habition_logo_green.svg';
import { ConsistencyCascade } from '../../components/ConsistencyCascade';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess('If an account exists with this email, a reset code has been sent.');
      setStep('reset');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Invalid or expired code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative" style={{ background: 'linear-gradient(135deg, #1a1a18 0%, #26215C 100%)' }}>
      <ConsistencyCascade />
      <div className="w-full max-w-md animate-fade-up relative z-10">
        <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src={habitionLogoGreen} alt="Habition Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-white tracking-wide">habition</span>
          </div>

          {step === 'email' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Forgot your password?</h2>
              <p style={{ color: '#B4B2A9' }} className="mb-6 text-sm">
                Enter your email address and we'll send you a code to reset your password.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>
                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                  style={{ background: loading ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
                >
                  {loading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Send Reset Code'}
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
              <p style={{ color: '#B4B2A9' }} className="mb-6 text-sm">
                Enter the 6-digit code sent to <span className="font-medium text-white">{email}</span> and your new password.
              </p>

              {success && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(83,74,183,0.15)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.3)' }}>
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Reset Code</label>
                  <input
                    id="reset-otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all text-center text-2xl tracking-[0.5em] font-mono"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>New Password</label>
                  <input
                    id="reset-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Confirm Password</label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>
                <button
                  id="reset-submit"
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                  style={{ background: (loading || otp.length !== 6) ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
                >
                  {loading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setSuccess(''); setOtp(''); }}
                  className="w-full py-2 text-sm font-medium transition-all hover:opacity-80"
                  style={{ color: '#7F77DD' }}
                >
                  ← Send a new code
                </button>
              </form>
            </>
          )}

          <p className="text-center mt-6 text-sm" style={{ color: '#B4B2A9' }}>
            Remember your password?{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: '#7F77DD' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
