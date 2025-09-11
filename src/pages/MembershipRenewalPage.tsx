// src/pages/MembershipRenewalPage.tsx
// 🏠 PÁGINA PRINCIPAL PARA EL SISTEMA DE RENOVACIONES
// Esta página reemplaza todas las páginas anteriores de renovación

import React from 'react';
import UnifiedRenewalDashboard from '../components/memberships/UnifiedMembershipDashboard';
import MonthlyReportGenerator from '../components/memberships/MonthlyReportGenerator';
import { useMonthlyRenewalAutomation } from '../hooks/useMonthlyRenewalAutomation';
import useAuth from '../hooks/useAuth';

const MembershipRenewalPage: React.FC = () => {
  const { gymData } = useAuth();
  
  // Activar automatización mensual
  useMonthlyRenewalAutomation(gymData?.id, true);
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header de la página */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema de Renovaciones MultiGym
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Gestión centralizada y automatizada de renovaciones de membresías
          </p>
        </div>
        
        {/* Dashboard principal */}
        <div className="mb-8">
          <UnifiedRenewalDashboard />
        </div>
        
        {/* Generador de reportes */}
        <div className="mb-8">
          <MonthlyReportGenerator />
        </div>
        
      </div>
    </div>
  );
};

export default MembershipRenewalPage;

// ==========================================

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

// ==========================================

// INSTRUCCIONES DE IMPLEMENTACIÓN
/*

📋 GUÍA PASO A PASO PARA IMPLEMENTAR EL NUEVO SISTEMA:

1. PREPARACIÓN:
   - Instalar dependencia: npm install xlsx
   - Hacer backup de la base de datos Firebase
   - Notificar a usuarios sobre mantenimiento

2. ARCHIVOS A ELIMINAR (YA NO NECESARIOS):
   - src/components/memberships/AutoRenewalDashboard.tsx (viejo)
   - src/components/memberships/EnhancedMemberControls.tsx (viejo)
   - src/components/memberships/UnifiedMembershipDashboard.tsx (viejo)
   - src/services/membershipExpiration.service.ts (viejo)
   - src/services/membershipAutoRenewal.service.ts (viejo)
   - src/hooks/useAutoRenewalScheduler.ts (viejo)
   - Cualquier otro archivo de renovación anterior

3. ARCHIVOS NUEVOS A CREAR:
   ✅ src/services/membershipRenewalService.ts
   ✅ src/components/memberships/UnifiedRenewalDashboard.tsx
   ✅ src/hooks/useMonthlyRenewalAutomation.ts
   ✅ src/services/excelReportService.ts
   ✅ src/components/memberships/MonthlyReportGenerator.tsx
   ✅ src/pages/MembershipRenewalPage.tsx
   ✅ src/utils/membershipMigration.util.ts

4. MIGRACIÓN DE DATOS:
   - Ejecutar UNA SOLA VEZ en consola del navegador:
   ```javascript
   import { MembershipMigrationUtil } from './utils/membershipMigration.util';
   await MembershipMigrationUtil.migrateMembershipsToNewSystem('TU_GYM_ID');
   await MembershipMigrationUtil.cleanInconsistentData('TU_GYM_ID');
   ```

5. CONFIGURAR RUTAS:
   - Actualizar router para usar MembershipRenewalPage
   - Eliminar rutas antiguas de renovación

6. PRUEBAS:
   - Verificar que las estadísticas se muestran correctamente
   - Probar renovación individual de una membresía
   - Probar renovación masiva con pocas membresías
   - Verificar generación de Excel
   - Confirmar que la automatización mensual funciona

7. FUNCIONALIDADES PRINCIPALES:

   🔄 RENOVACIÓN AUTOMÁTICA:
   - Se ejecuta automáticamente los primeros 3 días de cada mes
   - Solo renueva membresías con autoRenewal = true
   - Actualiza precios automáticamente desde actividades
   - Crea nuevas membresías y marca las anteriores como expiradas
   - Genera transacciones pendientes de pago

   📊 DASHBOARD UNIFICADO:
   - Vista general con estadísticas en tiempo real
   - Lista de membresías vencidas que requieren atención
   - Proceso masivo con barra de progreso
   - Renovación individual con un clic
   - Historial de procesos ejecutados

   📈 REPORTES EXCEL:
   - Reporte mensual completo con todos los socios
   - Estado de pagos por mes seleccionado
   - Información de auto-renovación
   - Reporte específico de renovaciones procesadas
   - Descarga automática en formato Excel

   🎛️ GESTIÓN INDIVIDUAL:
   - Próximamente: vista por usuario
   - Configuración de auto-renovación por membresía
   - Renovación manual con actualización de precio
   - Control granular de cada membresía

8. VENTAJAS DEL NUEVO SISTEMA:
   ✅ Sistema centralizado - todo en un lugar
   ✅ Automatización real - se ejecuta sin intervención
   ✅ Actualización automática de precios
   ✅ Reportes Excel profesionales
   ✅ Interfaz intuitiva y fácil de usar
   ✅ Prevención de duplicados
   ✅ Logging completo de todas las operaciones
   ✅ Manejo robusto de errores
   ✅ Compatible con datos existentes

9. CONFIGURACIÓN PERSONALIZABLE:
   - Período de gracia configurable (actualmente 7 días)
   - Frecuencia de verificación ajustable
   - Activar/desactivar automatización por gimnasio
   - Notificaciones personalizables

10. MANTENIMIENTO:
    - Revisar logs de renovación mensualmente
    - Verificar que los precios de actividades estén actualizados
    - Monitorear métricas de renovación
    - Backup regular de datos

IMPORTANTE: 
- Este sistema reemplaza COMPLETAMENTE todos los intentos anteriores
- Es una solución integral que aborda todos los problemas identificados
- Se ejecuta automáticamente sin intervención del usuario
- Mantiene compatibilidad total con datos existentes
- Proporciona herramientas completas para auditoría y control

*/