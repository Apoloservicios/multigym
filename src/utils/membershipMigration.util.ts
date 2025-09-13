// UTILIDAD DE MIGRACIÓN DE DATOS
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class MembershipMigrationUtil {
  /**
   * Migrar membresías al nuevo sistema con auto-renovación
   */
  static async migrateMembershipsToNewSystem(gymId: string): Promise<void> {
    console.log('🔄 Iniciando migración de membresías...');
    
    try {
      const batch = writeBatch(db);
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const snapshot = await getDocs(membershipsRef);
      
      let count = 0;
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, `gyms/${gymId}/memberships`, docSnapshot.id);
        
        // Agregar campos nuevos si no existen
        const updates: any = {};
        
        if (data.autoRenewal === undefined) {
          updates.autoRenewal = false; // Por defecto desactivado
        }
        
        if (data.renewalCount === undefined) {
          updates.renewalCount = 0;
        }
        
        if (data.lastRenewalDate === undefined) {
          updates.lastRenewalDate = null;
        }
        
        if (data.paymentFrequency === undefined) {
          updates.paymentFrequency = 'monthly';
        }
        
        // Solo actualizar si hay cambios
        if (Object.keys(updates).length > 0) {
          batch.update(docRef, updates);
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Migración completada: ${count} membresías actualizadas`);
      } else {
        console.log('ℹ️ No hay membresías que migrar');
      }
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  }

  /**
   * Limpiar datos inconsistentes
   */
  static async cleanInconsistentData(gymId: string): Promise<void> {
    console.log('🧹 Limpiando datos inconsistentes...');
    
    try {
      const batch = writeBatch(db);
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const snapshot = await getDocs(membershipsRef);
      
      let cleanedCount = 0;
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, `gyms/${gymId}/memberships`, docSnapshot.id);
        const updates: any = {};
        
        // Corregir fechas inválidas
        if (data.endDate && !data.endDate.toDate) {
          try {
            updates.endDate = Timestamp.fromDate(new Date(data.endDate));
          } catch (e) {
            console.warn(`Fecha inválida en membresía ${docSnapshot.id}`);
          }
        }
        
        if (data.startDate && !data.startDate.toDate) {
          try {
            updates.startDate = Timestamp.fromDate(new Date(data.startDate));
          } catch (e) {
            console.warn(`Fecha inválida en membresía ${docSnapshot.id}`);
          }
        }
        
        // Corregir estados inválidos
        if (data.status && !['active', 'inactive', 'expired'].includes(data.status)) {
          updates.status = 'inactive';
        }
        
        // Aplicar actualizaciones si hay cambios
        if (Object.keys(updates).length > 0) {
          batch.update(docRef, updates);
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        await batch.commit();
        console.log(`✅ Limpieza completada: ${cleanedCount} registros corregidos`);
      } else {
        console.log('ℹ️ No hay datos inconsistentes');
      }
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
      throw error;
    }
  }

  /**
   * Verificar integridad de datos
   */
  static async verifyDataIntegrity(gymId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    console.log('🔍 Verificando integridad de datos...');
    
    const issues: string[] = [];
    
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const activitiesRef = collection(db, `gyms/${gymId}/activities`);
      
      const [membershipsSnapshot, membersSnapshot, activitiesSnapshot] = await Promise.all([
        getDocs(membershipsRef),
        getDocs(membersRef),
        getDocs(activitiesRef)
      ]);
      
      // Crear mapas de IDs válidos
      const validMemberIds = new Set();
      membersSnapshot.forEach(doc => validMemberIds.add(doc.id));
      
      const validActivityIds = new Set();
      activitiesSnapshot.forEach(doc => validActivityIds.add(doc.id));
      
      // Verificar cada membresía
      membershipsSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Verificar que el socio existe
        if (!validMemberIds.has(data.memberId)) {
          issues.push(`Membresía ${doc.id} tiene un socio inválido: ${data.memberId}`);
        }
        
        // Verificar que la actividad existe
        if (!validActivityIds.has(data.activityId)) {
          issues.push(`Membresía ${doc.id} tiene una actividad inválida: ${data.activityId}`);
        }
        
        // Verificar campos requeridos
        if (!data.startDate) {
          issues.push(`Membresía ${doc.id} no tiene fecha de inicio`);
        }
        
        if (!data.endDate) {
          issues.push(`Membresía ${doc.id} no tiene fecha de vencimiento`);
        }
        
        if (data.cost === undefined || data.cost === null) {
          issues.push(`Membresía ${doc.id} no tiene precio definido`);
        }
      });
      
      const valid = issues.length === 0;
      
      if (valid) {
        console.log('✅ Integridad de datos verificada correctamente');
      } else {
        console.log(`⚠️ Se encontraron ${issues.length} problemas de integridad`);
        issues.forEach(issue => console.log(`  - ${issue}`));
      }
      
      return { valid, issues };
      
    } catch (error) {
      console.error('❌ Error verificando integridad:', error);
      throw error;
    }
  }
}