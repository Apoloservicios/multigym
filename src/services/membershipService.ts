// src/services/membershipService.ts - VERSIÓN FINAL SIN CONFLICTOS
// 🔧 SOLUCIÓN: Usar tipos existentes + evitar duplicaciones

import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/gym.types';

// ===================== USAR TIPOS EXISTENTES (SIN REDEFINIR) =====================

// 🔧 IMPORTAR tipos existentes en lugar de redefinirlos
import { 
  Membership, 
  MembershipFormData 
} from '../types/membership.types';

// ===================== FUNCIONES PARA GESTIÓN DE PLANES/ACTIVIDADES =====================

/**
 * 📋 Obtener todas las membresías (planes/actividades)
 */
const getMemberships = async (gymId: string): Promise<Membership[]> => {
  try {
    const q = query(
      collection(db, `gyms/${gymId}/memberships`),
      orderBy('createdAt', 'desc')
    );
    
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

/**
 * 🆕 Crear nueva membresía (plan/actividad)
 */
const createMembership = async (
  gymId: string, 
  membershipData: MembershipFormData
): Promise<{ success: boolean; membershipId?: string; error?: string }> => {
  try {
    const newMembership = {
      ...membershipData,
      gymId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(
      collection(db, `gyms/${gymId}/memberships`),
      newMembership
    );
    
    console.log('✅ Membresía creada con ID:', docRef.id);
    
    return {
      success: true,
      membershipId: docRef.id
    };
    
  } catch (error) {
    console.error('❌ Error creando membresía:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * 🔄 Actualizar membresía existente
 */
const updateMembership = async (
  gymId: string,
  membershipId: string,
  updateData: Partial<MembershipFormData>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(
      doc(db, `gyms/${gymId}/memberships`, membershipId),
      updatedData
    );
    
    console.log('✅ Membresía actualizada exitosamente');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error actualizando membresía:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * 🗑️ Eliminar membresía
 */
const deleteMembership = async (
  gymId: string,
  membershipId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, `gyms/${gymId}/memberships`, membershipId));
    
    console.log('✅ Membresía eliminada exitosamente');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error eliminando membresía:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * ⭐ Toggle membresía popular
 */
const togglePopularMembership = async (
  gymId: string,
  membershipId: string,
  isPopular: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(
      doc(db, `gyms/${gymId}/memberships`, membershipId),
      { 
        isPopular,
        updatedAt: Timestamp.now()
      }
    );
    
    console.log(`✅ Membresía ${isPopular ? 'marcada como' : 'desmarcada de'} popular`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error actualizando membresía popular:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

// ===================== CLASE PARA NUEVAS FUNCIONALIDADES (RENOVACIONES) =====================

export class MembershipService {
  
  /**
   * 🆕 FUNCIÓN PRINCIPAL: Asignar membresía con auto-renovación por defecto
   * SOLUCIÓN: Siempre configura autoRenewal: true y paymentType: 'monthly'
   */
  static async assignMembership(
    gymId: string,
    memberId: string,
    memberName: string,
    activityId: string,
    activityName: string,
    cost: number,
    startDate: string,
    endDate: string,
    assignedBy: string
  ): Promise<{ success: boolean; membershipId?: string; error?: string }> {
    try {
      console.log('🎯 ASIGNANDO MEMBRESÍA CON CONFIGURACIÓN POR DEFECTO');
      
      // 🔧 CONFIGURACIÓN POR DEFECTO (SOLUCIÓN AL PROBLEMA)
      const membershipData: Partial<MembershipAssignment> = {
        memberId,
        memberName,
        activityId,
        activityName,
        cost,
        startDate,
        endDate,
        assignedBy,
        assignedAt: Timestamp.now(),
        
        // ✅ SOLUCIÓN: VALORES POR DEFECTO CORREGIDOS
        autoRenewal: true,           // 🎯 AUTO-RENOVACIÓN ACTIVADA POR DEFECTO
        paymentType: 'monthly',      // 🎯 SOLO PAGOS MENSUALES
        paymentStatus: 'pending',    // 🎯 PENDIENTE POR DEFECTO
        
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      console.log('📋 Datos de membresía a crear:', {
        memberName,
        activityName,
        autoRenewal: membershipData.autoRenewal,
        paymentType: membershipData.paymentType,
        paymentStatus: membershipData.paymentStatus
      });
      
      // Crear el documento de membresía
      const membershipRef = await addDoc(
        collection(db, `gyms/${gymId}/membershipAssignments`),
        membershipData
      );
      
      console.log('✅ Membresía creada exitosamente con ID:', membershipRef.id);
      
      // 🔄 OPCIONAL: Generar transacción mensual automáticamente
      const now = new Date();
      await this.generateMonthlyTransaction(
        gymId,
        membershipRef.id,
        memberId,
        memberName,
        activityName,
        cost,
        now.getFullYear(),
        now.getMonth() + 1
      );
      
      return {
        success: true,
        membershipId: membershipRef.id
      };
      
    } catch (error) {
      console.error('❌ Error asignando membresía:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  /**
   * 🆕 Generar transacción mensual automática
   */
  private static async generateMonthlyTransaction(
    gymId: string,
    membershipId: string,
    memberId: string,
    memberName: string,
    activityName: string,
    amount: number,
    year: number,
    month: number
  ): Promise<void> {
    try {
      const transactionData = {
        memberId,
        memberName,
        membershipId,
        type: 'monthly_payment',
        description: `Pago mensual - ${activityName}`,
        amount,
        year,
        month,
        status: 'pending',
        dueDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      await addDoc(
        collection(db, `gyms/${gymId}/transactions`),
        transactionData
      );
      
      console.log('💰 Transacción mensual generada automáticamente');
      
    } catch (error) {
      console.error('❌ Error generando transacción mensual:', error);
    }
  }
  
  /**
   * 🔄 Actualizar membresía existente (assignments)
   */
  static async updateMembershipAssignment(
    gymId: string,
    membershipId: string,
    updateData: Partial<MembershipAssignment>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const safeUpdateData = {
        ...updateData,
        updatedAt: Timestamp.now(),
        ...(updateData.paymentType && { paymentType: 'monthly' as const })
      };
      
      await updateDoc(
        doc(db, `gyms/${gymId}/membershipAssignments`, membershipId),
        safeUpdateData
      );
      
      console.log('✅ Asignación de membresía actualizada exitosamente');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error actualizando asignación de membresía:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  /**
   * 🔍 Obtener membresías por estado
   */
  static async getMembershipsByStatus(
  gymId: string,
  status: 'active' | 'expired' | 'cancelled'
): Promise<MembershipAssignment[]> {
  try {
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const allMemberships: MembershipAssignment[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data();
        
        // Determinar estado real
        let realStatus = membershipData.status;
        if (membershipData.status === 'active' && 
            membershipData.endDate && 
            membershipData.endDate < today) {
          realStatus = 'expired';
        }
        
        // Filtrar por estado solicitado
        if (realStatus === status) {
          allMemberships.push({
            id: membershipDoc.id,
            memberId: memberDoc.id,
            memberName: `${memberData.firstName} ${memberData.lastName}`,
            activityId: membershipData.activityId,
            activityName: membershipData.activityName,
            cost: membershipData.cost || membershipData.paidAmount,
            startDate: membershipData.startDate,
            endDate: membershipData.endDate,
            autoRenewal: membershipData.autoRenewal || false,
            paymentType: membershipData.paymentFrequency === 'monthly' ? 'monthly' : 'monthly',
            paymentStatus: membershipData.paymentStatus || 'pending',
            status: realStatus as any,
            assignedBy: memberData.firstName || 'Sistema',
            createdAt: membershipData.createdAt,
            updatedAt: membershipData.updatedAt
          } as MembershipAssignment);
        }
      }
    }
    
    return allMemberships;
    
  } catch (error) {
    console.error(`❌ Error obteniendo membresías ${status}:`, error);
    return [];
  }
}
  
 
  /**
 * 🆕 Obtener membresías vencidas (SOLUCIÓN para pestaña "Vencidas")
 */
static async getExpiredMemberships(gymId: string): Promise<MembershipAssignment[]> {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    console.log('🔍 Buscando membresías vencidas hasta:', today);
    
    // ✅ NUEVA LÓGICA: Buscar en la estructura correcta
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const allExpired: MembershipAssignment[] = [];
    
    // Recorrer cada miembro
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      // Recorrer membresías de cada miembro
      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data();
        
        // Verificar si está vencida
        if (membershipData.status === 'active' && 
            membershipData.endDate && 
            membershipData.endDate < today) {
          
          allExpired.push({
            id: membershipDoc.id,
            memberId: memberDoc.id,
            memberName: `${memberData.firstName} ${memberData.lastName}`,
            activityId: membershipData.activityId,
            activityName: membershipData.activityName,
            cost: membershipData.cost || membershipData.paidAmount,
            startDate: membershipData.startDate,
            endDate: membershipData.endDate,
            autoRenewal: membershipData.autoRenewal || false,
            paymentType: 'monthly' as const,
            paymentStatus: membershipData.paymentStatus || 'pending',
            status: 'expired' as const,
            assignedBy: memberData.firstName || 'Sistema',
            createdAt: membershipData.createdAt,
            updatedAt: membershipData.updatedAt
          } as MembershipAssignment);
        }
      }
    }
    
    console.log(`✅ Encontradas ${allExpired.length} membresías vencidas`);
    return allExpired;
    
  } catch (error) {
    console.error('❌ Error obteniendo membresías vencidas:', error);
    return [];
  }
}
  
/**
 * 🆕 Obtener todos los socios con sus membresías para gestión individual
 */
static async getAllMembersWithMemberships(gymId: string): Promise<any[]> {
  try {
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const membersWithMemberships = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      
      // Obtener membresías del socio
      const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      const memberships = membershipsSnapshot.docs.map(membershipDoc => {
        const membershipData = membershipDoc.data();
        const today = new Date().toISOString().split('T')[0];
        
        // Determinar estado real
        let realStatus = membershipData.status;
        if (membershipData.status === 'active' && 
            membershipData.endDate && 
            membershipData.endDate < today) {
          realStatus = 'expired';
        }
        
        return {
          id: membershipDoc.id,
          ...membershipData,
          status: realStatus,
          paymentType: membershipData.paymentFrequency === 'monthly' ? 'monthly' : 'monthly',
          autoRenewal: membershipData.autoRenewal || false
        };
      });
      
      membersWithMemberships.push({
        id: memberDoc.id,
        ...memberData,
        memberships
      });
    }
    
    console.log(`✅ Cargados ${membersWithMemberships.length} socios con sus membresías`);
    return membersWithMemberships;
    
  } catch (error) {
    console.error('❌ Error cargando socios con membresías:', error);
    return [];
  }
}




  /**
   * 🆕 Obtener membresías próximas a vencer
   */
  static async getExpiringSoonMemberships(
    gymId: string, 
    daysAhead: number = 7
  ): Promise<MembershipAssignment[]> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const q = query(
        collection(db, `gyms/${gymId}/membershipAssignments`),
        where('status', '==', 'active'),
        orderBy('endDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const allMemberships = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MembershipAssignment));
      
      const expiringSoon = allMemberships.filter(membership => {
        return membership.endDate && 
               membership.endDate > today && 
               membership.endDate <= futureDateStr;
      });
      
      console.log(`✅ Encontradas ${expiringSoon.length} membresías por vencer`);
      return expiringSoon;
      
    } catch (error) {
      console.error('❌ Error obteniendo membresías por vencer:', error);
      return [];
    }
  }
  
  /**
   * 🆕 Renovar membresía vencida manualmente
   */
  static async renewExpiredMembership(
    gymId: string,
    membershipId: string,
    months: number = 1
  ): Promise<{ success: boolean; error?: string; newEndDate?: string }> {
    try {
      console.log(`🔄 Renovando membresía ${membershipId} por ${months} mes(es)`);
      
      const membershipRef = doc(db, `gyms/${gymId}/membershipAssignments`, membershipId);
      const membershipDoc = await getDoc(membershipRef);
      
      if (!membershipDoc.exists()) {
        return { success: false, error: 'Membresía no encontrada' };
      }
      
      const membershipData = membershipDoc.data() as MembershipAssignment;
      
      const now = new Date();
      const newEndDate = new Date(now);
      newEndDate.setMonth(newEndDate.getMonth() + months);
      const newEndDateStr = newEndDate.toISOString().split('T')[0];
      
      await updateDoc(membershipRef, {
        endDate: newEndDateStr,
        status: 'active',
        updatedAt: Timestamp.now(),
        autoRenewal: true,
        paymentType: 'monthly' as const
      });
      
      // Generar transacciones para los meses renovados
      for (let i = 0; i < months; i++) {
        const targetDate = new Date(now);
        targetDate.setMonth(targetDate.getMonth() + i);
        
        await this.generateMonthlyTransaction(
          gymId,
          membershipId,
          membershipData.memberId,
          membershipData.memberName,
          membershipData.activityName,
          membershipData.cost,
          targetDate.getFullYear(),
          targetDate.getMonth() + 1
        );
      }
      
      console.log('✅ Membresía renovada exitosamente hasta:', newEndDateStr);
      
      return {
        success: true,
        newEndDate: newEndDateStr
      };
      
    } catch (error) {
      console.error('❌ Error renovando membresía:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  /**
   * 📊 Obtener estadísticas de membresías
   */
  static async getMembershipStats(gymId: string): Promise<{
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
    withAutoRenewal: number;
  }> {
    try {
      const [
        allMemberships,
        expiredMemberships,
        expiringSoonMemberships
      ] = await Promise.all([
        this.getMembershipsByStatus(gymId, 'active'),
        this.getExpiredMemberships(gymId),
        this.getExpiringSoonMemberships(gymId)
      ]);
      
      const withAutoRenewal = allMemberships.filter(m => m.autoRenewal).length;
      
      return {
        total: allMemberships.length,
        active: allMemberships.length - expiredMemberships.length,
        expired: expiredMemberships.length,
        expiringSoon: expiringSoonMemberships.length,
        withAutoRenewal
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
        withAutoRenewal: 0
      };
    }
  }
}



// ===================== EXPORTS ÚNICOS (SIN DUPLICACIÓN) =====================

// Exportar funciones individuales para compatibilidad con imports existentes
export {
  getMemberships,
  createMembership,
  updateMembership,
  deleteMembership,
  togglePopularMembership
};

// Exportar clase por defecto para nuevas funcionalidades
export default MembershipService;

