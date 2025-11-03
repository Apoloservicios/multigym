// src/components/members/MemberList.tsx - VERSIÓN CORREGIDA CON HUELLAS DIGITALES
// ✅ Agrega indicador visual de huella registrada

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, User, Edit, Trash, Eye, CreditCard, BanknoteIcon, RefreshCw, Filter, UserPlus, AlertCircle, ChevronLeft, ChevronRight, Fingerprint } from 'lucide-react';
import { Member } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';
import useFirestore from '../../hooks/useFirestore';
import { debounce, isNumber } from 'lodash';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [displayedMembers, setDisplayedMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  
  // Estados de ordenamiento
  const [sortField, setSortField] = useState<'firstName' | 'lastName' | 'dni' | 'memberNumber' | 'createdAt'>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  
  // Cargar miembros inicialmente
  useEffect(() => {
    if (gymData?.id) {
      loadMembers();
    }
  }, [gymData]);

  // Cargar miembros desde Firebase
  const loadMembers = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      setError('');
      
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const snapshot = await getDocs(membersRef);
      
      const loadedMembers: Member[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Member));
      
      setAllMembers(loadedMembers);
      
    } catch (error: any) {
      console.error('Error loading members:', error);
      setError('Error al cargar los socios. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...allMembers];
    
    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        const dni = (member.dni || '').toString().toLowerCase();
        const memberNumber = (member.memberNumber || '').toString();
        const email = (member.email || '').toLowerCase();
        
        return fullName.includes(searchLower) || 
               dni.includes(searchLower) ||
               memberNumber.includes(searchLower) ||
               email.includes(searchLower);
      });
    }
    
    // Filtro de estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }
    
    // Filtro de deuda
    if (debtFilter !== 'all') {
      filtered = filtered.filter(member => {
        const hasDebt = (member.totalDebt || 0) > 0;
        return debtFilter === 'with_debt' ? hasDebt : !hasDebt;
      });
    }
    
    setFilteredMembers(filtered);
    setCurrentPage(1);
  }, [allMembers, searchTerm, statusFilter, debtFilter]);

  // Aplicar ordenamiento
  const sortedMembers = useMemo(() => {
    const sorted = [...filteredMembers];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'firstName':
          aValue = a.firstName?.toLowerCase() || '';
          bValue = b.firstName?.toLowerCase() || '';
          break;
        case 'lastName':
          aValue = a.lastName?.toLowerCase() || '';
          bValue = b.lastName?.toLowerCase() || '';
          break;
        case 'dni':
          aValue = a.dni || 0;
          bValue = b.dni || 0;
          break;
        case 'memberNumber':
          aValue = a.memberNumber || 0;
          bValue = b.memberNumber || 0;
          break;
        case 'createdAt':
          aValue = (a.createdAt as any)?.toDate?.() || new Date((a.createdAt as any) || 0);
          bValue = (b.createdAt as any)?.toDate?.() || new Date((b.createdAt as any) || 0);
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

  // Aplicar paginación
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedMembers(sortedMembers.slice(startIndex, endIndex));
  }, [sortedMembers, currentPage, itemsPerPage]);

  // Cálculos de paginación
  const totalItems = filteredMembers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Búsqueda con debounce
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
      setSearching(false);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearching(true);
    debouncedSearch(value);
  };

  // Manejo de ordenamiento
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    
    try {
      await loadMembers();
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
      if (typeof dateString.getMonth === 'function') {
        return dateString.toLocaleDateString('es-AR');
      }
      
      if (dateString.toDate && typeof dateString.toDate === 'function') {
        return dateString.toDate().toLocaleDateString('es-AR');
      }
      
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-AR');
      }
      
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
    setSearchTerm('');
    setStatusFilter('all');
    setDebtFilter('all');
    setCurrentPage(1);
  };

  // Componente para estados de carga
  const LoadingMembers = () => (
    <div className="flex justify-center items-center py-12">
      <div className="text-center">
        <div className="inline-flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <div>
            <p className="text-gray-600 font-medium">Cargando socios...</p>
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
    
    if (activeFilters.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-sm text-gray-600">Filtros activos:</span>
        {activeFilters.map((filter, index) => (
          <span
            key={index}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
          >
            {filter.label}: {filter.value}
            <button
              onClick={filter.onRemove}
              className="ml-2 text-blue-700 hover:text-blue-900"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    );
  };

  // Componente optimizado para filas de miembros
  const MemberRow = React.memo(({ 
    member, 
    onView, 
    onEdit, 
    onDelete, 
    onGenerateQr, 
    onRegisterPayment 
  }: {
    member: Member;
    onView: (m: Member) => void;
    onEdit: (m: Member) => void;
    onDelete: (m: Member) => void;
    onGenerateQr: (m: Member) => void;
    onRegisterPayment: (m: Member) => void;
  }) => {
    // ✅ NUEVO: Verificar si tiene huella registrada
    const hasFingerprint = Boolean(member.fingerprint && member.fingerprint.template);
    
    return (
      <tr 
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onView(member)}
      >
        {/* Número de Socio */}
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          #{member.memberNumber || '---'}
        </td>
        
        {/* DNI */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {member.dni || 'Sin DNI'}
        </td>
        
        {/* Foto */}
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="flex-shrink-0 h-10 w-10">
            {member.photo ? (
              <img
                className="h-10 w-10 rounded-full object-cover"
                src={member.photo}
                alt={`${member.firstName} ${member.lastName}`}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User size={20} className="text-gray-500" />
              </div>
            )}
          </div>
        </td>
        
        {/* Apellido */}
        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {member.lastName}
        </td>
        
        {/* Nombre */}
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {member.firstName}
        </td>
        
        {/* Email */}
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {member.email || 'Sin email'}
        </td>
        
        {/* Teléfono */}
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {member.phone || 'Sin teléfono'}
        </td>
        
        {/* Estado */}
        <td className="px-4 py-4 whitespace-nowrap">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            member.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {member.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        
        {/* ✅ NUEVO: Indicador de Huella Digital */}
        <td className="px-4 py-4 whitespace-nowrap">
          {hasFingerprint ? (
            <div className="flex items-center text-green-600" title="Huella registrada">
              <Fingerprint size={18} className="mr-1" />
              <span className="text-xs font-medium">Registrada</span>
            </div>
          ) : (
            <div className="flex items-center text-gray-400" title="Sin huella">
              <Fingerprint size={18} className="mr-1" />
              <span className="text-xs">No registrada</span>
            </div>
          )}
        </td>
        
        {/* Última Asistencia */}
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatDate(member.lastAttendance)}
        </td>
        
        {/* Deuda Total */}
        <td className="px-4 py-4 whitespace-nowrap">
          <span className={`font-medium transition-colors ${
            (member.totalDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(member.totalDebt || 0)}
          </span>
        </td>
        
        {/* Acciones */}
        <td className="px-4 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <button 
              className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors" 
              title="Ver detalles"
              onClick={(e) => {
                e.stopPropagation();
                onView(member);
              }}
            >
              <Eye size={18} />
            </button>
            <button 
              className="text-green-600 hover:text-green-800 p-1 rounded-md hover:bg-green-50 transition-colors" 
              title="Editar"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(member);
              }}
            >
              <Edit size={18} />
            </button>
            <button 
              className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-50 transition-colors" 
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(member);
              }}
            >
              <Trash size={18} />
            </button>
            <button 
              className="text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50 transition-colors" 
              title="Generar QR"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateQr(member);
              }}
            >
              <CreditCard size={18} />
            </button>
            <button 
              className="text-yellow-600 hover:text-yellow-800 p-1 rounded-md hover:bg-yellow-50 transition-colors" 
              title="Registrar pago"
              onClick={(e) => {
                e.stopPropagation();
                onRegisterPayment(member);
              }}
            >
              <BanknoteIcon size={18} />
            </button>
          </div>
        </td>
      </tr>
    );
  });

  MemberRow.displayName = 'MemberRow';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Socios</h2>
        <button
          onClick={onNewMember}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={20} className="mr-2" />
          Nuevo Socio
        </button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search 
                size={20} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                placeholder="Buscar por nombre, DNI, N° socio o email..."
                defaultValue={searchTerm}
                onChange={handleSearchChange}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select 
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            disabled={loading || searching}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          
          <select 
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={debtFilter}
            onChange={(e: any) => setDebtFilter(e.target.value)}
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
              Mostrando {filteredMembers.length} resultado(s) para "{searchTerm}"
            </span>
          ) : (
            <span>
              Mostrando página {currentPage} de {totalPages} ({totalItems} socios en total
              {statusFilter !== 'all' || debtFilter !== 'all' ? ' filtrados' : ''})
            </span>
          )}
        </div>

        {/* Mostrar filtros activos */}
        <ActiveFilters />
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 mb-4">
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

      {/* Contenido principal */}
      <div className="border rounded-lg">
        {loading && allMembers.length === 0 ? (
          <LoadingMembers />
        ) : displayedMembers.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No se encontraron socios</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || debtFilter !== 'all'
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
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Número */}
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('memberNumber')}
                  >
                    <div className="flex items-center">
                      #
                      <span className="ml-1">
                        {sortField === 'memberNumber' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  
                  {/* DNI */}
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('dni')}
                  >
                    <div className="flex items-center">
                      DNI
                      <span className="ml-1">
                        {sortField === 'dni' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="opacity-50">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                  
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Foto
                  </th>
                  
                  {/* Apellido */}
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
                  
                  {/* Nombre */}
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
                    Email
                  </th>
                  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teléfono
                  </th>
                  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  
                  {/* ✅ NUEVA COLUMNA: Huella Digital */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <Fingerprint size={14} className="mr-1" />
                      Huella
                    </div>
                  </th>
                  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Asist.
                  </th>
                  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deuda
                  </th>
                  
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedMembers.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onView={onViewMember}
                    onEdit={onEditMember}
                    onDelete={confirmDelete}
                    onGenerateQr={onGenerateQr}
                    onRegisterPayment={onRegisterPayment}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando{' '}
                  <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalItems)}
                  </span>
                  {' '}de{' '}
                  <span className="font-medium">{totalItems}</span>
                  {' '}resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  
                  {/* Números de página */}
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
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;