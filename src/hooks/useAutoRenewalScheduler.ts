// src/hooks/useAutoRenewalScheduler.ts
// 🆕 NUEVO: Hook para ejecutar renovaciones automáticas

import { useEffect } from 'react';
import { processExpiredMemberships } from '../services/membershipExpiration.service';

const useAutoRenewalScheduler = (gymId: string | undefined) => {
  useEffect(() => {
    if (!gymId) return;

    const executeRenewalCheck = async () => {
      try {
        const lastCheck = localStorage.getItem(`lastRenewalCheck_${gymId}`);
        const now = new Date();
        const today = now.toDateString();
        
        // Solo ejecutar una vez por día
        if (lastCheck !== today) {
          console.log('🔄 Ejecutando verificación diaria de renovaciones...');
          
          const result = await processExpiredMemberships(gymId);
          
          if (result.success) {
            localStorage.setItem(`lastRenewalCheck_${gymId}`, today);
            console.log(`✅ Verificación completada: 
            - ${result.renewedMemberships?.length || 0} renovadas automáticamente
            - ${result.expiredMemberships?.length || 0} expiradas`);
          }
        }
      } catch (error) {
        console.error('Error en verificación automática:', error);
      }
    };

    // Ejecutar inmediatamente si no se ha ejecutado hoy
    executeRenewalCheck();
    
    // Ejecutar cada 6 horas para verificar
    const interval = setInterval(executeRenewalCheck, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [gymId]);
};

export default useAutoRenewalScheduler;