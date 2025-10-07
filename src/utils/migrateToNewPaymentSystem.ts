// src/utils/migrateToNewPaymentSystem.ts
// 🔄 SCRIPT DE MIGRACIÓN - Convierte datos antiguos al nuevo sistema
// ⚠️ EJECUTAR UNA SOLA VEZ

import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipStatus } from '../types/monthlyPayments.types';

interface MigrationResult {
  success: boolean;
  membershipsProcessed: number;
  membershipsCreated: number;
  errors: string[];
  details: {
    members: number;
    oldMemberships: number;
    skipped: number;
  };
}

/**
 * 🔄 MIGRACIÓN PRINCIPAL
 * 
 * Qué hace:
 * 1. Lee las membresías antiguas (de donde las tengas ahora)
 * 2. Las convierte al nuevo formato
 * 3. Las guarda en gyms/{gymId}/members/{memberId}/memberships
 * 4. NO borra las antiguas (por seguridad)
 * 
 * Estructura antigua esperada:
 * - gyms/{gymId}/membershipAssignments/{assignmentId}
 * 
 * Estructura nueva que crea:
 * - gyms/{gymId}/members/{memberId}/memberships/{membershipId}
 */
export const migrateToNewPaymentSystem = async (
  gymId: string
): Promise<MigrationResult> => {
  const result: MigrationResult = {
    success: false,
    membershipsProcessed: 0,
    membershipsCreated: 0,
    errors: [],
    details: {
      members: 0,
      oldMemberships: 0,
      skipped: 0
    }
  };

  console.log('🔄 ========================================');
  console.log('🔄 INICIANDO MIGRACIÓN AL NUEVO SISTEMA');
  console.log('🔄 ========================================');
  console.log(`🏢 Gimnasio: ${gymId}`);
  console.log('');

  try {
    // 1️⃣ PASO 1: Obtener todos los socios
    console.log('📋 PASO 1: Cargando socios...');
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnap = await getDocs(membersRef);

    result.details.members = membersSnap.size;
    console.log(`✅ Socios encontrados: ${membersSnap.size}`);
    console.log('');

    // 2️⃣ PASO 2: Buscar membresías antiguas
    console.log('📋 PASO 2: Buscando membresías antiguas...');
    const oldMembershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
    const oldMembershipsSnap = await getDocs(oldMembershipsRef);

    result.details.oldMemberships = oldMembershipsSnap.size;
    console.log(`✅ Membresías antiguas encontradas: ${oldMembershipsSnap.size}`);
    console.log('');

    // 3️⃣ PASO 3: Procesar cada membresía antigua
    console.log('🔄 PASO 3: Procesando membresías...');
    console.log('');

    for (const oldMemDoc of oldMembershipsSnap.docs) {
      const oldMem = oldMemDoc.data();
      result.membershipsProcessed++;

      try {
        // Validar datos necesarios
        if (!oldMem.memberId || !oldMem.activityId || !oldMem.activityName) {
          console.log(`⚠️ Saltando membresía sin datos completos: ${oldMemDoc.id}`);
          result.details.skipped++;
          continue;
        }

        // Buscar info del socio
        const memberDoc = await getDoc(doc(db, `gyms/${gymId}/members`, oldMem.memberId));
        if (!memberDoc.exists()) {
          console.log(`⚠️ Socio no encontrado: ${oldMem.memberId}`);
          result.details.skipped++;
          continue;
        }

        const memberData = memberDoc.data();
        const memberName = `${memberData.firstName} ${memberData.lastName}`;

        // Determinar estado
        let newStatus: 'active' | 'suspended' = 'active';
        if (oldMem.status === 'cancelled' || oldMem.status === 'expired') {
          newStatus = 'suspended';
        }

        // Determinar fecha de inicio
        let startDate = oldMem.startDate;
        if (!startDate) {
          // Si no tiene fecha, usar fecha de creación o hoy
          if (oldMem.createdAt) {
            const date = oldMem.createdAt.toDate();
            startDate = date.toISOString().split('T')[0];
          } else {
            startDate = new Date().toISOString().split('T')[0];
          }
        }

        // 4️⃣ Crear nueva membresía
        const newMembership: MembershipStatus = {
          memberId: oldMem.memberId,
          memberName,
          activityId: oldMem.activityId,
          activityName: oldMem.activityName,
          startDate,
          status: newStatus,
          autoGeneratePayments: newStatus === 'active', // Solo si está activa
          createdAt: oldMem.createdAt || Timestamp.now()
        };

        // 5️⃣ Verificar si ya existe (evitar duplicados)
        const newMembershipsRef = collection(
          db,
          `gyms/${gymId}/members/${oldMem.memberId}/memberships`
        );

        // Buscar si ya existe esta combinación actividad-socio
        const existingQuery = query(
          newMembershipsRef,
          where('activityId', '==', oldMem.activityId),
          where('status', '==', 'active')
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
          console.log(`⏭️ Ya existe: ${memberName} - ${oldMem.activityName}`);
          result.details.skipped++;
          continue;
        }

        // 6️⃣ Guardar en nueva ubicación
        const newMembershipRef = doc(newMembershipsRef);
        await setDoc(newMembershipRef, newMembership);

        result.membershipsCreated++;
        console.log(
          `✅ [${result.membershipsCreated}] Migrada: ${memberName} - ${oldMem.activityName} (${newStatus})`
        );

      } catch (error: any) {
        const errorMsg = `Error en membresía ${oldMemDoc.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log('');
    console.log('🎉 ========================================');
    console.log('🎉 MIGRACIÓN COMPLETADA');
    console.log('🎉 ========================================');
    console.log(`📊 Socios: ${result.details.members}`);
    console.log(`📊 Membresías antiguas: ${result.details.oldMemberships}`);
    console.log(`📊 Procesadas: ${result.membershipsProcessed}`);
    console.log(`✅ Creadas: ${result.membershipsCreated}`);
    console.log(`⏭️ Saltadas: ${result.details.skipped}`);
    console.log(`❌ Errores: ${result.errors.length}`);
    console.log('');

    if (result.errors.length > 0) {
      console.log('❌ Errores encontrados:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      console.log('');
    }

    result.success = result.errors.length === 0;

    return result;

  } catch (error: any) {
    console.error('❌ ERROR CRÍTICO EN MIGRACIÓN:', error);
    result.errors.push(`Error crítico: ${error.message}`);
    return result;
  }
};

/**
 * 🔍 FUNCIÓN DE VERIFICACIÓN
 * Verifica el estado antes/después de la migración
 */
export const verifyMigration = async (
  gymId: string
): Promise<{
  oldSystem: number;
  newSystem: number;
  memberBreakdown: { [memberId: string]: number };
}> => {
  try {
    console.log('🔍 Verificando estado del sistema...');
    console.log('');

    // Contar en sistema antiguo
    const oldRef = collection(db, `gyms/${gymId}/membershipAssignments`);
    const oldSnap = await getDocs(oldRef);
    const oldCount = oldSnap.size;

    console.log(`📊 Sistema antiguo: ${oldCount} membresías`);

    // Contar en sistema nuevo
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnap = await getDocs(membersRef);

    let newCount = 0;
    const memberBreakdown: { [memberId: string]: number } = {};

    for (const memberDoc of membersSnap.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      const memberName = `${memberData.firstName} ${memberData.lastName}`;

      const newMembershipsRef = collection(
        db,
        `gyms/${gymId}/members/${memberId}/memberships`
      );
      const newMembershipsSnap = await getDocs(newMembershipsRef);

      const count = newMembershipsSnap.size;
      if (count > 0) {
        newCount += count;
        memberBreakdown[memberId] = count;
        console.log(`  👤 ${memberName}: ${count} membresías`);
      }
    }

    console.log('');
    console.log(`📊 Sistema nuevo: ${newCount} membresías`);
    console.log('');

    return {
      oldSystem: oldCount,
      newSystem: newCount,
      memberBreakdown
    };

  } catch (error: any) {
    console.error('❌ Error verificando migración:', error);
    throw error;
  }
};

/**
 * 🧪 FUNCIÓN DE PRUEBA
 * Ejecuta una migración de prueba sin guardar nada
 */
export const dryRunMigration = async (
  gymId: string
): Promise<void> => {
  console.log('🧪 ========================================');
  console.log('🧪 SIMULACIÓN DE MIGRACIÓN (DRY RUN)');
  console.log('🧪 ========================================');
  console.log('⚠️ NO se guardará nada en la base de datos');
  console.log('');

  try {
    // Obtener datos antiguos
    const oldMembershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
    const oldMembershipsSnap = await getDocs(oldMembershipsRef);

    console.log(`📊 Membresías a procesar: ${oldMembershipsSnap.size}`);
    console.log('');

    let wouldCreate = 0;
    let wouldSkip = 0;

    for (const oldMemDoc of oldMembershipsSnap.docs) {
      const oldMem = oldMemDoc.data();

      // Validar
      if (!oldMem.memberId || !oldMem.activityId) {
        console.log(`⏭️ Saltaría: Sin datos completos`);
        wouldSkip++;
        continue;
      }

      // Verificar socio
      const memberDoc = await getDoc(doc(db, `gyms/${gymId}/members`, oldMem.memberId));
      if (!memberDoc.exists()) {
        console.log(`⏭️ Saltaría: Socio no existe (${oldMem.memberId})`);
        wouldSkip++;
        continue;
      }

      const memberData = memberDoc.data();
      const memberName = `${memberData.firstName} ${memberData.lastName}`;

      // Simular creación
      wouldCreate++;
      console.log(`✅ Crearía: ${memberName} - ${oldMem.activityName}`);
    }

    console.log('');
    console.log('📊 RESUMEN DE SIMULACIÓN:');
    console.log(`✅ Se crearían: ${wouldCreate} membresías`);
    console.log(`⏭️ Se saltarían: ${wouldSkip} membresías`);
    console.log('');
    console.log('💡 Para ejecutar la migración real, usa: migrateToNewPaymentSystem()');

  } catch (error: any) {
    console.error('❌ Error en simulación:', error);
  }
};