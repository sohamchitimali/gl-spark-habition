import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGroup } from '../../api/groupApi';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

const JoinGroupPage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter an invite code.'); return; }
    setLoading(true);
    setError('');
    try {
      await joinGroup(code.trim().toUpperCase());
      navigate('/groups');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid or expired invite code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-fade-up">
          <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-[#B4B2A9] hover:text-white transition-colors mb-6">
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Join a Group</h1>
          <p className="text-sm mb-8" style={{ color: '#B4B2A9' }}>Enter the invite code shared by the group owner.</p>

          <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Invite code</label>
                <input
                  id="join-group-code"
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD1234"
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none text-center text-xl font-mono tracking-widest"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#D85A30'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>
              <button
                id="join-group-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: loading ? '#424240' : 'linear-gradient(135deg, #D85A30, #993C1D)' }}
              >
                {loading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Join Group'}
              </button>
            </form>

            <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid #363634' }}>
              <p className="text-sm mb-4" style={{ color: '#B4B2A9' }}>Don't have an invite code?</p>
              <button
                type="button"
                onClick={() => navigate('/search?tab=groups')}
                className="w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
                style={{ background: 'rgba(83,74,183,0.15)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.3)' }}
              >
                Search Public / Open Groups
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupPage;
