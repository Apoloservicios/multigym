// src/utils/excel.utils.ts - UTILIDADES PARA EXPORTACIÓN A EXCEL - MEJORADO Y EXTENDIDO

import * as XLSX from 'xlsx';
import { Transaction } from '../types/gym.types';
import { formatDisplayDate, formatDisplayDateTime, safelyConvertToDate } from './date.utils';
import { getCurrentDateInArgentina } from './timezone.utils';

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
 * 🔧 FUNCIÓN MEJORADA - Exportar transacciones a Excel
 * Mantiene compatibilidad con el código existente pero con mejoras
 */
export const exportTransactionsToExcel = (
  transactions: Transaction[],
  memberName: string,
  fileName?: string
): void => {
  try {
    console.log('📊 Exportando transacciones a Excel:', {
      count: transactions.length,
      memberName,
      fileName
    });

    if (!transactions.length) {
      throw new Error('No hay transacciones para exportar');
    }

    // 🆕 DATOS MEJORADOS CON MÁS INFORMACIÓN
    const excelData = transactions.map((tx, index) => ({
      '#': index + 1, // 🆕 Numeración
      'Fecha': formatDisplayDate(tx.date || tx.createdAt),
      'Hora': formatTime(tx.date || tx.createdAt), // 🆕 Hora separada
      'Concepto': tx.description || 'Sin descripción',
      'Monto': Math.abs(tx.amount), // 🔧 Siempre positivo para claridad
      'Tipo': getTransactionTypeName(tx.type), // 🆕 Nombres más claros
      'Categoría': getCategoryName(tx.category), // 🆕 Categoría
      'Método de Pago': getPaymentMethodName(tx.paymentMethod || ''),
      'Estado': getTransactionStatus(tx.status),
      'Socio': tx.memberName || 'N/A', // 🆕 Información del socio
      'Procesado Por': tx.userName || 'Sistema',
      'Notas': tx.notes || '',
      'ID': tx.id || 'N/A' // 🆕 ID para referencia
    }));

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 🔧 ANCHOS DE COLUMNA OPTIMIZADOS
    const columnWidths = [
      { wch: 5 },  // #
      { wch: 12 }, // Fecha
      { wch: 8 },  // Hora
      { wch: 35 }, // Concepto
      { wch: 12 }, // Monto
      { wch: 10 }, // Tipo
      { wch: 15 }, // Categoría
      { wch: 15 }, // Método de Pago
      { wch: 12 }, // Estado
      { wch: 20 }, // Socio
      { wch: 15 }, // Procesado Por
      { wch: 25 }, // Notas
      { wch: 15 }  // ID
    ];
    worksheet['!cols'] = columnWidths;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');
    
    // 🆕 AGREGAR HOJA DE RESUMEN FINANCIERO
    addFinancialSummarySheet(workbook, transactions, memberName);
    
    // Generar nombre de archivo con fecha
    const today = getCurrentDateInArgentina().replace(/-/g, '');
    const safeName = memberName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
    const finalFileName = fileName || `transacciones-${safeName}-${today}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
    console.log('✅ Exportación completada:', finalFileName);
    
  } catch (error) {
    console.error('❌ Error exportando a Excel:', error);
    throw new Error('Error al generar archivo Excel');
  }
};

/**
 * 🔧 FUNCIÓN MEJORADA - Exportar asistencias a Excel
 */
export const exportAttendancesToExcel = (
  attendances: AttendanceRecord[],
  memberName: string,
  fileName?: string
): void => {
  try {
    console.log('📊 Exportando asistencias a Excel:', {
      count: attendances.length,
      memberName
    });

    if (!attendances.length) {
      throw new Error('No hay asistencias para exportar');
    }

    // 🆕 DATOS MEJORADOS
    const excelData = attendances.map((attendance, index) => ({
      '#': index + 1,
      'Fecha': formatDisplayDate(attendance.timestamp),
      'Hora': formatTime(attendance.timestamp),
      'Actividad': attendance.activityName || 'General',
      'Estado': attendance.status === 'success' ? 'Exitosa' : 'Fallida',
      'Socio': attendance.memberName || `${attendance.memberFirstName} ${attendance.memberLastName}`,
      'Email': attendance.memberEmail || '', // 🆕 Email del socio
      'Notas': attendance.notes || '',
      'Registrado Por': attendance.registeredBy === 'member' ? 'Socio' : 
                        attendance.registeredByUserName || 'Gimnasio',
      'Fecha Registro': formatDisplayDateTime(attendance.createdAt || attendance.timestamp) // 🆕
    }));

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 🔧 ANCHOS OPTIMIZADOS
    const columnWidths = [
      { wch: 5 },  // #
      { wch: 12 }, // Fecha
      { wch: 8 },  // Hora
      { wch: 20 }, // Actividad
      { wch: 10 }, // Estado
      { wch: 25 }, // Socio
      { wch: 30 }, // Email
      { wch: 25 }, // Notas
      { wch: 15 }, // Registrado Por
      { wch: 18 }  // Fecha Registro
    ];
    worksheet['!cols'] = columnWidths;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencias');
    
    // 🆕 AGREGAR HOJA DE ESTADÍSTICAS DE ASISTENCIAS
    addAttendanceStatsSheet(workbook, attendances, memberName);
    
    // Generar nombre de archivo
    const today = getCurrentDateInArgentina().replace(/-/g, '');
    const safeName = memberName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
    const finalFileName = fileName || `asistencias-${safeName}-${today}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
    console.log('✅ Asistencias exportadas:', finalFileName);
    
  } catch (error) {
    console.error('❌ Error exportando asistencias a Excel:', error);
    throw new Error('Error al generar archivo Excel de asistencias');
  }
};

/**
 * 🔧 FUNCIÓN MEJORADA - Exportar reporte general a Excel con múltiples hojas
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
    
    console.log('📊 Generando reporte general:', {
      hasTransactions: !!transactions?.length,
      hasAttendances: !!attendances?.length,
      memberName
    });

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();
    
    // 📋 HOJA DE RESUMEN GENERAL (NUEVA)
    addGeneralSummarySheet(workbook, data);
    
    // Hoja de transacciones
    if (transactions && transactions.length > 0) {
      const transactionData = transactions.map((tx, index) => ({
        '#': index + 1,
        'Fecha': formatDisplayDate(tx.date || tx.createdAt),
        'Hora': formatTime(tx.date || tx.createdAt),
        'Concepto': tx.description || 'Sin descripción',
        'Monto': Math.abs(tx.amount),
        'Tipo': getTransactionTypeName(tx.type),
        'Método': getPaymentMethodName(tx.paymentMethod || ''),
        'Estado': getTransactionStatus(tx.status),
        'Procesado Por': tx.userName || 'Sistema'
      }));
      
      const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
      transactionSheet['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 35 }, { wch: 12 }, 
        { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transacciones');
    }
    
    // Hoja de asistencias
    if (attendances && attendances.length > 0) {
      const attendanceData = attendances.map((att, index) => ({
        '#': index + 1,
        'Fecha': formatDisplayDate(att.timestamp),
        'Hora': formatTime(att.timestamp),
        'Actividad': att.activityName || 'General',
        'Estado': att.status === 'success' ? 'Exitosa' : 'Fallida',
        'Registrado Por': att.registeredBy === 'member' ? 'Socio' : 
                         att.registeredByUserName || 'Gimnasio'
      }));
      
      const attendanceSheet = XLSX.utils.json_to_sheet(attendanceData);
      attendanceSheet['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Asistencias');
    }
    
    // Generar nombre de archivo
    const today = getCurrentDateInArgentina().replace(/-/g, '');
    const safeName = memberName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
    const finalFileName = fileName || `reporte-${safeName}-${today}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(workbook, finalFileName);
    
    console.log('✅ Reporte general exportado:', finalFileName);
    
  } catch (error) {
    console.error('❌ Error exportando reporte general a Excel:', error);
    throw new Error('Error al generar reporte Excel');
  }
};

/**
 * 🆕 NUEVA FUNCIÓN - Exportar datos del dashboard a Excel
 */
export const exportDashboardDataToExcel = (
  transactions: Transaction[],
  gymName: string,
  fileName?: string
): void => {
  try {
    console.log('📊 Exportando datos del dashboard:', {
      transactionCount: transactions.length,
      gymName
    });

    if (!transactions.length) {
      throw new Error('No hay datos del dashboard para exportar');
    }

    // Usar la función existente con mejoras
    exportTransactionsToExcel(transactions, gymName, fileName);
    
  } catch (error) {
    console.error('❌ Error exportando dashboard:', error);
    throw new Error('Error al exportar datos del dashboard');
  }
};

/**
 * 🆕 NUEVA FUNCIÓN - Exportar pagos pendientes a Excel
 */
export const exportPendingPaymentsToExcel = (
  pendingPayments: any[],
  gymName: string,
  fileName?: string
): void => {
  try {
    console.log('📊 Exportando pagos pendientes:', {
      count: pendingPayments.length,
      gymName
    });

    if (!pendingPayments.length) {
      throw new Error('No hay pagos pendientes para exportar');
    }

    const excelData = pendingPayments.map((payment, index) => ({
      '#': index + 1,
      'Socio': payment.memberName,
      'Email': payment.memberEmail || '',
      'Teléfono': payment.memberPhone || '',
      'Actividad/Membresía': payment.activityName,
      'Monto Adeudado': payment.cost,
      'Fecha de Inicio': formatDisplayDate(payment.startDate),
      'Fecha de Vencimiento': formatDisplayDate(payment.endDate),
      'Estado': payment.overdue ? 'Vencido' : 'Pendiente',
      'Días de Atraso': payment.daysOverdue || 0,
      'Observaciones': payment.overdue ? `Vencido hace ${payment.daysOverdue} días` : 'Al día'
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos Pendientes');

    // Agregar resumen
    const totalAmount = pendingPayments.reduce((sum, p) => sum + p.cost, 0);
    const overdueCount = pendingPayments.filter(p => p.overdue).length;
    
    const summaryData = [
      { 'Concepto': 'RESUMEN DE PAGOS PENDIENTES', 'Valor': '' },
      { 'Concepto': 'Gimnasio', 'Valor': gymName },
      { 'Concepto': 'Fecha del reporte', 'Valor': formatDisplayDate(new Date()) },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'Total de socios con deuda', 'Valor': pendingPayments.length },
      { 'Concepto': 'Socios con pagos vencidos', 'Valor': overdueCount },
      { 'Concepto': 'Socios con pagos al día', 'Valor': pendingPayments.length - overdueCount },
      { 'Concepto': 'Monto total adeudado', 'Valor': `$${totalAmount.toLocaleString('es-AR')}` }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    const today = getCurrentDateInArgentina().replace(/-/g, '');
    const finalFileName = fileName || `pagos-pendientes-${today}.xlsx`;
    
    XLSX.writeFile(workbook, finalFileName);
    console.log('✅ Pagos pendientes exportados:', finalFileName);
    
  } catch (error) {
    console.error('❌ Error exportando pagos pendientes:', error);
    throw new Error('Error al exportar pagos pendientes');
  }
};

/**
 * 🆕 FUNCIÓN HELPER - Agregar hoja de resumen financiero
 */
const addFinancialSummarySheet = (
  workbook: XLSX.WorkBook, 
  transactions: Transaction[], 
  title: string
): void => {
  const totalIngresos = transactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalEgresos = transactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReintegros = transactions
    .filter(tx => (tx.type === 'expense' && tx.category === 'refund') || tx.category === 'refund')
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const summaryData = [
    { 'Concepto': 'RESUMEN FINANCIERO', 'Valor': '' },
    { 'Concepto': 'Reporte para', 'Valor': title },
    { 'Concepto': 'Fecha de generación', 'Valor': formatDisplayDate(new Date()) },
    { 'Concepto': 'Total de transacciones', 'Valor': transactions.length },
    { 'Concepto': '', 'Valor': '' },
    { 'Concepto': 'TOTALES', 'Valor': '' },
    { 'Concepto': 'Total Ingresos', 'Valor': `$${totalIngresos.toLocaleString('es-AR')}` },
    { 'Concepto': 'Total Egresos', 'Valor': `$${totalEgresos.toLocaleString('es-AR')}` },
    { 'Concepto': 'Total Reintegros', 'Valor': `$${totalReintegros.toLocaleString('es-AR')}` },
    { 'Concepto': 'Balance Neto', 'Valor': `$${(totalIngresos - totalEgresos - totalReintegros).toLocaleString('es-AR')}` }
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen Financiero');
};

/**
 * 🆕 FUNCIÓN HELPER - Agregar hoja de estadísticas de asistencias
 */
const addAttendanceStatsSheet = (
  workbook: XLSX.WorkBook, 
  attendances: AttendanceRecord[], 
  memberName: string
): void => {
  const successfulAttendances = attendances.filter(a => a.status === 'success').length;
  const failedAttendances = attendances.filter(a => a.status === 'failed').length;
  
  const summaryData = [
    { 'Concepto': 'ESTADÍSTICAS DE ASISTENCIAS', 'Valor': '' },
    { 'Concepto': 'Socio', 'Valor': memberName },
    { 'Concepto': 'Fecha de generación', 'Valor': formatDisplayDate(new Date()) },
    { 'Concepto': '', 'Valor': '' },
    { 'Concepto': 'Total de registros', 'Valor': attendances.length },
    { 'Concepto': 'Asistencias exitosas', 'Valor': successfulAttendances },
    { 'Concepto': 'Asistencias fallidas', 'Valor': failedAttendances },
    { 'Concepto': 'Tasa de éxito', 'Valor': 
      attendances.length > 0 ? `${Math.round((successfulAttendances / attendances.length) * 100)}%` : '0%'
    }
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Estadísticas');
};

/**
 * 🆕 FUNCIÓN HELPER - Agregar hoja de resumen general
 */
const addGeneralSummarySheet = (
  workbook: XLSX.WorkBook, 
  data: {
    transactions?: Transaction[];
    attendances?: AttendanceRecord[];
    memberName: string;
    reportTitle: string;
  }
): void => {
  const { transactions, attendances, memberName, reportTitle } = data;
  
  const summaryData = [
    { 'Campo': 'REPORTE GENERAL', 'Valor': '' },
    { 'Campo': 'Título', 'Valor': reportTitle },
    { 'Campo': 'Generado para', 'Valor': memberName },
    { 'Campo': 'Fecha de generación', 'Valor': formatDisplayDate(new Date()) },
    { 'Campo': '', 'Valor': '' },
    { 'Campo': 'RESUMEN DE DATOS', 'Valor': '' },
    { 'Campo': 'Total Transacciones', 'Valor': transactions?.length || 0 },
    { 'Campo': 'Total Asistencias', 'Valor': attendances?.length || 0 }
  ];

  if (transactions?.length) {
    const totalIngresos = transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalEgresos = transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    summaryData.push(
      { 'Campo': 'Total Ingresos', 'Valor': `$${totalIngresos.toLocaleString('es-AR')}` },
      { 'Campo': 'Total Egresos', 'Valor': `$${totalEgresos.toLocaleString('es-AR')}` },
      { 'Campo': 'Balance Neto', 'Valor': `$${(totalIngresos - totalEgresos).toLocaleString('es-AR')}` }
    );
  }

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen General');
};

/**
 * 🔧 FUNCIONES AUXILIARES MEJORADAS
 */
const getTransactionTypeName = (type: string | undefined): string => {
  if (!type) return 'Desconocido';
  
  switch (type.toLowerCase()) {
    case 'income': return 'Ingreso';
    case 'expense': return 'Egreso';
    case 'refund': return 'Reintegro';
    default: return type || 'Desconocido';
  }
};

const getCategoryName = (category: string | undefined): string => {
  if (!category) return 'Sin categoría';
  
  switch (category.toLowerCase()) {
    case 'membership': return 'Membresías';
    case 'personal_training': return 'Entrenamiento Personal';
    case 'products': return 'Productos';
    case 'services': return 'Servicios';
    case 'refund': return 'Reintegros';
    case 'extra': return 'Ingresos Extra';
    case 'withdrawal': return 'Retiros';
    case 'expense': return 'Gastos';
    case 'other': return 'Otros';
    default: return category || 'Sin categoría';
  }
};

const getPaymentMethodName = (method: string | undefined): string => {
  if (!method) return 'No especificado';
  
  switch (method.toLowerCase()) {
    case 'cash': return 'Efectivo';
    case 'transfer': return 'Transferencia';
    case 'card': return 'Tarjeta';
    case 'other': return 'Otro';
    default: return method || 'No especificado';
  }
};

const getTransactionStatus = (status: string | undefined): string => {
  if (!status) return 'Desconocido';
  
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
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return '';
  }
};

// 🚀 EXPORTAR TODAS LAS FUNCIONES (manteniendo compatibilidad + nuevas)
export default {
  exportTransactionsToExcel,
  exportAttendancesToExcel,
  exportGeneralReportToExcel,
  exportDashboardDataToExcel,
  exportPendingPaymentsToExcel
};