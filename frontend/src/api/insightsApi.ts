import axiosInstance from './axiosConfig';

export interface GroupInsightDTO {
  groupId: number;
  healthStatus: 'AT_RISK' | 'HEALTHY' | 'EXCELLENT';
  overallConsistencyScore: number;
  topPerformers: string[];
  strugglingMembers: string[];
  suggestedAction: string;
}

export interface UserInsightDTO {
  userId: number;
  personalConsistencyScore: number;
  recentAchievements: string[];
  areasForImprovement: string[];
  predictedNextMilestone: string;
}

export const getGroupInsights = (groupId: number) =>
  axiosInstance.get<GroupInsightDTO>(`/api/insights/groups/${groupId}`);

export const getUserInsights = () =>
  axiosInstance.get<UserInsightDTO>(`/api/insights/users/me`);
