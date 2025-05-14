// src/types/attendance.types.ts

import { Timestamp } from 'firebase/firestore';

export interface Attendance {
  id: string;
  memberId: string;
  memberName: string;
  membershipId: string;
  activityName: string;
  timestamp: Timestamp | Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
  notes?: string; // Opcional
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface AttendanceStats {
  totalAttendances: number;
  todayAttendances: number;
  uniqueMembersToday: number;
  successfulAttendances: number;
  errorAttendances: number;
  averageAttendancesPerDay: number;
  peakHour: number;
  mostActiveMembers: {
    memberId: string;
    memberName: string;
    count: number;
  }[];
}

export interface AttendanceFilter {
  dateFrom?: Date;
  dateTo?: Date;
  memberId?: string;
  activityName?: string;
  status?: 'success' | 'error' | 'all';
}

export interface DailyAttendanceReport {
  date: string;
  totalAttendances: number;
  uniqueMembers: number;
  activities: {
    [activityName: string]: number;
  };
  hourlyDistribution: {
    [hour: number]: number;
  };
}

// Para el escáner mejorado
export interface AttendanceRecord {
  id: string;
  memberId: string;
  member: {
    firstName: string;
    lastName: string;
    photo?: string | null;
  };
  timestamp: Date;
  status: 'success' | 'error';
  activityName: string;
  error?: string;
}

export interface ScanResult {
  success: boolean;
  message: string;
  timestamp: Date;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    photo: string | null;
    activeMemberships?: number;
  } | null;
  error?: string;
}

export interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo?: string | null;
  lastAttendance?: Date;
  activeMemberships?: number;
  status: 'active' | 'inactive';
}