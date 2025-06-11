// src/utils/date.utils.ts - VERSIÓN COMPLETA CON COMPATIBILIDAD

import { Timestamp } from 'firebase/firestore';
import { FirebaseDate } from '../types/firebase.types';

/**
 * Convierte cualquier fecha de Firebase a un objeto Date estándar
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const toJsDate = (date: FirebaseDate): Date | null => {
  if (!date) return null;
  
  try {
    // Si es un objeto Timestamp de Firebase con método toDate()
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    // Si es un objeto Timestamp de Firebase con seconds
    else if (date && typeof date === 'object' && 'seconds' in date) {
      return new Date((date as any).seconds * 1000);
    }
    // Si ya es un Date
    else if (date instanceof Date) {
      return date;
    }
    // Para otros tipos (string, number)
    else {
      const d = new Date(date as any);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch (error) {
    console.error('Error converting to Date:', error);
    return null;
  }
};

/**
 * Función segura para formatear fechas
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const formatDate = (date: FirebaseDate): string => {
  if (!date) return '';
  
  try {
    // Convertir a Date JavaScript estándar
    const d = toJsDate(date);
    
    // Verificar si la fecha es válida antes de formatearla
    if (!d || isNaN(d.getTime())) {
      return '';
    }
    
    return d.toLocaleDateString('es-AR');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Función segura para formatear fecha y hora
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const formatDateTime = (date: FirebaseDate): string => {
  if (!date) return '';
  
  try {
    // Convertir a Date JavaScript estándar
    const d = toJsDate(date);
    
    // Verificar si la fecha es válida
    if (!d || isNaN(d.getTime())) {
      return '';
    }
    
    return d.toLocaleString('es-AR');
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
};

/**
 * Función para agregar días a una fecha
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Función para calcular fecha de finalización basada en una fecha de inicio y duración
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const calculateEndDate = (startDate: Date | string, durationDays: number): Date => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  return addDays(start, durationDays);
};

/**
 * Función para convertir fecha a string YYYY-MM-DD (para inputs de tipo date)
 * (FUNCIÓN ORIGINAL - MANTENIDA PARA COMPATIBILIDAD)
 */
export const dateToString = (date: FirebaseDate): string => {
  const jsDate = toJsDate(date);
  if (!jsDate) return '';
  
  // ✅ CORRECCIÓN: Usar fecha local sin conversión de timezone
  const year = jsDate.getFullYear();
  const month = String(jsDate.getMonth() + 1).padStart(2, '0');
  const day = String(jsDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// ========== NUEVAS FUNCIONES AGREGADAS ==========

/**
 * Convierte una fecha del input HTML date (YYYY-MM-DD) a Date local sin problemas de timezone
 */
export const htmlDateToLocalDate = (htmlDate: string): Date => {
  if (!htmlDate) return new Date();
  
  // ✅ CORRECCIÓN: Asegurar que no haya cambios de timezone
  const [year, month, day] = htmlDate.split('-').map(Number);
  // Crear fecha local exacta sin conversión de timezone
  const date = new Date(year, month - 1, day, 12, 0, 0, 0); // Usar mediodía para evitar cambios de día
  return date;
};

/**
 * Convierte una Date local a formato HTML date (YYYY-MM-DD)
 */
export const localDateToHtmlDate = (date: Date): string => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Convierte cualquier timestamp a Date JavaScript de forma segura
 * (ALIAS MEJORADO DE toJsDate para mayor claridad)
 */
export const safelyConvertToDate = (timestamp: any): Date | null => {
  return toJsDate(timestamp);
};

/**
 * Formatea una fecha para mostrar en español (DD/MM/YYYY)
 * (ALIAS MEJORADO DE formatDate para mayor claridad)
 */
export const formatDisplayDate = (dateInput: any): string => {
  return formatDate(dateInput);
};

/**
 * Formatea fecha y hora para mostrar en español
 * (ALIAS MEJORADO DE formatDateTime para mayor claridad)
 */
export const formatDisplayDateTime = (dateInput: any): string => {
  return formatDateTime(dateInput);
};

/**
 * Calcula la edad basada en la fecha de nacimiento
 */
export const calculateAge = (birthDateInput: any): number | null => {
  const birthDate = toJsDate(birthDateInput);
  
  if (!birthDate) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Verifica si una fecha está vencida (anterior a hoy)
 */
export const isExpired = (dateInput: any): boolean => {
  const date = toJsDate(dateInput);
  
  if (!date) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Inicio del día
  
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0); // Inicio del día
  
  return compareDate < today;
};

/**
 * Verifica si una fecha vence pronto (en los próximos días especificados)
 */
export const isExpiringSoon = (dateInput: any, daysAhead: number = 7): boolean => {
  const date = toJsDate(dateInput);
  
  if (!date) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);
  
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  
  return compareDate >= today && compareDate <= futureDate;
};

/**
 * Convierte Date a Timestamp de Firebase
 */
export const dateToFirebaseTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
export const getCurrentDateString = (): string => {
  return localDateToHtmlDate(new Date());
};

/**
 * Verifica si dos fechas son el mismo día
 */
export const isSameDay = (date1: any, date2: any): boolean => {
  const d1 = toJsDate(date1);
  const d2 = toJsDate(date2);
  
  if (!d1 || !d2) return false;
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

// ========== EXPORTACIÓN DEFAULT COMPLETA ==========

export default {
  // Funciones originales (compatibilidad)
  formatDate,
  formatDateTime,
  addDays,
  calculateEndDate,
  toJsDate,
  dateToString,
  
  // Nuevas funciones
  htmlDateToLocalDate,
  localDateToHtmlDate,
  safelyConvertToDate,
  formatDisplayDate,
  formatDisplayDateTime,
  calculateAge,
  isExpired,
  isExpiringSoon,
  dateToFirebaseTimestamp,
  getCurrentDateString,
  isSameDay
};

// ✅ AGREGAR ESTAS FUNCIONES AL FINAL DE tu date.utils.ts

/**
 * Convierte fecha HTML input (YYYY-MM-DD) a Date UTC para guardar en Firebase
 * Esto evita problemas de timezone
 */
export const htmlDateToUTCDate = (htmlDate: string): Date => {
  if (!htmlDate) return new Date();
  
  const [year, month, day] = htmlDate.split('-').map(Number);
  // Crear fecha en UTC para evitar cambios de timezone
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return date;
};

/**
 * Convierte un timestamp/fecha de Firebase a string HTML date sin cambios de timezone
 * ESTA ES LA FUNCIÓN CLAVE PARA SOLUCIONAR EL PROBLEMA
 */
export const firebaseDateToHtmlDate = (firebaseDate: any): string => {
  if (!firebaseDate) return '';
  
  try {
    // ✅ NUEVO: Si ya es un string en formato YYYY-MM-DD, devolverlo tal como está
    if (typeof firebaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(firebaseDate)) {
      return firebaseDate; // Ya está en el formato correcto
    }
    
    let jsDate: Date | null = null;
    
    // Si es un timestamp de Firebase
    if (firebaseDate?.toDate && typeof firebaseDate.toDate === 'function') {
      jsDate = firebaseDate.toDate();
    }
    // Si es un objeto con seconds (timestamp)
    else if (firebaseDate?.seconds) {
      jsDate = new Date(firebaseDate.seconds * 1000);
    }
    // Si es una fecha string o Date
    else {
      jsDate = new Date(firebaseDate);
    }
    
    if (jsDate && !isNaN(jsDate.getTime())) {
      // ✅ CLAVE: Usar UTC para mantener consistencia
      const year = jsDate.getUTCFullYear();
      const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jsDate.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return '';
  } catch (error) {
    console.error('Error converting Firebase date to HTML date:', error);
    return '';
  }
};

/**
 * Función helper para debug de fechas
 */
export const debugDateConversions = (originalDate: any) => {
  console.log('=== DEBUG DATE CONVERSIONS ===');
  console.log('Original date:', originalDate);
  console.log('Firebase to HTML:', firebaseDateToHtmlDate(originalDate));
  console.log('Safe convert:', safelyConvertToDate(originalDate));
  console.log('Local timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('=================================');
};