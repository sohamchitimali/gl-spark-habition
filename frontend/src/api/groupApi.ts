import axiosInstance from './axiosConfig';

export interface GroupHabit { id: number; title: string; description: string; }
export interface GroupResponse { id: number; name: string; inviteCode: string; ownerId: number; memberIds: number[]; habits: GroupHabit[]; }

export const createGroup = (name: string) =>
  axiosInstance.post<GroupResponse>('/groups', { name });

export const joinGroup = (inviteCode: string) =>
  axiosInstance.post<GroupResponse>('/groups/join', { inviteCode });

export const getGroup = (id: number) =>
  axiosInstance.get<GroupResponse>(`/groups/${id}`);

export const addHabit = (groupId: number, title: string, description: string) =>
  axiosInstance.post<GroupHabit>(`/groups/${groupId}/habits`, { title, description });

export const deleteGroupHabit = (groupId: number, habitId: number) =>
  axiosInstance.delete(`/groups/${groupId}/habits/${habitId}`);
