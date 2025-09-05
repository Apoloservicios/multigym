// src/hooks/useMonthlyPaymentScheduler.ts
// 🤖 HOOK PARA LA AUTOMATIZACIÓN MENSUAL

import { useEffect } from 'react';
import { MonthlyPaymentsService } from '../services/monthlyPayments.service';

/**
 * Hook que verifica automáticamente si debe ejecutarse la generación mensual
 * Se ejecuta cuando el usuario abre la aplicación
 */
const useMonthlyPaymentScheduler = (gymId: string | undefined) => {
  
  useEffect(() => {
    if (!gymId) return;

    const checkAndProcess = async () => {
      try {
        console.log('🔍 Verificando si necesita procesar automatización mensual...');
        
        // Verificar si hoy es 1° del mes y no se ha procesado
        const shouldProcess = await MonthlyPaymentsService.checkIfShouldProcess(gymId);
        
        if (shouldProcess) {
          console.log('🚀 ¡Es momento de generar pagos automáticos!');
          
          // Mostrar notificación al usuario (opcional)
          if (window.confirm(
            '🤖 Es el 1° del mes. ¿Deseas generar automáticamente los cobros mensuales?\n\n' +
            'Esto creará las cuotas pendientes para todos los socios activos.'
          )) {
            
            const result = await MonthlyPaymentsService.generateMonthlyPayments(gymId);
            
            if (result.success) {
              alert(`✅ Automatización completada:\n` +
                    `• ${result.processedMembers} socios procesados\n` +
                    `• $${result.totalAmount.toLocaleString('es-AR')} generado\n` +
                    `${result.errors.length > 0 ? `• ${result.errors.length} errores` : ''}`);
            } else {
              console.error('❌ Error en automatización:', result.errors);
            }
          }
        } else {
          console.log('✅ Automatización al día - no es necesario procesar');
        }
        
      } catch (error) {
        console.error('❌ Error en verificación automática:', error);
      }
    };

    // Ejecutar al montar el componente (cuando abren la app)
    checkAndProcess();
    
    // Verificar cada 6 horas en caso de que dejen la app abierta
    const interval = setInterval(checkAndProcess, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
    
  }, [gymId]);
};

export default useMonthlyPaymentScheduler;

