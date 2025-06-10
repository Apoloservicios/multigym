// src/services/membershipExpiration.service.ts - DESACTIVACIÓN AUTOMÁTICA DE MEMBRESÍAS

import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/member.types';
import { safelyConvertToDate, getCurrentDateString } from '../utils/date.utils';

interface ExpirationResult {
  success: boolean;
  processedCount: number;
  expiredMemberships: MembershipAssignment[];
  errors: string[];
}

/**
 * Procesar membresías vencidas y desactivarlas automáticamente
 */
export const processExpiredMemberships = async (gymId: string): Promise<ExpirationResult> => {
  const result: ExpirationResult = {
    success: true,
    processedCount: 0,
    expiredMemberships: [],
    errors: []
  };

  try {
    console.log(`🔍 Procesando membresías vencidas para gimnasio: ${gymId}`);
    
    // Obtener fecha actual
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inicio del día
    
    // Obtener todos los miembros del gimnasio
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    const maxBatchSize = 500; // Límite de Firestore
    
    // Procesar cada miembro
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      
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
          
          // Verificar si está vencida
          if (endDate < today) {
            console.log(`⏰ Membresía vencida encontrada: ${membershipData.activityName} del socio ${memberId}`);
            
            // Agregar a batch para desactivación
            const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
            
            batch.update(membershipRef, {
              status: 'expired',
              expiredAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            
            batchCount++;
            
            // Agregar a resultado
            result.expiredMemberships.push({
              ...membershipData,
              id: membershipId,
              memberId: memberId
            });
            
            // Ejecutar batch si alcanza el límite
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              console.log(`📦 Batch ejecutado: ${batchCount} membresías procesadas`);
              
              // Crear nuevo batch
              const newBatch = writeBatch(db);
              Object.assign(batch, newBatch);
              batchCount = 0;
            }
          }
        }
      } catch (memberError) {
        console.error(`Error procesando miembro ${memberId}:`, memberError);
        result.errors.push(`Error procesando miembro ${memberId}: ${memberError}`);
      }
    }
    
    // Ejecutar batch final si tiene operaciones pendientes
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Batch final ejecutado: ${batchCount} membresías procesadas`);
    }
    
    result.processedCount = result.expiredMemberships.length;
    
    console.log(`✅ Proceso completado: ${result.processedCount} membresías desactivadas`);
    
    return result;
    
  } catch (error) {
    console.error('Error en proceso de expiración de membresías:', error);
    result.success = false;
    result.errors.push(`Error general: ${error}`);
    return result;
  }
};

/**
 * Obtener membresías que vencen próximamente (en los próximos días)
 */
export const getMembershipsExpiringSoon = async (
  gymId: string, 
  daysAhead: number = 7
): Promise<MembershipAssignment[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysAhead);
    futureDate.setHours(23, 59, 59, 999);
    
    const expiringSoon: MembershipAssignment[] = [];
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      
      // Obtener membresías activas del miembro
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const activeMembershipsQuery = query(
        membershipsRef,
        where('status', '==', 'active')
      );
      
      const membershipsSnapshot = await getDocs(activeMembershipsQuery);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data() as MembershipAssignment;
        const endDate = safelyConvertToDate(membershipData.endDate);
        
        if (endDate && endDate >= today && endDate <= futureDate) {
          expiringSoon.push({
            ...membershipData,
            id: membershipDoc.id,
            memberId: memberId,
            memberName: `${memberData.firstName} ${memberData.lastName}`
          });
        }
      }
    }
    
    // Ordenar por fecha de vencimiento
    expiringSoon.sort((a, b) => {
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
    
    return expiringSoon;
    
  } catch (error) {
    console.error('Error obteniendo membresías por vencer:', error);
    throw error;
  }
};

/**
 * Verificar membresías vencidas para un socio específico
 */
export const checkMemberExpiredMemberships = async (
  gymId: string, 
  memberId: string
): Promise<MembershipAssignment[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiredMemberships: MembershipAssignment[] = [];
    
    // Obtener membresías activas del miembro
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    const activeMembershipsQuery = query(
      membershipsRef,
      where('status', '==', 'active')
    );
    
    const membershipsSnapshot = await getDocs(activeMembershipsQuery);
    
    for (const membershipDoc of membershipsSnapshot.docs) {
      const membershipData = membershipDoc.data() as MembershipAssignment;
      const endDate = safelyConvertToDate(membershipData.endDate);
      
      if (endDate && endDate < today) {
        expiredMemberships.push({
          ...membershipData,
          id: membershipDoc.id,
          memberId: memberId
        });
      }
    }
    
    return expiredMemberships;
    
  } catch (error) {
    console.error('Error verificando membresías vencidas del socio:', error);
    throw error;
  }
};

/**
 * Forzar la desactivación de una membresía específica
 */
export const forceExpireMembership = async (
  gymId: string,
  memberId: string,
  membershipId: string,
  reason?: string
): Promise<boolean> => {
  try {
    const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
    
    await updateDoc(membershipRef, {
      status: 'expired',
      expiredAt: serverTimestamp(),
      expiredReason: reason || 'Desactivación manual',
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Membresía ${membershipId} desactivada manualmente`);
    return true;
    
  } catch (error) {
    console.error('Error desactivando membresía:', error);
    return false;
  }
};

/**
 * Programar verificación automática (para usar con cron jobs o schedulers)
 */
export const scheduleExpirationCheck = async (gymId: string): Promise<void> => {
  try {
    console.log(`⏰ Iniciando verificación programada para gimnasio: ${gymId}`);
    
    const result = await processExpiredMemberships(gymId);
    
    if (result.success) {
      console.log(`✅ Verificación completada: ${result.processedCount} membresías procesadas`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ Errores encontrados:`, result.errors);
      }
    } else {
      console.error(`❌ Verificación falló:`, result.errors);
    }
    
  } catch (error) {
    console.error('Error en verificación programada:', error);
  }
};

/**
 * Obtener estadísticas de membresías
 */
export const getMembershipExpirationStats = async (gymId: string) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);
    
    let activeCount = 0;
    let expiredCount = 0;
    let expiringThisWeek = 0;
    let expiringThisMonth = 0;
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data() as MembershipAssignment;
        const endDate = safelyConvertToDate(membershipData.endDate);
        
        if (!endDate) continue;
        
        if (membershipData.status === 'active') {
          if (endDate < today) {
            expiredCount++;
          } else {
            activeCount++;
            
            if (endDate <= nextWeek) {
              expiringThisWeek++;
            } else if (endDate <= nextMonth) {
              expiringThisMonth++;
            }
          }
        }
      }
    }
    
    return {
      activeCount,
      expiredCount,
      expiringThisWeek,
      expiringThisMonth,
      totalMemberships: activeCount + expiredCount
    };
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    throw error;
  }
};

export default {
  processExpiredMemberships,
  getMembershipsExpiringSoon,
  checkMemberExpiredMemberships,
  forceExpireMembership,
  scheduleExpirationCheck,
  getMembershipExpirationStats
};