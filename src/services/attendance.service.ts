// src/services/attendance.service.ts

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  limit as fbLimit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Attendance } from '../types/gym.types';

  
  // Obtener historial de asistencias de un socio
  export const getMemberAttendanceHistory = async (gymId: string, memberId: string): Promise<Attendance[]> => {
    try {
      const attendancesRef = collection(db, `gyms/${gymId}/attendances`);
      
      // Consultar asistencias de este socio, ordenadas por fecha descendente
      const q = query(
        attendancesRef,
        where('memberId', '==', memberId),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const attendances: Attendance[] = [];
      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as Attendance);
      });
      
      return attendances;
    } catch (error) {
      console.error('Error getting member attendance history:', error);
      throw error;
    }
  };
  
// Registrar una asistencia (versión actualizada)
export const registerAttendance = async (
  gymId: string, 
  memberId: string, 
  memberName: string,
  membershipId: string,
  activityName: string
): Promise<{ id?: string; status: 'success' | 'error'; error?: string }> => {
  try {
    const attendancesRef = collection(db, `gyms/${gymId}/attendances`);
    
    // Verificar que el socio existe
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      throw new Error('El socio no existe');
    }
    
    // Verificar que la membresía existe y está activa
    const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      throw new Error('La membresía no existe');
    }
    
    const membership = membershipSnap.data();
    if (membership.status !== 'active') {
      throw new Error('La membresía no está activa');
    }
    
    // Verificar si ya alcanzó el límite de asistencias
    if (membership.maxAttendances > 0 && membership.currentAttendances >= membership.maxAttendances) {
      throw new Error('Ha alcanzado el límite de asistencias para esta membresía');
    }
    
    // Verificar si ya asistió hoy para esta actividad
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAttendancesQuery = query(
      attendancesRef,
      where('memberId', '==', memberId),
      where('activityName', '==', activityName),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      fbLimit(1)
    );
    
    const todayAttendancesSnap = await getDocs(todayAttendancesQuery);
    
    if (!todayAttendancesSnap.empty) {
      // Permitir asistencia pero registrar una advertencia
      console.warn('El socio ya asistió hoy a esta actividad');
    }
    
    // Crear registro de asistencia
    const attendanceData = {
      memberId,
      memberName,
      timestamp: Timestamp.now(),
      membershipId,
      activityName,
      status: 'success',
      createdAt: serverTimestamp()
    };
    
    // Incrementar el contador de asistencias de la membresía
    await updateDoc(membershipRef, {
      currentAttendances: membership.currentAttendances + 1,
      updatedAt: serverTimestamp()
    });
    
    // Actualizar la fecha de última asistencia del socio
    await updateDoc(memberRef, {
      lastAttendance: Timestamp.now(),
      updatedAt: serverTimestamp()
    });
    
    // Guardar la asistencia
    const docRef = await addDoc(attendancesRef, attendanceData);
    
    return {
      id: docRef.id,
      status: 'success'
    };
  } catch (error: any) {
    console.error('Error registering attendance:', error);
    
    // Crear registro de asistencia con error si es posible
    try {
      const attendancesRef = collection(db, `gyms/${gymId}/attendances`);
      
      const attendanceData = {
        memberId,
        memberName,
        timestamp: Timestamp.now(),
        membershipId,
        activityName,
        status: 'error',
        error: error.message || 'Error desconocido',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(attendancesRef, attendanceData);
      
      return {
        id: docRef.id,
        status: 'error',
        error: error.message || 'Error desconocido'
      };
    } catch {
      // Si también falla registrar el error, solo devolver el error
      return {
        status: 'error',
        error: error.message || 'Error desconocido'
      };
    }
  }
};
  
  // Obtener las últimas asistencias del gimnasio
  export const getRecentAttendances = async (gymId: string, limitCount: number = 10): Promise<Attendance[]> => {
    try {
      const attendancesRef = collection(db, `gyms/${gymId}/attendances`);
      
      const q = query(
        attendancesRef,
        orderBy('timestamp', 'desc'),
        fbLimit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      
      const attendances: Attendance[] = [];
      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as Attendance);
      });
      
      return attendances;
    } catch (error) {
      console.error('Error getting recent attendances:', error);
      throw error;
    }
  };
  
  export default {
    getMemberAttendanceHistory,
    registerAttendance,
    getRecentAttendances
  };