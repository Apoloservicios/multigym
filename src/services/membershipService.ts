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
  setDoc
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

export const renewExpiredMembership = async (
  gymId: string,
  membershipId: string,
  months: number = 1
): Promise<{ success: boolean; error?: string; newEndDate?: string }> => {
  try {
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
    console.error('Error renovando membresía:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
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