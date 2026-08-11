import axiosInstance from './axiosConfig';

export interface DirectMessage {
  id: number;
  senderId: number;
  receiverId?: number; // Nullable for Group chats
  groupId?: number;
  chatType: 'JOIN_REQUEST' | 'DIRECT_MESSAGE' | 'GROUP';
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const getMyMessages = () =>
  axiosInstance.get<DirectMessage[]>('/messages');

export const getNotifications = () =>
  axiosInstance.get<{ unreadMessagesCount: number; pendingJoinRequestsCount: number }>('/messages/notifications');

export const sendMessage = (payload: { receiverId?: number; content: string; groupId?: number; chatType?: string }) =>
  axiosInstance.post<DirectMessage>('/messages', payload);

export const markAsRead = (messageId: number) =>
  axiosInstance.post(`/messages/${messageId}/read`);

export const deleteDirectChat = (otherUserId: number) =>
  axiosInstance.delete(`/messages/direct/${otherUserId}`);
