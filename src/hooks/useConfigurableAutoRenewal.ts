// src/hooks/useConfigurableAutoRenewal.ts - CORREGIDO
import { useEffect, useState } from 'react';
// Cambiado al servicio correcto
import { membershipRenewalService } from '../services/membershipRenewalService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface AutoRenewalConfig {
  enabled: boolean;
  dayOfMonth: number;
  notifyOnly: boolean;
  lastRun?: string;
}

interface AutoRenewalResult {
  success: boolean;
  renewedCount: number;
  errorCount: number;
  errors: string[];
}

export const useConfigurableAutoRenewal = (gymId: string | undefined) => {
  const [config, setConfig] = useState<AutoRenewalConfig>({
    enabled: false,
    dayOfMonth: 1,
    notifyOnly: false
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<AutoRenewalResult | null>(null);

  // Cargar configuración
  useEffect(() => {
    if (!gymId) return;
    
    const loadConfig = async () => {
      try {
        const configRef = doc(db, `gyms/${gymId}/settings`, 'autoRenewal');
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
          setConfig(configSnap.data() as AutoRenewalConfig);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    };
    
    loadConfig();
  }, [gymId]);

  // Guardar configuración
  const saveConfig = async (newConfig: AutoRenewalConfig) => {
    if (!gymId) return;
    
    try {
      const configRef = doc(db, `gyms/${gymId}/settings`, 'autoRenewal');
      await setDoc(configRef, newConfig);
      setConfig(newConfig);
      return true;
    } catch (error) {
      console.error('Error guardando configuración:', error);
      return false;
    }
  };

  // Verificar y ejecutar si es necesario
  const checkAndProcess = async () => {
    if (!gymId || !config.enabled || isProcessing) return;
    
    const today = new Date();
    const currentDay = today.getDate();
    
    // Verificar si es el día configurado
    if (currentDay !== config.dayOfMonth) return;
    
    // Verificar si ya se ejecutó hoy
    if (config.lastRun === today.toISOString().split('T')[0]) return;
    
    setIsProcessing(true);
    
    try {
      if (config.notifyOnly) {
        // Solo verificar y notificar, no renovar automáticamente
        const expiredMemberships = await membershipRenewalService.getMembershipsNeedingRenewal(gymId);
        
        if (expiredMemberships.length > 0) {
          console.log(`📢 Hay ${expiredMemberships.length} membresías que necesitan renovación`);
          
          // Aquí podrías enviar notificaciones por email o mostrar en el dashboard
          setLastResult({
            success: true,
            renewedCount: 0,
            errorCount: 0,
            errors: [`${expiredMemberships.length} membresías pendientes de renovación manual`]
          });
        }
      } else {
        // Procesar renovaciones automáticamente
        const result = await membershipRenewalService.processAllAutoRenewals(gymId);
        
        setLastResult({
          success: result.success,
          renewedCount: result.renewedCount,
          errorCount: result.errorCount,
          errors: result.errors
        });
        
        // Actualizar última ejecución
        await saveConfig({
          ...config,
          lastRun: today.toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error('Error en proceso automático:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Ejecutar verificación cada hora
  useEffect(() => {
    if (!gymId || !config.enabled) return;
    
    // Verificar al montar
    checkAndProcess();
    
    // Configurar intervalo de verificación cada hora
    const interval = setInterval(checkAndProcess, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [gymId, config]);

  // Forzar ejecución manual
  const forceProcess = async () => {
    if (!gymId || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const result = await membershipRenewalService.processAllAutoRenewals(gymId);
      
      setLastResult({
        success: result.success,
        renewedCount: result.renewedCount,
        errorCount: result.errorCount,
        errors: result.errors
      });
      
      return result;
    } catch (error) {
      console.error('Error en proceso manual:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    config,
    saveConfig,
    isProcessing,
    lastResult,
    forceProcess
  };
};