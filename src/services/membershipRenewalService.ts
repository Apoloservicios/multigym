// src/services/membershipRenewalService.ts
// 🚀 SERVICIO CENTRAL UNIFICADO - RENOVACIÓN DE MEMBRESÍAS
// Este servicio reemplaza todos los intentos anteriores y centraliza la lógica

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  addDoc,
  writeBatch,
  Timestamp,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==========================================
// TIPOS E INTERFACES
// ==========================================

export interface MembershipToRenew {
  id: string;
  memberId: string;
  memberName: string;
  activityId: string;
  activityName: string;
  currentCost: number;
  endDate: Date;
  autoRenewal: boolean;
  status: string;
  maxAttendances: number;
  currentAttendances?: number;
}

export interface RenewalResult {
  success: boolean;
  renewedCount: number;
  errorCount: number;
  renewedMemberships: MembershipToRenew[];
  errorMemberships: { membership: MembershipToRenew; error: string }[];
  totalProcessed: number;
}

export interface RenewalStats {
  totalMemberships: number;
  withAutoRenewal: number;
  expired: number;
  expiringSoon: number;
  renewedThisMonth: number;
}

// ==========================================
// CLASE PRINCIPAL DEL SERVICIO
// ==========================================

class MembershipRenewalService {
  
  /**
   * 🔍 Obtener todas las membresías que necesitan renovación
   */
  async getMembershipsNeedingRenewal(gymId: string): Promise<MembershipToRenew[]> {
    console.log('🔍 Buscando membresías para renovar en gimnasio:', gymId);
    
    try {
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const membershipsToRenew: MembershipToRenew[] = [];
      const now = new Date();
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        // Solo procesar socios activos
        if (memberData.status !== 'active') continue;
        
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          // Solo procesar membresías con auto-renovación habilitada
          if (!membershipData.autoRenewal) continue;
          
          const endDate = membershipData.endDate?.toDate 
            ? membershipData.endDate.toDate() 
            : new Date(membershipData.endDate);
          
          // Verificar si está vencida (considerando hasta 7 días de gracia)
          const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
          const isExpired = (now.getTime() - endDate.getTime()) > gracePeriod;
          
          if (isExpired && membershipData.status === 'active') {
            const membershipToRenew: MembershipToRenew = {
              id: membershipDoc.id,
              memberId: memberDoc.id,
              memberName: `${memberData.firstName} ${memberData.lastName}`,
              activityId: membershipData.activityId,
              activityName: membershipData.activityName,
              currentCost: membershipData.cost || 0,
              endDate: endDate,
              autoRenewal: membershipData.autoRenewal,
              status: membershipData.status,
              maxAttendances: membershipData.maxAttendances || 0,
              currentAttendances: membershipData.currentAttendances || 0
            };
            
            membershipsToRenew.push(membershipToRenew);
          }
        }
      }
      
      console.log(`📊 Encontradas ${membershipsToRenew.length} membresías para renovar`);
      return membershipsToRenew;
      
    } catch (error) {
      console.error('❌ Error obteniendo membresías para renovar:', error);
      throw new Error(`Error al buscar membresías: ${error}`);
    }
  }

  /**
   * 🔄 Renovar una membresía individual
   */
  async renewSingleMembership(
    gymId: string, 
    membership: MembershipToRenew,
    newPrice?: number
  ): Promise<{ success: boolean; error?: string; newMembershipId?: string }> {
    
    console.log(`🔄 Renovando membresía: ${membership.memberName} - ${membership.activityName}`);
    
    try {
      // 1. Obtener el precio actual de la actividad
      let finalPrice = membership.currentCost;
      
      if (newPrice !== undefined) {
        finalPrice = newPrice;
      } else {
        // Consultar precio actual de la actividad
        const activityDoc = await getDoc(doc(db, `gyms/${gymId}/activities`, membership.activityId));
        if (activityDoc.exists()) {
          const activityData = activityDoc.data();
          finalPrice = activityData.price || membership.currentCost;
        }
      }
      
      // 2. Calcular nueva fecha de vencimiento (30 días desde hoy)
      const newStartDate = new Date();
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 30);
      
      // 3. Crear la nueva membresía
      const newMembershipData = {
        memberId: membership.memberId,
        activityId: membership.activityId,
        activityName: membership.activityName,
        startDate: Timestamp.fromDate(newStartDate),
        endDate: Timestamp.fromDate(newEndDate),
        cost: finalPrice,
        paymentStatus: 'pending', // Nueva membresía siempre empieza como pendiente
        status: 'active',
        maxAttendances: membership.maxAttendances,
        currentAttendances: 0, // Reiniciar contador
        autoRenewal: true, // Mantener auto-renovación
        renewedAutomatically: true,
        previousMembershipId: membership.id,
        renewalDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // 4. Guardar nueva membresía
      const newMembershipRef = await addDoc(
        collection(db, `gyms/${gymId}/members/${membership.memberId}/memberships`),
        newMembershipData
      );
      
      // 5. Actualizar membresía anterior (marcar como renovada)
      await updateDoc(
        doc(db, `gyms/${gymId}/members/${membership.memberId}/memberships`, membership.id),
        {
          status: 'expired',
          renewedAutomatically: true,
          renewedToMembershipId: newMembershipRef.id,
          renewalProcessedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );
      
      // 6. Crear registro de transacción para la nueva membresía
      await this.createRenewalTransaction(gymId, membership, finalPrice, newMembershipRef.id);
      
      console.log(`✅ Membresía renovada exitosamente: ${membership.memberName} - ${membership.activityName}`);
      
      return { 
        success: true, 
        newMembershipId: newMembershipRef.id 
      };
      
    } catch (error) {
      console.error(`❌ Error renovando membresía individual:`, error);
      return { 
        success: false, 
        error: `Error al renovar: ${error}` 
      };
    }
  }

  /**
   * 🔄 Procesar todas las renovaciones automáticas
   */
  async processAllAutoRenewals(
    gymId: string,
    onProgress?: (current: number, total: number, currentItem: string) => void
  ): Promise<RenewalResult> {
    
    console.log('🚀 Iniciando proceso masivo de renovaciones automáticas');
    
    try {
      // 1. Obtener todas las membresías que necesitan renovación
      const membershipsToRenew = await this.getMembershipsNeedingRenewal(gymId);
      
      if (membershipsToRenew.length === 0) {
        console.log('ℹ️ No hay membresías pendientes de renovación');
        return {
          success: true,
          renewedCount: 0,
          errorCount: 0,
          renewedMemberships: [],
          errorMemberships: [],
          totalProcessed: 0
        };
      }
      
      const renewedMemberships: MembershipToRenew[] = [];
      const errorMemberships: { membership: MembershipToRenew; error: string }[] = [];
      
      // 2. Procesar cada membresía individualmente
      for (let i = 0; i < membershipsToRenew.length; i++) {
        const membership = membershipsToRenew[i];
        
        // Reportar progreso
        if (onProgress) {
          onProgress(i + 1, membershipsToRenew.length, `${membership.memberName} - ${membership.activityName}`);
        }
        
        try {
          const result = await this.renewSingleMembership(gymId, membership);
          
          if (result.success) {
            renewedMemberships.push(membership);
          } else {
            errorMemberships.push({ 
              membership, 
              error: result.error || 'Error desconocido' 
            });
          }
          
          // Pequeña pausa para no saturar Firebase
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error procesando ${membership.memberName}:`, error);
          errorMemberships.push({ 
            membership, 
            error: `Error inesperado: ${error}` 
          });
        }
      }
      
      // 3. Crear resumen del proceso
      const result: RenewalResult = {
        success: true,
        renewedCount: renewedMemberships.length,
        errorCount: errorMemberships.length,
        renewedMemberships,
        errorMemberships,
        totalProcessed: membershipsToRenew.length
      };
      
      console.log(`🎉 Proceso completado: ${result.renewedCount} renovadas, ${result.errorCount} errores`);
      
      // 4. Guardar registro del proceso
      await this.saveProcessLog(gymId, result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en proceso masivo de renovaciones:', error);
      throw new Error(`Error en proceso masivo: ${error}`);
    }
  }

  /**
   * 💰 Crear transacción de renovación
   */
  private async createRenewalTransaction(
    gymId: string,
    membership: MembershipToRenew,
    amount: number,
    newMembershipId: string
  ): Promise<void> {
    try {
      const transactionData = {
        memberId: membership.memberId,
        memberName: membership.memberName,
        type: 'membership_renewal',
        amount: amount,
        description: `Renovación automática - ${membership.activityName}`,
        paymentMethod: 'auto_renewal',
        status: 'pending',
        membershipId: newMembershipId,
        previousMembershipId: membership.id,
        activityId: membership.activityId,
        activityName: membership.activityName,
        isAutoRenewal: true,
        createdAt: serverTimestamp(),
        date: serverTimestamp()
      };
      
      await addDoc(collection(db, `gyms/${gymId}/transactions`), transactionData);
      console.log(`💰 Transacción de renovación creada para ${membership.memberName}`);
      
    } catch (error) {
      console.error('❌ Error creando transacción de renovación:', error);
      // No lanzar error aquí porque la renovación ya se completó
    }
  }

  /**
   * 📝 Guardar log del proceso
   */
  private async saveProcessLog(gymId: string, result: RenewalResult): Promise<void> {
    try {
      const logData = {
        processDate: serverTimestamp(),
        totalProcessed: result.totalProcessed,
        renewedCount: result.renewedCount,
        errorCount: result.errorCount,
        renewedMemberships: result.renewedMemberships.map(m => ({
          memberId: m.memberId,
          memberName: m.memberName,
          activityName: m.activityName,
          cost: m.currentCost
        })),
        errors: result.errorMemberships.map(e => ({
          memberName: e.membership.memberName,
          activityName: e.membership.activityName,
          error: e.error
        })),
        processType: 'automatic_renewal',
        success: result.success
      };
      
      await addDoc(collection(db, `gyms/${gymId}/renewal_logs`), logData);
      console.log('📝 Log del proceso guardado');
      
    } catch (error) {
      console.error('❌ Error guardando log del proceso:', error);
    }
  }

  /**
   * 📊 Obtener estadísticas de renovación
   */
  async getRenewalStats(gymId: string): Promise<RenewalStats> {
    console.log('📊 Calculando estadísticas de renovación');
    
    try {
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      let totalMemberships = 0;
      let withAutoRenewal = 0;
      let expired = 0;
      let expiringSoon = 0;
      let renewedThisMonth = 0;
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        if (memberData.status !== 'active') continue;
        
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          if (membershipData.status === 'active') {
            totalMemberships++;
            
            if (membershipData.autoRenewal) {
              withAutoRenewal++;
            }
            
            const endDate = membershipData.endDate?.toDate 
              ? membershipData.endDate.toDate() 
              : new Date(membershipData.endDate);
            
            if (endDate < now) {
              expired++;
            } else if (endDate <= oneWeekFromNow) {
              expiringSoon++;
            }
            
            if (membershipData.renewedAutomatically && 
                membershipData.renewalDate?.toDate &&
                membershipData.renewalDate.toDate() >= startOfMonth) {
              renewedThisMonth++;
            }
          }
        }
      }
      
      const stats: RenewalStats = {
        totalMemberships,
        withAutoRenewal,
        expired,
        expiringSoon,
        renewedThisMonth
      };
      
      console.log('📊 Estadísticas calculadas:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error calculando estadísticas:', error);
      throw new Error(`Error calculando estadísticas: ${error}`);
    }
  }
}

// Exportar instancia única del servicio
export const membershipRenewalService = new MembershipRenewalService();

// Exportar también funciones individuales para compatibilidad
export const getMembershipsNeedingRenewal = (gymId: string) => 
  membershipRenewalService.getMembershipsNeedingRenewal(gymId);

export const renewSingleMembership = (gymId: string, membership: MembershipToRenew, newPrice?: number) =>
  membershipRenewalService.renewSingleMembership(gymId, membership, newPrice);

export const processAllAutoRenewals = (
  gymId: string, 
  onProgress?: (current: number, total: number, currentItem: string) => void
) => membershipRenewalService.processAllAutoRenewals(gymId, onProgress);

export const getRenewalStats = (gymId: string) => 
  membershipRenewalService.getRenewalStats(gymId);