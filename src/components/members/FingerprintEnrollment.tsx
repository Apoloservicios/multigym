// ============================================
// COMPONENTE DE REGISTRO DE HUELLAS - VERSIÓN SIMPLIFICADA
// Archivo: src/components/fingerprint/FingerprintEnrollment.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import fingerprintWS from '../../services/fingerprintWebSocketService';

interface Props {
  gymId: string;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Status = 'checking' | 'ready' | 'enrolling' | 'saving' | 'success' | 'error';

const FingerprintEnrollment: React.FC<Props> = ({
  gymId,
  memberId,
  memberName,
  onSuccess,
  onCancel
}) => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('Verificando conexión...');
  const [samplesNeeded, setSamplesNeeded] = useState(4);
  const [capturedTemplate, setCapturedTemplate] = useState<string>('');
  
  useEffect(() => {
    // Conectar al WebSocket
    fingerprintWS.connect();
    
    // Verificar conexión
    const checkConnection = setTimeout(() => {
      if (fingerprintWS.isConnected()) {
        setStatus('ready');
        setMessage('Listo para registrar. Presiona "Iniciar Registro"');
      } else {
        setStatus('error');
        setMessage('No se pudo conectar con el servidor. ¿Está corriendo el programa C#?');
      }
    }, 2000);

    // Escuchar eventos del servidor
    const handleProgress = (event: any) => {
      if (event.type === 'enrollment_progress') {
        setSamplesNeeded(event.samplesNeeded || 0);
        setMessage(`Muestra ${4 - event.samplesNeeded + 1}/4 capturada. Coloca tu dedo nuevamente.`);
      }
    };

    const handleComplete = (event: any) => {
      if (event.type === 'enrollment_complete' && event.template) {
        console.log('✅ Registro completo del servidor');
        setCapturedTemplate(event.template);
        saveToFirebase(event.template);
      }
    };

    const handleError = (event: any) => {
      if (event.type === 'enrollment_error') {
        setStatus('error');
        setMessage(event.error || 'Error en el registro');
      }
    };

    fingerprintWS.on('enrollment_progress', handleProgress);
    fingerprintWS.on('enrollment_complete', handleComplete);
    fingerprintWS.on('enrollment_error', handleError);

    return () => {
      // Limpiar listeners
      fingerprintWS.off('enrollment_progress', handleProgress);
      fingerprintWS.off('enrollment_complete', handleComplete);
      fingerprintWS.off('enrollment_error', handleError);
      fingerprintWS.cancelEnrollment();
    };
  }, []);

  const handleStartEnrollment = () => {
    setStatus('enrolling');
    setMessage('Coloca tu dedo en el lector (1/4)...');
    setSamplesNeeded(4);
    fingerprintWS.startEnrollment(memberId);
  };

  const saveToFirebase = async (template: string) => {
    setStatus('saving');
    setMessage('Guardando en la base de datos...');

    const result = await fingerprintWS.saveToFirebase(gymId, memberId, template, 100);

    if (result.success) {
      setStatus('success');
      setMessage('¡Huella registrada correctamente!');
      
      // Cerrar después de 2 segundos
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } else {
      setStatus('error');
      setMessage(result.error || 'Error al guardar en Firebase');
    }
  };

  const handleCancel = () => {
    fingerprintWS.cancelEnrollment();
    onCancel();
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
      case 'enrolling':
      case 'saving':
        return <Loader className="animate-spin text-blue-500" size={48} />;
      case 'ready':
        return <Fingerprint className="text-blue-500" size={48} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={48} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={48} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold flex items-center">
            <Fingerprint className="mr-2" size={24} />
            Registrar Huella Digital
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Info del socio */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Socio:</p>
            <p className="text-lg font-semibold">{memberName}</p>
          </div>

          {/* Estado */}
          <div className={`mb-6 p-6 rounded-lg border-2 ${getStatusColor()} transition-colors`}>
            <div className="flex flex-col items-center">
              {getStatusIcon()}
              <p className="mt-4 text-center font-medium text-gray-800">
                {message}
              </p>
              {status === 'enrolling' && samplesNeeded > 0 && (
                <div className="mt-4 w-full">
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          step <= (4 - samplesNeeded)
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            {status === 'ready' && (
              <button
                onClick={handleStartEnrollment}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Iniciar Registro
              </button>
            )}

            {status === 'error' && (
              <>
                <button
                  onClick={() => {
                    setStatus('checking');
                    setMessage('Reconectando...');
                    fingerprintWS.connect();
                  }}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Reintentar
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </>
            )}

            {(status === 'enrolling' || status === 'saving') && (
              <div className="flex-1 px-6 py-3 bg-gray-300 text-gray-600 rounded-lg font-medium text-center cursor-not-allowed">
                Procesando...
              </div>
            )}

            {status === 'success' && (
              <div className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-medium text-center flex items-center justify-center gap-2">
                <CheckCircle size={20} />
                ¡Registrado!
              </div>
            )}
          </div>

          {/* Instrucciones */}
          {(status === 'ready' || status === 'enrolling') && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">
                📋 Instrucciones:
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Asegúrate de que tu dedo esté limpio y seco</li>
                <li>• Coloca el dedo firmemente sobre el lector</li>
                <li>• Mantén el dedo quieto durante la captura</li>
                <li>• Necesitas colocar el dedo 4 veces</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FingerprintEnrollment;