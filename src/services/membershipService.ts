// src/services/membershipService.ts - VERSIÓN FINAL LIMPIA
// ✅ SIN ERRORES DE SINTAXIS - PROBADA Y FUNCIONAL

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
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/gym.types';
import { 
  Membership, 
  MembershipFormData 
} from '../types/membership.types';

// ===================== FUNCIONES BÁSICAS DE MEMBRESÍAS =====================

/**
 * 📋 Obtener todas las membresías (planes/actividades)
 */
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

/**
 * 🆕 Crear nueva membresía (plan/actividad)
 */
export const createMembership = async (
  gymId: string, 
  membershipData: MembershipFormData
): Promise<Membership> => {
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
      id: docRef.id,
      ...membershipData
    } as Membership;
    
  } catch (error) {
    console.error('❌ Error creando membresía:', error);
    throw error;
  }
};

/**
 * 📄 Actualizar membresía existente
 */
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
    
    console.log('✅ Membresía actualizada exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error actualizando membresía:', error);
    throw error;
  }
};

/**
 * 🗑️ Eliminar membresía
 */
export const deleteMembership = async (
  gymId: string,
  membershipId: string
): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, `gyms/${gymId}/memberships`, membershipId));
    
    console.log('✅ Membresía eliminada exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error eliminando membresía:', error);
    throw error;
  }
};

/**
 * ⭐ Toggle membresía popular
 */
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
    
    console.log(`✅ Membresía ${isPopular ? 'marcada como' : 'desmarcada de'} popular`);
    return true;
    
  } catch (error) {
    console.error('❌ Error actualizando membresía popular:', error);
    throw error;
  }
};

/**
 * 🔧 FUNCIÓN CRÍTICA: Asignar membresía a un socio
 */
export const assignMembership = async (
  gymId: string,
  memberId: string,
  membershipData: any
): Promise<boolean> => {
  try {
    console.log('📝 Asignando membresía a socio:', { gymId, memberId, membershipData });
    
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
      currentAttendances: membershipData.currentAttendances || 0
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
    
    console.log('✅ Membresía asignada exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error asignando membresía:', error);
    throw error;
  }
};

// ===================== CLASE DE SERVICIO PARA FUNCIONES AVANZADAS =====================

export class MembershipService {
  
  /**
   * 🆕 Obtener membresías vencidas
   */
  static async getExpiredMemberships(gymId: string): Promise<MembershipAssignment[]> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      console.log('🔍 Buscando membresías vencidas hasta:', today);
      
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const allExpired: MembershipAssignment[] = [];
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membership = membershipDoc.data();
          
          if (membership.endDate && membership.endDate < today && 
              membership.status !== 'cancelled') {
            
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
      
      console.log(`✅ Encontradas ${allExpired.length} membresías vencidas`);
      return allExpired;
      
    } catch (error) {
      console.error('❌ Error obteniendo membresías vencidas:', error);
      return [];
    }
  }
  
  /**
   * 🔄 Renovar membresía vencida
   */
  static async renewExpiredMembership(
    gymId: string,
    membershipId: string,
    months: number = 1
  ): Promise<{ success: boolean; error?: string; newEndDate?: string }> {
    try {
      console.log(`🔄 Renovando membresía ${membershipId} por ${months} mes(es)`);
      
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      let membershipFound = false;
      let memberId = '';
      let membershipData: any = null;
      
      for (const memberDoc of membersSnapshot.docs) {
        const membershipRef = doc(
          db, 
          `gyms/${gymId}/members/${memberDoc.id}/memberships`, 
          membershipId
        );
        const membershipSnap = await getDoc(membershipRef);
        
        if (membershipSnap.exists()) {
          membershipFound = true;
          memberId = memberDoc.id;
          membershipData = membershipSnap.data();
          
          const today = new Date();
          const newStartDate = today.toISOString().split('T')[0];
          const newEndDate = new Date(today);
          newEndDate.setMonth(newEndDate.getMonth() + months);
          const newEndDateStr = newEndDate.toISOString().split('T')[0];
          
          await updateDoc(membershipRef, {
            startDate: newStartDate,
            endDate: newEndDateStr,
            status: 'active',
            paymentStatus: 'pending',
            renewedAt: Timestamp.now(),
            renewalMonths: months,
            updatedAt: Timestamp.now()
          });
          
          const transactionData = {
            memberId,
            membershipId,
            memberName: membershipData.memberName || 'Sin nombre',
            activityName: membershipData.activityName || '',
            amount: (membershipData.cost || 0) * months,
            type: 'income',
            category: 'membership',
            description: `Renovación de ${membershipData.activityName} - ${months} ${months === 1 ? 'mes' : 'meses'}`,
            status: 'pending',
            date: Timestamp.now(),
            createdAt: Timestamp.now()
          };
          
          const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
          await addDoc(transactionsRef, transactionData);
          
          console.log('✅ Membresía renovada exitosamente');
          
          return {
            success: true,
            newEndDate: newEndDateStr
          };
        }
      }
      
      if (!membershipFound) {
        return { 
          success: false, 
          error: 'Membresía no encontrada' 
        };
      }
      
      return { success: true };
      
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
      
      console.log('📊 Estadísticas:', { 
        total, 
        active, 
        expired, 
        expiringSoon, 
        withAutoRenewal 
      });
      
      return {
        total,
        active,
        expired,
        expiringSoon,
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
  
  /**
   * 👥 Obtener todos los socios con sus membresías
   */
  static async getAllMembersWithMemberships(gymId: string): Promise<any[]> {
    try {
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const membersWithMemberships = [];
      const today = new Date().toISOString().split('T')[0];
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        const membershipsRef = collection(
          db, 
          `gyms/${gymId}/members/${memberDoc.id}/memberships`
        );
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const memberships = membershipsSnapshot.docs.map(membershipDoc => {
          const membershipData = membershipDoc.data();
          
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
}

// ===================== EXPORT DEFAULT =====================

export default MembershipService;