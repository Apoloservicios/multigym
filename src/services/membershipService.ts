import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  orderBy,
  Timestamp,
  setDoc,
  where,
  serverTimestamp,
 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/member.types';
import { Membership, MembershipFormData } from '../types/membership.types';

export interface MembershipServiceResponse {
  success: boolean;
  membershipId?: string;
  error?: string;
  membership?: Membership;
}

export const getMemberships = async (gymId: string): Promise<Membership[]> => {
  try {
    const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
    const q = query(membershipsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Membership));
    
  } catch (error) {
    console.error('Error obteniendo membresías:', error);
    throw error;
  }
};

export const createMembership = async (
  gymId: string, 
  membershipData: MembershipFormData
): Promise<MembershipServiceResponse> => {
  try {
    const processedData = {
      ...membershipData,
      cost: typeof membershipData.cost === 'string' ? parseFloat(membershipData.cost) : membershipData.cost,
      maxAttendances: typeof membershipData.maxAttendances === 'string' ? parseInt(membershipData.maxAttendances) : membershipData.maxAttendances,
      gymId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isPopular: false,
      activeMembers: 0
    };

    const activitiesRef = collection(db, `gyms/${gymId}/activities`);
    const activitiesSnapshot = await getDocs(activitiesRef);
    const activity = activitiesSnapshot.docs.find(doc => doc.id === membershipData.activityId);
    const activityName = activity ? activity.data().name : 'Actividad desconocida';

    const newMembership = {
      ...processedData,
      activityName
    };
    
    const docRef = await addDoc(
      collection(db, `gyms/${gymId}/memberships`),
      newMembership
    );
    
    const createdMembership: Membership = {
      id: docRef.id,
      ...newMembership
    } as Membership;
    
    return {
      success: true,
      membershipId: docRef.id,
      membership: createdMembership
    };
    
  } catch (error) {
    console.error('Error creando membresía:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

export const updateMembership = async (
  gymId: string,
  membershipId: string,
  updateData: Partial<MembershipFormData>
): Promise<boolean> => {
  try {
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(
      doc(db, `gyms/${gymId}/memberships`, membershipId),
      updatedData
    );
    
    return true;
    
  } catch (error) {
    console.error('Error actualizando membresía:', error);
    throw error;
  }
};

export const deleteMembership = async (
  gymId: string,
  membershipId: string
): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, `gyms/${gymId}/memberships`, membershipId));
    return true;
    
  } catch (error) {
    console.error('Error eliminando membresía:', error);
    throw error;
  }
};

export const togglePopularMembership = async (
  gymId: string,
  membershipId: string,
  isPopular: boolean
): Promise<boolean> => {
  try {
    await updateDoc(
      doc(db, `gyms/${gymId}/memberships`, membershipId),
      { 
        isPopular,
        updatedAt: Timestamp.now()
      }
    );
    
    return true;
    
  } catch (error) {
    console.error('Error actualizando membresía popular:', error);
    throw error;
  }
};

export const assignMembership = async (
  gymId: string,
  memberId: string,
  membershipData: any
): Promise<boolean> => {
  try {
    const membershipId = `membership_${Date.now()}`;
    
    const dataToSave = {
      ...membershipData,
      id: membershipId,
      memberId,
      gymId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: membershipData.status || 'active',
      paymentStatus: membershipData.paymentStatus || 'pending',
      autoRenewal: membershipData.autoRenewal !== undefined ? membershipData.autoRenewal : true,
      paymentFrequency: membershipData.paymentFrequency || 'monthly',
      paymentType: 'monthly',
      maxAttendances: membershipData.maxAttendances || 0
    };
    
    const membershipRef = doc(
      db, 
      `gyms/${gymId}/members/${memberId}/memberships`, 
      membershipId
    );
    
    await setDoc(membershipRef, dataToSave);
    
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    await updateDoc(memberRef, {
      status: 'active',
      lastMembershipUpdate: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return true;
    
  } catch (error) {
    console.error('Error asignando membresía:', error);
    throw error;
  }
};

export const getExpiredMemberships = async (gymId: string): Promise<MembershipAssignment[]> => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const allExpired: MembershipAssignment[] = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membership = membershipDoc.data();
        
        if (membership.endDate && membership.endDate < today && membership.status !== 'cancelled') {
          const expiredMembership: MembershipAssignment = {
            id: membershipDoc.id,
            memberId: memberDoc.id,
            memberName: `${memberData.firstName} ${memberData.lastName}`,
            activityId: membership.activityId || '',
            activityName: membership.activityName || '',
            cost: membership.cost || 0,
            startDate: membership.startDate || '',
            endDate: membership.endDate || '',
            status: 'expired' as const,
            paymentStatus: membership.paymentStatus || 'pending',
            maxAttendances: membership.maxAttendances || 0,
            currentAttendances: membership.currentAttendances || 0,
            description: membership.description || '',
            autoRenewal: membership.autoRenewal || false,
            paymentFrequency: membership.paymentFrequency || 'monthly',
            createdAt: membership.createdAt,
            updatedAt: membership.updatedAt
          };
          
          allExpired.push(expiredMembership);
        }
      }
    }
    
    allExpired.sort((a, b) => 
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
    
    return allExpired;
    
  } catch (error) {
    console.error('Error obteniendo membresías vencidas:', error);
    return [];
  }
};

// VERSIÓN CORREGIDA de renewExpiredMembership para membershipService.ts
// Reemplaza tu función actual con esta versión

export const renewExpiredMembership = async (
  gymId: string,
  membershipId: string,
  months: number = 1  // Por defecto 1 mes
): Promise<{
  success: boolean;
  newMembershipId?: string;
  error?: string;
}> => {
  try {
    // 1. Obtener la membresía original
    const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments`, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      return { 
        success: false, 
        error: 'Membresía no encontrada' 
      };
    }
    
    const membershipData = membershipSnap.data();
    
    // 2. 🔧 CORRECCIÓN: Obtener el precio actual de la actividad
    let currentPrice = membershipData.cost; // Precio anterior como fallback
    
    if (membershipData.activityId) {
      try {
        // Primero intentar obtener de la tabla de actividades
        const activityRef = doc(db, `gyms/${gymId}/activities`, membershipData.activityId);
        const activitySnap = await getDoc(activityRef);
        
        if (activitySnap.exists()) {
          const activityData = activitySnap.data();
          // Buscar el precio en las membresías de la actividad
          if (activityData.memberships && activityData.memberships.length > 0) {
            // Usar el primer precio de membresía o buscar una que coincida
            currentPrice = activityData.memberships[0].cost || currentPrice;
          }
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener precio de actividad, usando precio anterior');
      }
    }
    
    // Si hay membershipId (de la definición general de membresía), intentar obtener precio de ahí
    if (membershipData.membershipId) {
      try {
        const membershipDefRef = doc(db, `gyms/${gymId}/memberships`, membershipData.membershipId);
        const membershipDefSnap = await getDoc(membershipDefRef);
        
        if (membershipDefSnap.exists()) {
          const membershipDef = membershipDefSnap.data();
          currentPrice = membershipDef.cost || currentPrice;
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener precio de membresía general');
      }
    }
    
    // 3. Calcular fechas para la nueva membresía
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + months);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // 4. Calcular el costo total
    const totalCost = currentPrice * months;
    
    // 5. 🔧 IMPORTANTE: Crear nueva membresía SIEMPRE con estado PENDIENTE
    // Copiar todos los campos del documento original EXCEPTO algunos específicos
    const { id, ...membershipDataWithoutId } = { id: membershipId, ...membershipData };
    
    const newMembershipData = {
      ...membershipDataWithoutId, // Copiar todos los campos excepto id
      startDate: startDate,
      endDate: endDateStr,
      cost: currentPrice, // Precio actualizado
      totalCost: totalCost,
      status: 'active',
      paymentStatus: 'pending', // 🔧 SIEMPRE pendiente al renovar
      paymentType: 'monthly',
      autoRenewal: membershipData.autoRenewal !== false,
      renewedAt: serverTimestamp(),
      renewedManually: true,
      renewalMonths: months,
      previousMembershipId: membershipId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // 6. Crear la nueva membresía
    const newMembershipRef = await addDoc(
      collection(db, `gyms/${gymId}/membershipAssignments`),
      newMembershipData
    );
    
    // 7. Marcar la membresía anterior como renovada
    await updateDoc(membershipRef, {
      status: 'renewed',
      renewedToId: newMembershipRef.id,
      renewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // 8. 🔧 NUEVO: Crear registro de pago pendiente
    try {
      const pendingPaymentData = {
        membershipId: newMembershipRef.id,
        memberId: membershipData.memberId,
        memberName: membershipData.memberName,
        activityName: membershipData.activityName,
        amount: totalCost,
        months: months,
        status: 'pending',
        dueDate: startDate,
        createdAt: serverTimestamp(),
        type: 'membership_renewal',
        description: `Renovación de ${membershipData.activityName} por ${months} ${months === 1 ? 'mes' : 'meses'}`
      };
      
      await addDoc(
        collection(db, `gyms/${gymId}/pendingPayments`),
        pendingPaymentData
      );
    } catch (error) {
      console.log('⚠️ No se pudo crear registro de pago pendiente:', error);
      // No fallar la renovación si no se puede crear el registro pendiente
    }
    
    // 9. 🔧 IMPORTANTE: NO crear transacción en caja aquí
    // La transacción en caja se creará cuando se registre el pago
    
    console.log('✅ Membresía renovada exitosamente:', {
      newMembershipId: newMembershipRef.id,
      cost: currentPrice,
      totalCost: totalCost,
      months: months,
      paymentStatus: 'pending' // Siempre pendiente
    });
    
    return {
      success: true,
      newMembershipId: newMembershipRef.id
    };
    
  } catch (error: any) {
    console.error('❌ Error renovando membresía:', error);
    return {
      success: false,
      error: error.message || 'Error al renovar la membresía'
    };
  }
};


// ============= CORRECCIÓN 2: SINCRONIZACIÓN DE DEUDA Y ESTADO =============
export const syncMemberDebtStatus = async (
  gymId: string,
  memberId: string
): Promise<void> => {
  try {
    // 1. Obtener todas las membresías del socio
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    const membershipsSnap = await getDocs(membershipsRef);
    
    let totalDebt = 0;
    let hasPendingMemberships = false;
    
    // 2. Calcular deuda total
    membershipsSnap.forEach(doc => {
      const membership = doc.data();
      if (membership.paymentStatus === 'pending' && membership.status === 'active') {
        totalDebt += membership.cost || 0;
        hasPendingMemberships = true;
      }
    });
    
    // 3. Actualizar el socio
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    await updateDoc(memberRef, {
      totalDebt: totalDebt,
      hasDebt: hasPendingMemberships,
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Estado de deuda sincronizado para ${memberId}: $${totalDebt}`);
    
  } catch (error) {
    console.error('Error sincronizando deuda:', error);
  }
};

// ============= CORRECCIÓN 3: EVITAR DUPLICACIÓN EN CAJA =============
export const registerMembershipPaymentFixed = async (payment: {
  gymId: string;
  memberId: string;
  memberName: string;
  membershipIds: string[];
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  userId: string;
  userName: string;
}): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    const memberRef = doc(db, `gyms/${payment.gymId}/members`, payment.memberId);
    const dailyCashRef = doc(db, `gyms/${payment.gymId}/dailyCash`, payment.paymentDate);
    
    // 1. Obtener membresías a pagar
    const membershipsToUpdate = [];
    let description = `Pago de membresías: `;
    
    for (const membershipId of payment.membershipIds) {
      const membershipRef = doc(
        db, 
        `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, 
        membershipId
      );
      const membershipSnap = await getDoc(membershipRef);
      
      if (membershipSnap.exists()) {
        const membershipData = membershipSnap.data();
        membershipsToUpdate.push({
          ref: membershipRef,
          data: membershipData
        });
        description += `${membershipData.activityName} ($${membershipData.cost}), `;
      }
    }
    
    description = description.slice(0, -2) + ` - ${payment.memberName}`;
    
    // 2. 🔧 CORRECCIÓN: Crear UNA SOLA transacción en caja
    const transactionData = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'income',
      category: 'memberships',
      amount: payment.amount,
      description: description,
      date: Timestamp.fromDate(new Date(payment.paymentDate + 'T12:00:00')),
      userId: payment.userId,
      userName: payment.userName,
      paymentMethod: payment.paymentMethod,
      status: 'completed',
      memberId: payment.memberId,
      memberName: payment.memberName,
      membershipIds: payment.membershipIds, // Guardar IDs de todas las membresías pagadas
      createdAt: serverTimestamp()
    };
    
    // 3. Agregar transacción a la caja diaria (UNA SOLA VEZ)
    const transactionRef = await addDoc(
      collection(db, `gyms/${payment.gymId}/dailyCash/${payment.paymentDate}/transactions`),
      transactionData
    );
    
    // 4. Actualizar el total de la caja diaria
    const dailyCashSnap = await getDoc(dailyCashRef);
    const currentIncome = dailyCashSnap.exists() ? (dailyCashSnap.data().totalIncome || 0) : 0;
    
    await updateDoc(dailyCashRef, {
      totalIncome: currentIncome + payment.amount,
      lastTransaction: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // 5. Actualizar estado de pago de las membresías
    for (const membership of membershipsToUpdate) {
      await updateDoc(membership.ref, {
        paymentStatus: 'paid',
        paidAmount: membership.data.cost,
        paidAt: serverTimestamp(),
        transactionId: transactionRef.id, // Referenciar la transacción única
        updatedAt: serverTimestamp()
      });
    }
    
    // 6. Actualizar deuda del socio
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const currentDebt = memberSnap.data().totalDebt || 0;
      const newDebt = Math.max(0, currentDebt - payment.amount);
      
      await updateDoc(memberRef, {
        totalDebt: newDebt,
        lastPaymentDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    console.log(`✅ Pago registrado correctamente sin duplicación: ${transactionRef.id}`);
    
    return {
      success: true,
      transactionId: transactionRef.id
    };
    
  } catch (error) {
    console.error('Error registrando pago:', error);
    return {
      success: false,
      error: 'Error al registrar el pago'
    };
  }
};

// ============= FUNCIÓN AUXILIAR: Obtener precio actual de actividad =============
export const getCurrentActivityPrice = async (
  gymId: string,
  activityId: string
): Promise<number | null> => {
  try {
    // Intentar primero en activities
    const activityRef = doc(db, `gyms/${gymId}/activities`, activityId);
    const activitySnap = await getDoc(activityRef);
    
    if (activitySnap.exists()) {
      const data = activitySnap.data();
      return data.price || data.cost || null;
    }
    
    // Si no existe, intentar en memberships (planes)
    const membershipRef = doc(db, `gyms/${gymId}/memberships`, activityId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (membershipSnap.exists()) {
      const data = membershipSnap.data();
      return data.cost || data.price || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error obteniendo precio de actividad:', error);
    return null;
  }
};

// ============= PROCESO AUTOMÁTICO MENSUAL CORREGIDO =============
export const processMonthlyRenewalsFixed = async (gymId: string): Promise<{
  success: boolean;
  renewed: number;
  errors: string[];
}> => {
  const results = {
    success: true,
    renewed: 0,
    errors: [] as string[]
  };
  
  try {
    // 1. Obtener membresías con auto-renovación activa que vencen este mes
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const membershipsRef = collection(db, `gyms/${gymId}/membershipAssignments`);
    const q = query(
      membershipsRef,
      where('autoRenewal', '==', true),
      where('status', '==', 'active'),
      where('endDate', '<=', endOfMonth.toISOString().split('T')[0])
    );
    
    const querySnapshot = await getDocs(q);
    
    for (const docSnap of querySnapshot.docs) {
      try {
        const membershipData = docSnap.data();
        
        // 🔧 USAR PRECIO ACTUAL DE LA ACTIVIDAD
        let renewalPrice = membershipData.cost;
        
        if (membershipData.activityId) {
          const currentPrice = await getCurrentActivityPrice(gymId, membershipData.activityId);
          if (currentPrice !== null) {
            renewalPrice = currentPrice;
          }
        }
        
        // Crear renovación con precio actualizado
        const result = await renewExpiredMembership(gymId, docSnap.id, 1);
        
        if (result.success) {
          results.renewed++;
          console.log(`✅ Renovada: ${membershipData.memberName} - ${membershipData.activityName} a $${renewalPrice}`);
        } else {
          results.errors.push(`Error renovando ${membershipData.memberName}: ${result.error}`);
        }
        
      } catch (error) {
        results.errors.push(`Error procesando membresía ${docSnap.id}: ${error}`);
      }
    }
    
    console.log(`📊 Proceso mensual completado: ${results.renewed} renovaciones`);
    
  } catch (error) {
    console.error('Error en proceso mensual:', error);
    results.success = false;
    results.errors.push(`Error general: ${error}`);
  }
  
  return results;
};

export const getMembershipStats = async (gymId: string): Promise<{
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  withAutoRenewal: number;
}> => {
  try {
    let total = 0;
    let active = 0;
    let expired = 0;
    let expiringSoon = 0;
    let withAutoRenewal = 0;
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];
    
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    for (const memberDoc of membersSnapshot.docs) {
      const membershipsRef = collection(
        db, 
        `gyms/${gymId}/members/${memberDoc.id}/memberships`
      );
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membership = membershipDoc.data();
        
        if (membership.status === 'cancelled') continue;
        
        total++;
        
        if (membership.autoRenewal) {
          withAutoRenewal++;
        }
        
        if (membership.endDate) {
          if (membership.endDate < todayStr) {
            expired++;
          } else if (membership.endDate <= sevenDaysStr) {
            expiringSoon++;
            active++;
          } else {
            active++;
          }
        } else {
          active++;
        }
      }
    }
    
    return {
      total,
      active,
      expired,
      expiringSoon,
      withAutoRenewal
    };
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return {
      total: 0,
      active: 0,
      expired: 0,
      expiringSoon: 0,
      withAutoRenewal: 0
    };
  }
};

export default {
  getMemberships,
  createMembership,
  updateMembership,
  deleteMembership,
  togglePopularMembership,
  assignMembership,
  getExpiredMemberships,
  renewExpiredMembership,
  getMembershipStats
};