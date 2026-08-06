import axiosInstance from './axiosConfig';

export interface HabitTask { id: number; habitId: number; title: string; completed: boolean; }
export interface Habit { id: number; title: string; description: string | null; userId: number; groupId: number | null; groupHabitId: number | null; completedToday: boolean; tasks: HabitTask[]; }
export interface HeatmapDay { date: string; completionCount: number; }
export interface HeatmapResponse { userId: number; days: HeatmapDay[]; }
export interface StreakResponse { userId: number; currentStreak: number; personalBest: number; }
export interface CompleteHabitResponse { habitId: number; completedOn: string; currentStreak: number; coinsEarned: number; }

// ─── Habits ───────────────────────────────────────────────────────────────────

export const getHabits = (userId: number) =>
  axiosInstance.get<Habit[]>(`/habits/users/${userId}`);

export const createHabit = (title: string, description?: string) =>
  axiosInstance.post<Habit>(`/habits`, null, { params: { title, description } });

export const completeHabit = (habitId: number) =>
  axiosInstance.post<CompleteHabitResponse>(`/habits/${habitId}/complete`);

export const deleteHabit = (habitId: number) =>
  axiosInstance.delete(`/habits/${habitId}`);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getTasks = (habitId: number) =>
  axiosInstance.get<HabitTask[]>(`/habits/${habitId}/tasks`);

export const createTask = (habitId: number, title: string) =>
  axiosInstance.post<HabitTask>(`/habits/${habitId}/tasks`, { title });

export const toggleTask = (taskId: number) =>
  axiosInstance.patch<HabitTask>(`/habits/tasks/${taskId}/toggle`);

export const deleteTask = (taskId: number) =>
  axiosInstance.delete(`/habits/tasks/${taskId}`);

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getHeatmap = (userId: number) =>
  axiosInstance.get<HeatmapResponse>(`/users/${userId}/heatmap`);

export const getStreak = (userId: number) =>
  axiosInstance.get<StreakResponse>(`/users/${userId}/streak`);
