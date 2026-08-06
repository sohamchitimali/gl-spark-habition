import axiosInstance from './axiosConfig';

export interface LeaderboardEntry { rank: number; userId: number; totalCoins: number; }
export interface LeaderboardResponse { groupId: number; entries: LeaderboardEntry[]; winnerId: number | null; }

export const getLeaderboard = (groupId: number) =>
  axiosInstance.get<LeaderboardResponse>(`/coins/groups/${groupId}/leaderboard`);

export const getUserBalance = (userId: number) =>
  axiosInstance.get<number>(`/coins/users/${userId}/balance`);

export const finalizeCompetition = (groupId: number) =>
  axiosInstance.post<LeaderboardResponse>(`/competitions/${groupId}/finalize`);

export const resetGroupCoins = (groupId: number) =>
  axiosInstance.delete(`/coins/groups/${groupId}/reset`);
