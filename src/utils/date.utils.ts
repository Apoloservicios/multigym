// src/utils/date.utils.ts
import { FirebaseDate } from '../types/firebase.types';

/**
 * Convierte cualquier fecha de Firebase a un objeto Date estándar
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

// Función segura para formatear fechas
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

// Función segura para formatear fecha y hora
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

// Función para agregar días a una fecha
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Función para calcular fecha de finalización basada en una fecha de inicio y duración
export const calculateEndDate = (startDate: Date | string, durationDays: number): Date => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  return addDays(start, durationDays);
};

// Función para convertir fecha a string YYYY-MM-DD (para inputs de tipo date)
export const dateToString = (date: FirebaseDate): string => {
  const jsDate = toJsDate(date);
  if (!jsDate) return '';
  
  return jsDate.toISOString().split('T')[0];
};

// Exportaciones por defecto para mantener compatibilidad
export default {
  formatDate,
  formatDateTime,
  addDays,
  calculateEndDate,
  toJsDate,
  dateToString
};