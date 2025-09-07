// src/hooks/useMonthlyPaymentScheduler.ts
// 🤖 HOOK MEJORADO PARA LA AUTOMATIZACIÓN MENSUAL

import { useEffect, useRef } from 'react';
import MonthlyPaymentsService from '../services/monthlyPayments.service';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook que verifica automáticamente si debe ejecutarse la generación mensual
 * Se ejecuta cuando el usuario abre la aplicación
 * Solo para administradores
 */
const useMonthlyPaymentScheduler = () => {
  const { gymData, userRole } = useAuth();
  const lastCheckRef = useRef<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Solo funciona para administradores y si hay gymData
    if (!gymData?.id || userRole !== 'admin') return;

    const checkAndProcess = async () => {
      try {
        const today = new Date().toDateString();
        
        // Evitar múltiples verificaciones el mismo día
        if (lastCheckRef.current === today) return;
        
        console.log('🔍 Verificando si necesita procesar automatización mensual...');
        
        // Verificar si hoy es 1° del mes y no se ha procesado
        const shouldProcess = await MonthlyPaymentsService.checkIfShouldProcess(gymData.id);
        
        if (shouldProcess) {
          console.log('🚀 ¡Es momento de generar pagos automáticos!');
          
          // Mostrar notificación al usuario con más información
          const confirmMessage = 
            '🤖 Es el 1° del mes. ¿Deseas generar automáticamente los cobros mensuales?\n\n' +
            '✅ Esto creará las cuotas pendientes para todos los socios activos.\n' +
            '✅ Solo se procesan membresías con auto-renovación habilitada.\n' +
            '✅ Puedes revisar los resultados en el Dashboard de Cobros.\n\n' +
            '¿Proceder con la automatización?';
          
          if (window.confirm(confirmMessage)) {
            
            const result = await MonthlyPaymentsService.generateMonthlyPayments(gymData.id);
            
            if (result.success) {
              // Mensaje de éxito detallado
              const successMessage = 
                `✅ Automatización completada exitosamente:\n\n` +
                `• ${result.processedMembers} socios procesados\n` +
                `• ${result.totalAmount.toLocaleString('es-AR')} total generado\n` +
                `${result.errors.length > 0 ? `• ${result.errors.length} errores (revisar consola)` : ''}\n\n` +
                `Puedes revisar los detalles en el Dashboard de Cobros.`;
              
              alert(successMessage);
              
              // Marcar como verificado hoy
              lastCheckRef.current = today;
              
            } else {
              console.error('❌ Error en automatización:', result.errors);
              alert(`❌ Error en la automatización:\n\n${result.errors.join('\n')}\n\nRevisar la consola para más detalles.`);
            }
          } else {
            console.log('⏸️ Usuario canceló la automatización mensual');
            // Marcar como verificado para no volver a preguntar hoy
            lastCheckRef.current = today;
          }
        } else {
          console.log('✅ Automatización al día - no es necesario procesar');
          lastCheckRef.current = today;
        }
        
      } catch (error) {
        console.error('❌ Error en verificación automática:', error);
        // No mostrar alert para errores de verificación para evitar spam
      }
    };

    // Ejecutar inmediatamente al montar el componente
    setTimeout(checkAndProcess, 2000); // Delay de 2 segundos para que cargue todo
    
    // Verificar cada 6 horas en caso de que dejen la app abierta
    intervalRef.current = setInterval(checkAndProcess, 6 * 60 * 60 * 1000);
    
    // Cleanup al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    
  }, [gymData?.id, userRole]);

  // No devuelve nada - es un hook de efecto secundario
};

export default useMonthlyPaymentScheduler;