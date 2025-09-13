// SERVICIO CENTRAL DE RENOVACIONES - CORREGIDO
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentDateInArgentina } from '../utils/timezone.utils';

interface RenewalResult {
  success: boolean;
  renewedCount: number;
  errorCount: number;
  errors: string[];
  totalProcessed: number;
  renewedMemberships: any[];
  errorMemberships: any[];
  timestamp: Date;
}

interface RenewalStats {
  totalMemberships: number;
  withAutoRenewal: number;
  expired: number;
  expiringSoon: number;
  renewedThisMonth: number;
}

class MembershipRenewalService {
  /**
   * Obtener estadísticas de renovación
   */
  async getRenewalStats(gymId: string): Promise<RenewalStats> {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const snapshot = await getDocs(membershipsRef);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let stats: RenewalStats = {
        totalMemberships: 0,
        withAutoRenewal: 0,
        expired: 0,
        expiringSoon: 0,
        renewedThisMonth: 0
      };
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        stats.totalMemberships++;
        
        if (data.autoRenewal) {
          stats.withAutoRenewal++;
        }
        
        const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
        
        if (endDate < now) {
          stats.expired++;
        } else if (endDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          stats.expiringSoon++;
        }
        
        if (data.lastRenewalDate?.toDate) {
          const renewalDate = data.lastRenewalDate.toDate();
          if (renewalDate >= startOfMonth) {
            stats.renewedThisMonth++;
          }
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Obtener membresías que necesitan renovación
   */
  async getMembershipsNeedingRenewal(gymId: string): Promise<any[]> {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const q = query(
        membershipsRef,
        where('autoRenewal', '==', true),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();
      const memberships: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
        
        // Solo incluir si ya está vencida
        if (endDate < now) {
          memberships.push({
            id: doc.id,
            ...data,
            endDate: endDate
          });
        }
      });
      
      return memberships.sort((a, b) => a.endDate - b.endDate);
    } catch (error) {
      console.error('Error obteniendo membresías para renovar:', error);
      throw error;
    }
  }

  /**
   * Procesar renovación individual
   */
  async renewMembership(gymId: string, membershipId: string, duration: number = 30): Promise<any> {
    try {
      // 1. Obtener membresía actual
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      const membershipSnapshot = await getDocs(query(collection(db, `gyms/${gymId}/memberships`), where('__name__', '==', membershipId)));
      
      if (membershipSnapshot.empty) {
        throw new Error('Membresía no encontrada');
      }
      
      const currentMembership = membershipSnapshot.docs[0].data();
      
      // 2. Obtener precio actual de la actividad
      const activityRef = doc(db, `gyms/${gymId}/activities`, currentMembership.activityId);
      const activitySnapshot = await getDocs(query(collection(db, `gyms/${gymId}/activities`), where('__name__', '==', currentMembership.activityId)));
      
      if (activitySnapshot.empty) {
        throw new Error('Actividad no encontrada');
      }
      
      const activity = activitySnapshot.docs[0].data();
      const newPrice = activity.price || currentMembership.cost;
      
      // 3. Calcular nuevas fechas
      const now = new Date();
      const newStartDate = now;
      const newEndDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      
      // 4. Actualizar membresía existente
      await updateDoc(membershipRef, {
        startDate: Timestamp.fromDate(newStartDate),
        endDate: Timestamp.fromDate(newEndDate),
        cost: newPrice,
        lastRenewalDate: serverTimestamp(),
        renewalCount: (currentMembership.renewalCount || 0) + 1,
        status: 'active',
        paymentStatus: 'pending', // Siempre marcar como pendiente
        updatedAt: serverTimestamp()
      });
      
      // 5. Crear transacción de pago pendiente
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      await addDoc(transactionsRef, {
        memberId: currentMembership.memberId,
        memberName: currentMembership.memberName,
        type: 'income',
        category: 'membership',
        amount: newPrice,
        description: `Renovación de membresía - ${activity.name}`,
        date: serverTimestamp(),
        paymentMethod: 'pending',
        status: 'pending',
        membershipId: membershipId,
        activityId: currentMembership.activityId,
        activityName: activity.name,
        createdAt: serverTimestamp(),
        isAutoRenewal: true
      });
      
      // 6. Registrar en logs
      const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
      await addDoc(logsRef, {
        membershipId: membershipId,
        memberId: currentMembership.memberId,
        memberName: currentMembership.memberName,
        action: 'renewal',
        success: true,
        oldEndDate: currentMembership.endDate,
        newEndDate: Timestamp.fromDate(newEndDate),
        oldPrice: currentMembership.cost,
        newPrice: newPrice,
        duration: duration,
        timestamp: serverTimestamp()
      });
      
      return {
        success: true,
        membershipId,
        newEndDate,
        newPrice,
        duration
      };
      
    } catch (error) {
      console.error('Error renovando membresía:', error);
      
      // Registrar error en logs
      try {
        const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
        await addDoc(logsRef, {
          membershipId: membershipId,
          action: 'renewal',
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: serverTimestamp()
        });
      } catch (logError) {
        console.error('Error registrando log:', logError);
      }
      
      throw error;
    }
  }

  /**
   * Procesar todas las renovaciones automáticas
   */
  async processAllAutoRenewals(
    gymId: string, 
    onProgress?: (current: number, total: number, currentItem: string) => void
  ): Promise<RenewalResult> {
    const result: RenewalResult = {
      success: false,
      renewedCount: 0,
      errorCount: 0,
      errors: [],
      totalProcessed: 0,
      renewedMemberships: [],
      errorMemberships: [],
      timestamp: new Date()
    };
    
    try {
      // Obtener membresías que necesitan renovación
      const membershipsToRenew = await this.getMembershipsNeedingRenewal(gymId);
      result.totalProcessed = membershipsToRenew.length;
      
      if (membershipsToRenew.length === 0) {
        result.success = true;
        return result;
      }
      
      // Procesar cada membresía
      for (let i = 0; i < membershipsToRenew.length; i++) {
        const membership = membershipsToRenew[i];
        
        if (onProgress) {
          onProgress(
            i + 1, 
            membershipsToRenew.length, 
            membership.memberName || 'Socio sin nombre'
          );
        }
        
        try {
          await this.renewMembership(gymId, membership.id);
          result.renewedCount++;
          result.renewedMemberships.push({
            id: membership.id,
            memberName: membership.memberName
          });
        } catch (error) {
          result.errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          result.errors.push(`${membership.memberName}: ${errorMessage}`);
          result.errorMemberships.push({
            id: membership.id,
            memberName: membership.memberName,
            error: errorMessage
          });
        }
        
        // Pequeña pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      result.success = result.renewedCount > 0;
      
      // Registrar resultado del proceso masivo
      const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
      await addDoc(logsRef, {
        action: 'batch_renewal',
        success: result.success,
        totalProcessed: result.totalProcessed,
        renewedCount: result.renewedCount,
        errorCount: result.errorCount,
        errors: result.errors,
        timestamp: serverTimestamp()
      });
      
      return result;
      
    } catch (error) {
      console.error('Error en proceso masivo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      result.errors.push(`Error general: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Verificar si el proceso del mes ya se ejecutó
   */
  async hasMonthlyProcessRun(gymId: string): Promise<boolean> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
      const q = query(
        logsRef,
        where('action', '==', 'monthly_process'),
        where('timestamp', '>=', Timestamp.fromDate(startOfMonth)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error verificando proceso mensual:', error);
      return false;
    }
  }

  /**
   * Ejecutar proceso mensual automático
   */
  async runMonthlyProcess(gymId: string): Promise<RenewalResult> {
    try {
      // Verificar si ya se ejecutó este mes
      const alreadyRun = await this.hasMonthlyProcessRun(gymId);
      if (alreadyRun) {
        console.log('El proceso mensual ya se ejecutó este mes');
        return {
          success: true,
          renewedCount: 0,
          errorCount: 0,
          errors: ['Proceso ya ejecutado este mes'],
          totalProcessed: 0,
          renewedMemberships: [],
          errorMemberships: [],
          timestamp: new Date()
        };
      }
      
      // Ejecutar renovaciones
      const result = await this.processAllAutoRenewals(gymId);
      
      // Registrar ejecución mensual
      const logsRef = collection(db, `gyms/${gymId}/renewal_logs`);
      await addDoc(logsRef, {
        action: 'monthly_process',
        success: result.success,
        result: result,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        timestamp: serverTimestamp()
      });
      
      return result;
    } catch (error) {
      console.error('Error en proceso mensual:', error);
      throw error;
    }
  }
}

export const membershipRenewalService = new MembershipRenewalService();