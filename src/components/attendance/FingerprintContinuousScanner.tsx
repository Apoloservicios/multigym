// ============================================
// FingerprintContinuousScanner.tsx - VERSIÓN MEJORADA
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, Power, PowerOff, CheckCircle, XCircle, AlertCircle, Volume2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { fingerprintService } from '../../services/fingerprint.service';

interface Props {
  gymId: string;
  onAttendanceRegistered?: () => void;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo?: string | null;
  status?: string;
  totalDebt?: number;
  hasDebt?: boolean;
}

interface MembershipInfo {
  id: string;
  activityId?: string;
  activityName: string;
  currentAttendances: number;
  maxAttendances: number;
  endDate: Date;
  status: string;
  classesUsed?: number;
}

interface ScanResult {
  success: boolean;
  message: string;
  memberName?: string;
  memberPhoto?: string | null;
  timestamp: Date;
  error?: string;
}

const FingerprintContinuousScanner: React.FC<Props> = ({ gymId, onAttendanceRegistered }) => {
  // Estados principales
  const [continuousMode, setContinuousMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'capturing' | 'verifying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  
  // NUEVO: Estado para selección de membresía
  const [showMembershipSelector, setShowMembershipSelector] = useState(false);
  const [pendingMember, setPendingMember] = useState<MemberInfo | null>(null);
  const [availableMemberships, setAvailableMemberships] = useState<MembershipInfo[]>([]);
  
  // NUEVO: Estado para sonidos
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Refs para control
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef(false);

  // NUEVO: Referencias de audio
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopContinuousMode();
    };
  }, []);

  // NUEVO: Inicializar audios
  useEffect(() => {
    // Sonido de éxito (tono agradable)
    successAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDCB0fPTgjMGHG7C7+OZUBAKUH') || null;
    
    // Sonido de error (tono de alerta)
    errorAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICAqqqqgICAqqqqgICAgICAgICAqqqqgICAqqqqgICAgICAgICAqqqqgICAqqqqgICAgICAgICAqqqqgICAqqqqgICAqqqqgICAqqqqgICAqqqqgICAgICAgICAgICAgICAgICAgICAgICA') || null;
  }, []);

  /**
   * NUEVO: Reproducir sonido
   */
  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    
    try {
      if (type === 'success' && successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current.play().catch(err => console.log('Error reproduciendo sonido:', err));
      } else if (type === 'error' && errorAudioRef.current) {
        errorAudioRef.current.currentTime = 0;
        errorAudioRef.current.play().catch(err => console.log('Error reproduciendo sonido:', err));
      }
    } catch (error) {
      console.log('Error con audio:', error);
    }
  };

  /**
   * Iniciar modo de escaneo continuo
   */
  const startContinuousMode = async () => {
    console.log('🚀 Iniciando modo de escaneo continuo...');
    
    // Verificar servidor
    setStatus('ready');
    setStatusMessage('Verificando servidor...');
    
    const isOnline = await fingerprintService.checkServerStatus();
    if (!isOnline) {
      setStatus('error');
      setStatusMessage('❌ Servidor no disponible. Inicia el servidor de huellas.');
      playSound('error');
      return;
    }

    // Inicializar lector
    const initResult = await fingerprintService.initialize();
    if (!initResult.success) {
      setStatus('error');
      setStatusMessage(initResult.error || 'Error al inicializar lector');
      playSound('error');
      return;
    }

    // Resetear estadísticas
    setStats({ total: 0, success: 0, errors: 0 });

    // Activar modo continuo
    setContinuousMode(true);
    setStatus('ready');
    setStatusMessage('✅ Listo - Esperando huella...');
    
    // Iniciar loop de escaneo
    startScanningLoop();
  };

  /**
   * Loop de escaneo continuo
   */
  const startScanningLoop = () => {
    // Evitar múltiples loops
    if (scanIntervalRef.current) return;

    // Función que se ejecuta cada 2 segundos
    const scanLoop = async () => {
      // Si ya está escaneando, saltar esta iteración
      if (isScanningRef.current) {
        return;
      }

      // Si no está en modo continuo, detener
      if (!continuousMode) {
        stopContinuousMode();
        return;
      }

      await performScan();
    };

    // Ejecutar cada 2 segundos
    scanIntervalRef.current = setInterval(scanLoop, 2000);
    
    // También ejecutar inmediatamente la primera vez
    performScan();
  };

  /**
   * Realizar un escaneo completo
   */
  const performScan = async () => {
    if (isScanningRef.current) return;
    
    isScanningRef.current = true;
    setIsScanning(true);

    try {
      // 1. Capturar huella
      setStatus('capturing');
      setStatusMessage('👆 Coloca tu dedo en el lector...');
      
      const captureResult = await fingerprintService.capture();

      if (!captureResult.success || !captureResult.data) {
        // Error silencioso - no hay dedo en el lector, seguir esperando
        setStatus('ready');
        setStatusMessage('✅ Listo - Esperando huella...');
        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // 2. Huella capturada - verificar
      console.log('✅ Huella capturada, verificando...');
      setStatus('verifying');
      setStatusMessage('🔍 Verificando identidad...');

      const verifyResult = await fingerprintService.verifyFingerprint(
        gymId,
        captureResult.data.template
      );

      if (!verifyResult.success || !verifyResult.match) {
        // Huella no reconocida
        setStatus('error');
        setStatusMessage('❌ Huella no reconocida');
        setLastResult({
          success: false,
          message: 'Huella no reconocida',
          timestamp: new Date()
        });

        playSound('error'); // NUEVO: Reproducir sonido de error
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        // Volver a esperar después de 2 segundos
        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 2000);

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // 3. Identificar socio
      const memberId = verifyResult.match.memberId;
      console.log(`✅ Socio identificado: ${memberId}`);
      
      setStatusMessage('👤 Cargando información del socio...');

      const member = await loadMemberInfo(memberId);
      if (!member) {
        setStatus('error');
        setStatusMessage('❌ Error al cargar información del socio');
        playSound('error');
        
        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 2000);

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // MEJORADO: Verificar estado del socio
      if (member.status === 'inactive') {
        setStatus('error');
        setStatusMessage('❌ Socio inactivo');
        setLastResult({
          success: false,
          message: 'El socio está inactivo',
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

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // MEJORADO: Verificar deuda
      if (member.hasDebt && member.totalDebt && member.totalDebt > 0) {
        setStatus('error');
        setStatusMessage(`❌ Tiene deuda pendiente: $${member.totalDebt}`);
        setLastResult({
          success: false,
          message: `Deuda pendiente: $${member.totalDebt}`,
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

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // 4. Cargar membresías activas
      setStatusMessage('📋 Verificando membresías...');

      const memberships = await loadMemberMemberships(memberId);
      
      // MEJORADO: Manejo de casos sin membresías
      if (memberships.length === 0) {
        setStatus('error');
        setStatusMessage('❌ No hay membresías activas');
        setLastResult({
          success: false,
          message: 'No tiene membresías activas',
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        playSound('error');
        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        // CORREGIDO: No detener el modo continuo, solo esperar y continuar
        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
          isScanningRef.current = false;
          setIsScanning(false);
        }, 3000);

        return; // IMPORTANTE: return aquí, no cerrar el finally
      }

      // NUEVO: Si tiene múltiples membresías, mostrar selector
      if (memberships.length > 1) {
        console.log(`🔄 Socio con ${memberships.length} membresías activas - Mostrando selector`);
        
        setPendingMember(member);
        setAvailableMemberships(memberships);
        setShowMembershipSelector(true);
        
        setStatus('ready');
        setStatusMessage('⏸️ Esperando selección de membresía...');
        
        // Pausar el escaneo mientras se selecciona
        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // 5. Registrar asistencia con la primera (y única) membresía
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

        playSound('success'); // NUEVO: Reproducir sonido de éxito
        setStats(prev => ({ ...prev, total: prev.total + 1, success: prev.success + 1 }));

        // Notificar callback
        if (onAttendanceRegistered) {
          onAttendanceRegistered();
        }

        // Volver a esperar después de 3 segundos
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

        // CORREGIDO: Continuar el escaneo después del error
        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
      }

    } catch (error: any) {
      console.error('❌ Error en performScan:', error);
      setStatus('error');
      setStatusMessage('❌ Error inesperado');
      
      playSound('error');
      setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));
      
      // CORREGIDO: Continuar después de error inesperado
      setTimeout(() => {
        setStatus('ready');
        setStatusMessage('✅ Listo - Esperando huella...');
      }, 2000);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  };

  /**
   * NUEVO: Manejar selección de membresía
   */
  const handleMembershipSelection = async (membership: MembershipInfo) => {
    if (!pendingMember) return;

    setShowMembershipSelector(false);
    setStatus('verifying');
    setStatusMessage('💾 Registrando asistencia...');

    const attendanceResult = await registerAttendance(pendingMember, membership);

    if (attendanceResult.success) {
      setStatus('success');
      setStatusMessage('✅ Asistencia registrada');
      setLastResult({
        success: true,
        message: `Asistencia registrada - ${membership.activityName}`,
        memberName: `${pendingMember.firstName} ${pendingMember.lastName}`,
        memberPhoto: pendingMember.photo,
        timestamp: new Date()
      });

      playSound('success');
      setStats(prev => ({ ...prev, total: prev.total + 1, success: prev.success + 1 }));

      if (onAttendanceRegistered) {
        onAttendanceRegistered();
      }
    } else {
      setStatus('error');
      setStatusMessage('❌ Error al registrar');
      setLastResult({
        success: false,
        message: attendanceResult.error || 'Error al registrar asistencia',
        memberName: `${pendingMember.firstName} ${pendingMember.lastName}`,
        memberPhoto: pendingMember.photo,
        timestamp: new Date()
      });

      playSound('error');
      setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));
    }

    // Limpiar estado pendiente
    setPendingMember(null);
    setAvailableMemberships([]);

    // Volver a modo listo después de 3 segundos
    setTimeout(() => {
      setStatus('ready');
      setStatusMessage('✅ Listo - Esperando huella...');
    }, 3000);
  };

  /**
   * NUEVO: Cancelar selección de membresía
   */
  const handleCancelSelection = () => {
    setShowMembershipSelector(false);
    setPendingMember(null);
    setAvailableMemberships([]);
    
    setStatus('ready');
    setStatusMessage('✅ Listo - Esperando huella...');
  };

  /**
   * Detener modo continuo
   */
  const stopContinuousMode = () => {
    console.log('🛑 Deteniendo modo de escaneo continuo...');
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    setContinuousMode(false);
    setStatus('idle');
    setStatusMessage('');
    isScanningRef.current = false;
    setIsScanning(false);
    
    // Limpiar selector si está abierto
    setShowMembershipSelector(false);
    setPendingMember(null);
    setAvailableMemberships([]);
  };

  /**
   * Cargar información del socio
   */
  const loadMemberInfo = async (memberId: string): Promise<MemberInfo | null> => {
    try {
      const memberRef = doc(db, `gyms/${gymId}/members`, memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) {
        return null;
      }

      const data = memberSnap.data();
      
      return {
        id: memberSnap.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        photo: data.photo || null,
        status: data.status || 'active',
        totalDebt: data.totalDebt || 0,
        hasDebt: data.hasDebt || false
      };
    } catch (error) {
      console.error('Error loading member:', error);
      return null;
    }
  };

  /**
   * Cargar membresías de un socio
   */
  const loadMemberMemberships = async (memberId: string): Promise<MembershipInfo[]> => {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const q = query(
        membershipsRef,
        where('memberId', '==', memberId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      
      const memberships: MembershipInfo[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Verificar que tenga clases disponibles
        const classesUsed = data.classesUsed || data.currentAttendances || 0;
        const maxClasses = data.maxAttendances || data.classLimit || 0;
        
        if (classesUsed < maxClasses) {
          memberships.push({
            id: doc.id,
            activityId: data.activityId,
            activityName: data.activityName || 'Sin actividad',
            currentAttendances: classesUsed,
            maxAttendances: maxClasses,
            endDate: data.endDate?.toDate() || new Date(),
            status: data.status,
            classesUsed: classesUsed
          });
        }
      });
      
      return memberships;
    } catch (error) {
      console.error('Error loading memberships:', error);
      return [];
    }
  };

  /**
   * Registrar asistencia
   */
  const registerAttendance = async (
    member: MemberInfo,
    membership: MembershipInfo
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Crear registro de asistencia
      const attendanceData = {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberPhoto: member.photo || null,
        membershipId: membership.id,
        activityId: membership.activityId || null,
        activityName: membership.activityName,
        date: serverTimestamp(),
        method: 'fingerprint',
        gymId: gymId,
        status: 'completed'
      };

      await addDoc(collection(db, `gyms/${gymId}/attendances`), attendanceData);

      // Actualizar contador de asistencias en la membresía
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membership.id);
      const newCount = (membership.classesUsed || 0) + 1;
      
      await updateDoc(membershipRef, {
        classesUsed: newCount,
        currentAttendances: newCount,
        lastAttendance: serverTimestamp()
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error registering attendance:', error);
      return { 
        success: false, 
        error: error.message || 'Error al registrar asistencia' 
      };
    }
  };

  /**
   * Formatear timestamp
   */
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Fingerprint className="text-purple-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Modo Continuo</h2>
            <p className="text-sm text-gray-500">Escaneo automático de huellas</p>
          </div>
        </div>

        {/* NUEVO: Toggle de sonido */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-lg transition-colors ${
            soundEnabled 
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
        >
          <Volume2 size={20} />
        </button>
      </div>

      {/* Control Button */}
      <div className="mb-6">
        {!continuousMode ? (
          <button
            onClick={startContinuousMode}
            disabled={isScanning}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg 
                     hover:from-green-600 hover:to-green-700 transition-all duration-200 
                     flex items-center justify-center gap-2 font-semibold text-lg shadow-lg
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Power size={24} />
            Iniciar Modo Continuo
          </button>
        ) : (
          <button
            onClick={stopContinuousMode}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-lg 
                     hover:from-red-600 hover:to-red-700 transition-all duration-200 
                     flex items-center justify-center gap-2 font-semibold text-lg shadow-lg"
          >
            <PowerOff size={24} />
            Detener Modo Continuo
          </button>
        )}
      </div>

      {/* Status Display */}
      {status !== 'idle' && (
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          status === 'success' ? 'bg-green-50 border-green-300' :
          status === 'error' ? 'bg-red-50 border-red-300' :
          status === 'verifying' ? 'bg-blue-50 border-blue-300' :
          status === 'capturing' ? 'bg-yellow-50 border-yellow-300' :
          'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center gap-3">
            {status === 'success' && <CheckCircle className="text-green-600" size={24} />}
            {status === 'error' && <XCircle className="text-red-600" size={24} />}
            {(status === 'verifying' || status === 'capturing') && (
              <div className="animate-spin">
                <AlertCircle className="text-blue-600" size={24} />
              </div>
            )}
            {status === 'ready' && <Fingerprint className="text-gray-600" size={24} />}
            
            <p className={`font-medium ${
              status === 'success' ? 'text-green-700' :
              status === 'error' ? 'text-red-700' :
              status === 'verifying' ? 'text-blue-700' :
              status === 'capturing' ? 'text-yellow-700' :
              'text-gray-700'
            }`}>
              {statusMessage}
            </p>
          </div>
        </div>
      )}

      {/* NUEVO: Selector de Membresía */}
      {showMembershipSelector && pendingMember && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">
            {pendingMember.firstName} {pendingMember.lastName} - Selecciona Membresía
          </h3>
          <div className="space-y-2">
            {availableMemberships.map((membership) => (
              <button
                key={membership.id}
                onClick={() => handleMembershipSelection(membership)}
                className="w-full p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 
                         transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{membership.activityName}</p>
                    <p className="text-sm text-gray-600">
                      Clases: {membership.currentAttendances} / {membership.maxAttendances}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(membership.endDate).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleCancelSelection}
            className="mt-3 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 
                     transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Statistics */}
      {continuousMode && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{stats.success}</p>
            <p className="text-sm text-green-600">Exitosos</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
            <p className="text-sm text-red-600">Errores</p>
          </div>
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className={`p-4 rounded-lg ${
          lastResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {lastResult.memberPhoto && (
              <img 
                src={lastResult.memberPhoto} 
                alt="Foto" 
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              {lastResult.memberName && (
                <p className="font-semibold text-gray-800">{lastResult.memberName}</p>
              )}
              <p className={`text-sm ${lastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {lastResult.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatTime(lastResult.timestamp)}
              </p>
            </div>
            {lastResult.success ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <XCircle className="text-red-600" size={20} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FingerprintContinuousScanner;