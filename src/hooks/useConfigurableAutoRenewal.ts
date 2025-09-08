// src/hooks/useConfigurableAutoRenewal.ts
// 🔧 HOOK MEJORADO: Renovaciones automáticas configurables

import { useEffect, useState } from 'react';
import { processExpiredMemberships } from '../services/membershipExpiration.service';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface AutoRenewalConfig {
  enabled: boolean;
  frequency: 'daily' | 'manual' | 'weekly';
  notifyOnly: boolean; // Solo notifica, no renueva automáticamente
  lastCheck?: string;
}

const useConfigurableAutoRenewal = (gymId: string | undefined) => {
  const [config, setConfig] = useState<AutoRenewalConfig | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Cargar configuración del gimnasio
  useEffect(() => {
    if (!gymId) return;

    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, `gyms/${gymId}/settings/autoRenewal`));
        
        if (configDoc.exists()) {
          setConfig(configDoc.data() as AutoRenewalConfig);
        } else {
          // Configuración por defecto: solo notificar, no renovar automáticamente
          const defaultConfig: AutoRenewalConfig = {
            enabled: true,
            frequency: 'manual',
            notifyOnly: true
          };
          
          await setDoc(doc(db, `gyms/${gymId}/settings/autoRenewal`), defaultConfig);
          setConfig(defaultConfig);
        }
      } catch (error) {
        console.error('Error cargando configuración de auto-renovación:', error);
      }
    };

    loadConfig();
  }, [gymId]);

  // Ejecutar verificación según configuración
  useEffect(() => {
    if (!gymId || !config || !config.enabled) return;

    const executeRenewalCheck = async () => {
      try {
        const now = new Date();
        const today = now.toDateString();
        
        // Verificar si debe ejecutarse según frecuencia
        let shouldRun = false;
        
        if (config.frequency === 'daily' && config.lastCheck !== today) {
          shouldRun = true;
        } else if (config.frequency === 'weekly') {
          const lastCheck = config.lastCheck ? new Date(config.lastCheck) : null;
          const daysSinceCheck = lastCheck ? 
            Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24)) : 7;
          
          if (daysSinceCheck >= 7) {
            shouldRun = true;
          }
        }
        
        if (!shouldRun) return;

        console.log('🔄 Ejecutando verificación de renovaciones...');
        setIsChecking(true);
        
        if (config.notifyOnly) {
          // Solo verificar y notificar, no renovar automáticamente
          const { getExpiredAutoRenewals } = await import('../services/membershipExpiration.service');
          const expiredMemberships = await getExpiredAutoRenewals(gymId);
          
          if (expiredMemberships.length > 0) {
            // Enviar notificación al dashboard
            console.log(`⚠️ ${expiredMemberships.length} membresías requieren atención`);
            
            // Guardar notificación en localStorage para mostrar en dashboard
            localStorage.setItem(`pendingRenewals_${gymId}`, JSON.stringify({
              count: expiredMemberships.length,
              timestamp: today,
              memberships: expiredMemberships.map(m => ({
                memberName: m.memberName,
                activityName: m.activityName,
                endDate: m.endDate
              }))
            }));
          }
        } else {
          // Procesar renovaciones automáticamente
          const result = await processExpiredMemberships(gymId);
          
          if (result.success) {
            console.log(`✅ Verificación completada: 
            - ${result.renewedMemberships?.length || 0} renovadas automáticamente
            - ${result.expiredMemberships?.length || 0} expiradas`);
          }
        }
        
        // Actualizar última verificación
        await setDoc(doc(db, `gyms/${gymId}/settings/autoRenewal`), {
          ...config,
          lastCheck: today
        });
        
      } catch (error) {
        console.error('Error en verificación automática:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Ejecutar inmediatamente si debe ejecutarse
    executeRenewalCheck();
    
    // Configurar intervalo según frecuencia
    let interval: NodeJS.Timeout | null = null;
    
    if (config.frequency === 'daily') {
      // Verificar cada 6 horas
      interval = setInterval(executeRenewalCheck, 6 * 60 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gymId, config]);

  // Función para actualizar configuración
  const updateConfig = async (newConfig: Partial<AutoRenewalConfig>) => {
    if (!gymId || !config) return;

    try {
      const updatedConfig = { ...config, ...newConfig };
      await setDoc(doc(db, `gyms/${gymId}/settings/autoRenewal`), updatedConfig);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Error actualizando configuración:', error);
    }
  };

  return {
    config,
    isChecking,
    updateConfig
  };
};

export default useConfigurableAutoRenewal;