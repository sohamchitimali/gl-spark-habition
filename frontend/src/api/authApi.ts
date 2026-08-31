import axiosInstance from './axiosConfig';
import axios from 'axios';

export interface AuthRequest { email: string; password: string; username?: string; otp?: string; }
export interface AuthResponse { accessToken: string; refreshToken: string; userId: number; }
export interface UserProfile { id: number; email: string; username?: string; name?: string; userTheme?: string; addressDisplay?: string; bio?: string; }
export interface Profile { 
  username?: string;
  name?: string; 
  userTheme?: string; 
  addressDisplay?: string; 
  latitude?: number;
  longitude?: number;
  bio?: string; 
  timeZone?: string;
  experience?: string;
  schedule?: string;
  locationVisibility?: string;
  tags?: string[];
  autoTimezone?: boolean;
}

export const sendOtp = (email: string) =>
  axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/send-otp`, { email });

export const register = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/register', data);

export const checkUsername = (username: string, sessionId?: string) => {
  let url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/check-username?username=${encodeURIComponent(username)}`;
  if (sessionId) {
    url += `&sessionId=${encodeURIComponent(sessionId)}`;
  }
  return axios.get<boolean>(url);
};

export const login = (data: AuthRequest) =>
  axiosInstance.post<AuthResponse>('/auth/login', data);

export const refreshToken = (refreshToken: string) =>
  axiosInstance.post<AuthResponse>('/auth/refresh', { refreshToken });

export const getUsers = (ids: number[]) =>
  axiosInstance.get<UserProfile[]>('/auth/users', { params: { ids: ids.join(',') } });

export const getProfile = () => axiosInstance.get<Profile>('/auth/profile');
export const updateProfile = (data: Profile) => axiosInstance.put<Profile>('/auth/profile', data);
export const getUsersByIds = (ids: number[]) => axiosInstance.get<UserProfile[]>(`/auth/users?ids=${ids.join(',')}`);
export const getUserByUsername = (username: string) => axiosInstance.get<UserProfile>(`/auth/users/by-username?username=${encodeURIComponent(username)}`);
export const searchUsers = (query: string) => axiosInstance.get<Profile[]>(`/auth/search?query=${encodeURIComponent(query)}`);

export interface FriendshipDto {
  id: number;
  friendId: number;
  friendProfile: Profile;
  status: 'PENDING' | 'ACCEPTED';
  isRequester: boolean;
  createdAt: string;
}

export const getFriendships = () => axiosInstance.get<FriendshipDto[]>('/auth/friends');
export const sendFriendRequest = (username: string) => axiosInstance.post<FriendshipDto>(`/auth/friends/request/${encodeURIComponent(username)}`);
export const acceptFriendRequest = (friendshipId: number) => axiosInstance.put<FriendshipDto>(`/auth/friends/accept/${friendshipId}`);
export const removeFriend = (friendshipId: number) => axiosInstance.delete(`/auth/friends/${friendshipId}`);

// Password Management
export const forgotPassword = (email: string) =>
  axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/forgot-password`, { email });

export const resetPassword = (email: string, otp: string, newPassword: string) =>
  axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/reset-password`, { email, otp, newPassword });

export const changePassword = (currentPassword: string, newPassword: string) =>
  axiosInstance.put('/auth/users/me/password', { currentPassword, newPassword });
