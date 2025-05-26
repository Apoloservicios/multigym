// src/utils/formatting.utils.ts - VERSIÓN COMPLETAMENTE CORREGIDA

// ============ FUNCIONES EXISTENTES (mejoradas) ============

// Formatear un número como moneda - MEJORADA
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0';
  }
  
  try {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 // Cambiado para mostrar centavos cuando sea necesario
    });
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `$${amount}`;
  }
};

// Formatear un número de teléfono
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  try {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  } catch (error) {
    console.error('Error formatting phone:', error);
    return phone;
  }
};

// Formatear un CUIT
export const formatCUIT = (cuit: string | null | undefined): string => {
  if (!cuit) return '';
  
  try {
    const cleaned = cuit.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
    }
    
    return cuit;
  } catch (error) {
    console.error('Error formatting CUIT:', error);
    return cuit;
  }
};

// ============ NUEVAS FUNCIONES PARA FIREBASE TIMESTAMPS ============

// Función segura para convertir Timestamps de Firebase a Date
export const toJavaScriptDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  try {
    // Si ya es un Date, devolverlo
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Si es un Timestamp de Firebase
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Si es un string o número, intentar convertir
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const dateObj = new Date(timestamp);
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
    
    // Si tiene la propiedad seconds (Timestamp serializado)
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
    
    return null;
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return null;
  }
};

// Función específica para formatear timestamps de Firebase
export const formatFirebaseTimestamp = (timestamp: any, options?: Intl.DateTimeFormatOptions): string => {
  const jsDate = toJavaScriptDate(timestamp);
  
  if (!jsDate) return 'Fecha no disponible';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  try {
    return jsDate.toLocaleString('es-AR', { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Error formatting firebase timestamp:', error);
    return 'Fecha inválida';
  }
};

// ============ NUEVAS FUNCIONES FINANCIERAS ============

// Formatear fecha simple (DD/MM/YYYY) - CORREGIDA
export const formatDate = (dateInput: Date | string | any | null | undefined): string => {
  const jsDate = toJavaScriptDate(dateInput);
  
  if (!jsDate) return 'Fecha no disponible';
  
  try {
    return jsDate.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
};

// Formatear fecha y hora completa (DD/MM/YYYY HH:MM) - CORREGIDA
export const formatDateTime = (dateInput: Date | string | any | null | undefined): string => {
  const jsDate = toJavaScriptDate(dateInput);
  
  if (!jsDate) return 'Fecha no disponible';
  
  try {
    return jsDate.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return 'Fecha inválida';
  }
};

// Formatear solo la hora (HH:MM) - CORREGIDA
export const formatTime = (dateInput: Date | string | any | null | undefined): string => {
  const jsDate = toJavaScriptDate(dateInput);
  
  if (!jsDate) return 'Hora no disponible';
  
  try {
    return jsDate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Hora inválida';
  }
};

// Formatear método de pago en español
export const formatPaymentMethod = (method: string | null | undefined): string => {
  if (!method) return 'No especificado';
  
  const methods: { [key: string]: string } = {
    'cash': 'Efectivo',
    'card': 'Tarjeta',
    'transfer': 'Transferencia',
    'debit': 'Débito',
    'credit': 'Crédito',
    'other': 'Otro',
    'crypto': 'Criptomoneda',
    'check': 'Cheque'
  };
  
  return methods[method.toLowerCase()] || method;
};

// Formatear estado de pago
export const formatPaymentStatus = (status: string | null | undefined): {
  text: string;
  color: string;
  bgColor: string;
} => {
  if (!status) return { text: 'Sin estado', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  
  const statusMap: { [key: string]: { text: string; color: string; bgColor: string } } = {
    'completed': { text: 'Completado', color: 'text-green-700', bgColor: 'bg-green-100' },
    'pending': { text: 'Pendiente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    'failed': { text: 'Fallido', color: 'text-red-700', bgColor: 'bg-red-100' },
    'refunded': { text: 'Devuelto', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    'cancelled': { text: 'Cancelado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    'partial': { text: 'Parcial', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    'paid': { text: 'Pagado', color: 'text-green-700', bgColor: 'bg-green-100' },
    'overdue': { text: 'Vencido', color: 'text-red-700', bgColor: 'bg-red-100' }
  };
  
  return statusMap[status.toLowerCase()] || { 
    text: status, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100' 
  };
};

// Formatear tipo de transacción
export const formatTransactionType = (type: string | null | undefined): string => {
  if (!type) return 'Sin tipo';
  
  const types: { [key: string]: string } = {
    'membership_payment': 'Pago de membresía',
    'penalty': 'Multa',
    'refund': 'Devolución',
    'other_income': 'Otro ingreso',
    'expense': 'Gasto',
    'enrollment': 'Inscripción',
    'upgrade': 'Upgrade',
    'discount': 'Descuento'
  };
  
  return types[type] || type;
};

// Formatear porcentaje
export const formatPercentage = (value: number | null | undefined, decimals: number = 1): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  try {
    return `${value.toFixed(decimals)}%`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '0%';
  }
};

// Formatear número con separadores de miles
export const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  try {
    return value.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (error) {
    console.error('Error formatting number:', error);
    return value.toString();
  }
};

// Formatear duración en días
export const formatDuration = (days: number | null | undefined): string => {
  if (!days || days <= 0) return 'Sin duración';
  
  if (days === 1) return '1 día';
  if (days < 7) return `${days} días`;
  if (days === 7) return '1 semana';
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  if (days === 30) return '1 mes';
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  
  if (remainingDays === 0) {
    return years === 1 ? '1 año' : `${years} años`;
  }
  
  const months = Math.floor(remainingDays / 30);
  if (months === 0) {
    return years === 1 ? '1 año' : `${years} años`;
  }
  
  return `${years} año${years > 1 ? 's' : ''} y ${months} mes${months > 1 ? 'es' : ''}`;
};

// Función para obtener tiempo relativo (hace X tiempo)
export const formatRelativeTime = (dateInput: Date | string | any | null | undefined): string => {
  const jsDate = toJavaScriptDate(dateInput);
  
  if (!jsDate) return 'Fecha no disponible';
  
  try {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - jsDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Hace un momento';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    if (diffInSeconds < 604800) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
    
    return formatDate(jsDate);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Fecha inválida';
  }
};

// Función para truncar texto largo
export const truncateText = (text: string | null | undefined, maxLength: number = 50): string => {
  if (!text) return '';
  
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
};

// Formatear saldo/balance con color
export const formatBalance = (amount: number | null | undefined): {
  formatted: string;
  color: string;
  isPositive: boolean;
} => {
  const formatted = formatCurrency(amount);
  const isPositive = (amount || 0) >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  
  return { formatted, color, isPositive };
};

// ============ OBJETO EXPORTADO (manteniendo compatibilidad) ============

const formattingUtils = {
  // Funciones existentes
  formatCurrency,
  formatPhone,
  formatCUIT,
  
  // Nuevas funciones financieras
  formatDate,
  formatDateTime,
  formatTime,
  formatPaymentMethod,
  formatPaymentStatus,
  formatTransactionType,
  formatPercentage,
  formatNumber,
  formatDuration,
  formatRelativeTime,
  truncateText,
  formatBalance,
  
  // Nuevas funciones para Firebase
  toJavaScriptDate,
  formatFirebaseTimestamp
};

export default formattingUtils;