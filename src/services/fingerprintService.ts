// src/services/fingerprintService.ts - VERSIÓN CORREGIDA COMPLETA

import fingerprintWS from './fingerprintWebSocketService';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc, getDoc, deleteField } from 'firebase/firestore';

class FingerprintService {
  
  // Verificar estado del servidor
  async checkServerStatus(): Promise<boolean> {
    return fingerprintWS.isConnected();
  }

  // Inicializar (conectar al WebSocket)
  async initialize(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!fingerprintWS.isConnected()) {
      fingerprintWS.connect();
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (fingerprintWS.isConnected()) {
          resolve({ success: true, message: 'Conectado' });
        } else {
          resolve({ success: false, error: 'No se pudo conectar al servidor de huellas' });
        }
      }, 2000);
    });
  }

  // Capturar huella (deprecado - usar enrollment directo)
  async capture(gymId?: string): Promise<{
    success: boolean;
    data?: {
      template: string;
      quality: number;
    };
    message?: string;
    error?: string;
  }> {
    return {
      success: false,
      error: 'Este método está deprecado. Usa enrollFingerprint() directamente.'
    };
  }

  // Registrar huella para un miembro
  async enrollFingerprint(
    gymId: string,
    memberId: string,
    template: string,
    quality?: number
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const result = await fingerprintWS.saveToFirebase(gymId, memberId, template, quality || 0);
      
      if (result.success) {
        return {
          success: true,
          message: 'Huella registrada correctamente'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Error al guardar huella'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al guardar la huella'
      };
    }
  }

  // Eliminar huella de un miembro
  async deleteFingerprint(
    gymId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: deleteField(),
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al eliminar huella'
      };
    }
  }

  // Verificar huella y registrar asistencia
  async verifyAndRegisterAttendance(
    gymId: string,
    capturedTemplate: string
  ): Promise<{
    success: boolean;
    error?: string;
    member?: {
      id: string;
      firstName: string;
      lastName: string;
      memberNumber: string | number;
      photoUrl?: string;
      email?: string;
      photo?: string;
      status?: string;
    };
    attendance?: {
      id: string;
      timestamp: Date;
    };
  }> {
    try {
      console.log('🔍 Verificando huella y registrando asistencia...');

      const verifyResult = await fingerprintWS.verifyAgainstFirebase(gymId, capturedTemplate);

      if (!verifyResult.success || !verifyResult.match) {
        return {
          success: false,
          error: verifyResult.error || 'Huella no reconocida'
        };
      }

      const { memberId, memberName } = verifyResult.match;

      // Obtener datos del miembro
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberDoc = await getDoc(memberRef);

      if (!memberDoc.exists()) {
        return {
          success: false,
          error: 'Socio no encontrado'
        };
      }

      const memberData = memberDoc.data();

      // Registrar asistencia
      const attendanceRef = collection(db, `gyms/${gymId}/attendance`);
      const attendanceDoc = await addDoc(attendanceRef, {
        memberId: memberId,
        memberName: memberName,
        timestamp: serverTimestamp(),
        method: 'fingerprint',
        createdAt: serverTimestamp()
      });

      console.log(`✅ Asistencia registrada para ${memberName}`);

      return {
        success: true,
        member: {
          id: memberId,
          firstName: memberData.firstName || memberName.split(' ')[0] || memberName,
          lastName: memberData.lastName || memberName.split(' ').slice(1).join(' ') || '',
          memberNumber: memberData.memberNumber || '',
          photoUrl: memberData.photoUrl || memberData.photo || undefined,
          email: memberData.email || '',
          photo: memberData.photo || memberData.photoUrl || undefined,
          status: memberData.status || undefined
        },
        attendance: {
          id: attendanceDoc.id,
          timestamp: new Date()
        }
      };

    } catch (error: any) {
      console.error('❌ Error:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar'
      };
    }
  }
}

// Exportar instancia del servicio
export const fingerprintService = new FingerprintService();

// Export default para compatibilidad
export default fingerprintService;

// También exportar el WebSocket service
export { default as fingerprintWS } from './fingerprintWebSocketService';