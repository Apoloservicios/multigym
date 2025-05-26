// src/utils/attendance.utils.ts
export const generateMemberQR = (gymId: string, memberId: string): string => {
  const qrData = {
    gymId,
    memberId,
    timestamp: Date.now()
  };
  
  return Buffer.from(JSON.stringify(qrData)).toString('base64');
};

export const parseMemberQR = (qrString: string): { gymId: string; memberId: string; timestamp: number } | null => {
  try {
    const decoded = Buffer.from(qrString, 'base64').toString();
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
};

export const formatAttendanceTime = (timestamp: any): string => {
  if (!timestamp) return 'Fecha no disponible';
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Fecha inválida';
  }
};

export const calculateAttendanceRate = (attendances: number, totalMembers: number): number => {
  if (totalMembers === 0) return 0;
  return Math.round((attendances / totalMembers) * 100);
};

export const formatAttendanceDate = (date: Date): string => {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lunes como primer día
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

export const getMonthRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

export const getDayRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

export const groupAttendancesByHour = (attendances: any[]): Record<number, number> => {
  const hourlyData: Record<number, number> = {};
  
  // Inicializar todas las horas con 0
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = 0;
  }
  
  attendances.forEach(attendance => {
    try {
      const date = attendance.timestamp?.toDate ? 
        attendance.timestamp.toDate() : 
        new Date(attendance.timestamp);
      
      const hour = date.getHours();
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    } catch (error) {
      console.error('Error processing attendance timestamp:', error);
    }
  });
  
  return hourlyData;
};

export const getAttendanceStatusColor = (status: string): string => {
  switch (status) {
    case 'success':
      return 'text-green-600 bg-green-100';
    case 'failed':
      return 'text-red-600 bg-red-100';
    case 'expired':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getAttendanceStatusText = (status: string): string => {
  switch (status) {
    case 'success':
      return 'Exitosa';
    case 'failed':
      return 'Fallida';
    case 'expired':
      return 'Expirada';
    default:
      return 'Desconocido';
  }
};

export default {
  generateMemberQR,
  parseMemberQR,
  formatAttendanceTime,
  calculateAttendanceRate,
  formatAttendanceDate,
  getWeekRange,
  getMonthRange,
  getDayRange,
  groupAttendancesByHour,
  getAttendanceStatusColor,
  getAttendanceStatusText
};