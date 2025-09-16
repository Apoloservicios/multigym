// src/services/payment.service.ts - CORREGIDO MANTENIENDO TODA LA FUNCIONALIDAD

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  runTransaction,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Transaction, DailyCash } from '../types/gym.types';
import { MembershipAssignment } from '../types/member.types';
import { safelyConvertToDate, formatDisplayDate } from '../utils/date.utils';
import { formatCurrency } from '../utils/formatting.utils';

interface PaymentRequest {
  gymId: string;
  memberId: string;
  memberName: string;
  membershipIds: string[];
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
  userId: string;
  userName: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// 🔧 MEJORADA: Función helper para crear fechas en zona horaria argentina
const createArgentinianDate = (dateString: string): Date => {
  console.log('🔧 createArgentinianDate input:', dateString);
  
  // Si ya es una fecha completa, usarla directamente
  if (dateString.includes('T') || dateString.includes(' ')) {
    const date = new Date(dateString);
    console.log('🔧 Full date conversion:', { input: dateString, output: date });
    return date;
  }
  
  // Para fechas en formato YYYY-MM-DD, crear fecha local argentina
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Crear fecha en zona horaria local (Argentina)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  
  console.log('🔧 Date conversion:', {
    input: dateString,
    parsed: { year, month: month - 1, day },
    output: date,
    outputString: date.toString(),
    localeDateString: date.toLocaleDateString('es-AR')
  });
  
  return date;
};

// Obtener membresías pendientes de pago de un socio
export const getPendingMemberships = async (gymId: string, memberId: string): Promise<MembershipAssignment[]> => {
  try {
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    
    const q = query(
      membershipsRef,
      where('paymentStatus', '==', 'pending'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    
    const pendingMemberships: MembershipAssignment[] = [];
    querySnapshot.forEach(doc => {
      pendingMemberships.push({
        id: doc.id,
        ...doc.data()
      } as MembershipAssignment);
    });
    
    return pendingMemberships;
  } catch (error) {
    console.error('Error getting pending memberships:', error);
    throw error;
  }
};

// Crear descripción detallada para el pago (MEJORADA CON MÁS DETALLES)
const createPaymentDescription = (memberName: string, memberships: MembershipAssignment[]): string => {
  if (memberships.length === 0) {
    return `Pago de membresías de ${memberName}`;
  }
  
  if (memberships.length === 1) {
    // DESCRIPCIÓN MÁS DETALLADA PARA UNA MEMBRESÍA
    const membership = memberships[0];
    const startDate = membership.startDate ? new Date(membership.startDate + 'T12:00:00') : null;
    const endDate = membership.endDate ? new Date(membership.endDate + 'T12:00:00') : null;

     // 🔍 DEBUG: Ver qué fechas tienen las membresías
    console.log('🔍 Fechas de membresía para descripción:', {
      startDateRaw: membership.startDate,
      endDateRaw: membership.endDate,
      startDateConverted: startDate,
      endDateConverted: endDate,
      startFormatted: startDate?.toLocaleDateString('es-AR'),
      endFormatted: endDate?.toLocaleDateString('es-AR')
    });
    
    let dateRange = '';
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString('es-AR');
const endStr = endDate.toLocaleDateString('es-AR');
      dateRange = ` (${startStr} - ${endStr})`;
    }
    
    // INCLUIR MÁS DETALLES: actividad + período + costo
    return `Pago membresía ${membership.activityName}${dateRange} - ${formatCurrency(membership.cost)} de ${memberName}`;
  }
  
  // DESCRIPCIÓN DETALLADA PARA MÚLTIPLES MEMBRESÍAS
  const activitiesDetail = memberships.map(m => {
  const startDate = m.startDate ? new Date(m.startDate + 'T12:00:00') : null;
  const endDate = m.endDate ? new Date(m.endDate + 'T12:00:00') : null;
    
    let dateRange = '';
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString('es-AR');
      const endStr = endDate.toLocaleDateString('es-AR');
      dateRange = ` (${startStr} - ${endStr})`;
    }
    
    // INCLUIR ACTIVIDAD + PERÍODO + COSTO
    return `${m.activityName}${dateRange} - ${formatCurrency(m.cost)}`;
  }).join(', ');
  
  const totalAmount = memberships.reduce((sum, m) => sum + m.cost, 0);
  
  return `Pago membresías: ${activitiesDetail} | Total: ${formatCurrency(totalAmount)} de ${memberName}`;
};

// 🔧 FUNCIÓN CORREGIDA - Registrar un pago de membresía y actualizar la caja diaria
export const registerMembershipPayment = async (payment: PaymentRequest): Promise<PaymentResponse> => {
  console.log('🚀 EJECUTANDO registerMembershipPayment con fecha:', payment.paymentDate);
  try {
    // Referencias a documentos y colecciones
    const memberRef = doc(db, `gyms/${payment.gymId}/members`, payment.memberId);
    const dailyCashRef = doc(db, `gyms/${payment.gymId}/dailyCash`, payment.paymentDate);

    // Iniciar una transacción para garantizar la consistencia de datos
    return await runTransaction(db, async (transaction) => {
      // 1. LECTURAS - Primero realizamos todas las lecturas
      
      // Leer datos del miembro
      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists()) {
        throw new Error('El socio no existe');
      }
      const memberData = memberSnap.data();
      const currentDebt = memberData.totalDebt || 0;
      
      // Leer datos de caja diaria
      const dailyCashSnap = await transaction.get(dailyCashRef);
      
      // 🔧 CORRECCIÓN: Leer SOLO las membresías seleccionadas y validar su estado
      const selectedMemberships: MembershipAssignment[] = [];
      for (const membershipId of payment.membershipIds) {
        const membershipRef = doc(db, `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, membershipId);
        const membershipSnap = await transaction.get(membershipRef);
        
        if (membershipSnap.exists()) {
          const membershipData = membershipSnap.data() as MembershipAssignment;
          
          // 🔧 VALIDACIÓN: Verificar que la membresía esté pendiente
          if (membershipData.paymentStatus !== 'pending') {
            throw new Error(`La membresía ${membershipData.activityName} ya está pagada`);
          }
          
          selectedMemberships.push({
            id: membershipId,
            ...membershipData
          } as MembershipAssignment);
        } else {
          throw new Error(`Membresía con ID ${membershipId} no encontrada`);
        }
      }
      
      // 🔧 VALIDACIÓN: Verificar que el monto coincida con las membresías seleccionadas
      const expectedAmount = selectedMemberships.reduce((sum, m) => sum + m.cost, 0);
      if (Math.abs(payment.amount - expectedAmount) > 0.01) {
        throw new Error(`El monto del pago (${payment.amount}) no coincide con el costo de las membresías seleccionadas (${expectedAmount})`);
      }
      
      // 🔧 LOGGING para debugging
      console.log('🔍 Estado antes del pago:', {
        currentDebt,
        paymentAmount: payment.amount,
        selectedMemberships: selectedMemberships.map(m => ({
          id: m.id,
          activityName: m.activityName,
          cost: m.cost,
          paymentStatus: m.paymentStatus
        })),
        expectedNewDebt: currentDebt - payment.amount
      });
      
      // 2. ESCRITURAS - Después realizamos todas las escrituras
      
      // 🔧 CORRECCIÓN: Actualizar SOLO las membresías seleccionadas como 'paid'
      for (const membership of selectedMemberships) {
        const membershipRef = doc(db, `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, membership.id || '');
        transaction.update(membershipRef, {
          paymentStatus: 'paid',
          paidAmount: membership.cost,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Actualizar la deuda total del socio
      const newDebt = Math.max(0, currentDebt - payment.amount);
      
      // 🔧 LOGGING para verificar la actualización de deuda
      console.log('💰 Actualizando deuda del socio:', {
        memberId: payment.memberId,
        currentDebt,
        paymentAmount: payment.amount,
        newDebt,
        calculation: `${currentDebt} - ${payment.amount} = ${newDebt}`
      });
      
      transaction.update(memberRef, {
        totalDebt: newDebt,
        updatedAt: serverTimestamp()
      });
      
      // Crear descripción detallada del pago
      const description = createPaymentDescription(payment.memberName, selectedMemberships);
      
      // Crear un registro de transacción
              // 🔧 LOGGING para debugging de fechas
        const currentMoment = new Date();
        console.log('🔍 Fecha del pago - debugging:', {
          paymentDateOriginal: payment.paymentDate,
          currentMoment,
          currentMomentString: currentMoment.toString(),
          finalTimestamp: Timestamp.fromDate(currentMoment)
        });

        // Crear un registro de transacción
        const transactionData: Partial<Transaction> = {
          type: 'income',
          category: 'membership',
          amount: payment.amount,
          description: description,
          memberId: payment.memberId,
          memberName: payment.memberName,
          membershipId: payment.membershipIds.join(', '),
          date: Timestamp.fromDate(currentMoment), // 🔧 USAR FECHA ACTUAL DIRECTAMENTE
          userId: payment.userId,
          userName: payment.userName,
          paymentMethod: payment.paymentMethod,
          status: 'completed',
          notes: payment.notes,
          createdAt: serverTimestamp()
        };
      
      // Actualizar o crear el registro de caja diaria
      if (dailyCashSnap.exists()) {
        // Actualizar registro existente
        const cashData = dailyCashSnap.data() as DailyCash;
        
        transaction.update(dailyCashRef, {
          totalIncome: (cashData.totalIncome || 0) + payment.amount,
          membershipIncome: (cashData.membershipIncome || 0) + payment.amount,
          updatedAt: serverTimestamp()
        });
      } else {
        // Crear nuevo registro de caja diaria
        transaction.set(dailyCashRef, {
          date: payment.paymentDate,
          openingTime: Timestamp.now(),
          openingAmount: 0,
          totalIncome: payment.amount,
          totalExpense: 0,
          membershipIncome: payment.amount,
          otherIncome: 0,
          status: 'open',
          openedBy: payment.userId,
          notes: 'Creado automáticamente al registrar un pago',
          createdAt: serverTimestamp()
        });
      }
      
      return {
        success: true,
        transactionData
      };
    }).then(async (result) => {
      // Después de la transacción, creamos el documento de transacción
      const transactionsRef = collection(db, `gyms/${payment.gymId}/transactions`);
      const docRef = await addDoc(transactionsRef, result.transactionData);
      
      // 🔧 LOGGING para debug
      console.log('✅ Pago registrado correctamente:', {
        transactionId: docRef.id,
        membershipsProcessed: payment.membershipIds.length,
        amount: payment.amount
      });
      
      return {
        success: true,
        transactionId: docRef.id
      };
    });
  } catch (error: any) {
    console.error('❌ Error al registrar el pago:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el pago'
    };
  }
};

// Obtener historial de pagos de un socio
export const getMemberPaymentHistory = async (gymId: string, memberId: string): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    const q = query(
      transactionsRef,
      where('memberId', '==', memberId),
      where('type', '==', 'income'),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const transactions: Transaction[] = [];
    querySnapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      } as Transaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting member payment history:', error);
    throw error;
  }
};

// Registrar un reembolso
export const registerRefund = async (
  gymId: string,
  originalTransactionId: string,
  refundData: {
    amount: number;
    reason: string;
    processedBy: string;
    processedByName: string;
    notes?: string;
  }
): Promise<PaymentResponse> => {
  try {
    // Obtener la transacción original
    const originalTransactionRef = doc(db, `gyms/${gymId}/transactions`, originalTransactionId);
    const originalTransactionSnap = await getDoc(originalTransactionRef);
    
    if (!originalTransactionSnap.exists()) {
      throw new Error('Transacción original no encontrada');
    }
    
    const originalTransaction = originalTransactionSnap.data() as Transaction;
    
    // Crear registro de reembolso
    const refundTransaction: Partial<Transaction> = {
      type: 'expense',
      category: 'refund',
      amount: refundData.amount,
      description: `Reembolso: ${refundData.reason} - ${originalTransaction.description}`,
      memberId: originalTransaction.memberId,
      memberName: originalTransaction.memberName,
      originalTransactionId: originalTransactionId,
      date: Timestamp.now(),
      userId: refundData.processedBy,
      userName: refundData.processedByName,
      paymentMethod: originalTransaction.paymentMethod,
      status: 'completed',
      notes: refundData.notes,
      createdAt: serverTimestamp()
    };
    
    // Guardar el reembolso
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const docRef = await addDoc(transactionsRef, refundTransaction);
    
    // Actualizar la transacción original
    await updateDoc(originalTransactionRef, {
      status: 'refunded',
      refundedAt: serverTimestamp(),
      refundedBy: refundData.processedBy,
      refundReason: refundData.reason
    });
    
    return {
      success: true,
      transactionId: docRef.id
    };
  } catch (error: any) {
    console.error('Error registering refund:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el reembolso'
    };
  }
};

// AGREGAR ESTA FUNCIÓN A tu payment.service.ts existente
// NO reemplaces el archivo, solo agrega esta función

/**
 * 📝 NUEVA FUNCIÓN: Registrar pago de membresía renovada con deuda pendiente
 * Esta función se usa específicamente después de renovar una membresía
 */
export const registerRenewalPayment = async (
  gymId: string,
  membershipId: string,
  paymentData: {
    amount: number;
    paymentMethod: 'cash' | 'transfer' | 'card' | 'other';
    userId: string;
    userName: string;
    notes?: string;
  }
): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> => {
  console.log('💰 Registrando pago de renovación:', {
    gymId,
    membershipId,
    amount: paymentData.amount
  });
  
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Obtener la membresía de membershipAssignments
      const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments`, membershipId);
      const membershipSnap = await transaction.get(membershipRef);
      
      if (!membershipSnap.exists()) {
        throw new Error('Membresía no encontrada');
      }
      
      const membership = membershipSnap.data();
      
      // 2. Verificar que la membresía tiene pago pendiente
      if (membership.paymentStatus === 'paid') {
        throw new Error('Esta membresía ya está pagada');
      }
      
      // 3. Actualizar estado de pago de la membresía
      transaction.update(membershipRef, {
        paymentStatus: 'paid',
        paymentDate: serverTimestamp(),
        paymentMethod: paymentData.paymentMethod,
        paidBy: paymentData.userId,
        paidAmount: paymentData.amount,
        updatedAt: serverTimestamp()
      });
      
      // 4. Buscar y actualizar el pago pendiente si existe
      const pendingPaymentsRef = collection(db, `gyms/${gymId}/pendingPayments`);
      const pendingQuery = query(
        pendingPaymentsRef, 
        where('membershipId', '==', membershipId),
        where('status', '==', 'pending')
      );
      const pendingSnap = await getDocs(pendingQuery);
      
      pendingSnap.forEach(doc => {
        transaction.update(doc.ref, {
          status: 'paid',
          paidAt: serverTimestamp(),
          paymentMethod: paymentData.paymentMethod,
          paidBy: paymentData.userId
        });
      });
      
      // 5. Actualizar la deuda del miembro si existe
      if (membership.memberId) {
        const memberRef = doc(db, `gyms/${gymId}/members`, membership.memberId);
        const memberSnap = await transaction.get(memberRef);
        
        if (memberSnap.exists()) {
          const memberData = memberSnap.data();
          const currentDebt = memberData.totalDebt || 0;
          const newDebt = Math.max(0, currentDebt - paymentData.amount);
          
          transaction.update(memberRef, {
            totalDebt: newDebt,
            lastPaymentDate: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // 6. Crear transacción en caja diaria
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, dateStr);
      const dailyCashSnap = await transaction.get(dailyCashRef);
      
      // Crear descripción detallada
      const description = `Pago de renovación: ${membership.activityName} - ${membership.memberName} (${membership.renewalMonths || 1} ${membership.renewalMonths === 1 ? 'mes' : 'meses'})`;
      
      const transactionData = {
        type: 'income' as const,
        category: 'membership',
        amount: paymentData.amount,
        description: description,
        memberId: membership.memberId,
        memberName: membership.memberName,
        membershipId: membershipId,
        date: Timestamp.now(),
        userId: paymentData.userId,
        userName: paymentData.userName,
        paymentMethod: paymentData.paymentMethod,
        status: 'completed',
        notes: paymentData.notes || 'Pago de renovación mensual',
        isRenewalPayment: true, // Marcar como pago de renovación
        createdAt: serverTimestamp()
      };
      
      // Actualizar o crear registro de caja diaria
      if (dailyCashSnap.exists()) {
        const cashData = dailyCashSnap.data();
        transaction.update(dailyCashRef, {
          totalIncome: (cashData.totalIncome || 0) + paymentData.amount,
          membershipIncome: (cashData.membershipIncome || 0) + paymentData.amount,
          updatedAt: serverTimestamp()
        });
      } else {
        transaction.set(dailyCashRef, {
          date: dateStr,
          openingTime: Timestamp.now(),
          openingAmount: 0,
          totalIncome: paymentData.amount,
          totalExpense: 0,
          membershipIncome: paymentData.amount,
          otherIncome: 0,
          status: 'open',
          openedBy: paymentData.userId,
          notes: 'Creado automáticamente al registrar pago de renovación',
          createdAt: serverTimestamp()
        });
      }
      
      // 7. Agregar la transacción individual
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const newTransactionRef = doc(transactionsRef);
      transaction.set(newTransactionRef, transactionData);
      
      console.log('✅ Pago de renovación registrado exitosamente');
      
      return {
        success: true,
        transactionId: newTransactionRef.id
      };
    });
    
  } catch (error: any) {
    console.error('❌ Error registrando pago de renovación:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el pago'
    };
  }
};

/**
 * 🔍 NUEVA FUNCIÓN: Obtener pagos pendientes de renovación
 */
export const getPendingRenewalPayments = async (
  gymId: string,
  memberId?: string
): Promise<Array<{
  id: string;
  membershipId: string;
  memberName: string;
  activityName: string;
  amount: number;
  dueDate: string;
  months: number;
  status: string;
}>> => {
  try {
    const pendingPaymentsRef = collection(db, `gyms/${gymId}/pendingPayments`);
    
    let q;
    if (memberId) {
      // Obtener pagos pendientes de un miembro específico
      q = query(
        pendingPaymentsRef,
        where('memberId', '==', memberId),
        where('status', '==', 'pending'),
        where('type', '==', 'membership_renewal')
      );
    } else {
      // Obtener todos los pagos pendientes de renovación
      q = query(
        pendingPaymentsRef,
        where('status', '==', 'pending'),
        where('type', '==', 'membership_renewal')
      );
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any;
    
  } catch (error) {
    console.error('Error obteniendo pagos pendientes de renovación:', error);
    return [];
  }
};

export default {
  getPendingMemberships,
  registerMembershipPayment,
  getMemberPaymentHistory,
  registerRefund
};