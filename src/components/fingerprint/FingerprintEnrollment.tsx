// ============================================
// COMPONENTE DE REGISTRO DE HUELLAS
// Archivo: src/components/fingerprint/FingerprintEnrollment.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';

interface Props {
  gymId: string;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Status = 'checking' | 'ready' | 'capturing' | 'processing' | 'success' | 'error';

const FingerprintEnrollment: React.FC<Props> = ({
  gymId,
  memberId,
  memberName,
  onSuccess,
  onCancel
}) => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('Verificando servidor...');
  const [quality, setQuality] = useState<number>(0);
  
  // Verificar servidor al montar
  useEffect(() => {
    checkServer();
  }, []);
  
  const checkServer = async () => {
    setStatus('checking');
    setMessage('Verificando conexión con el servidor...');
    
    const isOnline = await fingerprintService.checkServerStatus();
    
    if (!isOnline) {
      setStatus('error');
      setMessage('No se pudo conectar con el servidor de huellas. Asegúrate de que el servidor local esté corriendo.');
      return;
    }
    
    // Inicializar lector
    const initResult = await fingerprintService.initialize();
    
    if (!initResult.success) {
      setStatus('error');
      setMessage(initResult.error || 'Error al inicializar el lector');
      return;
    }
    
    setStatus('ready');
    setMessage('Lector listo. Presiona "Capturar Huella" para comenzar.');
  };
  
  const handleCapture = async () => {
    setStatus('capturing');
    setMessage('Coloca tu dedo en el lector...');
    setQuality(0);
    
    // 1. Capturar huella
    const captureResult = await fingerprintService.capture();
    
    if (!captureResult.success || !captureResult.data) {
      setStatus('error');
      setMessage(captureResult.error || captureResult.message || 'Error al capturar huella');
      return;
    }
    
    const { template, quality: capturedQuality } = captureResult.data;
    setQuality(capturedQuality);
    
    // Validar calidad mínima
    if (capturedQuality < 50) {
      setStatus('error');
      setMessage(`Calidad de huella insuficiente (${capturedQuality}%). Limpia el lector y tu dedo, e intenta de nuevo.`);
      return;
    }
    
    // 2. Guardar en Firebase
    setStatus('processing');
    setMessage('Guardando huella...');
    
    const enrollResult = await fingerprintService.enrollFingerprint(
      gymId,
      memberId,
      template,
      capturedQuality
    );
    
    if (!enrollResult.success) {
      setStatus('error');
      setMessage(enrollResult.error || 'Error al guardar la huella');
      return;
    }
    
    // 3. Éxito
    setStatus('success');
    setMessage('¡Huella registrada correctamente!');
    
    // Cerrar automáticamente después de 2 segundos
    setTimeout(() => {
      onSuccess();
    }, 2000);
  };
  
  const getStatusColor = () => {
    switch (status) {
      case 'checking':
      case 'capturing':
      case 'processing':
        return 'text-blue-500';
      case 'ready':
        return 'text-gray-400';
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };
  
  const getQualityColor = () => {
    if (quality >= 80) return 'text-green-600';
    if (quality >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Registrar Huella Digital
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={status === 'capturing' || status === 'processing'}
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Info del socio */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Socio:</p>
          <p className="text-lg font-medium text-gray-900">{memberName}</p>
        </div>
        
        {/* Visualización del lector */}
        <div className="flex flex-col items-center justify-center py-8 mb-6">
          <div className="relative">
            <Fingerprint 
              size={100} 
              className={`${getStatusColor()} transition-colors ${
                (status === 'capturing' || status === 'processing') ? 'animate-pulse' : ''
              }`}
            />
            {status === 'checking' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader size={40} className="animate-spin text-blue-500" />
              </div>
            )}
          </div>
          
          {/* Mensaje de estado */}
          <div className="mt-6 text-center">
            <p className={`text-base font-medium ${
              status === 'error' ? 'text-red-600' :
              status === 'success' ? 'text-green-600' :
              'text-gray-700'
            }`}>
              {message}
            </p>
            
            {/* Indicador de calidad */}
            {quality > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-gray-600">Calidad:</span>
                  <span className={`text-lg font-bold ${getQualityColor()}`}>
                    {quality}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      quality >= 80 ? 'bg-green-500' :
                      quality >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${quality}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Botones de acción */}
        <div className="flex gap-3">
          {status === 'ready' && (
            <button
              onClick={handleCapture}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Capturar Huella
            </button>
          )}
          
          {status === 'error' && (
            <>
              <button
                onClick={checkServer}
                className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Reintentar
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
            </>
          )}
          
          {(status === 'capturing' || status === 'processing') && (
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
        {status === 'ready' && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">
              📋 Instrucciones:
            </p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Asegúrate de que tu dedo esté limpio y seco</li>
              <li>• Coloca el dedo firmemente en el lector</li>
              <li>• Mantén el dedo quieto durante la captura</li>
              <li>• Si falla, limpia el lector e intenta nuevamente</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FingerprintEnrollment;