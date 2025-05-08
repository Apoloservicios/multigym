// src/components/attendance/AttendanceScanner.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, CameraOff, Clock, AlertCircle, CheckCircle, XCircle, Search, User } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import useAuth from '../../hooks/useAuth';
import { registerAttendance } from '../../services/attendance.service';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  
  // Estados para el registro manual
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberInfo[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);

  // Limpiar intervalo de escaneo al desmontar
  useEffect(() => {
    return () => {
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
      }
    };
  }, []);

  // Función para capturar y procesar la imagen de la cámara
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
      
      if (code) {
        // Se encontró un código QR, detener el escaneo y procesar
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
      
      // Iniciar un intervalo para escanear periódicamente
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
  };

  // Función para buscar miembros por nombre o email
  const searchMembers = async () => {
    if (!gymData?.id || searchTerm.trim().length < 3) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    
    try {
      console.log("Buscando miembros con término:", searchTerm);
      console.log("ID del gimnasio:", gymData.id);
      
      // Obtener colección de miembros del gimnasio
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      console.log("Ruta de la colección:", `gyms/${gymData.id}/members`);
      
      // Obtenemos todos los miembros primero (no es la manera más eficiente, pero es un workaround)
      const querySnapshot = await getDocs(membersRef);
      console.log("Total de documentos encontrados:", querySnapshot.size);
      
      // Log de los primeros documentos para ver su estructura
      querySnapshot.docs.slice(0, 3).forEach((doc, i) => {
        console.log(`Documento ${i+1}:`, { id: doc.id, ...doc.data() });
      });
      
      // Filtrar manualmente
      const term = searchTerm.toLowerCase().trim();
      const results: MemberInfo[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        console.log("Procesando documento:", doc.id, data);
        
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
            photo: data.photo || null
          });
        }
      });
      
      console.log("Resultados filtrados:", results);
      
      if (results.length === 0) {
        console.log("No se encontraron resultados");
        setSearchError(`No se encontraron miembros que coincidan con "${searchTerm}"`);
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Error buscando miembros:", error);
      setSearchError(`Error al buscar miembros: ${error}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Función para registrar asistencia manualmente
  const registerManualAttendance = async (member: MemberInfo) => {
    if (!gymData?.id) return;
    
    setSelectedMember(member);
    setProcessingQR(true);
    
    try {
      console.log("Registrando asistencia manual para:", member);
      
      // Obtener membresías activas del socio
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${member.id}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      console.log("Membresías activas encontradas:", activeSnap.size);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      // Seleccionar la primera membresía activa para registrar asistencia
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      console.log("Usando membresía:", membershipDoc.id, membershipData);
      
      // Registrar la asistencia
      const now = new Date();
      const result = await registerAttendance(
        gymData.id,
        member.id,
        `${member.firstName} ${member.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
      );
      
      console.log("Resultado de registro de asistencia:", result);
      
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
      
      // Actualizar timestamp del último escaneo
      setLastScan(now);
      
      // Limpiar la búsqueda
      setSearchTerm("");
      setSearchResults([]);
      
    } catch (error: any) {
      console.error("Error registrando asistencia:", error);
      
      // Crear resultado de error
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

  // Función para procesar el código QR leído
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

      // Intentar obtener datos del miembro
      console.log("Buscando miembro con ID:", memberId);
      const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        console.error("Miembro no encontrado con ID:", memberId);
        throw new Error("Socio no encontrado. ID: " + memberId);
      }

      const memberData = memberSnap.data();
      console.log("Datos del miembro encontrado:", memberData);
      
      // Obtener membresías activas del socio
      console.log("Buscando membresías activas para", memberId);
      const membershipsQuery = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const activeQ = query(membershipsQuery, where('status', '==', 'active'), limit(1));
      const activeSnap = await getDocs(activeQ);
      
      console.log("Membresías activas encontradas:", activeSnap.size);
      
      if (activeSnap.empty) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      // Seleccionar la primera membresía activa para registrar asistencia
      const membershipDoc = activeSnap.docs[0];
      const membershipData = membershipDoc.data();
      
      console.log("Usando membresía:", membershipDoc.id, membershipData);
      
      // Registrar la asistencia
      const result = await registerAttendance(
        gymData.id,
        memberId,
        `${memberData.firstName} ${memberData.lastName}`,
        membershipDoc.id,
        membershipData.activityName || "General"
      );
      
      console.log("Resultado del registro de asistencia:", result);
      
      // Crear objeto de resultado
      const scanResultObj: ScanResult = {
        success: result.status === 'success',
        message: result.status === 'success' 
          ? `Asistencia registrada para ${memberData.firstName} ${memberData.lastName}`
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
      
      // Actualizar timestamp del último escaneo
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
        <div className="mt-4 w-full max-w-md text-center text-sm text-gray-500">
          Último escaneo: {formatDateTime(lastScan)}
        </div>
      )}
    </div>
  );

  // Componente para la entrada manual
  const renderManualEntry = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar socio por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMembers()}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSearching}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
        </div>
        
        <button
          onClick={searchMembers}
          disabled={searchTerm.trim().length < 3 || isSearching}
          className={`w-full mt-2 py-2 rounded-md flex items-center justify-center ${
            searchTerm.trim().length < 3 || isSearching 
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
              Buscar
            </>
          )}
        </button>
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
                className="p-3 hover:bg-blue-50 cursor-pointer flex items-center"
                onClick={() => registerManualAttendance(member)}
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-3">
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium">{member.firstName} {member.lastName}</div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

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
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
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
            <div className={`mt-6 p-4 rounded-lg ${scanResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 rounded-full p-2 ${scanResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {scanResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${scanResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {scanResult.success ? 'Asistencia Registrada' : 'Error al Registrar'}
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
        
        {/* Historial de escaneos */}
        <div className="border rounded-lg p-5">
          <h3 className="text-lg font-medium mb-4">Últimos Registros</h3>
          
          {scanHistory.length === 0 ? (
            <div className="text-center py-10">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay registros de asistencia recientes</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <div className="space-y-3">
                {scanHistory.map((record) => (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      record.status === 'success' ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs">
                        {record.member.firstName.charAt(0)}{record.member.lastName.charAt(0)}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">
                            {record.member.firstName} {record.member.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(record.timestamp)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {record.status === 'success' ? (
                            'Asistencia registrada correctamente'
                          ) : (
                            record.error || 'Error al registrar asistencia'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <button className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Ver Historial Completo
            </button>
          </div>
        </div>
      </div>
      
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