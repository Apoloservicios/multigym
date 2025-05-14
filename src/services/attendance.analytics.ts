// src/services/attendance.analytics.ts

import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface AttendancePattern {
  preferredDays: string[];
  preferredHours: number[];
  averageSessionsPerWeek: number;
  longestStreak: number;
  currentStreak: number;
  lastAttendance: Date;
}

export interface GymTrafficAnalytics {
  busyHours: { hour: number; count: number }[];
  busyDays: { day: string; count: number }[];
  peakCapacity: number;
  averageDailyAttendance: number;
  growthRate: number;
  retentionRate: number;
}

// Analizar patrones de asistencia de un socio
export const analyzeAttendancePattern = async (
  gymId: string,
  memberId: string
): Promise<AttendancePattern> => {
  try {
    const attendancesRef = collection(db, `gyms/${gymId}/members/${memberId}/attendances`);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const q = query(
      attendancesRef,
      where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      where('status', '==', 'success'),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const attendances = snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    }));
    
    // Analizar días preferidos
    const dayCount: { [key: string]: number } = {};
    const hourCount: { [key: number]: number } = {};
    const dailyAttendances: { [key: string]: Date[] } = {};
    
    attendances.forEach(attendance => {
      const date = attendance.timestamp as Date;
      const dayOfWeek = date.toLocaleDateString('es-AR', { weekday: 'long' });
      const hour = date.getHours();
      const dateKey = date.toISOString().split('T')[0];
      
      dayCount[dayOfWeek] = (dayCount[dayOfWeek] || 0) + 1;
      hourCount[hour] = (hourCount[hour] || 0) + 1;
      
      if (!dailyAttendances[dateKey]) {
        dailyAttendances[dateKey] = [];
      }
      dailyAttendances[dateKey].push(date);
    });
    
    // Calcular días y horas preferidos
    const preferredDays = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);
    
    const preferredHours = Object.entries(hourCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    // Calcular racha actual y más larga
    const sortedDates = Object.keys(dailyAttendances).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date().toISOString().split('T')[0];
    let lastDate = '';
    
    sortedDates.forEach(date => {
      if (lastDate) {
        const daysDiff = Math.abs(
          (new Date(date).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff <= 7) { // Consideramos una semana como continuidad
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      lastDate = date;
    });
    
    // Calcular racha actual (desde el final)
    const recentDates = sortedDates.slice(-7);
    currentStreak = recentDates.length;
    
    // Promedio de sesiones por semana
    const weeksInPeriod = 4; // 30 días ≈ 4 semanas
    const averageSessionsPerWeek = attendances.length / weeksInPeriod;
    
    return {
      preferredDays,
      preferredHours,
      averageSessionsPerWeek: Math.round(averageSessionsPerWeek * 10) / 10,
      longestStreak: Math.max(longestStreak, tempStreak),
      currentStreak,
      lastAttendance: attendances[0]?.timestamp as Date
    };
    
  } catch (error) {
    console.error('Error analyzing attendance pattern:', error);
    throw error;
  }
};

// Analizar tráfico general del gimnasio
export const analyzeGymTraffic = async (
  gymId: string,
  periodDays: number = 30
): Promise<GymTrafficAnalytics> => {
  try {
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    
    // Obtener todos los miembros del gimnasio
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const hourlyTraffic: { [hour: number]: number } = {};
    const dailyTraffic: { [day: string]: number } = {};
    const dailyUniqueMembers: { [date: string]: Set<string> } = {};
    
    let totalAttendances = 0;
    let activeMembersCount = 0;
    
    // Procesar asistencias de cada miembro
    for (const memberDoc of membersSnapshot.docs) {
      const attendancesRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/attendances`);
      const q = query(
        attendancesRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('status', '==', 'success'),
        orderBy('timestamp', 'asc')
      );
      
      const attendancesSnapshot = await getDocs(q);
      
      if (attendancesSnapshot.size > 0) {
        activeMembersCount++;
      }
      
      attendancesSnapshot.forEach(doc => {
        const attendance = doc.data();
        const date = attendance.timestamp.toDate();
        const hour = date.getHours();
        const dayOfWeek = date.toLocaleDateString('es-AR', { weekday: 'long' });
        const dateKey = date.toISOString().split('T')[0];
        
        hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;
        dailyTraffic[dayOfWeek] = (dailyTraffic[dayOfWeek] || 0) + 1;
        
        if (!dailyUniqueMembers[dateKey]) {
          dailyUniqueMembers[dateKey] = new Set();
        }
        dailyUniqueMembers[dateKey].add(memberDoc.id);
        
        totalAttendances++;
      });
    }
    
    // Procesar resultados
    const busyHours = Object.entries(hourlyTraffic)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);
    
    const busyDays = Object.entries(dailyTraffic)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count);
    
    // Calcular capacidad pico (máximo de personas únicas por día)
    const peakCapacity = Math.max(...Object.values(dailyUniqueMembers).map(set => set.size));
    
    // Promedio diario de asistencias
    const averageDailyAttendance = totalAttendances / periodDays;
    
    // Calcular tasa de crecimiento (comparar primera mitad vs segunda mitad del período)
    const midPoint = Math.floor(periodDays / 2);
    const firstHalf = Object.entries(dailyUniqueMembers)
      .slice(0, midPoint)
      .reduce((sum, [, members]) => sum + members.size, 0);
    const secondHalf = Object.entries(dailyUniqueMembers)
      .slice(midPoint)
      .reduce((sum, [, members]) => sum + members.size, 0);
    
    const growthRate = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    
    // Calcular tasa de retención (miembros que asistieron en ambas mitades del período)
    const firstHalfMembers = new Set<string>();
    const secondHalfMembers = new Set<string>();
    
    Object.entries(dailyUniqueMembers).forEach(([date, members], index) => {
      if (index < midPoint) {
        members.forEach(member => firstHalfMembers.add(member));
      } else {
        members.forEach(member => secondHalfMembers.add(member));
      }
    });
    
    const retainedMembers = Array.from(firstHalfMembers).filter(member => secondHalfMembers.has(member));
    const retentionRate = firstHalfMembers.size > 0 ? (retainedMembers.length / firstHalfMembers.size) * 100 : 0;
    
    return {
      busyHours,
      busyDays,
      peakCapacity,
      averageDailyAttendance: Math.round(averageDailyAttendance * 10) / 10,
      growthRate: Math.round(growthRate * 10) / 10,
      retentionRate: Math.round(retentionRate * 10) / 10
    };
    
  } catch (error) {
    console.error('Error analyzing gym traffic:', error);
    throw error;
  }
};

// Generar recomendaciones basadas en patrones
export const generateRecommendations = async (
  gymId: string,
  memberId: string
): Promise<string[]> => {
  try {
    const pattern = await analyzeAttendancePattern(gymId, memberId);
    const recommendations: string[] = [];
    
    // Recomendaciones basadas en frecuencia
    if (pattern.averageSessionsPerWeek < 2) {
      recommendations.push("Intenta aumentar tu frecuencia a al menos 3 sesiones por semana para mejores resultados.");
    } else if (pattern.averageSessionsPerWeek > 6) {
      recommendations.push("Recuerda incluir días de descanso para permitir la recuperación muscular.");
    }
    
    // Recomendaciones basadas en consistencia
    if (pattern.currentStreak === 0) {
      recommendations.push("¡Es hora de retomar tu rutina! Tu última visita fue hace tiempo.");
    } else if (pattern.currentStreak >= 7) {
      recommendations.push("¡Excelente consistencia! Mantén este ritmo.");
    }
    
    // Recomendaciones basadas en horarios
    if (pattern.preferredHours.includes(18) || pattern.preferredHours.includes(19)) {
      recommendations.push("Considera venir en horarios menos concurridos para tener más espacio y comodidad.");
    }
    
    // Recomendaciones basadas en días
    if (pattern.preferredDays.includes('lunes')) {
      recommendations.push("Los viernes suelen ser menos concurridos. ¡Prueba cambiar uno de tus entrenamientos!");
    }
    
    return recommendations;
    
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
};

export default {
  analyzeAttendancePattern,
  analyzeGymTraffic,
  generateRecommendations
};