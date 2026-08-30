import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { login as apiLogin, register as apiRegister, type AuthRequest, type AuthResponse } from '../api/authApi';

interface AuthContextType {
  userId: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthRequest) => Promise<void>;
  register: (data: AuthRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUserId && storedToken) {
      if (!userId) setUserId(Number(storedUserId));
      
      // Auto-timezone check and caching profile
      import('../api/authApi').then(({ getProfile, updateProfile }) => {
        getProfile().then(res => {
          if (res.data) {
            localStorage.setItem('profile', JSON.stringify(res.data));
            const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            // Always sync timezone on load
            if (res.data.timeZone !== localTz) {
              updateProfile({ ...res.data, timeZone: localTz }).then(() => {
                // Cascade update to NotificationService
                import('../api/axiosConfig').then(({ default: axiosInstance }) => {
                  axiosInstance.get('/notifications/settings', { headers: { 'X-User-Id': storedUserId } })
                    .then(notifRes => {
                      if (notifRes.data?.enabled) {
                        const newSettings = { ...notifRes.data, timezone: localTz };
                        delete newSettings.enabled; // Not part of the PUT request body
                        axiosInstance.put('/notifications/settings', newSettings, { headers: { 'X-User-Id': storedUserId } })
                          .catch(console.error);
                      }
                    })
                    .catch(() => {}); // user might not have notifications set up
                });
              }).catch(console.error);
            }
          }
        }).catch(console.error);
      });
    }
    setIsLoading(false);
  }, [userId]);

  const persistAuth = (response: AuthResponse) => {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('userId', String(response.userId));
    setUserId(response.userId);
  };

  const login = async (data: AuthRequest) => {
    const res = await apiLogin(data);
    persistAuth(res.data);
  };

  const register = async (data: AuthRequest) => {
    const res = await apiRegister(data);
    persistAuth(res.data);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ userId, isAuthenticated: !!userId, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
