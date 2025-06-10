// src/services/dailyCash.service.ts - CORREGIDO PARA FECHAS ARGENTINA

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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  DailyCash, 
  Transaction, 
  TransactionCategory,
  TransactionIncomeCategory, 
  TransactionExpenseCategory 
} from '../types/gym.types';
import {
  getCurrentDateInArgentina,
  isTodayInArgentina,
  getArgentinianDayRange
} from '../utils/timezone.utils';

// Obtener registro de caja diaria por fecha
export const getDailyCashByDate = async (gymId: string, date: string): Promise<DailyCash | null> => {
  try {
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    if (dailyCashSnap.exists()) {
      const data = {
        id: dailyCashSnap.id,
        ...dailyCashSnap.data()
      } as DailyCash;
      
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting daily cash by date:', error);
    throw error;
  }
};

// Obtener registros de caja para un rango de fechas
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

// 🔧 REGISTRAR INGRESO EXTRA - CORREGIDO PARA FECHAS ARGENTINA
export const registerExtraIncome = async (
  gymId: string,
  data: {
    amount: number;
    description: string;
    paymentMethod: string;
    date: string;
    userId: string;
    userName: string;
    category?: string;
    notes?: string;
  }
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    console.log('💵 Registrando ingreso extra:', data);
    
    // Referencia al documento de la caja diaria
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, data.date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    // Verificar si existe la caja diaria
    if (!dailyCashSnap.exists()) {
      return {
        success: false,
        error: 'No hay caja abierta para esta fecha. Debe abrir la caja primero.'
      };
    }
    
    // Verificar el estado de la caja
    const dailyCashData = dailyCashSnap.data() as DailyCash;
    if (dailyCashData.status === 'closed') {
      return {
        success: false,
        error: 'La caja de esta fecha está cerrada. No se pueden registrar más transacciones.'
      };
    }
    
    // Validar que la categoría es válida para ingresos
    const category = data.category || 'extra';
    const validCategories: TransactionIncomeCategory[] = ['membership', 'extra', 'penalty', 'product', 'service', 'other'];
    
    if (!validCategories.includes(category as TransactionIncomeCategory)) {
      throw new Error(`Categoría inválida para ingresos: ${category}`);
    }
    
    // 🔧 CREAR TRANSACCIÓN CON TIMESTAMP ACTUAL EN ARGENTINA
    const now = Timestamp.now();
    const transactionData: Partial<Transaction> = {
      type: 'income',
      category: category as TransactionIncomeCategory,
      amount: data.amount,
      description: data.description,
      date: now, // 🔧 USAR TIMESTAMP ACTUAL
      userId: data.userId,
      userName: data.userName,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      notes: data.notes,
      createdAt: serverTimestamp() // 🔧 AGREGAR createdAt PARA CONSISTENCIA
    };
    
    // Referencia a la colección de transacciones
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    // Crear la transacción
    const transactionRef = await addDoc(transactionsRef, transactionData);
    
    // Actualizar registro de caja diaria
    const totalIncome = (dailyCashData.totalIncome || 0) + data.amount;
    const otherIncome = (dailyCashData.otherIncome || 0) + data.amount;
    
    await updateDoc(dailyCashRef, {
      totalIncome: totalIncome,
      otherIncome: otherIncome,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Ingreso extra registrado exitosamente:', transactionRef.id);
    
    return {
      success: true,
      transactionId: transactionRef.id
    };
  } catch (error: any) {
    console.error('❌ Error registering extra income:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el ingreso'
    };
  }
};

// 🔧 REGISTRAR GASTO - CORREGIDO PARA FECHAS ARGENTINA
export const registerExpense = async (
  gymId: string,
  data: {
    amount: number;
    description: string;
    paymentMethod: string;
    date: string;
    userId: string;
    userName: string;
    category?: string;
    notes?: string;
  }
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    console.log('💸 Registrando gasto:', data);
    
    // Referencia al documento de la caja diaria
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, data.date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    // Verificar si existe la caja diaria
    if (!dailyCashSnap.exists()) {
      return {
        success: false,
        error: 'No hay caja abierta para esta fecha. Debe abrir la caja primero.'
      };
    }
    
    // Verificar el estado de la caja
    const dailyCashData = dailyCashSnap.data() as DailyCash;
    if (dailyCashData.status === 'closed') {
      return {
        success: false,
        error: 'La caja de esta fecha está cerrada. No se pueden registrar más transacciones.'
      };
    }
    
    // Validar que la categoría es válida para gastos
    const category = data.category || 'withdrawal';
    const validCategories: TransactionExpenseCategory[] = ['withdrawal', 'refund', 'expense', 'supplier', 'services', 'maintenance', 'salary', 'other'];

    if (!validCategories.includes(category as TransactionExpenseCategory)) {
      throw new Error(`Categoría inválida para gastos: ${category}`);
    }
    
    // 🔧 CREAR TRANSACCIÓN CON TIMESTAMP ACTUAL EN ARGENTINA
    const now = Timestamp.now();
    const transactionData: Partial<Transaction> = {
      type: 'expense',
      category: category as TransactionExpenseCategory,
      amount: data.amount, // 🔧 MANTENER POSITIVO, EL TIPO INDICA QUE ES EGRESO
      description: data.description,
      date: now, // 🔧 USAR TIMESTAMP ACTUAL
      userId: data.userId,
      userName: data.userName,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      notes: data.notes,
      createdAt: serverTimestamp() // 🔧 AGREGAR createdAt
    };
    
    // Referencia a la colección de transacciones
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    // Crear la transacción
    const transactionRef = await addDoc(transactionsRef, transactionData);
    
    // Actualizar registro de caja diaria
    const totalExpense = (dailyCashData.totalExpense || 0) + data.amount;
    
    await updateDoc(dailyCashRef, {
      totalExpense: totalExpense,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Gasto registrado exitosamente:', transactionRef.id);
    
    return {
      success: true,
      transactionId: transactionRef.id
    };
  } catch (error: any) {
    console.error('❌ Error registering expense:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el gasto'
    };
  }
};

// 🔧 CERRAR CAJA - VALIDACIONES MEJORADAS PARA FECHAS ARGENTINA
export const closeDailyCash = async (
  gymId: string,
  date: string,
  data: {
    closingAmount: number;
    notes?: string;
    userId: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔒 Cerrando caja diaria:', { gymId, date, ...data });
    
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    if (!dailyCashSnap.exists()) {
      return {
        success: false,
        error: 'No existe un registro de caja para esta fecha'
      };
    }
    
    // Verificar que la caja esté abierta
    const dailyCashData = dailyCashSnap.data() as DailyCash;
    if (dailyCashData.status !== 'open') {
      return {
        success: false,
        error: 'La caja ya está cerrada'
      };
    }
    
    // 🔧 VERIFICAR QUE SOLO SE PUEDA CERRAR LA CAJA DEL DÍA ACTUAL EN ARGENTINA
    if (!isTodayInArgentina(date)) {
      return {
        success: false,
        error: 'Solo se puede cerrar la caja del día actual'
      };
    }
    
    await updateDoc(dailyCashRef, {
      closingTime: Timestamp.now(),
      closingAmount: data.closingAmount,
      status: 'closed',
      closedBy: data.userId,
      notes: data.notes || dailyCashData.notes,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Caja cerrada exitosamente');
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('❌ Error closing daily cash:', error);
    return {
      success: false,
      error: error.message || 'Error al cerrar la caja'
    };
  }
};

// 🔧 ABRIR CAJA - VALIDACIONES MEJORADAS PARA FECHAS ARGENTINA
export const openDailyCash = async (
  gymId: string,
  date: string,
  data: {
    openingAmount: number;
    notes?: string;
    userId: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔓 Abriendo/reabriendo caja diaria:', { gymId, date, ...data });
    
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    // 🔧 VERIFICAR QUE SOLO SE PUEDA ABRIR LA CAJA DEL DÍA ACTUAL EN ARGENTINA
    if (!isTodayInArgentina(date)) {
      return {
        success: false,
        error: 'Solo se puede abrir o reabrir la caja del día actual'
      };
    }
    
    if (dailyCashSnap.exists()) {
      // Si ya existe un registro, verificar si está cerrado
      const dailyCashData = dailyCashSnap.data() as DailyCash;
      
      if (dailyCashData.status === 'open') {
        return {
          success: false,
          error: 'La caja para esta fecha ya se encuentra abierta'
        };
      }
      
      // Reabrir la caja si estaba cerrada
      await updateDoc(dailyCashRef, {
        status: 'open',
        openingTime: Timestamp.now(),
        openingAmount: data.openingAmount,
        notes: data.notes || 'Caja reabierta manualmente',
        closingTime: null,
        closingAmount: null,
        closedBy: null,
        updatedAt: serverTimestamp()
      });
      
      console.log('🔄 Caja reabierta exitosamente');
    } else {
      // Crear un nuevo registro de caja diaria
      await setDoc(dailyCashRef, {
        date: date,
        openingTime: Timestamp.now(),
        openingAmount: data.openingAmount,
        totalIncome: 0,
        totalExpense: 0,
        membershipIncome: 0,
        otherIncome: 0,
        status: 'open',
        openedBy: data.userId,
        notes: data.notes || 'Caja abierta manualmente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('🆕 Nueva caja creada exitosamente');
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('❌ Error opening daily cash:', error);
    return {
      success: false,
      error: error.message || 'Error al abrir la caja'
    };
  }
};

// 🔧 OBTENER TRANSACCIONES POR FECHA - MEJORADO PARA FECHAS ARGENTINA
export const getTransactionsByDate = async (
  gymId: string,
  date: string
): Promise<Transaction[]> => {
  try {
    console.log('🔍 Obteniendo transacciones para fecha:', { gymId, date });
    
    // 🔧 USAR RANGO DE FECHAS EN ARGENTINA
    const { start: startOfDay, end: endOfDay } = getArgentinianDayRange(date);
    
    console.log('📅 Rango de consulta:', {
      startOfDay: startOfDay.toDate(),
      endOfDay: endOfDay.toDate()
    });
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    // 🔧 USAR CONSULTA CON createdAt Y RANGO DE FECHAS ARGENTINA
    let transactions: Transaction[] = [];
    
    try {
      // Primero intentar con createdAt (más preciso)
      const qCreatedAt = query(
        transactionsRef,
        where('createdAt', '>=', startOfDay),
        where('createdAt', '<=', endOfDay),
        orderBy('createdAt', 'desc')
      );
      
      const createdAtSnapshot = await getDocs(qCreatedAt);
      createdAtSnapshot.forEach(doc => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      console.log('📊 Transacciones encontradas (createdAt):', transactions.length);
      
    } catch (createdAtError) {
      console.warn('⚠️ Error querying by createdAt, trying with date field:', createdAtError);
      
      // Fallback: usar campo date
      try {
        const qDate = query(
          transactionsRef,
          where('date', '>=', startOfDay),
          where('date', '<=', endOfDay),
          orderBy('date', 'desc')
        );
        
        const dateSnapshot = await getDocs(qDate);
        dateSnapshot.forEach(doc => {
          transactions.push({
            id: doc.id,
            ...doc.data()
          } as Transaction);
        });
        
        console.log('📊 Transacciones encontradas (date):', transactions.length);
        
      } catch (dateError) {
        console.warn('⚠️ Error querying by date, getting all and filtering:', dateError);
        
        // Último recurso: obtener todas y filtrar manualmente
        const allSnapshot = await getDocs(transactionsRef);
        allSnapshot.forEach(doc => {
          const data = doc.data();
          const txDate = data.createdAt || data.date;
          
          if (txDate) {
            const txJsDate = txDate.toDate ? txDate.toDate() : new Date(txDate);
            if (txJsDate >= startOfDay.toDate() && txJsDate <= endOfDay.toDate()) {
              transactions.push({
                id: doc.id,
                ...data
              } as Transaction);
            }
          }
        });
        
        // Ordenar manualmente
        transactions.sort((a, b) => {
          const aTime = (a.createdAt || a.date);
          const bTime = (b.createdAt || b.date);
          
          const aSeconds = aTime?.seconds || 0;
          const bSeconds = bTime?.seconds || 0;
          
          return bSeconds - aSeconds; // Descendente (más reciente primero)
        });
        
        console.log('📊 Transacciones encontradas (manual):', transactions.length);
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('❌ Error getting transactions by date:', error);
    throw error;
  }
};

// Obtener resumen de transacciones para un rango de fechas (para reportes)
export const getTransactionsSummary = async (
  gymId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalIncome: number;
  totalExpense: number;
  membershipIncome: number;
  otherIncome: number;
  transactionsByType: Record<string, number>;
  transactionsByCategory: Record<string, number>;
}> => {
  try {
    // 🔧 USAR RANGOS DE FECHAS EN ARGENTINA
    const { start } = getArgentinianDayRange(startDate);
    const { end } = getArgentinianDayRange(endDate);
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const q = query(
      transactionsRef,
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    querySnapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      } as Transaction);
    });
    
    // Calcular totales
    let totalIncome = 0;
    let totalExpense = 0;
    let membershipIncome = 0;
    let otherIncome = 0;
    
    const transactionsByType: Record<string, number> = {};
    const transactionsByCategory: Record<string, number> = {};
    
    transactions.forEach(tx => {
      // Incrementar totales por tipo
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        
        // Incrementar por categoría de ingreso
        if (tx.category === 'membership') {
          membershipIncome += tx.amount;
        } else {
          otherIncome += tx.amount;
        }
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
      }
      
      // Contabilizar por tipo
      transactionsByType[tx.type] = (transactionsByType[tx.type] || 0) + tx.amount;
      
      // Contabilizar por categoría
      const category = tx.category || 'other';
      transactionsByCategory[category] = (transactionsByCategory[category] || 0) + tx.amount;
    });
    
    return {
      totalIncome,
      totalExpense,
      membershipIncome,
      otherIncome,
      transactionsByType,
      transactionsByCategory
    };
  } catch (error) {
    console.error('Error getting transactions summary:', error);
    throw error;
  }
};

export default {
  getDailyCashByDate,
  getDailyCashForDateRange,
  registerExtraIncome,
  registerExpense,
  closeDailyCash,
  openDailyCash,
  getTransactionsByDate,
  getTransactionsSummary
};