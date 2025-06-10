// src/utils/timezone.utils.ts - UTILIDADES CENTRALIZADAS PARA ZONA HORARIA ARGENTINA

import { Timestamp } from 'firebase/firestore';

// Zona horaria de Argentina
const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la fecha actual en Argentina en formato YYYY-MM-DD
 */
export const getCurrentDateInArgentina = (): string => {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  
  const year = argentinaTime.getFullYear();
  const month = String(argentinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(argentinaTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la hora actual en Argentina en formato HH:MM
 */
export const getCurrentTimeInArgentina = (): string => {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  
  return argentinaTime.toLocaleTimeString('es-AR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * Obtiene la fecha y hora completa actual en Argentina
 */
export const getCurrentDateTimeInArgentina = (): Date => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
};

/**
 * Verifica si una fecha (YYYY-MM-DD) es hoy en Argentina
 */
export const isTodayInArgentina = (dateString: string): boolean => {
  return dateString === getCurrentDateInArgentina();
};

/**
 * Convierte una fecha local a un Timestamp de Firebase ajustado para Argentina
 */
export const createArgentinianTimestamp = (date?: Date): Timestamp => {
  if (!date) {
    date = getCurrentDateTimeInArgentina();
  }
  
  // Si la fecha no tiene información de zona horaria, asumimos que es Argentina
  const argentinaDate = new Date(date.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  return Timestamp.fromDate(argentinaDate);
};

/**
 * Convierte un Timestamp de Firebase a fecha local argentina
 */
export const timestampToArgentinianDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  try {
    let jsDate: Date;
    
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      jsDate = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      jsDate = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      jsDate = new Date(timestamp);
    } else if (timestamp.seconds && typeof timestamp.seconds === 'number') {
      jsDate = new Date(timestamp.seconds * 1000);
    } else {
      return null;
    }
    
    // Convertir a hora argentina
    return new Date(jsDate.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  } catch (error) {
    console.error('Error converting timestamp to Argentinian date:', error);
    return null;
  }
};

/**
 * Formatea una fecha en zona horaria argentina
 */
export const formatArgentinianDate = (date: Date | any, options?: Intl.DateTimeFormatOptions): string => {
  let jsDate: Date | null = null;
  
  if (date instanceof Date) {
    jsDate = date;
  } else {
    jsDate = timestampToArgentinianDate(date);
  }
  
  if (!jsDate) return 'Fecha no disponible';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ARGENTINA_TIMEZONE
  };
  
  try {
    return jsDate.toLocaleDateString('es-AR', { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Error formatting Argentinian date:', error);
    return 'Fecha inválida';
  }
};

/**
 * Formatea fecha y hora en zona horaria argentina
 */
export const formatArgentinianDateTime = (date: Date | any): string => {
  return formatArgentinianDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Formatea solo la hora en zona horaria argentina
 */
export const formatArgentinianTime = (date: Date | any): string => {
  let jsDate: Date | null = null;
  
  if (date instanceof Date) {
    jsDate = date;
  } else {
    jsDate = timestampToArgentinianDate(date);
  }
  
  if (!jsDate) return 'Hora no disponible';
  
  try {
    return jsDate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: ARGENTINA_TIMEZONE
    });
  } catch (error) {
    console.error('Error formatting Argentinian time:', error);
    return 'Hora inválida';
  }
};

/**
 * Crea un rango de fechas para un día específico en Argentina
 */
export const getArgentinianDayRange = (dateString: string): { start: Timestamp; end: Timestamp } => {
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Crear fechas en Argentina
  const startOfDay = new Date();
  startOfDay.setFullYear(year, month - 1, day);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setFullYear(year, month - 1, day);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Convertir a timestamps considerando zona horaria
  const argStartOfDay = new Date(startOfDay.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  const argEndOfDay = new Date(endOfDay.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }));
  
  return {
    start: Timestamp.fromDate(argStartOfDay),
    end: Timestamp.fromDate(argEndOfDay)
  };
};

/**
 * Obtiene el inicio del día actual en Argentina como Timestamp
 */
export const getTodayStartInArgentina = (): Timestamp => {
  const today = getCurrentDateInArgentina();
  return getArgentinianDayRange(today).start;
};

/**
 * Obtiene el final del día actual en Argentina como Timestamp
 */
export const getTodayEndInArgentina = (): Timestamp => {
  const today = getCurrentDateInArgentina();
  return getArgentinianDayRange(today).end;
};

/**
 * Obtiene el inicio del mes actual en Argentina como Timestamp
 */
export const getThisMonthStartInArgentina = (): Timestamp => {
  const now = getCurrentDateTimeInArgentina();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  
  return Timestamp.fromDate(firstDayOfMonth);
};

/**
 * Convierte fecha YYYY-MM-DD a display DD/MM/YYYY
 */
export const formatDateForDisplay = (dateString: string): string => {
  try {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date for display:', error);
    return dateString;
  }
};

/**
 * Verifica si un timestamp está en un día específico de Argentina
 */
export const isTimestampInArgentinianDate = (timestamp: any, dateString: string): boolean => {
  const jsDate = timestampToArgentinianDate(timestamp);
  if (!jsDate) return false;
  
  const timestampDate = jsDate.toISOString().split('T')[0];
  return timestampDate === dateString;
};

/**
 * Obtiene información de zona horaria para debugging
 */
export const getTimezoneInfo = () => {
  const now = new Date();
  const utcTime = now.toISOString();
  const argTime = now.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE });
  const localTime = now.toLocaleString();
  
  return {
    utc: utcTime,
    argentina: argTime,
    local: localTime,
    argentinaDate: getCurrentDateInArgentina(),
    argentinaTime: getCurrentTimeInArgentina()
  };
};

export default {
  getCurrentDateInArgentina,
  getCurrentTimeInArgentina,
  getCurrentDateTimeInArgentina,
  isTodayInArgentina,
  createArgentinianTimestamp,
  timestampToArgentinianDate,
  formatArgentinianDate,
  formatArgentinianDateTime,
  formatArgentinianTime,
  getArgentinianDayRange,
  getTodayStartInArgentina,
  getTodayEndInArgentina,
  getThisMonthStartInArgentina,
  formatDateForDisplay,
  isTimestampInArgentinianDate,
  getTimezoneInfo
};