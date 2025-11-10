// src/pages/admin/MembershipAssignmentControlOptimized.tsx
// 🎫 CONTROL DE MEMBRESÍAS OPTIMIZADO
// ✅ MEJORAS: Ordenamiento por columna, búsqueda por DNI, paginación

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CheckCircle, AlertTriangle, Search, ChevronLeft, 
  ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw,
  Activity, ExternalLink
} from 'lucide-react';
import { collection, getDocs, query, where,orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dni?: string;  // ← Agregado para búsqueda
  memberNumber: number;
  hasMembership: boolean;
  activeMemberships: Array<{
    id: string;
    activityName: string;
    startDate: string;
    status: string;
  }>;
}

type SortField = 'memberNumber' | 'firstName' | 'email' | 'phone' | 'memberships' | 'dni';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'withMembership' | 'withoutMembership';

const MembershipAssignmentControlOptimized: React.FC = () => {
  const { gymData } = useAuth();
  const navigate = useNavigate();
  
  // Estados principales
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMemberships, setLoadingMemberships] = useState(false); // ← NUEVO
  const [error, setError] = useState('');
  
  // Estados de filtrado y búsqueda
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de ordenamiento
  const [sortField, setSortField] = useState<SortField>('firstName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    withMembership: 0,
    withoutMembership: 0,
    percentage: 0
  });

  useEffect(() => {
    if (gymData?.id) {
      loadStats(); // Cargar estadísticas primero (rápido)
      loadMembers(); // Luego cargar socios
    }
  }, [gymData?.id]);

  /**
   * 📥 Cargar estadísticas totales (rápido - sin membresías)
   */
  const loadStats = async () => {
    if (!gymData?.id) return;

    try {
      // Solo contar socios, sin cargar membresías
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      let withMembershipCount = 0;
      
      // Solo revisar un campo simple en cada socio
      for (const memberDoc of membersSnapshot.docs) {
        const data = memberDoc.data();
        // Verificar si tiene membresías activas usando un campo agregado (si existe)
        if (data.activeMembershipsCount && data.activeMembershipsCount > 0) {
          withMembershipCount++;
        } else {
          // Fallback: contar rápido
          const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
          const membershipsSnap = await getDocs(query(membershipsRef, where('status', '==', 'active')));
          if (!membershipsSnap.empty) {
            withMembershipCount++;
          }
        }
      }

      setStats({
        total: membersSnapshot.size,
        withMembership: withMembershipCount,
        withoutMembership: membersSnapshot.size - withMembershipCount,
        percentage: membersSnapshot.size > 0 
          ? Math.round((withMembershipCount / membersSnapshot.size) * 100)
          : 0
      });

    } catch (err: any) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  /**
   * 📥 Cargar solo los socios de la página actual (paginación en servidor)
   */
  const loadMembers = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      setError('');

      // Cargar TODOS los socios primero (sin membresías) para poder filtrar/buscar
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersQuery = query(membersRef, orderBy('firstName', 'asc'));
      const membersSnapshot = await getDocs(membersQuery);

      const allMembersBasic: Member[] = [];

      // Primera pasada: solo datos básicos, sin membresías
      membersSnapshot.forEach((doc) => {
        const data = doc.data();
        allMembersBasic.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          dni: data.dni || '',
          memberNumber: data.memberNumber || 0,
          hasMembership: false, // Se actualizará después
          activeMemberships: []
        });
      });

      setMembers(allMembersBasic);
      setLoading(false);

      // Segunda pasada: cargar membresías solo para los socios visibles en la página actual
      loadMembershipsForCurrentPage(allMembersBasic);

    } catch (err: any) {
      console.error('Error cargando socios:', err);
      setError('Error al cargar los socios');
      setLoading(false);
    }
  };

  /**
   * 🔄 Cargar membresías solo para los socios de la página actual
   */
  const loadMembershipsForCurrentPage = async (allMembers: Member[]) => {
    if (!gymData?.id) return;

    try {
      setLoadingMemberships(true);

      // Calcular qué socios están en la página actual DESPUÉS de filtrar
      const filtered = getFilteredMembers(allMembers);
      const sorted = getSortedMembers(filtered);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentPageMembers = sorted.slice(startIndex, endIndex);

      // Cargar membresías solo para estos socios
      const updatedMembers = [...allMembers];
      
      for (const member of currentPageMembers) {
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${member.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const activeMemberships: Array<{
          id: string;
          activityName: string;
          startDate: string;
          status: string;
        }> = [];

        membershipsSnapshot.forEach((memDoc) => {
          const memData = memDoc.data();
          if (memData.status === 'active') {
            activeMemberships.push({
              id: memDoc.id,
              activityName: memData.activityName || 'Sin nombre',
              startDate: memData.startDate || '',
              status: memData.status
            });
          }
        });

        // Actualizar el socio en el array
        const memberIndex = updatedMembers.findIndex(m => m.id === member.id);
        if (memberIndex !== -1) {
          updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            hasMembership: activeMemberships.length > 0,
            activeMemberships
          };
        }
      }

      setMembers(updatedMembers);

    } catch (err: any) {
      console.error('Error cargando membresías:', err);
    } finally {
      setLoadingMemberships(false);
    }
  };

  /**
   * 🔍 Obtener miembros filtrados (sin ordenar ni paginar)
   */
  const getFilteredMembers = (membersList: Member[]) => {
    let filtered = [...membersList];

    // Aplicar filtro por membresía
    if (filter === 'withMembership') {
      filtered = filtered.filter(m => m.hasMembership);
    } else if (filter === 'withoutMembership') {
      filtered = filtered.filter(m => !m.hasMembership);
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
  };

  /**
   * 🔽 Obtener miembros ordenados (sin paginar)
   */
  const getSortedMembers = (membersList: Member[]) => {
    const sorted = [...membersList];

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
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'phone':
          aValue = a.phone;
          bValue = b.phone;
          break;
        case 'memberships':
          aValue = a.activeMemberships.length;
          bValue = b.activeMemberships.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  // Cargar membresías cuando cambie la página, filtro, búsqueda u ordenamiento
  useEffect(() => {
    if (members.length > 0 && !loading) {
      loadMembershipsForCurrentPage(members);
    }
  }, [currentPage, filter, searchTerm, sortField, sortDirection]);

  /**
   * 🔍 Filtrar y ordenar socios (usa las funciones definidas arriba)
   */
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = getFilteredMembers(members);
    return getSortedMembers(filtered);
  }, [members, filter, searchTerm, sortField, sortDirection]);

  /**
   * 📄 Paginar socios
   */
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedMembers.slice(startIndex, endIndex);
  }, [filteredAndSortedMembers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedMembers.length / itemsPerPage);

  /**
   * 🔄 Cambiar ordenamiento
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es un campo nuevo, ordenar ascendente
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Resetear a página 1
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
          Control de Membresías
        </h1>
        <p className="text-gray-600">
          Gestiona qué socios tienen membresías asignadas
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
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Membresía</p>
              <p className="text-3xl font-bold text-green-600">{stats.withMembership}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sin Membresía</p>
              <p className="text-3xl font-bold text-red-600">{stats.withoutMembership}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cobertura</p>
              <p className="text-3xl font-bold text-purple-600">{stats.percentage}%</p>
            </div>
            <Activity className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Mensaje de error */}
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => {
                setFilter('withMembership');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'withMembership'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Con Membresía ({stats.withMembership})
            </button>
            <button
              onClick={() => {
                setFilter('withoutMembership');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'withoutMembership'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Membresía ({stats.withoutMembership})
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

        {/* Contador de resultados */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {paginatedMembers.length} de {filteredAndSortedMembers.length} resultados
            {searchTerm && ` (filtrado de ${stats.total} total)`}
          </div>
          
          {loadingMemberships && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <RefreshCw size={16} className="animate-spin" />
              <span>Cargando membresías...</span>
            </div>
          )}
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
                <th 
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Email
                    <SortIcon field="email" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('phone')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Teléfono
                    <SortIcon field="phone" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('memberships')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    Membresías Activas
                    <SortIcon field="memberships" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                      {member.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {member.phone}
                    </td>
                    <td className="px-6 py-4">
                      {member.activeMemberships.length > 0 ? (
                        <div className="space-y-1">
                          {member.activeMemberships.map((mem) => (
                            <div key={mem.id} className="text-sm text-gray-700">
                              • {mem.activityName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Sin membresías
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.hasMembership ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Sin membresía
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate('/members', { 
                          state: { memberId: member.id }
                        })}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      >
                        <ExternalLink size={14} />
                        Ver Detalle
                      </button>
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

export default MembershipAssignmentControlOptimized;