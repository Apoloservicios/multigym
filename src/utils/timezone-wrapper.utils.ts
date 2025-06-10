// src/utils/timezone-wrapper.utils.ts - Wrapper para compatibilidad

import {
  getCurrentDateInArgentina as getArgDate,
  getCurrentTimeInArgentina as getArgTime,
  isTodayInArgentina as isTodayArg,
  formatDateForDisplay as formatDisplay,
  getArgentinianDayRange as getDayRange
} from './timezone.utils';

// Re-exportar las funciones con nombres consistentes
export const getCurrentDateInArgentina = getArgDate;
export const getCurrentTimeInArgentina = getArgTime;
export const isTodayInArgentina = isTodayArg;
export const formatDateForDisplay = formatDisplay;
export const getArgentinianDayRange = getDayRange;

// Función adicional para debug
export const getTimezoneDebugInfo = () => {
  const now = new Date();
  
  return {
    utc: now.toISOString(),
    local: now.toLocaleString(),
    localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    argentina: {
      date: getCurrentDateInArgentina(),
      time: getCurrentTimeInArgentina(),
      full: new Date(now.toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires"
      })).toLocaleString()
    }
  };
};

export default {
  getCurrentDateInArgentina,
  getCurrentTimeInArgentina,
  isTodayInArgentina,
  formatDateForDisplay,
  getArgentinianDayRange,
  getTimezoneDebugInfo
};