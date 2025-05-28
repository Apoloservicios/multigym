// src/hooks/useFinancial.ts - CON TIMEZONE ARGENTINA CORREGIDO

import { useState, useCallback, useEffect } from 'react';
import FinancialService, { 
  PaymentTransaction, 
  DailyCashSummary, 
  DailyCashRegister 
} from '../services/financial.service';
import useAuth from './useAuth';
import { Transaction } from '../types/gym.types';
// 🔧 IMPORTAR UTILIDADES DE TIMEZONE
import { getCurrentDateInArgentina } from '../utils/timezone.utils';

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
  const [loading, setLoading] = useState<boolean>(true); // 🔧 CAMBIAR A true INICIALMENTE
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // 🔧 NUEVO ESTADO

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

    // 🔧 NO CAMBIAR LOADING AQUÍ PARA EVITAR PARPADEOS
    setError(null);

    try {
      const transactionsData = await FinancialService.getTransactions(
        gymData.id,
        { ...filters, limit: 100 }
      );
      setTransactions(transactionsData);
      console.log(`📊 Transacciones cargadas en hook:`, transactionsData.length);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las transacciones');
    }
  }, [gymData?.id]);

  // 🔧 CARGAR RESUMEN DIARIO CON FECHA ARGENTINA
  const loadDailySummary = useCallback(async (date?: string) => {
    if (!gymData?.id) return;

    // 🔧 SI NO SE PROPORCIONA FECHA, USAR FECHA ACTUAL ARGENTINA
    const targetDate = date || getCurrentDateInArgentina();
    
    // 🔧 NO CAMBIAR LOADING AQUÍ PARA EVITAR PARPADEOS
    setError(null);

    try {
      console.log(`🔍 Cargando resumen diario para fecha argentina: ${targetDate}`);
      const summary = await FinancialService.getDailyCashSummary(gymData.id, targetDate);
      setDailySummary(summary);
      
      console.log(`📊 Resumen diario cargado:`, summary);
    } catch (err: any) {
      console.error('Error en loadDailySummary:', err);
      setError(err.message || 'Error al cargar el resumen diario');
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
      // 🔧 USAR FECHA ARGENTINA PARA CERRAR CAJA
      const today = getCurrentDateInArgentina();
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

  // 🔧 REFRESCAR DATOS USANDO FECHA ARGENTINA CON CONTROL DE INICIALIZACIÓN
  const refreshData = useCallback(async () => {
    if (!gymData?.id) return;

    console.log('🔄 Refrescando datos financieros...');
    
    // 🔧 SOLO MOSTRAR LOADING SI NO ESTÁ INICIALIZADO
    if (!isInitialized) {
      setLoading(true);
    }
    
    setError(null);
    
    // 🔧 OBTENER FECHA ARGENTINA ACTUAL
    const todayArgentina = getCurrentDateInArgentina();
    
    try {
      // 🔧 CARGAR DATOS EN PARALELO PERO ESPERAR A QUE TERMINEN
      await Promise.all([
        loadTransactions({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Último mes
          endDate: new Date()
        }),
        loadDailySummary(todayArgentina) // 🔧 USAR FECHA ARGENTINA
      ]);
      
      console.log('✅ Datos financieros refrescados exitosamente');
    } catch (error) {
      console.error('❌ Error refrescando datos financieros:', error);
      setError('Error al cargar los datos financieros');
    } finally {
      setLoading(false);
      if (!isInitialized) {
        setIsInitialized(true); // 🔧 MARCAR COMO INICIALIZADO
      }
    }
  }, [gymData?.id, loadTransactions, loadDailySummary, isInitialized]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============ EFECTOS ============

  // 🔧 CARGAR DATOS INICIALES CON FECHA ARGENTINA
  useEffect(() => {
    if (gymData?.id) {
      console.log('🚀 Iniciando carga de datos financieros...');
      refreshData();
    }
  }, [gymData?.id, refreshData]);

  // 🔧 DEBUG: Log cuando cambia dailySummary
  useEffect(() => {
    if (dailySummary) {
      console.log('📊 DailySummary actualizado:', {
        date: dailySummary.date,
        totalIncome: dailySummary.totalIncome,
        totalExpenses: dailySummary.totalExpenses,
        netAmount: dailySummary.netAmount,
        paymentBreakdown: dailySummary.paymentBreakdown
      });
    }
  }, [dailySummary]);

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