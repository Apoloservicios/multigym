// FingerprintConnectionStatus.tsx - Componente opcional
// Ubicación sugerida: src/components/fingerprint/FingerprintConnectionStatus.tsx
// Puedes agregarlo en el dashboard o en la página de asistencia

import React from 'react';
import { Fingerprint, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import fingerprintWS from '../../services/fingerprintWebSocketService';

interface Props {
  isConnected: boolean;
  onReconnect?: () => void;
}

const FingerprintConnectionStatus: React.FC<Props> = ({ isConnected, onReconnect }) => {
  
  const handleReconnect = () => {
    fingerprintWS.reconnect();
    if (onReconnect) {
      onReconnect();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            isConnected ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Fingerprint className={`w-5 h-5 ${
              isConnected ? 'text-green-600' : 'text-gray-400'
            }`} />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Lector de Huellas</h3>
              {isConnected ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <p className={`text-sm ${
              isConnected ? 'text-green-600' : 'text-gray-500'
            }`}>
              {isConnected ? 'Conectado y listo' : 'No conectado'}
            </p>
          </div>
        </div>

        {!isConnected && (
          <button
            onClick={handleReconnect}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reconectar
          </button>
        )}
      </div>

      {!isConnected && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Nota:</strong> Asegúrate de que el programa de lector de huellas (C#) esté ejecutándose en el puerto 8080.
          </p>
        </div>
      )}
    </div>
  );
};

export default FingerprintConnectionStatus;


// ========== EJEMPLO DE USO EN TU PÁGINA DE ASISTENCIA ==========
/*
import FingerprintConnectionStatus from '../../components/fingerprint/FingerprintConnectionStatus';
import { useFingerprintWebSocket } from '../../hooks/useFingerprintWebSocket';

function AttendancePage() {
  const { isConnected, reconnect } = useFingerprintWebSocket();

  return (
    <div>
      <FingerprintConnectionStatus 
        isConnected={isConnected} 
        onReconnect={reconnect}
      />
      
      {/* Resto de tu componente de asistencia *\/}
    </div>
  );
}
*/