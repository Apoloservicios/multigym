// ============================================
// FingerprintContinuousScanner.tsx
// Componente INDEPENDIENTE para escaneo continuo
// Se integra con AttendanceScanner sin modificarlo
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, Power, PowerOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  
  // Refs para control
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef(false);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopContinuousMode();
    };
  }, []);

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
      return;
    }

    // Inicializar lector
    const initResult = await fingerprintService.initialize();
    if (!initResult.success) {
      setStatus('error');
      setStatusMessage(initResult.error || 'Error al inicializar lector');
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

      // 3. Socio identificado - obtener datos completos
      const memberId = verifyResult.match.memberId;
      const memberName = verifyResult.match.memberName;

      console.log('✅ Socio identificado:', memberName);
      setStatusMessage(`✅ ${memberName}`);

      // Obtener datos completos del socio
      const memberDoc = await getDoc(doc(db, `gyms/${gymId}/members`, memberId));
      
      if (!memberDoc.exists()) {
        setStatus('error');
        setStatusMessage('⚠️  Error: Socio no encontrado');
        setLastResult({
          success: false,
          message: 'Datos del socio no encontrados',
          memberName: memberName,
          timestamp: new Date()
        });

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 2000);

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      const memberData = memberDoc.data();
      const member: MemberInfo = {
        id: memberId,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email,
        photo: memberData.photo || null,
        status: memberData.status,
        totalDebt: memberData.totalDebt || 0,
        hasDebt: memberData.hasDebt || false
      };

      // 4. Verificar deuda (opcional - advertencia)
      if (member.hasDebt && member.totalDebt && member.totalDebt > 0) {
        console.warn(`⚠️  ${memberName} tiene deuda de $${member.totalDebt}`);
        // Puedes decidir si bloquear o solo advertir
      }

      // 5. Cargar membresías
      setStatusMessage('📋 Verificando membresías...');
      const memberships = await loadMemberMemberships(memberId);

      if (memberships.length === 0) {
        setStatus('error');
        setStatusMessage('⚠️  Sin membresías activas');
        setLastResult({
          success: false,
          message: 'No tiene membresías activas',
          memberName: `${member.firstName} ${member.lastName}`,
          memberPhoto: member.photo,
          timestamp: new Date()
        });

        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);

        isScanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // 6. Registrar asistencia con la primera membresía activa
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

        setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));

        setTimeout(() => {
          setStatus('ready');
          setStatusMessage('✅ Listo - Esperando huella...');
        }, 3000);
      }

    } catch (error: any) {
      console.error('❌ Error en performScan:', error);
      setStatus('error');
      setStatusMessage('❌ Error inesperado');
      
      setStats(prev => ({ ...prev, total: prev.total + 1, errors: prev.errors + 1 }));
      
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
        
        if (maxClasses === 0 || classesUsed < maxClasses) {
          memberships.push({
            id: doc.id,
            activityId: data.activityId,
            activityName: data.activityName || 'Membresía',
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
      console.error('Error cargando membresías:', error);
      return [];
    }
  };

  /**
   * Registrar asistencia
   */
  const registerAttendance = async (member: MemberInfo, membership: MembershipInfo) => {
    try {
      // Crear registro de asistencia
      const attendanceRef = collection(db, `gyms/${gymId}/attendance`);
      await addDoc(attendanceRef, {
        memberId: member.id,
        membershipId: membership.id,
        activityId: membership.activityId || null,
        activityName: membership.activityName,
        memberName: `${member.firstName} ${member.lastName}`,
        timestamp: serverTimestamp(),
        method: 'fingerprint_continuous',
        status: 'success',
        registeredBy: 'system'
      });

      // Actualizar contador de clases usadas en la membresía
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membership.id);
      await updateDoc(membershipRef, {
        classesUsed: (membership.classesUsed || 0) + 1,
        currentAttendances: (membership.currentAttendances || 0) + 1,
        lastAttendance: serverTimestamp()
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error registrando asistencia:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Renderizar indicador de estado
   */
  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'text-gray-400';
      case 'ready': return 'text-green-500';
      case 'capturing': return 'text-blue-500 animate-pulse';
      case 'verifying': return 'text-yellow-500 animate-pulse';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusBgColor = () => {
    switch (status) {
      case 'ready': return 'bg-green-50';
      case 'capturing': return 'bg-blue-50';
      case 'verifying': return 'bg-yellow-50';
      case 'success': return 'bg-green-50';
      case 'error': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  };

  // Render principal
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header con botón de toggle */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint size={32} className="text-white" />
            <div>
              <h2 className="text-xl font-semibold text-white">Modo Continuo</h2>
              <p className="text-blue-100 text-sm">Escaneo automático de huellas</p>
            </div>
          </div>
          
          <button
            onClick={continuousMode ? stopContinuousMode : startContinuousMode}
            disabled={isScanning && !continuousMode}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg ${
              continuousMode
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-50 text-blue-600'
            } ${isScanning && !continuousMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {continuousMode ? (
              <>
                <PowerOff size={20} />
                Detener
              </>
            ) : (
              <>
                <Power size={20} />
                Iniciar
              </>
            )}
          </button>
        </div>

        {/* Estadísticas */}
        {continuousMode && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-blue-100">Total</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.success}</div>
              <div className="text-xs text-blue-100">Exitosos</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.errors}</div>
              <div className="text-xs text-blue-100">Errores</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Indicador visual de estado */}
        <div className={`flex flex-col items-center justify-center p-8 rounded-lg ${getStatusBgColor()}`}>
          <Fingerprint size={120} className={getStatusColor()} />
          <p className="mt-4 text-lg font-medium text-gray-900">
            {statusMessage || (continuousMode ? 'Inicializando...' : 'Presiona Iniciar para activar')}
          </p>
          {isScanning && (
            <div className="flex gap-2 mt-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>

        {/* Último resultado */}
        {lastResult && (
          <div className={`mt-6 p-4 rounded-lg border ${
            lastResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 rounded-full p-2 ${
                lastResult.success
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600'
              }`}>
                {lastResult.success ? <CheckCircle size={24} /> : <XCircle size={24} />}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={`text-base font-medium ${
                      lastResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {lastResult.success ? '✅ Registro exitoso' : '❌ Error'}
                    </h3>
                    
                    {lastResult.memberName && (
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {lastResult.memberName}
                      </p>
                    )}
                    
                    <p className={`mt-1 text-sm ${
                      lastResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {lastResult.message}
                    </p>
                    
                    <p className="mt-2 text-xs text-gray-500">
                      {lastResult.timestamp.toLocaleTimeString()}
                    </p>
                  </div>

                  {lastResult.memberPhoto && (
                    <img 
                      src={lastResult.memberPhoto} 
                      alt="Socio"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">
                ℹ️  ¿Cómo funciona?
              </p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Click en "Iniciar" para activar el lector</li>
                <li>• El sistema estará siempre listo para escanear</li>
                <li>• Los socios solo colocan su dedo</li>
                <li>• La asistencia se registra automáticamente</li>
                <li>• Después de cada registro, vuelve a estar listo</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Estado del servidor */}
        {!continuousMode && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              ⚠️  Asegúrate de que el servidor esté corriendo en puerto 3001
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FingerprintContinuousScanner;