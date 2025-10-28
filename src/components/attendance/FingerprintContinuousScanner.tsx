// ============================================
// ESCÁNER CONTINUO DE HUELLAS - VERSIÓN CORREGIDA
// Archivo: src/components/attendance/FingerprintContinuousScanner.tsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, Power, CheckCircle, XCircle, Users, TrendingUp } from 'lucide-react';
import fingerprintService from '../../services/fingerprintService';
import useAuth from '../../hooks/useAuth';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import attendanceService from '../../services/attendance.service';

interface Props {
  onAttendanceRegistered?: () => void;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photo?: string | null;
}

interface MembershipInfo {
  id: string;
  activityId: string;
  activityName: string;
  membershipType: string;
  limitAttendances?: number;
  usedAttendances?: number;
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

type Status = 'stopped' | 'initializing' | 'ready' | 'scanning' | 'processing' | 'success' | 'error';

const FingerprintContinuousScanner: React.FC<Props> = ({ onAttendanceRegistered }) => {
  const { gymData } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<Status>('stopped');
  const [statusMessage, setStatusMessage] = useState('Presiona INICIAR para comenzar');
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, success: 0, errors: 0 });
  
  const scanningRef = useRef(false);
  const audioRef = useRef<{ success: HTMLAudioElement; error: HTMLAudioElement } | null>(null);

  // Cargar sonidos
  useEffect(() => {
    audioRef.current = {
      success: new Audio('/sounds/success.mp3'),
      error: new Audio('/sounds/error.mp3')
    };
  }, []);

  const playSound = (type: 'success' | 'error') => {
    if (audioRef.current) {
      audioRef.current[type].play().catch(err => 
        console.log('No se pudo reproducir el sonido:', err)
      );
    }
  };

  const startScanning = async () => {
    if (!gymData?.id) {
      alert('Error: No hay gimnasio seleccionado');
      return;
    }

    setIsActive(true);
    scanningRef.current = true;
    setStatus('initializing');
    setStatusMessage('🔌 Inicializando sistema...');

    // Verificar servidor
    const serverOk = await fingerprintService.checkServerStatus();
    if (!serverOk) {
      setStatus('error');
      setStatusMessage('❌ Servidor no disponible');
      setIsActive(false);
      scanningRef.current = false;
      return;
    }

    // Inicializar lector
    const initResult = await fingerprintService.initialize();
    if (!initResult.success) {
      setStatus('error');
      setStatusMessage(`❌ Error: ${initResult.error}`);
      setIsActive(false);
      scanningRef.current = false;
      return;
    }

    setStatus('ready');
    setStatusMessage('✅ Listo - Esperando huella...');
    
    // Iniciar loop de escaneo
    scanLoop();
  };

  const stopScanning = () => {
    scanningRef.current = false;
    setIsActive(false);
    setStatus('stopped');
    setStatusMessage('⏹️ Detenido - Presiona INICIAR para reanudar');
  };

  const scanLoop = async () => {
    while (scanningRef.current) {
      if (!gymData?.id) {
        stopScanning();
        return;
      }

      try {
        // Estado: Escaneando
        setStatus('scanning');
        setStatusMessage('👆 Coloca tu dedo...');

        // ✅ CORREGIDO: Pasar gymId al método capture
        const captureResult = await fingerprintService.capture(gymData.id);

        if (!captureResult.success || !captureResult.data) {
          // Error en captura - continuar esperando
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Huella capturada - procesar
        setStatus('processing');
        setStatusMessage('🔍 Identificando...');

        await processFingerprint(captureResult.data.template);

        // Pequeña pausa antes del siguiente escaneo
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error('Error en scanLoop:', error);
        setStatus('error');
        setStatusMessage(`❌ Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  };

  const processFingerprint = async (template: string) => {
    if (!gymData?.id) return;

    try {
      // ✅ CORREGIDO: Solo pasar gymId y template
      const verifyResult = await fingerprintService.verifyAndRegisterAttendance(
        gymData.id,
        template
      );

      // ✅ CORREGIDO: Acceder a las propiedades correctas sin 'match'
      if (!verifyResult.success || !verifyResult.memberData) {
        setStatus('error');
        setStatusMessage('❌ Huella no reconocida');
        setLastResult({
          success: false,
          message: verifyResult.error || 'Huella no registrada en el sistema',
          timestamp: new Date()
        });

        playSound('error');
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
        return;
      }

      // Socio identificado
      const member: MemberInfo = {
        id: verifyResult.memberData.id,
        firstName: verifyResult.memberData.firstName,
        lastName: verifyResult.memberData.lastName,
        email: verifyResult.memberData.email,
        photo: verifyResult.memberData.photo
      };

      setStatusMessage('📋 Cargando membresías...');

      // Obtener membresías activas
      const memberships = await getMemberMemberships(member.id);

      if (memberships.length === 0) {
        setStatus('error');
        setStatusMessage('❌ Sin membresías activas');
        setLastResult({
          success: false,
          message: 'Este socio no tiene membresías activas',
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        playSound('error');
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
        return;
      }

      // ✅ CORREGIDO: Usar directamente verifyResult.memberData (ya no hay .match)
      if (memberships.length > 1) {
        // Múltiples membresías - detener y solicitar selección manual
        setStatus('error');
        setStatusMessage('⚠️ Múltiples membresías - Usar escáner manual');
        setLastResult({
          success: false,
          message: `${member.firstName} tiene ${memberships.length} membresías. Use el escáner manual.`,
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        playSound('error');
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
        return;
      }

      // Registrar asistencia con la primera (y única) membresía
      const membership = memberships[0];
      
      setStatusMessage('💾 Registrando asistencia...');
      
      const attendanceResult = await registerAttendance(member, membership);

      if (attendanceResult.success) {
        setStatus('success');
        setStatusMessage('✅ Asistencia registrada');
        setLastResult({
          success: true,
          message: `Asistencia registrada - ${membership.activityName}`,
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        playSound('success');
        setStats(prev => ({ ...prev, total: prev.total + 1, success: prev.success + 1 }));

        if (onAttendanceRegistered) {
          onAttendanceRegistered();
        }

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMessage('❌ Error al registrar');
        setLastResult({
          success: false,
          message: attendanceResult.error || 'Error al registrar asistencia',
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        playSound('error');
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
      }

    } catch (error: any) {
      console.error('Error en processFingerprint:', error);
      setStatus('error');
      setStatusMessage(`❌ Error: ${error.message}`);
      
      setLastResult({
        success: false,
        message: error.message || 'Error al procesar huella',
        timestamp: new Date()
      });

      playSound('error');
      setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

      setTimeout(() => {
        setStatus('ready');
        setStatusMessage('✅ Listo - Esperando huella...');
      }, 3000);
    }
  };

  const getMemberMemberships = async (memberId: string): Promise<MembershipInfo[]> => {
    if (!gymData?.id) return [];

    try {
      const membershipsRef = collection(db, `gyms/${gymData.id}/memberships`);
      const q = query(
        membershipsRef,
        where('memberId', '==', memberId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      
      const memberships: MembershipInfo[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Obtener nombre de actividad
        let activityName = 'Actividad desconocida';
        if (data.activityId) {
          const activityRef = doc(db, `gyms/${gymData.id}/activities`, data.activityId);
          const activitySnap = await getDoc(activityRef);
          if (activitySnap.exists()) {
            activityName = activitySnap.data().name;
          }
        }

        memberships.push({
          id: docSnap.id,
          activityId: data.activityId,
          activityName,
          membershipType: data.membershipType,
          limitAttendances: data.limitAttendances,
          usedAttendances: data.usedAttendances || 0
        });
      }

      return memberships;

    } catch (error) {
      console.error('Error obteniendo membresías:', error);
      return [];
    }
  };

  const registerAttendance = async (
    member: MemberInfo,
    membership: MembershipInfo
  ): Promise<{ success: boolean; error?: string }> => {
    if (!gymData?.id) {
      return { success: false, error: 'No hay gimnasio seleccionado' };
    }

    try {
      // ✅ CORREGIDO: Pasar objeto con todos los datos necesarios
      const result = await attendanceService.registerAttendance(gymData.id, {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberFirstName: member.firstName,
        memberLastName: member.lastName,
        memberEmail: member.email || 'sin-email@multigym.com',
        membershipId: membership.id,
        activityId: membership.activityId || '',
        activityName: membership.activityName,
        notes: 'Registro automático por huella digital'
      });

      return { 
        success: result.success,
        error: result.error
      };

    } catch (error: any) {
      console.error('Error registrando asistencia:', error);
      return { 
        success: false, 
        error: error.message || 'Error al registrar asistencia' 
      };
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'stopped': return 'gray';
      case 'initializing': return 'yellow';
      case 'ready': return 'green';
      case 'scanning': return 'blue';
      case 'processing': return 'purple';
      case 'success': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Fingerprint className="mr-2" size={28} />
          Escáner Automático de Huellas
        </h2>
        <button
          onClick={isActive ? stopScanning : startScanning}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
            isActive 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          <Power className="mr-2" size={20} />
          {isActive ? 'DETENER' : 'INICIAR'}
        </button>
      </div>

      {/* Estado actual */}
      <div className={`mb-6 p-6 rounded-lg bg-${getStatusColor()}-50 border-2 border-${getStatusColor()}-200`}>
        <p className="text-center text-xl font-semibold text-gray-800">
          {statusMessage}
        </p>
      </div>

      {/* Último resultado */}
      {lastResult && (
        <div className={`mb-6 p-4 rounded-lg ${
          lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        } border-2`}>
          <div className="flex items-start">
            {lastResult.success ? (
              <CheckCircle className="text-green-500 mr-3 flex-shrink-0" size={24} />
            ) : (
              <XCircle className="text-red-500 mr-3 flex-shrink-0" size={24} />
            )}
            <div className="flex-1">
              <p className="font-semibold text-gray-800">
                {lastResult.memberName || 'Desconocido'}
              </p>
              <p className="text-sm text-gray-600">{lastResult.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {lastResult.timestamp.toLocaleString('es-AR')}
              </p>
            </div>
            {lastResult.memberPhoto && (
              <img
                src={lastResult.memberPhoto}
                alt={lastResult.memberName}
                className="w-16 h-16 rounded-full object-cover ml-3"
              />
            )}
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <Users className="mx-auto mb-2 text-blue-500" size={28} />
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          <p className="text-sm text-gray-600">Total</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <CheckCircle className="mx-auto mb-2 text-green-500" size={28} />
          <p className="text-2xl font-bold text-green-600">{stats.success}</p>
          <p className="text-sm text-gray-600">Exitosas</p>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <XCircle className="mx-auto mb-2 text-red-500" size={28} />
          <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
          <p className="text-sm text-gray-600">Errores</p>
        </div>
      </div>
    </div>
  );
};

export default FingerprintContinuousScanner;