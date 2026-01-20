
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday, 6 = Sunday

export interface ScheduleEvent {
  id: string;
  userId: string;
  title: string;
  day: DayOfWeek;
  startTime: number; // minutes from 00:00
  duration: number; // minutes
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
}

export interface User {
  id: string;
  name: string;
  color: string;
  active: boolean;
  timezone: string;
  avatar?: string; // Base64 encoded profile picture
}

export type AppView = 'calendar' | 'setup';
