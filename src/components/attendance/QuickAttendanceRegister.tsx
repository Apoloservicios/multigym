// src/components/attendance/QuickAttendanceRegister.tsx
import React, { useState, useEffect } from 'react';
import { Search, UserCheck, QrCode, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Member } from '../../types/member.types';
import attendanceService from '../../services/attendance.service';
import useAuth from '../../hooks/useAuth';
import useFirestore from '../../hooks/useFirestore';

interface QuickAttendanceRegisterProps {
  onAttendanceRegistered?: (attendance: any) => void;
  showRecentAttendances?: boolean;
}

const QuickAttendanceRegister: React.FC<QuickAttendanceRegisterProps> = ({
  onAttendanceRegistered,
  showRecentAttendances = true
}) => {
  const { gymData, userData } = useAuth();
  const membersFirestore = useFirestore<Member>('members');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [memberMemberships, setMemberMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentAttendances, setRecentAttendances] = useState<any[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    loadMembers();
    if (showRecentAttendances) {
      loadRecentAttendances();
    }
  }, []);

  useEffect(() => {
    // Filtrar miembros basado en la búsqueda
    if (searchTerm.trim() === '') {
      setFilteredMembers([]);
    } else {
      const filtered = members.filter(member =>
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm)
      );
      setFilteredMembers(filtered.slice(0, 10)); // Limitar a 10 resultados
    }
  }, [searchTerm, members]);

  const loadMembers = async () => {
    if (!gymData?.id) return;
    
    try {
      const allMembers = await membersFirestore.getAll();
      setMembers(allMembers.filter(m => m.status === 'active'));
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const loadRecentAttendances = async () => {
    if (!gymData?.id) return;
    
    try {
      const recent = await attendanceService.getRecentAttendances(gymData.id, 5);
      setRecentAttendances(recent);
    } catch (err) {
      console.error('Error loading recent attendances:', err);
    }
  };

  const handleMemberSelect = async (member: Member) => {
    setSelectedMember(member);
    setSelectedMembership(null);
    setSearchTerm(`${member.firstName} ${member.lastName}`);
    setFilteredMembers([]);
    setError(''); // Limpiar errores previos
    
    // Cargar membresías activas del socio
    if (gymData?.id) {
      try {
        console.log('Cargando membresías para:', member.id);
        const memberships = await attendanceService.getActiveMemberships(gymData.id, member.id);
        console.log('Membresías encontradas:', memberships);
        
        setMemberMemberships(memberships);
        
        if (memberships.length === 0) {
          setError(`${member.firstName} ${member.lastName} no tiene membresías activas`);
          setSelectedMembership(null);
        } else if (memberships.length === 1) {
          // Auto-seleccionar si solo hay una membresía
          setSelectedMembership(memberships[0]);
          console.log('Auto-seleccionada membresía:', memberships[0]);
        } else {
          // Mostrar selector si hay múltiples membresías
          setSelectedMembership(null);
          console.log('Múltiples membresías encontradas, esperando selección');
        }
      } catch (err) {
        console.error('Error loading memberships:', err);
        setError(`Error al cargar las membresías de ${member.firstName} ${member.lastName}`);
        setMemberMemberships([]);
      }
    }
  };

  const registerAttendance = async () => {
    if (!selectedMember || !selectedMembership || !gymData?.id) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await attendanceService.registerAttendance(gymData.id, {
        memberId: selectedMember.id,
        memberName: `${selectedMember.firstName} ${selectedMember.lastName}`,
        memberFirstName: selectedMember.firstName,
        memberLastName: selectedMember.lastName,
        memberEmail: selectedMember.email,
        membershipId: selectedMembership.id,
        activityId: selectedMembership.activityId,
        activityName: selectedMembership.activityName,
        notes: 'Registro manual desde dashboard',
        // NUEVOS CAMPOS
        registeredBy: 'gym',
        registeredByUserId: userData?.id,
        registeredByUserName: userData?.name
      });

      if (result.success) {
        setSuccess(`Asistencia registrada para ${selectedMember.firstName} ${selectedMember.lastName} - ${selectedMembership.activityName}`);
        setSearchTerm('');
        setSelectedMember(null);
        setSelectedMembership(null);
        setMemberMemberships([]);
        
        // Recargar asistencias recientes
        if (showRecentAttendances) {
          loadRecentAttendances();
        }
        
        // Callback opcional
        onAttendanceRegistered?.(result);
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Error al registrar la asistencia');
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar la asistencia');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <UserCheck size={20} className="mr-2 text-green-600" />
          Registro Rápido de Asistencia
        </h3>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setShowQRScanner(!showQRScanner)}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center"
          >
            <QrCode size={16} className="mr-1" />
            QR
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md flex items-center">
          <AlertCircle size={16} className="mr-2 text-red-600" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded-md flex items-center">
          <CheckCircle size={16} className="mr-2 text-green-600" />
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}

      {/* Buscador de socios */}
      <div className="relative mb-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar socio por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Lista desplegable de resultados */}
        {filteredMembers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberSelect(member)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={`${member.firstName} ${member.lastName}`}
                      className="w-8 h-8 rounded-full object-cover mr-3"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-medium text-gray-600">
                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {member.email} {member.phone && `• ${member.phone}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selección de membresía */}
      {selectedMember && memberMemberships.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Membresía:
          </label>
          <div className="space-y-2">
            {memberMemberships.map((membership) => (
              <button
                key={membership.id}
                onClick={() => setSelectedMembership(membership)}
                className={`w-full p-3 text-left border rounded-md transition-colors ${
                  selectedMembership?.id === membership.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">
                      {membership.activityName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {membership.currentAttendances || 0}
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

      {/* Mostrar membresía seleccionada automáticamente */}
      {selectedMember && memberMemberships.length === 1 && selectedMembership && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-700">
            Membresía seleccionada: <strong>{selectedMembership.activityName}</strong>
          </div>
          <div className="text-xs text-blue-600">
            {selectedMembership.currentAttendances || 0}
            {selectedMembership.maxAttendances > 0 && ` / ${selectedMembership.maxAttendances}`} asistencias
          </div>
        </div>
      )}

      {/* Advertencia si no hay membresías */}
      {selectedMember && memberMemberships.length === 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-sm text-yellow-700">
            Este socio no tiene membresías activas
          </div>
        </div>
      )}

      {/* Botón de registro */}
      <button
        onClick={registerAttendance}
        disabled={!selectedMember || !selectedMembership || loading || memberMemberships.length === 0}
        className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center ${
          selectedMember && selectedMembership && !loading && memberMemberships.length > 0
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            Registrando...
          </>
        ) : (
          <>
            <UserCheck size={20} className="mr-2" />
            {!selectedMember 
              ? 'Seleccionar Socio'
              : memberMemberships.length === 0
              ? 'Sin Membresías Activas'
              : !selectedMembership
              ? 'Seleccionar Membresía'
              : 'Registrar Asistencia'
            }
          </>
        )}
      </button>

      {/* Asistencias recientes */}
      {showRecentAttendances && recentAttendances.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Calendar size={16} className="mr-2" />
            Últimas Asistencias
          </h4>
          <div className="space-y-2">
            {recentAttendances.map((attendance) => (
              <div
                key={attendance.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {attendance.memberName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {attendance.activityName}
                      {attendance.registeredBy === 'member' && (
                        <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          Auto-registro
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(attendance.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanner QR (placeholder) */}
      {showQRScanner && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-center">
            <QrCode size={48} className="mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-blue-700">
              Funcionalidad de escaneo QR próximamente
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Por ahora usa la búsqueda manual arriba
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickAttendanceRegister;