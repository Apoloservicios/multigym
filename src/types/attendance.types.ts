// src/types/attendance.types.ts - CORREGIDO PARA COMPATIBILIDAD COMPLETA

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
  notes?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// ✅ CORREGIDO: AttendanceStats con todas las propiedades necesarias
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
  // ✅ NUEVAS PROPIEDADES para compatibilidad con attendance.service.ts
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  uniqueMembersThisWeek: number;
  recentAttendances: AttendanceRecord[];
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

// ✅ CORREGIDO: AttendanceRecord compatible con Firebase y nuevas funciones
export interface AttendanceRecord {
  id?: string; // ✅ Opcional para cuando creamos el registro
  memberId: string;
  memberName: string;
  memberFirstName: string; // ✅ Agregado para compatibilidad
  memberLastName: string; // ✅ Agregado para compatibilidad
  memberEmail: string; // ✅ Agregado para compatibilidad
  activityId?: string; // ✅ Agregado para compatibilidad
  activityName: string;
  membershipId?: string; // ✅ Agregado para compatibilidad
  timestamp: any; // ✅ CORREGIDO: any para compatibilidad con serverTimestamp()
  status: 'success' | 'failed' | 'expired'; // ✅ Agregado 'failed' y 'expired'
  notes?: string;
  createdAt?: any; // ✅ CORREGIDO: any para compatibilidad con serverTimestamp()
  // ✅ NUEVOS CAMPOS para las mejoras
  registeredBy?: 'gym' | 'member';
  registeredByUserId?: string;
  registeredByUserName?: string;
  // ✅ Campos para el escáner (compatibilidad)
  member?: {
    firstName: string;
    lastName: string;
    photo?: string | null;
  };
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

// ✅ NUEVOS TIPOS para las mejoras
export interface AttendanceData {
  memberId: string;
  memberName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  membershipId: string;
  activityId?: string;
  activityName: string;
  notes?: string;
  registeredBy?: 'gym' | 'member';
  registeredByUserId?: string;
  registeredByUserName?: string;
}

export interface AttendanceResult {
  success: boolean;
  attendanceId?: string;
  error?: string;
  warning?: string;
}