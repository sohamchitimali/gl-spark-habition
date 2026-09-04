import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getProfile, updateProfile, changePassword, type Profile } from '../../api/authApi';
import axiosInstance from '../../api/axiosConfig';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';
import TimeWindowSlider from '../../components/TimeWindowSlider';
import { HexColorPicker } from 'react-colorful';
import LocationSelector from '../../components/LocationSelector';

const ProfilePage = () => {
  const { userId } = useAuth();
  const { confirm } = useConfirm();

  const [form, setForm] = useState<Profile>({
    username: '',
    name: '',
    userTheme: '#534AB7', // default theme color
    addressDisplay: '',
    latitude: undefined,
    longitude: undefined,
    bio: '',
    timeZone: '',
    autoTimezone: false,
    tags: [],
    locationVisibility: 'PUBLIC'
  });
  
  const [activeTab, setActiveTab] = useState<'basic' | 'search_preferences' | 'notifications'>('basic');
  const [tagInput, setTagInput] = useState('');

  // Notification Settings state
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    windowStart: '09:00',
    windowEnd: '22:00',
    frequency: 2,
  });
  const [testLoading, setTestLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Password Change State
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const showToast = (msg: string) => {
    const cleanMsg = msg.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    setToast(cleanMsg);
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
              userTheme: r.data.userTheme || '#534AB7',
              addressDisplay: r.data.addressDisplay || '',
              latitude: r.data.latitude,
              longitude: r.data.longitude,
              bio: r.data.bio || '',
              timeZone: r.data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              autoTimezone: r.data.autoTimezone || false,
              tags: r.data.tags || [],
              locationVisibility: r.data.locationVisibility || 'PUBLIC'
            });
          }
        })
        .catch(() => showToast('Failed to load profile'))
        .finally(() => setLoading(false));

      // Load notification settings
      axiosInstance.get('/notifications/settings', { headers: { 'X-User-Id': String(userId) } })
        .then(r => {
          if (r.data?.enabled) {
            setNotifEnabled(true);
            setNotifSettings({
              timezone: r.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              windowStart: r.data.windowStart || '09:00',
              windowEnd: r.data.windowEnd || '22:00',
              frequency: r.data.frequency || 2,
            });
          }
        })
        .catch(() => {}); // Silently ignore — user just hasn't set up notifications yet
    }
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      showToast('Profile saved successfully!');
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('Username is already taken!');
      } else {
        showToast('Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (pwdForm.newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      await changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      setPwdSuccess('Password changed successfully!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwdError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to change password. Please check your current password.');
    } finally {
      setPwdLoading(false);
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

      <div className="max-w-3xl mx-auto px-4 py-8">
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
            { id: 'search_preferences', label: 'Search Preferences' },
            { id: 'notifications', label: 'Notifications' },
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
                    disabled
                    className="w-full px-4 py-3 rounded-xl text-gray-500 bg-[#222220] outline-none transition-all cursor-not-allowed"
                    style={{ border: '1px solid #363634' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Your username cannot be changed.</p>
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

                <div className="flex items-start gap-8">
                  {/* Theme Color */}
                  <div className="shrink-0">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Theme Color</label>
                    <div className="relative">
                      <div className="flex items-center gap-3 h-12">
                        <button
                          type="button"
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="w-12 h-12 rounded-xl transition-transform hover:scale-105 active:scale-95"
                          style={{ background: form.userTheme, border: '2px solid #424240' }}
                        />
                        <span className="text-sm font-mono" style={{ color: '#B4B2A9' }}>{form.userTheme}</span>
                      </div>
                      
                      {showColorPicker && (
                        <div className="absolute top-14 left-0 z-50 p-3 rounded-2xl shadow-xl animate-fade-up" style={{ background: '#363634', border: '1px solid #424240' }}>
                          <div className="mb-3 flex justify-between items-center">
                            <span className="text-xs font-semibold text-white">Pick a color</span>
                            <button type="button" onClick={() => setShowColorPicker(false)} className="text-gray-400 hover:text-white">✕</button>
                          </div>
                          <HexColorPicker color={form.userTheme} onChange={(c) => setForm({ ...form, userTheme: c })} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timezone (Read-only) */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Your Timezone</label>
                    <div className="flex items-center h-12 px-4 rounded-xl cursor-default" style={{ background: '#363634', border: '1px solid #424240' }}>
                      <span className="text-sm text-gray-400">{form.timeZone}</span>
                    </div>
                    <p className="text-xs mt-1 text-gray-500">Automatically synced with your device</p>
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
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all resize-none"
                    style={{ background: '#363634', border: '1px solid #424240' }}
                    onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                  />
                  <p className="text-xs mt-1 text-right text-[#5F5E5A]">{(form.bio || "").length}/1000</p>
                </div>



                {/* Change Password */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                  {pwdSuccess && (
                    <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(83,74,183,0.15)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.3)' }}>
                      {pwdSuccess}
                    </div>
                  )}
                  {pwdError && (
                    <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(216,90,48,0.15)', color: '#F0997B', border: '1px solid rgba(216,90,48,0.3)' }}>
                      {pwdError}
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Current Password</label>
                      <input
                        type="password"
                        name="currentPassword"
                        autoComplete="current-password"
                        value={pwdForm.currentPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                        style={{ background: '#363634', border: '1px solid #424240' }}
                        onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        autoComplete="new-password"
                        value={pwdForm.newPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                        style={{ background: '#363634', border: '1px solid #424240' }}
                        onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Confirm New Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        value={pwdForm.confirmPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                        style={{ background: '#363634', border: '1px solid #424240' }}
                        onFocus={(e) => { e.target.style.borderColor = '#534AB7'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#424240'; }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={pwdLoading || !pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword}
                      className="px-6 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{ background: '#534AB7', color: 'white' }}
                    >
                      {pwdLoading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Change Password'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'search_preferences' && (
              <>
                <div className="p-4 rounded-xl text-sm mb-6" style={{ background: 'rgba(127,119,221,0.1)', border: '1px solid rgba(127,119,221,0.3)', color: '#D0CDED' }}>
                  <strong>Search Settings:</strong> These fields are completely optional. They help personalize your search experience and find local or interest-based groups.
                </div>

                {/* Location */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Your Location</label>
                  <p className="text-xs mb-3 text-gray-500">Helps us find local groups near you in "Nearest to Me" search.</p>
                  <LocationSelector 
                    latitude={form.latitude || null} 
                    longitude={form.longitude || null} 
                    addressDisplay={form.addressDisplay || ''} 
                    onChange={(lat, lng, address) => setForm({ ...form, latitude: lat || undefined, longitude: lng || undefined, addressDisplay: address })}
                  />
                </div>

                <hr style={{ borderColor: '#363634', margin: '24px 0' }} />

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>Interests & Tags (Max 10)</label>
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

                    <div className="flex-1 relative min-w-[150px]">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder={(!form.tags || form.tags.length === 0) ? "Type a tag and press Enter..." : "Add another tag..."}
                        maxLength={50}
                        className="w-full bg-transparent border-none outline-none text-sm py-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = tagInput.trim().toLowerCase();
                            if (val && !(form.tags || []).includes(val) && (form.tags || []).length < 10 && val.length <= 50) {
                              setForm({ ...form, tags: [...(form.tags || []), val] });
                              setTagInput('');
                            }
                          }
                        }}
                      />
                      {tagInput.length > 0 && (
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                          {tagInput.length}/50
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'notifications' && (
              <>
                <div className="p-4 rounded-xl text-sm mb-6" style={{ background: 'rgba(127,119,221,0.1)', border: '1px solid rgba(127,119,221,0.3)', color: '#D0CDED' }}>
                  <strong>Daily Reminders:</strong> Habition will send you a personalised email each day about your incomplete habits. These emails are only sent when you have something left to do.
                </div>

                {/* Enable toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl mb-4" style={{ background: '#1a1a18', border: '1px solid #363634' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">Enable Notification Emails</p>
                    <p className="text-xs mt-0.5" style={{ color: '#B4B2A9' }}>Receive daily habit reminders in your inbox</p>
                  </div>
                  <button
                    type="button"
                    disabled={notifLoading}
                    onClick={async () => {
                      if (notifEnabled) {
                        const confirmed = await confirm(
                          'Are you sure you want to disable notifications? Your notification schedule settings will be permanently deleted.',
                          { isDestructive: true, confirmText: 'Disable & Delete' }
                        );
                        
                        if (!confirmed) return;

                        setNotifLoading(true);
                        try {
                          await axiosInstance.delete('/notifications/settings', { headers: { 'X-User-Id': String(userId) } });
                          showToast('Notification emails disabled');
                          setNotifEnabled(false);
                        } catch {
                          showToast('Failed to disable notifications');
                        } finally {
                          setNotifLoading(false);
                        }
                      } else {
                        setNotifEnabled(true);
                      }
                    }}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: notifEnabled ? '#534AB7' : '#363634' }}
                    role="switch"
                    aria-checked={notifEnabled}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      style={{ transform: notifEnabled ? 'translateX(20px)' : 'translateX(0px)' }}
                    />
                  </button>
                </div>

                {notifEnabled && (
                  <div className="space-y-4">
                    <TimeWindowSlider
                      startTime={notifSettings.windowStart}
                      endTime={notifSettings.windowEnd}
                      onChange={(start, end) => setNotifSettings(s => ({ ...s, windowStart: start, windowEnd: end }))}
                      minWindowHours={6}
                      frequency={notifSettings.frequency}
                    />
                    
                    {/* Frequency */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#B4B2A9' }}>
                        Reminders per Day: <span className="text-white font-bold">{notifSettings.frequency}</span>
                        <span className="block text-xs font-normal text-gray-500 mt-1">
                          You will receive {notifSettings.frequency} evenly distributed notifications during your active window.
                        </span>
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={6}
                        value={notifSettings.frequency}
                        onChange={e => setNotifSettings(s => ({ ...s, frequency: Number(e.target.value) }))}
                        className="w-full accent-[#534AB7]"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>2 (min)</span>
                        <span>6 (max)</span>
                      </div>
                    </div>

                    {/* Save Notification Settings */}
                    <div className="flex gap-4">
                      <button
                        type="button"
                        disabled={notifLoading}
                        onClick={async () => {
                          setNotifLoading(true);
                          try {
                            const headers = { 'X-User-Id': String(userId) };
                            const body = { ...notifSettings, timezone: form.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone };
                            
                            try {
                              await axiosInstance.put('/notifications/settings', body, { headers });
                              showToast('Notification settings saved!');
                            } catch (putErr: any) {
                              if (putErr.response?.status === 400) {
                                throw putErr; 
                              }
                              await axiosInstance.post('/notifications/settings', body, { headers });
                              showToast('Notification settings saved!');
                            }
                          } catch (err: any) {
                             if (err.response?.data?.error) {
                               showToast(err.response.data.error);
                             } else {
                               showToast('Failed to save notification settings');
                             }
                          } finally {
                            setNotifLoading(false);
                          }
                        }}
                        className="flex-1 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
                        style={{ background: notifLoading ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
                      >
                        {notifLoading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Save Notification Settings'}
                      </button>

                      <button
                        type="button"
                        disabled={testLoading}
                        onClick={async () => {
                          setTestLoading(true);
                          try {
                            await axiosInstance.post('/notifications/settings/test', {}, { headers: { 'X-User-Id': String(userId) } });
                            showToast('Test email triggered! Check your inbox shortly.');
                          } catch (err: any) {
                            if (err.response?.data?.error) {
                              showToast(err.response.data.error);
                            } else {
                              showToast('Failed to trigger test email.');
                            }
                          } finally {
                            setTestLoading(false);
                          }
                        }}
                        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:bg-[#363634] border border-[#424240] flex items-center justify-center gap-2"
                        style={{ background: testLoading ? '#424240' : '#2C2C2A' }}
                        title="Send a test notification immediately"
                      >
                        {testLoading ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Send Test Email'}
                      </button>
                    </div>
                  </div>
                )}


              </>
            )}

          </div>

          {activeTab !== 'notifications' && (
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving || (form.bio || '').length > 1000}
                className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 min-w-[120px]"
                style={{ background: saving ? '#424240' : 'linear-gradient(135deg, #534AB7, #3C3489)' }}
              >
                {saving ? <Loading size={5} padding="0" idleColor="transparent" activeColor="#FFF" /> : 'Save Profile'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
