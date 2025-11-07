// src/types/class.types.ts
import { Timestamp } from 'firebase/firestore';

export interface ClassRecurrence {
  days: number[];  // 0=domingo, 1=lunes, 2=martes, etc.
  startTime: string;  // "16:00"
  endTime: string;    // "17:00"
}

export interface ClassDefinition {
  id?: string;
  gymId: string;
  activityId: string;
  activityName: string;
  instructor: string;
  instructorId?: string;
  capacity: number;
  duration: number;  // minutos
  isRecurring: boolean;
  recurrence?: ClassRecurrence;
  requiresMembership: boolean;
  allowedActivityIds: string[];
  cancellationDeadline: number;  // minutos antes
  allowWaitlist: boolean;
  maxWaitlist: number;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClassSchedule {
  id?: string;
  gymId: string;
  classDefId: string;
  date: string;  // "YYYY-MM-DD"
  startDateTime: Timestamp;
  endDateTime: Timestamp;
  activityId: string;
  activityName: string;
  instructor: string;
  capacity: number;
  enrolled: number;
  waitlist: number;
  available: number;
  allowWaitlist: boolean;
  maxWaitlist: number;
  status: 'scheduled' | 'full' | 'cancelled' | 'completed';
  cancellationDeadline: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClassEnrollment {
  id?: string;
  gymId: string;
  scheduleId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  enrollmentType: 'confirmed' | 'waitlist';
  position: number | null;
  waitlistPosition: number | null;
  enrolledAt: Timestamp;
  status: 'active' | 'cancelled' | 'attended' | 'no-show';
  canCancelUntil: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  membershipId?: string;
  promotedAt?: Timestamp;
}