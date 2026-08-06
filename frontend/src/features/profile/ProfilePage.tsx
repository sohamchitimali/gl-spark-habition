import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getProfile, updateProfile, type Profile } from '../../api/authApi';
import Navbar from '../../components/Navbar';

const GENRES = [
  'Productivity', 'Fitness & Health', 'Coding & Tech', 
  'Reading & Learning', 'Finance', 'Mindfulness'
];

const ProfilePage = () => {
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Profile>({
    name: '',
    preferredColor: '#534AB7', // default theme color
    location: '',
    genreOfInterest: '',
    bio: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (userId) {
      getProfile()
        .then(r => {
          if (r.data) {
            setForm({
              name: r.data.name || '',
              preferredColor: r.data.preferredColor || '#534AB7',
              location: r.data.location || '',
              genreOfInterest: r.data.genreOfInterest || '',
              bio: r.data.bio || ''
            });
          }
        })
        .catch(() => showToast('⚠️ Failed to load profile'))
        .finally(() => setLoading(false));
    }
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      showToast('✅ Profile saved successfully!');
    } catch (err) {
      showToast('⚠️ Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a18' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#534AB7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />

      {toast && (
        <div
          className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl animate-fade-up"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #26215C, #534AB7)',
            border: '1px solid rgba(127,119,221,0.5)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
          <p style={{ color: '#B4B2A9' }} className="text-sm">
            Set up your profile to connect with others and find the right habit groups.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-up delay-100">
          <div className="rounded-2xl p-6 space-y-5" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="What should we call you?"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                style={{ background: '#363634', border: '1px solid #424240' }}
                onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
              />
            </div>

            {/* Location & Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. New York, NY"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                  style={{ background: '#363634', border: '1px solid #424240' }}
                  onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Theme Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.preferredColor}
                    onChange={(e) => setForm({ ...form, preferredColor: e.target.value })}
                    className="w-12 h-12 rounded-xl border-none outline-none cursor-pointer p-0"
                    style={{ background: 'transparent' }}
                  />
                  <span className="text-sm font-mono" style={{ color: '#B4B2A9' }}>{form.preferredColor}</span>
                </div>
              </div>
            </div>

            {/* Genre of Interest */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Primary Interest</label>
              <select
                value={form.genreOfInterest}
                onChange={(e) => setForm({ ...form, genreOfInterest: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-white outline-none transition-all appearance-none cursor-pointer"
                style={{ background: '#363634', border: '1px solid #424240' }}
                onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
              >
                <option value="" disabled>Select a genre...</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell us a little about your goals..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all resize-none"
                style={{ background: '#363634', border: '1px solid #424240' }}
                onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 min-w-[120px]"
              style={{ background: saving ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
