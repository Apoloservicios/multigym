// src/services/monthlyPayments.service.ts
// 🤖 SERVICIO PARA AUTOMATIZACIÓN MENSUAL - VERSIÓN CORREGIDA

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MonthlyPaymentRecord, MonthlyActivityPayment, MonthlySummary, MonthlyPaymentListItem } from '../types/monthlyPayments.types';

export class MonthlyPaymentsService {
  
  /**
   * 🚀 FUNCIÓN PRINCIPAL: Generar pagos del nuevo mes
   * Esta se ejecuta automáticamente el 1° de cada mes
   */
  static async generateMonthlyPayments(gymId: string): Promise<{
    success: boolean;
    processedMembers: number;
    totalAmount: number;
    errors: string[];
  }> {
    console.log('🚀 Iniciando generación de pagos mensuales...');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() devuelve 0-11, necesitamos 1-12
    
    let processedMembers = 0;
    let totalAmount = 0;
    const errors: string[] = [];
    
    try {
      // 1. Verificar si ya se procesó este mes
      const alreadyProcessed = await this.isMonthAlreadyProcessed(gymId, year, month);
      if (alreadyProcessed) {
        console.log('⚠️ Este mes ya fue procesado');
        return {
          success: false,
          processedMembers: 0,
          totalAmount: 0,
          errors: ['Este mes ya fue procesado anteriormente']
        };
      }
      
      // 2. Obtener todos los socios activos
      const activeMembers = await this.getActiveMembers(gymId);
      console.log(`👥 Encontrados ${activeMembers.length} socios activos`);
      
      // 3. Para cada socio, generar sus pagos mensuales
      for (const member of activeMembers) {
        try {
          const memberAmount = await this.createMemberMonthlyPayment(
            gymId, 
            member, 
            year, 
            month
          );
          
          if (memberAmount > 0) {
            processedMembers++;
            totalAmount += memberAmount;
            console.log(`✅ ${member.firstName} ${member.lastName}: $${memberAmount}`);
          }
          
        } catch (error: any) {
          console.error(`❌ Error procesando ${member.firstName}:`, error);
          errors.push(`${member.firstName} ${member.lastName}: ${error.message}`);
        }
      }
      
      // 4. Marcar el mes como procesado
      await this.markMonthAsProcessed(gymId, year, month, {
        processedMembers,
        totalAmount,
        processedAt: new Date(),
        errors: errors.length
      });
      
      console.log('✅ Generación completada:', {
        processedMembers,
        totalAmount,
        errorsCount: errors.length
      });
      
      return {
        success: true,
        processedMembers,
        totalAmount,
        errors
      };
      
    } catch (error: any) {
      console.error('❌ Error general en generación mensual:', error);
      return {
        success: false,
        processedMembers: 0,
        totalAmount: 0,
        errors: [error.message || 'Error desconocido']
      };
    }
  }
  
  /**
   * 📋 Obtener socios activos con sus membresías
   */
  private static async getActiveMembers(gymId: string) {
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnap = await getDocs(membersQuery);
    
    const members = [];
    for (const memberDoc of membersSnap.docs) {
      const memberData = memberDoc.data();
      members.push({
        id: memberDoc.id,
        firstName: memberData.firstName || 'Sin nombre',
        lastName: memberData.lastName || '',
        ...memberData
      });
    }
    
    return members;
  }
  
  /**
   * 👤 Crear registro de pago mensual para un socio específico
   */
  private static async createMemberMonthlyPayment(
    gymId: string, 
    member: any, 
    year: number, 
    month: number
  ): Promise<number> {
    
    // 1. Obtener membresías activas del socio con auto-renovación
    const activeMemberships = await this.getActiveMemberships(gymId, member.id);
    
    if (activeMemberships.length === 0) {
      console.log(`⚠️ ${member.firstName} no tiene membresías activas`);
      return 0;
    }
    
    // 2. Crear el registro de pago mensual
    const monthlyRecord: MonthlyPaymentRecord = {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      year,
      month,
      createdAt: new Date(),
      activities: {},
      totalCost: 0,
      totalPaid: 0,
      totalPending: 0
    };
    
    // 3. Procesar cada membresía activa
    for (const membership of activeMemberships) {
      const activityPayment: MonthlyActivityPayment = {
        activityId: membership.activityId,
        activityName: membership.activityName,
        cost: membership.cost,
        status: 'pending',
        dueDate: this.getEndOfMonth(year, month),
        membershipId: membership.id,
        autoGenerated: true
      };
      
      monthlyRecord.activities[membership.activityId] = activityPayment;
      monthlyRecord.totalCost += membership.cost;
      monthlyRecord.totalPending += membership.cost;
    }
    
    // 4. Solo guardar si tiene actividades
    if (Object.keys(monthlyRecord.activities).length > 0) {
      const docPath = `gyms/${gymId}/monthlyPayments/${year}-${month.toString().padStart(2, '0')}/members/${member.id}`;
      await setDoc(doc(db, docPath), monthlyRecord);
      
      console.log(`📝 Creado registro para ${member.firstName}: ${Object.keys(monthlyRecord.activities).length} actividades`);
    }
    
    return monthlyRecord.totalCost;
  }
  
  /**
   * 🎫 Obtener membresías activas con auto-renovación de un socio
   */
  private static async getActiveMemberships(gymId: string, memberId: string) {
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    const membershipsSnap = await getDocs(membershipsRef);
    
    const activeMemberships = [];
    
    for (const membershipDoc of membershipsSnap.docs) {
      const membershipData = membershipDoc.data();
      
      // ✅ APLICAR LAS CONDICIONES QUE DEFINIMOS:
      // 1. Membresía debe estar activa
      // 2. Debe tener auto-renovación habilitada
      if (membershipData.status === 'active' && membershipData.autoRenewal === true) {
        activeMemberships.push({
          id: membershipDoc.id,
          activityId: membershipData.activityId || '',
          activityName: membershipData.activityName || 'Sin nombre',
          cost: membershipData.cost || 0,
          ...membershipData
        });
      }
    }
    
    return activeMemberships;
  }
  
  /**
   * 📅 Obtener último día del mes
   */
  private static getEndOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate(); // 0 = último día del mes anterior
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  }
  
  /**
   * ✅ Verificar si ya se procesó este mes
   */
  private static async isMonthAlreadyProcessed(gymId: string, year: number, month: number): Promise<boolean> {
    try {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const processLogRef = doc(db, `gyms/${gymId}/monthlyProcessLog`, monthKey);
      const processLogSnap = await getDoc(processLogRef);
      
      return processLogSnap.exists();
    } catch (error) {
      console.error('Error verificando proceso mensual:', error);
      return false;
    }
  }
  
  /**
   * 📝 Marcar mes como procesado
   */
  private static async markMonthAsProcessed(gymId: string, year: number, month: number, summary: any) {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    const processLogRef = doc(db, `gyms/${gymId}/monthlyProcessLog`, monthKey);
    
    await setDoc(processLogRef, {
      year,
      month,
      monthKey,
      ...summary
    });
  }
  
  /**
   * 📊 Obtener resumen de pagos de un mes
   */
  static async getMonthlySummary(gymId: string, year: number, month: number): Promise<MonthlySummary | null> {
    try {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const paymentsRef = collection(db, `gyms/${gymId}/monthlyPayments/${monthKey}/members`);
      const paymentsSnap = await getDocs(paymentsRef);
      
      if (paymentsSnap.empty) {
        return null;
      }
      
      const summary: MonthlySummary = {
        year,
        month,
        totalMembers: paymentsSnap.size,
        totalToCollect: 0,
        totalCollected: 0,
        totalPending: 0,
        membersWithDebt: 0,
        membersUpToDate: 0,
        activitiesBreakdown: {}
      };
      
      // Procesar cada registro de pago
      paymentsSnap.forEach(doc => {
        const payment = doc.data() as MonthlyPaymentRecord;
        
        summary.totalToCollect += payment.totalCost;
        summary.totalCollected += payment.totalPaid;
        summary.totalPending += payment.totalPending;
        
        if (payment.totalPending > 0) {
          summary.membersWithDebt++;
        } else {
          summary.membersUpToDate++;
        }
        
        // Breakdown por actividad
        Object.values(payment.activities).forEach(activity => {
          if (!summary.activitiesBreakdown[activity.activityName]) {
            summary.activitiesBreakdown[activity.activityName] = {
              members: 0,
              totalCost: 0,
              collected: 0,
              pending: 0
            };
          }
          
          const activitySummary = summary.activitiesBreakdown[activity.activityName];
          activitySummary.members++;
          activitySummary.totalCost += activity.cost;
          
          if (activity.status === 'paid') {
            activitySummary.collected += activity.cost;
          } else {
            activitySummary.pending += activity.cost;
          }
        });
      });
      
      return summary;
      
    } catch (error) {
      console.error('Error obteniendo resumen mensual:', error);
      return null;
    }
  }
  
  /**
   * 📋 Obtener lista detallada de pagos pendientes
   */
  static async getPendingPaymentsList(gymId: string, year: number, month: number): Promise<MonthlyPaymentListItem[]> {
    try {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const paymentsRef = collection(db, `gyms/${gymId}/monthlyPayments/${monthKey}/members`);
      const paymentsSnap = await getDocs(paymentsRef);
      
      const pendingPayments: MonthlyPaymentListItem[] = [];
      const today = new Date();
      
      for (const paymentDoc of paymentsSnap.docs) {
        const payment = paymentDoc.data() as MonthlyPaymentRecord;
        
        // Solo incluir si tiene pagos pendientes
        if (payment.totalPending > 0) {
          // Calcular días de atraso
          const dueDate = new Date(year, month, 0); // Último día del mes
          const timeDiff = today.getTime() - dueDate.getTime();
          const daysOverdue = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
          
          // Procesar actividades
          const activities = Object.values(payment.activities).map(activity => ({
            name: activity.activityName,
            cost: activity.cost,
            status: activity.status,
            dueDate: activity.dueDate
          }));
          
          const pendingActivities = activities.filter(a => a.status === 'pending');
          const paidActivities = activities.filter(a => a.status === 'paid');
          
          pendingPayments.push({
            memberId: payment.memberId,
            memberName: payment.memberName,
            memberEmail: '', // TODO: Obtener del perfil del socio si es necesario
            totalCost: payment.totalCost,
            totalPaid: payment.totalPaid,
            totalPending: payment.totalPending,
            activitiesCount: Object.keys(payment.activities).length,
            activitiesPaid: paidActivities.length,
            activitiesPending: pendingActivities.length,
            isOverdue: daysOverdue > 0,
            daysOverdue: daysOverdue,
            activities: activities
          });
        }
      }
      
      // Ordenar por días de atraso (más atrasados primero)
      pendingPayments.sort((a, b) => b.daysOverdue - a.daysOverdue);
      
      return pendingPayments;
      
    } catch (error) {
      console.error('Error obteniendo lista de pagos pendientes:', error);
      return [];
    }
  }
  
  /**
   * 💰 Registrar pago de una actividad específica
   */
  static async registerActivityPayment(
    gymId: string,
    year: number,
    month: number,
    memberId: string,
    activityId: string,
    amount: number,
    paymentMethod: 'cash' | 'transfer' | 'card'
  ): Promise<void> {
    try {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const paymentDocRef = doc(db, `gyms/${gymId}/monthlyPayments/${monthKey}/members`, memberId);
      
      const paymentDoc = await getDoc(paymentDocRef);
      if (!paymentDoc.exists()) {
        throw new Error('Registro de pago no encontrado');
      }
      
      const paymentData = paymentDoc.data() as MonthlyPaymentRecord;
      
      // Verificar que la actividad existe y está pendiente
      if (!paymentData.activities[activityId]) {
        throw new Error('Actividad no encontrada en el registro de pago');
      }
      
      if (paymentData.activities[activityId].status !== 'pending') {
        throw new Error('Esta actividad ya está pagada');
      }
      
      // Actualizar la actividad específica
      const updatedActivities = { ...paymentData.activities };
      updatedActivities[activityId] = {
        ...updatedActivities[activityId],
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0],
        // TODO: Agregar transactionId cuando implementemos el sistema de transacciones
      };
      
      // Recalcular totales
      const newTotalPaid = Object.values(updatedActivities)
        .filter(activity => activity.status === 'paid')
        .reduce((sum, activity) => sum + activity.cost, 0);
      
      const newTotalPending = paymentData.totalCost - newTotalPaid;
      
      // Actualizar documento
      await updateDoc(paymentDocRef, {
        activities: updatedActivities,
        totalPaid: newTotalPaid,
        totalPending: newTotalPending,
        updatedAt: new Date()
      });
      
      console.log(`✅ Pago registrado: ${paymentData.memberName} - ${updatedActivities[activityId].activityName}`);
      
    } catch (error) {
      console.error('Error registrando pago de actividad:', error);
      throw error;
    }
  }
  
  /**
   * 💰 Registrar pago completo del socio (todas las actividades pendientes)
   */
  static async registerMemberFullPayment(
    gymId: string,
    year: number,
    month: number,
    memberId: string,
    paymentMethod: 'cash' | 'transfer' | 'card'
  ): Promise<void> {
    try {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const paymentDocRef = doc(db, `gyms/${gymId}/monthlyPayments/${monthKey}/members`, memberId);
      
      const paymentDoc = await getDoc(paymentDocRef);
      if (!paymentDoc.exists()) {
        throw new Error('Registro de pago no encontrado');
      }
      
      const paymentData = paymentDoc.data() as MonthlyPaymentRecord;
      
      if (paymentData.totalPending <= 0) {
        throw new Error('Este socio ya tiene todos los pagos al día');
      }
      
      // Marcar todas las actividades pendientes como pagadas
      const updatedActivities = { ...paymentData.activities };
      const paymentDate = new Date().toISOString().split('T')[0];
      
      Object.keys(updatedActivities).forEach(activityId => {
        if (updatedActivities[activityId].status === 'pending') {
          updatedActivities[activityId] = {
            ...updatedActivities[activityId],
            status: 'paid',
            paidDate: paymentDate,
            // TODO: Agregar transactionId cuando implementemos el sistema de transacciones
          };
        }
      });
      
      // Actualizar totales
      await updateDoc(paymentDocRef, {
        activities: updatedActivities,
        totalPaid: paymentData.totalCost,
        totalPending: 0,
        updatedAt: new Date()
      });
      
      console.log(`✅ Pago completo registrado: ${paymentData.memberName} - $${paymentData.totalCost}`);
      
    } catch (error) {
      console.error('Error registrando pago completo:', error);
      throw error;
    }
  }
  
  /**
   * 🔍 Verificar si necesita ejecutarse la generación automática
   * Esta función se puede llamar cada hora o cada día
   */
  static async checkIfShouldProcess(gymId: string): Promise<boolean> {
    const now = new Date();
    const isFirstDayOfMonth = now.getDate() === 1;
    
    if (!isFirstDayOfMonth) {
      return false;
    }
    
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    // Verificar si ya se procesó este mes
    const alreadyProcessed = await this.isMonthAlreadyProcessed(gymId, year, month);
    
    return !alreadyProcessed;
  }
}