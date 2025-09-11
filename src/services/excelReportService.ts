// src/services/excelReportService.ts
// 📊 SERVICIO PARA GENERAR REPORTES EN EXCEL
// Genera archivos Excel con información de membresías y pagos

import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatCurrency, formatDisplayDate } from '../utils/format.utils';

export interface ExcelReportData {
  socio: string;
  email: string;
  membresia: string;
  fechaInicio: string;
  fechaVencimiento: string;
  costo: string;
  estado: string;
  pagoMesActual: string;
  autoRenovacion: string;
  asistencias: string;
}

class ExcelReportService {
  
  /**
   * 📊 Generar reporte mensual de membresías
   */
  async generateMonthlyMembershipReport(
    gymId: string,
    selectedMonth?: string // Format: "2025-01"
  ): Promise<void> {
    console.log('📊 Generando reporte Excel de membresías...');
    
    try {
      const reportData = await this.collectMembershipData(gymId, selectedMonth);
      
      if (reportData.length === 0) {
        throw new Error('No hay datos para generar el reporte');
      }
      
      // Crear libro de trabajo
      const workbook = XLSX.utils.book_new();
      
      // Convertir datos a formato de hoja
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      
      // Configurar anchos de columna
      const columnWidths = [
        { wch: 25 }, // Socio
        { wch: 30 }, // Email  
        { wch: 20 }, // Membresía
        { wch: 12 }, // Fecha Inicio
        { wch: 12 }, // Fecha Vencimiento
        { wch: 10 }, // Costo
        { wch: 10 }, // Estado
        { wch: 15 }, // Pago Mes Actual
        { wch: 12 }, // Auto-renovación
        { wch: 15 }  // Asistencias
      ];
      worksheet['!cols'] = columnWidths;
      
      // Agregar hoja al libro
      const monthName = selectedMonth ? 
        this.getMonthName(selectedMonth) : 
        this.getMonthName(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
        
      XLSX.utils.book_append_sheet(workbook, worksheet, `Membresías ${monthName}`);
      
      // Generar nombre de archivo
      const filename = `Reporte_Membresias_${monthName}_${new Date().getTime()}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(workbook, filename);
      
      console.log('✅ Reporte Excel generado:', filename);
      
    } catch (error) {
      console.error('❌ Error generando reporte Excel:', error);
      throw new Error(`Error generando reporte: ${error}`);
    }
  }

  /**
   * 🔍 Recopilar datos de membresías para el reporte
   */
  private async collectMembershipData(
    gymId: string, 
    selectedMonth?: string
  ): Promise<ExcelReportData[]> {
    
    console.log('🔍 Recopilando datos de membresías...');
    
    try {
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const reportData: ExcelReportData[] = [];
      const currentMonth = selectedMonth || 
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        // Obtener membresías del socio
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsQuery = query(membershipsRef, where('status', '==', 'active'));
        const membershipsSnapshot = await getDocs(membershipsQuery);
        
        // Si no tiene membresías activas, incluir una fila indicándolo
        if (membershipsSnapshot.empty) {
          reportData.push({
            socio: `${memberData.firstName} ${memberData.lastName}`,
            email: memberData.email || 'No especificado',
            membresia: 'Sin membresías activas',
            fechaInicio: '-',
            fechaVencimiento: '-',
            costo: '-',
            estado: 'Sin membresía',
            pagoMesActual: 'No aplica',
            autoRenovacion: '-',
            asistencias: '-'
          });
          continue;
        }
        
        // Procesar cada membresía activa
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          const startDate = membershipData.startDate?.toDate 
            ? membershipData.startDate.toDate() 
            : new Date(membershipData.startDate);
            
          const endDate = membershipData.endDate?.toDate 
            ? membershipData.endDate.toDate() 
            : new Date(membershipData.endDate);
          
          // Determinar si pagó el mes actual
          const paymentStatus = await this.checkMonthlyPaymentStatus(
            gymId, 
            memberDoc.id, 
            membershipDoc.id, 
            currentMonth
          );
          
          reportData.push({
            socio: `${memberData.firstName} ${memberData.lastName}`,
            email: memberData.email || 'No especificado',
            membresia: membershipData.activityName || 'Membresía General',
            fechaInicio: formatDisplayDate(startDate),
            fechaVencimiento: formatDisplayDate(endDate),
            costo: formatCurrency(membershipData.cost || 0),
            estado: this.translateMembershipStatus(membershipData.status),
            pagoMesActual: paymentStatus,
            autoRenovacion: membershipData.autoRenewal ? 'Sí' : 'No',
            asistencias: `${membershipData.currentAttendances || 0}/${membershipData.maxAttendances || 0}`
          });
        }
      }
      
      // Ordenar por nombre del socio
      reportData.sort((a, b) => a.socio.localeCompare(b.socio));
      
      console.log(`📊 Datos recopilados: ${reportData.length} registros`);
      return reportData;
      
    } catch (error) {
      console.error('❌ Error recopilando datos:', error);
      throw new Error(`Error recopilando datos: ${error}`);
    }
  }

  /**
   * 💰 Verificar estado de pago mensual
   */
  private async checkMonthlyPaymentStatus(
    gymId: string,
    memberId: string,
    membershipId: string,
    targetMonth: string
  ): Promise<string> {
    try {
      // Buscar transacciones de pago para esta membresía en el mes especificado
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const transactionsQuery = query(
        transactionsRef,
        where('memberId', '==', memberId),
        where('membershipId', '==', membershipId),
        where('type', 'in', ['membership_payment', 'membership_renewal'])
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Verificar si hay algún pago en el mes objetivo
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transactionData = transactionDoc.data();
        const transactionDate = transactionData.date?.toDate 
          ? transactionData.date.toDate() 
          : new Date(transactionData.date);
        
        const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (transactionMonth === targetMonth && transactionData.status === 'completed') {
          return 'Pagado';
        }
      }
      
      // Verificar el estado de pago de la membresía
      const membershipRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const membershipQuery = query(membershipRef, where('__name__', '==', membershipId));
      const membershipSnapshot = await getDocs(membershipQuery);
      
      if (!membershipSnapshot.empty) {
        const membershipData = membershipSnapshot.docs[0].data();
        
        switch (membershipData.paymentStatus) {
          case 'paid':
            return 'Pagado';
          case 'pending':
            return 'Pendiente';
          case 'partial':
            return 'Pago Parcial';
          default:
            return 'Sin información';
        }
      }
      
      return 'Pendiente';
      
    } catch (error) {
      console.error('❌ Error verificando estado de pago:', error);
      return 'Error al verificar';
    }
  }

  /**
   * 🌍 Traducir estado de membresía
   */
  private translateMembershipStatus(status: string): string {
    const translations: Record<string, string> = {
      'active': 'Activa',
      'expired': 'Vencida',
      'cancelled': 'Cancelada',
      'paused': 'Pausada',
      'pending': 'Pendiente'
    };
    
    return translations[status] || status;
  }

  /**
   * 📅 Obtener nombre del mes
   */
  private getMonthName(monthString: string): string {
    const [year, month] = monthString.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return `${monthNames[parseInt(month) - 1]}_${year}`;
  }

  /**
   * 📊 Generar reporte de renovaciones del mes
   */
  async generateRenewalReport(gymId: string, targetMonth?: string): Promise<void> {
    console.log('📊 Generando reporte de renovaciones...');
    
    try {
      const renewalData = await this.collectRenewalData(gymId, targetMonth);
      
      if (renewalData.length === 0) {
        throw new Error('No hay datos de renovaciones para el período seleccionado');
      }
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(renewalData);
      
      // Configurar anchos de columna
      worksheet['!cols'] = [
        { wch: 25 }, // Socio
        { wch: 20 }, // Membresía
        { wch: 15 }, // Fecha Renovación
        { wch: 12 }, // Costo Anterior
        { wch: 12 }, // Costo Nuevo
        { wch: 15 }, // Tipo Renovación
        { wch: 10 }, // Estado
        { wch: 15 }  // Observaciones
      ];
      
      const monthName = targetMonth ? 
        this.getMonthName(targetMonth) : 
        this.getMonthName(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
        
      XLSX.utils.book_append_sheet(workbook, worksheet, `Renovaciones ${monthName}`);
      
      const filename = `Reporte_Renovaciones_${monthName}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      console.log('✅ Reporte de renovaciones generado:', filename);
      
    } catch (error) {
      console.error('❌ Error generando reporte de renovaciones:', error);
      throw new Error(`Error generando reporte: ${error}`);
    }
  }

  /**
   * 🔄 Recopilar datos de renovaciones
   */
  private async collectRenewalData(gymId: string, targetMonth?: string): Promise<any[]> {
    try {
      const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
      const logsSnapshot = await getDocs(logsRef);
      
      const renewalData: any[] = [];
      const currentMonth = targetMonth || 
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      for (const logDoc of logsSnapshot.docs) {
        const logData = logDoc.data();
        const processDate = logData.processDate?.toDate 
          ? logData.processDate.toDate() 
          : new Date(logData.processDate);
        
        const processMonth = `${processDate.getFullYear()}-${String(processDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (processMonth === currentMonth) {
          // Agregar renovaciones exitosas
          if (logData.renewedMemberships) {
            for (const renewal of logData.renewedMemberships) {
              renewalData.push({
                socio: renewal.memberName,
                membresia: renewal.activityName,
                fechaRenovacion: formatDisplayDate(processDate),
                costoAnterior: formatCurrency(renewal.cost || 0),
                costoNuevo: formatCurrency(renewal.cost || 0), // Se podría mejorar
                tipoRenovacion: 'Automática',
                estado: 'Exitosa',
                observaciones: 'Renovación automática procesada'
              });
            }
          }
          
          // Agregar errores
          if (logData.errors) {
            for (const error of logData.errors) {
              renewalData.push({
                socio: error.memberName,
                membresia: error.activityName,
                fechaRenovacion: formatDisplayDate(processDate),
                costoAnterior: '-',
                costoNuevo: '-',
                tipoRenovacion: 'Automática',
                estado: 'Error',
                observaciones: error.error
              });
            }
          }
        }
      }
      
      return renewalData;
      
    } catch (error) {
      console.error('❌ Error recopilando datos de renovaciones:', error);
      throw new Error(`Error recopilando datos: ${error}`);
    }
  }
}

// Exportar instancia del servicio
export const excelReportService = new ExcelReportService();
