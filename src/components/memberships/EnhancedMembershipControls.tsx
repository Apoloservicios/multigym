// src/components/memberships/EnhancedMembershipControls.tsx
// 🆕 COMPONENTE FINAL CORREGIDO: Compatible con tipos existentes

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  User,
  AlertCircle,
  CheckCircle,
  Settings,
  DollarSign,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { usePaginatedMembers } from '../../hooks/usePaginatedMembers';

// ==================== INTERFACES ====================

interface EnhancedMembershipControlsProps {
  onMembershipUpdate?: () => void;
}

// ==================== COMPONENTE PRINCIPAL ====================

const EnhancedMembershipControls: React.FC<EnhancedMembershipControlsProps> = ({ 
  onMembershipUpdate 
}) => {
  const { gymData } = useAuth();
  
  // Estados locales
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMembershipDetails, setShowMembershipDetails] = useState<Record<string, boolean>>({});

  // Hook de paginación
  const {
    members,
    filteredMembers,
    pagination,
    filters,
    error: paginationError,
    loadNextPage,
    loadPreviousPage,
    refreshData,
    setSearchTerm,
    setStatusFilter,
    setMembershipFilter,
    clearFilters,
    getTotalMembershipsCount,
    getAutoRenewalCount
  } = usePaginatedMembers({ 
    gymId: gymData?.id,
    itemsPerPage: 15
  });

  // ==================== FUNCIONES ====================

  /**
   * 🔄 Alternar auto-renovación de una membresía
   */
  const toggleAutoRenewal = async (memberId: string, membershipId: string, currentAutoRenewal: boolean) => {
    if (!gymData?.id) return;
    
    setUpdating(`${memberId}-${membershipId}`);
    setError(null);
    
    try {
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships`, membershipId);
      
      await updateDoc(membershipRef, {
        autoRenewal: !currentAutoRenewal,
        updatedAt: Timestamp.now()
      });
      
      setSuccess(`Auto-renovación ${!currentAutoRenewal ? 'activada' : 'desactivada'} exitosamente`);
      
      // Refrescar datos
      await refreshData();
      onMembershipUpdate?.();
      
    } catch (err: any) {
      console.error('❌ Error cambiando auto-renovación:', err);
      setError('Error al cambiar la auto-renovación');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 📊 Alternar detalles de membresías de un socio
   */
  const toggleMembershipDetails = (memberId: string) => {
    setShowMembershipDetails(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  /**
   * 🎨 Obtener estilo para estado del socio
   */
  const getMemberStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 🎨 Obtener estilo para estado de membresía - CORREGIDO
   */
  const getMembershipStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 📅 Verificar si una membresía está vencida
   */
  const isMembershipExpired = (endDate: string): boolean => {
    return new Date(endDate) < new Date();
  };

  /**
   * 📅 Formatear fecha
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  /**
   * 💰 Formatear moneda
   */
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  // ==================== EFECTOS ====================

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header con información */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Settings className="text-blue-600 mt-1 mr-3" size={20} />
          <div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Control de Membresías y Auto-renovaciones
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Socio Inactivo:</strong> NO genera ninguna cuota automática</p>
              <p>• <strong>Membresía Cancelada:</strong> NO genera cuota nunca más</p>
              <p>• <strong>Auto-renovación OFF:</strong> NO genera cuota aunque esté activa</p>
              <p>• <strong>Precio actualizado:</strong> Siempre usa el precio actual de la actividad</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {(error || paginationError) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="text-red-400 mr-3 mt-0.5" size={16} />
            <div className="text-sm text-red-700">{error || paginationError}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="text-green-400 mr-3 mt-0.5" size={16} />
            <div className="text-sm text-green-700">{success}</div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filtros de Búsqueda</h3>
          <button
            onClick={refreshData}
            disabled={pagination.isLoading}
            className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${pagination.isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda por texto */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar socio, email o actividad..."
              value={filters.searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro por estado del socio */}
          <select
            value={filters.statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Socios activos</option>
            <option value="inactive">Socios inactivos</option>
            <option value="suspended">Socios suspendidos</option>
          </select>

          {/* Filtro por tipo de membresía */}
          <select
            value={filters.membershipFilter}
            onChange={(e) => setMembershipFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todas las membresías</option>
            <option value="with_active">Con membresías activas</option>
            <option value="with_auto">Con auto-renovación</option>
            <option value="expired">Con membresías vencidas</option>
          </select>

          {/* Botón limpiar filtros */}
          <button
            onClick={clearFilters}
            className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Filter size={16} className="mr-2" />
            Limpiar
          </button>
        </div>

        {/* Filtros activos */}
        {(filters.searchTerm || filters.statusFilter !== 'all' || filters.membershipFilter !== 'all') && (
          <div className="mt-4 flex items-center flex-wrap gap-2">
            <span className="text-sm text-gray-600 font-medium">Filtros activos:</span>
            
            {filters.searchTerm && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Búsqueda: "{filters.searchTerm}"
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            
            {filters.statusFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Estado: {filters.statusFilter === 'active' ? 'Activos' : filters.statusFilter === 'inactive' ? 'Inactivos' : 'Suspendidos'}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-1 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            )}
            
            {filters.membershipFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Membresía: {
                  filters.membershipFilter === 'with_active' ? 'Con activas' :
                  filters.membershipFilter === 'with_auto' ? 'Con auto-renovación' : 'Vencidas'
                }
                <button
                  onClick={() => setMembershipFilter('all')}
                  className="ml-1 text-purple-600 hover:text-purple-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <Users className="text-blue-600 mr-3" size={20} />
            <div>
              <p className="text-sm text-gray-600">Socios mostrados</p>
              <p className="text-2xl font-bold text-gray-900">{filteredMembers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <Calendar className="text-green-600 mr-3" size={20} />
            <div>
              <p className="text-sm text-gray-600">Membresías activas</p>
              <p className="text-2xl font-bold text-gray-900">{getTotalMembershipsCount()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <RefreshCw className="text-purple-600 mr-3" size={20} />
            <div>
              <p className="text-sm text-gray-600">Auto-renovaciones</p>
              <p className="text-2xl font-bold text-gray-900">{getAutoRenewalCount()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <DollarSign className="text-orange-600 mr-3" size={20} />
            <div>
              <p className="text-sm text-gray-600">Con deudas</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredMembers.filter(m => m.totalDebt > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de miembros */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Socios y Membresías
            </h3>
            <div className="text-sm text-gray-500">
              {pagination.isLoading ? 'Cargando...' : `${filteredMembers.length} resultados`}
            </div>
          </div>
        </div>

        {/* Estado de carga */}
        {pagination.isLoading && filteredMembers.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <RefreshCw className="animate-spin mx-auto mb-4 text-gray-400" size={32} />
              <p className="text-gray-600">Cargando socios...</p>
            </div>
          </div>
        )}

        {/* Sin resultados */}
        {!pagination.isLoading && filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron socios</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.searchTerm || filters.statusFilter !== 'all' || filters.membershipFilter !== 'all'
                ? 'Prueba ajustando los filtros de búsqueda.'
                : 'No hay socios registrados en el sistema.'
              }
            </p>
            {(filters.searchTerm || filters.statusFilter !== 'all' || filters.membershipFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Lista de socios */}
        {filteredMembers.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <li key={member.id} className="hover:bg-gray-50">
                <div className="px-6 py-4">
                  {/* Información principal del socio */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="text-gray-400 mr-3" size={24} />
                      <div>
                        <div className="flex items-center">
                          <p className="text-lg font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <span className={`ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMemberStatusStyle(member.status)}`}>
                            {member.status === 'active' ? 'Activo' :
                             member.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        <div className="flex items-center mt-1 space-x-3">
                          <span className="text-sm text-gray-600">
                            {member.memberships.length} membresía{member.memberships.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-sm text-blue-600">
                            {member.memberships.filter(m => m.autoRenewal && m.status === 'active').length} con auto-renovación
                          </span>
                          {member.totalDebt > 0 && (
                            <span className="text-sm text-red-600 font-medium">
                              Deuda: {formatCurrency(member.totalDebt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleMembershipDetails(member.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Detalles de membresías (expandible) */}
                  {showMembershipDetails[member.id] && member.memberships.length > 0 && (
                    <div className="mt-4 ml-12">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Membresías ({member.memberships.length})
                        </h4>
                        <div className="space-y-3">
                          {member.memberships.map((membership) => {
                            const isExpired = isMembershipExpired(membership.endDate);
                            const isUpdating = updating === `${member.id}-${membership.id}`;
                            
                            return (
                              <div 
                                key={membership.id} 
                                className="flex items-center justify-between p-3 bg-white rounded border"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <p className="text-sm font-medium text-gray-900">
                                      {membership.activityName}
                                    </p>
                                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMembershipStatusStyle(membership.status)}`}>
                                      {membership.status === 'active' ? 'Activa' :
                                       membership.status === 'expired' ? 'Expirada' : 
                                       membership.status === 'cancelled' ? 'Cancelada' : 'Inactiva'}
                                    </span>
                                    {isExpired && membership.status === 'active' && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                        Vencida
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 space-y-1">
                                    <p>Vence: {formatDate(membership.endDate)}</p>
                                    <p>Costo: {formatCurrency(membership.cost || 0)}</p>
                                    <p>Estado de pago: {
                                      membership.paymentStatus === 'paid' ? 'Pagado' :
                                      membership.paymentStatus === 'partial' ? 'Parcial' : 'Pendiente'
                                    }</p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                  {/* Toggle auto-renovación */}
                                  {membership.status === 'active' && (
                                    <div className="flex items-center">
                                      <label className="text-xs text-gray-600 mr-2">
                                        Auto-renovación:
                                      </label>
                                      <button
                                        onClick={() => toggleAutoRenewal(member.id, membership.id!, membership.autoRenewal || false)}
                                        disabled={isUpdating}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                          membership.autoRenewal ? 'bg-blue-600' : 'bg-gray-200'
                                        } ${isUpdating ? 'opacity-50' : ''}`}
                                      >
                                        <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            membership.autoRenewal ? 'translate-x-6' : 'translate-x-1'
                                          }`}
                                        />
                                      </button>
                                      {isUpdating && (
                                        <RefreshCw className="ml-2 animate-spin text-blue-600" size={16} />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Controles de paginación */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={loadPreviousPage}
              disabled={!pagination.hasPrevPage || pagination.isLoading}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={loadNextPage}
              disabled={!pagination.hasNextPage || pagination.isLoading}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
          
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Página <span className="font-medium">{pagination.currentPage}</span>
                {pagination.totalItems > 0 && (
                  <span> • {filteredMembers.length} socios mostrados</span>
                )}
                {pagination.isLoadingMore && (
                  <span className="ml-2 text-blue-600">Cargando más...</span>
                )}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={loadPreviousPage}
                  disabled={!pagination.hasPrevPage || pagination.isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  {pagination.currentPage}
                </span>
                <button
                  onClick={loadNextPage}
                  disabled={!pagination.hasNextPage || pagination.isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMembershipControls;