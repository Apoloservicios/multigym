// src/services/dailyCash.service.ts
// 🔧 SERVICIO MEJORADO DE CAJA DIARIA - PASO 2: MEJORAR CAJA DIARIA
// Controles robustos de apertura/cierre + integración con todos los pagos

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  DailyCash, 
  Transaction, 
  TransactionCategory,
  TransactionIncomeCategory, 
  TransactionExpenseCategory , Member 
} from '../types/gym.types';
import {
  getCurrentDateInArgentina,
  isTodayInArgentina,
  getArgentinianDayRange
} from '../utils/timezone.utils';

// ===================== INTERFACES MEJORADAS =====================

interface DailyCashSummary {
  totalIncome: number;
  totalExpenses: number;
  membershipIncome: number;
  productIncome: number; // 🆕 Para productos futuros
  otherIncome: number;
  operationalExpenses: number;
  refunds: number;
  netAmount: number;
  transactionCount: number;
}

interface CashValidationResult {
  isValid: boolean;
  expectedAmount: number;
  physicalAmount: number;
  difference: number;
  percentageDiff: number;
}

// ===================== FUNCIONES PRINCIPALES =====================

/**
 * 🔧 APERTURA DE CAJA MEJORADA
 * Controles de validación + estado previo
 */
export const openDailyCash = async (
  gymId: string,
  data: {
    openingAmount: number;
    userId: string;
    userName: string;
    notes?: string;
    date?: string; // Opcional, por defecto hoy
  }
): Promise<{ success: boolean; error?: string; dailyCashId?: string }> => {
  try {
    const targetDate = data.date || getCurrentDateInArgentina();
    
    console.log('📂 Abriendo caja diaria para:', targetDate);
    
    // Verificar si ya existe caja para esta fecha
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, targetDate);
    const existingCash = await getDoc(dailyCashRef);
    
    if (existingCash.exists()) {
      const cashData = existingCash.data() as DailyCash;
      if (cashData.status === 'open') {
        return {
          success: false,
          error: 'Ya existe una caja abierta para esta fecha'
        };
      }
      // Si existe pero está cerrada, permitir reabrir
    }
    
    // Obtener el cierre del día anterior para calcular saldo inicial
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let expectedOpeningAmount = data.openingAmount;
    
    try {
      const yesterdayCash = await getDailyCashByDate(gymId, yesterdayStr);
      if (yesterdayCash && yesterdayCash.status === 'closed' && yesterdayCash.closingAmount !== undefined) {
        expectedOpeningAmount = yesterdayCash.closingAmount;
        console.log(`💡 Saldo esperado desde ayer: ${expectedOpeningAmount}`);
      }
    } catch (error) {
      console.log('ℹ️  No se pudo obtener saldo del día anterior');
    }
    
    // Crear registro de caja diaria
    const dailyCashData: Partial<DailyCash> = {
      gymId,
      date: targetDate,
      openingTime: Timestamp.now(),
      openingAmount: data.openingAmount,
      expectedOpeningAmount, // 🆕 Nuevo campo
      totalIncome: 0,
      totalExpense: 0,
      membershipIncome: 0,
      productIncome: 0, // 🆕 Para productos futuros
      otherIncome: 0,
      status: 'open',
      openedBy: data.userId,
      openedByName: data.userName, // 🆕 Nuevo campo
      notes: data.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(dailyCashRef, dailyCashData);
    
    console.log('✅ Caja diaria abierta exitosamente');
    
    return {
      success: true,
      dailyCashId: targetDate
    };
    
  } catch (error: any) {
    console.error('❌ Error abriendo caja diaria:', error);
    return {
      success: false,
      error: error.message || 'Error al abrir la caja diaria'
    };
  }
};

/**
 * 🔧 CIERRE DE CAJA MEJORADO
 * Validaciones + cálculos automáticos + verificación de diferencias
 */
export const closeDailyCash = async (
  gymId: string,
  date: string,
  data: {
    closingAmount: number;
    userId: string;
    userName: string;
    notes?: string;
    forceClose?: boolean; // Para cerrar con diferencias
  }
): Promise<{ success: boolean; error?: string; validation?: CashValidationResult }> => {
  try {
    console.log('📕 Cerrando caja diaria para:', date);
    
    return await runTransaction(db, async (transaction) => {
      // 1. Obtener caja diaria actual
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
      const dailyCashSnap = await transaction.get(dailyCashRef);
      
      if (!dailyCashSnap.exists()) {
        throw new Error('No hay caja abierta para esta fecha');
      }
      
      const cashData = dailyCashSnap.data() as DailyCash;
      
      if (cashData.status === 'closed') {
        throw new Error('La caja ya está cerrada para esta fecha');
      }
      
      // 2. Calcular totales del día
      const summary = await calculateDailySummary(gymId, date);
      
      // 3. Calcular monto esperado en caja
      const expectedAmount = (cashData.openingAmount || 0) + summary.netAmount;
      
      // 4. Validar diferencias
      const validation: CashValidationResult = {
        isValid: Math.abs(expectedAmount - data.closingAmount) <= 1, // Tolerancia de $1
        expectedAmount,
        physicalAmount: data.closingAmount,
        difference: data.closingAmount - expectedAmount,
        percentageDiff: expectedAmount > 0 ? ((data.closingAmount - expectedAmount) / expectedAmount) * 100 : 0
      };
      
      // 5. Verificar si se permite el cierre
      if (!validation.isValid && !data.forceClose) {
        throw new Error(
          `Diferencia en caja: Se esperaba ${expectedAmount.toFixed(2)} pero se registró ${data.closingAmount.toFixed(2)}. ` +
          `Diferencia: ${validation.difference.toFixed(2)}. Use forceClose para cerrar con diferencias.`
        );
      }
      
      // 6. Actualizar registro de caja
      transaction.update(dailyCashRef, {
        closingTime: Timestamp.now(),
        closingAmount: data.closingAmount,
        expectedClosingAmount: expectedAmount,
        cashDifference: validation.difference,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        membershipIncome: summary.membershipIncome,
        productIncome: summary.productIncome,
        otherIncome: summary.otherIncome,
        netAmount: summary.netAmount,
        transactionCount: summary.transactionCount,
        status: 'closed',
        closedBy: data.userId,
        closedByName: data.userName,
        closingNotes: data.notes || '',
        updatedAt: serverTimestamp()
      });
      
      // 7. Si hay diferencia significativa, crear registro de ajuste
      if (Math.abs(validation.difference) > 1) {
        const adjustmentData: Partial<Transaction> = {
          type: validation.difference > 0 ? 'income' : 'expense',
          category: 'other' as any,
          amount: Math.abs(validation.difference),
          description: `Ajuste de caja - ${validation.difference > 0 ? 'Sobrante' : 'Faltante'}`,
          date: Timestamp.now(),
          userId: data.userId,
          userName: data.userName,
          paymentMethod: 'cash',
          status: 'completed',
          notes: `Ajuste automático por diferencia en cierre de caja. Esperado: ${expectedAmount.toFixed(2)}, Físico: ${data.closingAmount.toFixed(2)}`,
          createdAt: serverTimestamp()
        };
        
        const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
        const adjustmentDocRef = doc(transactionsRef);
        transaction.set(adjustmentDocRef, adjustmentData);
      }
      
      return { 
        success: true,
        validation 
      };
    });
    
  } catch (error: any) {
    console.error('❌ Error cerrando caja diaria:', error);
    return {
      success: false,
      error: error.message || 'Error al cerrar la caja diaria'
    };
  }
};

/**
 * 🔧 REGISTRAR INGRESO EXTRA MEJORADO
 * Compatible con el nuevo sistema unificado
 */
export const registerExtraIncome = async (
  gymId: string,
  data: {
    amount: number;
    description: string;
    paymentMethod: string;
    date: string;
    userId: string;
    userName: string;
    category?: TransactionIncomeCategory;
    notes?: string;
  }
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    console.log('💵 Registrando ingreso extra:', data);
    
    return await runTransaction(db, async (transaction) => {
      // 1. Verificar caja diaria
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, data.date);
      const dailyCashSnap = await transaction.get(dailyCashRef);
      
      if (!dailyCashSnap.exists()) {
        throw new Error('No hay caja abierta para esta fecha. Debe abrir la caja primero.');
      }
      
      const dailyCashData = dailyCashSnap.data() as DailyCash;
      if (dailyCashData.status === 'closed') {
        throw new Error('La caja de esta fecha está cerrada. No se pueden registrar más transacciones.');
      }
      
      // 2. Validar categoría
      const category = data.category || 'other';
      const validCategories: TransactionIncomeCategory[] = ['membership', 'product', 'service', 'penalty', 'other'];
      
      if (!validCategories.includes(category)) {
        throw new Error(`Categoría inválida para ingresos: ${category}`);
      }
      
      // 3. Crear transacción
      const transactionData: Partial<Transaction> = {
        type: 'income',
        category,
        amount: data.amount,
        description: data.description,
        date: Timestamp.now(),
        userId: data.userId,
        userName: data.userName,
        paymentMethod: data.paymentMethod,
        status: 'completed',
        notes: data.notes,
        createdAt: serverTimestamp()
      };
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const transactionDocRef = doc(transactionsRef);
      transaction.set(transactionDocRef, transactionData);
      
      // 4. Actualizar caja diaria
      const updates: any = {
        totalIncome: (dailyCashData.totalIncome || 0) + data.amount,
        updatedAt: serverTimestamp()
      };
      
      // Actualizar la categoría específica
      if (category === 'product') {
        updates.productIncome = (dailyCashData.productIncome || 0) + data.amount;
      } else if (category === 'membership') {
        updates.membershipIncome = (dailyCashData.membershipIncome || 0) + data.amount;
      } else {
        updates.otherIncome = (dailyCashData.otherIncome || 0) + data.amount;
      }
      
      transaction.update(dailyCashRef, updates);
      
      return { 
        success: true,
        transactionId: transactionDocRef.id 
      };
    });
    
  } catch (error: any) {
    console.error('❌ Error registering extra income:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el ingreso'
    };
  }
};

/**
 * 🔧 REGISTRAR GASTO MEJORADO
 * Compatible con el nuevo sistema unificado
 */
export const registerExpense = async (
  gymId: string,
  data: {
    amount: number;
    description: string;
    paymentMethod: string;
    date: string;
    userId: string;
    userName: string;
    category?: TransactionExpenseCategory;
    notes?: string;
  }
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    console.log('💸 Registrando gasto:', data);
    
    return await runTransaction(db, async (transaction) => {
      // 1. Verificar caja diaria
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, data.date);
      const dailyCashSnap = await transaction.get(dailyCashRef);
      
      if (!dailyCashSnap.exists()) {
        throw new Error('No hay caja abierta para esta fecha. Debe abrir la caja primero.');
      }
      
      const dailyCashData = dailyCashSnap.data() as DailyCash;
      if (dailyCashData.status === 'closed') {
        throw new Error('La caja de esta fecha está cerrada. No se pueden registrar más transacciones.');
      }
      
      // 2. Validar categoría
      const category = data.category || 'expense';
      const validCategories: TransactionExpenseCategory[] = ['expense', 'refund', 'withdrawal', 'supplier', 'services', 'maintenance', 'salary', 'other'];
      
      if (!validCategories.includes(category)) {
        throw new Error(`Categoría inválida para gastos: ${category}`);
      }
      
      // 3. Crear transacción
      const transactionData: Partial<Transaction> = {
        type: 'expense',
        category,
        amount: data.amount,
        description: data.description,
        date: Timestamp.now(),
        userId: data.userId,
        userName: data.userName,
        paymentMethod: data.paymentMethod,
        status: 'completed',
        notes: data.notes,
        createdAt: serverTimestamp()
      };
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const transactionDocRef = doc(transactionsRef);
      transaction.set(transactionDocRef, transactionData);
      
      // 4. Actualizar caja diaria
      transaction.update(dailyCashRef, {
        totalExpenses: (dailyCashData.totalExpenses || 0) + data.amount,
        totalExpense: (dailyCashData.totalExpense || 0) + data.amount, // Mantener compatibilidad
        updatedAt: serverTimestamp()
      });
      
      return { 
        success: true,
        transactionId: transactionDocRef.id 
      };
    });
    
  } catch (error: any) {
    console.error('❌ Error registering expense:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el gasto'
    };
  }
};

// ===================== FUNCIONES DE CONSULTA =====================

/**
 * 📊 Calcular resumen del día actual
 */
const calculateDailySummary = async (gymId: string, date: string): Promise<DailyCashSummary> => {
  try {
    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(date + 'T23:59:59');
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const q = query(
      transactionsRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed')
    );
    
    const querySnapshot = await getDocs(q);
    
    let totalIncome = 0;
    let totalExpenses = 0;
    let membershipIncome = 0;
    let productIncome = 0;
    let otherIncome = 0;
    let operationalExpenses = 0;
    let refunds = 0;
    
    querySnapshot.forEach(doc => {
      const transaction = doc.data();
      const amount = transaction.amount || 0;
      
      if (transaction.type === 'income') {
        totalIncome += amount;
        
        switch (transaction.category) {
          case 'membership':
            membershipIncome += amount;
            break;
          case 'product':
            productIncome += amount;
            break;
          default:
            otherIncome += amount;
            break;
        }
      } else if (transaction.type === 'expense') {
        totalExpenses += amount;
        
        if (transaction.category === 'refund') {
          refunds += amount;
        } else {
          operationalExpenses += amount;
        }
      }
    });
    
    return {
      totalIncome,
      totalExpenses,
      membershipIncome,
      productIncome,
      otherIncome,
      operationalExpenses,
      refunds,
      netAmount: totalIncome - totalExpenses,
      transactionCount: querySnapshot.size
    };
    
  } catch (error) {
    console.error('Error calculating daily summary:', error);
    throw error;
  }
};

/**
 * 📋 Obtener registro de caja diaria por fecha
 */
export const getDailyCashByDate = async (gymId: string, date: string): Promise<DailyCash | null> => {
  try {
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    if (dailyCashSnap.exists()) {
      return {
        id: dailyCashSnap.id,
        ...dailyCashSnap.data()
      } as DailyCash;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting daily cash by date:', error);
    throw error;
  }
};

/**
 * 📋 Obtener registros de caja para un rango de fechas
 */
export const getDailyCashForDateRange = async (
  gymId: string, 
  startDate: string, 
  endDate: string
): Promise<DailyCash[]> => {
  try {
    const dailyCashRef = collection(db, `gyms/${gymId}/dailyCash`);
    const q = query(
      dailyCashRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const dailyCashList: DailyCash[] = [];
    
    querySnapshot.forEach(doc => {
      dailyCashList.push({
        id: doc.id,
        ...doc.data()
      } as DailyCash);
    });
    
    return dailyCashList;
  } catch (error) {
    console.error('Error getting daily cash for date range:', error);
    throw error;
  }
};

/**
 * 📊 Obtener transacciones del día
 */
export const getTransactionsByDate = async (gymId: string, date: string): Promise<Transaction[]> => {
  try {
    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(date + 'T23:59:59');
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const q = query(
      transactionsRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
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
    console.error('Error getting transactions by date:', error);
    throw error;
  }
};

/**
 * 🔍 Validar consistencia de caja
 */
export const validateDailyCashConsistency = async (
  gymId: string,
  date: string
): Promise<{
  isConsistent: boolean;
  cashRegister: DailyCash | null;
  calculatedSummary: DailyCashSummary;
  differences: {
    income: number;
    expenses: number;
    net: number;
  };
}> => {
  try {
    // Obtener registro de caja
    const cashRegister = await getDailyCashByDate(gymId, date);
    
    // Calcular resumen basado en transacciones
    const calculatedSummary = await calculateDailySummary(gymId, date);
    
    // Comparar valores
    const differences = {
      income: (cashRegister?.totalIncome || 0) - calculatedSummary.totalIncome,
      expenses: (cashRegister?.totalExpenses || 0) - calculatedSummary.totalExpenses,
      net: ((cashRegister?.totalIncome || 0) - (cashRegister?.totalExpenses || 0)) - calculatedSummary.netAmount
    };
    
    const isConsistent = Math.abs(differences.income) < 0.01 && 
                        Math.abs(differences.expenses) < 0.01 && 
                        Math.abs(differences.net) < 0.01;
    
    return {
      isConsistent,
      cashRegister,
      calculatedSummary,
      differences
    };
    
  } catch (error) {
    console.error('Error validating cash consistency:', error);
    throw error;
  }
};

// ===================== FUNCIONES DE UTILIDAD =====================

/**
 * 📊 Obtener resumen de caja actual
 */
export const getCurrentCashSummary = async (gymId: string): Promise<DailyCashSummary> => {
  const today = getCurrentDateInArgentina();
  return await calculateDailySummary(gymId, today);
};

/**
 * ✅ Verificar si la caja está abierta hoy
 */
export const isCashOpenToday = async (gymId: string): Promise<boolean> => {
  try {
    const today = getCurrentDateInArgentina();
    const cashRegister = await getDailyCashByDate(gymId, today);
    return cashRegister?.status === 'open';
  } catch (error) {
    console.error('Error checking if cash is open:', error);
    return false;
  }
};


export const getTransactionsSummary = async (
  gymId: string, 
  startDate: string, 
  endDate: string
): Promise<any> => {
  try {
    const transactions = await getTransactionsByDate(gymId, startDate);
    // Procesar y devolver resumen
    return {
      totalTransactions: transactions.length,
      totalIncome: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      totalExpenses: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    };
  } catch (error) {
    console.error('Error getting transactions summary:', error);
    throw error;
  }
};


export default {
  openDailyCash,
  closeDailyCash,
  registerExtraIncome,
  registerExpense,
  getDailyCashByDate,
  getDailyCashForDateRange,
  getTransactionsByDate,
  validateDailyCashConsistency,
  getCurrentCashSummary,
  isCashOpenToday,
  getTransactionsSummary
};