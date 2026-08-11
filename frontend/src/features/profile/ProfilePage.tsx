import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getProfile, updateProfile, type Profile } from '../../api/authApi';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';
import { HexColorPicker } from 'react-colorful';
import LocationSelector from '../../components/LocationSelector';

const ProfilePage = () => {
  const { userId } = useAuth();

  const [form, setForm] = useState<Profile>({
    username: '',
    name: '',
    preferredColor: '#534AB7', // default theme color
    addressDisplay: '',
    latitude: undefined,
    longitude: undefined,
    bio: '',
    timeZone: '',
    tags: [],
    locationVisibility: 'PUBLIC'
  });
  
  const [activeTab, setActiveTab] = useState<'basic' | 'discovery' | 'location'>('basic');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
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
              username: r.data.username || '',
              name: r.data.name || '',
              preferredColor: r.data.preferredColor || '#534AB7',
              addressDisplay: r.data.addressDisplay || '',
              latitude: r.data.latitude,
              longitude: r.data.longitude,
              bio: r.data.bio || '',
              timeZone: r.data.timeZone || '',
              tags: r.data.tags || [],
              locationVisibility: r.data.locationVisibility || 'PUBLIC'
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
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('⚠️ Username is already taken!');
      } else {
        showToast('⚠️ Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a18' }}>
        <Loading size={32} />
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

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b" style={{ borderColor: '#363634' }}>
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'discovery', label: 'Discovery' },
            { id: 'location', label: 'Location' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
              style={{ borderColor: activeTab === tab.id ? '#7F77DD' : 'transparent' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-up delay-100">
          <div className="rounded-2xl p-6 space-y-5" style={{ background: '#2C2C2A', border: '1px solid #363634' }}>
            
            {activeTab === 'basic' && (
              <>
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="unique_username"
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Used to uniquely identify you on the platform.</p>
                </div>

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

                {/* Theme Color */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Theme Color</label>
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="w-12 h-12 rounded-xl transition-transform hover:scale-105 active:scale-95"
                        style={{ background: form.preferredColor, border: '2px solid #424240' }}
                      />
                      <span className="text-sm font-mono" style={{ color: '#B4B2A9' }}>{form.preferredColor}</span>
                    </div>
                    
                    {showColorPicker && (
                      <div className="absolute top-14 left-0 z-50 p-3 rounded-2xl shadow-xl animate-fade-up" style={{ background: '#363634', border: '1px solid #424240' }}>
                        <div className="mb-3 flex justify-between items-center">
                          <span className="text-xs font-semibold text-white">Pick a color</span>
                          <button type="button" onClick={() => setShowColorPicker(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <HexColorPicker color={form.preferredColor} onChange={(c) => setForm({ ...form, preferredColor: c })} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Tell us a little about yourself..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all resize-none"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>
              </>
            )}

            {activeTab === 'discovery' && (
              <>
                <div className="p-4 rounded-xl text-sm mb-4" style={{ background: 'rgba(127,119,221,0.1)', border: '1px solid rgba(127,119,221,0.3)', color: '#D0CDED' }}>
                  These fields help the recommendation engine find public groups that match your lifestyle. All fields are completely optional!
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Timezone</label>
                  <input
                    type="text"
                    value={form.timeZone}
                    onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
                    placeholder="e.g. PST, EST, GMT+1"
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Interests & Tags</label>
                  <p className="text-xs mb-3 text-gray-500">Add topics you are interested in (e.g. Fitness, Coding, Reading). Press Enter or Comma to add.</p>
                  
                  <div className="w-full p-2 rounded-xl text-white transition-all min-h-[50px] flex flex-wrap gap-2 items-center"
                       style={{ background: '#363634', border: '1px solid #424240' }}>
                    
                    {form.tags && form.tags.map((tag, i) => (
                      <div key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[#534AB7] text-white">
                        <span>{tag}</span>
                        <button 
                          type="button" 
                          onClick={() => setForm({ ...form, tags: form.tags!.filter((_, idx) => idx !== i) })}
                          className="hover:text-red-300 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <input
                      type="text"
                      placeholder={(!form.tags || form.tags.length === 0) ? "Type a tag and press Enter..." : "Add another tag..."}
                      className="flex-1 bg-transparent border-none outline-none text-sm min-w-[150px] py-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !(form.tags || []).includes(val)) {
                            setForm({ ...form, tags: [...(form.tags || []), val] });
                          }
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'location' && (
              <>
                <div className="p-4 rounded-xl text-sm mb-4" style={{ background: 'rgba(127,119,221,0.1)', border: '1px solid rgba(127,119,221,0.3)', color: '#D0CDED' }}>
                  Setting your location helps us find local groups near you (like running clubs or local study groups).
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Your Location</label>
                  <LocationSelector 
                    latitude={form.latitude || null} 
                    longitude={form.longitude || null} 
                    addressDisplay={form.addressDisplay || ''} 
                    onChange={(lat, lng, address) => setForm({ ...form, latitude: lat || undefined, longitude: lng || undefined, addressDisplay: address })}
                  />
                </div>
              </>
            )}

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
