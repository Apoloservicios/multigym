// useFingerprintWebSocket.ts
// Hook de TypeScript para conectarse al servicio de huellas
// Para tu proyecto multigym en React + TypeScript + Firebase

import { useState, useEffect, useCallback, useRef } from 'react';

// ===================================
// TIPOS
// ===================================

interface EnrollmentProgress {
  memberId: string;
  status: string;
  samplesNeeded: number;
}

interface FingerprintEvent {
  type: string;
  memberId?: string;
  confidence?: number;
  timestamp?: Date;
  status?: string;
  samplesNeeded?: number;
  template?: string;
  error?: string;
  message?: string;
}

interface UseFingerprintWebSocketReturn {
  isConnected: boolean;
  lastEvent: FingerprintEvent | null;
  enrollmentProgress: EnrollmentProgress | null;
  startEnrollment: (memberId: string) => void;
  cancelEnrollment: () => void;
  sendCommand: (command: string, data?: any) => void;
  connect: () => void;
  disconnect: () => void;
}

// ===================================
// HOOK PRINCIPAL
// ===================================

export const useFingerprintWebSocket = (): UseFingerprintWebSocketReturn => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<FingerprintEvent | null>(null);
  const [enrollmentProgress, setEnrollmentProgress] = useState<EnrollmentProgress | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Conectar al WebSocket
  const connect = useCallback(() => {
    try {
      console.log('🔌 Conectando al servicio de huellas...');
      
      const ws = new WebSocket('ws://localhost:8080/fingerprint');
      
      ws.onopen = () => {
        console.log('✅ Conectado al servicio de huellas');
        setIsConnected(true);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data: FingerprintEvent = JSON.parse(event.data);
          console.log('📨 Mensaje recibido:', data);
          
          setLastEvent(data);

          // Manejar diferentes tipos de eventos
          switch (data.type) {
            case 'fingerprint_verified':
              handleFingerprintVerified(data);
              break;
            
            case 'fingerprint_not_found':
              handleFingerprintNotFound(data);
              break;
            
            case 'enrollment_progress':
              setEnrollmentProgress({
                memberId: data.memberId || '',
                status: data.status || '',
                samplesNeeded: data.samplesNeeded || 0
              });
              break;
            
            case 'enrollment_complete':
              handleEnrollmentComplete(data);
              break;
            
            case 'enrollment_error':
              handleEnrollmentError(data);
              break;
          }
        } catch (error) {
          console.error('❌ Error procesando mensaje:', error);
        }
      };

      ws.onerror = (error: Event) => {
        console.error('❌ Error en WebSocket:', error);
      };

      ws.onclose = () => {
        console.log('🔌 Desconectado del servicio de huellas');
        setIsConnected(false);
        
        // Intentar reconectar después de 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Intentando reconectar...');
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Error al conectar:', error);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, []);

  // Desconectar
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Enviar comando al servicio
  const sendCommand = useCallback((command: string, data: any = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        command,
        ...data
      };
      
      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Comando enviado:', message);
    } else {
      console.error('❌ WebSocket no está conectado');
    }
  }, []);

  // Iniciar registro de huella
  const startEnrollment = useCallback((memberId: string) => {
    sendCommand('start_enrollment', { memberId });
    setEnrollmentProgress({
      memberId,
      status: 'iniciando',
      samplesNeeded: 4
    });
  }, [sendCommand]);

  // Cancelar registro
  const cancelEnrollment = useCallback(() => {
    sendCommand('cancel_enrollment');
    setEnrollmentProgress(null);
  }, [sendCommand]);

  // Ping al servidor
  const ping = useCallback(() => {
    sendCommand('ping');
  }, [sendCommand]);

  // Manejadores de eventos
  const handleFingerprintVerified = (data: FingerprintEvent) => {
    console.log('✅ Huella verificada:', data.memberId);
    playSuccessSound();
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('✅ Asistencia Registrada', {
        body: `Socio ${data.memberId}`,
        icon: '/success-icon.png'
      });
    }
  };

  const handleFingerprintNotFound = (data: FingerprintEvent) => {
    console.log('❌ Huella no reconocida');
    playErrorSound();
  };

  const handleEnrollmentComplete = (data: FingerprintEvent) => {
    console.log('✅ Registro de huella completado:', data.memberId);
    setEnrollmentProgress(null);
    playSuccessSound();
  };

  const handleEnrollmentError = (data: FingerprintEvent) => {
    console.error('❌ Error en registro:', data.error);
    setEnrollmentProgress(null);
    playErrorSound();
  };

  // Sonidos
  const playSuccessSound = () => {
    const audio = new Audio('/sounds/success.mp3');
    audio.play().catch(e => console.log('No se pudo reproducir sonido'));
  };

  const playErrorSound = () => {
    const audio = new Audio('/sounds/error.mp3');
    audio.play().catch(e => console.log('No se pudo reproducir sonido'));
  };

  // Conectar al montar el componente
  useEffect(() => {
    connect();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Mantener conexión viva con ping cada 30 segundos
  useEffect(() => {
    if (isConnected) {
      const pingInterval = setInterval(() => {
        ping();
      }, 30000);

      return () => clearInterval(pingInterval);
    }
  }, [isConnected, ping]);

  return {
    isConnected,
    lastEvent,
    enrollmentProgress,
    startEnrollment,
    cancelEnrollment,
    sendCommand,
    connect,
    disconnect
  };
};

export default useFingerprintWebSocket;