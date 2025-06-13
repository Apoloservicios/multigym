// src/services/financial.service.ts - CON TIMEZONE ARGENTINA CORREGIDO

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
        const today = getCurrentDateInArgentina(); // 🔧 USAR FECHA ARGENTINA
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
        const today = getCurrentDateInArgentina(); // 🔧 USAR FECHA ARGENTINA
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
   * 🔧 OBTIENE EL RESUMEN DE CAJA DIARIA CON TIMEZONE ARGENTINA
   */
  static async getDailyCashSummary(
  gymId: string,
  date: string
): Promise<DailyCashSummary | null> {
  try {
    console.log(`🔍 Calculando resumen para fecha argentina: ${date}`);
    console.log('🔧 FUNCIÓN ACTUALIZADA - USANDO CONSULTA COMBINADA'); // 🔧 AGREGAR ESTA LÍNEA
    
    const { start: startOfDay, end: endOfDay } = getArgentinianDayRange(date);
    
    console.log(`📅 Rango de consulta:`, {
      startOfDay: startOfDay.toDate(),
      endOfDay: endOfDay.toDate()
    });
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    // 🔧 HACER DOS CONSULTAS PARA CAPTURAR TODAS LAS TRANSACCIONES
    console.log('🔍 EJECUTANDO CONSULTAS COMBINADAS (createdAt + date)'); // 🔧 AGREGAR ESTA LÍNEA
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

    
    // 🔧 AGREGAR LOG ESPECÍFICO PARA REINTEGROS
    const refundTransactions = transactions.filter(t => 
      t.type === 'refund' || t.category === 'refund'
    );
    
    if (refundTransactions.length > 0) {
      console.log(`🔄 REINTEGROS ENCONTRADOS EN RESUMEN DIARIO:`, {
        total: refundTransactions.length,
        amounts: refundTransactions.map(t => t.amount),
        ids: refundTransactions.map(t => t.id)
      });
    }
    
    // Resto de la función igual...
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
        description: transaction.description?.substring(0, 30) + '...'
      });
      
      if (transaction.status === 'completed') {
        const isRefund = transaction.type === 'refund' || 
                        transaction.category === 'refund' || 
                        transaction.description?.toLowerCase().includes('devolución') ||
                        transaction.description?.toLowerCase().includes('devolucion') ||
                        transaction.description?.toLowerCase().includes('reintegro');
        
        const isExpense = !isRefund && (
          transaction.type === 'expense' || 
          transaction.category === 'expense' ||
          transaction.category === 'withdrawal' ||
          transaction.category === 'supplier' ||
          transaction.category === 'services' ||
          transaction.category === 'maintenance' ||
          transaction.category === 'salary'
        );
        
        const isIncome = !isRefund && !isExpense && (
          transaction.type === 'income' ||
          transaction.category === 'membership' ||
          transaction.category === 'extra' ||
          transaction.category === 'penalty' ||
          transaction.category === 'product' ||
          transaction.category === 'service' ||
          transaction.amount > 0
        );
        
        const amount = Math.abs(transaction.amount);
        
        if (isIncome) {
          totalIncome += amount;
          console.log(`✅ Ingreso detectado: +$${amount}`);
          
          const method = transaction.paymentMethod || 'other';
          if (!paymentMethodBreakdown[method]) {
            paymentMethodBreakdown[method] = {
              totalAmount: 0,
              paymentMethod: method,
              count: 0
            };
          }
          paymentMethodBreakdown[method].totalAmount += amount;
          paymentMethodBreakdown[method].count++;
        } else if (isRefund) {
          totalExpenses += amount;
          refunds++;
          console.log(`🔄 Devolución detectada: -$${amount}`);
        } else if (isExpense) {
          totalExpenses += amount;
          console.log(`❌ Gasto detectado: -$${amount}`);
        } else {
          if (transaction.amount > 0) {
            totalIncome += amount;
            console.log(`➕ Ingreso por monto positivo: +$${amount}`);
          } else {
            totalExpenses += amount;
            console.log(`➖ Gasto por monto negativo: -$${amount}`);
          }
        }
      } else if (transaction.status === 'pending') {
        pendingPayments++;
      }
    });
    
    const summary = {
      date,
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      paymentBreakdown: Object.values(paymentMethodBreakdown),
      pendingPayments,
      refunds
    };
    
    console.log(`📊 Resumen calculado para ${date}:`, summary);
    
    return summary;
    
  } catch (error) {
    console.error('Error getting daily cash summary:', error);
    return null;
  }
}
  
  /**
   * 🔧 OBTIENE TRANSACCIONES CON FILTROS DE TIMEZONE ARGENTINA
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
      
      // 🔧 APLICAR FILTROS CON TIMEZONE ARGENTINA
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
   * 🔧 CIERRA LA CAJA DIARIA CON FECHA ARGENTINA
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