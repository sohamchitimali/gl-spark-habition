import axiosInstance from './axiosConfig';

export interface GroupHabit { id: number; title: string; description: string; }
export interface GroupResponse { 
  id: number; name: string; inviteCode: string; ownerId: number; 
  memberIds: number[]; adminIds: number[]; habits: GroupHabit[]; 
  description?: string; duration?: string; competitionEndDate?: string;
  visibility?: string; hasPendingRequests?: boolean; currentUserRequested?: boolean;
}

export const createGroup = (name: string, description?: string, visibility?: string, years: number = 0, months: number = 0, weeks: number = 0, days: number = 0, inviteFriendIds?: number[]) =>
  axiosInstance.post<GroupResponse>('/groups', { name, description, visibility, years, months, weeks, days, inviteFriendIds });

export const getMyGroups = () =>
  axiosInstance.get<GroupResponse[]>('/groups/my-groups');

export const searchGroups = (query: string, userTags: string[], userLat?: number, userLng?: number) =>
  axiosInstance.post<GroupResponse[]>('/groups/search', { query, userTags, userLat, userLng });

export const joinGroup = (inviteCode: string) =>
  axiosInstance.post<GroupResponse>('/groups/join', { inviteCode });

export const getGroup = (id: number) =>
  axiosInstance.get<GroupResponse>(`/groups/${id}`);

export interface SentJoinRequestResponse {
  id: number;
  groupId: number;
  groupName: string;
  applicantId: number;
  status: string;
  initialMessage: string;
  createdAt: string;
  updatedAt: string;
}

export const getMySentRequests = () =>
  axiosInstance.get<SentJoinRequestResponse[]>('/groups/my-requests');

export const addHabit = (groupId: number, title: string, description: string) =>
  axiosInstance.post<GroupHabit>(`/groups/${groupId}/habits`, { title, description });

export const deleteGroupHabit = (groupId: number, habitId: number) =>
  axiosInstance.delete(`/groups/${groupId}/habits/${habitId}`);

export const changeDeadline = (groupId: number, request: {
  mode: 'ADD' | 'REDUCE' | 'SET';
  years?: number; months?: number; weeks?: number; days?: number;
  newDate?: string;
}) => axiosInstance.post<GroupResponse>(`/groups/${groupId}/deadline`, request);

export const promoteToAdmin = (groupId: number, targetId: number) =>
  axiosInstance.post<GroupResponse>(`/groups/${groupId}/members/${targetId}/promote`);

export const deleteGroup = (groupId: number) =>
  axiosInstance.delete(`/groups/${groupId}`);

export const leaveGroup = (groupId: number) =>
  axiosInstance.delete(`/groups/${groupId}/members/leave`);

// Join Requests API
export const requestToJoin = (groupId: number, initialMessage: string) =>
  axiosInstance.post(`/groups/${groupId}/join-requests`, { initialMessage });

export const getPendingRequests = (groupId: number) =>
  axiosInstance.get(`/groups/${groupId}/join-requests`);

export const approveRequest = (groupId: number, requestId: number) =>
  axiosInstance.post(`/groups/${groupId}/join-requests/${requestId}/approve`);

export const rejectRequest = (groupId: number, requestId: number) =>
  axiosInstance.post(`/groups/${groupId}/join-requests/${requestId}/reject`);

export const sendJoinMessage = (groupId: number, requestId: number, content: string) =>
  axiosInstance.post(`/groups/${groupId}/join-requests/${requestId}/messages`, { content });

export const getJoinMessages = (groupId: number, requestId: number) =>
  axiosInstance.get(`/groups/${groupId}/join-requests/${requestId}/messages`);
