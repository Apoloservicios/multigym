// src/services/membershipAutoRenewal.service.ts
// SERVICIO ACTUALIZADO: Renovación automática de membresías

import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  getDoc,
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/member.types';
import { safelyConvertToDate } from '../utils/date.utils';

interface AutoRenewalResult {
  success: boolean;
  processedCount: number;
  renewedMemberships: MembershipAssignment[];
  errors: string[];
}

/**
 * Procesar renovaciones automáticas de membresías vencidas
 */
export const processAutoRenewals = async (gymId: string): Promise<AutoRenewalResult> => {
  const result: AutoRenewalResult = {
    success: true,
    processedCount: 0,
    renewedMemberships: [],
    errors: []
  };

  try {
    console.log(`🔄 Procesando renovaciones automáticas para gimnasio: ${gymId}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Obtener todos los miembros del gimnasio
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    const maxBatchSize = 500;
    
    // Procesar cada miembro
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      
      try {
        // Obtener membresías activas del miembro
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
        const activeMembershipsQuery = query(
          membershipsRef,
          where('status', '==', 'active')
        );
        
        const membershipsSnapshot = await getDocs(activeMembershipsQuery);
        
        // Verificar cada membresía
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data() as MembershipAssignment;
          const membershipId = membershipDoc.id;
          
          // Convertir fecha de vencimiento
          const endDate = safelyConvertToDate(membershipData.endDate);
          
          if (!endDate) {
            result.errors.push(`Membresía ${membershipId} del socio ${memberId}: fecha de vencimiento inválida`);
            continue;
          }
          
          // Verificar si está vencida Y tiene renovación automática
          if (endDate < today && membershipData.autoRenewal === true) {
            console.log(`🔄 Membresía con renovación automática encontrada: ${membershipData.activityName} del socio ${memberId}`);
            
            // 1. Marcar la membresía actual como expired
            const currentMembershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
            batch.update(currentMembershipRef, {
              status: 'expired',
              expiredAt: serverTimestamp(),
              renewedAutomatically: true, // Marcador para indicar que fue renovada
              updatedAt: serverTimestamp()
            });
            
            // 2. Crear nueva membresía con fechas actualizadas
            const newStartDate = new Date(today);
            const newEndDate = calculateNewEndDate(newStartDate, membershipData);
            
            const newMembershipData = {
              ...membershipData,
              startDate: newStartDate.toISOString().split('T')[0],
              endDate: newEndDate.toISOString().split('T')[0],
              currentAttendances: 0, // Resetear asistencias
              paymentStatus: 'pending' as 'paid' | 'pending', // Generar nueva deuda
              status: 'active' as 'active' | 'expired' | 'cancelled',
              renewalDate: serverTimestamp(),
              previousMembershipId: membershipId, // Referencia a la membresía anterior
              createdAt: serverTimestamp()
            };
            
            // Agregar nueva membresía al batch
            const newMembershipRef = doc(collection(db, `gyms/${gymId}/members/${memberId}/memberships`));
            batch.set(newMembershipRef, newMembershipData);
            
            // 3. Actualizar deuda del socio
            if (membershipData.cost > 0) {
              const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
              // Necesitamos obtener la deuda actual para sumarla
              const memberSnap = await getDoc(memberRef);
              if (memberSnap.exists()) {
                const currentDebt = memberSnap.data().totalDebt || 0;
                batch.update(memberRef, {
                  totalDebt: currentDebt + membershipData.cost,
                  updatedAt: serverTimestamp()
                });
              }
            }
            
            batchCount += 3; // Contamos las 3 operaciones (update, set, update)
            
            // Agregar a resultado
            result.renewedMemberships.push({
              ...newMembershipData,
              id: newMembershipRef.id,
              memberId: memberId
            });
            
            console.log(`✅ Renovación automática programada para: ${membershipData.activityName} - ${memberData.firstName} ${memberData.lastName}`);
            
            // Ejecutar batch si alcanza el límite
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              console.log(`📦 Batch ejecutado: ${Math.floor(batchCount/3)} renovaciones procesadas`);
              
              // Crear nuevo batch
              const newBatch = writeBatch(db);
              Object.assign(batch, newBatch);
              batchCount = 0;
            }
          }
        }
      } catch (memberError) {
        console.error(`Error procesando renovaciones del miembro ${memberId}:`, memberError);
        result.errors.push(`Error procesando miembro ${memberId}: ${memberError}`);
      }
    }
    
    // Ejecutar batch final si tiene operaciones pendientes
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Batch final ejecutado: ${Math.floor(batchCount/3)} renovaciones procesadas`);
    }
    
    result.processedCount = result.renewedMemberships.length;
    
    console.log(`✅ Renovaciones automáticas completadas: ${result.processedCount} membresías renovadas`);
    
    return result;
    
  } catch (error) {
    console.error('Error en proceso de renovación automática:', error);
    result.success = false;
    result.errors.push(`Error general: ${error}`);
    return result;
  }
};

/**
 * Calcular nueva fecha de vencimiento basada en la duración original
 */
const calculateNewEndDate = (startDate: Date, membershipData: MembershipAssignment): Date => {
  const endDate = new Date(startDate);
  
  // Si tenemos información de duración, usarla
  // Si no, calcular basado en la duración original de la membresía
  const originalStartDate = safelyConvertToDate(membershipData.startDate);
  const originalEndDate = safelyConvertToDate(membershipData.endDate);
  
  let durationInDays = 30; // Default: 1 mes
  
  if (originalStartDate && originalEndDate) {
    const timeDiff = originalEndDate.getTime() - originalStartDate.getTime();
    durationInDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }
  
  endDate.setDate(startDate.getDate() + durationInDays);
  return endDate;
};

/**
 * 🆕 NUEVA FUNCIÓN: Renovar una membresía individual
 */
export const renewSingleMembership = async (
  gymId: string,
  memberId: string,
  membershipId: string
): Promise<boolean> => {
  try {
    console.log(`🔄 Iniciando renovación individual de membresía ${membershipId}`);
    
    // Obtener la membresía actual
    const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      throw new Error('La membresía no existe');
    }
    
    const membershipData = membershipSnap.data() as MembershipAssignment;
    
    if (membershipData.autoRenewal !== true) {
      throw new Error('Esta membresía no tiene renovación automática habilitada');
    }
    
    // Calcular nueva fecha de vencimiento
    const today = new Date();
    const originalStartDate = safelyConvertToDate(membershipData.startDate);
    const originalEndDate = safelyConvertToDate(membershipData.endDate);
    
    let durationInDays = 30; // Default
    if (originalStartDate && originalEndDate) {
      const timeDiff = originalEndDate.getTime() - originalStartDate.getTime();
      durationInDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
    const newStartDate = new Date(today);
    const newEndDate = new Date(today);
    newEndDate.setDate(newStartDate.getDate() + durationInDays);
    
    // 1. Marcar membresía actual como renovada
    await updateDoc(membershipRef, {
      status: 'expired',
      expiredAt: serverTimestamp(),
      renewedAutomatically: true,
      renewedManually: true, // Marcador para renovación manual
      updatedAt: serverTimestamp()
    });
    
    // 2. Crear nueva membresía
    const newMembershipData = {
      ...membershipData,
      startDate: newStartDate.toISOString().split('T')[0],
      endDate: newEndDate.toISOString().split('T')[0],
      currentAttendances: 0, // Resetear asistencias
      paymentStatus: 'pending' as const, // Generar nueva deuda
      status: 'active' as const,
      renewalDate: serverTimestamp(),
      previousMembershipId: membershipId,
      renewedManually: true, // Marcador especial
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, `gyms/${gymId}/members/${memberId}/memberships`), newMembershipData);
    
    // 3. Actualizar deuda del socio
    if (membershipData.cost > 0) {
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        const currentDebt = memberSnap.data().totalDebt || 0;
        await updateDoc(memberRef, {
          totalDebt: currentDebt + membershipData.cost,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    console.log(`✅ Membresía renovada exitosamente: ${membershipData.activityName}`);
    return true;
    
  } catch (error) {
    console.error('Error renovando membresía individual:', error);
    throw error;
  }
};

/**
 * Ejecutar proceso completo: expirar membresías y renovar automáticas
 */
export const processExpiredAndAutoRenew = async (gymId: string): Promise<{
  expiredResult: any;
  renewalResult: AutoRenewalResult;
}> => {
  try {
    console.log(`🚀 Iniciando proceso completo para gimnasio: ${gymId}`);
    
    // 1. Primero procesar renovaciones automáticas (antes de expirar)
    const renewalResult = await processAutoRenewals(gymId);
    
    // 2. Luego procesar membresías vencidas sin renovación automática
    // Importar la función existente
    const { processExpiredMemberships } = await import('./membershipExpiration.service');
    const expiredResult = await processExpiredMemberships(gymId);
    
    console.log(`📊 Resumen del proceso:
    - Membresías renovadas automáticamente: ${renewalResult.processedCount}
    - Membresías expiradas: ${expiredResult.processedCount}`);
    
    return {
      expiredResult,
      renewalResult
    };
    
  } catch (error) {
    console.error('Error en proceso completo:', error);
    throw error;
  }
};

/**
 * Verificar próximas renovaciones automáticas
 */
export const getUpcomingAutoRenewals = async (
  gymId: string, 
  daysAhead: number = 7
): Promise<MembershipAssignment[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysAhead);
    futureDate.setHours(23, 59, 59, 999);
    
    const upcomingRenewals: MembershipAssignment[] = [];
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      
      // Obtener membresías activas con renovación automática
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const autoRenewalQuery = query(
        membershipsRef,
        where('status', '==', 'active'),
        where('autoRenewal', '==', true)
      );
      
      const membershipsSnapshot = await getDocs(autoRenewalQuery);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data() as MembershipAssignment;
        const endDate = safelyConvertToDate(membershipData.endDate);
        
        if (endDate && endDate >= today && endDate <= futureDate) {
          upcomingRenewals.push({
            ...membershipData,
            id: membershipDoc.id,
            memberId: memberId,
            memberName: `${memberData.firstName} ${memberData.lastName}`
          });
        }
      }
    }
    
    // Ordenar por fecha de vencimiento
    upcomingRenewals.sort((a, b) => {
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
    
    return upcomingRenewals;
    
  } catch (error) {
    console.error('Error obteniendo próximas renovaciones:', error);
    throw error;
  }
};