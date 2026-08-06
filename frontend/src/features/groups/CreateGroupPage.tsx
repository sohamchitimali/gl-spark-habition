import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../../api/groupApi';
import Navbar from '../../components/Navbar';

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('7 Days');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await createGroup(name.trim(), description.trim(), duration);
      navigate('/groups');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="animate-fade-up">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-6 text-sm transition-all hover:opacity-70"
            style={{ color: '#B4B2A9', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Create a Group</h1>
          <p className="text-sm mb-8" style={{ color: '#B4B2A9' }}>
            A unique invite code will be auto-generated for you to share with friends.
          </p>

          <div className="rounded-2xl p-8" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Group name</label>
                <input
                  id="create-group-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Morning Warriors"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
                <p className="text-xs mt-1 text-right" style={{ color: '#5F5E5A' }}>{name.length}/50</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all resize-none"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Duration</label>
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all appearance-none cursor-pointer"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                >
                  <option value="7 Days">7 Days</option>
                  <option value="2 Weeks">2 Weeks</option>
                  <option value="1 Month">1 Month</option>
                  <option value="Indefinite">Indefinite</option>
                </select>
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.2)' }}>
                <p className="text-xs" style={{ color: '#AFA9EC' }}>
                  ✨ After creating the group, you can add habits and start a time-bound competition with your friends.
                </p>
              </div>

              <button
                id="create-group-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: loading ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
              >
                {loading ? 'Creating…' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupPage;
