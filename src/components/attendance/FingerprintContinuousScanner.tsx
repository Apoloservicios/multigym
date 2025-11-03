// ============================================
// ESCÁNER CONTINUO DE HUELLAS - VERSIÓN SIMPLIFICADA
// Archivo: src/components/attendance/FingerprintContinuousScanner.tsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, Power, CheckCircle, XCircle, Users, TrendingUp } from 'lucide-react';
import fingerprintWS from '../../services/fingerprintWebSocketService';
import useAuth from '../../hooks/useAuth';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Props {
  onAttendanceRegistered?: () => void;
}

interface LastResult {
  success: boolean;
  message: string;
  memberName?: string;
  memberPhoto?: string | null;
  timestamp: Date;
}

interface Stats {
  total: number;
  success: number;
  errors: number;
}

type Status = 'stopped' | 'ready' | 'scanning' | 'verifying' | 'success' | 'error';

const FingerprintContinuousScanner: React.FC<Props> = ({ onAttendanceRegistered }) => {
  const { gymData } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<Status>('stopped');
  const [statusMessage, setStatusMessage] = useState('Presiona INICIAR para comenzar');
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, success: 0, errors: 0 });
  
  const audioRef = useRef<{ success: HTMLAudioElement; error: HTMLAudioElement } | null>(null);

  // Cargar sonidos
  useEffect(() => {
    audioRef.current = {
      success: new Audio('/sounds/success.mp3'),
      error: new Audio('/sounds/error.mp3')
    };
  }, []);

// Conectar y sincronizar al montar
  useEffect(() => {
    const init = async () => {
      // Conectar al servidor
      fingerprintWS.connect();
      
      // Esperar un momento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Las huellas YA están cargadas por useFingerprintSync
      // No necesitamos cargarlas aquí
    };

    init();

    return () => {
      if (isActive) {
        fingerprintWS.stopContinuousMode();
      }
    };
  }, []);

  // Escuchar eventos
  useEffect(() => {
    if (!isActive) return;

    const handleDetected = async (event: any) => {
      if (event.type === 'fingerprint_detected') {
        console.log('👆 Huella detectada - Verificando...');
        setStatus('verifying');
        setStatusMessage('Verificando huella...');

        // Verificar contra Firebase
        const result = await fingerprintWS.verifyAgainstFirebase(
          gymData!.id,
          event.template
        );

        if (result.success && result.match) {
          // ✅ HUELLA RECONOCIDA
          await registerAttendance(result.match.memberId, result.match.memberName);
        } else {
          // ❌ HUELLA NO RECONOCIDA
          handleError(result.error || 'Huella no reconocida');
        }
      }
    };

    fingerprintWS.on('fingerprint_detected', handleDetected);

    return () => {
      fingerprintWS.off('fingerprint_detected', handleDetected);
    };
  }, [isActive, gymData]);

  const startScanning = () => {
    if (!gymData?.id) {
      alert('Error: No hay gimnasio seleccionado');
      return;
    }

    console.log('🟢 Iniciando modo continuo...');
    setIsActive(true);
    setStatus('ready');
    setStatusMessage('✅ Listo - Esperando huella...');
    
    // Activar modo continuo en el servidor
    fingerprintWS.send('start_continuous');
  };

  const stopScanning = () => {
    console.log('🔴 Deteniendo modo continuo...');
    setIsActive(false);
    setStatus('stopped');
    setStatusMessage('⏹️ Detenido - Presiona INICIAR para reanudar');
    
    // Desactivar modo continuo en el servidor
    fingerprintWS.send('stop_continuous');
  };

  const registerAttendance = async (memberId: string, memberName: string) => {
    try {
      console.log(`✅ Registrando asistencia para: ${memberName}`);
      setStatus('success');
      setStatusMessage(`✅ ¡Bienvenido ${memberName}!`);
      playSound('success');

      // Obtener datos del socio
      const memberRef = doc(db, `gyms/${gymData!.id}/members`, memberId);
      const memberSnap = await getDoc(memberRef);
      
      const memberData = memberSnap.exists() ? memberSnap.data() : null;

      // Buscar membresía activa
      const membershipsRef = collection(db, `gyms/${gymData!.id}/memberships`);
      const q = query(
        membershipsRef,
        where('memberId', '==', memberId),
        where('status', '==', 'active')
      );
      
      const membershipsSnap = await getDocs(q);
      
      let activityId = null;
      let activityName = 'General';
      
      if (!membershipsSnap.empty) {
        const membership = membershipsSnap.docs[0].data();
        activityId = membership.activityId;
        
        // Obtener nombre de la actividad
        if (activityId) {
          const activityRef = doc(db, `gyms/${gymData!.id}/activities`, activityId);
          const activitySnap = await getDoc(activityRef);
          if (activitySnap.exists()) {
            activityName = activitySnap.data().name;
          }
        }
      }

      // Registrar asistencia
      const attendanceRef = collection(db, `gyms/${gymData!.id}/attendance`);
      await addDoc(attendanceRef, {
        memberId: memberId,
        memberName: memberName,
        activityId: activityId,
        activityName: activityName,
        checkInTime: serverTimestamp(),
        method: 'fingerprint',
        status: 'present',
        createdAt: serverTimestamp()
      });

      // Actualizar estadísticas
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        errors: prev.errors
      }));

      // Mostrar resultado
      setLastResult({
        success: true,
        message: `Asistencia registrada`,
        memberName: memberName,
        memberPhoto: memberData?.photo || null,
        timestamp: new Date()
      });

      // Volver a modo listo después de 3 segundos
      setTimeout(() => {
        setStatus('ready');
        setStatusMessage('✅ Listo - Esperando huella...');
      }, 3000);

      // Notificar al componente padre
      if (onAttendanceRegistered) {
        onAttendanceRegistered();
      }

    } catch (error: any) {
      console.error('❌ Error registrando asistencia:', error);
      handleError('Error al registrar asistencia');
    }
  };

  const handleError = (message: string) => {
    console.error('❌ Error:', message);
    setStatus('error');
    setStatusMessage(`❌ ${message}`);
    playSound('error');

    setStats(prev => ({
      total: prev.total + 1,
      success: prev.success,
      errors: prev.errors + 1
    }));

    setLastResult({
      success: false,
      message: message,
      timestamp: new Date()
    });

    // Volver a modo listo después de 3 segundos
    setTimeout(() => {
      setStatus('ready');
      setStatusMessage('✅ Listo - Esperando huella...');
    }, 3000);
  };

  const playSound = (type: 'success' | 'error') => {
    if (audioRef.current) {
      audioRef.current[type].play().catch(err => 
        console.log('No se pudo reproducir el sonido:', err)
      );
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'stopped':
        return 'bg-gray-100 border-gray-300';
      case 'ready':
      case 'scanning':
        return 'bg-blue-50 border-blue-300';
      case 'verifying':
        return 'bg-yellow-50 border-yellow-300';
      case 'success':
        return 'bg-green-50 border-green-300';
      case 'error':
        return 'bg-red-50 border-red-300';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Fingerprint className="mr-2" size={28} />
          Escáner Continuo de Huellas
        </h2>
        
        {/* Botón On/Off */}
        <button
          onClick={isActive ? stopScanning : startScanning}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
            isActive
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          <Power size={20} />
          {isActive ? 'DETENER' : 'INICIAR'}
        </button>
      </div>

      {/* Estado actual */}
      <div className={`p-6 rounded-lg border-2 ${getStatusColor()} transition-colors mb-6`}>
        <div className="flex items-center justify-center">
          <Fingerprint size={48} className="mr-4" />
          <div>
            <p className="text-2xl font-bold">{statusMessage}</p>
            {status === 'verifying' && (
              <div className="mt-2 flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Verificando en base de datos...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <Users size={32} className="text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Exitosos</p>
              <p className="text-3xl font-bold text-green-600">{stats.success}</p>
            </div>
            <CheckCircle size={32} className="text-green-400" />
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Errores</p>
              <p className="text-3xl font-bold text-red-600">{stats.errors}</p>
            </div>
            <XCircle size={32} className="text-red-400" />
          </div>
        </div>
      </div>

      {/* Último resultado */}
      {lastResult && (
        <div className={`p-4 rounded-lg border-2 ${
          lastResult.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {lastResult.memberPhoto ? (
                <img
                  src={lastResult.memberPhoto}
                  alt={lastResult.memberName}
                  className="w-12 h-12 rounded-full mr-4"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
                  <Fingerprint size={24} />
                </div>
              )}
              <div>
                <p className="font-semibold">{lastResult.memberName || 'Desconocido'}</p>
                <p className="text-sm text-gray-600">{lastResult.message}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {lastResult.timestamp.toLocaleTimeString()}
              </p>
              {lastResult.success ? (
                <CheckCircle size={24} className="text-green-500 ml-auto mt-1" />
              ) : (
                <XCircle size={24} className="text-red-500 ml-auto mt-1" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instrucciones */}
      {!isActive && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 font-medium mb-2">
            📋 Instrucciones:
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Presiona INICIAR para activar el modo continuo</li>
            <li>• Los socios pueden colocar su dedo en el lector en cualquier momento</li>
            <li>• La asistencia se registrará automáticamente</li>
            <li>• Asegúrate de que el servidor C# esté corriendo</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default FingerprintContinuousScanner;