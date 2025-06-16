// src/services/financial.service.ts - VERSIÓN CORREGIDA PARA INCONSISTENCIAS

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
  writeBatch,
  updateDoc,
  getDoc // 🔧 AGREGAR ESTA IMPORTACIÓN
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { Transaction, DailyCash } from '../types/gym.types';
import { normalizeDailyCashForLegacy, normalizeTransactionForLegacy } from '../utils/compatibility.utils';
// 🔧 IMPORTAR UTILIDADES DE TIMEZONE
import { 
  getCurrentDateInArgentina,
  getArgentinianDayRange,
  timestampToArgentinianDate,
  isTimestampInArgentinianDate
} from '../utils/timezone.utils';

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
  type: 'membership_payment' | 'penalty' | 'refund' | 'other_income' | 'expense' | 'income'; // 🔧 AGREGAR 'refund' E 'income'
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

// ================== FUNCIONES HELPER CORREGIDAS ==================

// 🔧 FUNCIÓN HELPER CORREGIDA: Clasificar tipo de transacción
export const getTransactionType = (transaction: any): 'income' | 'expense' | 'refund' => {
  // 🔧 MEJORAR DETECCIÓN DE REINTEGROS
    const description = transaction.description?.toLowerCase() || '';
  
  // Verificar si es reintegro por múltiples criterios
   const isRefund = transaction.type === 'refund' || 
                  transaction.category === 'refund' ||
                  description.includes('reintegro') ||
                  description.includes('devolución') ||
                  description.includes('devolucion') ||
                  description.includes('cancelación') ||
                  description.includes('cancelacion') ||
                  (transaction.amount < 0 && (
                    transaction.type === 'refund' || 
                    transaction.category === 'refund' ||
                    description.includes('reintegro')
                  ));
  
  if (isRefund) {
    return 'refund';
  }
  
  const isExpense = transaction.type === 'expense' || 
                   transaction.category === 'expense' ||
                   transaction.category === 'withdrawal' ||
                   (transaction.amount < 0 && !isRefund);
  
  if (isExpense) {
    return 'expense';
  }
  
  return 'income';
};

// 🔧 FUNCIÓN HELPER CORREGIDA: Obtener información de display para transacciones
export const getTransactionDisplayInfo = (transaction: Transaction) => {
  const type = getTransactionType(transaction);
  
  // 🔍 DEBUG para reintegros con más detalles
  if (type === 'refund') {
    console.log('🔍 DETECTANDO TRANSACCIÓN DE REINTEGRO:', {
      id: transaction.id,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description?.substring(0, 50) + '...',
      createdAt: transaction.createdAt,
      date: transaction.date
    });
  }
  
  const isRefund = type === 'refund';
  const isExpense = type === 'expense';
  const isIncome = type === 'income';
  
  // 🔍 DEBUG resultado de clasificación
  if (isRefund) {
    console.log('🔍 RESULTADO CLASIFICACIÓN REINTEGRO:', {
      isRefund,
      isExpense,
      isIncome,
      displayAmount: Math.abs(transaction.amount),
      originalAmount: transaction.amount
    });
  }
  
  return {
    isRefund,
    isIncome,
    isExpense,
    displayAmount: Math.abs(transaction.amount),
    originalAmount: transaction.amount,
    type: isRefund ? 'refund' : isExpense ? 'expense' : 'payment'
  };
};

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
        // 1. Obtener datos de la membresía y miembro
        const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments/${membershipAssignmentId}`);
        const membershipSnap = await transaction.get(membershipRef);
        
        if (!membershipSnap.exists()) {
          throw new Error('Membresía no encontrada');
        }
        
        const membershipData = membershipSnap.data();
        const memberRef = doc(db, `gyms/${gymId}/members`, membershipData.memberId);
        const memberSnap = await transaction.get(memberRef);
        
        if (!memberSnap.exists()) {
          throw new Error('Miembro no encontrado');
        }
        
        const memberData = memberSnap.data();
        const today = getCurrentDateInArgentina();
        
        // 2. Crear registro de transacción COMPATIBLE
        const transactionRef = doc(collection(db, `gyms/${gymId}/transactions`));
        const paymentTransactionCompat: Partial<Transaction> = normalizeTransactionForLegacy({
          gymId,
          type: 'income',
          category: 'membership',
          amount: paymentData.amount,
          description: `Pago membresía ${membershipData.membershipName || 'Musculacion'} (${membershipData.startDate} - ${membershipData.endDate}) - $ ${paymentData.amount} de ${memberData.firstName} ${memberData.lastName}`,
          memberId: membershipData.memberId,
          memberName: `${memberData.firstName} ${memberData.lastName}`,
          paymentMethod: paymentData.paymentMethod,
          date: Timestamp.now(),
          userId: paymentData.processedBy,
          userName: memberData.firstName,
          status: 'completed',
          notes: paymentData.notes,
          createdAt: Timestamp.now()
        });
        
        // 3. Obtener o crear caja diaria COMPATIBLE
        const cashRegisterRef = doc(db, `gyms/${gymId}/dailyCash`, today);
        const cashRegisterSnap = await transaction.get(cashRegisterRef);
        
        // 4. Verificar y procesar pago
        if (membershipData.paymentStatus === 'paid') {
          throw new Error('Esta membresía ya está pagada');
        }
        
        if (paymentData.amount <= 0) {
          throw new Error('El monto debe ser mayor a cero');
        }
        
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
            membershipIncome: (cashData.membershipIncome || 0) + paymentData.amount,
            lastUpdated: Timestamp.now()
          });
        } else {
          const newCashRegister: Partial<DailyCash> = {
            gymId,
            date: today,
            openingBalance: 0,
            openingAmount: 0,
            totalIncome: paymentData.amount,
            totalExpenses: 0,
            totalExpense: 0,
            membershipIncome: paymentData.amount,
            otherIncome: 0,
            status: 'open',
            openedBy: paymentData.processedBy,
            openedAt: Timestamp.now(),
            openingTime: Timestamp.now(),
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
   * 🔧 PROCESA DEVOLUCIONES CORREGIDAS - Versión compatible
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
        // 1. Obtener transacción original
        const originalTransactionRef = doc(db, `gyms/${gymId}/transactions`, originalTransactionId);
        const originalTransactionSnap = await transaction.get(originalTransactionRef);
        
        if (!originalTransactionSnap.exists()) {
          throw new Error('Transacción original no encontrada');
        }
        
        const originalTransaction = originalTransactionSnap.data() as Transaction;
        const today = getCurrentDateInArgentina();
        
        // 2. 🔧 CREAR REGISTRO DE DEVOLUCIÓN CON CAMPOS CORRECTOS
        const refundTransactionRef = doc(collection(db, `gyms/${gymId}/transactions`));
        const refundTransactionCompat: Partial<Transaction> = normalizeTransactionForLegacy({
          gymId,
          type: 'refund', // 🔧 TIPO CORRECTO
          category: 'refund', // 🔧 CATEGORÍA CORRECTA
          amount: -Math.abs(refundData.amount), // 🔧 MONTO NEGATIVO
          description: `Reintegro por cancelación de membresía: ${originalTransaction.description?.replace('Pago membresía', '').replace('Pago de membresía', '').trim()}`,
          memberId: originalTransaction.memberId,
          memberName: originalTransaction.memberName,
          originalTransactionId: originalTransactionId,
          date: Timestamp.now(),
          userId: refundData.processedBy,
          userName: 'Sistema',
          paymentMethod: originalTransaction.paymentMethod || 'cash',
          status: 'completed',
          notes: `Reintegro por cancelación de membresía ID: ${originalTransactionId}`,
          createdAt: Timestamp.now()
        });
        
        // 3. Obtener caja diaria
        const cashRegisterRef = doc(db, `gyms/${gymId}/dailyCash`, today);
        const cashRegisterSnap = await transaction.get(cashRegisterRef);
        
        // 4. Actualizar transacción original
        transaction.update(originalTransactionRef, {
          status: 'refunded',
          refundedAt: Timestamp.now(),
          refundedBy: refundData.processedBy,
          refundReason: refundData.reason
        });
        
        // 5. 🔧 ACTUALIZAR CAJA DIARIA - Los reintegros van a totalExpenses
        if (cashRegisterSnap.exists()) {
          const cashData = cashRegisterSnap.data();
          transaction.update(cashRegisterRef, {
            totalExpenses: (cashData.totalExpenses || 0) + refundData.amount,
            totalExpense: (cashData.totalExpense || 0) + refundData.amount,
            lastUpdated: Timestamp.now()
          });
        } else {
          const newCashRegister: Partial<DailyCash> = {
            gymId,
            date: today,
            openingBalance: 0,
            openingAmount: 0,
            totalIncome: 0,
            totalExpenses: refundData.amount,
            totalExpense: refundData.amount,
            status: 'open',
            openedBy: refundData.processedBy,
            openedAt: Timestamp.now(),
            openingTime: Timestamp.now(),
            lastUpdated: Timestamp.now()
          };
          transaction.set(cashRegisterRef, newCashRegister);
        }
        
        // 6. Guardar transacción de devolución
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
   * 🔧 FUNCIÓN PRINCIPAL CORREGIDA: getDailyCashSummary
   */
  static async getDailyCashSummary(
    gymId: string,
    date: string
  ): Promise<DailyCashSummary | null> {
    try {
      console.log(`🔍 Calculando resumen para fecha argentina: ${date}`);
      console.log('🔧 FUNCIÓN ACTUALIZADA - USANDO CONSULTA COMBINADA');
      
      const { start: startOfDay, end: endOfDay } = getArgentinianDayRange(date);
      
      console.log(`📅 Rango de consulta:`, {
        date,
        startOfDay: startOfDay.toDate(),
        endOfDay: endOfDay.toDate()
      });
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      
      // 🔧 HACER DOS CONSULTAS PARA CAPTURAR TODAS LAS TRANSACCIONES
      console.log('🔍 EJECUTANDO CONSULTAS COMBINADAS (createdAt + date)');
      
      // Consulta 1: Por createdAt (transacciones normales)
      const q1 = query(
        transactionsRef,
        where('createdAt', '>=', startOfDay),
        where('createdAt', '<=', endOfDay),
        orderBy('createdAt', 'desc')
      );
      
      // Consulta 2: Por date (reintegros y otras que usan campo 'date')
      const q2 = query(
        transactionsRef,
        where('date', '>=', startOfDay),
        where('date', '<=', endOfDay),
        orderBy('date', 'desc')
      );
      
      // Ejecutar ambas consultas
      const [snap1, snap2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      // Combinar resultados y eliminar duplicados
      const transactionMap = new Map();
      
      // Procesar primera consulta
      snap1.forEach(doc => {
        transactionMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      // Procesar segunda consulta (puede sobrescribir, está bien)
      snap2.forEach(doc => {
        transactionMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      const transactions = Array.from(transactionMap.values());
      
      console.log(`💰 Transacciones encontradas para ${date} (consulta combinada):`, transactions.length);
      console.log('🔍 EJECUTANDO CONSULTAS COMBINADAS (createdAt + date)');
      
      // 🔧 LOG ESPECÍFICO PARA REINTEGROS CON MÁS DETALLE
      const refundTransactions = transactions.filter(t => 
        t.type === 'refund' || t.category === 'refund' || 
        t.description?.toLowerCase().includes('reintegro')
      );
      
      if (refundTransactions.length > 0) {
        console.log(`🔄 REINTEGROS ENCONTRADOS EN RESUMEN DIARIO:`, {
          total: refundTransactions.length,
          amounts: refundTransactions.map(t => t.amount),
          ids: refundTransactions.map(t => t.id),
          descriptions: refundTransactions.map(t => t.description?.substring(0, 30))
        });
      }
      
      // 🔧 CLASIFICACIÓN CORREGIDA DE TRANSACCIONES
      let totalIncome = 0;
      let totalExpenses = 0;
      let pendingPayments = 0;
      let refunds = 0;
      const paymentMethodBreakdown: { [key: string]: PaymentSummary } = {};
      
      transactions.forEach(transaction => {
        console.log(`🔍 Procesando transacción:`, {
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          status: transaction.status,
          description: transaction.description?.substring(0, 50) + '...'
        });
        
        if (transaction.status === 'completed') {
          // 🔧 USAR FUNCIÓN DE CLASIFICACIÓN CORREGIDA
          const transactionType = getTransactionType(transaction);
          const amount = Math.abs(transaction.amount);
          
          if (transactionType === 'refund') {
            // 🔧 CAMBIO CRÍTICO: Los reintegros van a totalExpenses pero también se trackean separadamente
            totalExpenses += amount;
            refunds += amount;
            console.log(`🔄 Reintegro detectado: -$${amount}`);
          } else if (transactionType === 'income') {
            totalIncome += amount;
            console.log(`✅ Ingreso detectado: +$${amount}`);
            
            // 🔧 AGREGAR AL BREAKDOWN POR MÉTODO DE PAGO (solo ingresos reales)
            const method = transaction.paymentMethod || 'other';
            if (!paymentMethodBreakdown[method]) {
              paymentMethodBreakdown[method] = {
                paymentMethod: method,
                totalAmount: 0,
                count: 0
              };
            }
            paymentMethodBreakdown[method].totalAmount += amount;
            paymentMethodBreakdown[method].count++;
          } else if (transactionType === 'expense') {
            totalExpenses += amount;
            console.log(`💸 Gasto detectado: -$${amount}`);
          }
        } else if (transaction.status === 'pending') {
          pendingPayments += Math.abs(transaction.amount);
        }
      });
      
      // 🔧 CALCULAR NETO CORRECTAMENTE
      const netAmount = totalIncome - totalExpenses;
      
      const summary: DailyCashSummary = {
        date,
        totalIncome,
        totalExpenses,
        netAmount,
        paymentBreakdown: Object.values(paymentMethodBreakdown),
        pendingPayments,
        refunds
      };
      
      console.log('📊 Resumen calculado para ' + date + ':', summary);
      
      // 🔧 VALIDACIÓN FINAL
      if (refunds > 0) {
        console.log('🔍 VALIDACIÓN FINAL:', {
          ingresosReales: totalIncome,
          reintegros: refunds,
          gastosOperativos: totalExpenses - refunds,
          netoCalculado: netAmount,
          desglosePagos: Object.values(paymentMethodBreakdown).length
        });
      }
      
      return summary;
      
    } catch (error) {
      console.error('Error getting daily cash summary:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene transacciones del día con timezone argentino
   */
  static async getDayTransactions(
    gymId: string,
    date: string
  ): Promise<Transaction[]> {
    try {
      console.log(`🔍 Obteniendo transacciones para fecha: ${date}`);
      
      const { start: startOfDay, end: endOfDay } = getArgentinianDayRange(date);
      
      console.log(`📅 Rango de consulta:`, {
        startOfDay: startOfDay.toDate(),
        endOfDay: endOfDay.toDate()
      });
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      
      // 🔧 USAR CONSULTA COMBINADA TAMBIÉN AQUÍ
      const q1 = query(
        transactionsRef,
        where('createdAt', '>=', startOfDay),
        where('createdAt', '<=', endOfDay),
        orderBy('createdAt', 'desc')
      );
      
      const q2 = query(
        transactionsRef,
        where('date', '>=', startOfDay),
        where('date', '<=', endOfDay),
        orderBy('date', 'desc')
      );
      
      const [snap1, snap2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      const transactionMap = new Map();
      
      snap1.forEach(doc => {
        transactionMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      snap2.forEach(doc => {
        transactionMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      const transactions = Array.from(transactionMap.values());
      
      console.log(`📊 Transacciones encontradas (createdAt): ${transactions.length}`);
      
      return transactions;
    } catch (error) {
      console.error('Error getting day transactions:', error);
      throw error;
    }
  }
  
  /**
   * 🆕 MÉTODO FALTANTE: getTransactions - Para useFinancial.ts
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
      console.error('Error getting transactions:', error);
      throw error;
    }
  }
  
  /**
   * 🆕 MÉTODO FALTANTE: closeDailyCash - Para useFinancial.ts
   */
  static async closeDailyCash(
    gymId: string,
    date: string,
    closingData: {
      closingBalance: number;
      notes?: string;
      closedBy: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
      
      await updateDoc(dailyCashRef, {
        status: 'closed',
        closingBalance: closingData.closingBalance,
        closingAmount: closingData.closingBalance,
        closedBy: closingData.closedBy,
        closedAt: Timestamp.now(),
        closingTime: Timestamp.now(),
        notes: closingData.notes || '',
        lastUpdated: Timestamp.now()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error closing daily cash:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Obtiene transacciones recientes
   */
  static async getRecentTransactions(
    gymId: string,
    limitCount: number = 10
  ): Promise<Transaction[]> {
    try {
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const q = query(
        transactionsRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
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
      console.error('Error getting recent transactions:', error);
      throw error;
    }
  }
  
  // ============ RESUMEN MENSUAL ============
  
  /**
   * 🔧 FUNCIÓN CORREGIDA: Obtener resumen mensual con clasificación correcta
   */
  static async getMonthlyFinancialSummary(gymId: string, year: number, month: number) {
    try {
      const startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const q = query(
        transactionsRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalIncome = 0;
      let totalExpenses = 0;
      let membershipIncome = 0;
      let refundAmount = 0;
      let operationalExpenses = 0; // 🔧 SEPARAR GASTOS OPERATIVOS
      
      querySnapshot.forEach(doc => {
        const transaction = doc.data() as Transaction;
        
        if (transaction.status === 'completed') {
          const type = getTransactionType(transaction);
          const amount = Math.abs(transaction.amount);
          
          if (type === 'refund') {
            totalExpenses += amount;
            refundAmount += amount;
          } else if (type === 'income') {
            totalIncome += amount;
            if (transaction.category === 'membership') {
              membershipIncome += amount;
            }
          } else if (type === 'expense') {
            totalExpenses += amount;
            operationalExpenses += amount; // 🔧 SEPARAR GASTOS OPERATIVOS
          }
        }
      });
      
              return {
        totalIncome,
        totalExpenses,
        membershipIncome,
        refundAmount,
        operationalExpenses, // 🔧 GASTOS OPERATIVOS SIN REINTEGROS
        netAmount: totalIncome - totalExpenses,
        transactionCount: querySnapshot.size
      };
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      throw error;
    }
  }
  
  // ============ MÉTODOS ADICIONALES PARA DEBUGGING ============
  
 /**
 * 🔧 MÉTODO DE VALIDACIÓN CORREGIDO: Verificar consistencia de datos
 */
static async validateDailyConsistency(
  gymId: string,
  date: string
): Promise<{
  isConsistent: boolean;
  cashRegister: any;
  calculatedSummary: DailyCashSummary | null;
  differences: any;
}> {
  try {
    console.log(`🔍 VALIDANDO CONSISTENCIA PARA ${date}`);
    
    // 1. 🔧 CORREGIR: Obtener registro de caja diaria correctamente
    const cashRegisterDoc = doc(db, `gyms/${gymId}/dailyCash`, date);
    const cashRegisterSnap = await getDoc(cashRegisterDoc);
    
    let cashRegister = null;
    if (cashRegisterSnap.exists()) {
      cashRegister = { 
        id: cashRegisterSnap.id, 
        ...(cashRegisterSnap.data() as any)
      };
    }
    
    // 2. Calcular resumen basado en transacciones
    const calculatedSummary = await this.getDailyCashSummary(gymId, date);
    
    // 3. 🔧 CORREGIR: Comparar valores con validación de propiedades
    const differences = {
      income: cashRegister && cashRegister.totalIncome !== undefined 
        ? cashRegister.totalIncome - (calculatedSummary?.totalIncome || 0) 
        : 0,
      expenses: cashRegister && cashRegister.totalExpenses !== undefined 
        ? cashRegister.totalExpenses - (calculatedSummary?.totalExpenses || 0) 
        : 0,
      refunds: (calculatedSummary?.refunds || 0)
    };
    
    const isConsistent = Math.abs(differences.income) < 0.01 && Math.abs(differences.expenses) < 0.01;
    
    console.log(`📊 RESULTADO VALIDACIÓN:`, {
      isConsistent,
      cashRegister: cashRegister ? {
        totalIncome: cashRegister.totalIncome || 0,
        totalExpenses: cashRegister.totalExpenses || 0
      } : null,
      calculatedSummary: calculatedSummary ? {
        totalIncome: calculatedSummary.totalIncome,
        totalExpenses: calculatedSummary.totalExpenses,
        refunds: calculatedSummary.refunds
      } : null,
      differences
    });
    
    return {
      isConsistent,
      cashRegister,
      calculatedSummary,
      differences
    };
  } catch (error) {
    console.error('Error validating daily consistency:', error);
    throw error;
  }
}

  
  /**
   * 🔧 MÉTODO DE DEBUGGING: Obtener breakdown detallado de transacciones
   */
  static async getDetailedTransactionBreakdown(
    gymId: string,
    date: string
  ): Promise<{
    totalTransactions: number;
    incomeTransactions: Transaction[];
    expenseTransactions: Transaction[];
    refundTransactions: Transaction[];
    pendingTransactions: Transaction[];
    summary: {
      totalIncome: number;
      totalExpenses: number;
      totalRefunds: number;
      totalPending: number;
    };
  }> {
    try {
      const transactions = await this.getDayTransactions(gymId, date);
      
      const incomeTransactions: Transaction[] = [];
      const expenseTransactions: Transaction[] = [];
      const refundTransactions: Transaction[] = [];
      const pendingTransactions: Transaction[] = [];
      
      let totalIncome = 0;
      let totalExpenses = 0;
      let totalRefunds = 0;
      let totalPending = 0;
      
      transactions.forEach(transaction => {
        const type = getTransactionType(transaction);
        const amount = Math.abs(transaction.amount);
        
        if (transaction.status === 'pending') {
          pendingTransactions.push(transaction);
          totalPending += amount;
        } else if (transaction.status === 'completed') {
          if (type === 'refund') {
            refundTransactions.push(transaction);
            totalRefunds += amount;
          } else if (type === 'income') {
            incomeTransactions.push(transaction);
            totalIncome += amount;
          } else if (type === 'expense') {
            expenseTransactions.push(transaction);
            totalExpenses += amount;
          }
        }
      });
      
      console.log(`📊 BREAKDOWN DETALLADO PARA ${date}:`, {
        totalTransactions: transactions.length,
        income: { count: incomeTransactions.length, total: totalIncome },
        expenses: { count: expenseTransactions.length, total: totalExpenses },
        refunds: { count: refundTransactions.length, total: totalRefunds },
        pending: { count: pendingTransactions.length, total: totalPending }
      });
      
      return {
        totalTransactions: transactions.length,
        incomeTransactions,
        expenseTransactions,
        refundTransactions,
        pendingTransactions,
        summary: {
          totalIncome,
          totalExpenses,
          totalRefunds,
          totalPending
        }
      };
    } catch (error) {
      console.error('Error getting detailed breakdown:', error);
      throw error;
    }
  }
  
  /**
   * 🔧 MÉTODO UTILITARIO: Reclasificar transacciones existentes (usar con cuidado)
   */
  static async reclassifyTransactions(
    gymId: string,
    date: string,
    dryRun: boolean = true
  ): Promise<{
    transactionsToUpdate: any[];
    summary: string;
  }> {
    try {
      console.log(`🔧 ${dryRun ? 'SIMULANDO' : 'EJECUTANDO'} RECLASIFICACIÓN PARA ${date}`);
      
      const transactions = await this.getDayTransactions(gymId, date);
      const transactionsToUpdate: any[] = [];
      
      transactions.forEach(transaction => {
        const currentType = transaction.type;
        const correctType = getTransactionType(transaction);
        
        if (currentType !== correctType) {
          transactionsToUpdate.push({
            id: transaction.id,
            currentType,
            correctType,
            amount: transaction.amount,
            description: transaction.description?.substring(0, 50) + '...'
          });
        }
      });
      
      if (!dryRun && transactionsToUpdate.length > 0) {
        const batch = writeBatch(db);
        
        transactionsToUpdate.forEach(({ id, correctType }) => {
          const transactionRef = doc(db, `gyms/${gymId}/transactions`, id);
          batch.update(transactionRef, {
            type: correctType,
            category: correctType,
            updatedAt: Timestamp.now()
          });
        });
        
        await batch.commit();
        console.log(`✅ ${transactionsToUpdate.length} transacciones reclasificadas`);
      }
      
      const summary = `${transactionsToUpdate.length} transacciones necesitan reclasificación`;
      
      console.log(`📊 RESULTADO RECLASIFICACIÓN:`, {
        found: transactionsToUpdate.length,
        dryRun,
        transactionsToUpdate: transactionsToUpdate.slice(0, 5) // Solo primeras 5 para log
      });
      
      return {
        transactionsToUpdate,
        summary
      };
    } catch (error) {
      console.error('Error reclassifying transactions:', error);
      throw error;
    }
  }
}

// ✅ FUNCIONES INDEPENDIENTES PARA COMPATIBILIDAD
export const calculateDailySummary = async (gymId: string, dateString: string) => {
  return await FinancialService.getDailyCashSummary(gymId, dateString);
};

export const getDayTransactions = async (gymId: string, dateString: string): Promise<Transaction[]> => {
  return await FinancialService.getDayTransactions(gymId, dateString);
};

// 🔧 NUEVAS FUNCIONES UTILITARIAS EXPORTADAS
export const validateDailyConsistency = async (gymId: string, dateString: string) => {
  return await FinancialService.validateDailyConsistency(gymId, dateString);
};

export const getDetailedTransactionBreakdown = async (gymId: string, dateString: string) => {
  return await FinancialService.getDetailedTransactionBreakdown(gymId, dateString);
};

export const reclassifyTransactions = async (gymId: string, dateString: string, dryRun: boolean = true) => {
  return await FinancialService.reclassifyTransactions(gymId, dateString, dryRun);
};

export default FinancialService;