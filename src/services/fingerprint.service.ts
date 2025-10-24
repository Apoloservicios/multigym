// ============================================
// SERVICIO DE HUELLAS DIGITALES
// Archivo: src/services/fingerprint.service.ts
// ============================================

import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  FingerprintCaptureResult,
  FingerprintVerifyResult,
  FingerprintInitResult,
  FingerprintReaderStatus
} from '../types/fingerprint.types';

const FINGERPRINT_API = 'http://localhost:3001/api/fingerprint';

class FingerprintService {
  
  /**
   * Verificar estado del servidor
   */
  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3001/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.status === 'ok';
      
    } catch (error) {
      console.error('Error verificando servidor:', error);
      return false;
    }
  }
  
  /**
   * Inicializar el lector de huellas
   */
  async initialize(): Promise<FingerprintInitResult> {
    try {
      const response = await fetch(`${FINGERPRINT_API}/init`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Error al inicializar el lector'
        };
      }
      
      return data;
      
    } catch (error: any) {
      console.error('Error inicializando lector:', error);
      return {
        success: false,
        error: 'No se pudo conectar con el servidor de huellas. ¿Está corriendo el servidor local?'
      };
    }
  }
  
  /**
   * Obtener estado del lector
   */
  async getStatus(): Promise<FingerprintReaderStatus | null> {
    try {
      const response = await fetch(`${FINGERPRINT_API}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) return null;
      
      return await response.json();
      
    } catch (error) {
      console.error('Error obteniendo estado:', error);
      return null;
    }
  }
  
  /**
   * Capturar huella digital
   */
  async capture(): Promise<FingerprintCaptureResult> {
    try {
      console.log('📸 Capturando huella...');
      
      const response = await fetch(`${FINGERPRINT_API}/capture`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Error al capturar huella'
        };
      }
      
      console.log('✅ Huella capturada:', {
        quality: data.data?.quality,
        hasTemplate: !!data.data?.template
      });
      
      return data;
      
    } catch (error: any) {
      console.error('❌ Error capturando huella:', error);
      return {
        success: false,
        error: 'Error de comunicación con el servidor de huellas'
      };
    }
  }
  
  /**
   * Registrar huella en Firebase
   */
  async enrollFingerprint(
    gymId: string,
    memberId: string,
    template: string,
    quality: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('💾 Guardando huella en Firebase...');
      
      // Validar con el servidor primero
      const validateResponse = await fetch(`${FINGERPRINT_API}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, template, quality })
      });
      
      const validateData = await validateResponse.json();
      
      if (!validateData.success) {
        return {
          success: false,
          error: validateData.error || 'Error al validar la huella'
        };
      }
      
      // Guardar en Firebase
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: {
          template: template,
          quality: quality,
          registeredAt: serverTimestamp(),
          lastUsed: null
        },
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Huella guardada correctamente');
      
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Error guardando huella:', error);
      return {
        success: false,
        error: error.message || 'Error al guardar la huella en la base de datos'
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
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: null,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Error eliminando huella:', error);
      return {
        success: false,
        error: error.message || 'Error al eliminar la huella'
      };
    }
  }
  

 /**
 * Verificar huella y buscar coincidencia
 */
async verifyFingerprint(
  gymId: string,
  capturedTemplate: string
): Promise<FingerprintVerifyResult> {
  try {
    console.log('🔍 Buscando coincidencia de huella...');
    
    // 1. Obtener TODOS los miembros activos (sin filtro por fingerprint)
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const q = query(
      membersRef,
      where('status', '==', 'active')  // Solo filtrar por status
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
    
    if (data.success && data.match) {
      console.log('✅ Coincidencia encontrada:', data.match.memberName);
      
      // Actualizar última vez usado
      const memberRef = doc(db, `gyms/${gymId}/members`, data.match.memberId);
      await updateDoc(memberRef, {
        'fingerprint.lastUsed': serverTimestamp()
      });
    } else {
      console.log('❌ No se encontró coincidencia');
    }
    
    return data;
    
  } catch (error: any) {
    console.error('❌ Error verificando huella:', error);
    return {
      success: false,
      error: 'Error al verificar la huella'
    };
  }
}
  
  /**
   * Verificar y registrar asistencia automáticamente
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