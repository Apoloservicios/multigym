import { useEffect, useState } from 'react';
import useAuth from './useAuth';
import fingerprintWS from '../services/fingerprintWebSocketService';

export function useFingerprintSync() {
  const { gymData } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [fingerprintCount, setFingerprintCount] = useState(0);

  useEffect(() => {
    const syncFingerprints = async () => {
      if (!gymData?.id || isSyncing) return;

      try {
        setIsSyncing(true);
        console.log('🔄 Iniciando sincronización de huellas...');

        // 1. Verificar conexión
        if (!fingerprintWS.isConnected()) {
          await fingerprintWS.connect();
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // 2. Verificar que esté conectado
        if (!fingerprintWS.isConnected()) {
          console.warn('⚠️ No se pudo conectar al servidor C#');
          setIsSyncing(false);
          return;
        }

        // 3. Cargar huellas
        const result = await fingerprintWS.loadFingerprintsToServer(gymData.id);

        if (result.success) {
          setFingerprintCount(result.count);
          setLastSyncTime(new Date());
          console.log(`✅ Sincronización completa: ${result.count} huellas`);
        } else {
          console.error('❌ Error en sincronización:', result.error);
        }

      } catch (error) {
        console.error('❌ Error sincronizando huellas:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncFingerprints();

    // Re-sincronizar cada 5 minutos
    const interval = setInterval(syncFingerprints, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [gymData?.id]);

  const resync = async () => {
    if (!gymData?.id) return;
    
    setIsSyncing(true);
    try {
      const result = await fingerprintWS.loadFingerprintsToServer(gymData.id);
      if (result.success) {
        setFingerprintCount(result.count);
        setLastSyncTime(new Date());
      }
    } catch (error) {
      console.error('Error en re-sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    lastSyncTime,
    fingerprintCount,
    resync
  };
}