// src/services/excelReportService.ts
// SERVICIO COMPLETO DE GENERACIÓN DE REPORTES EXCEL

import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentDateInArgentina } from '../utils/timezone.utils';

interface MembershipReportData {
  socioId: string;
  socioNombre: string;
  socioEmail: string;
  socioTelefono: string;
  actividad: string;
  fechaInicio: string;
  fechaVencimiento: string;
  costo: number;
  estado: string;
  estadoPago: string;
  autoRenovacion: boolean;
  asistenciasActuales: number;
  asistenciasMaximas: number;
  diasRestantes: number;
  observaciones: string;
}

interface RenewalReportData {
  fecha: string;
  socioNombre: string;
  actividad: string;
  tipoRenovacion: string;
  costoAnterior: number;
  costoNuevo: number;
  cambioPrecio: boolean;
  estado: string;
  observaciones: string;
}

class ExcelReportService {
  /**
   * Generar reporte mensual de membresías
   */
  async generateMonthlyMembershipReport(gymId: string, selectedMonth: string): Promise<void> {
    try {
      console.log('📊 Generando reporte de membresías para:', selectedMonth);
      
      // Obtener datos de membresías
      const membershipsData = await this.fetchMembershipsData(gymId, selectedMonth);
      
      if (membershipsData.length === 0) {
        throw new Error('No hay datos de membresías para el período seleccionado');
      }
      
      // Crear libro de Excel
      const workbook = XLSX.utils.book_new();
      
      // Hoja principal de membresías
      const mainSheet = this.createMembershipsSheet(membershipsData);
      XLSX.utils.book_append_sheet(workbook, mainSheet, 'Membresías');
      
      // Hoja de resumen estadístico
      const summarySheet = this.createSummarySheet(membershipsData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
      
      // Hoja de membresías vencidas
      const expiredSheet = this.createExpiredSheet(membershipsData);
      XLSX.utils.book_append_sheet(workbook, expiredSheet, 'Vencidas');
      
      // Generar nombre de archivo
      const [year, month] = selectedMonth.split('-');
      const monthName = this.getMonthName(parseInt(month));
      const fileName = `Reporte_Membresias_${monthName}_${year}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(workbook, fileName);
      
      console.log('✅ Reporte de membresías generado:', fileName);
      
    } catch (error) {
      console.error('❌ Error generando reporte de membresías:', error);
      throw error;
    }
  }
  
  /**
   * Generar reporte de renovaciones
   */
  async generateRenewalReport(gymId: string, selectedMonth: string): Promise<void> {
    try {
      console.log('📊 Generando reporte de renovaciones para:', selectedMonth);
      
      // Obtener datos de renovaciones
      const renewalsData = await this.fetchRenewalsData(gymId, selectedMonth);
      
      // Crear libro de Excel
      const workbook = XLSX.utils.book_new();
      
      // Hoja principal de renovaciones
      const mainSheet = this.createRenewalsSheet(renewalsData);
      XLSX.utils.book_append_sheet(workbook, mainSheet, 'Renovaciones');
      
      // Hoja de estadísticas de renovación
      const statsSheet = this.createRenewalStatsSheet(renewalsData);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estadísticas');
      
      // Generar nombre de archivo
      const [year, month] = selectedMonth.split('-');
      const monthName = this.getMonthName(parseInt(month));
      const fileName = `Reporte_Renovaciones_${monthName}_${year}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(workbook, fileName);
      
      console.log('✅ Reporte de renovaciones generado:', fileName);
      
    } catch (error) {
      console.error('❌ Error generando reporte de renovaciones:', error);
      throw error;
    }
  }
  
  /**
   * Obtener datos de membresías desde Firebase
   */
  private async fetchMembershipsData(gymId: string, selectedMonth: string): Promise<MembershipReportData[]> {
    const membershipsData: MembershipReportData[] = [];
    
    try {
      // Obtener socios
      const membersRef = collection(db, 'gyms', gymId, 'members');
      const membersSnapshot = await getDocs(query(membersRef, orderBy('lastName')));
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        // Obtener membresías del socio
        const membershipsRef = collection(db, 'gyms', gymId, 'members', memberDoc.id, 'memberships');
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data();
          
          // Calcular días restantes
          const today = new Date();
          const endDate = new Date(membership.endDate);
          const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Determinar estado
          let status = 'Activa';
          if (membership.status === 'cancelled') {
            status = 'Cancelada';
          } else if (daysRemaining < 0) {
            status = 'Vencida';
          } else if (daysRemaining <= 7) {
            status = 'Por vencer';
          }
          
          membershipsData.push({
            socioId: memberDoc.id,
            socioNombre: `${memberData.firstName} ${memberData.lastName}`,
            socioEmail: memberData.email || '',
            socioTelefono: memberData.phone || '',
            actividad: membership.activityName || '',
            fechaInicio: membership.startDate || '',
            fechaVencimiento: membership.endDate || '',
            costo: membership.cost || 0,
            estado: status,
            estadoPago: membership.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente',
            autoRenovacion: membership.autoRenewal || false,
            asistenciasActuales: membership.currentAttendances || 0,
            asistenciasMaximas: membership.maxAttendances || 0,
            diasRestantes: Math.max(0, daysRemaining),
            observaciones: membership.notes || ''
          });
        }
      }
      
      return membershipsData;
      
    } catch (error) {
      console.error('Error obteniendo datos de membresías:', error);
      return membershipsData;
    }
  }
  
  /**
   * Obtener datos de renovaciones desde Firebase
   */
  private async fetchRenewalsData(gymId: string, selectedMonth: string): Promise<RenewalReportData[]> {
    const renewalsData: RenewalReportData[] = [];
    
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      
      // Obtener logs de renovación si existen
      const logsRef = collection(db, 'gyms', gymId, 'renewalLogs');
      const logsQuery = query(
        logsRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'desc')
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      
      for (const logDoc of logsSnapshot.docs) {
        const log = logDoc.data();
        
        renewalsData.push({
          fecha: log.createdAt?.toDate?.()?.toLocaleDateString('es-AR') || '',
          socioNombre: log.memberName || 'Desconocido',
          actividad: log.activityName || '',
          tipoRenovacion: log.isAutomatic ? 'Automática' : 'Manual',
          costoAnterior: log.previousCost || 0,
          costoNuevo: log.newCost || 0,
          cambioPrecio: (log.previousCost !== log.newCost),
          estado: log.success ? 'Exitosa' : 'Fallida',
          observaciones: log.error || log.notes || ''
        });
      }
      
      // Si no hay logs, generar datos simulados basados en las transacciones
      if (renewalsData.length === 0) {
        const transactionsRef = collection(db, 'gyms', gymId, 'transactions');
        const transQuery = query(
          transactionsRef,
          where('category', '==', 'membership'),
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(endDate)),
          orderBy('date', 'desc')
        );
        
        const transSnapshot = await getDocs(transQuery);
        
        for (const transDoc of transSnapshot.docs) {
          const trans = transDoc.data();
          
          if (trans.description?.includes('Renovación')) {
            renewalsData.push({
              fecha: trans.date?.toDate?.()?.toLocaleDateString('es-AR') || '',
              socioNombre: trans.memberName || 'Desconocido',
              actividad: trans.description?.split('-')[1]?.trim() || '',
              tipoRenovacion: 'Manual',
              costoAnterior: trans.amount || 0,
              costoNuevo: trans.amount || 0,
              cambioPrecio: false,
              estado: 'Exitosa',
              observaciones: trans.notes || ''
            });
          }
        }
      }
      
      return renewalsData;
      
    } catch (error) {
      console.error('Error obteniendo datos de renovaciones:', error);
      return renewalsData;
    }
  }
  
  /**
   * Crear hoja principal de membresías
   */
  private createMembershipsSheet(data: MembershipReportData[]): XLSX.WorkSheet {
    const sheetData = data.map(item => ({
      'ID Socio': item.socioId,
      'Nombre': item.socioNombre,
      'Email': item.socioEmail,
      'Teléfono': item.socioTelefono,
      'Actividad': item.actividad,
      'Fecha Inicio': item.fechaInicio,
      'Fecha Vencimiento': item.fechaVencimiento,
      'Días Restantes': item.diasRestantes,
      'Costo': item.costo,
      'Estado': item.estado,
      'Estado de Pago': item.estadoPago,
      'Auto-renovación': item.autoRenovacion ? 'Sí' : 'No',
      'Asistencias': `${item.asistenciasActuales}/${item.asistenciasMaximas}`,
      'Observaciones': item.observaciones
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 15 }, // ID Socio
      { wch: 25 }, // Nombre
      { wch: 25 }, // Email
      { wch: 15 }, // Teléfono
      { wch: 20 }, // Actividad
      { wch: 12 }, // Fecha Inicio
      { wch: 12 }, // Fecha Vencimiento
      { wch: 12 }, // Días Restantes
      { wch: 10 }, // Costo
      { wch: 12 }, // Estado
      { wch: 12 }, // Estado de Pago
      { wch: 12 }, // Auto-renovación
      { wch: 12 }, // Asistencias
      { wch: 30 }  // Observaciones
    ];
    
    return worksheet;
  }
  
  /**
   * Crear hoja de resumen estadístico
   */
  private createSummarySheet(data: MembershipReportData[]): XLSX.WorkSheet {
    const totalMemberships = data.length;
    const activeMemberships = data.filter(m => m.estado === 'Activa').length;
    const expiredMemberships = data.filter(m => m.estado === 'Vencida').length;
    const expiringMemberships = data.filter(m => m.estado === 'Por vencer').length;
    const paidMemberships = data.filter(m => m.estadoPago === 'Pagado').length;
    const pendingMemberships = data.filter(m => m.estadoPago === 'Pendiente').length;
    const withAutoRenewal = data.filter(m => m.autoRenovacion).length;
    
    // Calcular ingresos
    const totalIncome = data.reduce((sum, m) => sum + m.costo, 0);
    const paidIncome = data.filter(m => m.estadoPago === 'Pagado')
      .reduce((sum, m) => sum + m.costo, 0);
    const pendingIncome = data.filter(m => m.estadoPago === 'Pendiente')
      .reduce((sum, m) => sum + m.costo, 0);
    
    // Agrupar por actividad
    const byActivity: { [key: string]: number } = {};
    data.forEach(m => {
      byActivity[m.actividad] = (byActivity[m.actividad] || 0) + 1;
    });
    
    // Crear datos para la hoja
    const summaryData = [
      { 'Métrica': 'RESUMEN GENERAL', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'Total de Membresías', 'Valor': totalMemberships, 'Porcentaje': '100%' },
      { 'Métrica': 'Membresías Activas', 'Valor': activeMemberships, 'Porcentaje': `${((activeMemberships / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': 'Membresías Vencidas', 'Valor': expiredMemberships, 'Porcentaje': `${((expiredMemberships / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': 'Por Vencer (7 días)', 'Valor': expiringMemberships, 'Porcentaje': `${((expiringMemberships / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': '', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'ESTADO DE PAGOS', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'Pagadas', 'Valor': paidMemberships, 'Porcentaje': `${((paidMemberships / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': 'Pendientes', 'Valor': pendingMemberships, 'Porcentaje': `${((pendingMemberships / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': 'Con Auto-renovación', 'Valor': withAutoRenewal, 'Porcentaje': `${((withAutoRenewal / totalMemberships) * 100).toFixed(1)}%` },
      { 'Métrica': '', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'RESUMEN FINANCIERO', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'Ingresos Totales', 'Valor': `${totalIncome.toLocaleString('es-AR')}`, 'Porcentaje': '100%' },
      { 'Métrica': 'Ingresos Cobrados', 'Valor': `${paidIncome.toLocaleString('es-AR')}`, 'Porcentaje': `${((paidIncome / totalIncome) * 100).toFixed(1)}%` },
      { 'Métrica': 'Ingresos Pendientes', 'Valor': `${pendingIncome.toLocaleString('es-AR')}`, 'Porcentaje': `${((pendingIncome / totalIncome) * 100).toFixed(1)}%` },
      { 'Métrica': '', 'Valor': '', 'Porcentaje': '' },
      { 'Métrica': 'POR ACTIVIDAD', 'Valor': '', 'Porcentaje': '' }
    ];
    
    // Agregar desglose por actividad
    Object.entries(byActivity).forEach(([activity, count]) => {
      summaryData.push({
        'Métrica': activity,
        'Valor': count,
        'Porcentaje': `${((count / totalMemberships) * 100).toFixed(1)}%`
      });
    });
    
    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 30 }, // Métrica
      { wch: 20 }, // Valor
      { wch: 15 }  // Porcentaje
    ];
    
    return worksheet;
  }
  
  /**
   * Crear hoja de membresías vencidas
   */
  private createExpiredSheet(data: MembershipReportData[]): XLSX.WorkSheet {
    const expiredData = data
      .filter(m => m.estado === 'Vencida' || m.estado === 'Por vencer')
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .map(item => ({
        'Nombre': item.socioNombre,
        'Teléfono': item.socioTelefono,
        'Actividad': item.actividad,
        'Fecha Vencimiento': item.fechaVencimiento,
        'Días Vencida': item.diasRestantes < 0 ? Math.abs(item.diasRestantes) : 0,
        'Días para Vencer': item.diasRestantes >= 0 ? item.diasRestantes : 0,
        'Costo Mensual': item.costo,
        'Deuda Estimada': item.diasRestantes < 0 ? item.costo * Math.ceil(Math.abs(item.diasRestantes) / 30) : 0,
        'Auto-renovación': item.autoRenovacion ? 'Sí' : 'No',
        'Acción Requerida': item.autoRenovacion ? 'Se renovará automáticamente' : 'Requiere renovación manual'
      }));
    
    if (expiredData.length === 0) {
      return XLSX.utils.json_to_sheet([
        { 'Estado': 'No hay membresías vencidas o por vencer' }
      ]);
    }
    
    const worksheet = XLSX.utils.json_to_sheet(expiredData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 25 }, // Nombre
      { wch: 15 }, // Teléfono
      { wch: 20 }, // Actividad
      { wch: 15 }, // Fecha Vencimiento
      { wch: 12 }, // Días Vencida
      { wch: 12 }, // Días para Vencer
      { wch: 12 }, // Costo Mensual
      { wch: 15 }, // Deuda Estimada
      { wch: 12 }, // Auto-renovación
      { wch: 30 }  // Acción Requerida
    ];
    
    return worksheet;
  }
  
  /**
   * Crear hoja de renovaciones
   */
  private createRenewalsSheet(data: RenewalReportData[]): XLSX.WorkSheet {
    if (data.length === 0) {
      return XLSX.utils.json_to_sheet([
        { 'Estado': 'No hay renovaciones registradas para este período' }
      ]);
    }
    
    const sheetData = data.map(item => ({
      'Fecha': item.fecha,
      'Socio': item.socioNombre,
      'Actividad': item.actividad,
      'Tipo': item.tipoRenovacion,
      'Costo Anterior': `${item.costoAnterior}`,
      'Costo Nuevo': `${item.costoNuevo}`,
      'Cambio de Precio': item.cambioPrecio ? 'Sí' : 'No',
      'Diferencia': item.cambioPrecio ? `${item.costoNuevo - item.costoAnterior}` : '-',
      'Estado': item.estado,
      'Observaciones': item.observaciones
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 25 }, // Socio
      { wch: 20 }, // Actividad
      { wch: 12 }, // Tipo
      { wch: 15 }, // Costo Anterior
      { wch: 15 }, // Costo Nuevo
      { wch: 15 }, // Cambio de Precio
      { wch: 12 }, // Diferencia
      { wch: 10 }, // Estado
      { wch: 30 }  // Observaciones
    ];
    
    return worksheet;
  }
  
  /**
   * Crear hoja de estadísticas de renovación
   */
  private createRenewalStatsSheet(data: RenewalReportData[]): XLSX.WorkSheet {
    const totalRenewals = data.length;
    const successfulRenewals = data.filter(r => r.estado === 'Exitosa').length;
    const failedRenewals = data.filter(r => r.estado === 'Fallida').length;
    const automaticRenewals = data.filter(r => r.tipoRenovacion === 'Automática').length;
    const manualRenewals = data.filter(r => r.tipoRenovacion === 'Manual').length;
    const withPriceChange = data.filter(r => r.cambioPrecio).length;
    
    // Calcular montos
    const totalAmount = data
      .filter(r => r.estado === 'Exitosa')
      .reduce((sum, r) => sum + r.costoNuevo, 0);
    
    const priceIncreases = data
      .filter(r => r.cambioPrecio && r.costoNuevo > r.costoAnterior)
      .reduce((sum, r) => sum + (r.costoNuevo - r.costoAnterior), 0);
    
    // Agrupar por actividad
    const byActivity: { [key: string]: number } = {};
    data.forEach(r => {
      if (r.actividad) {
        byActivity[r.actividad] = (byActivity[r.actividad] || 0) + 1;
      }
    });
    
    const statsData = [
      { 'Estadística': 'RESUMEN DE RENOVACIONES', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'Total de Renovaciones', 'Valor': totalRenewals, 'Detalle': '100%' },
      { 'Estadística': 'Renovaciones Exitosas', 'Valor': successfulRenewals, 'Detalle': `${((successfulRenewals / totalRenewals) * 100).toFixed(1)}%` },
      { 'Estadística': 'Renovaciones Fallidas', 'Valor': failedRenewals, 'Detalle': `${((failedRenewals / totalRenewals) * 100).toFixed(1)}%` },
      { 'Estadística': '', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'TIPO DE RENOVACIÓN', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'Automáticas', 'Valor': automaticRenewals, 'Detalle': `${((automaticRenewals / totalRenewals) * 100).toFixed(1)}%` },
      { 'Estadística': 'Manuales', 'Valor': manualRenewals, 'Detalle': `${((manualRenewals / totalRenewals) * 100).toFixed(1)}%` },
      { 'Estadística': 'Con Cambio de Precio', 'Valor': withPriceChange, 'Detalle': `${((withPriceChange / totalRenewals) * 100).toFixed(1)}%` },
      { 'Estadística': '', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'RESUMEN FINANCIERO', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'Monto Total Renovado', 'Valor': `${totalAmount.toLocaleString('es-AR')}`, 'Detalle': 'Renovaciones exitosas' },
      { 'Estadística': 'Incremento por Cambio de Precios', 'Valor': `${priceIncreases.toLocaleString('es-AR')}`, 'Detalle': 'Adicional por ajustes' },
      { 'Estadística': '', 'Valor': '', 'Detalle': '' },
      { 'Estadística': 'RENOVACIONES POR ACTIVIDAD', 'Valor': '', 'Detalle': '' }
    ];
    
    // Agregar desglose por actividad
    Object.entries(byActivity).forEach(([activity, count]) => {
      statsData.push({
        'Estadística': activity,
        'Valor': count,
        'Detalle': `${((count / totalRenewals) * 100).toFixed(1)}%`
      });
    });
    
    const worksheet = XLSX.utils.json_to_sheet(statsData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 35 }, // Estadística
      { wch: 20 }, // Valor
      { wch: 25 }  // Detalle
    ];
    
    return worksheet;
  }
  
  /**
   * Obtener nombre del mes
   */
  private getMonthName(month: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1] || '';
  }
}

// Exportar instancia única del servicio
export const excelReportService = new ExcelReportService();