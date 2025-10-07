// src/services/membershipAssignment.service.ts
// 🎯 SERVICIO PARA ASIGNAR MEMBRESÍAS AL NUEVO SISTEMA
// Reemplaza o complementa tu servicio actual

import {
  collection,
  doc,
  setDoc,
  getDoc,
  Timestamp,query, where, getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipStatus } from '../types/monthlyPayments.types';
import { generateMonthlyPayments } from './monthlyPayments.service';

/**
 * 📝 Datos necesarios para asignar una membresía
 */
export interface AssignMembershipRequest {
  gymId: string;
  memberId: string;
  memberName: string;
  activityId: string;
  activityName: string;
  activityCost: number;
  startDate?: string; // Opcional, por defecto hoy
}

/**
 * ✅ Resultado de la asignación
 */
export interface AssignMembershipResult {
  success: boolean;
  membershipId?: string;
  paymentGenerated?: boolean;
  error?: string;
}

/**
 * 🎯 FUNCIÓN PRINCIPAL: Asignar membresía a un socio
 * 
 * Qué hace:
 * 1. Crea la membresía permanente en: gyms/{gymId}/members/{memberId}/memberships
 * 2. Genera automáticamente el primer pago mensual
 * 3. Respeta la regla: si es después del 15, paga el mes siguiente
 * 
 * @param request - Datos de la membresía a asignar
 * @returns Resultado con el ID de la membresía creada
 */
export const assignMembershipToMember = async (
  request: AssignMembershipRequest
): Promise<AssignMembershipResult> => {
  try {
    const {
      gymId,
      memberId,
      memberName,
      activityId,
      activityName,
      startDate
    } = request;

    console.log('📝 Asignando membresía:', {
      member: memberName,
      activity: activityName,
      startDate
    });

    // 1️⃣ Obtener datos de la membership (precio, asistencias, etc)
    const membershipDefRef = collection(db, `gyms/${gymId}/memberships`);
    const membershipDefQuery = query(
      membershipDefRef,
      where('activityId', '==', activityId)
    );
    const membershipDefSnap = await getDocs(membershipDefQuery);
    
    if (membershipDefSnap.empty) {
      throw new Error('No se encontró la definición de membresía');
    }

    const membershipDefData = membershipDefSnap.docs[0].data();
    const cost = membershipDefData.cost || 0;
    const maxAttendances = membershipDefData.maxAttendances || 0;

    console.log('💰 Datos de membership:', {
      cost,
      maxAttendances,
      activityName
    });

    // 2️⃣ Determinar fecha de inicio
    const today = new Date();
    const startDateFinal = startDate || today.toISOString().split('T')[0];

    // 3️⃣ Crear la membresía permanente en la subcollection del socio
    // Calcular endDate correctamente (30 días después del inicio)
    const startDateObj = new Date(startDateFinal + 'T12:00:00');
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + 30); // 30 días de duración

    // Formatear endDate a string YYYY-MM-DD
    const endDateFinal = endDateObj.toISOString().split('T')[0];

    const membershipData: any = {
      memberId,
      memberName,
      activityId,
      activityName,
      startDate: startDateFinal,
      endDate: endDateFinal, // ✅ AHORA SÍ TIENE UNA FECHA VÁLIDA
      cost: cost,
      maxAttendances: maxAttendances,
      currentAttendances: 0,
      status: 'active',
      paymentStatus: 'pending',
      autoGeneratePayments: true,
      description: '', // Agregar campo description vacío
      createdAt: Timestamp.now()
    };

    const membershipsRef = collection(
      db,
      `gyms/${gymId}/members/${memberId}/memberships`
    );
    const newMembershipRef = doc(membershipsRef);
    
    await setDoc(newMembershipRef, membershipData);

    console.log('✅ Membresía permanente creada:', newMembershipRef.id);

    // 4️⃣ Generar el pago mensual
    const paymentResult = await generateMonthlyPayments(gymId);
    
    console.log('💰 Resultado generación de pagos:', {
      success: paymentResult.success,
      count: paymentResult.paymentsGenerated,
      totalAmount: paymentResult.summary.totalAmount
    });

    return {
      success: true,
      membershipId: newMembershipRef.id,
      paymentGenerated: paymentResult.paymentsGenerated > 0
    };

  } catch (error: any) {
    console.error('❌ Error asignando membresía:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * ⏸️ Suspender una membresía
 * NO elimina pagos ya generados, solo previene futuros
 */
export const suspendMembership = async (
  gymId: string,
  memberId: string,
  membershipId: string,
  reason: string = 'Sin especificar'
): Promise<AssignMembershipResult> => {
  try {
    const membershipRef = doc(
      db,
      `gyms/${gymId}/members/${memberId}/memberships`,
      membershipId
    );

    // Verificar que existe
    const membershipSnap = await getDoc(membershipRef);
    if (!membershipSnap.exists()) {
      return {
        success: false,
        error: 'Membresía no encontrada'
      };
    }

    // Actualizar estado
    await setDoc(
      membershipRef,
      {
        status: 'suspended',
        autoGeneratePayments: false,
        suspendedAt: Timestamp.now(),
        suspendedReason: reason,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );

    console.log('⏸️ Membresía suspendida');

    return { success: true, membershipId };

  } catch (error: any) {
    console.error('❌ Error suspendiendo membresía:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * ▶️ Reactivar una membresía suspendida
 */
export const reactivateMembership = async (
  gymId: string,
  memberId: string,
  membershipId: string
): Promise<AssignMembershipResult> => {
  try {
    const membershipRef = doc(
      db,
      `gyms/${gymId}/members/${memberId}/memberships`,
      membershipId
    );

    // Verificar que existe
    const membershipSnap = await getDoc(membershipRef);
    if (!membershipSnap.exists()) {
      return {
        success: false,
        error: 'Membresía no encontrada'
      };
    }

    // Reactivar
    await setDoc(
      membershipRef,
      {
        status: 'active',
        autoGeneratePayments: true,
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );

    console.log('▶️ Membresía reactivada');

    // Generar pago del mes actual si no existe
    await generateMonthlyPayments(gymId);

    return { success: true, membershipId };

  } catch (error: any) {
    console.error('❌ Error reactivando membresía:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 📋 Obtener membresías activas de un socio
 */
export const getMemberActiveMemberships = async (
  gymId: string,
  memberId: string
): Promise<MembershipStatus[]> => {
  try {
    const membershipsRef = collection(
      db,
      `gyms/${gymId}/members/${memberId}/memberships`
    );
    
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(membershipsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MembershipStatus));

  } catch (error) {
    console.error('❌ Error obteniendo membresías:', error);
    return [];
  }
};