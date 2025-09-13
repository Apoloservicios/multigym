// src/utils/membershipMigration.util.ts
// 🔄 UTILIDAD DE MIGRACIÓN - Actualizar datos existentes al nuevo sistema

import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/gym.types';

export class MembershipMigrationUtil {
  
  /**
   * 🆕 MIGRACIÓN PRINCIPAL: Actualizar membresías existentes
   * Esta función actualiza todas las membresías para que tengan:
   * - autoRenewal: true por defecto
   * - paymentType: 'monthly' (no más pagos únicos)
   * - paymentStatus: 'pending' si no está definido
   */
  static async migrateMembershipsToNewSystem(gymId: string): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> {
    console.log('🔄 INICIANDO MIGRACIÓN DE MEMBRESÍAS...');
    console.log('=====================================');
    
    const results = {
      success: true,
      updated: 0,
      errors: [] as string[]
    };
    
    try {
      // Obtener todas las membresías del gimnasio
      const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
      const querySnapshot = await getDocs(membershipsRef);
      
      console.log(`📊 Encontradas ${querySnapshot.docs.length} membresías para migrar`);
      
      // Procesar cada membresía
      for (const docSnapshot of querySnapshot.docs) {
        try {
          const membershipData = docSnapshot.data() as Partial<MembershipAssignment>;
          const membershipId = docSnapshot.id;
          
          console.log(`🔍 Procesando membresía: ${membershipData.memberName} - ${membershipData.activityName}`);
          
          // Preparar los datos de actualización
          const updateData: Partial<MembershipAssignment> = {
            updatedAt: Timestamp.now()
          };
          
          // 🎯 CONFIGURAR AUTO-RENOVACIÓN SI NO ESTÁ DEFINIDA
          if (membershipData.autoRenewal === undefined || membershipData.autoRenewal === null) {
            updateData.autoRenewal = true;
            console.log('  ✅ Auto-renovación configurada como true');
          }
          
          // 🎯 CONFIGURAR TIPO DE PAGO COMO MENSUAL
          if (!membershipData.paymentType || membershipData.paymentType !== 'monthly') {
            updateData.paymentType = 'monthly';
            console.log('  ✅ Tipo de pago configurado como monthly');
          }
          
          // 🎯 CONFIGURAR ESTADO DE PAGO SI NO ESTÁ DEFINIDO
          if (!membershipData.paymentStatus) {
            updateData.paymentStatus = 'pending';
            console.log('  ✅ Estado de pago configurado como pending');
          }
          
          // 🎯 ASEGURAR QUE TENGA STATUS
          if (!membershipData.status) {
            // Determinar status basado en fecha de vencimiento
            const today = new Date().toISOString().split('T')[0];
            updateData.status = membershipData.endDate && membershipData.endDate < today ? 'expired' : 'active';
            console.log(`  ✅ Status configurado como ${updateData.status}`);
          }
          
          // Solo actualizar si hay cambios
          if (Object.keys(updateData).length > 1) { // >1 porque siempre tiene updatedAt
            await updateDoc(doc(db, `gyms/${gymId}/membershipAssignments`, membershipId), updateData);
            results.updated++;
            console.log(`  ✅ Membresía ${membershipId} actualizada`);
          } else {
            console.log('  ℹ️ No requiere actualización');
          }
          
        } catch (error) {
          const errorMsg = `Error actualizando membresía ${docSnapshot.id}: ${error}`;
          console.error('  ❌', errorMsg);
          results.errors.push(errorMsg);
        }
      }
      
      console.log('\n📊 RESULTADO DE LA MIGRACIÓN:');
      console.log('============================');
      console.log(`✅ Membresías actualizadas: ${results.updated}`);
      console.log(`❌ Errores: ${results.errors.length}`);
      
      if (results.errors.length > 0) {
        console.log('\n❌ ERRORES ENCONTRADOS:');
        results.errors.forEach(error => console.log(`  - ${error}`));
        results.success = false;
      }
      
    } catch (error) {
      console.error('❌ Error general en la migración:', error);
      results.success = false;
      results.errors.push(`Error general: ${error}`);
    }
    
    return results;
  }
  
  /**
   * 🧹 Limpiar datos inconsistentes
   * Esta función identifica y corrige problemas comunes
   */
  static async cleanInconsistentData(gymId: string): Promise<{
    success: boolean;
    cleaned: number;
    issues: string[];
  }> {
    console.log('\n🧹 INICIANDO LIMPIEZA DE DATOS INCONSISTENTES...');
    console.log('==============================================');
    
    const results = {
      success: true,
      cleaned: 0,
      issues: [] as string[]
    };
    
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
      const querySnapshot = await getDocs(membershipsRef);
      
      for (const docSnapshot of querySnapshot.docs) {
        try {
          const membershipData = docSnapshot.data() as Partial<MembershipAssignment>;
          const membershipId = docSnapshot.id;
          let needsUpdate = false;
          const updateData: Partial<MembershipAssignment> = {};
          
          // 🔍 Verificar campos requeridos
          const requiredFields = ['memberName', 'activityName', 'cost', 'startDate', 'endDate'];
          for (const field of requiredFields) {
            if (!membershipData[field as keyof MembershipAssignment]) {
              results.issues.push(`Membresía ${membershipId}: Falta campo ${field}`);
            }
          }
          
          // 🔍 Verificar fechas válidas
          if (membershipData.startDate && membershipData.endDate) {
            const startDate = new Date(membershipData.startDate);
            const endDate = new Date(membershipData.endDate);
            
            if (startDate > endDate) {
              results.issues.push(`Membresía ${membershipId}: Fecha de inicio posterior a fecha de fin`);
            }
          }
          
          // 🔍 Verificar costo válido
          if (membershipData.cost && (membershipData.cost < 0 || isNaN(membershipData.cost))) {
            results.issues.push(`Membresía ${membershipId}: Costo inválido (${membershipData.cost})`);
          }
          
          // 🔧 Corregir paymentType inválido
          if (membershipData.paymentType && membershipData.paymentType !== 'monthly') {
            updateData.paymentType = 'monthly';
            needsUpdate = true;
            console.log(`  🔧 Corrigiendo paymentType de membresía ${membershipId}`);
          }
          
          // 🔧 Corregir autoRenewal undefined
          if (membershipData.autoRenewal === undefined || membershipData.autoRenewal === null) {
            updateData.autoRenewal = true;
            needsUpdate = true;
            console.log(`  🔧 Configurando autoRenewal de membresía ${membershipId}`);
          }
          
          // 🔧 Actualizar status basado en fecha de vencimiento
          if (membershipData.endDate) {
            const today = new Date().toISOString().split('T')[0];
            const currentStatus = membershipData.status;
            const shouldBeExpired = membershipData.endDate < today;
            
            if (shouldBeExpired && currentStatus === 'active') {
              updateData.status = 'expired';
              needsUpdate = true;
              console.log(`  🔧 Marcando como expired membresía ${membershipId}`);
            } else if (!shouldBeExpired && currentStatus === 'expired') {
              updateData.status = 'active';
              needsUpdate = true;
              console.log(`  🔧 Marcando como active membresía ${membershipId}`);
            }
          }
          
          // Aplicar actualizaciones si es necesario
          if (needsUpdate) {
            updateData.updatedAt = Timestamp.now();
            await updateDoc(doc(db, `gyms/${gymId}/membershipAssignments`, membershipId), updateData);
            results.cleaned++;
            console.log(`  ✅ Datos inconsistentes corregidos en membresía ${membershipId}`);
          }
          
        } catch (error) {
          const errorMsg = `Error limpiando membresía ${docSnapshot.id}: ${error}`;
          console.error('  ❌', errorMsg);
          results.issues.push(errorMsg);
        }
      }
      
      console.log('\n📊 RESULTADO DE LA LIMPIEZA:');
      console.log('============================');
      console.log(`🧹 Registros limpiados: ${results.cleaned}`);
      console.log(`⚠️ Problemas identificados: ${results.issues.length}`);
      
      if (results.issues.length > 0) {
        console.log('\n⚠️ PROBLEMAS ENCONTRADOS:');
        results.issues.forEach(issue => console.log(`  - ${issue}`));
      }
      
    } catch (error) {
      console.error('❌ Error general en la limpieza:', error);
      results.success = false;
      results.issues.push(`Error general: ${error}`);
    }
    
    return results;
  }
  
  /**
   * 📊 Generar reporte de estado antes de migración
   */
  static async generatePreMigrationReport(gymId: string): Promise<void> {
    console.log('📊 REPORTE PRE-MIGRACIÓN');
    console.log('=======================');
    
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
      const querySnapshot = await getDocs(membershipsRef);
      
      let totalMemberships = 0;
      let withAutoRenewal = 0;
      let withoutAutoRenewal = 0;
      let monthlyPayments = 0;
      let uniquePayments = 0;
      let unknownPayments = 0;
      let activeMemberships = 0;
      let expiredMemberships = 0;
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data() as Partial<MembershipAssignment>;
        totalMemberships++;
        
        // Analizar auto-renovación
        if (data.autoRenewal === true) {
          withAutoRenewal++;
        } else {
          withoutAutoRenewal++;
        }
        
        // Analizar tipo de pago
        if (data.paymentType === 'monthly') {
          monthlyPayments++;
        } else if (data.paymentType === 'unique') {
          uniquePayments++;
        } else {
          unknownPayments++;
        }
        
        // Analizar estado
        if (data.status === 'active') {
          activeMemberships++;
        } else if (data.status === 'expired') {
          expiredMemberships++;
        }
      });
      
      console.log(`📈 Total de membresías: ${totalMemberships}`);
      console.log(`✅ Con auto-renovación: ${withAutoRenewal}`);
      console.log(`❌ Sin auto-renovación: ${withoutAutoRenewal}`);
      console.log(`💰 Pagos mensuales: ${monthlyPayments}`);
      console.log(`💸 Pagos únicos: ${uniquePayments}`);
      console.log(`❓ Tipo de pago desconocido: ${unknownPayments}`);
      console.log(`🟢 Membresías activas: ${activeMemberships}`);
      console.log(`🔴 Membresías vencidas: ${expiredMemberships}`);
      
      // Recomendaciones
      console.log('\n💡 RECOMENDACIONES:');
      if (withoutAutoRenewal > 0) {
        console.log(`  - ${withoutAutoRenewal} membresías necesitan auto-renovación activada`);
      }
      if (uniquePayments > 0) {
        console.log(`  - ${uniquePayments} membresías con pagos únicos serán convertidas a mensuales`);
      }
      if (unknownPayments > 0) {
        console.log(`  - ${unknownPayments} membresías tienen tipo de pago indefinido`);
      }
      
    } catch (error) {
      console.error('❌ Error generando reporte:', error);
    }
  }
  
  /**
   * 🚀 Función principal para ejecutar migración completa
   */
  static async runFullMigration(gymId: string): Promise<void> {
    console.log('🚀 INICIANDO MIGRACIÓN COMPLETA DEL SISTEMA');
    console.log('==========================================');
    
    try {
      // 1. Generar reporte pre-migración
      console.log('\n📊 Paso 1: Análisis inicial...');
      await this.generatePreMigrationReport(gymId);
      
      // 2. Ejecutar migración principal
      console.log('\n🔄 Paso 2: Migrando membresías...');
      const migrationResult = await this.migrateMembershipsToNewSystem(gymId);
      
      // 3. Limpiar datos inconsistentes
      console.log('\n🧹 Paso 3: Limpiando datos inconsistentes...');
      const cleanupResult = await this.cleanInconsistentData(gymId);
      
      // 4. Reporte final
      console.log('\n🎉 MIGRACIÓN COMPLETADA!');
      console.log('========================');
      console.log(`✅ Membresías migradas: ${migrationResult.updated}`);
      console.log(`🧹 Registros limpiados: ${cleanupResult.cleaned}`);
      console.log(`❌ Errores totales: ${migrationResult.errors.length + cleanupResult.issues.length}`);
      
      if (migrationResult.success && cleanupResult.success) {
        console.log('\n🎯 ¡MIGRACIÓN EXITOSA!');
        console.log('El sistema está listo para usar con las nuevas funcionalidades.');
        console.log('');
        console.log('📝 PRÓXIMOS PASOS:');
        console.log('1. Recarga la página de la aplicación');
        console.log('2. Ve al dashboard de renovaciones');
        console.log('3. Verifica que las estadísticas se muestren correctamente');
        console.log('4. Prueba la pestaña "Vencidas"');
        console.log('5. Crea una nueva membresía para verificar que tenga auto-renovación por defecto');
      } else {
        console.log('\n⚠️ MIGRACIÓN CON ADVERTENCIAS');
        console.log('Revisa los errores listados arriba y ejecuta la migración nuevamente si es necesario.');
      }
      
    } catch (error) {
      console.error('❌ Error crítico en la migración completa:', error);
    }
  }
  
  /**
   * 🔍 Verificar estado del sistema después de migración
   */
  static async verifySystemHealth(gymId: string): Promise<{
    healthy: boolean;
    issues: string[];
    stats: {
      total: number;
      withAutoRenewal: number;
      monthlyPayments: number;
      activeStatus: number;
    };
  }> {
    console.log('🔍 VERIFICANDO SALUD DEL SISTEMA POST-MIGRACIÓN');
    console.log('==============================================');
    
    const result = {
      healthy: true,
      issues: [] as string[],
      stats: {
        total: 0,
        withAutoRenewal: 0,
        monthlyPayments: 0,
        activeStatus: 0
      }
    };
    
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
      const querySnapshot = await getDocs(membershipsRef);
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data() as Partial<MembershipAssignment>;
        result.stats.total++;
        
        // Verificar auto-renovación
        if (data.autoRenewal === true) {
          result.stats.withAutoRenewal++;
        } else {
          result.issues.push(`Membresía ${doc.id}: No tiene auto-renovación activada`);
          result.healthy = false;
        }
        
        // Verificar tipo de pago
        if (data.paymentType === 'monthly') {
          result.stats.monthlyPayments++;
        } else {
          result.issues.push(`Membresía ${doc.id}: Tipo de pago no es mensual (${data.paymentType})`);
          result.healthy = false;
        }
        
        // Verificar estado
        if (data.status === 'active' || data.status === 'expired') {
          result.stats.activeStatus++;
        } else {
          result.issues.push(`Membresía ${doc.id}: Estado inválido (${data.status})`);
          result.healthy = false;
        }
        
        // Verificar campos requeridos
        if (!data.memberName || !data.activityName) {
          result.issues.push(`Membresía ${doc.id}: Faltan datos básicos`);
          result.healthy = false;
        }
      });
      
      console.log('📊 ESTADÍSTICAS POST-MIGRACIÓN:');
      console.log(`• Total membresías: ${result.stats.total}`);
      console.log(`• Con auto-renovación: ${result.stats.withAutoRenewal}`);
      console.log(`• Con pagos mensuales: ${result.stats.monthlyPayments}`);
      console.log(`• Con estado válido: ${result.stats.activeStatus}`);
      
      if (result.healthy) {
        console.log('\n✅ SISTEMA SALUDABLE');
        console.log('Todas las membresías están correctamente configuradas.');
      } else {
        console.log('\n⚠️ PROBLEMAS DETECTADOS:');
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      }
      
    } catch (error) {
      console.error('❌ Error verificando salud del sistema:', error);
      result.healthy = false;
      result.issues.push(`Error de verificación: ${error}`);
    }
    
    return result;
  }
}

// ====================================================================
// FUNCIONES GLOBALES PARA EJECUTAR EN CONSOLA DEL NAVEGADOR
// ====================================================================

/**
 * 🎯 Función global para ejecutar migración completa
 * USAR EN CONSOLA: await runMigration('TU_GYM_ID_AQUI')
 */
declare global {
  interface Window {
    runMigration: (gymId: string) => Promise<void>;
    runPreMigrationReport: (gymId: string) => Promise<void>;
    verifySystem: (gymId: string) => Promise<void>;
  }
}

// Hacer funciones disponibles globalmente para la consola
if (typeof window !== 'undefined') {
  window.runMigration = async (gymId: string) => {
    if (!gymId) {
      console.error('❌ Debes proporcionar el ID del gimnasio');
      console.log('Ejemplo: await runMigration("tu-gym-id-aqui")');
      return;
    }
    
    await MembershipMigrationUtil.runFullMigration(gymId);
  };
  
  window.runPreMigrationReport = async (gymId: string) => {
    if (!gymId) {
      console.error('❌ Debes proporcionar el ID del gimnasio');
      return;
    }
    
    await MembershipMigrationUtil.generatePreMigrationReport(gymId);
  };
  
  window.verifySystem = async (gymId: string) => {
    if (!gymId) {
      console.error('❌ Debes proporcionar el ID del gimnasio');
      return;
    }
    
    await MembershipMigrationUtil.verifySystemHealth(gymId);
  };
  
  // Mensaje de ayuda
  setTimeout(() => {
    console.log('🔧 HERRAMIENTAS DE MIGRACIÓN DISPONIBLES:');
    console.log('========================================');
    console.log('1. Ver estado actual: await runPreMigrationReport("TU_GYM_ID")');
    console.log('2. Ejecutar migración completa: await runMigration("TU_GYM_ID")');
    console.log('3. Verificar sistema: await verifySystem("TU_GYM_ID")');
    console.log('');
    console.log('⚠️ IMPORTANTE: Ejecuta la migración UNA SOLA VEZ');
  }, 2000);
}

export default MembershipMigrationUtil;