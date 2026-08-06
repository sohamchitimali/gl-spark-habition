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
      setUserId(Number(storedUserId));
    }
    setIsLoading(false);
  }, []);

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
