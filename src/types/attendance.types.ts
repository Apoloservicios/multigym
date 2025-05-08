// src/types/attendance.types.ts

// Definición de la interfaz Attendance
export interface Attendance {
    id: string;
    memberId: string;
    memberName: string;
    timestamp: any; // Timestamp de Firebase
    membershipId: string;
    activityName: string;
    status: 'success' | 'error';
    error?: string;
  }
  
  // Funciones de utilidad para attendance
  export const createEmptyAttendance = (): Attendance => ({
    id: '',
    memberId: '',
    memberName: '',
    timestamp: new Date(),
    membershipId: '',
    activityName: '',
    status: 'success'
  });
  
  // Si necesitas más funciones relacionadas con asistencias, agrégalas aquí
  
  export default {
    createEmptyAttendance
  };