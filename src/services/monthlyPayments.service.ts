// src/services/monthlyPayments.service.ts
// 🔧 SERVICIO UNIFICADO - PAGOS MENSUALES + INTEGRACIÓN CAJA DIARIA
// PASO 1: Unificar sistema de pagos con registro automático en caja diaria

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  runTransaction,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Transaction, 
  DailyCash,
  TransactionIncomeCategory , Member
} from '../types/gym.types';
import { 
  MonthlyPaymentRecord, 
  MonthlyActivityPayment, 
  MonthlySummary, 
  MonthlyPaymentListItem,
  PaymentMethod 
} from '../types/monthlyPayments.types';
import { 
  getCurrentDateInArgentina,
  formatDateForDisplay 
} from '../utils/timezone.utils';
import { formatCurrency } from '../utils/formatting.utils';

// ===================== FUNCIONES AUXILIARES =====================

/**
 * 🔧 NUEVA FUNCIÓN: Registrar pago en caja diaria de forma atómica
 * Esta función se asegura de que TODOS los pagos se registren en caja diaria
 */
const updateDailyCashForPayment = async (
  transaction: any, // Firestore transaction
  gymId: string,
  amount: number,
  description: string,
  paymentMethod: PaymentMethod,
  userId: string,
  userName: string,
  memberId?: string,
  memberName?: string
): Promise<string> => {
  const today = getCurrentDateInArgentina();
  const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, today);
  const dailyCashSnap = await transaction.get(dailyCashRef);

  // Crear o actualizar caja diaria
  if (dailyCashSnap.exists()) {
    const cashData = dailyCashSnap.data() as DailyCash;
    
    // Verificar que la caja no esté cerrada
    if (cashData.status === 'closed') {
      throw new Error('La caja diaria está cerrada. No se pueden registrar pagos.');
    }
    
    // Actualizar totales
    transaction.update(dailyCashRef, {
      totalIncome: (cashData.totalIncome || 0) + amount,
      membershipIncome: (cashData.membershipIncome || 0) + amount,
      updatedAt: serverTimestamp()
    });
  } else {
    // Crear nueva caja diaria automáticamente
    const newCashData: Partial<DailyCash> = {
      gymId,
      date: today,
      openingTime: Timestamp.now(),
      openingAmount: 0,
      totalIncome: amount,
      totalExpense: 0,
      membershipIncome: amount,
      otherIncome: 0,
      status: 'open',
      openedBy: userId,
      notes: 'Creada automáticamente al registrar pago',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    transaction.set(dailyCashRef, newCashData);
  }

  // Crear registro de transacción
  const transactionData: Partial<Transaction> = {
    type: 'income',
    category: 'membership' as TransactionIncomeCategory,
    amount,
    description,
    date: Timestamp.now(),
    userId,
    userName,
    paymentMethod,
    status: 'completed',
    memberId,
    memberName,
    createdAt: serverTimestamp()
  };

  const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
  const transactionDocRef = doc(transactionsRef);
  transaction.set(transactionDocRef, transactionData);
  
  return transactionDocRef.id;
};



/**
 * 🔧 FUNCIÓN AUXILIAR: Generar descripción detallada del pago
 */
const generatePaymentDescription = (
  memberName: string,
  activityName: string,
  amount: number,
  year: number,
  month: number
): string => {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  return `Pago ${activityName} - ${monthNames[month - 1]} ${year} - ${formatCurrency(amount)} de ${memberName}`;
};

// ===================== SERVICIO PRINCIPAL =====================

export class MonthlyPaymentsService {

  // ============ MÉTODOS DE CONSULTA ============

  /**
   * 📋 Obtener lista de pagos pendientes para un mes
   */
  static async getPendingPaymentsList(
    gymId: string, 
    year: number, 
    month: number
  ): Promise<MonthlyPaymentListItem[]> {
    try {
      const recordsRef = collection(db, `gyms/${gymId}/monthlyPayments`);
      const q = query(
        recordsRef,
        where('year', '==', year),
        where('month', '==', month)
      );
      
      const querySnapshot = await getDocs(q);
      const paymentsList: MonthlyPaymentListItem[] = [];
      
      querySnapshot.forEach(doc => {
        const record = doc.data() as MonthlyPaymentRecord;
        
        // Procesar actividades
        const activities = Object.values(record.activities || {});
        const activitiesPending = activities.filter(a => a.status === 'pending');
        const activitiesPaid = activities.filter(a => a.status === 'paid');
        
        // Solo incluir si tiene pagos pendientes
        if (activitiesPending.length > 0) {
          const today = new Date();
          const dueDate = new Date(year, month - 1, 10); // Vence el 10 de cada mes
          const isOverdue = today > dueDate;
          const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          paymentsList.push({
            memberId: record.memberId,
            memberName: record.memberName,
            totalCost: record.totalCost || 0,
            totalPaid: record.totalPaid || 0,
            totalPending: record.totalPending || 0,
            activitiesCount: activities.length,
            activitiesPaid: activitiesPaid.length,
            activitiesPending: activitiesPending.length,
            isOverdue,
            daysOverdue,
            activities: activitiesPending.map(a => ({
              name: a.activityName,
              cost: a.cost,
              status: a.status,
              dueDate: a.dueDate
            }))
          });
        }
      });
      
      return paymentsList.sort((a, b) => {
        // Primero los vencidos, luego por nombre
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.memberName.localeCompare(b.memberName);
      });
      
    } catch (error) {
      console.error('Error obteniendo lista de pagos pendientes:', error);
      throw error;
    }
  }

  /**
   * 📊 Obtener resumen mensual
   */
  static async getMonthlySummary(
    gymId: string, 
    year: number, 
    month: number
  ): Promise<MonthlySummary> {
    try {
      const recordsRef = collection(db, `gyms/${gymId}/monthlyPayments`);
      const q = query(
        recordsRef,
        where('year', '==', year),
        where('month', '==', month)
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalMembers = 0;
      let totalToCollect = 0;
      let totalCollected = 0;
      let membersWithDebt = 0;
      let membersUpToDate = 0;
      const activitiesBreakdown: { [key: string]: any } = {};
      
      querySnapshot.forEach(doc => {
        const record = doc.data() as MonthlyPaymentRecord;
        totalMembers++;
        
        const totalCost = record.totalCost || 0;
        const totalPaid = record.totalPaid || 0;
        const totalPending = record.totalPending || 0;
        
        totalToCollect += totalCost;
        totalCollected += totalPaid;
        
        if (totalPending > 0) {
          membersWithDebt++;
        } else {
          membersUpToDate++;
        }
        
        // Procesar breakdown por actividad
        Object.values(record.activities || {}).forEach(activity => {
          const activityName = activity.activityName;
          if (!activitiesBreakdown[activityName]) {
            activitiesBreakdown[activityName] = {
              members: 0,
              totalCost: 0,
              collected: 0,
              pending: 0
            };
          }
          
          activitiesBreakdown[activityName].members++;
          activitiesBreakdown[activityName].totalCost += activity.cost;
          
          if (activity.status === 'paid') {
            activitiesBreakdown[activityName].collected += activity.cost;
          } else {
            activitiesBreakdown[activityName].pending += activity.cost;
          }
        });
      });
      
      return {
        year,
        month,
        totalMembers,
        totalToCollect,
        totalCollected,
        totalPending: totalToCollect - totalCollected,
        membersWithDebt,
        membersUpToDate,
        activitiesBreakdown
      };
      
    } catch (error) {
      console.error('Error obteniendo resumen mensual:', error);
      throw error;
    }
  }

  // ============ MÉTODOS DE REGISTRO DE PAGOS ============

  /**
   * 💰 MÉTODO PRINCIPAL: Registrar pago de actividad específica
   * 🔧 MEJORADO: Ahora registra automáticamente en caja diaria
   */
  static async registerActivityPayment(
    gymId: string,
    year: number,
    month: number,
    memberId: string,
    activityId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Obtener registro de pago mensual
        const recordId = `${year}-${month}-${memberId}`;
        const recordRef = doc(db, `gyms/${gymId}/monthlyPayments`, recordId);
        const recordSnap = await transaction.get(recordRef);
        
        if (!recordSnap.exists()) {
          throw new Error('Registro de pago mensual no encontrado');
        }
        
        const record = recordSnap.data() as MonthlyPaymentRecord;
        
        // 2. Verificar que la actividad existe y está pendiente
        if (!record.activities?.[activityId]) {
          throw new Error('Actividad no encontrada en el registro');
        }
        
        const activity = record.activities[activityId];
        if (activity.status === 'paid') {
          throw new Error('Esta actividad ya está pagada');
        }
        
        if (activity.cost !== amount) {
          throw new Error(`El monto no coincide. Se esperaba ${formatCurrency(activity.cost)}`);
        }
        
        // 3. 🆕 REGISTRAR EN CAJA DIARIA (NUEVA FUNCIONALIDAD)
        const transactionId = await updateDailyCashForPayment(
          transaction,
          gymId,
          amount,
          generatePaymentDescription(record.memberName, activity.activityName, amount, year, month),
          paymentMethod,
          'system', // TODO: Obtener del usuario actual
          'Sistema',
          memberId,
          record.memberName
        );
        
        // 4. Actualizar la actividad como pagada
        const updatedActivities = { ...record.activities };
        updatedActivities[activityId] = {
          ...activity,
          status: 'paid' as const,
          paidDate: getCurrentDateInArgentina(),
          transactionId
        };
        
        // 5. Recalcular totales
        const totalPaid = Object.values(updatedActivities)
          .filter(a => a.status === 'paid')
          .reduce((sum, a) => sum + a.cost, 0);
        
        const totalPending = record.totalCost - totalPaid;
        
        // 6. Actualizar registro
        transaction.update(recordRef, {
          activities: updatedActivities,
          totalPaid,
          totalPending,
          updatedAt: serverTimestamp()
        });
        
        return { transactionId };
      });
      
      console.log(`✅ Pago de actividad registrado exitosamente. ID: ${result.transactionId}`);
      
      return {
        success: true,
        transactionId: result.transactionId
      };
      
    } catch (error: any) {
      console.error('❌ Error registrando pago de actividad:', error);
      return {
        success: false,
        error: error.message || 'Error al registrar el pago'
      };
    }
  }

  /**
   * 💰 Registrar pago completo del socio (todas las actividades pendientes)
   * 🔧 MEJORADO: Ahora registra automáticamente en caja diaria
   */
  static async registerMemberFullPayment(
    gymId: string,
    year: number,
    month: number,
    memberId: string,
    paymentMethod: PaymentMethod
  ): Promise<{ success: boolean; transactionIds?: string[]; error?: string }> {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Obtener registro de pago mensual
        const recordId = `${year}-${month}-${memberId}`;
        const recordRef = doc(db, `gyms/${gymId}/monthlyPayments`, recordId);
        const recordSnap = await transaction.get(recordRef);
        
        if (!recordSnap.exists()) {
          throw new Error('Registro de pago mensual no encontrado');
        }
        
        const record = recordSnap.data() as MonthlyPaymentRecord;
        
        // 2. Obtener actividades pendientes
        const pendingActivities = Object.entries(record.activities || {})
          .filter(([_, activity]) => activity.status === 'pending');
        
        if (pendingActivities.length === 0) {
          throw new Error('No hay actividades pendientes para este socio');
        }
        
        // 3. Calcular total a pagar
        const totalAmount = pendingActivities.reduce((sum, [_, activity]) => sum + activity.cost, 0);
        
        // 4. 🆕 REGISTRAR EN CAJA DIARIA (NUEVA FUNCIONALIDAD)
        const transactionId = await updateDailyCashForPayment(
          transaction,
          gymId,
          totalAmount,
          `Pago completo ${pendingActivities.map(([_, a]) => a.activityName).join(', ')} - ${record.memberName}`,
          paymentMethod,
          'system', // TODO: Obtener del usuario actual
          'Sistema',
          memberId,
          record.memberName
        );
        
        // 5. Actualizar todas las actividades como pagadas
        const updatedActivities = { ...record.activities };
        const currentDate = getCurrentDateInArgentina();
        
        pendingActivities.forEach(([activityId, _]) => {
          updatedActivities[activityId] = {
            ...updatedActivities[activityId],
            status: 'paid' as const,
            paidDate: currentDate,
            transactionId
          };
        });
        
        // 6. Recalcular totales
        const totalPaid = Object.values(updatedActivities)
          .filter(a => a.status === 'paid')
          .reduce((sum, a) => sum + a.cost, 0);
        
        const totalPending = record.totalCost - totalPaid;
        
        // 7. Actualizar registro
        transaction.update(recordRef, {
          activities: updatedActivities,
          totalPaid,
          totalPending,
          updatedAt: serverTimestamp()
        });
        
        return { transactionIds: [transactionId] };
      });
      
      console.log(`✅ Pago completo registrado exitosamente. IDs: ${result.transactionIds}`);
      
      return {
        success: true,
        transactionIds: result.transactionIds
      };
      
    } catch (error: any) {
      console.error('❌ Error registrando pago completo:', error);
      return {
        success: false,
        error: error.message || 'Error al registrar el pago completo'
      };
    }
  }

  // ============ MÉTODOS DE AUTOMATIZACIÓN ============

  /**
   * 🤖 Verificar si debe ejecutarse la generación automática
   */
  static async checkIfShouldProcess(gymId: string): Promise<boolean> {
    try {
      const today = new Date();
      const isFirstOfMonth = today.getDate() === 1;
      
      if (!isFirstOfMonth) {
        return false;
      }
      
      // Verificar si ya se procesó este mes
      const configRef = doc(db, `gyms/${gymId}/config`, 'monthlyPayments');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        const config = configSnap.data();
        const lastProcessed = config.lastProcessedMonth;
        const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        
        return lastProcessed !== currentMonth;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error verificando si debe procesar:', error);
      return false;
    }
  }

  /**
   * 🤖 Generar pagos mensuales automáticamente
   */
  static async generateMonthlyPayments(gymId: string): Promise<{
    success: boolean;
    processedMembers: number;
    totalAmount: number;
    errors: string[];
  }> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      console.log(`🚀 Iniciando generación automática de pagos para ${year}-${month}`);
      
      // Obtener todos los socios activos con membresías vigentes
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersQuery = query(membersRef, where('status', '==', 'active'));
      const membersSnap = await getDocs(membersQuery);
      
      let processedMembers = 0;
      let totalAmount = 0;
      const errors: string[] = [];
      
      // Procesar por lotes para evitar problemas de performance
      const batch = writeBatch(db);
      
      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        try {
          
          
          // Obtener membresías activas del socio
          const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
          const membershipsQuery = query(
            membershipsRef,
            where('memberId', '==', memberDoc.id),
            where('status', '==', 'active'),
            where('autoRenewal', '==', true)
          );
          const membershipsSnap = await getDocs(membershipsQuery);
          
          if (membershipsSnap.empty) {
            continue; // Saltar si no tiene membresías con auto-renovación
          }
          
          // Crear registro de pago mensual
          const recordId = `${year}-${month}-${memberDoc.id}`;
          const activities: { [key: string]: MonthlyActivityPayment } = {};
          let memberTotal = 0;
          
          
          membershipsSnap.forEach(membershipDoc => {
            const membership = membershipDoc.data();
            
            activities[membershipDoc.id] = {
              activityId: membershipDoc.id,
              activityName: membership.activityName || 'Actividad',
              cost: membership.cost || 0,
              status: 'pending',
              dueDate: `${year}-${month.toString().padStart(2, '0')}-10`,
              membershipId: membershipDoc.id,
              autoGenerated: true
            };
            
            memberTotal += membership.cost || 0;
          });
          
          if (memberTotal > 0) {
            const member = memberDoc.data();
            const paymentRecord: MonthlyPaymentRecord = {
              memberId: memberDoc.id,
              memberName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
              year,
              month,
              activities,
              totalCost: memberTotal,
              totalPaid: 0,
              totalPending: memberTotal,
              createdAt: serverTimestamp()
            };
            
            const recordRef = doc(db, `gyms/${gymId}/monthlyPayments`, recordId);
            batch.set(recordRef, paymentRecord);
            
            processedMembers++;
            totalAmount += memberTotal;
          }
          
        } catch (error: any) {
          errors.push(`Error procesando ${member?.firstName || 'Socio'} ${member?.lastName || 'desconocido'}: ${error.message}`);

        }
      }
      
      // Ejecutar el lote
      await batch.commit();
      
      // Actualizar configuración
      const configRef = doc(db, `gyms/${gymId}/config`, 'monthlyPayments');
      await setDoc(configRef, {
        lastProcessedMonth: `${year}-${month.toString().padStart(2, '0')}`,
        lastProcessedDate: serverTimestamp(),
        lastProcessedStats: {
          processedMembers,
          totalAmount,
          errors: errors.length
        }
      }, { merge: true });
      
      console.log(`✅ Generación automática completada:`, {
        processedMembers,
        totalAmount,
        errors: errors.length
      });
      
      return {
        success: true,
        processedMembers,
        totalAmount,
        errors
      };
      
    } catch (error: any) {
      console.error('❌ Error en generación automática:', error);
      return {
        success: false,
        processedMembers: 0,
        totalAmount: 0,
        errors: [error.message || 'Error desconocido']
      };
    }
  }

      /**
     * 🆕 Generar pago mensual para un socio específico
     */
    static async generateMonthlyPaymentForMember(
      gymId: string,
      memberId: string,
      year: number,
      month: number
    ): Promise<{ success: boolean; error?: string }> {
      try {
        console.log(`🔄 Generando pago mensual para socio: ${memberId}`);
        
        return await runTransaction(db, async (transaction) => {
          // Obtener información del socio
          const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
          const memberSnap = await transaction.get(memberRef);
          
          if (!memberSnap.exists()) {
            throw new Error('Socio no encontrado');
          }
          
          const member = memberSnap.data();
          
          // Obtener membresías activas del socio
          const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
          const membershipsQuery = query(
            membershipsRef,
            where('memberId', '==', memberId),
            where('status', '==', 'active')
          );
          const membershipsSnap = await getDocs(membershipsQuery);
          
          if (membershipsSnap.empty) {
            throw new Error('El socio no tiene membresías activas');
          }
          
          // Crear registro de pago mensual
          const recordId = `${year}-${month}-${memberId}`;
          const activities: { [key: string]: MonthlyActivityPayment } = {};
          let memberTotal = 0;
          
          membershipsSnap.forEach(membershipDoc => {
            const membership = membershipDoc.data();
            
            activities[membershipDoc.id] = {
              activityId: membershipDoc.id,
              activityName: membership.activityName || 'Actividad',
              cost: membership.cost || 0,
              status: 'pending',
              dueDate: `${year}-${month.toString().padStart(2, '0')}-10`,
              membershipId: membershipDoc.id,
              autoGenerated: false // Generado manualmente
            };
            
            memberTotal += membership.cost || 0;
          });
          
          if (memberTotal > 0) {
            const paymentRecord: MonthlyPaymentRecord = {
              memberId,
              memberName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
              year,
              month,
              activities,
              totalCost: memberTotal,
              totalPaid: 0,
              totalPending: memberTotal,
              createdAt: serverTimestamp()
            };
            
            const recordRef = doc(db, `gyms/${gymId}/monthlyPayments`, recordId);
            transaction.set(recordRef, paymentRecord);
          }
          
          return { success: true };
        });
        
      } catch (error: any) {
        console.error('❌ Error generando pago para socio:', error);
        return {
          success: false,
          error: error.message || 'Error al generar el pago mensual'
        };
      }
    }
}

export default MonthlyPaymentsService;