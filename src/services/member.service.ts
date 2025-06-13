// src/services/member.service.ts - LIMPIO CON LOGS ESPECÍFICOS PARA REINTEGRO
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  limit as limitQuery
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Member, MemberFormData, MembershipAssignment } from '../types/member.types';
import { uploadToCloudinary } from '../utils/cloudinary.utils';
import { Transaction, DailyCash } from '../types/gym.types';
import { registerExtraIncome, registerExpense } from './dailyCash.service';
import { formatDate } from '../utils/date.utils';

/**
 * Función auxiliar para convertir cualquier tipo de fecha a un objeto Date
 */
function safelyConvertToDate(dateValue: any): Date | null {
  if (!dateValue) {
    return null;
  }

  try {
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } 
    else if (typeof dateValue === 'object') {
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      } 
      else if (dateValue instanceof Date) {
        return dateValue;
      }
      else if (dateValue.seconds !== undefined) {
        return new Date(dateValue.seconds * 1000);
      }
    }

    const result = new Date(dateValue);
    return isNaN(result.getTime()) ? null : result;

  } catch (error) {
    console.error('Error converting date:', error);
    return null;
  }
}

// Agregar un nuevo socio
export const addMember = async (gymId: string, memberData: MemberFormData): Promise<Member> => {
  try {
    // Si hay una foto, subirla a Cloudinary
    let photoUrl = null;
    if (memberData.photo instanceof File) {
      try {
        photoUrl = await uploadToCloudinary(memberData.photo, "gym_member_photos");
      } catch (uploadError) {
        console.error("Error subiendo foto:", uploadError);
      }
    }

    let birthDateToSave = '';
    if (memberData.birthDate) {
      birthDateToSave = memberData.birthDate;
    }

    const memberToAdd = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address || "",
      birthDate: birthDateToSave,
      photo: photoUrl,
      status: memberData.status,
      totalDebt: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const membersRef = collection(db, `gyms/${gymId}/members`);
    const docRef = await addDoc(membersRef, memberToAdd);

    const newMember: Member = {
      id: docRef.id,
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address || "",
      birthDate: birthDateToSave,
      photo: photoUrl,
      status: memberData.status,
      totalDebt: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return newMember;
  } catch (error) {
    console.error('Error adding member:', error);
    throw error;
  }
};

// Asignar membresía a un socio
export const assignMembership = async (
  gymId: string, 
  memberId: string, 
  membershipData: Omit<MembershipAssignment, 'id'>
): Promise<MembershipAssignment> => {
  try {
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    
    const membershipWithDefaults = {
      ...membershipData,
      autoRenewal: membershipData.autoRenewal !== undefined ? membershipData.autoRenewal : false,
      paymentFrequency: membershipData.paymentFrequency || 'single',
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(membershipsRef, membershipWithDefaults);
    
    if (membershipData.cost > 0 && membershipData.paymentStatus === 'pending') {
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
    
    return { 
      id: docRef.id,
      ...membershipWithDefaults 
    };
  } catch (error) {
    console.error('Error assigning membership:', error);
    throw error;
  }
};

// Eliminar una membresía de un socio
export const deleteMembership = async (
  gymId: string,
  memberId: string,
  membershipId: string,
  withRefund: boolean = false
): Promise<boolean> => {
  try {

      // 🔧 AGREGAR ESTE LOG BÁSICO PARA CONFIRMAR QUE LA FUNCIÓN SE EJECUTA
    console.log('🚀 DELETE MEMBERSHIP EJECUTÁNDOSE:', {
      gymId,
      memberId,
      membershipId,
      withRefund
    });

    
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      throw new Error('El socio no existe');
    }
    
    const memberData = memberSnap.data() as Member;
    
    const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      throw new Error('La membresía no existe');
    }

    const membershipData = membershipSnap.data() as MembershipAssignment;
    
    if (membershipData.status === 'cancelled') {
      throw new Error('Esta membresía ya ha sido cancelada previamente');
    }

    // 🔍 DEBUG: Si hay reintegro, procesar
    if (withRefund && membershipData.paymentStatus === 'paid') {
      console.log('🔄 INICIANDO PROCESO DE REINTEGRO:', {
        memberName: `${memberData.firstName} ${memberData.lastName}`,
        membershipName: membershipData.activityName,
        amount: membershipData.cost
      });

      const today = new Date().toISOString().split('T')[0];
      
        const refundTransactionData = {
          gymId: gymId,
          type: 'refund',
          category: 'refund',
          amount: membershipData.cost,
          description: `Reintegro por cancelación de membresía: ${membershipData.activityName} para ${memberData.firstName} ${memberData.lastName}`,
          paymentMethod: 'cash',
          date: Timestamp.now(),
          userId: 'system',
          userName: 'Sistema',
          status: 'completed',
          memberId: memberId,
          memberName: `${memberData.firstName} ${memberData.lastName}`,
          membershipId: membershipId,
          notes: `Reintegro por cancelación de membresía ID: ${membershipId}`,
          createdAt: serverTimestamp(),
          originalTransactionId: membershipData.id || membershipId // 🔧 CAMBIAR ESTA LÍNEA
        };
      
      console.log('💾 GUARDANDO TRANSACCIÓN DE REINTEGRO:', {
        type: refundTransactionData.type,
        category: refundTransactionData.category,
        amount: refundTransactionData.amount,
        gymId: refundTransactionData.gymId
      });
      
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      const transactionRef = await addDoc(transactionsRef, refundTransactionData);
      
      console.log('✅ TRANSACCIÓN CREADA:', {
        transactionId: transactionRef.id,
        path: `gyms/${gymId}/transactions/${transactionRef.id}`
      });
      
      // Actualizar caja diaria
      const dailyCashRef = doc(db, `gyms/${gymId}/dailyCash`, today);
      const dailyCashSnap = await getDoc(dailyCashRef);
      
      if (dailyCashSnap.exists()) {
        const dailyCashData = dailyCashSnap.data() as DailyCash;
        
        const currentTotalExpense = dailyCashData.totalExpense || 0;
        const currentTotalExpenses = dailyCashData.totalExpenses || 0;
        
        await updateDoc(dailyCashRef, {
          totalExpense: currentTotalExpense + membershipData.cost,
          totalExpenses: currentTotalExpenses + membershipData.cost,
          updatedAt: serverTimestamp()
        });
        
        console.log('📊 CAJA DIARIA ACTUALIZADA:', {
          fecha: today,
          totalExpenseAnterior: currentTotalExpense,
          totalExpenseNuevo: currentTotalExpense + membershipData.cost,
          montoReintegro: membershipData.cost
        });
      } else {
        await setDoc(dailyCashRef, {
          date: today,
          gymId: gymId,
          openingTime: Timestamp.now(),
          openingAmount: 0,
          totalIncome: 0,
          totalExpense: membershipData.cost,
          totalExpenses: membershipData.cost,
          membershipIncome: 0,
          otherIncome: 0,
          status: 'open',
          openedBy: 'system',
          notes: 'Creado automáticamente para registrar reintegro',
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        console.log('🆕 CAJA DIARIA CREADA:', {
          fecha: today,
          totalExpense: membershipData.cost
        });
      }
    }

    // Actualizar estado de la membresía a "cancelled"
    await updateDoc(membershipRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting membership:', error);
    throw error;
  }
};

// Generar código QR para socio
export const generateMemberQR = async (gymId: string, memberId: string): Promise<string> => {
  try {
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    
    const qrData = {
      gymId,
      memberId,
      timestamp: new Date().getTime()
    };
    
    const qrString = Buffer.from(JSON.stringify(qrData)).toString('base64');
    
    await updateDoc(memberRef, {
      qrCode: qrString,
      updatedAt: serverTimestamp()
    });
    
    return qrString;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Obtener todas las membresías de un socio
export const getMemberMemberships = async (gymId: string, memberId: string): Promise<MembershipAssignment[]> => {
  try {
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    const querySnapshot = await getDocs(membershipsRef);
    
    const memberships: MembershipAssignment[] = [];
    querySnapshot.forEach(doc => {
      memberships.push({
        id: doc.id,
        ...doc.data()
      } as MembershipAssignment);
    });
    
    return memberships.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error getting member memberships:', error);
    throw error;
  }
};

// Actualizar un miembro
export const updateMember = async (gymId: string, memberId: string, memberData: MemberFormData): Promise<boolean> => {
  try {
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    
    let photoUrl = undefined;
    if (memberData.photo instanceof File) {
      try {
        photoUrl = await uploadToCloudinary(memberData.photo, "gym_member_photos");
      } catch (uploadError) {
        console.error("Error subiendo nueva foto:", uploadError);
      }
    }
    
    let birthDateToSave = '';
    if (memberData.birthDate) {
      birthDateToSave = memberData.birthDate;
    }
    
    const updateData: any = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address || "",
      birthDate: birthDateToSave,
      status: memberData.status,
      updatedAt: serverTimestamp()
    };
    
    if (photoUrl !== undefined) {
      updateData.photo = photoUrl;
    }
    
    await updateDoc(memberRef, updateData);
    
    return true;
  } catch (error) {
    console.error('Error updating member:', error);
    throw error;
  }
};

// Obtener miembros recientes
export const getRecentMembers = async (gymId: string, limit: number = 5): Promise<Member[]> => {
  try {
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const q = query(
      membersRef,
      orderBy('createdAt', 'desc'),
      limitQuery(limit)
    );
    
    const querySnapshot = await getDocs(q);
    
    const members: Member[] = [];
    querySnapshot.forEach(doc => {
      members.push({
        id: doc.id,
        ...doc.data()
      } as Member);
    });
    
    return members;
  } catch (error) {
    console.error('Error getting recent members:', error);
    throw error;
  }
};

// Obtener miembros con cumpleaños próximos
export const getMembersWithUpcomingBirthdays = async (
  gymId: string, 
  daysAhead: number = 30,
  limit: number = 5
): Promise<Member[]> => {
  try {
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const querySnapshot = await getDocs(membersRef);
    
    const today = new Date();
    const members: Member[] = [];
    
    querySnapshot.forEach(doc => {
      const member = { id: doc.id, ...doc.data() } as Member;
      
      let birthDate: Date | null = null;
      
      if (member.birthDate) {
        if (typeof member.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(member.birthDate)) {
          const [year, month, day] = member.birthDate.split('-').map(Number);
          birthDate = new Date(year, month - 1, day);
        } else {
          const convertedDate = safelyConvertToDate(member.birthDate);
          if (convertedDate) {
            birthDate = new Date(
              convertedDate.getFullYear(),
              convertedDate.getMonth(),
              convertedDate.getDate()
            );
          }
        }
      }
      
      if (!birthDate) return;
      
      const thisYear = today.getFullYear();
      const birthMonth = birthDate.getMonth();
      const birthDay = birthDate.getDate();
      
      const thisYearBirthday = new Date(thisYear, birthMonth, birthDay);
      
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(thisYear + 1);
      }

      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= daysAhead) {
        members.push({
          ...member,
          daysUntilBirthday: diffDays
        } as Member);
      }
    });
    
    members.sort((a, b) => (a as any).daysUntilBirthday - (b as any).daysUntilBirthday);
    
    return members.slice(0, limit);
  } catch (error) {
    console.error('Error getting members with upcoming birthdays:', error);
    throw error;
  }
};

// Obtener membresías vencidas o por vencer
export const getExpiredMemberships = async (
  gymId: string,
  limit: number = 5
): Promise<MembershipAssignment[]> => {
  try {
    const members: Member[] = [];
    const expiredMemberships: MembershipAssignment[] = [];
    
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    membersSnapshot.forEach(doc => {
      members.push({
        id: doc.id,
        ...doc.data()
      } as Member);
    });
    
    const today = new Date();
    
    for (const member of members) {
      const membershipsRef = collection(db, `gyms/${gymId}/members/${member.id}/memberships`);
      const q = query(membershipsRef, where('status', '==', 'active'));
      const membershipsSnapshot = await getDocs(q);
      
      membershipsSnapshot.forEach(doc => {
        const membership = { id: doc.id, ...doc.data() } as MembershipAssignment;
        
        const endDate = safelyConvertToDate(membership.endDate);
        
        if (endDate && endDate < today) {
          expiredMemberships.push({
            ...membership,
            memberName: `${member.firstName} ${member.lastName}`
          });
        }
      });
    }
    
    expiredMemberships.sort((a, b) => {
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
    
    return expiredMemberships.slice(0, limit);
  } catch (error) {
    console.error('Error getting expired memberships:', error);
    throw error;
  }
};

export default {
  addMember,
  assignMembership,
  deleteMembership,
  generateMemberQR,
  getMemberMemberships,
  updateMember,
  getRecentMembers,
  getMembersWithUpcomingBirthdays,
  getExpiredMemberships
};