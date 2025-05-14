// src/components/members/MemberList.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, User, Edit, Trash, Eye, CreditCard, BanknoteIcon, RefreshCw, Filter, UserPlus, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Member } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';
import useFirestore from '../../hooks/useFirestore';
import { debounce } from 'lodash';

interface MemberListProps {
  onNewMember: () => void;
  onViewMember: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
  onGenerateQr: (member: Member) => void;
  onRegisterPayment: (member: Member) => void;
}

const MemberList: React.FC<MemberListProps> = ({ 
  onNewMember, 
  onViewMember, 
  onEditMember, 
  onDeleteMember, 
  onGenerateQr, 
  onRegisterPayment 
}) => {
  const { gymData } = useAuth();
  const membersFirestore = useFirestore<Member>('members');
  
  // Estados principales
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  
  // Estados para ordenamiento
  const [sortField, setSortField] = useState<string>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Configuración de paginación
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(totalMembers / ITEMS_PER_PAGE);

  // Función debounced para búsqueda
  const debouncedSearch = useMemo(
    () => debounce(async (term: string) => {
      if (!term.trim()) {
        if (gymData?.id) {
          loadMembers(true);
        }
        return;
      }
      
      setSearching(true);
      setError('');
      
      try {
        console.log('Iniciando búsqueda para:', term);
        
        // Usar la búsqueda simple del hook
        const searchResults = await membersFirestore.search(
          term.trim(), 
          ['firstName', 'lastName', 'email', 'phone'],
          100 // Límite de resultados de búsqueda
        );
        
        console.log('Resultados de búsqueda obtenidos:', searchResults.length);
        
        // Aplicar filtros adicionales en el frontend
        let filteredResults = searchResults;
        
        if (statusFilter !== 'all') {
          filteredResults = filteredResults.filter(m => m.status === statusFilter);
        }
        
        if (debtFilter === 'with_debt') {
          filteredResults = filteredResults.filter(m => (m.totalDebt || 0) > 0);
        } else if (debtFilter === 'no_debt') {
          filteredResults = filteredResults.filter(m => (m.totalDebt || 0) === 0);
        }
        
        setMembers(filteredResults);
        setCurrentPage(1);
        setTotalMembers(filteredResults.length);
        console.log('Búsqueda completada, resultados filtrados:', filteredResults.length);
        
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setError('Error al buscar miembros. Inténtalo de nuevo.');
      } finally {
        setSearching(false);
      }
    }, 300),
    [membersFirestore, statusFilter, debtFilter, gymData?.id]
  );

  // Cargar miembros con paginación y filtros
 const loadMembers = useCallback(async (reset: boolean = false) => {
  if (!gymData?.id) {
    setLoading(false);
    return;
  }
  
  console.log('Cargando miembros - Reset:', reset);
  
  setLoading(true);
  setError('');
  
  try {
    // USAR SOLO getAll - sin paginación por ahora
    const allMembers = await membersFirestore.getAll();
    
    console.log('Todos los miembros obtenidos:', allMembers.length);
    
    // Aplicar TODOS los filtros en el frontend
    let filteredMembers = allMembers;
    
    // Filtro de estado
    if (statusFilter !== 'all') {
      filteredMembers = filteredMembers.filter(m => m.status === statusFilter);
    }
    
    // Filtro de deuda
    if (debtFilter === 'with_debt') {
      filteredMembers = filteredMembers.filter(m => (m.totalDebt || 0) > 0);
    } else if (debtFilter === 'no_debt') {
      filteredMembers = filteredMembers.filter(m => (m.totalDebt || 0) === 0);
    }
    
    // Ordenamiento en el frontend
    filteredMembers.sort((a, b) => {
      const aValue = (a as any)[sortField] || '';
      const bValue = (b as any)[sortField] || '';
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setMembers(filteredMembers);
    setTotalMembers(filteredMembers.length);
    setCurrentPage(1);
    
    console.log('Miembros filtrados y ordenados:', filteredMembers.length);
    
  } catch (error) {
    console.error('Error cargando miembros:', error);
    setError('Error al cargar los miembros. Inténtalo de nuevo.');
  } finally {
    setLoading(false);
    setIsLoadingMore(false);
  }
}, [
  gymData?.id,
  membersFirestore,
  statusFilter,
  debtFilter,
  sortField,
  sortDirection
]);

  useEffect(() => {
  if (gymData?.id) {
    console.log('Efecto de carga activado');
    loadMembers(true);
  }
}, [
  gymData?.id,
  statusFilter,
  debtFilter,
  sortField,
  sortDirection
]);

// MANTENER solo el useEffect de búsqueda:
useEffect(() => {
  if (searchTerm.trim()) {
    console.log('Término de búsqueda cambió:', searchTerm);
    debouncedSearch(searchTerm);
  } else {
    // Recargar datos normales cuando se limpia la búsqueda
    if (gymData?.id) {
      console.log('Búsqueda limpiada, recargando datos normales...');
      loadMembers(true);
    }
  }
  
  return () => {
    debouncedSearch.cancel();
  };
}, [searchTerm]);

  // Función para manejar ordenamiento
  const handleSort = (field: string) => {
    console.log('Cambiando ordenamiento a:', field);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Refrescar datos
  const handleRefresh = async () => {
    console.log('Refrescando datos...');
    setRefreshing(true);
    setError('');
    
    try {
      await loadMembers(true);
    } catch (error) {
      console.error('Error al refrescar:', error);
      setError('Error al actualizar los datos.');
    } finally {
      setRefreshing(false);
    }
  };



  // Función robusta para formatear fechas
  const formatDate = useCallback((dateString: string | Date | any | null | undefined): string => {
    if (!dateString) return 'No disponible';
    
    try {
      // Si es un objeto Date directamente
      if (typeof dateString.getMonth === 'function') {
        return dateString.toLocaleDateString('es-AR');
      }
      
      // Si es un objeto Timestamp de Firebase con un método toDate()
      if (dateString.toDate && typeof dateString.toDate === 'function') {
        return dateString.toDate().toLocaleDateString('es-AR');
      }
      
      // Si es un string o cualquier otro formato, intentar convertirlo a Date
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-AR');
      }
      
      // Si no es convertible a fecha, devolver el string original
      return String(dateString);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString ? String(dateString) : 'No disponible';
    }
  }, []);
  
  // Confirmar eliminación
  const confirmDelete = (member: Member) => {
    if (window.confirm(`¿Está seguro que desea eliminar a ${member.firstName} ${member.lastName}?`)) {
      onDeleteMember(member.id);
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    console.log('Limpiando filtros...');
    setSearchTerm('');
    setStatusFilter('all');
    setDebtFilter('all');
    setCurrentPage(1);
  };

  // Memoizar los miembros mostrados para evitar re-renderizados
  const displayedMembers = useMemo(() => {
  // Mostrar todos los miembros sin paginación
  return members;
}, [members]);

  // Cambiar página


  // Componentes para estados de carga
  const LoadingMembers = () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <div className="inline-flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <div>
            <p className="text-gray-600 font-medium">Cargando socios...</p>
            <div className="w-48 bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: '45%' }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {searchTerm ? `Buscando "${searchTerm}"...` : 'Obteniendo datos del servidor...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente para filtros activos
  const ActiveFilters = () => {
    const activeFilters = [];
    
    if (statusFilter !== 'all') {
      activeFilters.push({
        label: 'Estado',
        value: statusFilter === 'active' ? 'Activo' : 'Inactivo',
        onRemove: () => setStatusFilter('all')
      });
    }
    
    if (debtFilter !== 'all') {
      activeFilters.push({
        label: 'Deuda',
        value: debtFilter === 'with_debt' ? 'Con deuda' : 'Sin deuda',
        onRemove: () => setDebtFilter('all')
      });
    }
    
    if (searchTerm.trim()) {
      activeFilters.push({
        label: 'Búsqueda',
        value: `"${searchTerm}"`,
        onRemove: () => setSearchTerm('')
      });
    }
    
    if (activeFilters.length === 0) return null;
    
    return (
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm text-blue-700 font-medium">Filtros activos:</span>
          {activeFilters.map((filter, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              <span className="mr-1">{filter.label}: {filter.value}</span>
              <button
                onClick={filter.onRemove}
                className="text-blue-600 hover:text-blue-800 ml-1"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Limpiar todos
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Lista de Socios</h1>
        <button 
          onClick={onNewMember}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
        >
          <UserPlus className="mr-2" size={20} />
          Nuevo Socio
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Barra de búsqueda y filtros */}
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar socio por nombre, apellido, email o teléfono..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              {(searching || loading) && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
            
            <select 
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading || searching}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            
            <select 
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value)}
              disabled={loading || searching}
            >
              <option value="all">Estado de deuda</option>
              <option value="with_debt">Con deuda</option>
              <option value="no_debt">Sin deuda</option>
            </select>
            
            <button 
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-3 py-2 border rounded-md hover:bg-gray-50 focus:outline-none disabled:opacity-50"
              title="Actualizar lista"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin text-blue-500' : 'text-gray-500'} />
            </button>

            {(searchTerm || statusFilter !== 'all' || debtFilter !== 'all') && (
              <button 
                onClick={clearFilters}
                className="px-3 py-2 border border-red-300 rounded-md text-red-600 hover:bg-red-50 focus:outline-none"
                title="Limpiar filtros"
              >
                <Filter size={20} />
              </button>
            )}
          </div>

          {/* Información de resultados */}
          <div className="mt-3 text-sm text-gray-600">
            {searchTerm.trim() ? (
              <span>
                Mostrando {members.length} resultado(s) para "{searchTerm}"
              </span>
            ) : (
              <span>
                Mostrando {Math.min(displayedMembers.length, ITEMS_PER_PAGE)} de {totalMembers} socios
                {statusFilter !== 'all' || debtFilter !== 'all' ? ' (filtrados)' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Mostrar filtros activos */}
        <ActiveFilters />
        
        {/* Mensaje de error */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700">
            <div className="flex items-center">
              <AlertCircle size={20} className="mr-2" />
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Tabla de socios SIN paginación */}
        {loading && members.length === 0 ? (
          <LoadingMembers />
        ) : members.length === 0 && !loading ? (
          <div className="text-center py-12 bg-gray-50">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            {searchTerm.trim() ? (
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No se encontraron resultados</h3>
                <p className="text-gray-500 mb-4">
                  No hay socios que coincidan con "{searchTerm}"
                  {(statusFilter !== 'all' || debtFilter !== 'all') && ' con los filtros aplicados'}
                </p>
                <div className="flex justify-center space-x-3">
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Limpiar búsqueda
                  </button>
                  {(statusFilter !== 'all' || debtFilter !== 'all') && (
                    <button 
                      onClick={clearFilters}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Quitar filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No hay socios registrados</h3>
                <p className="text-gray-500 mb-4">
                  {(statusFilter !== 'all' || debtFilter !== 'all') 
                    ? 'No hay socios que coincidan con los filtros aplicados'
                    : 'Comienza agregando un nuevo socio a tu gimnasio'
                  }
                </p>
                <div className="flex justify-center space-x-3">
                  <button 
                    onClick={onNewMember}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Agregar Nuevo Socio
                  </button>
                  {(statusFilter !== 'all' || debtFilter !== 'all') && (
                    <button 
                      onClick={clearFilters}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Quitar filtros
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header de tabla con ordenamiento */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Foto
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('lastName')}
                  >
                    <div className="flex items-center">
                      Apellido
                      <span className="ml-1">
                        {sortField === 'lastName' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('firstName')}
                  >
                    <div className="flex items-center">
                      Nombre
                      <span className="ml-1">
                        {sortField === 'firstName' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Estado
                      <span className="ml-1">
                        {sortField === 'status' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('lastAttendance')}
                  >
                    <div className="flex items-center">
                      Última Asistencia
                      <span className="ml-1">
                        {sortField === 'lastAttendance' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('totalDebt')}
                  >
                    <div className="flex items-center">
                      Deuda Total
                      <span className="ml-1">
                        {sortField === 'totalDebt' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedMembers.map((member) => (
                  <MemberRow 
                    key={member.id}
                    member={member}
                    onView={onViewMember}
                    onEdit={onEditMember}
                    onDelete={confirmDelete}
                    onGenerateQr={onGenerateQr}
                    onRegisterPayment={onRegisterPayment}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Información simple sin paginación */}
        {members.length > 0 && (
          <div className="px-6 py-3 flex items-center justify-between border-t bg-gray-50">
            <div className="text-sm text-gray-700">
              <span>
                Mostrando {members.length} {members.length === 1 ? 'socio' : 'socios'}
                {(statusFilter !== 'all' || debtFilter !== 'all') && (
                  <span className="text-gray-500 ml-1">(filtrados)</span>
                )}
              </span>
            </div>
            
            {(statusFilter !== 'all' || debtFilter !== 'all' || searchTerm.trim()) && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
        </div>
    </div>
  );
};

// Componente MemberRow memoizado para mejor rendimiento
const MemberRow = React.memo<{
  member: Member;
  onView: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onGenerateQr: (member: Member) => void;
  onRegisterPayment: (member: Member) => void;
  formatDate: (date: any) => string;
}>(({ member, onView, onEdit, onDelete, onGenerateQr, onRegisterPayment, formatDate }) => {
  // Estado para manejar error de imagen
  const [imageError, setImageError] = useState(false);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-3 py-4 whitespace-nowrap">
        {member.photo && !imageError ? (
          <img 
            src={member.photo} 
            alt={`${member.firstName} ${member.lastName}`} 
            className="h-10 w-10 rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
          </div>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
        {member.lastName}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-gray-900">
        {member.firstName}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
        {member.phone || 'N/A'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
          member.status === 'active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(member.lastAttendance)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`font-medium transition-colors ${
          (member.totalDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'
        }`}>
          {formatCurrency(member.totalDebt || 0)}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <button 
            className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors" 
            title="Ver detalles"
            onClick={() => onView(member)}
          >
            <Eye size={18} />
          </button>
          <button 
            className="text-green-600 hover:text-green-800 p-1 rounded-md hover:bg-green-50 transition-colors" 
            title="Editar"
            onClick={() => onEdit(member)}
          >
            <Edit size={18} />
          </button>
          <button 
            className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-50 transition-colors" 
            title="Eliminar"
            onClick={() => onDelete(member)}
          >
            <Trash size={18} />
          </button>
          <button 
            className="text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50 transition-colors" 
            title="Generar QR"
            onClick={() => onGenerateQr(member)}
          >
            <CreditCard size={18} />
          </button>
          <button 
            className="text-yellow-600 hover:text-yellow-800 p-1 rounded-md hover:bg-yellow-50 transition-colors" 
            title="Registrar pago"
            onClick={() => onRegisterPayment(member)}
          >
            <BanknoteIcon size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
});

// Asignar displayName para mejor debugging
MemberRow.displayName = 'MemberRow';

export default MemberList;