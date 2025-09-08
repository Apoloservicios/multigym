// src/components/memberships/PaginatedMembershipControls.tsx
// 🚀 COMPONENTE MEJORADO: Controles con paginación y barra de progreso

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Users,
  Clock,
  AlertCircle,
  Download,
  Settings,
  Loader
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  where,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  totalDebt: number;
  memberships: MembershipStatus[];
}

interface MembershipStatus {
  id: string;
  activityName: string;
  cost: number;
  status: string;
  autoRenewal: boolean;
  startDate: string;
  endDate: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface LoadingProgress {
  isLoading: boolean;
  stage: 'members' | 'memberships' | 'complete';
  current: number;
  total: number;
  message: string;
}

const PaginatedMembershipControls: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estados principales
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  
  // Estados de carga y progreso
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    isLoading: false,
    stage: 'complete',
    current: 0,
    total: 0,
    message: ''
  });
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [autoRenewalFilter, setAutoRenewalFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Estados de paginación
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 25, // Tamaño de página optimizado
    hasNextPage: false,
    hasPrevPage: false
  });
  
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [allDocsLoaded, setAllDocsLoaded] = useState(false);

  // 🔄 Función principal para cargar datos con progreso
  const loadMembersWithProgress = useCallback(async (pageNumber: number = 1, reset: boolean = true) => {
    if (!gymData?.id) return;
    
    setLoadingProgress({
      isLoading: true,
      stage: 'members',
      current: 0,
      total: 100,
      message: 'Cargando lista de socios...'
    });
    
    try {
      // PASO 1: Cargar socios con paginación
      let membersQuery = query(
        collection(db, `gyms/${gymData.id}/members`),
        orderBy('firstName'),
        limit(pagination.itemsPerPage)
      );

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
        setFilteredMembers([]);
        setAllDocsLoaded(true);
        setLoadingProgress({ isLoading: false, stage: 'complete', current: 100, total: 100, message: 'Completado' });
        return;
      }

      setLoadingProgress({
        isLoading: true,
        stage: 'memberships',
        current: 0,
        total: membersSnap.docs.length,
        message: 'Cargando membresías...'
      });

      const newMembers: MemberWithMemberships[] = [];
      
      // PASO 2: Cargar membresías para cada socio con progreso
      for (let i = 0; i < membersSnap.docs.length; i++) {
        const memberDoc = membersSnap.docs[i];
        const memberData = memberDoc.data();
        
        // Actualizar progreso
        setLoadingProgress(prev => ({
          ...prev,
          current: i + 1,
          message: `Cargando membresías de ${memberData.firstName} ${memberData.lastName}...`
        }));
        
        // Cargar membresías del socio (limitadas para rendimiento)
        const membershipRef = query(
          collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`),
          orderBy('startDate', 'desc'),
          limit(10) // Máximo 10 membresías por socio para optimización
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
        
        // Pequeña pausa para no sobrecargar
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // PASO 3: Actualizar estados
      if (reset) {
        setMembers(newMembers);
      } else {
        setMembers(prev => [...prev, ...newMembers]);
      }
      
      // Actualizar último documento para paginación
      if (membersSnap.docs.length > 0) {
        setLastDoc(membersSnap.docs[membersSnap.docs.length - 1]);
      }
      
      // Verificar si hay más páginas
      const hasMore = membersSnap.docs.length === pagination.itemsPerPage;
      setAllDocsLoaded(!hasMore);
      
      // Actualizar paginación
      setPagination(prev => ({
        ...prev,
        currentPage: pageNumber,
        hasNextPage: hasMore,
        hasPrevPage: pageNumber > 1,
        totalItems: reset ? newMembers.length : prev.totalItems + newMembers.length
      }));
      
      console.log(`📋 Página ${pageNumber} cargada: ${newMembers.length} socios con sus membresías`);
      
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
    } finally {
      setLoadingProgress({
        isLoading: false,
        stage: 'complete',
        current: 100,
        total: 100,
        message: 'Completado'
      });
    }
  }, [gymData?.id, pagination.itemsPerPage, lastDoc]);

  // 🔍 Filtrar miembros localmente
  const applyFilters = useCallback(() => {
    let filtered = [...members];
    
    // Filtro por término de búsqueda
    if (searchTerm.trim()) {
      filtered = filtered.filter(member => 
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtro por estado de membresía
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => {
        const hasActiveMemberships = member.memberships.some(m => m.status === 'active');
        const hasExpiredMemberships = member.memberships.some(m => {
          const today = new Date();
          const endDate = new Date(m.endDate);
          return endDate < today;
        });
        
        if (statusFilter === 'active') return hasActiveMemberships;
        if (statusFilter === 'expired') return hasExpiredMemberships;
        return true;
      });
    }
    
    // Filtro por auto-renovación
    if (autoRenewalFilter !== 'all') {
      filtered = filtered.filter(member => {
        const hasAutoRenewal = member.memberships.some(m => m.autoRenewal);
        
        if (autoRenewalFilter === 'enabled') return hasAutoRenewal;
        if (autoRenewalFilter === 'disabled') return !hasAutoRenewal;
        return true;
      });
    }
    
    setFilteredMembers(filtered);
  }, [members, searchTerm, statusFilter, autoRenewalFilter]);

  // Aplicar filtros cuando cambien los datos o filtros
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Cargar datos iniciales
  useEffect(() => {
    loadMembersWithProgress(1, true);
  }, []);

  // 📄 Navegación de páginas
  const goToNextPage = () => {
    if (pagination.hasNextPage && !loadingProgress.isLoading) {
      loadMembersWithProgress(pagination.currentPage + 1, false);
    }
  };

  const goToPreviousPage = () => {
    if (pagination.hasPrevPage && !loadingProgress.isLoading) {
      // Para página anterior, necesitamos recargar desde el inicio
      loadMembersWithProgress(1, true);
    }
  };

  const refreshData = () => {
    if (!loadingProgress.isLoading) {
      setLastDoc(null);
      setAllDocsLoaded(false);
      loadMembersWithProgress(1, true);
    }
  };

  // 🎨 Componente de barra de progreso
  const ProgressBar = () => {
    if (!loadingProgress.isLoading) return null;
    
    const percentage = loadingProgress.total > 0 ? 
      Math.round((loadingProgress.current / loadingProgress.total) * 100) : 0;
    
    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Loader className="animate-spin mr-2 text-blue-600" size={16} />
            <span className="text-sm font-medium text-blue-800">
              {loadingProgress.message}
            </span>
          </div>
          <span className="text-sm font-bold text-blue-600">
            {percentage}%
          </span>
        </div>
        
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="mt-2 text-xs text-blue-600">
          {loadingProgress.stage === 'members' && 'Obteniendo lista de socios...'}
          {loadingProgress.stage === 'memberships' && `Procesando ${loadingProgress.current} de ${loadingProgress.total} socios`}
          {loadingProgress.stage === 'complete' && '✅ Carga completada'}
        </div>
      </div>
    );
  };

  // 🎨 Componente de filtros
  const FiltersSection = () => (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Filtro por estado */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Con membresías activas</option>
          <option value="expired">Con membresías vencidas</option>
        </select>
        
        {/* Filtro por auto-renovación */}
        <select
          value={autoRenewalFilter}
          onChange={(e) => setAutoRenewalFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Auto-renovación: Todas</option>
          <option value="enabled">Solo habilitadas</option>
          <option value="disabled">Solo deshabilitadas</option>
        </select>
        
        {/* Botón refrescar */}
        <button
          onClick={refreshData}
          disabled={loadingProgress.isLoading}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`mr-2 ${loadingProgress.isLoading ? 'animate-spin' : ''}`} size={16} />
          Refrescar
        </button>
      </div>
      
      {/* Resumen de filtros */}
      <div className="mt-3 text-sm text-gray-600">
        Mostrando {filteredMembers.length} de {members.length} socios
        {searchTerm && ` • Búsqueda: "${searchTerm}"`}
        {statusFilter !== 'all' && ` • Estado: ${statusFilter}`}
        {autoRenewalFilter !== 'all' && ` • Auto-renovación: ${autoRenewalFilter}`}
      </div>
    </div>
  );

  // 🎨 Componente de tabla con paginación
  const MembersTable = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Socio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Membresías
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auto-renovación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deuda
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {member.email}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    member.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {member.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {member.memberships.slice(0, 3).map((membership, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{membership.activityName}</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          membership.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {membership.status}
                        </span>
                      </div>
                    ))}
                    {member.memberships.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{member.memberships.length - 3} más
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.memberships.some(m => m.autoRenewal) ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      ✓ Habilitada
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      ✗ Deshabilitada
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {member.totalDebt > 0 ? (
                    <span className="text-red-600 font-medium">
                      ${member.totalDebt.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-green-600">
                      Sin deuda
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">
                    Ver detalles
                  </button>
                  <button className="text-green-600 hover:text-green-900">
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Controles de paginación */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={goToPreviousPage}
            disabled={!pagination.hasPrevPage || loadingProgress.isLoading}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={goToNextPage}
            disabled={!pagination.hasNextPage || loadingProgress.isLoading}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
        
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Página <span className="font-medium">{pagination.currentPage}</span>
              {pagination.hasNextPage && (
                <span> de muchas</span>
              )}
              {!pagination.hasNextPage && (
                <span> (última página)</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {members.length} socios cargados • {filteredMembers.length} mostrados
            </p>
          </div>
          
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={goToPreviousPage}
                disabled={!pagination.hasPrevPage || loadingProgress.isLoading}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                Página {pagination.currentPage}
              </span>
              
              <button
                onClick={goToNextPage}
                disabled={!pagination.hasNextPage || loadingProgress.isLoading}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Controles de Membresías
        </h1>
        <p className="text-gray-600">
          Gestiona y supervisa todas las membresías de tu gimnasio con paginación optimizada
        </p>
      </div>

      {/* Barra de progreso */}
      <ProgressBar />

      {/* Filtros */}
      <FiltersSection />

      {/* Estadísticas rápidas */}
      {!loadingProgress.isLoading && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <Users className="text-blue-600 mr-2" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Socios</p>
                <p className="text-lg font-semibold">{members.length}+</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <Filter className="text-green-600 mr-2" size={20} />
              <div>
                <p className="text-sm text-gray-600">Filtrados</p>
                <p className="text-lg font-semibold">{filteredMembers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <RefreshCw className="text-purple-600 mr-2" size={20} />
              <div>
                <p className="text-sm text-gray-600">Auto-renovación</p>
                <p className="text-lg font-semibold">
                  {members.filter(m => m.memberships.some(ms => ms.autoRenewal)).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 mr-2" size={20} />
              <div>
                <p className="text-sm text-gray-600">Con Deuda</p>
                <p className="text-lg font-semibold">
                  {members.filter(m => m.totalDebt > 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla principal */}
      {filteredMembers.length === 0 && !loadingProgress.isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron socios
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' || autoRenewalFilter !== 'all' 
              ? 'Intenta ajustar tus filtros de búsqueda'
              : 'No hay socios registrados en este gimnasio'
            }
          </p>
          {(searchTerm || statusFilter !== 'all' || autoRenewalFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAutoRenewalFilter('all');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <MembersTable />
      )}

      {/* Información adicional */}
      {!loadingProgress.isLoading && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">ℹ️ Información importante:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Se cargan máximo 25 socios por página para optimizar el rendimiento</li>
            <li>• Los filtros se aplican a los datos ya cargados en memoria</li>
            <li>• Se muestran máximo 10 membresías por socio en la vista de tabla</li>
            <li>• Usa "Refrescar" para obtener los datos más recientes</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PaginatedMembershipControls;