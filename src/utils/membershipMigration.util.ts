// src/utils/membershipMigration.util.ts
// 🔧 UTILIDAD PARA MIGRAR DATOS EXISTENTES AL NUEVO SISTEMA
// Ejecutar UNA SOLA VEZ para limpiar y preparar datos existentes

import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class MembershipMigrationUtil {
  
  /**
   * 🔄 Migrar membresías existentes al nuevo formato
   */
  static async migrateMembershipsToNewSystem(gymId: string): Promise<void> {
    console.log('🔄 Iniciando migración de membresías al nuevo sistema...');
    
    try {
      const batch = writeBatch(db);
      let updateCount = 0;
      
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      for (const memberDoc of membersSnapshot.docs) {
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          // Preparar actualizaciones
          const updates: any = {
            updatedAt: new Date()
          };
          
          // Asegurar que tenga autoRenewal definido
          if (membershipData.autoRenewal === undefined) {
            updates.autoRenewal = false; // Por defecto false para membresías existentes
          }
          
          // Asegurar que tenga campos de renovación
          if (!membershipData.renewedAutomatically) {
            updates.renewedAutomatically = false;
          }
          
          if (!membershipData.renewedManually) {
            updates.renewedManually = false;
          }
          
          // Corregir estados inconsistentes
          if (membershipData.status === 'expired' && membershipData.autoRenewal) {
            // Marcar para posible renovación automática
            updates.needsRenewalReview = true;
          }
          
          // Asegurar que currentAttendances exista
          if (membershipData.currentAttendances === undefined) {
            updates.currentAttendances = 0;
          }
          
          const membershipRef = doc(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`, membershipDoc.id);
          batch.update(membershipRef, updates);
          updateCount++;
          
          // Commit en lotes de 500
          if (updateCount % 500 === 0) {
            await batch.commit();
            console.log(`✅ Migradas ${updateCount} membresías...`);
          }
        }
      }
      
      // Commit final
      if (updateCount % 500 !== 0) {
        await batch.commit();
      }
      
      console.log(`✅ Migración completada: ${updateCount} membresías actualizadas`);
      
    } catch (error) {
      console.error('❌ Error en migración:', error);
      throw new Error(`Error en migración: ${error}`);
    }
  }
  
  /**
   * 🧹 Limpiar datos inconsistentes
   */
  static async cleanInconsistentData(gymId: string): Promise<void> {
    console.log('🧹 Limpiando datos inconsistentes...');
    
    try {
      // Limpiar membresías duplicadas o huérfanas
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      for (const memberDoc of membersSnapshot.docs) {
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const activeMemberships = [];
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          if (membershipData.status === 'active') {
            activeMemberships.push({
              id: membershipDoc.id,
              data: membershipData
            });
          }
        }
        
        // Si hay múltiples membresías activas de la misma actividad, mantener solo la más reciente
        const groupedByActivity: Record<string, any[]> = {};
        
        for (const membership of activeMemberships) {
          const activityId = membership.data.activityId || 'general';
          if (!groupedByActivity[activityId]) {
            groupedByActivity[activityId] = [];
          }
          groupedByActivity[activityId].push(membership);
        }
        
        for (const activityId in groupedByActivity) {
          const memberships = groupedByActivity[activityId];
          
          if (memberships.length > 1) {
            // Ordenar por fecha de creación, mantener la más reciente
            memberships.sort((a, b) => {
              const dateA = a.data.createdAt?.toDate ? a.data.createdAt.toDate() : new Date(a.data.createdAt || 0);
              const dateB = b.data.createdAt?.toDate ? b.data.createdAt.toDate() : new Date(b.data.createdAt || 0);
              return dateB.getTime() - dateA.getTime();
            });
            
            // Marcar las demás como duplicadas
            for (let i = 1; i < memberships.length; i++) {
              const membershipRef = doc(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`, memberships[i].id);
              await updateDoc(membershipRef, {
                status: 'cancelled',
                cancellationReason: 'Duplicado - limpieza automática',
                cancelledAt: new Date(),
                updatedAt: new Date()
              });
              
              console.log(`🗑️ Marcado como duplicado: ${memberships[i].data.activityName} para ${memberDoc.id}`);
            }
          }
        }
      }
      
      console.log('✅ Limpieza de datos inconsistentes completada');
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
      throw new Error(`Error en limpieza: ${error}`);
    }
  }
}