// src/pages/admin/MemberUpdateTrackerOptimized.tsx
// 📝 CONTROL DE DATOS OPTIMIZADO
// ✅ MEJORAS: Búsqueda por DNI, notificación WhatsApp, paginación

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  RefreshCw, CheckCircle, AlertCircle, Search, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, ExternalLink,
  Camera, Mail, Phone, MapPin, Send
} from 'lucide-react';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dni?: string;
  memberNumber: number;
  createdAt: any;
  updatedAt?: any;
  hasUpdated: boolean;
  daysSinceUpdate?: number;
  
  // Campos opcionales
  photo?: string | null;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string;
  injuries?: string;
  allergies?: string;
  hasMedicalCertificate?: 'yes' | 'no';
  
  // Campos calculados
  missingFieldsCount?: number;
  missingFields?: string[];
}

type SortField = 'firstName' | 'memberNumber' | 'updatedAt' | 'missingFields' | 'dni';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'updated' | 'notUpdated' | 'incomplete';

const MemberUpdateTrackerOptimized: React.FC = () => {
  const { gymData } = useAuth();
  const navigate = useNavigate();
  
  // Estados principales
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de filtrado
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de ordenamiento
  const [sortField, setSortField] = useState<SortField>('firstName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Estados de notificación
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    total: 0,
    updated: 0,
    notUpdated: 0,
    incomplete: 0,
    percentage: 0
  });

  useEffect(() => {
    if (gymData?.id) {
      loadMembers();
    }
  }, [gymData?.id]);

  /**
   * ✅ Verificar campos faltantes
   */
  const checkMissingFields = (member: any) => {
    const missing: string[] = [];
    
    if (!member.photo) missing.push('Foto');
    if (!member.dni) missing.push('DNI');
    if (!member.email) missing.push('Email');
    if (!member.phone) missing.push('Teléfono');
    if (!member.address) missing.push('Dirección');
    if (!member.emergencyContactName || !member.emergencyContactPhone) {
      missing.push('Contacto de Emergencia');
    }
    if (!member.medicalConditions && !member.injuries && !member.allergies && !member.hasMedicalCertificate) {
      missing.push('Info. Médica');
    }
    
    return missing;
  };

  /**
   * 📥 Cargar socios
   */
  const loadMembers = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      setError('');

      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersQuery = query(membersRef, orderBy('firstName', 'asc'));
      const membersSnapshot = await getDocs(membersQuery);

      const membersData: Member[] = [];
      let updatedCount = 0;
      let incompleteCount = 0;

      membersSnapshot.forEach((doc) => {
        const data = doc.data();
        
        const hasUpdated = Boolean(data.updatedAt);
        if (hasUpdated) updatedCount++;

        // Calcular días desde última actualización
        let daysSinceUpdate = undefined;
        if (data.updatedAt) {
          const updateDate = data.updatedAt.toDate();
          const today = new Date();
          daysSinceUpdate = Math.floor((today.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Verificar campos faltantes
        const missingFields = checkMissingFields(data);
        if (missingFields.length > 0) incompleteCount++;

        membersData.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          dni: data.dni || '',
          memberNumber: data.memberNumber || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          hasUpdated,
          daysSinceUpdate,
          
          // Campos opcionales
          photo: data.photo,
          address: data.address,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          medicalConditions: data.medicalConditions,
          injuries: data.injuries,
          allergies: data.allergies,
          hasMedicalCertificate: data.hasMedicalCertificate,
          
          // Campos calculados
          missingFieldsCount: missingFields.length,
          missingFields
        });
      });

      setMembers(membersData);
      setStats({
        total: membersData.length,
        updated: updatedCount,
        notUpdated: membersData.length - updatedCount,
        incomplete: incompleteCount,
        percentage: membersData.length > 0 
          ? Math.round((updatedCount / membersData.length) * 100)
          : 0
      });

    } catch (err: any) {
      console.error('Error cargando socios:', err);
      setError('Error al cargar los socios');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Filtrar miembros
   */
  const filteredMembers = useMemo(() => {
    let filtered = [...members];

    // Aplicar filtro
    if (filter === 'updated') {
      filtered = filtered.filter(m => m.hasUpdated);
    } else if (filter === 'notUpdated') {
      filtered = filtered.filter(m => !m.hasUpdated);
    } else if (filter === 'incomplete') {
      filtered = filtered.filter(m => m.missingFieldsCount! > 0);
    }

    // Aplicar búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(member =>
        member.firstName.toLowerCase().includes(searchLower) ||
        member.lastName.toLowerCase().includes(searchLower) ||
        member.dni?.includes(searchTerm) ||
        member.email.toLowerCase().includes(searchLower) ||
        member.phone.includes(searchTerm)
      );
    }

    return filtered;
  }, [members, filter, searchTerm]);

  /**
   * 🔽 Ordenar miembros
   */
  const sortedMembers = useMemo(() => {
    const sorted = [...filteredMembers];

    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'memberNumber':
          aValue = a.memberNumber;
          bValue = b.memberNumber;
          break;
        case 'firstName':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'dni':
          aValue = a.dni || '';
          bValue = b.dni || '';
          break;
        case 'updatedAt':
          aValue = a.daysSinceUpdate ?? 999999;
          bValue = b.daysSinceUpdate ?? 999999;
          break;
        case 'missingFields':
          aValue = a.missingFieldsCount || 0;
          bValue = b.missingFieldsCount || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredMembers, sortField, sortDirection]);

  /**
   * 📄 Paginar miembros
   */
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedMembers.slice(startIndex, endIndex);
  }, [sortedMembers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);

  /**
   * 🔄 Cambiar ordenamiento
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  /**
   * 🎨 Icono de ordenamiento
   */
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600" />
      : <ArrowDown size={14} className="text-blue-600" />;
  };

  /**
   * 📱 Enviar notificación por WhatsApp
   */
  const sendWhatsAppNotification = async (member: Member) => {
    if (!member.phone || member.phone.length < 8) {
      alert('El socio no tiene un número de teléfono válido.');
      return;
    }

    if (member.missingFieldsCount === 0) {
      alert('El socio ya tiene todos los datos completos.');
      return;
    }

    try {
      setSendingNotification(member.id);
      setError('');
      setSuccess('');

      // Generar link de autoregistro
      const registrationLink = `https://multigym.com.ar/register/${gymData?.id}`;
      
      // Construir mensaje
      const missingFieldsList = member.missingFields!.join(', ');
      const message = 
        `Hola ${member.firstName}! 👋\n\n` +
        `Necesitamos completar tu información en el gimnasio.\n\n` +
        `Datos faltantes: ${missingFieldsList}\n\n` +
        `Por favor, actualiza tus datos ingresando aquí:\n${registrationLink}\n\n` +
        `¡Gracias! 💪`;

      // Formatear número de teléfono (quitar espacios, guiones, etc.)
      const cleanPhone = member.phone.replace(/[\s\-()]/g, '');
      
      // Abrir WhatsApp Web
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Registrar notificación en Firestore
      const memberRef = doc(db, `gyms/${gymData!.id}/members`, member.id);
      await updateDoc(memberRef, {
        lastDebtNotification: Timestamp.now(),
        debtNotificationCount: (member as any).debtNotificationCount ? 
          (member as any).debtNotificationCount + 1 : 1
      });

      setSuccess(`✅ Notificación enviada a ${member.firstName} ${member.lastName}`);
      
      // Recargar para actualizar el contador
      await loadMembers();

    } catch (err: any) {
      console.error('Error enviando notificación:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setSendingNotification(null);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
    }
  };

  // 🔄 Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Cargando socios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Control de Actualizaciones
        </h1>
        <p className="text-gray-600">
          Monitorea qué socios han actualizado sus datos y qué información les falta
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <RefreshCw className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actualizados</p>
              <p className="text-3xl font-bold text-green-600">{stats.updated}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sin Actualizar</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.notUpdated}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Datos Incompletos</p>
              <p className="text-3xl font-bold text-red-600">{stats.incomplete}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Búsqueda */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI, email o teléfono..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setFilter('all');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => {
                setFilter('updated');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'updated'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Actualizados ({stats.updated})
            </button>
            <button
              onClick={() => {
                setFilter('notUpdated');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'notUpdated'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Actualizar ({stats.notUpdated})
            </button>
            <button
              onClick={() => {
                setFilter('incomplete');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'incomplete'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Incompletos ({stats.incomplete})
            </button>

            <button
              onClick={loadMembers}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 transition flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Recargar
            </button>
          </div>
        </div>

        {/* Contador */}
        <div className="mt-3 text-sm text-gray-600">
          Mostrando {paginatedMembers.length} de {sortedMembers.length} resultados
          {searchTerm && ` (filtrado de ${stats.total} total)`}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  onClick={() => handleSort('memberNumber')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    N° Socio
                    <SortIcon field="memberNumber" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('dni')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    DNI
                    <SortIcon field="dni" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('firstName')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Nombre
                    <SortIcon field="firstName" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th 
                  onClick={() => handleSort('updatedAt')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Última Actualización
                    <SortIcon field="updatedAt" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('missingFields')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Datos Faltantes
                    <SortIcon field="missingFields" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm 
                      ? `No se encontraron resultados para "${searchTerm}"`
                      : 'No hay socios para mostrar'
                    }
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{member.memberNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {member.dni || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {member.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {member.hasUpdated ? (
                        <span className="text-green-600">
                          Hace {member.daysSinceUpdate} día(s)
                        </span>
                      ) : (
                        <span className="text-yellow-600">Nunca</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {member.missingFieldsCount! > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {member.missingFieldsCount} faltante(s)
                          </span>
                          <div className="text-xs text-gray-500">
                            {member.missingFields!.slice(0, 2).join(', ')}
                            {member.missingFields!.length > 2 && '...'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Completo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate('/members', { 
                            state: { memberId: member.id }
                          })}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                        >
                          <ExternalLink size={14} />
                          Ver
                        </button>
                        
                        {member.phone && member.missingFieldsCount! > 0 && (
                          <button
                            onClick={() => sendWhatsAppNotification(member)}
                            disabled={sendingNotification === member.id}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:bg-gray-200 disabled:text-gray-500"
                          >
                            {sendingNotification === member.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            WhatsApp
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberUpdateTrackerOptimized;