import fingerprintWS from './fingerprintWebSocketService';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc, getDoc } from 'firebase/firestore';

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
  
  async checkServerStatus(): Promise<boolean> {
    return fingerprintWS.isConnected();
  }

  async initialize(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!fingerprintWS.isConnected()) {
      fingerprintWS.connect();
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (fingerprintWS.isConnected()) {
          resolve({ success: true, message: 'Conectado' });
        } else {
          resolve({ success: false, error: 'No se pudo conectar' });
        }
      }, 2000);
    });
  }

  async capture(gymId?: string): Promise<CaptureResult> {
    return {
      success: false,
      error: 'Este método está deprecado'
    };
  }

  async enrollFingerprint(
    gymId: string,
    memberId: string,
    template: string,
    quality?: number
  ): Promise<EnrollResult> {
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
          error: result.error
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al guardar la huella'
      };
    }
  }

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
      return {
        success: false,
        error: error.message || 'Error al eliminar la huella'
      };
    }
  }

  async verifyFingerprint(
    gymId: string,
    capturedTemplate: string
  ): Promise<VerifyResult> {
    try {
      const result = await fingerprintWS.verifyAgainstFirebase(gymId, capturedTemplate);
      
      if (result.success && result.match) {
        return {
          success: true,
          match: {
            memberId: result.match.memberId,
            memberName: result.match.memberName,
            score: result.match.confidence
          }
        };
      } else {
        return {
          success: false,
          message: result.error || 'Huella no reconocida'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

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
          error: 'Huella no reconocida'
        };
      }

      const { memberId, memberName } = verifyResult.match;

      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberDoc = await getDoc(memberRef);

      if (!memberDoc.exists()) {
        return {
          success: false,
          error: 'Socio no encontrado'
        };
      }

      const memberData = memberDoc.data();

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

export const fingerprintService = new FingerprintService();
export default fingerprintService;
export { default as fingerprintWS } from './fingerprintWebSocketService';