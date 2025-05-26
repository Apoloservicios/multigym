// src/hooks/useFinancial.ts - Hook para gestión financiera CORREGIDO

import { useState, useCallback, useEffect } from 'react';
import FinancialService, { 
  PaymentTransaction, 
  DailyCashSummary, 
  DailyCashRegister 
} from '../services/financial.service';
import useAuth from './useAuth';
import { Transaction } from '../types/gym.types';

interface UseFinancialReturn {
  // Estados
  transactions: Transaction[];
  dailySummary: DailyCashSummary | null;
  loading: boolean;
  error: string | null;
  processing: boolean;
  
  // Funciones de pago
  processMembershipPayment: (
    membershipAssignmentId: string,
    paymentData: {
      amount: number;
      paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
      notes?: string;
    }
  ) => Promise<{ success: boolean; transactionId?: string; error?: string }>;
  
  processRefund: (
    originalTransactionId: string,
    refundData: {
      amount: number;
      reason: string;
      notes?: string;
    }
  ) => Promise<{ success: boolean; refundTransactionId?: string; error?: string }>;
  
  // Funciones de consulta
  loadTransactions: (filters?: {
    startDate?: Date;
    endDate?: Date;
    memberId?: string;
    status?: string;
    type?: string;
  }) => Promise<void>;
  
  loadDailySummary: (date: string) => Promise<void>;
  
  // Funciones de caja
  closeDailyCash: (closingData: {
    closingBalance: number;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  
  // Utilidades
  refreshData: () => Promise<void>;
  clearError: () => void;
}

export const useFinancial = (): UseFinancialReturn => {
  const { gymData, userData } = useAuth();
  
  // Estados
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailySummary, setDailySummary] = useState<DailyCashSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // ============ FUNCIONES DE PAGO ============

  const processMembershipPayment = useCallback(async (
    membershipAssignmentId: string,
    paymentData: {
      amount: number;
      paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
      notes?: string;
    }
  ) => {
    if (!gymData?.id || !userData?.id) {
      return { success: false, error: 'Datos de autenticación no disponibles' };
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await FinancialService.processMembershipPayment(
        gymData.id,
        membershipAssignmentId,
        {
          ...paymentData,
          processedBy: userData.id
        }
      );

      if (result.success) {
        // Recargar datos después del pago exitoso
        await refreshData();
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Error al procesar el pago';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setProcessing(false);
    }
  }, [gymData?.id, userData?.id]);

  const processRefund = useCallback(async (
    originalTransactionId: string,
    refundData: {
      amount: number;
      reason: string;
      notes?: string;
    }
  ) => {
    if (!gymData?.id || !userData?.id) {
      return { success: false, error: 'Datos de autenticación no disponibles' };
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await FinancialService.processRefund(
        gymData.id,
        originalTransactionId,
        {
          ...refundData,
          processedBy: userData.id
        }
      );

      if (result.success) {
        await refreshData();
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Error al procesar la devolución';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setProcessing(false);
    }
  }, [gymData?.id, userData?.id]);

  // ============ FUNCIONES DE CONSULTA ============

  const loadTransactions = useCallback(async (filters?: {
    startDate?: Date;
    endDate?: Date;
    memberId?: string;
    status?: string;
    type?: string;
  }) => {
    if (!gymData?.id) return;

    setLoading(true);
    setError(null);

    try {
      const transactionsData = await FinancialService.getTransactions(
        gymData.id,
        { ...filters, limit: 100 }
      );
      setTransactions(transactionsData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las transacciones');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id]);

  const loadDailySummary = useCallback(async (date: string) => {
    if (!gymData?.id) return;

    setLoading(true);
    setError(null);

    try {
      const summary = await FinancialService.getDailyCashSummary(gymData.id, date);
      setDailySummary(summary);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el resumen diario');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id]);

  // ============ FUNCIONES DE CAJA ============

  const closeDailyCash = useCallback(async (closingData: {
    closingBalance: number;
    notes?: string;
  }) => {
    if (!gymData?.id || !userData?.id) {
      return { success: false, error: 'Datos de autenticación no disponibles' };
    }

    setProcessing(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await FinancialService.closeDailyCash(
        gymData.id,
        today,
        {
          ...closingData,
          closedBy: userData.id
        }
      );

      if (result.success) {
        await loadDailySummary(today);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Error al cerrar la caja';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setProcessing(false);
    }
  }, [gymData?.id, userData?.id, loadDailySummary]);

  // ============ UTILIDADES ============

  const refreshData = useCallback(async () => {
    if (!gymData?.id) return;

    const today = new Date().toISOString().split('T')[0];
    const promises = [
      loadTransactions({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Último mes
        endDate: new Date()
      }),
      loadDailySummary(today)
    ];

    await Promise.allSettled(promises);
  }, [gymData?.id, loadTransactions, loadDailySummary]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============ EFECTOS ============

  // Cargar datos iniciales
  useEffect(() => {
    if (gymData?.id) {
      refreshData();
    }
  }, [gymData?.id, refreshData]);

  return {
    // Estados
    transactions,
    dailySummary,
    loading,
    error,
    processing,
    
    // Funciones de pago
    processMembershipPayment,
    processRefund,
    
    // Funciones de consulta
    loadTransactions,
    loadDailySummary,
    
    // Funciones de caja
    closeDailyCash,
    
    // Utilidades
    refreshData,
    clearError
  };
};

export default useFinancial;

