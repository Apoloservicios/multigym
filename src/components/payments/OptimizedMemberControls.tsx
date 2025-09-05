// src/components/payments/OptimizedMemberControls.tsx
// 🎯 CONTROLES OPTIMIZADOS PARA GRANDES VOLÚMENES DE SOCIOS

import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  Settings, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap
} from 'lucide-react';
import { collection, doc, getDocs, updateDoc, query, limit, startAfter, orderBy, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';

interface MembershipStatus {
  id: string;
  activityName: string;
  cost: number;
  status: 'active' | 'paused' | 'cancelled';
  autoRenewal: boolean;
  startDate: string;
  endDate: string;
}

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  totalDebt: number;
  memberships: MembershipStatus[];
  lastDoc?: any; // Para paginación de Firestore
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isLoading: boolean;
}

const OptimizedMemberControls: React.FC = () => {
  const { gymData } = useAuth();
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'with_active' | 'with_auto'>('all');
  
  // Paginación
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 25,
    hasNextPage: false,
    hasPrevPage: false,
    isLoading: false
  });

  // Estados para optimización
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [allDocsLoaded, setAllDocsLoaded] = useState(false);

  useEffect(() => {
    if (gymData?.id) {
      loadMembersOptimized();
    }
  }, [gymData?.id]);

  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter, membershipFilter]);

  /**
   * 📋 Cargar socios con paginación optimizada
   */
  const loadMembersOptimized = async (pageNumber: number = 1, reset: boolean = true) => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      let membersQuery = query(
        collection(db, `gyms/${gymData.id}/members`),
        orderBy('firstName'),
        limit(pagination.itemsPerPage)
      );

      // Para páginas siguientes, usar el último documento
      if (pageNumber > 1 && lastDoc) {
        membersQuery = query(
          collection(db, `gyms/${gymData.id}/members`),
          orderBy('firstName'),
          startAfter(lastDoc),
          limit(pagination.itemsPerPage)
        );
      }

      const membersSnap = await getDocs(membersQuery);
      
      if (membersSnap.empty && pageNumber === 1) {
        setMembers([]);
        setAllDocsLoaded(true);
        return;
      }

      const newMembers: MemberWithMemberships[] = [];
      
      // Procesar solo los miembros de esta página
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        
        // Cargar solo las primeras 10 membresías por socio para optimización
        const membershipRef = query(
          collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`),
          limit(10) // Límite para evitar sobrecarga
        );
        const membershipSnap = await getDocs(membershipRef);
        
        const memberships: MembershipStatus[] = membershipSnap.docs.map(membershipDoc => ({
          id: membershipDoc.id,
          activityName: membershipDoc.data().activityName || 'Sin nombre',
          cost: membershipDoc.data().cost || 0,
          status: membershipDoc.data().status || 'active',
          autoRenewal: membershipDoc.data().autoRenewal || false,
          startDate: membershipDoc.data().startDate || '',
          endDate: membershipDoc.data().endDate || ''
        }));
        
        newMembers.push({
          id: memberDoc.id,
          firstName: memberData.firstName || 'Sin nombre',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships
        });
      }
      
      // Actualizar estado
      if (reset) {
        setMembers(newMembers);
      } else {
        setMembers(prev => [...prev, ...newMembers]);
      }
      
      // Guardar último documento para paginación
      if (membersSnap.docs.length > 0) {
        setLastDoc(membersSnap.docs[membersSnap.docs.length - 1]);
      }
      
      // Verificar si hay más páginas
      const hasMore = membersSnap.docs.length === pagination.itemsPerPage;
      setAllDocsLoaded(!hasMore);
      
      // Actualizar info de paginación (estimada)
      setPagination(prev => ({
        ...prev,
        currentPage: pageNumber,
        hasNextPage: hasMore,
        hasPrevPage: pageNumber > 1,
        totalItems: prev.totalItems + newMembers.length // Aproximado
      }));
      
      console.log(`📋 Página ${pageNumber} cargada:`, newMembers.length, 'socios');
      
    } catch (err: any) {
      console.error('❌ Error cargando socios:', err);
      setError('Error al cargar los datos de socios');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Filtrar miembros localmente
   */
  const filterMembers = useCallback(() => {
    let filtered = [...members];

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.firstName.toLowerCase().includes(searchLower) ||
        member.lastName.toLowerCase().includes(searchLower) ||
        member.email.toLowerCase().includes(searchLower) ||
        member.memberships.some(m => m.activityName.toLowerCase().includes(searchLower))
      );
    }

    // Filtro por estado del socio
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }

    // Filtro por tipo de membresía
    if (membershipFilter === 'with_active') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.status === 'active')
      );
    } else if (membershipFilter === 'with_auto') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.autoRenewal && m.status === 'active')
      );
    }

    setFilteredMembers(filtered);
  }, [members, searchTerm, statusFilter, membershipFilter]);

  /**
   * 👤 Cambiar estado general del socio
   */
  const updateMemberStatus = async (
    memberId: string, 
    newStatus: 'active' | 'inactive' | 'suspended'
  ) => {
    if (!gymData?.id) return;

    try {
      setUpdating(memberId);
      
      const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
      await updateDoc(memberRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar localmente
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, status: newStatus }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      setSuccess(`Estado de ${member?.firstName} ${member?.lastName} actualizado a: ${newStatus}`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('❌ Error actualizando estado del socio:', err);
      setError('Error al actualizar el estado del socio');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🎫 Cambiar estado de membresía específica
   */
  const updateMembershipStatus = async (
    memberId: string, 
    membershipId: string,
    newStatus: 'active' | 'paused' | 'cancelled'
  ) => {
    if (!gymData?.id) return;

    try {
      setUpdating(`${memberId}-${membershipId}`);
      
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships`, membershipId);
      await updateDoc(membershipRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar localmente
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? {
                ...member,
                memberships: member.memberships.map(membership =>
                  membership.id === membershipId
                    ? { ...membership, status: newStatus }
                    : membership
                )
              }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      setSuccess(`Membresía ${membership?.activityName} actualizada a: ${newStatus}`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('❌ Error actualizando membresía:', err);
      setError('Error al actualizar la membresía');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Cambiar auto-renovación de membresía
   */
  const toggleAutoRenewal = async (
    memberId: string, 
    membershipId: string,
    currentAutoRenewal: boolean
  ) => {
    if (!gymData?.id) return;

    try {
      setUpdating(`${memberId}-${membershipId}-auto`);
      
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships`, membershipId);
      await updateDoc(membershipRef, {
        autoRenewal: !currentAutoRenewal,
        updatedAt: new Date()
      });
      
      // Actualizar localmente
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? {
                ...member,
                memberships: member.memberships.map(membership =>
                  membership.id === membershipId
                    ? { ...membership, autoRenewal: !currentAutoRenewal }
                    : membership
                )
              }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      setSuccess(`Auto-renovación de ${membership?.activityName} ${!currentAutoRenewal ? 'activada' : 'desactivada'}`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('❌ Error cambiando auto-renovación:', err);
      setError('Error al cambiar la auto-renovación');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 📄 Cargar más socios (paginación)
   */
  const loadMoreMembers = async () => {
    if (!allDocsLoaded && !loading) {
      await loadMembersOptimized(pagination.currentPage + 1, false);
    }
  };

  /**
   * 🔍 Limpiar filtros
   */
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMembershipFilter('all');
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
   * 🎨 Obtener estilo para estado de membresía
   */
  const getMembershipStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  return (
    <div className="space-y-6">
      {/* Header con búsqueda y filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Control de Estados - Optimizado
            </h2>
            <p className="text-gray-600">
              {filteredMembers.length} socios mostrados de {members.length} cargados
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar socio o actividad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Filtros */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo activos</option>
              <option value="inactive">Solo inactivos</option>
              <option value="suspended">Solo suspendidos</option>
            </select>

            <select
              value={membershipFilter}
              onChange={(e) => setMembershipFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las membresías</option>
              <option value="with_active">Con membresías activas</option>
              <option value="with_auto">Con auto-renovación</option>
            </select>

            {/* Limpiar filtros */}
            {(searchTerm || statusFilter !== 'all' || membershipFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
              >
                <Filter size={16} className="mr-2" />
                Limpiar
              </button>
            )}

            {/* Actualizar */}
            <button
              onClick={() => {
                setMembers([]);
                setLastDoc(null);
                setAllDocsLoaded(false);
                loadMembersOptimized(1, true);
              }}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-600 mr-2" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-2" size={20} />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertCircle className="text-blue-600 mt-1" size={16} />
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-900">
              Lógica de Automatización
            </h4>
            <div className="text-sm text-blue-800 mt-1 space-y-1">
              <p>• <strong>Socio Inactivo:</strong> NO genera ninguna cuota automática</p>
              <p>• <strong>Membresía Pausada/Cancelada:</strong> NO genera cuota para esa actividad</p>
              <p>• <strong>Auto-renovación OFF:</strong> NO genera cuota aunque esté activa</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de socios */}
      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin mr-2" size={20} />
          <span className="text-gray-600">Cargando socios...</span>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto mb-4 text-gray-400" size={64} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron socios
          </h3>
          <p className="text-gray-600">
            Intenta con otros términos de búsqueda o filtros
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-lg shadow border">
              {/* Header del socio */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={24} className="text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{member.email}</p>
                      {member.totalDebt > 0 && (
                        <p className="text-sm text-red-600">
                          Deuda: {formatCurrency(member.totalDebt)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Control de estado del socio */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">Estado:</span>
                    <select
                      value={member.status}
                      onChange={(e) => updateMemberStatus(member.id, e.target.value as any)}
                      disabled={updating === member.id}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                      <option value="suspended">Suspendido</option>
                    </select>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMemberStatusStyle(member.status)}`}>
                      {member.status === 'active' ? 'Activo' : 
                       member.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Membresías del socio */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Membresías ({member.memberships.length})
                </h4>
                
                {member.memberships.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Sin membresías activas</p>
                ) : (
                  <div className="space-y-2">
                    {member.memberships.map((membership) => (
                      <div key={membership.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        {/* Info de la membresía */}
                        <div className="flex items-center space-x-4">
                          <Activity size={16} className="text-gray-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {membership.activityName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(membership.cost)} • {membership.startDate} a {membership.endDate}
                            </p>
                          </div>
                        </div>

                        {/* Controles de la membresía */}
                        <div className="flex items-center space-x-4">
                          {/* Estado */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Estado:</span>
                            <select
                              value={membership.status}
                              onChange={(e) => updateMembershipStatus(member.id, membership.id, e.target.value as any)}
                              disabled={updating === `${member.id}-${membership.id}`}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="active">Activa</option>
                              <option value="paused">Pausada</option>
                              <option value="cancelled">Cancelada</option>
                            </select>
                          </div>

                          {/* Auto-renovación */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Auto-reno:</span>
                            <button
                              onClick={() => toggleAutoRenewal(member.id, membership.id, membership.autoRenewal)}
                              disabled={updating === `${member.id}-${membership.id}-auto`}
                              className={`p-1 rounded ${membership.autoRenewal ? 'text-green-600' : 'text-gray-400'}`}
                              title={`Auto-renovación: ${membership.autoRenewal ? 'Activada' : 'Desactivada'}`}
                            >
                              {membership.autoRenewal ? (
                                <ToggleRight size={20} />
                              ) : (
                                <ToggleLeft size={20} />
                              )}
                            </button>
                          </div>

                          {/* Badge de estado */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMembershipStatusStyle(membership.status)}`}>
                            {membership.status === 'active' ? 'Activa' : 
                             membership.status === 'paused' ? 'Pausada' : 'Cancelada'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cargar más socios */}
      {!allDocsLoaded && members.length > 0 && (
        <div className="text-center">
          <button
            onClick={loadMoreMembers}
            disabled={loading}
            className="flex items-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="animate-spin mr-2" size={16} />
            ) : (
              <ChevronRight className="mr-2" size={16} />
            )}
            {loading ? 'Cargando...' : 'Cargar más socios'}
          </button>
        </div>
      )}

      {/* Resumen optimizado */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen (Socios Cargados)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Socios Activos:</p>
            <p className="font-semibold">{filteredMembers.filter(m => m.status === 'active').length}</p>
          </div>
          <div>
            <p className="text-gray-600">Socios Inactivos:</p>
            <p className="font-semibold">{filteredMembers.filter(m => m.status === 'inactive').length}</p>
          </div>
          <div>
            <p className="text-gray-600">Membresías Activas:</p>
            <p className="font-semibold">
              {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.status === 'active').length, 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Con Auto-renovación:</p>
            <p className="font-semibold">
              {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.autoRenewal && mb.status === 'active').length, 0)}
            </p>
          </div>
        </div>
        
        {!allDocsLoaded && (
          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
            Hay más socios sin cargar. Usa "Cargar más socios" o la búsqueda para encontrar socios específicos.
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedMemberControls;