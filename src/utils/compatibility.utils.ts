// src/utils/compatibility.utils.ts - Funciones para mantener compatibilidad

import { Transaction, DailyCash } from '../types/gym.types';

// ============ MAPPERS PARA TRANSACCIONES ============

/**
 * Convierte los nuevos tipos de transacción a los existentes para compatibilidad
 */
export const mapTransactionType = (newType: string): string => {
  const typeMap: { [key: string]: string } = {
    'membership_payment': 'income',
    'other_income': 'income',
    'penalty': 'income',
    'refund': 'expense',
    'expense': 'expense'
  };
  
  return typeMap[newType] || newType;
};

/**
 * Convierte los tipos existentes a los nuevos
 */
export const mapLegacyTransactionType = (legacyType: string, category?: string): string => {
  if (legacyType === 'income') {
    if (category === 'membership') return 'membership_payment';
    if (category === 'penalty') return 'penalty';
    return 'other_income';
  }
  
  if (legacyType === 'expense') {
    if (category === 'refund') return 'refund';
    return 'expense';
  }
  
  return legacyType;
};

/**
 * Normaliza un objeto Transaction para usar con código existente
 */
export const normalizeTransactionForLegacy = (transaction: any): Transaction => {
  return {
    ...transaction,
    // Asegurar que date existe para código legacy
    date: transaction.date || transaction.createdAt,
    // Mapear tipo para compatibilidad
    type: mapTransactionType(transaction.type) as any,
    // Asegurar category existe
    category: transaction.category || (
      transaction.type === 'membership_payment' ? 'membership' :
      transaction.type === 'penalty' ? 'penalty' :
      transaction.type === 'refund' ? 'refund' : 'other'
    ),
    // Asegurar userName existe
    userName: transaction.userName || transaction.processedBy || 'Sistema'
  };
};

// ============ MAPPERS PARA CAJA DIARIA ============

/**
 * Normaliza un objeto DailyCash para compatibilidad con código existente
 */
export const normalizeDailyCashForLegacy = (dailyCash: any): DailyCash => {
  return {
    ...dailyCash,
    // Mapear campos para compatibilidad con código existente
    openingAmount: dailyCash.openingAmount || dailyCash.openingBalance || 0,
    closingAmount: dailyCash.closingAmount || dailyCash.closingBalance,
    openingTime: dailyCash.openingTime || dailyCash.openedAt,
    closingTime: dailyCash.closingTime || dailyCash.closedAt,
    totalExpense: dailyCash.totalExpense || dailyCash.totalExpenses || 0,
    
    // Mantener campos nuevos también
    totalExpenses: dailyCash.totalExpenses || dailyCash.totalExpense || 0,
    openingBalance: dailyCash.openingBalance || dailyCash.openingAmount || 0,
    closingBalance: dailyCash.closingBalance || dailyCash.closingAmount,
    
    // Campos calculados si no existen
    membershipIncome: dailyCash.membershipIncome || 0,
    otherIncome: dailyCash.otherIncome || dailyCash.totalIncome || 0
  };
};

// ============ HELPERS PARA DETERMINAR TIPO DE TRANSACCIÓN ============

/**
 * Determina si una transacción es un ingreso basado en el tipo
 */
export const isIncomeTransaction = (transaction: Transaction): boolean => {
  const incomeTypes = ['income', 'membership_payment', 'other_income', 'penalty'];
  return incomeTypes.includes(transaction.type);
};

/**
 * Determina si una transacción es un egreso basado en el tipo
 */
export const isExpenseTransaction = (transaction: Transaction): boolean => {
  const expenseTypes = ['expense', 'refund'];
  return expenseTypes.includes(transaction.type);
};

/**
 * Obtiene el color CSS apropiado para el tipo de transacción
 */
export const getTransactionColor = (transaction: Transaction): string => {
  if (isIncomeTransaction(transaction)) {
    return 'text-green-600';
  } else if (isExpenseTransaction(transaction)) {
    return 'text-red-600';
  }
  return 'text-gray-600';
};

/**
 * Obtiene el símbolo apropiado para el tipo de transacción
 */
export const getTransactionSymbol = (transaction: Transaction): string => {
  if (isIncomeTransaction(transaction)) {
    return '+';
  } else if (isExpenseTransaction(transaction)) {
    return '-';
  }
  return '';
};

// ============ FUNCIONES DE CÁLCULO COMPATIBLES ============

/**
 * Calcula el balance de caja considerando apertura + ingresos - egresos
 */
export const calculateCashBalance = (dailyCash: DailyCash): number => {
  const opening = dailyCash.openingAmount || dailyCash.openingBalance || 0;
  const income = dailyCash.totalIncome || 0;
  const expense = dailyCash.totalExpense || dailyCash.totalExpenses || 0;
  
  return opening + income - expense;
};

/**
 * Filtra transacciones por tipo usando compatibilidad
 */
export const filterTransactionsByType = (
  transactions: Transaction[], 
  type: 'income' | 'expense' | 'all'
): Transaction[] => {
  if (type === 'all') return transactions;
  
  return transactions.filter(tx => {
    if (type === 'income') {
      return isIncomeTransaction(tx);
    } else if (type === 'expense') {
      return isExpenseTransaction(tx);
    }
    return false;
  });
};

/**
 * Obtiene el nombre de categoría en español
 */
export const getCategoryDisplayName = (category: string | undefined): string => {
  const categoryNames: { [key: string]: string } = {
    'membership': 'Membresía',
    'extra': 'Ingreso Extra',
    'penalty': 'Multa',
    'withdrawal': 'Retiro',
    'refund': 'Devolución',
    'expense': 'Gasto',
    'other': 'Otro'
  };
  
  return categoryNames[category || 'other'] || (category || 'Otro');
};

/**
 * Calcula totales de transacciones por tipo
 */
export const calculateTransactionTotals = (transactions: Transaction[]) => {
  return transactions.reduce((totals, tx) => {
    if (isIncomeTransaction(tx)) {
      totals.income += tx.amount;
    } else if (isExpenseTransaction(tx)) {
      totals.expense += tx.amount;
    }
    return totals;
  }, { income: 0, expense: 0 });
};

export default {
  mapTransactionType,
  mapLegacyTransactionType,
  normalizeTransactionForLegacy,
  normalizeDailyCashForLegacy,
  isIncomeTransaction,
  isExpenseTransaction,
  getTransactionColor,
  getTransactionSymbol,
  calculateCashBalance,
  filterTransactionsByType,
  getCategoryDisplayName,
  calculateTransactionTotals
};