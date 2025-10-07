// src/hooks/useMonthlyPaymentsAutomation.ts
// 🤖 HOOK DE AUTOMATIZACIÓN - Genera pagos mensuales automáticamente
// Se ejecuta cuando cualquier admin abre la app

import { useEffect, useState } from 'react';
import { generateMonthlyPayments } from '../services/monthlyPayments.service';

interface AutomationStatus {
  isRunning: boolean;
  lastRun: Date | null;
  lastResult: {
    success: boolean;
    paymentsGenerated: number;
    errors: string[];
  } | null;
}

/**
 * 🤖 Hook que automatiza la generación de pagos mensuales
 * 
 * Cómo funciona:
 * 1. Se ejecuta cuando se monta el componente (al abrir la app)
 * 2. Verifica si ya se ejecutó hoy usando localStorage
 * 3. Si no se ejecutó, genera los pagos del mes actual
 * 4. Guarda el resultado para no ejecutar de nuevo hasta mañana
 * 
 * @param gymId - ID del gimnasio
 * @param enabled - Si está habilitada la automatización (por defecto true)
 */
export const useMonthlyPaymentsAutomation = (
  gymId: string | undefined,
  enabled: boolean = true
) => {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    lastRun: null,
    lastResult: null
  });

  useEffect(() => {
    // Solo ejecutar si:
    // - Está habilitado
    // - Hay un gymId válido
    // - No se está ejecutando actualmente
    if (!enabled || !gymId || status.isRunning) {
      return;
    }

    const runAutomation = async () => {
      try {
        // Verificar si ya se ejecutó hoy
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const lastRunKey = `monthlyPayments_lastRun_${gymId}`;
        const lastRunDate = localStorage.getItem(lastRunKey);

        if (lastRunDate === today) {
          console.log('✅ Automatización ya ejecutada hoy');
          
          // Cargar resultado anterior del localStorage
          const lastResultKey = `monthlyPayments_lastResult_${gymId}`;
          const savedResult = localStorage.getItem(lastResultKey);
          
          if (savedResult) {
            setStatus({
              isRunning: false,
              lastRun: new Date(lastRunDate),
              lastResult: JSON.parse(savedResult)
            });
          }
          
          return;
        }

        console.log('🤖 Iniciando automatización de pagos mensuales...');
        setStatus(prev => ({ ...prev, isRunning: true }));

        // Ejecutar generación
        const result = await generateMonthlyPayments(gymId);

        // Guardar resultado
        const resultToSave = {
          success: result.success,
          paymentsGenerated: result.paymentsGenerated,
          errors: result.errors
        };

        // Guardar en localStorage
        localStorage.setItem(lastRunKey, today);
        localStorage.setItem(
          `monthlyPayments_lastResult_${gymId}`,
          JSON.stringify(resultToSave)
        );

        setStatus({
          isRunning: false,
          lastRun: new Date(),
          lastResult: resultToSave
        });

        if (result.success) {
          console.log(`✅ Automatización completa: ${result.paymentsGenerated} pagos generados`);
        } else {
          console.error('❌ Errores en automatización:', result.errors);
        }

      } catch (error) {
        console.error('❌ Error en automatización:', error);
        setStatus({
          isRunning: false,
          lastRun: new Date(),
          lastResult: {
            success: false,
            paymentsGenerated: 0,
            errors: [error instanceof Error ? error.message : 'Error desconocido']
          }
        });
      }
    };

    runAutomation();
  }, [gymId, enabled, status.isRunning]);

  /**
   * 🔄 Función para forzar ejecución manual
   * Útil para botón de "Generar pagos ahora"
   */
  const runManually = async () => {
    if (!gymId || status.isRunning) return;

    try {
      console.log('🔄 Generación manual iniciada...');
      setStatus(prev => ({ ...prev, isRunning: true }));

      const result = await generateMonthlyPayments(gymId);

      const resultToSave = {
        success: result.success,
        paymentsGenerated: result.paymentsGenerated,
        errors: result.errors
      };

      // Actualizar localStorage
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`monthlyPayments_lastRun_${gymId}`, today);
      localStorage.setItem(
        `monthlyPayments_lastResult_${gymId}`,
        JSON.stringify(resultToSave)
      );

      setStatus({
        isRunning: false,
        lastRun: new Date(),
        lastResult: resultToSave
      });

      return result;

    } catch (error) {
      console.error('❌ Error en generación manual:', error);
      setStatus({
        isRunning: false,
        lastRun: new Date(),
        lastResult: {
          success: false,
          paymentsGenerated: 0,
          errors: [error instanceof Error ? error.message : 'Error desconocido']
        }
      });
      throw error;
    }
  };

  return {
    ...status,
    runManually
  };
};

export default useMonthlyPaymentsAutomation;