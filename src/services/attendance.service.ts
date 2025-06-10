// src/services/attendance.service.ts - VERSIÓN COMPLETA Y CORREGIDA

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
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

import { AttendanceStats } from '../types/attendance.types';

export interface AttendanceRecord {
  id?: string;
  memberId: string;
  memberName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  activityId?: string;
  activityName: string;
  membershipId?: string;
  timestamp: any;
  status: 'success' | 'failed' | 'expired';
  notes?: string;
  createdAt?: any;
  // NUEVOS CAMPOS
  registeredBy?: 'gym' | 'member';
  registeredByUserId?: string;
  registeredByUserName?: string;
}



class AttendanceService {
  // Registrar una asistencia con selección de membresía
  async registerAttendance(
    gymId: string,
    attendanceData: {
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
  ): Promise<{ success: boolean; attendanceId?: string; error?: string }> {
    try {
      // Verificar que el miembro existe
      const memberRef = doc(db, `gyms/${gymId}/members`, attendanceData.memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) {
        return { success: false, error: 'El socio no existe' };
      }

      const memberData = memberSnap.data();
      
      // Verificar que el miembro esté activo
      if (memberData.status !== 'active') {
        return { success: false, error: 'El socio no está activo' };
      }

      // Verificar que la membresía existe y está activa
      const membershipRef = doc(db, `gyms/${gymId}/members/${attendanceData.memberId}/memberships`, attendanceData.membershipId);
      const membershipSnap = await getDoc(membershipRef);
      
      if (!membershipSnap.exists()) {
        return { success: false, error: 'La membresía no existe' };
      }

      const membershipData = membershipSnap.data();
      
      // Verificar que la membresía esté activa
      if (membershipData.status !== 'active') {
        return { success: false, error: 'La membresía no está activa' };
      }

      // Verificar que no haya expirado
      const endDate = membershipData.endDate?.toDate ? membershipData.endDate.toDate() : new Date(membershipData.endDate);
      if (endDate < new Date()) {
        return { success: false, error: 'La membresía ha expirado' };
      }

      // Verificar límite de asistencias si aplica
      if (membershipData.maxAttendances > 0 && 
          (membershipData.currentAttendances || 0) >= membershipData.maxAttendances) {
        return { success: false, error: 'Se ha alcanzado el límite de asistencias para esta membresía' };
      }

      // Crear registro de asistencia
      const attendance: Omit<AttendanceRecord, 'id'> = {
        memberId: attendanceData.memberId,
        memberName: attendanceData.memberName,
        memberFirstName: attendanceData.memberFirstName,
        memberLastName: attendanceData.memberLastName,
        memberEmail: attendanceData.memberEmail,
        membershipId: attendanceData.membershipId,
        activityId: attendanceData.activityId,
        activityName: attendanceData.activityName,
        timestamp: serverTimestamp(),
        status: 'success',
        notes: attendanceData.notes,
        createdAt: serverTimestamp(),
        // NUEVOS CAMPOS
        registeredBy: attendanceData.registeredBy || 'gym',
        registeredByUserId: attendanceData.registeredByUserId,
        registeredByUserName: attendanceData.registeredByUserName
      };

      const docRef = await addDoc(collection(db, `gyms/${gymId}/attendance`), attendance);

      // Actualizar contador de asistencias en la membresía
      await updateDoc(membershipRef, {
        currentAttendances: (membershipData.currentAttendances || 0) + 1,
        updatedAt: serverTimestamp()
      });

      // Actualizar última asistencia del socio
      await updateDoc(memberRef, {
        lastAttendance: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { 
        success: true, 
        attendanceId: docRef.id 
      };

    } catch (error: any) {
      console.error('Error registering attendance:', error);
      return { 
        success: false, 
        error: error.message || 'Error al registrar la asistencia' 
      };
    }
  }

  // Obtener membresías activas de un socio para selección
  async getActiveMemberships(gymId: string, memberId: string): Promise<any[]> {
    try {
      console.log('Buscando membresías para socio:', memberId, 'en gimnasio:', gymId);
      
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      
      // Primero intentar con orderBy
      let q;
      try {
        q = query(
          membershipsRef,
          where('status', '==', 'active'),
          orderBy('activityName', 'asc')
        );
      } catch (indexError) {
        console.log('No hay índice para orderBy, usando query simple');
        q = query(
          membershipsRef,
          where('status', '==', 'active')
        );
      }

      const querySnapshot = await getDocs(q);
      const memberships: any[] = [];

      console.log('Documentos encontrados:', querySnapshot.size);

      querySnapshot.forEach(doc => {
        const data = doc.data();
        console.log('Datos de membresía:', doc.id, data);
        
        // Verificar fecha de vencimiento
        let endDate = new Date();
        try {
          endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
        } catch (dateError) {
          console.error('Error procesando fecha:', dateError);
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 días
        }
        
        // Solo incluir membresías que no hayan expirado
        if (endDate >= new Date()) {
          memberships.push({
            id: doc.id,
            activityId: data.activityId || '',
            activityName: data.activityName || 'Actividad General',
            currentAttendances: data.currentAttendances || 0,
            maxAttendances: data.maxAttendances || 0,
            endDate: endDate,
            status: data.status || 'active'
          });
        } else {
          console.log('Membresía expirada excluida:', doc.id, endDate);
        }
      });

      console.log('Membresías activas encontradas:', memberships.length);
      return memberships;
    } catch (error) {
      console.error('Error getting active memberships:', error);
      // En caso de error, devolver array vacío en lugar de lanzar excepción
      return [];
    }
  }

  // Función específica para cuando el socio registra su propia asistencia
  async registerSelfAttendance(
    gymId: string,
    memberId: string,
    membershipId: string,
    notes?: string
  ): Promise<{ success: boolean; attendanceId?: string; error?: string }> {
    try {
      // Obtener información del miembro
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) {
        return { success: false, error: 'Socio no encontrado' };
      }

      const memberData = memberSnap.data();
      
      // Obtener información de la membresía
      const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
      const membershipSnap = await getDoc(membershipRef);
      
      if (!membershipSnap.exists()) {
        return { success: false, error: 'Membresía no encontrada' };
      }

      const membershipData = membershipSnap.data();
      
      return await this.registerAttendance(gymId, {
        memberId: memberId,
        memberName: `${memberData.firstName} ${memberData.lastName}`,
        memberFirstName: memberData.firstName,
        memberLastName: memberData.lastName,
        memberEmail: memberData.email,
        membershipId: membershipId,
        activityId: membershipData.activityId,
        activityName: membershipData.activityName,
        notes: notes || 'Auto-registro del socio',
        registeredBy: 'member' // Indica que fue el socio quien se registró
      });
      
    } catch (error: any) {
      console.error('Error in self attendance registration:', error);
      return { 
        success: false, 
        error: error.message || 'Error al registrar asistencia' 
      };
    }
  }

  // Obtener asistencias para un rango de fechas
  async getAttendanceByDateRange(
    gymId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceRecord[]> {
    try {
      const attendanceRef = collection(db, `gyms/${gymId}/attendance`);
      const q = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        where('status', '==', 'success'),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const attendances: AttendanceRecord[] = [];

      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord);
      });

      return attendances;
    } catch (error) {
      console.error('Error getting attendance by date range:', error);
      throw error;
    }
  }

  // Obtener asistencias de hoy
  async getTodayAttendance(gymId: string): Promise<AttendanceRecord[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getAttendanceByDateRange(gymId, today, tomorrow);
  }

  // ✅ OBTENER ESTADÍSTICAS DE ASISTENCIA (CORREGIDO PARA COINCIDIR CON TIPOS)
  async getAttendanceStats(gymId: string): Promise<AttendanceStats> {
    try {
      const now = new Date();
      
      // Fechas para los filtros
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      // Obtener asistencias
      const [todayAttendances, weekAttendances, monthAttendances, recentAttendances] = await Promise.all([
        this.getAttendanceByDateRange(gymId, today, tomorrow),
        this.getAttendanceByDateRange(gymId, weekAgo, now),
        this.getAttendanceByDateRange(gymId, monthAgo, now),
        this.getRecentAttendances(gymId, 10)
      ]);

      // Calcular miembros únicos
      const uniqueMembersToday = new Set(todayAttendances.map(a => a.memberId)).size;
      const uniqueMembersThisWeek = new Set(weekAttendances.map(a => a.memberId)).size;

      // ✅ CORREGIDO: Devolver objeto compatible con AttendanceStats del types
      return {
        // Propiedades originales del tipo AttendanceStats
        totalAttendances: monthAttendances.length,
        todayAttendances: todayAttendances.length,
        uniqueMembersToday,
        successfulAttendances: monthAttendances.filter(a => a.status === 'success').length,
        errorAttendances: monthAttendances.filter(a => a.status === 'failed' || a.status === 'expired').length,
        averageAttendancesPerDay: Math.round(monthAttendances.length / 30),
        peakHour: this.calculatePeakHour(monthAttendances),
        mostActiveMembers: this.getMostActiveMembers(monthAttendances),
        
        // Propiedades adicionales para compatibilidad
        totalToday: todayAttendances.length,
        totalThisWeek: weekAttendances.length,
        totalThisMonth: monthAttendances.length,
        uniqueMembersThisWeek,
        recentAttendances
      };

    } catch (error) {
      console.error('Error getting attendance stats:', error);
      throw error;
    }
  }

  // ✅ FUNCIONES AUXILIARES PARA ESTADÍSTICAS
  private calculatePeakHour(attendances: AttendanceRecord[]): number {
    const hourCounts: { [hour: number]: number } = {};
    
    attendances.forEach(attendance => {
      try {
        const date = attendance.timestamp?.toDate ? 
          attendance.timestamp.toDate() : 
          new Date(attendance.timestamp);
        const hour = date.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      } catch (error) {
        // Ignorar errores de fecha
      }
    });

    let peakHour = 9; // Default
    let maxCount = 0;
    
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    });

    return peakHour;
  }

  private getMostActiveMembers(attendances: AttendanceRecord[]): Array<{memberId: string, memberName: string, count: number}> {
    const memberCounts: { [memberId: string]: { name: string, count: number } } = {};
    
    attendances.forEach(attendance => {
      const memberId = attendance.memberId;
      if (memberCounts[memberId]) {
        memberCounts[memberId].count++;
      } else {
        memberCounts[memberId] = {
          name: attendance.memberName,
          count: 1
        };
      }
    });

    return Object.entries(memberCounts)
      .map(([memberId, data]) => ({
        memberId,
        memberName: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Obtener asistencias recientes
  async getRecentAttendances(gymId: string, limitCount: number = 5): Promise<AttendanceRecord[]> {
    try {
      const attendanceRef = collection(db, `gyms/${gymId}/attendance`);
      const q = query(
        attendanceRef,
        where('status', '==', 'success'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const attendances: AttendanceRecord[] = [];

      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord);
      });

      return attendances;
    } catch (error) {
      console.error('Error getting recent attendances:', error);
      throw error;
    }
  }

  // ✅ OBTENER ASISTENCIAS DE UN MIEMBRO (NOMBRE CORRECTO)
  async getMemberAttendances(
    gymId: string, 
    memberId: string, 
    limitCount: number = 20
  ): Promise<AttendanceRecord[]> {
    try {
      const attendanceRef = collection(db, `gyms/${gymId}/attendance`);
      const q = query(
        attendanceRef,
        where('memberId', '==', memberId),
        where('status', '==', 'success'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const attendances: AttendanceRecord[] = [];

      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord);
      });

      return attendances;
    } catch (error) {
      console.error('Error getting member attendance:', error);
      throw error;
    }
  }

  // ✅ ALIAS PARA COMPATIBILIDAD CON CÓDIGO EXISTENTE
  async getMemberAttendanceHistory(
    gymId: string, 
    memberId: string, 
    limitCount: number = 20
  ): Promise<AttendanceRecord[]> {
    return this.getMemberAttendances(gymId, memberId, limitCount);
  }

  // Registrar asistencia por QR - REQUIERE SELECCIÓN DE MEMBRESÍA
  async registerAttendanceByQR(
    gymId: string,
    qrData: string,
    membershipId: string // NUEVO: ID de membresía seleccionada
  ): Promise<{ success: boolean; message: string; attendanceId?: string }> {
    try {
      // Decodificar QR
      let memberData;
      try {
        const decodedData = JSON.parse(Buffer.from(qrData, 'base64').toString());
        if (decodedData.gymId !== gymId) {
          return { success: false, message: 'Código QR no válido para este gimnasio' };
        }
        memberData = decodedData;
      } catch (error) {
        return { success: false, message: 'Código QR inválido' };
      }

      // Obtener información completa del miembro
      const memberRef = doc(db, `gyms/${gymId}/members`, memberData.memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        return { success: false, message: 'Socio no encontrado' };
      }

      const member = memberSnap.data();

      // Obtener información de la membresía seleccionada
      const membershipRef = doc(db, `gyms/${gymId}/members/${memberData.memberId}/memberships`, membershipId);
      const membershipSnap = await getDoc(membershipRef);

      if (!membershipSnap.exists()) {
        return { success: false, message: 'Membresía no encontrada' };
      }

      const membership = membershipSnap.data();

      // Registrar asistencia con la membresía específica
      const result = await this.registerAttendance(gymId, {
        memberId: memberData.memberId,
        memberName: `${member.firstName} ${member.lastName}`,
        memberFirstName: member.firstName,
        memberLastName: member.lastName,
        memberEmail: member.email,
        membershipId: membershipId,
        activityId: membership.activityId,
        activityName: membership.activityName,
        notes: 'Acceso por código QR'
      });

      if (result.success) {
        return {
          success: true,
          message: `Asistencia registrada para ${member.firstName} ${member.lastName} - ${membership.activityName}`,
          attendanceId: result.attendanceId
        };
      } else {
        return {
          success: false,
          message: result.error || 'Error al registrar asistencia'
        };
      }

    } catch (error: any) {
      console.error('Error registering QR attendance:', error);
      return {
        success: false,
        message: error.message || 'Error al procesar código QR'
      };
    }
  }
}

export const attendanceService = new AttendanceService();

// Exportar funciones específicas para compatibilidad
export const getMemberAttendanceHistory = (gymId: string, memberId: string, limit?: number) => 
  attendanceService.getMemberAttendanceHistory(gymId, memberId, limit);

export const registerAttendance = (gymId: string, data: any) => 
  attendanceService.registerAttendance(gymId, data);

export const getRecentAttendances = (gymId: string, limit?: number) => 
  attendanceService.getRecentAttendances(gymId, limit);

export const getAttendanceByDateRange = (gymId: string, startDate: Date, endDate: Date) => 
  attendanceService.getAttendanceByDateRange(gymId, startDate, endDate);

export const getAttendanceStats = (gymId: string) => 
  attendanceService.getAttendanceStats(gymId);

export default attendanceService;