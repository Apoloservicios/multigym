// src/services/dailyCash.service.ts - CORREGIDO PARA TIMESTAMPS

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

// Obtener registro de caja diaria por fecha
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
    console.error('Error getting daily cash by date:', error);
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

// 🔧 REGISTRAR INGRESO EXTRA - CORREGIDO TIMESTAMPS
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
    
    // 🔧 CREAR TRANSACCIÓN CON TIMESTAMP CORRECTO
    const now = new Date();
    const transactionData: Partial<Transaction> = {
      type: 'income',
      category: category as TransactionIncomeCategory,
      amount: data.amount,
      description: data.description,
      date: Timestamp.now(), // 🔧 USAR TIMESTAMP ACTUAL, NO DE LA FECHA STRING
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
    
    return {
      success: true,
      transactionId: transactionRef.id
    };
  } catch (error: any) {
    console.error('Error registering extra income:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el ingreso'
    };
  }
};

// 🔧 REGISTRAR GASTO - CORREGIDO TIMESTAMPS
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
    
    // 🔧 CREAR TRANSACCIÓN CON TIMESTAMP CORRECTO
    const transactionData: Partial<Transaction> = {
      type: 'expense',
      category: category as TransactionExpenseCategory,
      amount: data.amount, // 🔧 MANTENER POSITIVO, EL TIPO INDICA QUE ES EGRESO
      description: data.description,
      date: Timestamp.now(), // 🔧 USAR TIMESTAMP ACTUAL
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
    
    return {
      success: true,
      transactionId: transactionRef.id
    };
  } catch (error: any) {
    console.error('Error registering expense:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el gasto'
    };
  }
};

// Cerrar la caja diaria
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
    
    await updateDoc(dailyCashRef, {
      closingTime: Timestamp.now(),
      closingAmount: data.closingAmount,
      status: 'closed',
      closedBy: data.userId,
      notes: data.notes || dailyCashData.notes,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('Error closing daily cash:', error);
    return {
      success: false,
      error: error.message || 'Error al cerrar la caja'
    };
  }
};

// Abrir o reabrir la caja diaria
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
    const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, date);
    const dailyCashSnap = await getDoc(dailyCashRef);
    
    // Verificar si es hoy
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) {
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
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('Error opening daily cash:', error);
    return {
      success: false,
      error: error.message || 'Error al abrir la caja'
    };
  }
};

// 🔧 OBTENER TRANSACCIONES POR FECHA - MEJORADO PARA ORDENAR CORRECTAMENTE
export const getTransactionsByDate = async (
  gymId: string,
  date: string
): Promise<Transaction[]> => {
  try {
    // Convertir la fecha a objetos Date para el inicio y fin del día
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    
    // 🔧 USAR CONSULTA CON createdAt Y date PARA MAYOR FLEXIBILIDAD
    let transactions: Transaction[] = [];
    
    try {
      // Primero intentar con createdAt (más preciso)
      const qCreatedAt = query(
        transactionsRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'desc')
      );
      
      const createdAtSnapshot = await getDocs(qCreatedAt);
      createdAtSnapshot.forEach(doc => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
    } catch (createdAtError) {
      console.warn('Error querying by createdAt, trying with date field:', createdAtError);
      
      // Fallback: usar campo date
      try {
        const qDate = query(
          transactionsRef,
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(endDate)),
          orderBy('date', 'desc')
        );
        
        const dateSnapshot = await getDocs(qDate);
        dateSnapshot.forEach(doc => {
          transactions.push({
            id: doc.id,
            ...doc.data()
          } as Transaction);
        });
        
      } catch (dateError) {
        console.warn('Error querying by date, getting all and filtering:', dateError);
        
        // Último recurso: obtener todas y filtrar manualmente
        const allSnapshot = await getDocs(transactionsRef);
        allSnapshot.forEach(doc => {
          const data = doc.data();
          const txDate = data.createdAt || data.date;
          
          if (txDate) {
            const txJsDate = txDate.toDate ? txDate.toDate() : new Date(txDate);
            if (txJsDate >= startDate && txJsDate <= endDate) {
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
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('Error getting transactions by date:', error);
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
    // Convertir las fechas
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const q = query(
      transactionsRef,
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end)),
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