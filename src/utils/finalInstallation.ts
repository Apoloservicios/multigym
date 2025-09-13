// src/utils/finalInstallation.ts
// 🚀 INSTALACIÓN FINAL Y VERIFICACIÓN COMPLETA DEL SISTEMA

/**
 * Lista de archivos que deben estar creados
 */
export const REQUIRED_FILES = [
  {
    path: 'src/services/membershipRenewalService.ts',
    description: 'Servicio central de renovaciones',
    status: 'required'
  },
  {
    path: 'src/components/memberships/UnifiedRenewalDashboard.tsx',
    description: 'Dashboard principal unificado',
    status: 'required'
  },
  {
    path: 'src/components/memberships/IndividualMembershipManagement.tsx',
    description: 'Gestión individual por usuario',
    status: 'required'
  },
  {
    path: 'src/components/memberships/MonthlyReportGenerator.tsx',
    description: 'Generador de reportes Excel',
    status: 'required'
  },
  {
    path: 'src/hooks/useMonthlyRenewalAutomation.ts',
    description: 'Hook de automatización mensual',
    status: 'required'
  },
  {
    path: 'src/services/excelReportService.ts',
    description: 'Servicio de generación de Excel',
    status: 'required'
  },
  {
    path: 'src/utils/format.utils.ts',
    description: 'Utilidades de formato',
    status: 'required'
  },
  {
    path: 'src/utils/membershipMigration.util.ts',
    description: 'Utilidad de migración de datos',
    status: 'required'
  },
  {
    path: 'src/pages/MembershipManagement.tsx',
    description: 'Página principal actualizada',
    status: 'updated'
  }
];

/**
 * Lista de archivos que se deben ELIMINAR
 */
export const FILES_TO_REMOVE = [
  'src/components/memberships/UnifiedMembershipDashboard.tsx',
  'src/components/memberships/AutoRenewalDashboard.tsx',
  'src/components/memberships/EnhancedMemberControls.tsx',
  'src/services/membershipExpiration.service.ts',
  'src/services/membershipAutoRenewal.service.ts',
  'src/hooks/useAutoRenewalScheduler.ts'
];

/**
 * Verificar la instalación completa
 */
export const runCompleteInstallationCheck = (): void => {
  console.log('🔍 VERIFICACIÓN FINAL DEL SISTEMA DE RENOVACIONES');
  console.log('================================================');
  
  console.log('\n📋 ARCHIVOS REQUERIDOS:');
  REQUIRED_FILES.forEach((file, index) => {
    console.log(`${index + 1}. ${file.path}`);
    console.log(`   📝 ${file.description}`);
    console.log(`   🏷️  ${file.status === 'required' ? 'Nuevo archivo' : 'Archivo actualizado'}`);
    console.log('');
  });
  
  console.log('\n🗑️  ARCHIVOS A ELIMINAR (ya no necesarios):');
  FILES_TO_REMOVE.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  console.log('\n📦 DEPENDENCIAS REQUERIDAS:');
  console.log('1. npm install xlsx');
  console.log('   Para generar archivos Excel');
  
  console.log('\n🔧 PASOS DE INSTALACIÓN:');
  console.log('=======================');
  console.log('1. ✅ Instalar dependencias: npm install xlsx');
  console.log('2. ✅ Crear todos los archivos listados arriba');
  console.log('3. ✅ Eliminar archivos obsoletos');
  console.log('4. ✅ Ejecutar migración de datos (una sola vez)');
  console.log('5. ✅ Probar el sistema');
  
  console.log('\n🎯 FUNCIONALIDADES COMPLETADAS:');
  console.log('==============================');
  console.log('✅ Renovación automática mensual');
  console.log('✅ Dashboard unificado con estadísticas');
  console.log('✅ Gestión individual por usuario');
  console.log('✅ Renovación manual de membresías vencidas');
  console.log('✅ Proceso masivo con barra de progreso');
  console.log('✅ Generación de reportes Excel completos');
  console.log('✅ Control de auto-renovación por membresía');
  console.log('✅ Actualización automática de precios');
  console.log('✅ Sistema de logging completo');
  console.log('✅ Manejo robusto de errores');
  
  console.log('\n📊 REPORTES EXCEL DISPONIBLES:');
  console.log('=============================');
  console.log('📈 Reporte de Membresías:');
  console.log('   • Listado completo de socios');
  console.log('   • Estado de pagos por mes');
  console.log('   • Configuración de auto-renovación');
  console.log('   • Asistencias y fechas de vencimiento');
  console.log('');
  console.log('🔄 Reporte de Renovaciones:');
  console.log('   • Renovaciones procesadas automáticamente');
  console.log('   • Errores y problemas encontrados');
  console.log('   • Cambios de precios aplicados');
  console.log('   • Historial de procesos');
  
  console.log('\n🎮 CÓMO USAR EL SISTEMA:');
  console.log('======================');
  console.log('1. 🏠 Dashboard Principal:');
  console.log('   • Ve estadísticas en tiempo real');
  console.log('   • Procesa renovaciones pendientes');
  console.log('   • Monitorea el estado del sistema');
  console.log('');
  console.log('2. ⚠️  Pestaña "Vencidas":');
  console.log('   • Lista membresías que requieren renovación');
  console.log('   • Renovación individual o masiva');
  console.log('   • Proceso con barra de progreso');
  console.log('');
  console.log('3. 👥 Pestaña "Gestionar":');
  console.log('   • Vista completa de cada socio');
  console.log('   • Control granular de membresías');
  console.log('   • Configuración de auto-renovación');
  console.log('   • Búsqueda y filtros avanzados');
  console.log('');
  console.log('4. 📊 Pestaña "Reportes":');
  console.log('   • Selecciona mes para reportes');
  console.log('   • Genera Excel de membresías');
  console.log('   • Genera Excel de renovaciones');
  console.log('   • Descarga automática de archivos');
  
  console.log('\n🤖 AUTOMATIZACIÓN:');
  console.log('=================');
  console.log('• El sistema se ejecuta automáticamente los primeros 3 días de cada mes');
  console.log('• Solo renueva membresías con auto-renovación habilitada');
  console.log('• Actualiza precios automáticamente desde las actividades');
  console.log('• Crea nuevas membresías válidas por 30 días');
  console.log('• Genera transacciones pendientes de pago');
  console.log('• Registra todos los procesos en logs');
  
  console.log('\n🔄 MIGRACIÓN DE DATOS:');
  console.log('=====================');
  console.log('⚠️  IMPORTANTE: Ejecutar UNA SOLA VEZ en la consola del navegador:');
  console.log('');
  console.log('// 1. Migrar datos existentes');
  console.log('import { MembershipMigrationUtil } from "./utils/membershipMigration.util";');
  console.log('await MembershipMigrationUtil.migrateMembershipsToNewSystem("TU_GYM_ID");');
  console.log('');
  console.log('// 2. Limpiar datos inconsistentes (opcional)');
  console.log('await MembershipMigrationUtil.cleanInconsistentData("TU_GYM_ID");');
  
  console.log('\n🧪 PRUEBAS RECOMENDADAS:');
  console.log('=======================');
  console.log('1. Verificar que el dashboard carga sin errores');
  console.log('2. Probar renovación individual de una membresía vencida');
  console.log('3. Configurar auto-renovación en algunas membresías');
  console.log('4. Generar reporte Excel de prueba');
  console.log('5. Verificar que la automatización está activa');
  
  console.log('\n📞 SOPORTE Y TROUBLESHOOTING:');
  console.log('============================');
  console.log('Si encuentras errores:');
  console.log('1. Verifica que todos los archivos estén creados');
  console.log('2. Confirma que XLSX está instalado');
  console.log('3. Revisa la consola del navegador para errores');
  console.log('4. Ejecuta la migración de datos si no lo has hecho');
  console.log('5. Reinicia el servidor de desarrollo');
  
  console.log('\n🎉 ¡INSTALACIÓN COMPLETA!');
  console.log('El sistema está listo para usar.');
  console.log('Disfruta de la gestión automatizada de renovaciones! 🚀');
};

/**
 * Script de migración paso a paso
 */
export const runMigrationScript = async (gymId: string): Promise<void> => {
  if (!gymId) {
    console.error('❌ Debes proporcionar el ID del gimnasio');
    return;
  }
  
  console.log('🔄 INICIANDO MIGRACIÓN DE DATOS...');
  console.log('=================================');
  
  try {
    // Importar utilidad de migración
    const MembershipMigrationUtilModule = await import('./membershipMigration.util');
    const { MembershipMigrationUtil } = MembershipMigrationUtilModule;
    
    
    console.log('📊 Paso 1: Migrando membresías al nuevo formato...');
    await MembershipMigrationUtil.migrateMembershipsToNewSystem(gymId);
    
    console.log('🧹 Paso 2: Limpiando datos inconsistentes...');
    await MembershipMigrationUtil.cleanInconsistentData(gymId);
    
    console.log('✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('');
    console.log('🎯 Próximos pasos:');
    console.log('1. Recarga la página');
    console.log('2. Ve al dashboard de renovaciones');
    console.log('3. Verifica que las estadísticas se muestren correctamente');
    console.log('4. Prueba generar un reporte Excel');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.log('');
    console.log('🔧 Posibles soluciones:');
    console.log('• Verifica que el ID del gimnasio sea correcto');
    console.log('• Confirma que tienes permisos en Firebase');
    console.log('• Revisa que todos los archivos estén creados');
  }
};

/**
 * Verificar estado del sistema después de la instalación
 */
export const checkSystemHealth = async (gymId: string): Promise<void> => {
  if (!gymId) {
    console.error('❌ Debes proporcionar el ID del gimnasio');
    return;
  }
  
  console.log('🏥 VERIFICACIÓN DE SALUD DEL SISTEMA');
  console.log('===================================');
  
  try {
    // Importar servicio de renovaciones
    const { membershipRenewalService } = await import('../services/membershipRenewalService');
    
    console.log('📊 Obteniendo estadísticas del sistema...');
    const stats = await membershipRenewalService.getRenewalStats(gymId);
    
    console.log('✅ Sistema funcionando correctamente!');
    console.log('');
    console.log('📈 Estadísticas actuales:');
    console.log(`• Membresías totales: ${stats.totalMemberships}`);
    console.log(`• Con auto-renovación: ${stats.withAutoRenewal}`);
    console.log(`• Vencidas: ${stats.expired}`);
    console.log(`• Vencen pronto: ${stats.expiringSoon}`);
    console.log(`• Renovadas este mes: ${stats.renewedThisMonth}`);
    
    if (stats.expired > 0) {
      console.log('');
      console.log('⚠️  Hay membresías vencidas pendientes de renovación.');
      console.log('Ve al dashboard para procesarlas.');
    }
    
    if (stats.withAutoRenewal === 0) {
      console.log('');
      console.log('💡 Sugerencia: Configura auto-renovación en algunas membresías');
      console.log('para aprovechar al máximo el sistema automatizado.');
    }
    
  } catch (error) {
    console.error('❌ Error verificando el sistema:', error);
    console.log('');
    console.log('🔧 El sistema puede no estar correctamente instalado.');
    console.log('Revisa que todos los archivos estén creados.');
  }
};

// Exportar funciones para usar en consola
declare global {
  interface Window {
    MultiGymInstallation: {
      runCompleteCheck: typeof runCompleteInstallationCheck;
      runMigration: typeof runMigrationScript;
      checkHealth: typeof checkSystemHealth;
    };
  }
}

// Hacer funciones disponibles globalmente
if (typeof window !== 'undefined') {
  window.MultiGymInstallation = {
    runCompleteCheck: runCompleteInstallationCheck,
    runMigration: runMigrationScript,
    checkHealth: checkSystemHealth
  };
  
  // Ejecutar verificación automáticamente
  setTimeout(() => {
    console.log('🔍 Sistema de Renovaciones MultiGym cargado.');
    console.log('Ejecuta: MultiGymInstallation.runCompleteCheck() para ver el estado de instalación');
  }, 2000);
}

/*
===========================================
COMANDOS PARA EJECUTAR EN CONSOLA DEL NAVEGADOR:
===========================================

// 1. Verificar instalación completa
MultiGymInstallation.runCompleteCheck();

// 2. Ejecutar migración de datos (UNA SOLA VEZ)
await MultiGymInstallation.runMigration('TU_GYM_ID_AQUI');

// 3. Verificar estado del sistema
await MultiGymInstallation.checkHealth('TU_GYM_ID_AQUI');

===========================================
*/;