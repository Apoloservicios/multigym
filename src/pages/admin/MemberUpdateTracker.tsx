// src/pages/admin/MemberUpdateTracker.tsx
// Monitor de actualización de datos con filtros mejorados
// ✅ CAMBIOS: 
// - Eliminada columna de Email
// - Navegación al detalle del socio corregida

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

type SortField = 'firstName' | 'memberNumber' | 'updatedAt' | 'missingFields';
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
      missing.push('Info. Médica');
    }
    
    return missing;
  };

  /**
   * Cargar todos los socios
   */
  const loadMembers = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    try {
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersQuery = query(membersRef, orderBy('firstName', 'asc'));
      const snapshot = await getDocs(membersQuery);

      const membersData: Member[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Calcular si actualizó datos
        const createdAt = data.createdAt?.toDate();
        const updatedAt = data.updatedAt?.toDate();
        const hasUpdated = !!updatedAt && updatedAt > createdAt;
        
        // Calcular días desde última actualización
        let daysSinceUpdate: number | undefined;
        if (updatedAt) {
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
          daysSinceUpdate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        // Verificar campos faltantes
        const missingFields = checkMissingFields(data);
        
        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
          hasUpdated,
          daysSinceUpdate,
          missingFields,
          missingFieldsCount: missingFields.length
        } as Member;
      });

      setMembers(membersData);
      
      // Calcular estadísticas
      const updatedCount = membersData.filter(m => m.hasUpdated).length;
      const notUpdatedCount = membersData.filter(m => !m.hasUpdated).length;
      const incompleteCount = membersData.filter(m => (m.missingFieldsCount || 0) > 0).length;
      
      setStats({
        total: membersData.length,
        updated: updatedCount,
        notUpdated: notUpdatedCount,
        incomplete: incompleteCount,
        percentage: membersData.length > 0 
          ? Math.round((updatedCount / membersData.length) * 100) : 0
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
        const phone = member.phone.toLowerCase();
        
        return fullName.includes(search) || 
               memberNum.includes(search) || 
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
   * ✅ NAVEGACIÓN CORREGIDA: Ahora se pasa el ID del socio directamente
   */
  const goToMember = (memberId: string) => {
    // En lugar de usar query params, pasamos state
    navigate('/members', { 
      state: { memberId: memberId }
    });
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

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Socios</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Actualizaron Datos</p>
              <p className="text-2xl font-bold text-green-600">{stats.updated}</p>
              <p className="text-xs text-gray-500">{stats.percentage}% del total</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sin Actualizar</p>
              <p className="text-2xl font-bold text-red-600">{stats.notUpdated}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Datos Incompletos</p>
              <p className="text-2xl font-bold text-orange-600">{stats.incomplete}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Barra de búsqueda */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, N° socio o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botones de filtro */}
          <div className="flex flex-wrap gap-2">
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
                {/* ✅ COLUMNA DE EMAIL ELIMINADA */}
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
                  {/* ✅ CELDA DE EMAIL ELIMINADA */}
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
                              {field === 'Info. Médica' && <Heart className="h-3 w-3" />}
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-medium">
                        <CheckCircle className="h-3 w-3" />
                        Completo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => goToMember(member.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
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
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
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
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum : number;
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
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
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
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberUpdateTracker;