// src/services/membershipExpiration.service.ts
// 🔧 VERSIÓN FINAL CORREGIDA: Compatible con tipos existentes

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc,
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/member.types';

// ==================== INTERFACES ====================

export interface MembershipExpirationStats {
  activeCount: number;
  expiredCount: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  autoRenewalCount: number;
  totalCount: number;
}

// ✅ USAR DIRECTAMENTE MembershipAssignment en lugar de crear nuevo tipo
export type MembershipItem = MembershipAssignment & {
  memberName: string;
  currentCost: number;
};

export interface ProcessResult {
  success: boolean;
  renewedMemberships: MembershipItem[];
  expiredMemberships: MembershipItem[];
  errors: string[];
}

// ==================== FUNCIONES PRINCIPALES ====================

/**
 * 📊 Obtener estadísticas REALES de membresías
 */
export const getMembershipExpirationStats = async (gymId: string): Promise<MembershipExpirationStats> => {
  try {
    console.log('📊 Calculando estadísticas reales de membresías...');
    
    const stats: MembershipExpirationStats = {
      activeCount: 0,
      expiredCount: 0,
      expiringThisWeek: 0,
      expiringThisMonth: 0,
      autoRenewalCount: 0,
      totalCount: 0
    };

    // Obtener todos los miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);

    const today = new Date();
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Procesar cada miembro
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      
      try {
        // Obtener membresías del miembro
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data() as MembershipAssignment;
          stats.totalCount++;
          
          if (membership.status === 'active') {
            stats.activeCount++;
            
            // Verificar auto-renovación
            if (membership.autoRenewal) {
              stats.autoRenewalCount++;
            }
            
            // Verificar fechas de vencimiento
            const endDate = new Date(membership.endDate);
            
            if (endDate <= today) {
              stats.expiredCount++;
            } else if (endDate <= oneWeekFromNow) {
              stats.expiringThisWeek++;
            } else if (endDate <= oneMonthFromNow) {
              stats.expiringThisMonth++;
            }
          }
        }
      } catch (error) {
        console.warn(`Error procesando membresías para miembro ${memberId}:`, error);
      }
    }

    console.log('✅ Estadísticas calculadas:', stats);
    return stats;
    
  } catch (error) {
    console.error('❌ Error calculando estadísticas:', error);
    throw new Error('Error al calcular estadísticas de membresías');
  }
};

/**
 * 🔍 Obtener renovaciones automáticas próximas REALES
 */
export const getUpcomingAutoRenewals = async (gymId: string, daysAhead: number = 7): Promise<MembershipItem[]> => {
  try {
    console.log(`🔍 Buscando renovaciones próximas (próximos ${daysAhead} días)...`);
    
    const upcomingRenewals: MembershipItem[] = [];
    const today = new Date();
    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Obtener todos los miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberId = memberDoc.id;
      const memberName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
      
      try {
        // Obtener membresías con auto-renovación habilitada
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
        const membershipsQuery = query(
          membershipsRef,
          where('status', '==', 'active'),
          where('autoRenewal', '==', true)
        );
        const membershipsSnapshot = await getDocs(membershipsQuery);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data() as MembershipAssignment;
          const endDate = new Date(membership.endDate);
          
          // Verificar si vence en el rango especificado (futuro, no vencida)
          if (endDate > today && endDate <= futureDate) {
            upcomingRenewals.push({
              ...membership,
              id: membershipDoc.id,
              memberId,
              memberName,
              currentCost: membership.cost || 0
            });
          }
        }
      } catch (error) {
        console.warn(`Error procesando membresías para miembro ${memberId}:`, error);
      }
    }

    // Ordenar por fecha de vencimiento
    upcomingRenewals.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    console.log(`✅ Encontradas ${upcomingRenewals.length} renovaciones próximas`);
    return upcomingRenewals;
    
  } catch (error) {
    console.error('❌ Error obteniendo renovaciones próximas:', error);
    throw new Error('Error al obtener renovaciones próximas');
  }
};

/**
 * 🚨 Obtener renovaciones automáticas VENCIDAS REALES
 */
export const getExpiredAutoRenewals = async (gymId: string): Promise<MembershipItem[]> => {
  try {
    console.log('🚨 Buscando renovaciones vencidas...');
    
    const expiredRenewals: MembershipItem[] = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Final del día actual

    // Obtener todos los miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberId = memberDoc.id;
      const memberName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
      
      try {
        // Obtener membresías activas con auto-renovación
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
        const membershipsQuery = query(
          membershipsRef,
          where('status', '==', 'active'),
          where('autoRenewal', '==', true)
        );
        const membershipsSnapshot = await getDocs(membershipsQuery);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data() as MembershipAssignment;
          const endDate = new Date(membership.endDate);
          
          // Verificar si está vencida
          if (endDate < today) {
            expiredRenewals.push({
              ...membership,
              id: membershipDoc.id,
              memberId,
              memberName,
              currentCost: membership.cost || 0
            });
          }
        }
      } catch (error) {
        console.warn(`Error procesando membresías para miembro ${memberId}:`, error);
      }
    }

    // Ordenar por fecha de vencimiento (más vencidas primero)
    expiredRenewals.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    console.log(`✅ Encontradas ${expiredRenewals.length} renovaciones vencidas`);
    return expiredRenewals;
    
  } catch (error) {
    console.error('❌ Error obteniendo renovaciones vencidas:', error);
    throw new Error('Error al obtener renovaciones vencidas');
  }
};

/**
 * 🔄 Procesar membresías vencidas REAL
 */
export const processExpiredMemberships = async (gymId: string): Promise<ProcessResult> => {
  try {
    console.log('🔄 Iniciando proceso de renovaciones automáticas...');
    
    const result: ProcessResult = {
      success: true,
      renewedMemberships: [],
      expiredMemberships: [],
      errors: []
    };

    // Obtener membresías vencidas
    const expiredMemberships = await getExpiredAutoRenewals(gymId);
    
    if (expiredMemberships.length === 0) {
      console.log('✅ No hay membresías vencidas para procesar');
      return result;
    }

    console.log(`🔄 Procesando ${expiredMemberships.length} membresías vencidas...`);

    // Procesar cada membresía vencida
    for (const membership of expiredMemberships) {
      try {
        // Obtener precio actual de la actividad
        const activityRef = collection(db, `gyms/${gymId}/activities`);
        const activityQuery = query(activityRef, where('name', '==', membership.activityName), limit(1));
        const activitySnapshot = await getDocs(activityQuery);
        
        let currentPrice = membership.cost;
        if (!activitySnapshot.empty) {
          const activityData = activitySnapshot.docs[0].data();
          currentPrice = activityData.price || membership.cost;
        }

        // Calcular nueva fecha de fin (1 mes desde hoy)
        const today = new Date();
        const newEndDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Crear nueva membresía renovada
        const newMembershipData: Partial<MembershipAssignment> = {
          memberId: membership.memberId,
          activityId: membership.activityId,
          activityName: membership.activityName,
          startDate: today.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0],
          cost: currentPrice,
          paymentStatus: 'pending',
          status: 'active',
          maxAttendances: membership.maxAttendances,
          currentAttendances: 0,
          description: membership.description,
          autoRenewal: membership.autoRenewal,
          renewedAutomatically: true,
          renewalDate: Timestamp.now(),
          previousMembershipId: membership.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        // Agregar nueva membresía
        const newMembershipRef = await addDoc(
          collection(db, `gyms/${gymId}/members/${membership.memberId}/memberships`),
          newMembershipData
        );

        // Marcar la membresía anterior como cancelada
        await updateDoc(
          doc(db, `gyms/${gymId}/members/${membership.memberId}/memberships`, membership.id!),
          {
            status: 'cancelled',
            renewedTo: newMembershipRef.id,
            updatedAt: Timestamp.now()
          }
        );

        // Agregar al resultado
        result.renewedMemberships.push({
          ...membership,
          id: newMembershipRef.id,
          cost: currentPrice,
          currentCost: currentPrice,
          endDate: newEndDate.toISOString().split('T')[0],
          startDate: today.toISOString().split('T')[0],
          paymentStatus: 'pending',
          currentAttendances: 0
        });

        console.log(`✅ Renovada: ${membership.memberName} - ${membership.activityName}`);

      } catch (error) {
        console.error(`❌ Error renovando ${membership.memberName} - ${membership.activityName}:`, error);
        result.errors.push(`Error renovando ${membership.memberName}: ${error}`);
        result.expiredMemberships.push(membership);
      }
    }

    // Guardar historial del proceso
    try {
      await addDoc(collection(db, `gyms/${gymId}/renewalHistory`), {
        processDate: Timestamp.now(),
        renewedCount: result.renewedMemberships.length,
        errorCount: result.errors.length,
        processedMemberships: result.renewedMemberships.map(m => ({
          memberName: m.memberName,
          activityName: m.activityName,
          newCost: m.cost,
          newEndDate: m.endDate
        })),
        errors: result.errors
      });
    } catch (error) {
      console.warn('⚠️ Error guardando historial:', error);
    }

    result.success = result.errors.length === 0;
    
    console.log(`✅ Proceso completado: ${result.renewedMemberships.length} renovadas, ${result.errors.length} errores`);
    return result;
    
  } catch (error) {
    console.error('❌ Error en proceso de renovaciones:', error);
    return {
      success: false,
      renewedMemberships: [],
      expiredMemberships: [],
      errors: [`Error general: ${error}`]
    };
  }
};

/**
 * 📋 Obtener historial de renovaciones REAL
 */
export const getRenewalHistory = async (gymId: string, limitCount: number = 10): Promise<any[]> => {
  try {
    console.log('📋 Cargando historial de renovaciones...');
    
    const historyRef = collection(db, `gyms/${gymId}/renewalHistory`);
    const historyQuery = query(
      historyRef,
      orderBy('processDate', 'desc'),
      limit(limitCount)
    );
    
    const historySnapshot = await getDocs(historyQuery);
    const history = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      processDate: doc.data().processDate?.toDate?.() || new Date()
    }));

    console.log(`✅ Cargadas ${history.length} entradas de historial`);
    return history;
    
  } catch (error) {
    console.error('❌ Error cargando historial:', error);
    return [];
  }
};

/**
 * 💰 Calcular métricas financieras REALES de membresías
 */
export const getMembershipFinancialMetrics = async (gymId: string): Promise<{
  totalToCollect: number;
  totalCollected: number;
  pendingPayments: number;
  collectionPercentage: number;
}> => {
  try {
    console.log('💰 Calculando métricas financieras...');
    
    let totalToCollect = 0;
    let totalCollected = 0;
    let pendingPayments = 0;

    // Obtener todos los miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      
      try {
        // Obtener membresías activas del miembro
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
        const membershipsQuery = query(
          membershipsRef,
          where('status', '==', 'active')
        );
        const membershipsSnapshot = await getDocs(membershipsQuery);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data() as MembershipAssignment;
          
          // Solo contar membresías del mes actual
          const membershipMonth = membership.startDate?.slice(0, 7);
          if (membershipMonth === currentMonth) {
            totalToCollect += membership.cost || 0;
            
            if (membership.paymentStatus === 'paid') {
              totalCollected += membership.cost || 0;
            } else {
              pendingPayments++;
            }
          }
        }
      } catch (error) {
        console.warn(`Error procesando membresías financieras para ${memberId}:`, error);
      }
    }

    const collectionPercentage = totalToCollect > 0 
      ? (totalCollected / totalToCollect) * 100 
      : 100;

    const metrics = {
      totalToCollect,
      totalCollected,
      pendingPayments,
      collectionPercentage
    };

    console.log('✅ Métricas financieras calculadas:', metrics);
    return metrics;
    
  } catch (error) {
    console.error('❌ Error calculando métricas financieras:', error);
    return {
      totalToCollect: 0,
      totalCollected: 0,
      pendingPayments: 0,
      collectionPercentage: 0
    };
  }
};

/**
 * 🔧 Función auxiliar: Verificar si una membresía necesita renovación
 */
export const needsRenewal = (membership: MembershipAssignment): boolean => {
  if (!membership.autoRenewal || membership.status !== 'active') {
    return false;
  }
  
  const endDate = new Date(membership.endDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  return endDate < today;
};

/**
 * 📅 Función auxiliar: Calcular días hasta vencimiento
 */
export const getDaysUntilExpiration = (endDate: string): number => {
  const expiration = new Date(endDate);
  const today = new Date();
  const diffTime = expiration.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 🎨 Función auxiliar: Obtener estado de renovación para UI
 */
export const getRenewalStatus = (endDate: string): {
  status: 'vencida' | 'hoy' | 'pronto' | 'programada';
  days: number;
  color: string;
} => {
  const days = getDaysUntilExpiration(endDate);
  
  if (days < 0) {
    return {
      status: 'vencida',
      days,
      color: 'bg-red-100 text-red-800'
    };
  } else if (days === 0) {
    return {
      status: 'hoy',
      days,
      color: 'bg-yellow-100 text-yellow-800'
    };
  } else if (days <= 7) {
    return {
      status: 'pronto',
      days,
      color: 'bg-orange-100 text-orange-800'
    };
  } else {
    return {
      status: 'programada',
      days,
      color: 'bg-green-100 text-green-800'
    };
  }
};