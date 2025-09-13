// HOOK DE AUTOMATIZACIÓN MENSUAL - CORREGIDO
import { useEffect, useState, useCallback } from 'react';
import { membershipRenewalService } from '../services/membershipRenewalService';
import useAuth from './useAuth';

interface AutomationState {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  isEnabled: boolean;
  error: string | null;
}

export const useMonthlyRenewalAutomation = () => {
  const { gymData } = useAuth(); // Removido 'user' que no existe
  const [automationState, setAutomationState] = useState<AutomationState>({
    isRunning: false,
    lastRun: null,
    nextRun: null,
    isEnabled: true,
    error: null
  });

  // Calcular próxima ejecución
  const calculateNextRun = useCallback((): Date => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextMonth.setHours(3, 0, 0, 0); // 3 AM del primer día del mes
    return nextMonth;
  }, []);

  // Verificar si debe ejecutarse
  const shouldRunAutomation = useCallback((): boolean => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    
    // Solo ejecutar los primeros 3 días del mes
    if (dayOfMonth > 3) return false;
    
    // Verificar si ya se ejecutó este mes
    const lastRunKey = `lastRenewalRun_${gymData?.id}`;
    const lastRun = localStorage.getItem(lastRunKey);
    
    if (lastRun) {
      const lastRunDate = new Date(lastRun);
      const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
      const lastRunMonth = `${lastRunDate.getFullYear()}-${lastRunDate.getMonth()}`;
      
      if (currentMonth === lastRunMonth) {
        return false; // Ya se ejecutó este mes
      }
    }
    
    return true;
  }, [gymData]);

  // Ejecutar automatización
  const runAutomation = useCallback(async () => {
    if (!gymData?.id || !automationState.isEnabled) return;
    
    setAutomationState(prev => ({ ...prev, isRunning: true, error: null }));
    
    try {
      console.log('🤖 Ejecutando renovación automática mensual...');
      
      const result = await membershipRenewalService.runMonthlyProcess(gymData.id);
      
      if (result.success || result.totalProcessed === 0) {
        // Guardar última ejecución
        const lastRunKey = `lastRenewalRun_${gymData.id}`;
        localStorage.setItem(lastRunKey, new Date().toISOString());
        
        setAutomationState(prev => ({
          ...prev,
          isRunning: false,
          lastRun: new Date(),
          nextRun: calculateNextRun(),
          error: null
        }));
        
        console.log('✅ Renovación automática completada:', result);
      } else {
        throw new Error('Error en el proceso de renovación');
      }
    } catch (error) {
      console.error('❌ Error en automatización:', error);
      setAutomationState(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }));
    }
  }, [gymData, automationState.isEnabled, calculateNextRun]);

  // Verificar y ejecutar al montar y cada hora
  useEffect(() => {
    if (!gymData?.id) return; // Removido check de 'user'

    // Verificar al montar
    if (shouldRunAutomation()) {
      runAutomation();
    }

    // Configurar verificación periódica (cada hora)
    const interval = setInterval(() => {
      if (shouldRunAutomation()) {
        runAutomation();
      }
    }, 60 * 60 * 1000); // Cada hora

    // Actualizar próxima ejecución
    setAutomationState(prev => ({
      ...prev,
      nextRun: calculateNextRun()
    }));

    return () => clearInterval(interval);
  }, [gymData, shouldRunAutomation, runAutomation, calculateNextRun]); // Removido 'user' de las dependencias

  // Funciones de control manual
  const forceRun = useCallback(async () => {
    if (!gymData?.id) return;
    
    console.log('⚡ Forzando ejecución manual...');
    setAutomationState(prev => ({ ...prev, isEnabled: true }));
    await runAutomation();
  }, [gymData, runAutomation]);

  const toggleAutomation = useCallback(() => {
    setAutomationState(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled
    }));
  }, []);

  return {
    automationState,
    forceRun,
    toggleAutomation,
    shouldRunAutomation
  };
};