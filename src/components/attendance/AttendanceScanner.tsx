
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, CameraOff, Clock, AlertCircle, CheckCircle, XCircle, Search, User } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import useAuth from '../../hooks/useAuth';
import attendanceService from '../../services/attendance.service';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { debounce } from 'lodash';
import useFirestore from '../../hooks/useFirestore';

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
  status?: string;
  // 🆕 Agregar estos campos:
  dni?: string;
  memberNumber?: number;
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
}

const AttendanceScanner: React.FC = () => {
  const { gymData, userData } = useAuth();
  
  // Estados básicos
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<AttendanceRecord[]>([]);
  const [processingQR, setProcessingQR] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Estados para registro manual
  const [showManualEntry, setShowManualEntry] = useState<boolean>(true);
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
  
  // ✅ ESTADOS PARA CONFIRMACIÓN DE ASISTENCIA
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
  const [pendingAttendanceData, setPendingAttendanceData] = useState<{
    member: MemberInfo;
    membership: MembershipInfo;
  } | null>(null);
  
  // Referencias
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const lastQRProcessed = useRef<string>('');
  const qrCooldownTimeout = useRef<NodeJS.Timeout | null>(null);
  const membersFirestore = useFirestore<MemberInfo>('members');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ✅ BÚSQUEDA DEBOUNCED
const debouncedSearch = useMemo(
  () => debounce(
    async (term: string) => {
      if (!gymData?.id || term.trim().length < 1) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const searchLower = term.toLowerCase().trim();
        const membersRef = collection(db, `gyms/${gymData.id}/members`);
        const membersSnapshot = await getDocs(membersRef);

        const results: MemberInfo[] = [];

        membersSnapshot.forEach(doc => {
          const data = doc.data();
          const member: MemberInfo = {
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            photo: data.photo || null,
            status: data.status || "active",
            // 🆕 Agregar DNI y número de socio
            dni: data.dni || "",
            memberNumber: data.memberNumber || 0,
            totalDebt: data.totalDebt || 0,
            hasDebt: data.hasDebt || false
          };

          // Búsqueda por nombre completo
          const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
          if (fullName.includes(searchLower)) {
            results.push(member);
            return;
          }

          // Búsqueda por email
          if (member.email.toLowerCase().includes(searchLower)) {
            results.push(member);
            return;
          }

          // 🆕 Búsqueda por DNI (exacta o parcial)
          if (member.dni && member.dni.includes(term.trim())) {
            results.push(member);
            return;
          }

          // 🆕 Búsqueda por número de socio (exacta)
          if (member.memberNumber) {
            const searchAsNumber = parseInt(term.trim(), 10);
            if (!isNaN(searchAsNumber) && member.memberNumber === searchAsNumber) {
              results.push(member);
              return;
            }
          }
        });

        setTimeout(() => {
          if (results.length === 0) {
            setSearchError('No se encontraron socios con ese criterio');
          } else if (results.length > 20) {
            setSearchResults(results.slice(0, 20));
            setSearchError(`Se encontraron ${results.length} socios. Mostrando los primeros 20.`);
          } else {
            setSearchResults(results);
          }
        }, 0);

      } catch (error) {
        console.error('Error en búsqueda:', error);
        setTimeout(() => {
          setSearchError('Error al buscar socios');
        }, 0);
      } finally {
        setTimeout(() => {
          setIsSearching(false);
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }
    }, 400),
  [gymData?.id]
);

  // ✅ CARGAR MIEMBROS RECIENTES
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

  // ✅ CARGAR MEMBRESÍAS DE UN SOCIO
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


  // ✅ MOSTRAR MODAL DE CONFIRMACIÓN
  const showAttendanceConfirmation = (member: MemberInfo, membership: MembershipInfo) => {
    console.log('🟢 showAttendanceConfirmation llamada:', { member: member.firstName, membership: membership.activityName });
    
    setPendingAttendanceData({ member, membership });
    setShowConfirmationModal(true);
  };

  // ✅ MANEJAR SELECCIÓN DE SOCIO (CON CONFIRMACIÓN) - CORREGIDO
  const handleMemberSelect = async (member: MemberInfo) => {
    console.log('🟡 handleMemberSelect llamada:', { member: member.firstName });
    
    setSelectedMember(member);
    setSearchTerm(`${member.firstName} ${member.lastName}`);
    setSearchResults([]);
    setSearchError(null);

      // 🆕 MOSTRAR ADVERTENCIA DE DEUDA SI CORRESPONDE
      if (member.hasDebt || (member.totalDebt && member.totalDebt > 0)) {
        const shouldContinue = window.confirm(
          `⚠️ ADVERTENCIA\n\n` +
          `${member.firstName} ${member.lastName} tiene una deuda de $${member.totalDebt?.toFixed(2) || 0}\n\n` +
          `¿Desea continuar con el registro de asistencia de todos modos?`
        );
        
        if (!shouldContinue) {
          setSelectedMember(null);
          return;
        }
      }

      if (!gymData?.id) {
        setScanResult({
          success: false,
          message: "No se encontró información del gimnasio",
          timestamp: new Date(),
          member: null,
          error: "gymData no disponible"
        });
        return;
      }
    
    const memberships = await loadMemberMemberships(member.id);
    setMemberMemberships(memberships);
    
    console.log('🔍 Membresías cargadas:', memberships.length);
    
    if (memberships.length === 0) {
      setSearchError('Este socio no tiene membresías activas');
      setSelectedMembership(null);
    } else if (memberships.length === 1) {
      console.log('🎯 Una sola membresía encontrada, mostrando confirmación...');
      setSelectedMembership(memberships[0]);
      // ✅ FIX: Llamar a showAttendanceConfirmation
      showAttendanceConfirmation(member, memberships[0]);
    } else {
      console.log('🎯 Múltiples membresías encontradas, mostrando selector...');
      setSelectedMembership(null);
    }
  };

  // ✅ MANEJAR SELECCIÓN DE MEMBRESÍA (PARA MÚLTIPLES OPCIONES) - CORREGIDO
  const handleMembershipSelection = (membership: MembershipInfo) => {
    if (!selectedMember) return;
    
    console.log('🔵 handleMembershipSelection llamada:', { member: selectedMember.firstName, membership: membership.activityName });
    
    setSelectedMembership(membership);
    // ✅ FIX: Llamar a showAttendanceConfirmation
    showAttendanceConfirmation(selectedMember, membership);
  };

  // ✅ CONFIRMAR Y REGISTRAR ASISTENCIA
  const confirmAttendanceRegistration = async () => {
    if (!pendingAttendanceData || !gymData?.id) return;
    
    const { member, membership } = pendingAttendanceData;
    
    setProcessingQR(true);
    setShowConfirmationModal(false);
    
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
        notes: 'Registro manual confirmado',
        registeredBy: 'gym',
        registeredByUserId: userData?.id,
        registeredByUserName: userData?.name
      });
      
      const scanResultObj: ScanResult = {
        success: result.success,
        message: result.success 
          ? `✅ Asistencia registrada para ${member.firstName} ${member.lastName} - ${membership.activityName}`
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
      
      // ✅ LIMPIAR DATOS DESPUÉS DEL REGISTRO
      setSelectedMember(null);
      setSelectedMembership(null);
      setMemberMemberships([]);
      setSearchTerm('');
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
      setPendingAttendanceData(null);
    }
  };

  // ✅ CANCELAR CONFIRMACIÓN
  const cancelAttendanceRegistration = () => {
    setShowConfirmationModal(false);
    setPendingAttendanceData(null);
  };


  // ✅ EFECTOS Y CLEANUP
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
  }, []);

  useEffect(() => {
    loadRecentMembers();
  }, [loadRecentMembers]);

  // ✅ FUNCIÓN PARA ESCANEAR QR
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

  // ✅ PROCESAR CÓDIGO QR
  const procesarCodigoQR = async (decodedText: string) => {
    if (!gymData?.id || processingQR) return;

    try {
      setProcessingQR(true);
      console.log("QR Code escaneado:", decodedText);
      
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
        } catch (e2) {
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



  // ✅ CONFIRMAR ASISTENCIA CON MEMBRESÍA SELECCIONADA (PARA QR)
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

  // ✅ FUNCIONES DE CONTROL
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
  
  const stopScanning = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    setScanning(false);
    lastQRProcessed.current = '';
  };

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


  // ✅ FUNCIONES DE BÚSQUEDA
  const searchMembers = useCallback(() => {
    if (searchTerm.trim().length >= 2) {
      debouncedSearch(searchTerm);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [searchTerm, debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  }, []);

  const handleSearchTermChange = useCallback((newTerm: string) => {
    setSearchTerm(newTerm);
    
    const maintainFocus = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    
    if (newTerm.trim().length >= 2) {
      debouncedSearch(newTerm);
      setTimeout(maintainFocus, 100);
    } else {
      setSearchResults([]);
      setSearchError(null);
    }
  }, [debouncedSearch]);

  // ✅ FUNCIONES AUXILIARES
  const formatDateTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleWebcamError = useCallback((err: string | DOMException) => {
    console.error("Error de cámara:", err);
    setCameraError(`Error al acceder a la cámara: ${err.toString()}`);
    setScanning(false);
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
  }, []);

  

  // ✅ RENDER SCANNER
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

  // ✅ RENDER ENTRADA MANUAL
  const renderManualEntry = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full max-w-lg">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por nombre, DNI, N° socio, email..."
            value={searchTerm}
            onChange={(e) => {
              e.preventDefault();
              handleSearchTermChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                searchMembers();
              }
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.target.selectionStart = e.target.value.length;
            }}
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={false}
            autoFocus
            autoComplete="off"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
        
        <button
          onClick={searchMembers}
          disabled={searchTerm.trim().length < 2}
          className={`w-full mt-3 py-2 rounded-lg flex items-center justify-center transition-colors ${
            searchTerm.trim().length < 2
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Search size={18} className="mr-2" />
          Buscar Socio
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
                <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
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
                    <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      {member.memberNumber && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          N° {member.memberNumber}
                        </span>
                      )}
                      {member.dni && (
                        <span className="text-gray-600 text-xs">DNI: {member.dni}</span>
                      )}
                      <span className="text-gray-400">•</span>
                      <span className="text-xs">{member.email}</span>
                    </div>
                  </div>
                </div>
                {(member.hasDebt || (member.totalDebt && member.totalDebt > 0)) && (
                  <div className="ml-3 flex-shrink-0">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                      Deuda ${member.totalDebt?.toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
              </div>
            ))}


          </div>
        </div>
      )}

      {/* Selección de membresía para registro manual */}
      {selectedMember && memberMemberships.length > 1 && (
        <div className="w-full max-w-lg mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Seleccionar membresía para {selectedMember.firstName} {selectedMember.lastName}:
          </h3>
          <div className="space-y-2">
            {memberMemberships.map(membership => (
              <button
                key={membership.id}
                onClick={() => handleMembershipSelection(membership)}
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
      
      <div className="mt-4 w-full max-w-lg text-center text-xs text-gray-500">
        <p>Escribe al menos 2 caracteres para buscar</p>
        <p>o selecciona un socio de la lista de recientes</p>
      </div>
    </div>
  );



  // ✅ MODAL PARA SELECCIÓN DE MEMBRESÍA DESDE QR
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

  // ✅ MODAL DE CONFIRMACIÓN DE ASISTENCIA
  const renderConfirmationModal = () => (
    showConfirmationModal && pendingAttendanceData && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        style={{ zIndex: 9999 }}
      >
        <div className="bg-white rounded-lg p-6 m-4 max-w-md w-full shadow-2xl">
          <div className="text-center">
            {/* Icono de confirmación */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            
            {/* Título */}
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Confirmar Asistencia
            </h3>
            
            {/* Información del socio */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-600 mb-1">Socio:</div>
              <div className="font-medium text-gray-900">
                {pendingAttendanceData.member.firstName} {pendingAttendanceData.member.lastName}
              </div>
              
              <div className="text-sm text-gray-600 mb-1 mt-3">Actividad:</div>
              <div className="font-medium text-gray-900">
                {pendingAttendanceData.membership.activityName}
              </div>
              
              <div className="text-sm text-gray-600 mb-1 mt-3">Asistencias:</div>
              <div className="text-sm text-gray-700">
                {pendingAttendanceData.membership.currentAttendances || 0}
                {pendingAttendanceData.membership.maxAttendances > 0 && 
                  ` / ${pendingAttendanceData.membership.maxAttendances}`
                } utilizadas
              </div>
              
              <div className="text-sm text-gray-600 mb-1 mt-3">Vencimiento:</div>
              <div className="text-sm text-gray-700">
                {pendingAttendanceData.membership.endDate.toLocaleDateString('es-AR')}
              </div>
            </div>
            
            {/* Mensaje de confirmación */}
            <p className="text-sm text-gray-500 mb-6">
              ¿Está seguro que desea registrar la asistencia para este socio?
            </p>
            
            {/* Botones */}
            <div className="flex space-x-3">
              <button
                onClick={cancelAttendanceRegistration}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAttendanceRegistration}
                disabled={processingQR}
                className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingQR ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Procesando...
                  </div>
                ) : (
                  'Confirmar Asistencia'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );



  // ✅ COMPONENTE PRINCIPAL
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

      {/* Modal de selección de membresía desde QR */}
      {showMembershipSelection && renderMembershipSelection()}

      {/* Modal de confirmación de asistencia */}
      {renderConfirmationModal()}
    </div>
  );
};

export default AttendanceScanner;