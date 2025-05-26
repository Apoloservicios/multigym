// src/services/financial.service.ts - VERSIÓN LIMPIA Y COMPLETA

import { 
  collection, 
  doc, 
  runTransaction,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Transaction, DailyCash } from '../types/gym.types';
import { normalizeDailyCashForLegacy, normalizeTransactionForLegacy } from '../utils/compatibility.utils';

// ================== TIPOS COMPATIBLES ==================

export interface PaymentTransaction {
  id?: string;
  gymId: string;
  memberId: string;
  memberName: string;
  membershipAssignmentId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  type: 'membership_payment' | 'penalty' | 'refund' | 'other_income' | 'expense';
  processedBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  refundedAt?: Timestamp;
  notes?: string;
}

export interface DailyCashRegister {
  id?: string;
  gymId: string;
  date: string;
  openingBalance: number;
  closingBalance?: number;
  totalIncome: number;
  totalExpenses: number;
  status: 'open' | 'closed';
  openedBy: string;
  closedBy?: string;
  openedAt: Timestamp;
  closedAt?: Timestamp;
  lastUpdated: Timestamp;
}

export interface PaymentSummary {
  totalAmount: number;
  paymentMethod: string;
  count: number;
}

export interface DailyCashSummary {
  date: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  paymentBreakdown: PaymentSummary[];
  pendingPayments: number;
  refunds: number;
}

// ================== SERVICIO PRINCIPAL ==================

export class FinancialService {
  
  // ============ PROCESAMIENTO DE PAGOS ============
  
  /**
   * Procesa un pago de membresía de forma atómica
   */
  static async processMembershipPayment(
    gymId: string,
    membershipAssignmentId: string,
    paymentData: {
      amount: number;
      paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
      processedBy: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Leer la asignación de membresía
        const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments`, membershipAssignmentId);
        const membershipSnap = await transaction.get(membershipRef);
        
        if (!membershipSnap.exists()) {
          throw new Error('Membresía no encontrada');
        }
        
        const membershipData = membershipSnap.data();
        
        if (membershipData.paymentStatus === 'paid') {
          throw new Error('Esta membresía ya está pagada');
        }
        
        // 2. Leer datos del socio para actualizar deuda
        const memberRef = doc(db, `gyms/${gymId}/members`, membershipData.memberId);
        const memberSnap = await transaction.get(memberRef);
        
        if (!memberSnap.exists()) {
          throw new Error('Socio no encontrado');
        }
        
        const memberData = memberSnap.data();
        if (!memberData) {
          throw new Error('Datos del socio no disponibles');
        }
        
        // 3. Verificar/crear caja diaria
        const today = new Date().toISOString().split('T')[0];
        const cashRegisterRef = doc(db, `gyms/${gymId}/dailyCash`, today);
        const cashRegisterSnap = await transaction.get(cashRegisterRef);
        
        // 4. Crear la transacción de pago COMPATIBLE
        const transactionRef = doc(collection(db, `gyms/${gymId}/transactions`));
        const paymentTransactionCompat: Partial<Transaction> = {
          gymId,
          memberId: membershipData.memberId,
          memberName: membershipData.memberName || `${memberData.firstName} ${memberData.lastName}`,
          membershipAssignmentId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          description: `Pago membresía ${membershipData.activityName}`,
          status: 'completed',
          type: 'income', // Usar tipo compatible con código existente
          category: 'membership', // Para compatibilidad
          processedBy: paymentData.processedBy,
          userName: paymentData.processedBy, // Para compatibilidad
          userId: paymentData.processedBy, // Para compatibilidad
          date: Timestamp.now(), // Para compatibilidad
          createdAt: Timestamp.now(),
          completedAt: Timestamp.now(),
          notes: paymentData.notes
        };
        
        // 5. Actualizar membresía como pagada
        transaction.update(membershipRef, {
          paymentStatus: 'paid',
          paidAmount: paymentData.amount,
          paidAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
        // 6. Actualizar deuda del socio
        const newDebt = Math.max(0, (memberData.totalDebt || 0) - paymentData.amount);
        transaction.update(memberRef, {
          totalDebt: newDebt,
          updatedAt: Timestamp.now()
        });
        
        // 7. Crear/actualizar caja diaria COMPATIBLE
        if (cashRegisterSnap.exists()) {
          const cashData = cashRegisterSnap.data();
          transaction.update(cashRegisterRef, {
            totalIncome: (cashData.totalIncome || 0) + paymentData.amount,
            membershipIncome: (cashData.membershipIncome || 0) + paymentData.amount, // Para compatibilidad
            lastUpdated: Timestamp.now()
          });
        } else {
          const newCashRegister: Partial<DailyCash> = {
            gymId,
            date: today,
            openingBalance: 0,
            openingAmount: 0, // Para compatibilidad
            totalIncome: paymentData.amount,
            totalExpenses: 0,
            totalExpense: 0, // Para compatibilidad
            membershipIncome: paymentData.amount, // Para compatibilidad
            otherIncome: 0, // Para compatibilidad
            status: 'open',
            openedBy: paymentData.processedBy,
            openedAt: Timestamp.now(),
            openingTime: Timestamp.now(), // Para compatibilidad
            lastUpdated: Timestamp.now()
          };
          transaction.set(cashRegisterRef, newCashRegister);
        }
        
        // 8. Guardar la transacción
        transaction.set(transactionRef, paymentTransactionCompat);
        
        return transactionRef.id;
      });
      
      return { success: true, transactionId: result };
      
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============ DEVOLUCIONES ============
  
  /**
   * Procesa una devolución por cancelación de membresía - VERSIÓN COMPATIBLE
   */
  static async processRefund(
    gymId: string,
    originalTransactionId: string,
    refundData: {
      amount: number;
      reason: string;
      processedBy: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; refundTransactionId?: string; error?: string }> {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Leer transacción original
        const originalTransactionRef = doc(db, `gyms/${gymId}/transactions`, originalTransactionId);
        const originalTransactionSnap = await transaction.get(originalTransactionRef);
        
        if (!originalTransactionSnap.exists()) {
          throw new Error('Transacción original no encontrada');
        }
        
        const originalData = originalTransactionSnap.data();
        
        if (originalData.status === 'refunded') {
          throw new Error('Esta transacción ya fue reembolsada');
        }
        
        // 2. Leer socio para actualizar deuda
        const memberRef = doc(db, `gyms/${gymId}/members`, originalData.memberId);
        const memberSnap = await transaction.get(memberRef);
        
        if (!memberSnap.exists()) {
          throw new Error('Socio no encontrado');
        }
        
        const memberData = memberSnap.data();
        if (!memberData) {
          throw new Error('Datos del socio no disponibles');
        }
        
        // 3. Crear transacción de devolución COMPATIBLE
        const refundTransactionRef = doc(collection(db, `gyms/${gymId}/transactions`));
        const refundTransactionCompat: Partial<Transaction> = {
          gymId,
          memberId: originalData.memberId,
          memberName: originalData.memberName,
          membershipAssignmentId: originalData.membershipAssignmentId,
          amount: -Math.abs(refundData.amount), // SIEMPRE NEGATIVO
          paymentMethod: originalData.paymentMethod,
          description: `Devolución: ${refundData.reason}`, // Palabra clave "Devolución"
          status: 'completed',
          type: 'refund', // Tipo específico
          category: 'refund', // Categoría específica
          processedBy: refundData.processedBy,
          userName: refundData.processedBy,
          userId: refundData.processedBy,
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
          completedAt: Timestamp.now(),
          notes: refundData.notes,
          originalTransactionId: originalTransactionId
        };
        
        // 4. Marcar transacción original como reembolsada
        transaction.update(originalTransactionRef, {
          status: 'refunded',
          refundedAt: Timestamp.now()
        });
        
        // 5. Actualizar deuda del socio (aumentar por la devolución)
        const newDebt = (memberData.totalDebt || 0) + refundData.amount;
        transaction.update(memberRef, {
          totalDebt: newDebt,
          updatedAt: Timestamp.now()
        });
        
        // 6. Actualizar membresía como cancelada
        if (originalData.membershipAssignmentId) {
          const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments`, originalData.membershipAssignmentId);
          transaction.update(membershipRef, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            cancellationReason: refundData.reason
          });
        }
        
        // 7. Actualizar caja diaria COMPATIBLE
        const today = new Date().toISOString().split('T')[0];
        const cashRegisterRef = doc(db, `gyms/${gymId}/dailyCash`, today);
        const cashRegisterSnap = await transaction.get(cashRegisterRef);
        
        if (cashRegisterSnap.exists()) {
          const cashData = cashRegisterSnap.data();
          transaction.update(cashRegisterRef, {
            totalExpenses: (cashData.totalExpenses || 0) + refundData.amount,
            totalExpense: (cashData.totalExpense || 0) + refundData.amount, // Para compatibilidad
            lastUpdated: Timestamp.now()
          });
        }
        
        // 8. Guardar transacción de devolución
        transaction.set(refundTransactionRef, refundTransactionCompat);
        
        return refundTransactionRef.id;
      });
      
      return { success: true, refundTransactionId: result };
      
    } catch (error: any) {
      console.error('Error processing refund:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============ CONSULTAS Y REPORTES ============
  
  /**
   * Obtiene el resumen de caja diaria
   */
  static async getDailyCashSummary(
    gymId: string,
    date: string
  ): Promise<DailyCashSummary | null> {
    try {
      // Obtener transacciones del día
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      
      const q = query(
        transactionsRef,
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('createdAt', 'desc')
      );
      
      const transactionsSnap = await getDocs(q);
      const transactions = transactionsSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Transaction[];
      
      // Calcular totales
      let totalIncome = 0;
      let totalExpenses = 0;
      let pendingPayments = 0;
      let refunds = 0;
      const paymentMethodBreakdown: { [key: string]: PaymentSummary } = {};
      
      transactions.forEach(transaction => {
        if (transaction.status === 'completed') {
          if (transaction.amount > 0) {
            totalIncome += transaction.amount;
            
            // Agrupar por método de pago
            const method = transaction.paymentMethod || 'other';
            if (!paymentMethodBreakdown[method]) {
              paymentMethodBreakdown[method] = {
                totalAmount: 0,
                paymentMethod: method,
                count: 0
              };
            }
            paymentMethodBreakdown[method].totalAmount += transaction.amount;
            paymentMethodBreakdown[method].count++;
          } else {
            totalExpenses += Math.abs(transaction.amount);
            if (transaction.type === 'refund') {
              refunds++;
            }
          }
        } else if (transaction.status === 'pending') {
          pendingPayments++;
        }
      });
      
      return {
        date,
        totalIncome,
        totalExpenses,
        netAmount: totalIncome - totalExpenses,
        paymentBreakdown: Object.values(paymentMethodBreakdown),
        pendingPayments,
        refunds
      };
      
    } catch (error) {
      console.error('Error getting daily cash summary:', error);
      return null;
    }
  }
  
  /**
   * Obtiene todas las transacciones de un período
   */
  static async getTransactions(
    gymId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      memberId?: string;
      status?: string;
      type?: string;
      limit?: number;
    } = {}
  ): Promise<Transaction[]> {
    try {
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      let q = query(transactionsRef, orderBy('createdAt', 'desc'));
      
      // Aplicar filtros
      if (filters.startDate) {
        q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
      }
      
      if (filters.endDate) {
        q = query(q, where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
      }
      
      if (filters.memberId) {
        q = query(q, where('memberId', '==', filters.memberId));
      }
      
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      
      if (filters.type) {
        q = query(q, where('type', '==', filters.type));
      }
      
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }
      
      const transactionsSnap = await getDocs(q);
      const transactions = transactionsSnap.docs.map(doc => {
        const data = doc.data();
        return normalizeTransactionForLegacy({
          id: doc.id,
          ...data
        });
      }) as Transaction[];
      
      return transactions;
      
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }
  
  // ============ GESTIÓN DE CAJA ============
  
  /**
   * Cierra la caja diaria
   */
  static async closeDailyCash(
    gymId: string,
    date: string,
    closingData: {
      closingBalance: number;
      closedBy: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cashRegisterRef = doc(db, `gyms/${gymId}/dailyCash`, date);
      
      await runTransaction(db, async (transaction) => {
        const cashSnap = await transaction.get(cashRegisterRef);
        
        if (!cashSnap.exists()) {
          throw new Error('Caja diaria no encontrada');
        }
        
        const cashData = cashSnap.data();
        
        if (cashData.status === 'closed') {
          throw new Error('La caja ya está cerrada');
        }
        
        transaction.update(cashRegisterRef, {
          closingBalance: closingData.closingBalance,
          closingAmount: closingData.closingBalance, // Para compatibilidad
          status: 'closed',
          closedBy: closingData.closedBy,
          closedAt: Timestamp.now(),
          closingTime: Timestamp.now(), // Para compatibilidad
          lastUpdated: Timestamp.now(),
          notes: closingData.notes
        });
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Error closing daily cash:', error);
      return { success: false, error: error.message };
    }
  }
}

export default FinancialService;