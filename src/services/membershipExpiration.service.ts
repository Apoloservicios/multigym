// src/services/membershipExpiration.service.ts - ACTUALIZADO CON RENOVACIÓN AUTOMÁTICA

import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  addDoc,
  getDoc,
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
  renewedMemberships: MembershipAssignment[]; // NUEVO: membresías renovadas automáticamente
  errors: string[];
}

/**
 * Procesar membresías vencidas: renovar automáticas y desactivar el resto
 */
export const processExpiredMemberships = async (gymId: string): Promise<ExpirationResult> => {
  const result: ExpirationResult = {
    success: true,
    processedCount: 0,
    expiredMemberships: [],
    renewedMemberships: [], // NUEVO
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
    const maxBatchSize = 400; // Reducido para dar espacio a las renovaciones automáticas
    
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
          
          // Verificar si está vencida
          if (endDate < today) {
            console.log(`⏰ Membresía vencida encontrada: ${membershipData.activityName} del socio ${memberId}`);
            
            // NUEVA LÓGICA: Verificar si tiene renovación automática
            if (membershipData.autoRenewal === true) {
              console.log(`🔄 Procesando renovación automática para: ${membershipData.activityName}`);
              
              try {
                // 1. Marcar la membresía actual como renovada
                const currentMembershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
                batch.update(currentMembershipRef, {
                  status: 'expired',
                  expiredAt: serverTimestamp(),
                  renewedAutomatically: true,
                  updatedAt: serverTimestamp()
                });
                
                // 2. Calcular nueva fecha de vencimiento
                const newStartDate = new Date(today);
                const newEndDate = calculateNewEndDate(newStartDate, membershipData);
                
                // 3. Crear nueva membresía
                const newMembershipData = {
                  memberId: memberId,
                  activityId: membershipData.activityId,
                  activityName: membershipData.activityName,
                  startDate: newStartDate.toISOString().split('T')[0],
                  endDate: newEndDate.toISOString().split('T')[0],
                  cost: membershipData.cost,
                  paymentStatus: 'pending' as const, // Generar nueva deuda
                  status: 'active' as const,
                  maxAttendances: membershipData.maxAttendances,
                  currentAttendances: 0, // Resetear asistencias
                  description: membershipData.description,
                  autoRenewal: membershipData.autoRenewal, // Mantener renovación automática
                  paymentFrequency: membershipData.paymentFrequency || 'single',
                  renewalDate: serverTimestamp(),
                  previousMembershipId: membershipId,
                  createdAt: serverTimestamp()
                };
                
                // Agregar nueva membresía al batch
                const newMembershipRef = doc(collection(db, `gyms/${gymId}/members/${memberId}/memberships`));
                batch.set(newMembershipRef, newMembershipData);
                
                // 4. Actualizar deuda del socio si la membresía tiene costo
                if (membershipData.cost > 0) {
                  const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
                  const memberSnap = await getDoc(memberRef);
                  
                  if (memberSnap.exists()) {
                    const currentDebt = memberSnap.data().totalDebt || 0;
                    batch.update(memberRef, {
                      totalDebt: currentDebt + membershipData.cost,
                      updatedAt: serverTimestamp()
                    });
                    batchCount++; // Contar esta operación adicional
                  }
                }
                
                batchCount += 2; // update + set
                
                // Agregar a resultado de renovaciones
                result.renewedMemberships.push({
                  ...newMembershipData,
                  id: newMembershipRef.id,
                  memberId: memberId
                });
                
                console.log(`✅ Renovación automática programada: ${membershipData.activityName} - ${memberData.firstName} ${memberData.lastName}`);
                
              } catch (renewalError) {
                console.error(`Error en renovación automática para membresía ${membershipId}:`, renewalError);
                result.errors.push(`Error renovando membresía ${membershipId}: ${renewalError}`);
                
                // Si falla la renovación, proceder con expiración normal
                const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
                batch.update(membershipRef, {
                  status: 'expired',
                  expiredAt: serverTimestamp(),
                  renewalFailed: true,
                  updatedAt: serverTimestamp()
                });
                batchCount++;
              }
              
            } else {
              // LÓGICA ORIGINAL: Sin renovación automática, solo expirar
              const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
              
              batch.update(membershipRef, {
                status: 'expired',
                expiredAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              
              batchCount++;
              
              // Agregar a resultado de expiradas
              result.expiredMemberships.push({
                ...membershipData,
                id: membershipId,
                memberId: memberId
              });
            }
            
            // Ejecutar batch si alcanza el límite
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              console.log(`📦 Batch ejecutado: ${batchCount} operaciones procesadas`);
              
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
      console.log(`📦 Batch final ejecutado: ${batchCount} operaciones procesadas`);
    }
    
    result.processedCount = result.expiredMemberships.length + result.renewedMemberships.length;
    
    console.log(`✅ Proceso completado:
    - Membresías expiradas: ${result.expiredMemberships.length}
    - Membresías renovadas automáticamente: ${result.renewedMemberships.length}
    - Total procesadas: ${result.processedCount}`);
    
    return result;
    
  } catch (error) {
    console.error('Error en proceso de expiración de membresías:', error);
    result.success = false;
    result.errors.push(`Error general: ${error}`);
    return result;
  }
};


export const getExpiredAutoRenewals = async (gymId: string): Promise<MembershipAssignment[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiredRenewals: MembershipAssignment[] = [];
    
    console.log(`🔍 Buscando membresías vencidas con renovación automática...`);
    
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
        
        // Verificar si tiene renovación automática Y está vencida
        if (membershipData.autoRenewal === true) {
          const endDate = safelyConvertToDate(membershipData.endDate);
          
          if (endDate && endDate < today) {
            console.log(`🔴 Membresía vencida con auto-renovación: ${membershipData.activityName} - ${memberData.firstName} ${memberData.lastName}`);
            
            expiredRenewals.push({
              ...membershipData,
              id: membershipDoc.id,
              memberId: memberId,
              memberName: `${memberData.firstName} ${memberData.lastName}`
            });
          }
        }
      }
    }
    
    // Ordenar por fecha de vencimiento (más antiguas primero)
    expiredRenewals.sort((a, b) => {
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
    
    console.log(`🎯 Total de membresías vencidas con auto-renovación: ${expiredRenewals.length}`);
    
    return expiredRenewals;
    
  } catch (error) {
    console.error('Error obteniendo membresías vencidas con auto-renovación:', error);
    throw error;
  }
};


/**
 * Calcular nueva fecha de vencimiento basada en la duración original
 */
const calculateNewEndDate = (startDate: Date, membershipData: MembershipAssignment): Date => {
  const endDate = new Date(startDate);
  
  // Calcular duración original en días
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

// Resto de funciones existentes se mantienen igual...

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
      console.log(`✅ Verificación completada: 
      - ${result.expiredMemberships.length} membresías expiradas
      - ${result.renewedMemberships.length} membresías renovadas automáticamente
      - Total procesadas: ${result.processedCount}`);
      
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
 * Obtener estadísticas de membresías incluyendo renovaciones automáticas
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
    let autoRenewalCount = 0; // NUEVO: contar membresías con renovación automática
    
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
        
        if (membershipData.status === 'active') {
          activeCount++;
          
          // Contar renovaciones automáticas
          if (membershipData.autoRenewal === true) {
            autoRenewalCount++;
          }
          
          if (endDate) {
            if (endDate < today) {
              // Esta debería ser procesada por el sistema
            } else if (endDate <= nextWeek) {
              expiringThisWeek++;
            } else if (endDate <= nextMonth) {
              expiringThisMonth++;
            }
          }
        } else if (membershipData.status === 'expired') {
          expiredCount++;
        }
      }
    }
    
    return {
      activeCount,
      expiredCount,
      expiringThisWeek,
      expiringThisMonth,
      autoRenewalCount, // NUEVO
      totalCount: activeCount + expiredCount
    };
    
  } catch (error) {
    console.error('Error obteniendo estadísticas de membresías:', error);
    throw error;
  }
};

/**
 * Obtener próximas renovaciones automáticas
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
    
    console.log(`🔍 Buscando renovaciones automáticas entre ${today.toDateString()} y ${futureDate.toDateString()}`);
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      
      // 🔧 CORREGIDO: Obtener TODAS las membresías activas (sin filtro de autoRenewal en la query)
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const activeMembershipsQuery = query(
        membershipsRef,
        where('status', '==', 'active')
      );
      
      const membershipsSnapshot = await getDocs(activeMembershipsQuery);
      console.log(`👤 Miembro ${memberData.firstName} ${memberData.lastName}: ${membershipsSnapshot.size} membresías activas`);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data() as MembershipAssignment;
        
        console.log(`📋 Membresía ${membershipData.activityName}:`, {
          autoRenewal: membershipData.autoRenewal,
          endDate: membershipData.endDate,
          status: membershipData.status
        });
        
        // 🔧 CORREGIDO: Verificar autoRenewal después de obtener los datos
        if (membershipData.autoRenewal === true) {
          const endDate = safelyConvertToDate(membershipData.endDate);
          
          if (endDate && endDate >= today && endDate <= futureDate) {
            console.log(`✅ Renovación automática encontrada: ${membershipData.activityName} vence ${endDate.toDateString()}`);
            
            upcomingRenewals.push({
              ...membershipData,
              id: membershipDoc.id,
              memberId: memberId,
              memberName: `${memberData.firstName} ${memberData.lastName}`
            });
          }
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
    
    console.log(`🎯 Total de renovaciones automáticas encontradas: ${upcomingRenewals.length}`);
    
    return upcomingRenewals;
    
  } catch (error) {
    console.error('Error obteniendo próximas renovaciones automáticas:', error);
    throw error;
  }
};