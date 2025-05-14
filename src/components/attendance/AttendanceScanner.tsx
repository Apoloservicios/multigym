// src/components/attendance/AttendanceScanner.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, CameraOff, Clock, AlertCircle, CheckCircle, XCircle, Search, User } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import useAuth from '../../hooks/useAuth';
import { registerAttendance } from '../../services/attendance.service';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { debounce } from 'lodash';

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
  error?: string;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo?: string | null;
}

const AttendanceScanner: React.FC = () => {
  const { gymData } = useAuth();
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<AttendanceRecord[]>([]);
  const [processingQR, setProcessingQR] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Estados para registro manual mejorados
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberInfo[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentMembers, setRecentMembers] = useState<MemberInfo[]>([]);
  
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const lastQRProcessed = useRef<string>('');
  const qrCooldownTimeout = useRef<NodeJS.Timeout | null>(null);



  // Debounced search function mejorada
  const debouncedSearch = useMemo(
    () => debounce(async (term: string) => {
      if (!gymData?.id || term.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      setSearchError(null);
      
      try {
        const membersRef = collection(db, `gyms/${gymData.id}/members`);
        
        // Búsqueda optimizada con múltiples queries
        const searchQueries = [
          // Búsqueda por nombre
          query(
            membersRef,
            where('firstName', '>=', term),
            where('firstName', '<=', term + '\uf8ff'),
            where('status', '==', 'active'),
            limit(5)
          ),
          // Búsqueda por apellido
          query(
            membersRef,
            where('lastName', '>=', term),
            where('lastName', '<=', term + '\uf8ff'),
            where('status', '==', 'active'),
            limit(5)
          ),
          // Búsqueda por email
          query(
            membersRef,
            where('email', '>=', term),
            where('email', '<=', term + '\uf8ff'),
            where('status', '==', 'active'),
            limit(5)
          )
        ];
        
        // Ejecutar búsquedas en paralelo
        const searchPromises = searchQueries.map(q => getDocs(q));
        const results = await Promise.all(searchPromises);
        
        // Combinar y deduplicar resultados
        const memberMap = new Map<string, MemberInfo>();
        
        results.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const member: MemberInfo = {
              id: doc.id,
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              email: data.email || "",
              photo: data.photo || null
            };
            
            // Solo agregar si coincide con el término de búsqueda
            const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
            const email = member.email.toLowerCase();
            const searchTerm = term.toLowerCase();
            
            if (fullName.includes(searchTerm) || email.includes(searchTerm)) {
              memberMap.set(doc.id, member);
            }
          });
        });
        
        const finalResults = Array.from(memberMap.values()).slice(0, 10);
        setSearchResults(finalResults);
        
        if (finalResults.length === 0) {
          setSearchError(`No se encontraron socios activos que coincidan con "${term}"`);
        }
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setSearchError(`Error al buscar socios: ${error}`);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [gymData?.id]
  );

  // Cargar miembros recientes para acceso rápido
  const loadRecentMembers = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      const recentAttendanceQuery = query(
        collection(db, `gyms/${gymData.id}/attendance`),
        where('status', '==', 'success'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const attendanceSnap = await getDocs(recentAttendanceQuery);
      const memberIds = new Set<string>();
      const members: MemberInfo[] = [];
      
      // Obtener IDs únicos de los últimos asistentes
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.memberId && !memberIds.has(data.memberId)) {
          memberIds.add(data.memberId);
        }
      });
      
      // Obtener datos completos de esos miembros
      for (const memberId of Array.from(memberIds).slice(0, 3)) {
        try {
          const memberDoc = await getDoc(doc(db, `gyms/${gymData.id}/members`, memberId));
          if (memberDoc.exists()) {
            const data = memberDoc.data();
            members.push({
              id: memberDoc.id,
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              email: data.email || "",
              photo: data.photo || null
            });
          }
        } catch (err) {
          console.error(`Error loading member ${memberId}:`, err);
        }
      }
      
      setRecentMembers(members);
    } catch (error) {
      console.error('Error loading recent members:', error);
    }
  }, [gymData?.id]);

  // Limpiar intervalo de escaneo al desmontar
  useEffect(() => {
    return () => {
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
      }
      if (qrCooldownTimeout.current) {
        clearTimeout(qrCooldownTimeout.current);
      }
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Cargar miembros recientes al iniciar
  useEffect(() => {
    loadRecentMembers();
  }, [loadRecentMembers]);

  // Función mejorada para capturar y procesar la imagen de la cámara
  const scanQRCode = useCallback(async () => {
    if (processingQR || !webcamRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    
    // Crear una imagen desde el screenshot para procesar con jsQR
    const image = new Image();
    image.src = imageSrc;
    
    image.onload = () => {
      // Crear un canvas para dibujar la imagen y obtener los datos de píxeles
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Escanear la imagen en busca de un código QR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code && code.data !== lastQRProcessed.current) {
        // Se encontró un código QR nuevo, detener el escaneo y procesar
        setScanning(false);
        if (scanInterval.current) {
          clearInterval(scanInterval.current);
          scanInterval.current = null;
        }
        
        // Evitar procesar el mismo QR múltiples veces
        lastQRProcessed.current = code.data;
        
        // Set cooldown para evitar múltiples escaneos del mismo QR
        if (qrCooldownTimeout.current) {
          clearTimeout(qrCooldownTimeout.current);
        }
        qrCooldownTimeout.current = setTimeout(() => {
          lastQRProcessed.current = '';
        }, 3000); // 3 segundos de cooldown
        
        procesarCodigoQR(code.data);
      }
    };
  }, [processingQR]);

  // Función mejorada para iniciar el escaneo
  const startScanning = () => {
    setScanResult(null);
    setCameraError(null);
    setShowManualEntry(false);
    
    try {
      setScanning(true);
      lastQRProcessed.current = '';
      
      // Iniciar un intervalo para escanear periódicamente
      scanInterval.current = setInterval(scanQRCode, 300); // Reducido a 300ms para mejor respuesta
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
    lastQRProcessed.current = '';
  };

  // Función mejorada para cambiar al modo de entrada manual
  const toggleManualEntry = () => {
    stopScanning();
    setShowManualEntry(!showManualEntry);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedMember(null);
    setScanResult(null);
    setSearchError(null);
    
    // Cargar miembros recientes al abrir entrada manual
    if (!showManualEntry) {
      loadRecentMembers();
    }
  };

  // Función para buscar miembros (ahora usa debounced search)
  const searchMembers = useCallback(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // Efecto para manejar búsqueda automática mientras el usuario escribe
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      debouncedSearch(searchTerm);
    } else {
      setSearchResults([]);
      setSearchError(null);
    }
  }, [searchTerm, debouncedSearch]);

  // Función mejorada para registrar asistencia manualmente
  const registerManualAttendance = async (member: MemberInfo) => {
    if (!gymData?.id) return;
    
    setSelectedMember(member);
    setProcessingQR(true);
    
    try {
      // Verificar membresías activas del socio
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${member.id}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      // Obtener la primera membresía activa
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      // Registrar la asistencia
      const now = new Date();
      const result = await registerAttendance(
        gymData.id,
        member.id,
        `${member.firstName} ${member.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
      );
      
      // Crear objeto de resultado
      const scanResultObj: ScanResult = {
        success: result.status === 'success',
        message: result.status === 'success' 
          ? `Asistencia registrada para ${member.firstName} ${member.lastName}`
          : result.error || "Error al registrar asistencia",
        timestamp: now,
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          photo: member.photo || null,
          activeMemberships: activeSnap.size
        },
        error: result.status === 'error' ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      // Agregar al historial
      const attendanceRecord: AttendanceRecord = {
        id: result.id || `ATT${Date.now()}`,
        memberId: member.id,
        member: {
          firstName: member.firstName,
          lastName: member.lastName
        },
        timestamp: now,
        status: result.status,
        error: result.status === 'error' ? result.error : undefined
      };
      
      setScanHistory(prev => [attendanceRecord, ...prev].slice(0, 10));
      setLastScan(now);
      
      // Limpiar búsqueda y actualizar miembros recientes
      setSearchTerm("");
      setSearchResults([]);
      loadRecentMembers();
      
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

  // Función mejorada para procesar el código QR leído
  const procesarCodigoQR = async (decodedText: string) => {
    if (!gymData?.id || processingQR) {
      return;
    }

    try {
      setProcessingQR(true);
      console.log("QR Code escaneado:", decodedText);
      
      // Intentar diferentes formas de obtener el ID del miembro
      let memberId = "";
      
      // Método 1: Decodificar como base64 JSON
      try {
        const decoded = atob(decodedText);
        const qrData = JSON.parse(decoded);
        if (qrData && qrData.memberId) {
          memberId = qrData.memberId;
          console.log("ID del miembro decodificado del JSON (base64):", memberId);
        }
      } catch (e) {
        console.log("No es un JSON codificado en base64");
      }
      
      // Método 2: Intentar como JSON directo
      if (!memberId) {
        try {
          const qrData = JSON.parse(decodedText);
          if (qrData && qrData.memberId) {
            memberId = qrData.memberId;
            console.log("ID del miembro decodificado del JSON:", memberId);
          }
        } catch (e) {
          console.log("No es un JSON directo");
        }
      }
      
      // Método 3: Asumir que es el ID directo
      if (!memberId) {
        memberId = decodedText;
        console.log("Usando el texto completo como ID:", memberId);
      }
      
      // Verificar que tenemos un ID
      if (!memberId) {
        throw new Error("No se pudo extraer un ID del código QR");
      }

      const now = new Date();

      // Obtener datos del miembro
      const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        throw new Error("Socio no encontrado. ID: " + memberId);
      }

      const memberData = memberSnap.data();
      
      // Verificar que el socio esté activo
      if (memberData.status !== 'active') {
        throw new Error("El socio no está activo. Consulte con administración.");
      }
      
      // Obtener membresías activas del socio
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      // Seleccionar la primera membresía activa para registrar asistencia
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      // Verificar si la membresía no ha expirado
      const endDate = membershipData.endDate.toDate();
      if (endDate < now) {
        throw new Error("La membresía ha expirado. Renueve su membresía.");
      }
      
      // Registrar la asistencia
      const result = await registerAttendance(
        gymData.id,
        memberId,
        `${memberData.firstName} ${memberData.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
      );
      
      // Crear objeto de resultado
      const scanResultObj: ScanResult = {
        success: result.status === 'success',
        message: result.status === 'success' 
          ? `¡Bienvenido/a ${memberData.firstName}! Asistencia registrada correctamente`
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
      
      // Agregar al historial
      const attendanceRecord: AttendanceRecord = {
        id: result.id || `ATT${Date.now()}`,
        memberId,
        member: {
          firstName: memberData.firstName,
          lastName: memberData.lastName
        },
        timestamp: now,
        status: result.status,
        error: result.status === 'error' ? result.error : undefined
      };
      
      setScanHistory(prev => [attendanceRecord, ...prev].slice(0, 10));
      setLastScan(now);
      
    } catch (error: any) {
      console.error("Error procesando QR:", error);
      
      // Crear resultado de error
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

  // Componente para el escáner QR mejorado
  const renderScanner = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 h-80 w-full max-w-lg bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
        {scanning ? (
          <div className="w-full h-full relative">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: "environment",
                aspectRatio: 1,
                width: { ideal: 640 },
                height: { ideal: 640 }
              }}
              onUserMediaError={handleWebcamError}
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Marco de escaneo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Esquinas del marco */}
                <div className="w-48 h-48 border-2 border-transparent relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                </div>
                
                {/* Línea de escaneo animada */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-scan-line"></div>
              </div>
            </div>
            
            {/* Indicador de procesamiento */}
            {processingQR && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-gray-700">Procesando...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <CameraOff size={64} className="text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg mb-2">Cámara inactiva</p>
            <p className="text-gray-400 text-sm">
              Presiona "Iniciar Escaneo" para comenzar
            </p>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-lg flex justify-center">
        {!scanning ? (
          <button
            onClick={startScanning}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
          >
            <QrCode size={20} className="mr-2" />
            Iniciar Escaneo
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
        <div className="mt-4 w-full max-w-lg text-center text-sm text-gray-500">
          Último escaneo: {formatDateTime(lastScan)}
        </div>
      )}
    </div>
  );

  // Componente mejorado para la entrada manual
  const renderManualEntry = () => (
    <div className="flex flex-col items-center">
      {/* Barra de búsqueda */}
      <div className="mb-4 w-full max-w-lg">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar socio por nombre, apellido o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMembers()}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
            autoFocus
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
        
        <button
          onClick={searchMembers}
          disabled={searchTerm.trim().length < 2 || isSearching}
          className={`w-full mt-3 py-2 rounded-lg flex items-center justify-center transition-colors ${
            searchTerm.trim().length < 2 || isSearching 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSearching ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Buscando...
            </>
          ) : (
            <>
              <Search size={18} className="mr-2" />
              Buscar Socio
            </>
          )}
        </button>
      </div>
      
      {/* Miembros recientes */}
      {recentMembers.length > 0 && searchResults.length === 0 && !searchTerm && (
        <div className="w-full max-w-lg mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Socios recientes:</h3>
          <div className="space-y-2">
            {recentMembers.map(member => (
              <div 
                key={member.id} 
                className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => registerManualAttendance(member)}
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3">
                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Error de búsqueda */}
      {searchError && (
        <div className="w-full max-w-lg p-3 mb-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <div className="flex items-center">
            <AlertCircle size={18} className="mr-2 flex-shrink-0" />
            <span className="text-sm">{searchError}</span>
          </div>
        </div>
      )}
      
      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <div className="w-full max-w-lg border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
            {searchResults.length} resultado(s) encontrado(s)
          </div>
          <div className="max-h-64 overflow-y-auto">
            {searchResults.map(member => (
              <div 
                key={member.id} 
                className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => registerManualAttendance(member)}
              >
                <div className="flex items-center">
                  {member.photo ? (
                    <img 
                      src={member.photo} 
                      alt={`${member.firstName} ${member.lastName}`}
                      className="h-12 w-12 rounded-full object-cover mr-3"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3">
                      {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <div className="text-blue-600">
                    <User size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Ayuda */}
      <div className="mt-4 w-full max-w-lg text-center text-xs text-gray-500">
        <p>Escribe al menos 2 caracteres para buscar</p>
        <p>o selecciona un socio de la lista de recientes</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-6">Control de Asistencias</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sección de escáner/entrada manual */}
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {showManualEntry ? "Registro Manual" : "Escanear Código QR"}
            </h3>
            
            <button
              onClick={toggleManualEntry}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
            >
              {showManualEntry ? (
                <>
                  <QrCode size={16} className="mr-2" />
                  Usar Escáner QR
                </>
              ) : (
                <>
                  <User size={16} className="mr-2" />
                  Registro Manual
                </>
              )}
            </button>
          </div>
          
          {cameraError && !showManualEntry && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
              <div className="flex items-start">
                <AlertCircle size={20} className="mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error de cámara</p>
                  <p className="text-sm mt-1">{cameraError}</p>
                  <p className="text-sm mt-2 text-red-600">
                    • Verifica que tu dispositivo tenga cámara<br />
                    • Asegúrate de permitir el acceso a la cámara<br />
                    • Intenta recargar la página
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {showManualEntry ? renderManualEntry() : renderScanner()}
          
          {/* Resultado del escaneo */}
          {scanResult && (
            <div className={`mt-6 p-4 rounded-lg ${
              scanResult.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 rounded-full p-2 ${
                  scanResult.success 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {scanResult.success ? <CheckCircle size={24} /> : <XCircle size={24} />}
                </div>
                
                <div className="ml-4 flex-1">
                  <h3 className={`text-base font-medium ${
                    scanResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {scanResult.success ? 'Asistencia Registrada' : 'Error al Registrar'}
                  </h3>
                  
                  <p className={`mt-1 text-sm ${
                    scanResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {scanResult.message}
                  </p>
                  
                  <p className="mt-2 text-xs text-gray-500">
                    {formatDateTime(scanResult.timestamp)}
                  </p>
                  
                  {scanResult.member && (
                    <div className="mt-3 flex items-center p-3 bg-white rounded-md border">
                      {scanResult.member.photo ? (
                        <img 
                          src={scanResult.member.photo} 
                          alt={`${scanResult.member.firstName} ${scanResult.member.lastName}`}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                          {scanResult.member.firstName.charAt(0)}{scanResult.member.lastName.charAt(0)}
                        </div>
                      )}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
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
              </div>
            </div>
          )}
        </div>
        
        {/* Historial de registros */}
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="text-lg font-medium mb-6 text-gray-900">Registros Recientes</h3>
          
          {scanHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-base">No hay registros de asistencia recientes</p>
              <p className="text-gray-400 text-sm mt-2">
                Los registros aparecerán aquí una vez que comiences a escanear
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scanHistory.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    record.status === 'success' 
                      ? 'border-l-green-500 bg-green-50 border border-green-200' 
                      : 'border-l-red-500 bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${
                        record.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {record.member.firstName.charAt(0)}{record.member.lastName.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {record.member.firstName} {record.member.lastName}
                        </div>
                        <div className="text-xs text-gray-600">
                          {record.status === 'success' ? (
                            'Asistencia registrada'
                          ) : (
                            record.error || 'Error al registrar'
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {formatDateTime(record.timestamp)}
                      </div>
                      <div className={`text-xs font-medium ${
                        record.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {record.status === 'success' ? '✓ Exitoso' : '✗ Error'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {scanHistory.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => setScanHistory([])}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Limpiar Historial
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Estilos CSS para animaciones */}
    <style>{`
  @keyframes scan-line {
    0% {
      top: 0;
      opacity: 1;
    }
    100% {
      top: 100%;
      opacity: 0;
    }
  }
  
  .animate-scan-line {
    animation: scan-line 2s linear infinite;
  }
`}</style>
    </div>
  );
};

export default AttendanceScanner;


