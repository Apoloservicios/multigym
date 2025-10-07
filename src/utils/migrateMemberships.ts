import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipStatus } from '../types/monthlyPayments.types';

export const migrateMembershipsToNewSystem = async (gymId: string) => {
  console.log('🔄 Iniciando migración...');
  
  try {
    // 1. Obtener todos los socios
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnap = await getDocs(membersRef);
    
    let migrated = 0;
    
    for (const memberDoc of membersSnap.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      const memberName = `${memberData.firstName} ${memberData.lastName}`;
      
      // 2. Obtener membresías viejas (membershipAssignments o como las tengas)
      const oldMembershipsRef = collection(
        db, 
        `gyms/${gymId}/membershipAssignments`
      );
      const oldMembershipsSnap = await getDocs(oldMembershipsRef);
      
      for (const oldMemDoc of oldMembershipsSnap.docs) {
        const oldMem = oldMemDoc.data();
        
        // Solo procesar las del socio actual
        if (oldMem.memberId !== memberId) continue;
        
        // 3. Crear nueva estructura
        const newMembership: MembershipStatus = {
          memberId,
          memberName,
          activityId: oldMem.activityId,
          activityName: oldMem.activityName,
          startDate: oldMem.startDate,
          status: oldMem.status === 'cancelled' ? 'suspended' : 'active',
          autoGeneratePayments: true,
          createdAt: Timestamp.now()
        };
        
        // 4. Guardar en la nueva ubicación
        const newMembershipRef = doc(
          collection(db, `gyms/${gymId}/members/${memberId}/memberships`)
        );
        
        await setDoc(newMembershipRef, newMembership);
        migrated++;
        
        console.log(`✅ Migrada: ${memberName} - ${oldMem.activityName}`);
      }
    }
    
    console.log(`🎉 Migración completa: ${migrated} membresías`);
    return { success: true, migrated };
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    return { success: false, error };
  }
};