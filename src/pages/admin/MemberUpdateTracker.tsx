// src/pages/admin/MemberUpdateTracker.tsx
// Monitor de actualización de datos con filtros mejorados

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  RefreshCw, CheckCircle, AlertCircle, Calendar, Users, Search, 
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  AlertTriangle, ExternalLink, Camera, Mail, Phone, MapPin,
  UserPlus, Heart
} from 'lucide-react';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  memberNumber: number;
  createdAt: any;
  updatedAt?: any;
  hasUpdated: boolean;
  daysSinceUpdate?: number;
  
  // Campos opcionales para verificar completitud
  photo?: string | null;
  dni?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string;
  injuries?: string;
  allergies?: string;
  hasMedicalCertificate?: 'yes' | 'no';
  
  // Campo calculado
  missingFieldsCount?: number;
  missingFields?: string[];
}

type SortField = 'firstName' | 'memberNumber' | 'email' | 'updatedAt' | 'missingFields';
type SortDirection = 'asc' | 'desc';

const MemberUpdateTracker = () => {
  const { gymData } = useAuth();
  const navigate = useNavigate();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'updated' | 'notUpdated' | 'incomplete'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('firstName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
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
   * Verificar campos faltantes de un socio
   */
  const checkMissingFields = (member: any) => {
    const missing: string[] = [];
    
    if (!member.photo) missing.push('Foto');
    if (!member.dni) missing.push('DNI');
    if (!member.email) missing.push('Email');
    if (!member.phone) missing.push('Teléfono');
    if (!member.address) missing.push('Dirección');
    if (!member.emergencyContactName || !member.emergencyContactPhone) {
      missing.push('Contacto Emergencia');
    }
    if (!member.medicalConditions && !member.injuries && !member.allergies && !member.hasMedicalCertificate) {
      missing.push('Info. Salud');
    }
    
    return missing;
  };

  const loadMembers = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    try {
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersQuery = query(membersRef, orderBy('firstName', 'asc'));
      const snapshot = await getDocs(membersQuery);

      const now = new Date();
      const membersData: Member[] = [];
      let updatedCount = 0;
      let incompleteCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate() || new Date();
        const updatedAt = data.updatedAt?.toDate();

        const hasUpdated = updatedAt && updatedAt.getTime() !== createdAt.getTime();
        
        if (hasUpdated) {
          updatedCount++;
        }

        let daysSinceUpdate = undefined;
        if (updatedAt) {
          const diffTime = now.getTime() - updatedAt.getTime();
          daysSinceUpdate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        // Verificar campos faltantes
        const missingFields = checkMissingFields(data);
        const missingFieldsCount = missingFields.length;
        
        if (missingFieldsCount > 0) {
          incompleteCount++;
        }

        membersData.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          memberNumber: data.memberNumber || 0,
          createdAt: createdAt,
          updatedAt: updatedAt,
          hasUpdated: !!hasUpdated,
          daysSinceUpdate,
          
          // Campos opcionales
          photo: data.photo || null,
          dni: data.dni || '',
          address: data.address || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          medicalConditions: data.medicalConditions || '',
          injuries: data.injuries || '',
          allergies: data.allergies || '',
          hasMedicalCertificate: data.hasMedicalCertificate || undefined,
          
          // Campos calculados
          missingFieldsCount,
          missingFields
        });
      });

      setMembers(membersData);
      setStats({
        total: membersData.length,
        updated: updatedCount,
        notUpdated: membersData.length - updatedCount,
        incomplete: incompleteCount,
        percentage: membersData.length > 0 ? Math.round((updatedCount / membersData.length) * 100) : 0
      });

    } catch (error) {
      console.error('Error cargando socios:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ordenar columnas
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Icono de ordenamiento
   */
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  // Filtrar, buscar y ordenar
  const getFilteredAndSortedMembers = () => {
    let filtered = members.filter(member => {
      // Filtro por estado
      if (filter === 'updated' && !member.hasUpdated) return false;
      if (filter === 'notUpdated' && member.hasUpdated) return false;
      if (filter === 'incomplete' && (member.missingFieldsCount || 0) === 0) return false;
      
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        const memberNum = member.memberNumber.toString();
        const email = member.email.toLowerCase();
        const phone = member.phone.toLowerCase();
        
        return fullName.includes(search) || 
               memberNum.includes(search) || 
               email.includes(search) ||
               phone.includes(search);
      }
      
      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'firstName':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'memberNumber':
          aValue = a.memberNumber;
          bValue = b.memberNumber;
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'updatedAt':
          aValue = a.updatedAt?.getTime() || 0;
          bValue = b.updatedAt?.getTime() || 0;
          break;
        case 'missingFields':
          aValue = a.missingFieldsCount || 0;
          bValue = b.missingFieldsCount || 0;
          break;
        default:
          aValue = a.firstName;
          bValue = b.firstName;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredMembers = getFilteredAndSortedMembers();

  // Paginación
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  // Resetear página al cambiar filtro o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, sortField, sortDirection]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Nunca';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  /**
   * Navegar al detalle del socio
   */
  const goToMember = (memberId: string) => {
    navigate(`/members?memberId=${memberId}`);
  };

  if (!gymData?.id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          Cargando información del gimnasio...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Monitor de Actualización de Datos
        </h1>
        <p className="text-gray-600">
          Control de socios que actualizaron sus datos y completitud de información
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actualizaron</p>
              <p className="text-3xl font-bold text-green-600">{stats.updated}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">No Actualizaron</p>
              <p className="text-3xl font-bold text-red-600">{stats.notUpdated}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Datos Incompletos</p>
              <p className="text-3xl font-bold text-orange-600">{stats.incomplete}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">% Actualizado</p>
              <p className="text-3xl font-bold text-purple-600">{stats.percentage}%</p>
            </div>
            <Calendar className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Barra de búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, N° socio, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilter('updated')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'updated'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Actualizados ({stats.updated})
            </button>
            <button
              onClick={() => setFilter('notUpdated')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'notUpdated'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Actualizar ({stats.notUpdated})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'incomplete'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Incompletos ({stats.incomplete})
            </button>
            <button
              onClick={loadMembers}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="mt-3 text-sm text-gray-600">
          Mostrando {currentMembers.length} de {filteredMembers.length} resultados
        </div>
      </div>

      {/* Tabla de socios */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  onClick={() => handleSort('memberNumber')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-2">
                    N° Socio
                    <SortIcon field="memberNumber" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('firstName')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-2">
                    Nombre
                    <SortIcon field="firstName" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-2">
                    Email
                    <SortIcon field="email" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th 
                  onClick={() => handleSort('updatedAt')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-2">
                    Última Actualización
                    <SortIcon field="updatedAt" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('missingFields')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-2">
                    Campos Faltantes
                    <SortIcon field="missingFields" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{member.memberNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {member.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {member.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {member.updatedAt ? (
                      <div>
                        <div>{formatDate(member.updatedAt)}</div>
                        {member.daysSinceUpdate !== undefined && (
                          <div className="text-xs text-gray-500">
                            Hace {member.daysSinceUpdate} días
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-600 font-medium">Nunca actualizó</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(member.missingFieldsCount || 0) > 0 ? (
                      <div className="flex items-start gap-2">
                        <div className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {member.missingFieldsCount}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {member.missingFields?.map((field, idx) => (
                            <span 
                              key={idx}
                              className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                            >
                              {field === 'Foto' && <Camera className="h-3 w-3" />}
                              {field === 'Email' && <Mail className="h-3 w-3" />}
                              {field === 'Teléfono' && <Phone className="h-3 w-3" />}
                              {field === 'Dirección' && <MapPin className="h-3 w-3" />}
                              {field === 'Contacto Emergencia' && <UserPlus className="h-3 w-3" />}
                              {field === 'Info. Salud' && <Heart className="h-3 w-3" />}
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Completo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => goToMember(member.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver Socio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberUpdateTracker;