// src/services/member.service.ts
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
import { Transaction } from '../types/gym.types';
import { registerExtraIncome, registerExpense } from './dailyCash.service';
import { formatDate } from '../utils/date.utils';

/**
 * Función auxiliar para convertir cualquier tipo de fecha a un objeto Date
 */
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
      // Si es un objeto timestamp de Firebase con método toDate
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      } 
      // Si es un objeto Date directamente
      else if (dateValue instanceof Date) {
        return dateValue;
      }
      // Si es un objeto con timestamp en segundos
      else if (dateValue.seconds !== undefined) {
        return new Date(dateValue.seconds * 1000);
      }
    }

    // Intentar convertir directamente
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
    console.log("Iniciando proceso de agregar miembro con datos:", JSON.stringify({
      ...memberData,
      photo: memberData.photo ? `[File: ${memberData.photo.name}]` : null
    }));
    
    const membersRef = collection(db, `gyms/${gymId}/members`);
    
    // Si hay foto, intentamos subirla primero
    let photoUrl = null;
    if (memberData.photo) {
      try {
        console.log("Intentando subir foto a Cloudinary...");
        // La ruta de la carpeta debe ser consistente con tu estructura en Cloudinary
        photoUrl = await uploadToCloudinary(memberData.photo, "gym_member_photos");
        console.log("Foto subida exitosamente:", photoUrl);
      } catch (uploadError) {
        console.error("Error subiendo foto:", uploadError);
        // Si falla la carga de la foto, continuamos sin ella
      }
    }
    
    // Datos del nuevo miembro
    const newMember = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address || "",
      birthDate: memberData.birthDate || "",
      photo: photoUrl,
      status: memberData.status,
      totalDebt: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("Guardando miembro con datos:", JSON.stringify({
      ...newMember,
      createdAt: "timestamp",
      updatedAt: "timestamp"
    }));
    
    // Agregar a Firestore
    const docRef = await addDoc(membersRef, newMember);
    
    console.log("Miembro creado con ID:", docRef.id);
    
    return { 
      id: docRef.id, 
      ...newMember,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Member;
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
    console.log("Asignando membresía:", membershipData);
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    
    // Asegurar que los nuevos campos tengan valores por defecto
    const membershipWithDefaults = {
      ...membershipData,
      autoRenewal: membershipData.autoRenewal !== undefined ? membershipData.autoRenewal : false,
      paymentFrequency: membershipData.paymentFrequency || 'single',
      createdAt: serverTimestamp()
    };
    
    // Agregar membresía
    const docRef = await addDoc(membershipsRef, membershipWithDefaults);
    
    // Si la membresía tiene un costo y está pendiente, agregar a la deuda del socio
    if (membershipData.cost > 0 && membershipData.paymentStatus === 'pending') {
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        const currentDebt = memberSnap.data().totalDebt || 0;
        await updateDoc(memberRef, {
          totalDebt: currentDebt + membershipData.cost,
          updatedAt: serverTimestamp()
        });
        console.log("Deuda actualizada a:", currentDebt + membershipData.cost);
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
    // Obtener datos del miembro
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      throw new Error('El socio no existe');
    }
    
    const memberData = memberSnap.data() as Member;
    
    // Obtener datos de la membresía
    const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships`, membershipId);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      throw new Error('La membresía no existe');
    }

    const membershipData = membershipSnap.data() as MembershipAssignment;
    
    // Verificar el estado actual de la membresía
    if (membershipData.status === 'cancelled') {
      throw new Error('Esta membresía ya ha sido cancelada previamente');
    }

    // Si la membresía estaba pagada y se solicita reintegro
    if (withRefund && membershipData.paymentStatus === 'paid') {
      // Obtener la fecha actual
      const today = new Date().toISOString().split('T')[0];
      
      // Registrar el reintegro como un egreso en la caja diaria
      const refundResult = await registerExpense(gymId, {
        amount: membershipData.cost,
        description: `Reintegro por cancelación de membresía: ${membershipData.activityName} para ${memberData.firstName} ${memberData.lastName}`,
        paymentMethod: 'cash', // Por defecto, aunque podría ser un parámetro
        date: today,
        userId: 'system', // Idealmente debería ser el ID del usuario que realiza la acción
        userName: 'Sistema', // Idealmente debería ser el nombre del usuario
        category: 'refund',
        notes: `Reintegro por cancelación de membresía ID: ${membershipId}`
      });
      
      if (!refundResult.success) {
        throw new Error('Error al registrar el reintegro: ' + refundResult.error);
      }
      
      console.log('Reintegro registrado correctamente en caja diaria');
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
    
    // Generar datos para el QR
    const qrData = {
      gymId,
      memberId,
      timestamp: new Date().getTime()
    };
    
    // Convertir a string seguro para QR
    const qrString = Buffer.from(JSON.stringify(qrData)).toString('base64');
    
    // Actualizar el registro del socio con la cadena de QR
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
    
    // Ordenar por estado (activas primero) y fecha de finalización (más recientes primero)
    return memberships.sort((a, b) => {
      // Primero ordenar por estado (activas primero)
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // Si ambas tienen el mismo estado, ordenar por fecha de finalización (más recientes primero)
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

export const updateMember = async (gymId: string, memberId: string, memberData: MemberFormData): Promise<boolean> => {
  try {
    console.log("Iniciando actualización de miembro:", memberId);
    
    const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
    
    // Si hay una nueva foto, subirla
    let photoUrl = undefined; // undefined significa que no se actualiza este campo
    if (memberData.photo instanceof File) {
      try {
        console.log("Intentando subir nueva foto...");
        photoUrl = await uploadToCloudinary(memberData.photo, "gym_member_photos");
        console.log("Nueva foto subida:", photoUrl);
      } catch (uploadError) {
        console.error("Error subiendo nueva foto:", uploadError);
        // Si falla, continuamos sin actualizar la foto
      }
    }
    
    // Preparar datos para actualizar
    const updateData: any = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address || "",
      birthDate: memberData.birthDate || "",
      status: memberData.status,
      updatedAt: serverTimestamp()
    };
    
    // Solo actualizar la foto si se subió exitosamente
    if (photoUrl !== undefined) {
      updateData.photo = photoUrl;
    }
    
    console.log("Actualizando miembro con datos:", JSON.stringify({
      ...updateData,
      updatedAt: "timestamp"
    }));
    
    // Actualizar en Firestore
    await updateDoc(memberRef, updateData);
    
    console.log("Miembro actualizado exitosamente");
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
// Función auxiliar para convertir fechas de forma segura


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
      
      const birthDate = safelyConvertToDate(member.birthDate);
      if (!birthDate) return; // Saltar si no se pudo convertir
      
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
    
    // Primero obtenemos todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    membersSnapshot.forEach(doc => {
      members.push({
        id: doc.id,
        ...doc.data()
      } as Member);
    });
    
    // Obtener la fecha actual
    const today = new Date();
    
    // Para cada miembro, buscar sus membresías
    for (const member of members) {
      const membershipsRef = collection(db, `gyms/${gymId}/members/${member.id}/memberships`);
      const q = query(membershipsRef, where('status', '==', 'active'));
      const membershipsSnapshot = await getDocs(q);
      
      membershipsSnapshot.forEach(doc => {
        const membership = { id: doc.id, ...doc.data() } as MembershipAssignment;
        
        // Verificar si la membresía ya está vencida
        // Usar nuestra función auxiliar para convertir la fecha de manera segura
        const endDate = safelyConvertToDate(membership.endDate);
        
        // Solo procesamos si pudimos convertir la fecha correctamente
        if (endDate && endDate < today) {
          // Agregar el nombre del miembro para mostrar
          expiredMemberships.push({
            ...membership,
            memberName: `${member.firstName} ${member.lastName}`
          });
        }
      });
    }
    
    // Ordenar por fecha de vencimiento (más antiguas primero)
    expiredMemberships.sort((a, b) => {
      // Convertir cada fecha para la comparación de manera segura
      const dateA = safelyConvertToDate(a.endDate);
      const dateB = safelyConvertToDate(b.endDate);
      
      // Si alguna fecha es null, ponerla al final
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
    
    // Limitar la cantidad de resultados
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