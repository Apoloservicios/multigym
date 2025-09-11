// src/utils/format.utils.ts
// 🔧 UTILIDADES DE FORMATO - Funciones para formatear datos

/**
 * 💰 Formatear moneda en formato argentino
 */
export const formatCurrency = (amount: number): string => {
  if (typeof amount !== 'number') {
    return '$0';
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * 📅 Formatear fecha para mostrar
 */
export const formatDisplayDate = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateObj);
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Fecha inválida';
  }
};

/**
 * 📅 Formatear fecha y hora para mostrar
 */
export const formatDisplayDateTime = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj);
  } catch (error) {
    console.error('Error formateando fecha y hora:', error);
    return 'Fecha inválida';
  }
};

/**
 * 📊 Formatear porcentaje
 */
export const formatPercentage = (value: number): string => {
  if (typeof value !== 'number') {
    return '0%';
  }

  return `${Math.round(value)}%`;
};

/**
 * 🔢 Formatear número con separadores de miles
 */
export const formatNumber = (value: number): string => {
  if (typeof value !== 'number') {
    return '0';
  }

  return new Intl.NumberFormat('es-AR').format(value);
};

/**
 * 📝 Formatear texto truncado
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) {
    return text || '';
  }

  return text.substring(0, maxLength) + '...';
};

/**
 * 📱 Formatear teléfono
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  
  // Remover caracteres no numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Formatear según longitud
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11) {
    return `${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * 📧 Validar formato de email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 🗓️ Obtener diferencia en días entre fechas
 */
export const getDaysDifference = (date1: Date, date2: Date): number => {
  const timeDifference = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
};

/**
 * 📅 Verificar si una fecha es hoy
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * 📅 Verificar si una fecha es esta semana
 */
export const isThisWeek = (date: Date): boolean => {
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= oneWeekAgo && date <= today;
};

/**
 * 🎨 Obtener color basado en estado
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: 'text-green-600 bg-green-100',
    inactive: 'text-gray-600 bg-gray-100',
    expired: 'text-red-600 bg-red-100',
    pending: 'text-yellow-600 bg-yellow-100',
    paid: 'text-green-600 bg-green-100',
    unpaid: 'text-red-600 bg-red-100',
    cancelled: 'text-gray-600 bg-gray-100',
  };

  return colors[status.toLowerCase()] || 'text-gray-600 bg-gray-100';
};

/**
 * 📊 Formatear duración en minutos a horas y minutos
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
};

/**
 * 📱 Detectar si es dispositivo móvil
 */
export const isMobile = (): boolean => {
  return window.innerWidth <= 768;
};

/**
 * 🔤 Capitalizar primera letra
 */
export const capitalize = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * 🔤 Formatear nombre completo
 */
export const formatFullName = (firstName: string, lastName: string): string => {
  const first = capitalize(firstName || '');
  const last = capitalize(lastName || '');
  
  if (first && last) {
    return `${first} ${last}`;
  } else if (first) {
    return first;
  } else if (last) {
    return last;
  }
  
  return 'Sin nombre';
};