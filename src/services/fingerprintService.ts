// ============================================
// SERVICIO DE HUELLAS DIGITALES - VERSIÓN CORREGIDA
// Archivo: src/services/fingerprintService.ts
// ============================================

import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';

const FINGERPRINT_API = 'http://localhost:3001/api';

interface CaptureResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    template: string;
    quality: number;
  };
}

interface VerifyResult {
  success: boolean;
  message?: string;
  error?: string;
  memberId?: string;
  memberName?: string;
  match?: {
    memberId: string;
    memberName: string;
    score: number;
  };
}

interface EnrollResult {
  success: boolean;
  message?: string;
  error?: string;
}

class FingerprintService {
  
  /**
   * Verificar si el servidor está disponible
   */
  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${FINGERPRINT_API}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Servidor de huellas no disponible:', error);
      return false;
    }
  }

  /**
   * Inicializar el lector de huellas
   */
  async initialize(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log('🔌 Inicializando lector de huellas...');
      
      const response = await fetch(`${FINGERPRINT_API}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Lector inicializado correctamente');
      } else {
        console.error('❌ Error al inicializar:', data.error);
      }
      
      return data;
      
    } catch (error: any) {
      console.error('❌ Error conectando con servidor:', error);
      return {
        success: false,
        error: 'No se pudo conectar con el servidor de huellas'
      };
    }
  }

  /**
   * Capturar una huella digital
   * ✅ CORREGIDO: Ahora recibe gymId como parámetro opcional
   */
  async capture(gymId?: string): Promise<CaptureResult> {
    try {
      console.log('📸 Capturando huella...');
      
      const response = await fetch(`${FINGERPRINT_API}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Huella capturada: calidad ${data.data.quality}%`);
      } else {
        console.error('❌ Error al capturar:', data.error);
      }
      
      return data;
      
    } catch (error: any) {
      console.error('❌ Error en captura:', error);
      return {
        success: false,
        error: error.message || 'Error al capturar huella'
      };
    }
  }

  /**
   * Registrar huella de un nuevo socio
   * ✅ CORREGIDO: Ahora recibe template como tercer parámetro
   */
  async enrollFingerprint(
    gymId: string,
    memberId: string,
    template: string,
    quality?: number
  ): Promise<EnrollResult> {
    try {
      console.log(`💾 Guardando huella para socio ${memberId}...`);
      
      // Guardar en Firebase
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: {
          template: template,
          quality: quality || 0,
          enrolledAt: serverTimestamp(),
          lastUsed: null
        }
      });
      
      console.log('✅ Huella guardada correctamente en Firebase');
      
      return {
        success: true,
        message: 'Huella registrada correctamente'
      };
      
    } catch (error: any) {
      console.error('❌ Error guardando huella:', error);
      return {
        success: false,
        error: error.message || 'Error al guardar la huella'
      };
    }
  }

  /**
   * Eliminar huella de un socio
   */
  async deleteFingerprint(
    gymId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Eliminando huella del socio ${memberId}...`);
      
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: null,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Huella eliminada correctamente');
      
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Error eliminando huella:', error);
      return {
        success: false,
        error: error.message || 'Error al eliminar la huella'
      };
    }
  }

  /**
   * Verificar una huella contra las registradas
   * ✅ CORREGIDO: Retorna el objeto correcto con match
   */
  async verifyFingerprint(
    gymId: string,
    capturedTemplate: string
  ): Promise<VerifyResult> {
    try {
      console.log('🔍 Buscando coincidencia de huella...');
      
      // 1. Obtener TODOS los miembros activos
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const q = query(
        membersRef,
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          success: false,
          message: 'No hay socios activos en el sistema'
        };
      }
      
      // 2. Filtrar manualmente los que tienen huella
      const enrolledFingerprints: Array<{
        memberId: string;
        memberName: string;
        template: string;
      }> = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Solo agregar si tiene huella registrada
        if (data.fingerprint && data.fingerprint.template) {
          enrolledFingerprints.push({
            memberId: doc.id,
            memberName: `${data.firstName} ${data.lastName}`,
            template: data.fingerprint.template
          });
        }
      });
      
      if (enrolledFingerprints.length === 0) {
        return {
          success: false,
          message: 'No hay huellas registradas en el sistema'
        };
      }
      
      console.log(`📋 Comparando contra ${enrolledFingerprints.length} huellas registradas...`);
      
      // 3. Verificar contra el servidor
      const response = await fetch(`${FINGERPRINT_API}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capturedTemplate,
          enrolledFingerprints
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Error al verificar huella'
        };
      }
      
      // ✅ CORREGIDO: Retornar el objeto correcto con match
      if (data.success && data.match) {
        console.log('✅ Coincidencia encontrada:', data.match.memberName);
        
        // Actualizar última vez usado
        const memberRef = doc(db, `gyms/${gymId}/members`, data.match.memberId);
        await updateDoc(memberRef, {
          'fingerprint.lastUsed': serverTimestamp()
        });

        return {
          success: true,
          memberId: data.match.memberId,
          memberName: data.match.memberName,
          match: {
            memberId: data.match.memberId,
            memberName: data.match.memberName,
            score: data.match.score || 0
          }
        };
      } else {
        console.log('❌ No se encontró coincidencia');
        return {
          success: false,
          message: 'Huella no reconocida'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Error verificando huella:', error);
      return {
        success: false,
        error: 'Error al verificar la huella'
      };
    }
  }
  
  /**
   * Verificar y obtener datos del socio
   * ✅ CORREGIDO: Parámetros correctos
   */
  async verifyAndRegisterAttendance(
    gymId: string,
    capturedTemplate: string
  ): Promise<{
    success: boolean;
    memberId?: string;
    memberName?: string;
    memberData?: any;
    error?: string;
  }> {
    try {
      // Verificar huella
      const verifyResult = await this.verifyFingerprint(gymId, capturedTemplate);
      
      if (!verifyResult.success || !verifyResult.match) {
        return {
          success: false,
          error: verifyResult.message || 'Huella no reconocida'
        };
      }
      
      // Obtener datos completos del socio
      const memberRef = doc(db, `gyms/${gymId}/members`, verifyResult.match.memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) {
        return {
          success: false,
          error: 'Socio no encontrado'
        };
      }
      
      const memberData = memberSnap.data();
      
      return {
        success: true,
        memberId: verifyResult.match.memberId,
        memberName: verifyResult.match.memberName,
        memberData: {
          id: verifyResult.match.memberId,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          email: memberData.email,
          photo: memberData.photo || null,
          status: memberData.status
        }
      };
      
    } catch (error: any) {
      console.error('Error en verifyAndRegisterAttendance:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar huella'
      };
    }
  }
}

export const fingerprintService = new FingerprintService();
export default fingerprintService;