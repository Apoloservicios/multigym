// src/hooks/useMonthlyRenewalAutomation.ts
// 🗓️ HOOK PARA AUTOMATIZACIÓN MENSUAL DE RENOVACIONES
// Se ejecuta automáticamente al inicio de cada mes

import { useEffect } from 'react';
import { membershipRenewalService } from '../services/membershipRenewalService';

/**
 * Hook que maneja la automatización mensual de renovaciones
 */
export const useMonthlyRenewalAutomation = (
  gymId: string | undefined,
  enabled: boolean = true
) => {
  
  useEffect(() => {
    if (!gymId || !enabled) return;

    const checkAndProcessMonthlyRenewals = async () => {
      try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const storageKey = `lastMonthlyRenewal_${gymId}`;
        const lastProcessedMonth = localStorage.getItem(storageKey);
        
        // Solo ejecutar una vez por mes
        if (lastProcessedMonth === currentMonth) {
          console.log('✅ Renovaciones mensuales ya procesadas para:', currentMonth);
          return;
        }
        
        // Verificar si es el primer día del mes o los primeros días
        const dayOfMonth = now.getDate();
        if (dayOfMonth <= 3) { // Ejecutar en los primeros 3 días del mes
          console.log('🗓️ Iniciando proceso automático mensual de renovaciones...');
          
          const result = await membershipRenewalService.processAllAutoRenewals(gymId);
          
          if (result.success) {
            localStorage.setItem(storageKey, currentMonth);
            console.log(`✅ Proceso mensual completado: ${result.renewedCount} renovaciones`);
            
            // Opcional: Mostrar notificación al usuario
            if (result.renewedCount > 0) {
              // Aquí podrías mostrar una notificación toast
              console.log(`🎉 ${result.renewedCount} membresías renovadas automáticamente este mes`);
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error en proceso automático mensual:', error);
      }
    };

    // Ejecutar verificación inmediatamente
    checkAndProcessMonthlyRenewals();
    
    // Verificar diariamente (cada 24 horas)
    const interval = setInterval(checkAndProcessMonthlyRenewals, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
    
  }, [gymId, enabled]);
};
