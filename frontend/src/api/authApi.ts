import axiosInstance from './axiosConfig';

export interface AuthRequest { email: string; password: string; }
export interface AuthResponse { accessToken: string; refreshToken: string; userId: number; }
export interface UserProfile { id: number; email: string; name?: string; preferredColor?: string; location?: string; genreOfInterest?: string; bio?: string; }
export interface Profile { name?: string; preferredColor?: string; location?: string; genreOfInterest?: string; bio?: string; }

export const register = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/register', data);

export const login = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/login', data);

export const refreshToken = (refreshToken: string) =>
  axiosInstance.post<AuthResponse>('/auth/refresh', { refreshToken });

export const getUsers = (ids: number[]) =>
  axiosInstance.get<UserProfile[]>('/auth/users', { params: { ids: ids.join(',') } });

export const getProfile = () =>
  axiosInstance.get<Profile>('/auth/profile');

export const updateProfile = (data: Profile) =>
  axiosInstance.put<Profile>('/auth/profile', data);
