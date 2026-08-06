import axiosInstance from './axiosConfig';

export interface GroupHabit { id: number; title: string; description: string; }
export interface GroupResponse { 
  id: number; name: string; inviteCode: string; ownerId: number; 
  memberIds: number[]; adminIds: number[]; habits: GroupHabit[]; 
  description?: string; duration?: string; competitionEndDate?: string; 
}

export const createGroup = (name: string, description?: string, duration?: string) =>
  axiosInstance.post<GroupResponse>('/groups', { name, description, duration });

export const getMyGroups = () =>
  axiosInstance.get<GroupResponse[]>('/groups');

export const joinGroup = (inviteCode: string) =>
  axiosInstance.post<GroupResponse>('/groups/join', { inviteCode });

export const getGroup = (id: number) =>
  axiosInstance.get<GroupResponse>(`/groups/${id}`);

export const addHabit = (groupId: number, title: string, description: string) =>
  axiosInstance.post<GroupHabit>(`/groups/${groupId}/habits`, { title, description });

export const deleteGroupHabit = (groupId: number, habitId: number) =>
  axiosInstance.delete(`/groups/${groupId}/habits/${habitId}`);

export const changeDeadline = (groupId: number, request: {
  mode: 'ADD' | 'REDUCE' | 'SET';
  years?: number; months?: number; weeks?: number; days?: number;
  newDate?: string;
}) => axiosInstance.post<GroupResponse>(`/groups/${groupId}/deadline`, request);

export const promoteToAdmin = (groupId: number, targetUserId: number) =>
  axiosInstance.post<GroupResponse>(`/groups/${groupId}/members/${targetUserId}/promote`);
