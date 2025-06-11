// src/services/payment.service.ts - MEJORADO CON DESCRIPCIÓN DETALLADA

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

// ✅ MEJORAR la función createPaymentDescription en payment.service.ts

// Crear descripción detallada para el pago (MEJORADA CON MÁS DETALLES)
const createPaymentDescription = (memberName: string, memberships: MembershipAssignment[]): string => {
  if (memberships.length === 0) {
    return `Pago de membresías de ${memberName}`;
  }
  
  if (memberships.length === 1) {
    // ✅ DESCRIPCIÓN MÁS DETALLADA PARA UNA MEMBRESÍA
    const membership = memberships[0];
    const startDate = safelyConvertToDate(membership.startDate);
    const endDate = safelyConvertToDate(membership.endDate);
    
    let dateRange = '';
    if (startDate && endDate) {
      const startStr = formatDisplayDate(startDate);
      const endStr = formatDisplayDate(endDate);
      dateRange = ` (${startStr} - ${endStr})`;
    }
    
    // ✅ INCLUIR MÁS DETALLES: actividad + período + costo
    return `Pago membresía ${membership.activityName}${dateRange} - ${formatCurrency(membership.cost)} de ${memberName}`;
  }
  
  // ✅ DESCRIPCIÓN DETALLADA PARA MÚLTIPLES MEMBRESÍAS
  const activitiesDetail = memberships.map(m => {
    const startDate = safelyConvertToDate(m.startDate);
    const endDate = safelyConvertToDate(m.endDate);
    
    let dateRange = '';
    if (startDate && endDate) {
      const startStr = formatDisplayDate(startDate);
      const endStr = formatDisplayDate(endDate);
      dateRange = ` (${startStr} - ${endStr})`;
    }
    
    // ✅ INCLUIR ACTIVIDAD + PERÍODO + COSTO
    return `${m.activityName}${dateRange} - ${formatCurrency(m.cost)}`;
  }).join(', ');
  
  const totalAmount = memberships.reduce((sum, m) => sum + m.cost, 0);
  
  return `Pago membresías: ${activitiesDetail} | Total: ${formatCurrency(totalAmount)} de ${memberName}`;
};

// Registrar un pago de membresía y actualizar la caja diaria
export const registerMembershipPayment = async (payment: PaymentRequest): Promise<PaymentResponse> => {
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
      
      // Leer datos de las membresías
      const memberships: MembershipAssignment[] = [];
      for (const membershipId of payment.membershipIds) {
        const membershipRef = doc(db, `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, membershipId);
        const membershipSnap = await transaction.get(membershipRef);
        
        if (membershipSnap.exists()) {
          memberships.push({
            id: membershipId,
            ...membershipSnap.data()
          } as MembershipAssignment);
        }
      }
      
      // 2. ESCRITURAS - Después realizamos todas las escrituras
      
      // Actualizar el estado de las membresías a 'paid'
      for (const membership of memberships) {
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
      transaction.update(memberRef, {
        totalDebt: newDebt,
        updatedAt: serverTimestamp()
      });
      
      // Crear descripción detallada del pago
      const description = createPaymentDescription(payment.memberName, memberships);
      
      // Crear un registro de transacción
      const transactionData: Partial<Transaction> = {
        type: 'income',
        category: 'membership',
        amount: payment.amount,
        description: description, // ✅ DESCRIPCIÓN MEJORADA
        memberId: payment.memberId,
        memberName: payment.memberName,
        membershipId: payment.membershipIds.join(', '),
        date: Timestamp.fromDate(new Date(payment.paymentDate)),
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
      
      return {
        success: true,
        transactionId: docRef.id
      };
    });
  } catch (error: any) {
    console.error('Error registering payment:', error);
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

export default {
  getPendingMemberships,
  registerMembershipPayment,
  getMemberPaymentHistory,
  registerRefund
};