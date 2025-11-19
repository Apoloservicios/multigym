// ===========================================================
// SERVICIO WEBSOCKET PARA HUELLAS DIGITALES
// Se comunica con el servidor C# en localhost:8080
// ===========================================================

import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

// Tipos de eventos que puede enviar el servidor
interface FingerprintEvent {
  type: string;
  memberId?: string;
  memberName?: string;
  template?: string;
  confidence?: number;
  samplesNeeded?: number;
  status?: string;
  error?: string;
  quality?: number;
}

type EventCallback = (event: FingerprintEvent) => void;

class FingerprintWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private connectionAttempted: boolean = false;
  
  // -------------------------------------------------------
  // CONEXIÓN
  // -------------------------------------------------------
  
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('⚠️ Ya conectado al servidor');
      return;
    }

    if (this.connectionAttempted && this.ws === null) {
      console.log('⚠️ Ya se intentó conectar. Usa reconnect() para reintentar.');
      return;
    }

    try {
      console.log('🔌 Conectando al servidor de huellas...');
      this.connectionAttempted = true;
      
      // IMPORTANTE: Esta URL debe coincidir con el servidor C#
      this.ws = new WebSocket('ws://localhost:8080/fingerprint');

      this.ws.onopen = () => {
        console.log('✅ Conectado al servidor de huellas');
        this.emit('connected', { type: 'connected' });
        
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: FingerprintEvent = JSON.parse(event.data);
          console.log('📨 Mensaje recibido:', data);
          this.emit(data.type, data);
        } catch (error) {
          console.error('❌ Error procesando mensaje:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 Desconectado del servidor de huellas');
        this.ws = null;
        this.emit('disconnected', { type: 'disconnected' });
      };

    } catch (error) {
      console.error('❌ Error al conectar:', error);
      this.ws = null;
    }
  }

  reconnect(): void {
    console.log('🔄 Reconexión manual...');
    this.connectionAttempted = false;
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // -------------------------------------------------------
  // ENVÍO DE COMANDOS
  // -------------------------------------------------------

  send(command: string, data: any = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { command, ...data };
      this.ws.send(JSON.stringify(message));
      console.log('📤 Comando enviado:', message);
    } else {
      console.error('❌ WebSocket no conectado');
    }
  }

  startEnrollment(memberId: string, memberName?: string): void {
    this.send('start_enrollment', { memberId, memberName });
  }

  cancelEnrollment(): void {
    this.send('cancel_enrollment');
  }

  startContinuousMode(): void {
    this.send('start_continuous');
  }

  stopContinuousMode(): void {
    this.send('stop_continuous');
  }

  // -------------------------------------------------------
  // OPERACIONES CON FIREBASE
  // -------------------------------------------------------

  async loadFingerprintsToServer(gymId: string): Promise<{ 
    success: boolean; 
    count: number; 
    error?: string 
  }> {
    try {
      if (!this.isConnected()) {
        return { success: false, count: 0, error: 'Servidor no conectado' };
      }

      console.log('📥 Cargando huellas desde Firebase...');

      const membersRef = collection(db, `gyms/${gymId}/members`);
      const q = query(membersRef, where('fingerprint', '!=', null));
      const snapshot = await getDocs(q);

      const fingerprints = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          memberId: doc.id,
          memberName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Socio',
          template: data.fingerprint.template
        };
      });

      console.log(`📤 Enviando ${fingerprints.length} huellas al servidor...`);

      this.send('load_fingerprints', { fingerprints });

      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, count: fingerprints.length };

    } catch (error: any) {
      console.error('❌ Error cargando huellas:', error);
      return { success: false, count: 0, error: error.message };
    }
  }

  async saveToFirebase(
    gymId: string,
    memberId: string,
    template: string,
    quality: number = 0
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      
      await updateDoc(memberRef, {
        fingerprint: {
          template: template,
          quality: quality,
          registeredAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      console.log('✅ Huella guardada en Firebase');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error guardando en Firebase:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyAgainstFirebase(
    gymId: string,
    capturedTemplate: string
  ): Promise<{
    success: boolean;
    match?: {
      memberId: string;
      memberName: string;
      confidence: number;
    };
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando coincidencia en Firebase...');
      
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const q = query(membersRef, where('status', '==', 'active'));
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { success: false, error: 'No hay socios activos' };
      }

      return new Promise((resolve) => {
        const enrolledFingerprints: any[] = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.fingerprint && data.fingerprint.template) {
            enrolledFingerprints.push({
              memberId: doc.id,
              memberName: `${data.firstName} ${data.lastName}`,
              template: data.fingerprint.template
            });
          }
        });

        if (enrolledFingerprints.length === 0) {
          resolve({ success: false, error: 'No hay huellas registradas' });
          return;
        }

        console.log(`📋 Comparando contra ${enrolledFingerprints.length} huellas...`);

        const handleVerification = (event: FingerprintEvent) => {
          if (event.type === 'fingerprint_verified' && event.memberId && event.confidence) {
            const member = enrolledFingerprints.find(m => m.memberId === event.memberId);
            
            resolve({
              success: true,
              match: {
                memberId: event.memberId,
                memberName: member?.memberName || 'Desconocido',
                confidence: event.confidence
              }
            });
          } else if (event.type === 'fingerprint_not_found') {
            resolve({ success: false, error: 'Huella no reconocida' });
          }
          
          this.off('fingerprint_verified', handleVerification);
          this.off('fingerprint_not_found', handleVerification);
        };

        this.on('fingerprint_verified', handleVerification);
        this.on('fingerprint_not_found', handleVerification);

        this.send('verify_fingerprint', {
          capturedTemplate,
          enrolledFingerprints
        });

        setTimeout(() => {
          this.off('fingerprint_verified', handleVerification);
          this.off('fingerprint_not_found', handleVerification);
          resolve({ success: false, error: 'Timeout en verificación' });
        }, 10000);
      });

    } catch (error: any) {
      console.error('❌ Error en verificación:', error);
      return { success: false, error: error.message };
    }
  }

  // -------------------------------------------------------
  // SISTEMA DE EVENTOS
  // -------------------------------------------------------

  on(eventType: string, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(eventType: string, data: FingerprintEvent): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // -------------------------------------------------------
  // UTILIDADES
  // -------------------------------------------------------

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Exportar una instancia única (Singleton)
export const fingerprintWS = new FingerprintWebSocketService();
export default fingerprintWS;