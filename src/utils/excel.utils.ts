// src/utils/excel.utils.ts - UTILIDADES PARA EXPORTACIÓN A EXCEL - CORREGIDO

import * as XLSX from 'xlsx';
import { Transaction } from '../types/gym.types';
import { formatDisplayDate, formatDisplayDateTime, safelyConvertToDate } from './date.utils';

// Tipo corregido para AttendanceRecord (compatible con tu proyecto)
interface AttendanceRecord {
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
  registeredBy?: 'gym' | 'member';
  registeredByUserId?: string;
  registeredByUserName?: string;
}

/**
 * Exportar transacciones a Excel
 */
export const exportTransactionsToExcel = (
  transactions: Transaction[],
  memberName: string,
  fileName?: string
): void => {
  try {
    // Preparar datos para Excel
    const excelData = transactions.map(tx => ({
      'Fecha': formatDisplayDate(tx.date),
      'Concepto': tx.description || 'Sin descripción',
      'Monto': tx.type === 'income' ? -tx.amount : tx.amount,
      'Tipo': tx.type === 'income' ? 'Ingreso' : 'Egreso',
      'Método de Pago': getPaymentMethodName(tx.paymentMethod || ''),
      'Estado': getTransactionStatus(tx.status),
      'Procesado Por': tx.userName || 'Sistema',
      'Notas': tx.notes || ''
    }));

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Configurar anchos de columna
    const columnWidths = [
      { wch: 12 }, // Fecha
      { wch: 35 }, // Concepto
      { wch: 12 }, // Monto
      { wch: 10 }, // Tipo
      { wch: 12 }, // Estado
      { wch: 20 }, // Procesado Por
      { wch: 25 }  // Notas
    ];
    worksheet['!cols'] = columnWidths;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estado de Cuenta');
    
    // Generar nombre de archivo
    const finalFileName = fileName || `estado-cuenta-${memberName.replace(/\s+/g, '-')}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    throw new Error('Error al generar archivo Excel');
  }
};

/**
 * Exportar asistencias a Excel
 */
export const exportAttendancesToExcel = (
  attendances: AttendanceRecord[],
  memberName: string,
  fileName?: string
): void => {
  try {
    // Preparar datos para Excel
    const excelData = attendances.map(attendance => ({
      'Fecha': formatDisplayDate(attendance.timestamp),
      'Hora': formatTime(attendance.timestamp),
      'Actividad': attendance.activityName || 'General',
      'Estado': attendance.status === 'success' ? 'Exitosa' : 'Fallida',
      'Notas': attendance.notes || '',
      'Registrado Por': attendance.registeredBy === 'member' ? 'Socio' : 
                        attendance.registeredByUserName || 'Gimnasio'
    }));

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Configurar anchos de columna
    const columnWidths = [
      { wch: 12 }, // Fecha
      { wch: 8 },  // Hora
      { wch: 20 }, // Actividad
      { wch: 10 }, // Estado
      { wch: 25 }, // Notas
      { wch: 15 }  // Registrado Por
    ];
    worksheet['!cols'] = columnWidths;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencias');
    
    // Generar nombre de archivo
    const finalFileName = fileName || `asistencias-${memberName.replace(/\s+/g, '-')}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
  } catch (error) {
    console.error('Error exportando asistencias a Excel:', error);
    throw new Error('Error al generar archivo Excel de asistencias');
  }
};

/**
 * Exportar reporte general a Excel con múltiples hojas
 */
export const exportGeneralReportToExcel = (
  data: {
    transactions?: Transaction[];
    attendances?: AttendanceRecord[];
    memberName: string;
    reportTitle: string;
  },
  fileName?: string
): void => {
  try {
    const { transactions, attendances, memberName, reportTitle } = data;
    
    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // Hoja de transacciones
    if (transactions && transactions.length > 0) {
      const transactionData = transactions.map(tx => ({
        'Fecha': formatDisplayDate(tx.date),
        'Concepto': tx.description || 'Sin descripción',
        'Monto': tx.type === 'income' ? -tx.amount : tx.amount,
        'Tipo': tx.type === 'income' ? 'Ingreso' : 'Egreso',
        'Método': getPaymentMethodName(tx.paymentMethod || ''),
        'Estado': getTransactionStatus(tx.status),
        'Procesado Por': tx.userName || 'Sistema'
      }));
      
      const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
      transactionSheet['!cols'] = [
        { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 10 }, 
        { wch: 15 }, { wch: 12 }, { wch: 20 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transacciones');
    }
    
    // Hoja de asistencias
    if (attendances && attendances.length > 0) {
      const attendanceData = attendances.map(att => ({
        'Fecha': formatDisplayDate(att.timestamp),
        'Hora': formatTime(att.timestamp),
        'Actividad': att.activityName || 'General',
        'Estado': att.status === 'success' ? 'Exitosa' : 'Fallida',
        'Registrado Por': att.registeredBy === 'member' ? 'Socio' : 
                         att.registeredByUserName || 'Gimnasio'
      }));
      
      const attendanceSheet = XLSX.utils.json_to_sheet(attendanceData);
      attendanceSheet['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Asistencias');
    }
    
    // Hoja de resumen
    const summaryData = [
      { 'Información': 'Socio', 'Valor': memberName },
      { 'Información': 'Fecha de Reporte', 'Valor': formatDisplayDate(new Date()) },
      { 'Información': 'Total Transacciones', 'Valor': transactions?.length || 0 },
      { 'Información': 'Total Asistencias', 'Valor': attendances?.length || 0 }
    ];
    
    if (transactions) {
      const totalIngresos = transactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const totalEgresos = transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      summaryData.push(
        { 'Información': 'Total Ingresos', 'Valor': `${totalIngresos.toLocaleString('es-AR')}` },
        { 'Información': 'Total Egresos', 'Valor': `${totalEgresos.toLocaleString('es-AR')}` },
        { 'Información': 'Balance', 'Valor': `${(totalIngresos - totalEgresos).toLocaleString('es-AR')}` }
      );
    }
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 25 }];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    
    // Generar nombre de archivo
    const finalFileName = fileName || `reporte-${memberName.replace(/\s+/g, '-')}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
  } catch (error) {
    console.error('Error exportando reporte general a Excel:', error);
    throw new Error('Error al generar reporte Excel');
  }
};

/**
 * Funciones auxiliares
 */
const getPaymentMethodName = (method: string): string => {
  switch (method.toLowerCase()) {
    case 'cash': return 'Efectivo';
    case 'transfer': return 'Transferencia';
    case 'card': return 'Tarjeta';
    default: return method || 'No especificado';
  }
};

const getTransactionStatus = (status: string): string => {
  switch (status) {
    case 'completed': return 'Completado';
    case 'pending': return 'Pendiente';
    case 'cancelled': return 'Cancelado';
    case 'refunded': return 'Reembolsado';
    default: return status || 'Desconocido';
  }
};

const formatTime = (timestamp: any): string => {
  const date = safelyConvertToDate(timestamp);
  
  if (!date) return '';
  
  try {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '';
  }
};

export default {
  exportTransactionsToExcel,
  exportAttendancesToExcel,
  exportGeneralReportToExcel
};