// ============================================
// COMPONENTE DE REGISTRO DE HUELLAS - VERSIÓN CORREGIDA
// Archivo: src/components/members/RegisterFingerprint.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import fingerprintService from '../../services/fingerprintService';

interface Props {
  gymId: string;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Status = 'checking' | 'ready' | 'capturing' | 'processing' | 'success' | 'error';

const RegisterFingerprint: React.FC<Props> = ({
  gymId,
  memberId,
  memberName,
  onSuccess,
  onCancel
}) => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('Verificando servidor...');
  const [quality, setQuality] = useState<number>(0);
  
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
    
    // ✅ CORREGIDO: Pasar gymId al método capture
    const captureResult = await fingerprintService.capture(gymId);
    
    if (!captureResult.success || !captureResult.data) {
      setStatus('error');
      setMessage(captureResult.error || captureResult.message || 'Error al capturar huella');
      return;
    }
    
    const { template, quality: capturedQuality } = captureResult.data;
    setQuality(capturedQuality);
    
    if (capturedQuality < 50) {
      setStatus('error');
      setMessage(`Calidad de huella insuficiente (${capturedQuality}%). Limpia el lector y tu dedo, e intenta de nuevo.`);
      return;
    }
    
    setStatus('processing');
    setMessage('Guardando huella...');
    
    // ✅ CORREGIDO: Ahora se pasan los 3 parámetros requeridos: gymId, memberId, template
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
    
    setStatus('success');
    setMessage('¡Huella registrada correctamente!');
    
    setTimeout(() => {
      onSuccess();
    }, 2000);
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
      case 'capturing':
      case 'processing':
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
            onClick={onCancel}
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
              {quality > 0 && (
                <div className="mt-4 w-full">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Calidad:</span>
                    <span className={`font-semibold ${
                      quality >= 80 ? 'text-green-600' :
                      quality >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {quality}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        quality >= 80 ? 'bg-green-500' :
                        quality >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${quality}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex space-x-3">
            {status === 'ready' && (
              <button
                onClick={handleCapture}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <Fingerprint className="mr-2" size={20} />
                Capturar Huella
              </button>
            )}
            
            {status === 'error' && (
              <button
                onClick={checkServer}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Reintentar
              </button>
            )}
            
            {status !== 'success' && status !== 'capturing' && status !== 'processing' && (
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Instrucciones */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Tip:</strong> Para una mejor captura, asegúrate de que tu dedo esté limpio y seco, 
              y colócalo firmemente en el centro del lector.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterFingerprint;