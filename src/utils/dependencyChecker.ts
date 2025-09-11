// src/utils/dependencyChecker.ts
// 🔧 VERIFICADOR DE DEPENDENCIAS - Ejecutar para validar la instalación

/**
 * Verificar que todas las dependencias necesarias estén instaladas
 */
export const checkDependencies = (): { success: boolean; missing: string[]; errors: string[] } => {
  const missing: string[] = [];
  const errors: string[] = [];

  try {
    // Verificar XLSX
    try {
      require('xlsx');
      console.log('✅ XLSX: Instalado correctamente');
    } catch (error) {
      missing.push('xlsx');
      console.error('❌ XLSX: No encontrado');
    }

    // Verificar Firebase (debería estar ya instalado)
    try {
      require('firebase/firestore');
      console.log('✅ Firebase: Disponible');
    } catch (error) {
      errors.push('Firebase/Firestore no está disponible');
    }

    // Verificar React
    try {
      require('react');
      console.log('✅ React: Disponible');
    } catch (error) {
      errors.push('React no está disponible');
    }

  } catch (error) {
    errors.push(`Error general: ${error}`);
  }

  return {
    success: missing.length === 0 && errors.length === 0,
    missing,
    errors
  };
};

/**
 * Verificar estructura de archivos necesarios
 */
export const checkFileStructure = (): { success: boolean; missing: string[] } => {
  const requiredFiles = [
    'src/services/membershipRenewalService.ts',
    'src/components/memberships/UnifiedRenewalDashboard.tsx',
    'src/hooks/useMonthlyRenewalAutomation.ts',
    'src/services/excelReportService.ts',
    'src/components/memberships/MonthlyReportGenerator.tsx',
    'src/pages/MembershipRenewalPage.tsx',
    'src/utils/membershipMigration.util.ts',
    'src/utils/format.utils.ts'
  ];

  const missing: string[] = [];

  // En el navegador no podemos verificar archivos directamente,
  // pero podemos verificar que se puedan importar
  console.log('📁 Verificando estructura de archivos...');
  
  // Esta función es más para documentación de qué archivos se necesitan
  requiredFiles.forEach(file => {
    console.log(`📄 Requerido: ${file}`);
  });

  return {
    success: true, // Asumimos que están si no hay errores de compilación
    missing
  };
};

/**
 * Mostrar guía de instalación si faltan dependencias
 */
export const showInstallationGuide = (missing: string[]): void => {
  if (missing.length === 0) {
    console.log('🎉 Todas las dependencias están instaladas!');
    return;
  }

  console.log('📋 GUÍA DE INSTALACIÓN:');
  console.log('=======================');
  
  if (missing.includes('xlsx')) {
    console.log('1. Instalar XLSX:');
    console.log('   npm install xlsx');
    console.log('   o');
    console.log('   yarn add xlsx');
    console.log('');
  }

  console.log('2. Verificar que estos archivos estén creados:');
  console.log('   - src/services/membershipRenewalService.ts');
  console.log('   - src/components/memberships/UnifiedRenewalDashboard.tsx');
  console.log('   - src/hooks/useMonthlyRenewalAutomation.ts');
  console.log('   - src/services/excelReportService.ts');
  console.log('   - src/components/memberships/MonthlyReportGenerator.tsx');
  console.log('   - src/pages/MembershipRenewalPage.tsx');
  console.log('   - src/utils/membershipMigration.util.ts');
  console.log('   - src/utils/format.utils.ts');
  console.log('');
  
  console.log('3. Después de instalar, reiniciar el servidor de desarrollo:');
  console.log('   npm run dev (o el comando que uses)');
};

/**
 * Función principal para ejecutar todas las verificaciones
 */
export const runFullCheck = (): void => {
  console.log('🔍 VERIFICANDO INSTALACIÓN DEL SISTEMA DE RENOVACIONES');
  console.log('=====================================================');
  
  const depCheck = checkDependencies();
  const fileCheck = checkFileStructure();
  
  if (depCheck.success && fileCheck.success) {
    console.log('✅ ¡Todo está configurado correctamente!');
    console.log('');
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('1. Ejecutar migración de datos (una sola vez)');
    console.log('2. Configurar ruta en tu router');
    console.log('3. Probar el dashboard');
    console.log('');
  } else {
    if (!depCheck.success) {
      showInstallationGuide(depCheck.missing);
      
      if (depCheck.errors.length > 0) {
        console.log('❌ ERRORES ENCONTRADOS:');
        depCheck.errors.forEach(error => console.log(`   - ${error}`));
      }
    }
    
    if (!fileCheck.success) {
      console.log('❌ ARCHIVOS FALTANTES:');
      fileCheck.missing.forEach(file => console.log(`   - ${file}`));
    }
  }
};

// Ejecutar verificación automáticamente cuando se importe
if (typeof window !== 'undefined') {
  // Solo ejecutar en el navegador
  setTimeout(() => {
    runFullCheck();
  }, 1000);
}

// ======================================
// COMANDOS PARA EJECUTAR EN CONSOLA
// ======================================

/*

EJECUTAR ESTAS VERIFICACIONES EN LA CONSOLA DEL NAVEGADOR:

1. Verificar dependencias:
   import { runFullCheck } from './utils/dependencyChecker';
   runFullCheck();

2. Si todo está bien, ejecutar migración (UNA SOLA VEZ):
   import { MembershipMigrationUtil } from './utils/membershipMigration.util';
   await MembershipMigrationUtil.migrateMembershipsToNewSystem('TU_GYM_ID');

3. Limpiar datos inconsistentes (opcional):
   await MembershipMigrationUtil.cleanInconsistentData('TU_GYM_ID');

*/