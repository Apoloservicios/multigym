// src/components/attendance/AttendanceScanner.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, CameraOff, Clock, AlertCircle, CheckCircle, XCircle, Search, User, Calendar, Filter,RefreshCw } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import useAuth from '../../hooks/useAuth';
import { registerAttendance } from '../../services/attendance.service';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
// Importar tipos correctos
import { Attendance } from '../../types/attendance.types';

interface ScanResult {
  success: boolean;
  message: string;
  timestamp: Date;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    photo: string | null;
    activeMemberships?: number;
  } | null;
  error?: string;
}

interface AttendanceRecord {
  id: string;
  memberId: string;
  member: any;
  timestamp: Date;
  status: string;
  activityName: string;
  error?: string;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo?: string | null;
  lastAttendance?: Date;
  activeMemberships?: number;
}

const AttendanceScanner: React.FC = () => {
  const { gymData } = useAuth();
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [processingQR, setProcessingQR] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Estados para el registro manual mejorado
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberInfo[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  
  // Estados para el historial
  const [showTodayOnly, setShowTodayOnly] = useState<boolean>(true);
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar asistencias del día al inicializar
  useEffect(() => {
    loadTodayAttendances();
  }, [gymData?.id]);

  // Buscar miembros con debounce mejorado
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchTerm.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        searchMembers();
      }, 300); // Buscar después de 300ms de no escribir
    } else {
      setSearchResults([]);
      setSearchError(null);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm]);

  // Cargar asistencias del día actual
  const loadTodayAttendances = async () => {
    if (!gymData?.id) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Obtener asistencias de todos los miembros del gimnasio
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);

      const allAttendances: AttendanceRecord[] = [];

      // Para cada miembro, obtener sus asistencias del día
      for (const memberDoc of membersSnapshot.docs) {
        const attendancesRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/attendances`);
        const q = query(
          attendancesRef,
          where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
          where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
          orderBy('timestamp', 'desc')
        );

        const attendancesSnapshot = await getDocs(q);
        
        attendancesSnapshot.forEach(doc => {
          const data = doc.data();
          allAttendances.push({
            id: doc.id,
            memberId: memberDoc.id,
            member: {
              firstName: memberDoc.data().firstName || '',
              lastName: memberDoc.data().lastName || ''
            },
            timestamp: data.timestamp.toDate(),
            status: data.status || 'success',
            activityName: data.activityName || 'General',
            error: data.error
          });
        });
      }

      // Ordenar por timestamp más reciente primero
      allAttendances.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setTodayAttendances(allAttendances);
    } catch (error) {
      console.error('Error loading today attendances:', error);
    }
  };

  // Limpiar intervalo de escaneo al desmontar
  useEffect(() => {
    return () => {
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Función para capturar y procesar la imagen de la cámara
  const scanQRCode = useCallback(async () => {
    if (processingQR || !webcamRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    
    const image = new Image();
    image.src = imageSrc;
    
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        setScanning(false);
        if (scanInterval.current) {
          clearInterval(scanInterval.current);
          scanInterval.current = null;
        }
        procesarCodigoQR(code.data);
      }
    };
  }, [processingQR]);

  // Función para iniciar el escaneo
  const startScanning = () => {
    setScanResult(null);
    setCameraError(null);
    setShowManualEntry(false);
    
    try {
      setScanning(true);
      scanInterval.current = setInterval(scanQRCode, 500);
    } catch (err: any) {
      console.error("Error al iniciar el escáner:", err);
      setCameraError(`Error al iniciar el escáner: ${err.message}`);
      setScanning(false);
    }
  };
  
  // Función para detener el escaneo
  const stopScanning = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    setScanning(false);
  };

  // Función para cambiar al modo de entrada manual
  const toggleManualEntry = () => {
    stopScanning();
    setShowManualEntry(!showManualEntry);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedMember(null);
    setScanResult(null);
    setSearchError(null);
    setShowConfirmation(false);
  };

  // Función mejorada para buscar miembros (búsqueda más rápida)
  const searchMembers = async () => {
    if (!gymData?.id || searchTerm.trim().length < 2) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    
    try {
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      // Optimización: solo obtener campos necesarios para la búsqueda
      const querySnapshot = await getDocs(membersRef);
      
      const term = searchTerm.toLowerCase().trim();
      const results: MemberInfo[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const firstName = String(data.firstName || "").toLowerCase();
        const lastName = String(data.lastName || "").toLowerCase();
        const email = String(data.email || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        
        if (firstName.includes(term) || lastName.includes(term) || 
            email.includes(term) || fullName.includes(term)) {
          results.push({
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            photo: data.photo || null,
            lastAttendance: data.lastAttendance ? data.lastAttendance.toDate() : undefined,
            activeMemberships: 1 // Esto se podría calcular dinámicamente
          });
        }
      });
      
      // Ordenar por relevancia: primero por coincidencia exacta, luego alfabéticamente
      results.sort((a, b) => {
        const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase();
        
        const aExact = aFullName.startsWith(term);
        const bExact = bFullName.startsWith(term);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return aFullName.localeCompare(bFullName);
      });
      
      if (results.length === 0) {
        setSearchError(`No se encontraron miembros que coincidan con "${searchTerm}"`);
      } else {
        setSearchResults(results.slice(0, 10)); // Limitar a 10 resultados para mejor rendimiento
      }
    } catch (error) {
      console.error("Error buscando miembros:", error);
      setSearchError(`Error al buscar miembros: ${error}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Función para mostrar confirmación antes de registrar asistencia
  const selectMemberForConfirmation = (member: MemberInfo) => {
    setSelectedMember(member);
    setShowConfirmation(true);
  };

  // Función para confirmar y registrar asistencia manualmente
  const confirmManualAttendance = async () => {
    if (!gymData?.id || !selectedMember) return;
    
    setProcessingQR(true);
    setShowConfirmation(false);
    
    try {
      // Verificar si ya tiene asistencia hoy
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      
      const attendancesRef = collection(db, `gyms/${gymData.id}/members/${selectedMember.id}/attendances`);
      const todayQ = query(
        attendancesRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const todaySnapshot = await getDocs(todayQ);
      
      if (!todaySnapshot.empty) {
        // Verificar si ya se registró en las últimas 2 horas
        const lastAttendance = todaySnapshot.docs[0].data();
        const lastTime = lastAttendance.timestamp.toDate();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        if (lastTime > twoHoursAgo) {
          throw new Error(`${selectedMember.firstName} ya registró asistencia hoy a las ${lastTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`);
        }
      }
      
      // Obtener membresías activas del socio
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${selectedMember.id}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      // Registrar la asistencia
      const now = new Date();
      const result = await registerAttendance(
        gymData.id,
        selectedMember.id,
        `${selectedMember.firstName} ${selectedMember.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
        // No pasamos notes si no está definido
      );
      
      // Crear objeto de resultado
      const scanResultObj: ScanResult = {
        success: result.status === 'success',
        message: result.status === 'success' 
          ? `¡Asistencia registrada para ${selectedMember.firstName} ${selectedMember.lastName}!`
          : result.error || "Error al registrar asistencia",
        timestamp: now,
        member: {
          id: selectedMember.id,
          firstName: selectedMember.firstName,
          lastName: selectedMember.lastName,
          photo: selectedMember.photo || null,
          activeMemberships: activeSnap.size
        },
        error: result.status === 'error' ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      // Recargar asistencias del día
      await loadTodayAttendances();
      
      // Actualizar timestamp del último escaneo
      setLastScan(now);
      
      // Limpiar la búsqueda
      setSearchTerm("");
      setSearchResults([]);
      
    } catch (error: any) {
      console.error("Error registrando asistencia:", error);
      
      const errorResult: ScanResult = {
        success: false,
        message: error.message || "Error al registrar asistencia",
        timestamp: new Date(),
        member: null,
        error: error.message
      };
      
      setScanResult(errorResult);
      
    } finally {
      setProcessingQR(false);
      setSelectedMember(null);
    }
  };

  // Función para procesar el código QR leído (con confirmación)
  const procesarCodigoQR = async (decodedText: string) => {
    if (!gymData?.id || processingQR) {
      return;
    }

    try {
      setProcessingQR(true);
      
      // Extraer ID del miembro del QR
      let memberId = "";
      
      try {
        const decoded = atob(decodedText);
        const qrData = JSON.parse(decoded);
        if (qrData && qrData.memberId) {
          memberId = qrData.memberId;
        }
      } catch (e) {
        try {
          const qrData = JSON.parse(decodedText);
          if (qrData && qrData.memberId) {
            memberId = qrData.memberId;
          }
        } catch (e) {
          memberId = decodedText;
        }
      }
      
      if (!memberId) {
        throw new Error("No se pudo extraer un ID del código QR");
      }

      // Verificar que el miembro existe
      const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        throw new Error("Socio no encontrado. ID: " + memberId);
      }

      const memberData = memberSnap.data();
      
      // Verificar si ya tiene asistencia hoy
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      
      const attendancesRef = collection(db, `gyms/${gymData.id}/members/${memberId}/attendances`);
      const todayQ = query(
        attendancesRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const todaySnapshot = await getDocs(todayQ);
      
      if (!todaySnapshot.empty) {
        const lastAttendance = todaySnapshot.docs[0].data();
        const lastTime = lastAttendance.timestamp.toDate();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        if (lastTime > twoHoursAgo) {
          throw new Error(`${memberData.firstName} ya registró asistencia hoy a las ${lastTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`);
        }
      }
      
      // Obtener membresías activas
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      // Registrar la asistencia automáticamente para QR
      console.log('🎯 INICIANDO procesarCodigoQR');
      console.log('QR decodificado:', decodedText);
      console.log('ID del miembro extraído:', memberId);
      console.log('Datos del gimnasio:', gymData);
      
      const now = new Date();
      
      console.log('🚀 Llamando a registerAttendance desde QR con:');
      console.log('- gymId:', gymData.id);
      console.log('- memberId:', memberId);
      console.log('- memberName:', `${memberData.firstName} ${memberData.lastName}`);
      console.log('- membershipId:', membershipDoc.id);
      console.log('- activityName:', membershipData.activityName || "General");
      console.log('- notes: NO SE PASA');
      
      const result = await registerAttendance(
        gymData.id,
        memberId,
        `${memberData.firstName} ${memberData.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
        // No pasamos notes para registros automáticos de QR
      );
      
      console.log('📊 Resultado de registerAttendance QR:', result);
      
      const scanResultObj: ScanResult = {
        success: result.status === 'success',
        message: result.status === 'success' 
          ? `¡Bienvenido/a ${memberData.firstName} ${memberData.lastName}!`
          : result.error || "Error al registrar asistencia",
        timestamp: now,
        member: {
          id: memberId,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          photo: memberData.photo || null,
          activeMemberships: activeSnap.size
        },
        error: result.status === 'error' ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      // Recargar asistencias del día
      await loadTodayAttendances();
      setLastScan(now);
      
    } catch (error: any) {
      console.error("Error procesando QR:", error);
      
      const errorResult: ScanResult = {
        success: false,
        message: error.message || "Error al procesar el código QR",
        timestamp: new Date(),
        member: null,
        error: error.message
      };
      
      setScanResult(errorResult);
      
    } finally {
      setProcessingQR(false);
    }
  };

  // Formatear fecha y hora
  const formatDateTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Manejar error de la cámara
  const handleWebcamError = useCallback((err: string | DOMException) => {
    console.error("Error de cámara:", err);
    setCameraError(`Error al acceder a la cámara: ${err.toString()}`);
    setScanning(false);
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
  }, []);

  // Filtrar asistencias según el filtro seleccionado
  const filteredAttendances = todayAttendances.filter(attendance => {
    if (attendanceFilter === 'all') return true;
    if (attendanceFilter === 'success') return attendance.status === 'success';
    if (attendanceFilter === 'error') return attendance.status === 'error';
    return true;
  });

  // Componente para el escáner QR
  const renderScanner = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 h-64 w-full max-w-md bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
        {scanning ? (
          <div className="w-full h-full relative">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: "environment",
                aspectRatio: 1
              }}
              onUserMediaError={handleWebcamError}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-4 border-blue-500 animate-pulse rounded-lg pointer-events-none"></div>
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500 animate-scan pointer-events-none"></div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
                Enfoca el código QR del socio
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <CameraOff size={64} className="text-gray-400 mb-2" />
            <p className="text-gray-500 text-sm">Cámara inactiva</p>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-md flex justify-center">
        {!scanning ? (
          <button
            onClick={startScanning}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
          >
            <QrCode size={20} className="mr-2" />
            Iniciar Escaneo QR
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors flex items-center justify-center"
          >
            <CameraOff size={20} className="mr-2" />
            Detener Escaneo
          </button>
        )}
      </div>
      
      {lastScan && (
        <div className="mt-4 w-full max-w-md text-center text-sm text-gray-500">
          Último escaneo: {formatDateTime(lastScan)}
        </div>
      )}
    </div>
  );

  // Componente para la entrada manual mejorada
  const renderManualEntry = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar socio (mín. 2 caracteres)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSearching}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            ) : (
              <Search size={18} className="text-gray-400" />
            )}
          </div>
        </div>
        
        {searchTerm.length > 0 && searchTerm.length < 2 && (
          <p className="mt-1 text-xs text-gray-500">Escribe al menos 2 caracteres para buscar</p>
        )}
      </div>
      
      {/* Error de búsqueda */}
      {searchError && (
        <div className="w-full max-w-md p-3 mb-4 bg-red-50 text-red-700 rounded-md">
          <AlertCircle size={18} className="inline-block mr-2" />
          {searchError}
        </div>
      )}
      
      {/* Resultados de búsqueda */}
      {searchResults.length > 0 ? (
        <div className="w-full max-w-md border rounded-md overflow-hidden mt-4">
          <div className="p-2 bg-gray-50 border-b text-sm font-medium">
            {searchResults.length} resultado(s) encontrado(s)
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {searchResults.map(member => (
              <div 
                key={member.id} 
                className="p-3 hover:bg-blue-50 cursor-pointer flex items-center transition-colors"
                onClick={() => selectMemberForConfirmation(member)}
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3">
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{member.firstName} {member.lastName}</div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                  {member.lastAttendance && (
                    <div className="text-xs text-gray-400">
                      Última asistencia: {formatTime(member.lastAttendance)}
                    </div>
                  )}
                </div>
                <div className="text-green-600">
                  <CheckCircle size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  // Modal de confirmación para registro manual
  const renderConfirmationModal = () => {
    if (!showConfirmation || !selectedMember) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3 text-center">
            Confirmar Asistencia
          </h3>
          
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xl">
              {selectedMember.firstName.charAt(0)}{selectedMember.lastName.charAt(0)}
            </div>
          </div>
          
          <p className="text-center text-gray-600 mb-6">
            ¿Confirmas la asistencia de{' '}
            <span className="font-medium">
              {selectedMember.firstName} {selectedMember.lastName}
            </span>?
          </p>
          
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowConfirmation(false);
                setSelectedMember(null);
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmManualAttendance}
              disabled={processingQR}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              {processingQR ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Confirmar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Control de Asistencias</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sección de escáner/entrada manual */}
        <div className="border rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              {showManualEntry ? "Registro Manual" : "Escanear QR"}
            </h3>
            
            <button
              onClick={toggleManualEntry}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center transition-colors"
            >
              {showManualEntry ? (
                <>
                  <QrCode size={16} className="mr-1" />
                  Usar Escáner
                </>
              ) : (
                <>
                  <User size={16} className="mr-1" />
                  Registro Manual
                </>
              )}
            </button>
          </div>
          
          {cameraError && !showManualEntry && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
              <AlertCircle size={18} className="mr-2" />
              <div>
                <p className="font-medium">Error de cámara</p>
                <p className="text-sm">{cameraError}</p>
                <p className="text-sm mt-1">Asegúrate de que tu dispositivo tiene cámara y has concedido permisos.</p>
              </div>
            </div>
          )}
          
          {showManualEntry ? renderManualEntry() : renderScanner()}
          
          {/* Resultado del escaneo */}
          {scanResult && (
            <div className={`mt-6 p-4 rounded-lg ${scanResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 rounded-full p-2 ${scanResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {scanResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${scanResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {scanResult.success ? '¡Asistencia Registrada!' : 'Error al Registrar'}
                  </h3>
                  <div className="mt-1 text-sm text-gray-600">
                    <p>{scanResult.message}</p>
                    {scanResult.timestamp && (
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(scanResult.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {scanResult.member && (
                <div className="mt-3 flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {scanResult.member.firstName.charAt(0)}{scanResult.member.lastName.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-700">
                      {scanResult.member.firstName} {scanResult.member.lastName}
                    </div>
                    {scanResult.success && scanResult.member.activeMemberships !== undefined && (
                      <div className="text-xs text-gray-500">
                        {scanResult.member.activeMemberships} membresía(s) activa(s)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Asistencias del día */}
        <div className="border rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium flex items-center">
              <Calendar size={20} className="mr-2 text-blue-600" />
              Asistencias de Hoy
            </h3>
            
            <div className="flex items-center space-x-2">
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="success">Exitosas</option>
                <option value="error">Con errores</option>
              </select>
              
              <button
                onClick={loadTodayAttendances}
                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                title="Actualizar"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredAttendances.filter(a => a.status === 'success').length}
              </div>
              <div className="text-xs text-blue-700">Asistencias exitosas</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {new Set(filteredAttendances.filter(a => a.status === 'success').map(a => a.memberId)).size}
              </div>
              <div className="text-xs text-green-700">Socios únicos</div>
            </div>
          </div>
          
          {filteredAttendances.length === 0 ? (
            <div className="text-center py-10">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {attendanceFilter === 'all' 
                  ? "No hay registros de asistencia hoy" 
                  : `No hay registros ${attendanceFilter === 'success' ? 'exitosos' : 'con errores'} hoy`
                }
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 space-y-3">
              {filteredAttendances.map((record) => (
                <div
                  key={`${record.id}-${record.timestamp.getTime()}`}
                  className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-md ${
                    record.status === 'success' 
                      ? 'border-l-green-500 bg-green-50 hover:bg-green-100' 
                      : 'border-l-red-500 bg-red-50 hover:bg-red-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                        {record.member.firstName.charAt(0)}{record.member.lastName.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="font-medium text-sm">
                          {record.member.firstName} {record.member.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.activityName || 'General'}
                        </div>
                        {record.status !== 'success' && record.error && (
                          <div className="text-xs text-red-600 mt-1">
                            {record.error}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">
                        {formatTime(record.timestamp)}
                      </div>
                      <div className={`text-xs ${
                        record.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {record.status === 'success' ? 'Exitosa' : 'Error'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {filteredAttendances.length > 0 && (
            <div className="mt-4 pt-3 border-t text-center">
              <p className="text-xs text-gray-500">
                Última actualización: {new Date().toLocaleTimeString('es-AR')}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de confirmación */}
      {renderConfirmationModal()}
      
      {/* Estilos para la animación de escaneo */}
      <style>
        {`
        @keyframes scan {
          0% {
            transform: translateY(-100px);
          }
          100% {
            transform: translateY(100px);
          }
        }
        
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        `}
      </style>
    </div>
  );
};

export default AttendanceScanner;