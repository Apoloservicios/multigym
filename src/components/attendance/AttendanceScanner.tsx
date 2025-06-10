// src/components/attendance/AttendanceScanner.tsx - VERSIÓN COMPLETA
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, CameraOff, Clock, AlertCircle, CheckCircle, XCircle, Search, User } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import useAuth from '../../hooks/useAuth';
import attendanceService from '../../services/attendance.service';
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

interface MembershipInfo {
  id: string;
  activityId?: string;
  activityName: string;
  currentAttendances: number;
  maxAttendances: number;
  endDate: Date;
  status: string;
}

const AttendanceScanner: React.FC = () => {
  const { gymData, userData } = useAuth();
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<AttendanceRecord[]>([]);
  const [processingQR, setProcessingQR] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Estados para registro manual
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<MemberInfo[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentMembers, setRecentMembers] = useState<MemberInfo[]>([]);
  
  // Estados para selección de membresía
  const [memberMemberships, setMemberMemberships] = useState<MembershipInfo[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<MembershipInfo | null>(null);
  const [showMembershipSelection, setShowMembershipSelection] = useState<boolean>(false);
  const [pendingQRData, setPendingQRData] = useState<string | null>(null);
  
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const lastQRProcessed = useRef<string>('');
  const qrCooldownTimeout = useRef<NodeJS.Timeout | null>(null);

  // Función de búsqueda con debounce
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
        const q = query(
          membersRef,
          where('status', '==', 'active'),
          limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        const allMembers: MemberInfo[] = [];
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          allMembers.push({
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            photo: data.photo || null
          });
        });
        
        // Filtrar localmente
        const filtered = allMembers.filter(member => {
          const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
          const email = member.email.toLowerCase();
          const searchTerm = term.toLowerCase();
          
          return fullName.includes(searchTerm) || email.includes(searchTerm);
        });
        
        setSearchResults(filtered);
        
        if (filtered.length === 0) {
          setSearchError(`No se encontraron socios que coincidan con "${term}"`);
        }
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setSearchError(`Error al buscar socios`);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [gymData?.id]
  );

  // Cargar miembros recientes
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
      
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.memberId && !memberIds.has(data.memberId)) {
          memberIds.add(data.memberId);
        }
      });
      
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

  // Cargar membresías de un socio
  const loadMemberMemberships = async (memberId: string): Promise<MembershipInfo[]> => {
    if (!gymData?.id) return [];
    
    try {
      const memberships = await attendanceService.getActiveMemberships(gymData.id, memberId);
      
      return memberships.map((m: any) => ({
        id: m.id,
        activityId: m.activityId,
        activityName: m.activityName,
        currentAttendances: m.currentAttendances || 0,
        maxAttendances: m.maxAttendances || 0,
        endDate: m.endDate,
        status: m.status
      }));
    } catch (error) {
      console.error('Error loading memberships:', error);
      return [];
    }
  };

  // Manejar selección de socio
  const handleMemberSelect = async (member: MemberInfo) => {
    setSelectedMember(member);
    setSearchTerm(`${member.firstName} ${member.lastName}`);
    setSearchResults([]);
    
    const memberships = await loadMemberMemberships(member.id);
    setMemberMemberships(memberships);
    
    if (memberships.length === 0) {
      setSearchError('Este socio no tiene membresías activas');
      setSelectedMembership(null);
    } else if (memberships.length === 1) {
      setSelectedMembership(memberships[0]);
    } else {
      setSelectedMembership(null);
    }
  };

  // Registrar asistencia manual
  const registerManualAttendance = async (member: MemberInfo, membership: MembershipInfo) => {
    if (!gymData?.id) return;
    
    setProcessingQR(true);
    
    try {
      const result = await attendanceService.registerAttendance(gymData.id, {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberFirstName: member.firstName,
        memberLastName: member.lastName,
        memberEmail: member.email,
        membershipId: membership.id,
        activityId: membership.activityId || '',
        activityName: membership.activityName,
        notes: 'Registro manual',
        registeredBy: 'gym',
        registeredByUserId: userData?.id,
        registeredByUserName: userData?.name
      });
      
      const scanResultObj: ScanResult = {
        success: result.success,
        message: result.success 
          ? `Asistencia registrada para ${member.firstName} ${member.lastName} - ${membership.activityName}`
          : result.error || "Error al registrar asistencia",
        timestamp: new Date(),
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          photo: member.photo || null,
          activeMemberships: memberMemberships.length
        },
        error: !result.success ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      const attendanceRecord: AttendanceRecord = {
        id: result.attendanceId || `ATT${Date.now()}`,
        memberId: member.id,
        member: {
          firstName: member.firstName,
          lastName: member.lastName
        },
        timestamp: new Date(),
        status: result.success ? 'success' : 'failed',
        error: !result.success ? result.error : undefined
      };
      
      setScanHistory(prev => [attendanceRecord, ...prev].slice(0, 10));
      setLastScan(new Date());
      
      // Limpiar formulario
      setSearchTerm("");
      setSearchResults([]);
      setSelectedMember(null);
      setSelectedMembership(null);
      setMemberMemberships([]);
      loadRecentMembers();
      
    } catch (error: any) {
      console.error("Error registrando asistencia:", error);
      
      setScanResult({
        success: false,
        message: error.message || "Error al registrar asistencia",
        timestamp: new Date(),
        member: null,
        error: error.message
      });
    } finally {
      setProcessingQR(false);
    }
  };

  // Limpiar recursos al desmontar
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

  useEffect(() => {
    loadRecentMembers();
  }, [loadRecentMembers]);

  // Función para escanear QR
  const scanQRCode = useCallback(() => {
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
      
      if (code && code.data !== lastQRProcessed.current) {
        setScanning(false);
        if (scanInterval.current) {
          clearInterval(scanInterval.current);
          scanInterval.current = null;
        }
        
        lastQRProcessed.current = code.data;
        
        if (qrCooldownTimeout.current) {
          clearTimeout(qrCooldownTimeout.current);
        }
        qrCooldownTimeout.current = setTimeout(() => {
          lastQRProcessed.current = '';
        }, 3000);
        
        procesarCodigoQR(code.data);
      }
    };
  }, [processingQR]);

  // Procesar código QR
  const procesarCodigoQR = async (decodedText: string) => {
    if (!gymData?.id || processingQR) return;

    try {
      setProcessingQR(true);
      console.log("QR Code escaneado:", decodedText);
      
      let memberId = "";
      
      // Intentar decodificar como base64
      try {
        const decoded = atob(decodedText);
        const qrData = JSON.parse(decoded);
        if (qrData && qrData.memberId) {
          memberId = qrData.memberId;
        }
      } catch (e) {
        // Intentar como JSON directo
        try {
          const qrData = JSON.parse(decodedText);
          if (qrData && qrData.memberId) {
            memberId = qrData.memberId;
          }
        } catch (e2) {
          // Usar como ID directo
          memberId = decodedText;
        }
      }
      
      if (!memberId) {
        throw new Error("No se pudo extraer un ID del código QR");
      }

      const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        throw new Error("Socio no encontrado");
      }

      const memberData = memberSnap.data();
      
      if (memberData.status !== 'active') {
        throw new Error("El socio no está activo");
      }
      
      const memberships = await loadMemberMemberships(memberId);
      
      if (memberships.length === 0) {
        throw new Error("El socio no tiene membresías activas");
      }
      
      // Si hay múltiples membresías, mostrar selector
      if (memberships.length > 1) {
        setPendingQRData(decodedText);
        setSelectedMember({
          id: memberId,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          email: memberData.email,
          photo: memberData.photo
        });
        setMemberMemberships(memberships);
        setShowMembershipSelection(true);
        return;
      }
      
      // Si solo hay una membresía, procesar directamente
      const membership = memberships[0];
      const result = await attendanceService.registerAttendance(gymData.id, {
        memberId: memberId,
        memberName: `${memberData.firstName} ${memberData.lastName}`,
        memberFirstName: memberData.firstName,
        memberLastName: memberData.lastName,
        memberEmail: memberData.email,
        membershipId: membership.id,
        activityId: membership.activityId || '',
        activityName: membership.activityName,
        notes: 'Acceso por código QR',
        registeredBy: 'gym',
        registeredByUserId: userData?.id,
        registeredByUserName: userData?.name
      });
      
      const scanResultObj: ScanResult = {
        success: result.success,
        message: result.success 
          ? `¡Bienvenido/a ${memberData.firstName}! - ${membership.activityName}`
          : result.error || "Error al registrar asistencia",
        timestamp: new Date(),
        member: {
          id: memberId,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          photo: memberData.photo || null,
          activeMemberships: memberships.length
        },
        error: !result.success ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      const attendanceRecord: AttendanceRecord = {
        id: result.attendanceId || `ATT${Date.now()}`,
        memberId,
        member: {
          firstName: memberData.firstName,
          lastName: memberData.lastName
        },
        timestamp: new Date(),
        status: result.success ? 'success' : 'failed',
        error: !result.success ? result.error : undefined
      };
      
      setScanHistory(prev => [attendanceRecord, ...prev].slice(0, 10));
      setLastScan(new Date());
      
    } catch (error: any) {
      console.error("Error procesando QR:", error);
      
      setScanResult({
        success: false,
        message: error.message || "Error al procesar el código QR",
        timestamp: new Date(),
        member: null,
        error: error.message
      });
      
    } finally {
      setProcessingQR(false);
    }
  };

  // Confirmar asistencia con membresía seleccionada
  const confirmAttendanceWithMembership = async (membership: MembershipInfo) => {
    if (!pendingQRData || !selectedMember || !gymData?.id) return;
    
    setProcessingQR(true);
    setShowMembershipSelection(false);
    
    try {
      const result = await attendanceService.registerAttendance(gymData.id, {
        memberId: selectedMember.id,
        memberName: `${selectedMember.firstName} ${selectedMember.lastName}`,
        memberFirstName: selectedMember.firstName,
        memberLastName: selectedMember.lastName,
        memberEmail: selectedMember.email,
        membershipId: membership.id,
        activityId: membership.activityId || '',
        activityName: membership.activityName,
        notes: 'Acceso por código QR',
        registeredBy: 'gym',
        registeredByUserId: userData?.id,
        registeredByUserName: userData?.name
      });
      
      const scanResultObj: ScanResult = {
        success: result.success,
        message: result.success 
          ? `¡Bienvenido/a ${selectedMember.firstName}! - ${membership.activityName}`
          : result.error || "Error al registrar asistencia",
        timestamp: new Date(),
        member: {
          id: selectedMember.id,
          firstName: selectedMember.firstName,
          lastName: selectedMember.lastName,
          photo: selectedMember.photo || null,
          activeMemberships: memberMemberships.length
        },
        error: !result.success ? result.error : undefined
      };
      
      setScanResult(scanResultObj);
      
      const attendanceRecord: AttendanceRecord = {
        id: result.attendanceId || `ATT${Date.now()}`,
        memberId: selectedMember.id,
        member: {
          firstName: selectedMember.firstName,
          lastName: selectedMember.lastName
        },
        timestamp: new Date(),
        status: result.success ? 'success' : 'failed',
        error: !result.success ? result.error : undefined
      };
      
      setScanHistory(prev => [attendanceRecord, ...prev].slice(0, 10));
      setLastScan(new Date());
      
    } catch (error: any) {
      console.error("Error confirmando asistencia:", error);
      
      setScanResult({
        success: false,
        message: error.message || "Error al confirmar asistencia",
        timestamp: new Date(),
        member: null,
        error: error.message
      });
    } finally {
      setProcessingQR(false);
      setPendingQRData(null);
      setSelectedMember(null);
      setMemberMemberships([]);
    }
  };

  // Iniciar escaneo
  const startScanning = () => {
    setScanResult(null);
    setCameraError(null);
    setShowManualEntry(false);
    setShowMembershipSelection(false);
    
    try {
      setScanning(true);
      lastQRProcessed.current = '';
      scanInterval.current = setInterval(scanQRCode, 500);
    } catch (err: any) {
      console.error("Error al iniciar el escáner:", err);
      setCameraError(`Error al iniciar el escáner: ${err.message}`);
      setScanning(false);
    }
  };
  
  // Detener escaneo
  const stopScanning = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    setScanning(false);
    lastQRProcessed.current = '';
  };

  // Alternar entrada manual
  const toggleManualEntry = () => {
    stopScanning();
    setShowManualEntry(!showManualEntry);
    setShowMembershipSelection(false);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedMember(null);
    setSelectedMembership(null);
    setMemberMemberships([]);
    setScanResult(null);
    setSearchError(null);
    
    if (!showManualEntry) {
      loadRecentMembers();
    }
  };

  // Buscar miembros
  const searchMembers = useCallback(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      debouncedSearch(searchTerm);
    } else {
      setSearchResults([]);
      setSearchError(null);
    }
  }, [searchTerm, debouncedSearch]);

  // Formatear fecha
  const formatDateTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Manejar error de cámara
  const handleWebcamError = useCallback((err: string | DOMException) => {
    console.error("Error de cámara:", err);
    setCameraError(`Error al acceder a la cámara: ${err.toString()}`);
    setScanning(false);
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
  }, []);

  // Renderizar escáner QR
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
                <div className="w-48 h-48 border-2 border-transparent relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                </div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 animate-pulse"></div>
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
            <p className="text-gray-400 text-sm">Presiona "Iniciar Escaneo" para comenzar</p>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-lg flex justify-center">
        {!scanning ? (
          <button
            onClick={startScanning}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
          >
            <QrCode size={20} className="mr-2" />
            Iniciar Escaneo
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
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

  // Renderizar entrada manual
  const renderManualEntry = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full max-w-lg">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar socio por nombre, apellido o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMembers()}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                onClick={() => handleMemberSelect(member)}
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
                onClick={() => handleMemberSelect(member)}
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

      {/* Selección de membresía para registro manual */}
      {selectedMember && memberMemberships.length > 0 && (
        <div className="w-full max-w-lg mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Seleccionar membresía para {selectedMember.firstName} {selectedMember.lastName}:
          </h3>
          <div className="space-y-2">
            {memberMemberships.map(membership => (
              <button
                key={membership.id}
                onClick={() => registerManualAttendance(selectedMember, membership)}
                disabled={processingQR}
                className="w-full p-3 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">
                      {membership.activityName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {membership.currentAttendances}
                      {membership.maxAttendances > 0 && ` / ${membership.maxAttendances}`} asistencias
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      Vence: {membership.endDate.toLocaleDateString('es-AR')}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      membership.endDate > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {membership.endDate > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        ? 'Activa'
                        : 'Por vencer'
                      }
                    </div>
                  </div>
                </div>
              </button>
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

  // Modal para selección de membresía desde QR
  const renderMembershipSelection = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">
          Seleccionar Membresía
        </h3>
        <p className="text-gray-600 mb-4">
          {selectedMember?.firstName} {selectedMember?.lastName} tiene múltiples membresías. 
          Selecciona una para registrar la asistencia:
        </p>
        
        <div className="space-y-3 mb-4">
          {memberMemberships.map(membership => (
            <button
              key={membership.id}
              onClick={() => confirmAttendanceWithMembership(membership)}
              disabled={processingQR}
              className="w-full p-3 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">
                    {membership.activityName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {membership.currentAttendances}
                    {membership.maxAttendances > 0 && ` / ${membership.maxAttendances}`} asistencias
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    Vence: {membership.endDate.toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <button
          onClick={() => {
            setShowMembershipSelection(false);
            setPendingQRData(null);
            setSelectedMember(null);
            setMemberMemberships([]);
            setProcessingQR(false);
          }}
          className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
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

      {/* Modal de selección de membresía */}
      {showMembershipSelection && renderMembershipSelection()}
    </div>
  );
};

export default AttendanceScanner;