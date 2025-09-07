// src/services/autoRenewal.service.ts
// 🚀 SERVICIO COMPLETO DE RENOVACIÓN AUTOMÁTICA - VERSIÓN SIN ERRORES

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  addDoc, 
  Timestamp,
  runTransaction,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getActivity } from './activity.service';
import { formatCurrency } from '../utils/formatting.utils';

interface RenewalResult {
  success: boolean;
  renewedMemberships: number;
  totalAmount: number;
  priceUpdates: number;
  errors: string[];
  details: RenewalDetail[];
}

interface RenewalDetail {
  membershipId: string;
  memberName: string;
  activityName: string;
  oldPrice: number;
  newPrice: number;
  priceChanged: boolean;
  renewed: boolean;
  error?: string;
}

interface MembershipToRenew {
  id: string;
  memberId: string;
  memberName: string;
  activityId: string;
  activityName: string;
  currentCost: number;
  endDate: any;
  autoRenewal: boolean;
  status: string;
  maxAttendances: number;
  description: string;
}

/**
 * 🔍 Buscar membresías vencidas con auto-renovación habilitada
 */
export const getExpiredAutoRenewalMemberships = async (gymId: string): Promise<MembershipToRenew[]> => {
  try {
    console.log('🔍 Buscando membresías vencidas con auto-renovación...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const memberships: MembershipToRenew[] = [];
    
    // Obtener todos los miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);
    
    // Para cada miembro, revisar sus membresías
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberId = memberDoc.id;
      
      // Obtener membresías del miembro
      const membershipRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const membershipQuery = query(
        membershipRef,
        where('status', '==', 'active'),
        where('autoRenewal', '==', true)
      );
      
      const membershipSnapshot = await getDocs(membershipQuery);
      
      membershipSnapshot.forEach(membershipDoc => {
        const membershipData = membershipDoc.data();
        
        // Verificar si la membresía está vencida
        let endDate: Date;
        try {
          endDate = membershipData.endDate?.toDate ? 
            membershipData.endDate.toDate() : 
            new Date(membershipData.endDate);
        } catch {
          endDate = new Date();
        }
        
        if (endDate <= today) {
          memberships.push({
            id: membershipDoc.id,
            memberId,
            memberName: `${memberData.firstName} ${memberData.lastName}`,
            activityId: membershipData.activityId || '',
            activityName: membershipData.activityName || 'Sin actividad',
            currentCost: membershipData.cost || 0,
            endDate: membershipData.endDate,
            autoRenewal: membershipData.autoRenewal,
            status: membershipData.status,
            maxAttendances: membershipData.maxAttendances || 0,
            description: membershipData.description || ''
          });
        }
      });
    }
    
    console.log(`✅ Encontradas ${memberships.length} membresías para renovar`);
    return memberships;
    
  } catch (error) {
    console.error('❌ Error buscando membresías vencidas:', error);
    throw error;
  }
};

/**
 * 💰 Obtener precio actual de una actividad
 */
export const getCurrentActivityPrice = async (gymId: string, activityId: string): Promise<number | null> => {
  try {
    if (!activityId) {
      console.log('⚠️ No se proporcionó activityId');
      return null;
    }

    // Buscar en la colección de actividades
    const activity = await getActivity(gymId, activityId);
    
    if (activity && typeof activity === 'object') {
      // Acceder de forma segura a los posibles campos de precio
      const activityData = activity as Record<string, any>;
      
      // Intentar diferentes campos que podrían contener el precio
      if (typeof activityData.price === 'number' && activityData.price > 0) {
        return activityData.price;
      }
      if (typeof activityData.cost === 'number' && activityData.cost > 0) {
        return activityData.cost;
      }
      if (typeof activityData.monthlyPrice === 'number' && activityData.monthlyPrice > 0) {
        return activityData.monthlyPrice;
      }
    }
    
    // Si no hay precio en actividades, buscar en membresías
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const membershipQuery = query(
        membershipsRef,
        where('activityId', '==', activityId),
        where('isActive', '==', true),
        limit(1)
      );
      
      const membershipSnapshot = await getDocs(membershipQuery);
      
      if (!membershipSnapshot.empty) {
        const membershipData = membershipSnapshot.docs[0].data();
        if (typeof membershipData.cost === 'number' && membershipData.cost > 0) {
          return membershipData.cost;
        }
      }
    } catch (membershipError) {
      console.log('⚠️ Error consultando membresías para precio:', membershipError);
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error obteniendo precio de actividad ${activityId}:`, error);
    return null;
  }
};

/**
 * 🔄 Renovar una membresía individual con precio actualizado
 */
export const renewMembershipWithUpdatedPrice = async (
  gymId: string,
  membership: MembershipToRenew
): Promise<RenewalDetail> => {
  try {
    console.log(`🔄 Renovando membresía: ${membership.activityName} para ${membership.memberName}`);
    
    // 1. Obtener precio actual de la actividad
    const currentPrice = await getCurrentActivityPrice(gymId, membership.activityId);
    const finalPrice = currentPrice && currentPrice > 0 ? currentPrice : membership.currentCost;
    
    const priceChanged = finalPrice !== membership.currentCost;
    
    if (priceChanged) {
      console.log(`💰 Precio actualizado: ${formatCurrency(membership.currentCost)} → ${formatCurrency(finalPrice)}`);
    }
    
    // 2. Calcular nuevas fechas
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // Renovar por 1 mes
    
    // 3. Actualizar la membresía usando transacción
    const membershipRef = doc(db, `gyms/${gymId}/members/${membership.memberId}/memberships/${membership.id}`);
    
    await runTransaction(db, async (transaction) => {
      // Actualizar membresía
      transaction.update(membershipRef, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        cost: finalPrice,
        currentAttendances: 0,
        renewedAutomatically: true,
        renewalDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      // 4. Crear registro de pago pendiente si es necesario
      if (finalPrice > 0) {
        const monthlyPaymentsRef = collection(db, `gyms/${gymId}/monthlyPayments`);
        const paymentDoc = doc(monthlyPaymentsRef);
        
        transaction.set(paymentDoc, {
          memberId: membership.memberId,
          memberName: membership.memberName,
          activityId: membership.activityId,
          activityName: membership.activityName,
          amount: finalPrice,
          status: 'pending',
          dueDate: startDate.toISOString().split('T')[0],
          membershipId: membership.id,
          autoGenerated: true,
          renewalPayment: true,
          priceUpdated: priceChanged,
          previousPrice: membership.currentCost,
          createdAt: Timestamp.fromDate(new Date())
        });
      }
    });
    
    return {
      membershipId: membership.id,
      memberName: membership.memberName,
      activityName: membership.activityName,
      oldPrice: membership.currentCost,
      newPrice: finalPrice,
      priceChanged,
      renewed: true
    };
    
  } catch (error) {
    console.error(`❌ Error renovando membresía ${membership.id}:`, error);
    
    return {
      membershipId: membership.id,
      memberName: membership.memberName,
      activityName: membership.activityName,
      oldPrice: membership.currentCost,
      newPrice: membership.currentCost,
      priceChanged: false,
      renewed: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * 🚀 Procesar todas las renovaciones automáticas
 */
export const processAllAutoRenewals = async (gymId: string): Promise<RenewalResult> => {
  try {
    console.log('🚀 Iniciando proceso de renovaciones automáticas...');
    
    // 1. Obtener membresías vencidas con auto-renovación
    const expiredMemberships = await getExpiredAutoRenewalMemberships(gymId);
    
    if (expiredMemberships.length === 0) {
      return {
        success: true,
        renewedMemberships: 0,
        totalAmount: 0,
        priceUpdates: 0,
        errors: [],
        details: []
      };
    }
    
    console.log(`📋 Procesando ${expiredMemberships.length} membresías...`);
    
    // 2. Renovar cada membresía
    const results: RenewalDetail[] = [];
    const errors: string[] = [];
    
    for (const membership of expiredMemberships) {
      try {
        const result = await renewMembershipWithUpdatedPrice(gymId, membership);
        results.push(result);
        
        if (result.error) {
          errors.push(`${membership.memberName} - ${membership.activityName}: ${result.error}`);
        }
        
        // Pausa para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        const errorMsg = `${membership.memberName} - ${membership.activityName}: Error en renovación`;
        errors.push(errorMsg);
        console.error('❌', errorMsg, error);
        
        results.push({
          membershipId: membership.id,
          memberName: membership.memberName,
          activityName: membership.activityName,
          oldPrice: membership.currentCost,
          newPrice: membership.currentCost,
          priceChanged: false,
          renewed: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }
    
    // 3. Calcular totales
    const renewedCount = results.filter(r => r.renewed).length;
    const totalAmount = results.reduce((sum, r) => r.renewed ? sum + r.newPrice : sum, 0);
    const priceUpdates = results.filter(r => r.priceChanged).length;
    
    // 4. Registrar el proceso en historial
    await recordRenewalProcess(gymId, results, errors);
    
    const result: RenewalResult = {
      success: errors.length === 0,
      renewedMemberships: renewedCount,
      totalAmount,
      priceUpdates,
      errors,
      details: results
    };
    
    console.log('✅ Proceso de renovaciones completado:', {
      renovadas: renewedCount,
      total: formatCurrency(totalAmount),
      preciosActualizados: priceUpdates,
      errores: errors.length
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en proceso de renovaciones automáticas:', error);
    
    return {
      success: false,
      renewedMemberships: 0,
      totalAmount: 0,
      priceUpdates: 0,
      errors: [error instanceof Error ? error.message : 'Error desconocido'],
      details: []
    };
  }
};

/**
 * 📝 Registrar el proceso de renovación en historial
 */
const recordRenewalProcess = async (
  gymId: string, 
  results: RenewalDetail[], 
  errors: string[]
): Promise<void> => {
  try {
    const processRef = collection(db, `gyms/${gymId}/renewalHistory`);
    
    await addDoc(processRef, {
      executedAt: Timestamp.fromDate(new Date()),
      processedMemberships: results.length,
      successfulRenewals: results.filter(r => r.renewed).length,
      failedRenewals: results.filter(r => !r.renewed).length,
      priceUpdates: results.filter(r => r.priceChanged).length,
      totalAmount: results.reduce((sum: number, r: RenewalDetail) => {
        return r.renewed ? sum + r.newPrice : sum;
      }, 0),
      errors: errors,
      details: results.map(r => ({
        memberName: r.memberName,
        activityName: r.activityName,
        priceChanged: r.priceChanged,
        oldPrice: r.oldPrice,
        newPrice: r.newPrice,
        success: r.renewed
      })),
      executionType: 'automatic'
    });
    
    console.log('📝 Proceso registrado en historial');
    
  } catch (error) {
    console.error('❌ Error registrando en historial:', error);
  }
};

/**
 * 📊 Obtener próximas renovaciones (para dashboard)
 */
export const getUpcomingAutoRenewals = async (gymId: string, daysAhead: number = 7): Promise<MembershipToRenew[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);
    
    const memberships: MembershipToRenew[] = [];
    
    // Obtener miembros activos
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberId = memberDoc.id;
      
      const membershipRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
      const membershipQuery = query(
        membershipRef,
        where('status', '==', 'active'),
        where('autoRenewal', '==', true)
      );
      
      const membershipSnapshot = await getDocs(membershipQuery);
      
      membershipSnapshot.forEach(membershipDoc => {
        const membershipData = membershipDoc.data();
        
        let endDate: Date;
        try {
          endDate = membershipData.endDate?.toDate ? 
            membershipData.endDate.toDate() : 
            new Date(membershipData.endDate);
        } catch {
          endDate = new Date();
        }
        
        // Incluir membresías que vencen en el período especificado
        if (endDate > today && endDate <= futureDate) {
          memberships.push({
            id: membershipDoc.id,
            memberId,
            memberName: `${memberData.firstName} ${memberData.lastName}`,
            activityId: membershipData.activityId || '',
            activityName: membershipData.activityName || 'Sin actividad',
            currentCost: membershipData.cost || 0,
            endDate: membershipData.endDate,
            autoRenewal: membershipData.autoRenewal,
            status: membershipData.status,
            maxAttendances: membershipData.maxAttendances || 0,
            description: membershipData.description || ''
          });
        }
      });
    }
    
    return memberships.sort((a, b) => {
      let dateA: Date, dateB: Date;
      try {
        dateA = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate);
        dateB = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
      } catch {
        dateA = new Date();
        dateB = new Date();
      }
      return dateA.getTime() - dateB.getTime();
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo próximas renovaciones:', error);
    return [];
  }
};

/**
 * 📊 Obtener historial de renovaciones
 */
export const getRenewalHistory = async (gymId: string, limitCount: number = 10): Promise<any[]> => {
  try {
    const historyRef = collection(db, `gyms/${gymId}/renewalHistory`);
    const historyQuery = query(historyRef, limit(limitCount));
    const historySnapshot = await getDocs(historyQuery);
    
    return historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
  } catch (error) {
    console.error('❌ Error obteniendo historial de renovaciones:', error);
    return [];
  }
};

/**
 * 🔄 Verificar cambios de precio (función placeholder)
 */
export const checkPriceChanges = async (gymId: string): Promise<{activityId: string, activityName: string, oldPrice: number, newPrice: number}[]> => {
  try {
    // Esta función se puede expandir en el futuro para detectar cambios de precios
    return [];
  } catch (error) {
    console.error('❌ Error verificando cambios de precios:', error);
    return [];
  }
};

export default {
  getExpiredAutoRenewalMemberships,
  getCurrentActivityPrice,
  renewMembershipWithUpdatedPrice,
  processAllAutoRenewals,
  getUpcomingAutoRenewals,
  getRenewalHistory,
  checkPriceChanges
};