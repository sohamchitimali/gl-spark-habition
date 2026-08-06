import axiosInstance from './axiosConfig';

export interface AuthRequest { email: string; password: string; }
export interface AuthResponse { accessToken: string; refreshToken: string; userId: number; }

export const register = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/register', data);

export const login = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/login', data);

export const refreshToken = (refreshToken: string) =>
  axiosInstance.post<AuthResponse>('/auth/refresh', { refreshToken });
