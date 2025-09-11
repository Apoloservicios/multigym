// src/hooks/usePaginatedMembers.ts
// 🆕 HOOK OPTIMIZADO: Paginación real para miembros sin cargar todo en memoria

import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where,
  startAfter,
  DocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipAssignment } from '../types/member.types';

// ==================== INTERFACES ====================

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  totalDebt: number;
  memberships: MembershipAssignment[];
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
}

interface FilterState {
  searchTerm: string;
  statusFilter: 'all' | 'active' | 'inactive' | 'suspended';
  membershipFilter: 'all' | 'with_active' | 'with_auto' | 'expired';
}

interface UsePaginatedMembersProps {
  gymId: string | undefined;
  itemsPerPage?: number;
}

interface UsePaginatedMembersReturn {
  // Datos
  members: MemberWithMemberships[];
  filteredMembers: MemberWithMemberships[];
  
  // Estados
  pagination: PaginationState;
  filters: FilterState;
  error: string | null;
  
  // Funciones
  loadPage: (page: number) => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadPreviousPage: () => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Filtros
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: FilterState['statusFilter']) => void;
  setMembershipFilter: (filter: FilterState['membershipFilter']) => void;
  clearFilters: () => void;
  
  // Utilidades
  getTotalMembershipsCount: () => number;
  getAutoRenewalCount: () => number;
}

// ==================== HOOK PRINCIPAL ====================

export const usePaginatedMembers = ({ 
  gymId, 
  itemsPerPage = 20 
}: UsePaginatedMembersProps): UsePaginatedMembersReturn => {
  
  // Estados principales
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de paginación
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage,
    hasNextPage: false,
    hasPrevPage: false,
    isLoading: false,
    isLoadingMore: false
  });
  
  // Estados de filtros
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    statusFilter: 'all',
    membershipFilter: 'all'
  });
  
  // Cache de documentos para navegación eficiente
  const [documentCache, setDocumentCache] = useState<Map<number, DocumentSnapshot[]>>(new Map());
  const [lastDocumentPerPage, setLastDocumentPerPage] = useState<Map<number, DocumentSnapshot>>(new Map());

  // ==================== FUNCIONES DE CARGA ====================

  /**
   * 👥 Cargar página específica de miembros
   */
  const loadPage = useCallback(async (pageNumber: number) => {
    if (!gymId) return;
    
    try {
      setPagination(prev => ({ ...prev, isLoading: true }));
      setError(null);
      
      console.log(`👥 Cargando página ${pageNumber}...`);
      
      // Construir query base
      const constraints: QueryConstraint[] = [
        orderBy('firstName'),
        limit(itemsPerPage)
      ];
      
      // Aplicar filtro de estado si no es "all"
      if (filters.statusFilter !== 'all') {
        constraints.unshift(where('status', '==', filters.statusFilter));
      }
      
      // Si no es la primera página, usar startAfter
      if (pageNumber > 1) {
        const lastDoc = lastDocumentPerPage.get(pageNumber - 1);
        if (lastDoc) {
          constraints.push(startAfter(lastDoc));
        }
      }
      
      const membersQuery = query(collection(db, `gyms/${gymId}/members`), ...constraints);
      const membersSnapshot = await getDocs(membersQuery);
      
      // Procesar miembros y cargar sus membresías
      const pageMembers: MemberWithMemberships[] = [];
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        // Cargar membresías del miembro
        const membershipsRef = collection(db, `gyms/${gymId}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const memberships: MembershipAssignment[] = membershipsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MembershipAssignment));
        
        pageMembers.push({
          id: memberDoc.id,
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships
        });
      }
      
      // Actualizar cache de documentos
      setDocumentCache(prev => {
        const newCache = new Map(prev);
        newCache.set(pageNumber, membersSnapshot.docs);
        return newCache;
      });
      
      // Guardar último documento de la página
      if (membersSnapshot.docs.length > 0) {
        setLastDocumentPerPage(prev => {
          const newMap = new Map(prev);
          newMap.set(pageNumber, membersSnapshot.docs[membersSnapshot.docs.length - 1]);
          return newMap;
        });
      }
      
      // Actualizar miembros
      if (pageNumber === 1) {
        setMembers(pageMembers);
      } else {
        setMembers(prev => [...prev, ...pageMembers]);
      }
      
      // Actualizar paginación
      const hasNextPage = membersSnapshot.docs.length === itemsPerPage;
      setPagination(prev => ({
        ...prev,
        currentPage: pageNumber,
        hasNextPage,
        hasPrevPage: pageNumber > 1,
        totalItems: prev.totalItems + (pageNumber === 1 ? pageMembers.length : pageMembers.length),
        totalPages: hasNextPage ? pageNumber + 1 : pageNumber
      }));
      
      console.log(`✅ Página ${pageNumber} cargada: ${pageMembers.length} miembros`);
      
    } catch (err: any) {
      console.error('❌ Error cargando página:', err);
      setError(`Error cargando página ${pageNumber}: ${err.message}`);
    } finally {
      setPagination(prev => ({ ...prev, isLoading: false, isLoadingMore: false }));
    }
  }, [gymId, itemsPerPage, filters.statusFilter]);

  /**
   * 📄 Cargar siguiente página
   */
  const loadNextPage = useCallback(async () => {
    if (pagination.hasNextPage && !pagination.isLoading) {
      setPagination(prev => ({ ...prev, isLoadingMore: true }));
      await loadPage(pagination.currentPage + 1);
    }
  }, [pagination.hasNextPage, pagination.isLoading, pagination.currentPage, loadPage]);

  /**
   * 📄 Cargar página anterior (requiere recargar desde el inicio)
   */
  const loadPreviousPage = useCallback(async () => {
    if (pagination.hasPrevPage && pagination.currentPage > 1) {
      // Para página anterior, necesitamos recargar desde el inicio
      setMembers([]);
      setDocumentCache(new Map());
      setLastDocumentPerPage(new Map());
      await loadPage(1);
      
      // Si no es la página 1, cargar hasta la página anterior
      if (pagination.currentPage > 2) {
        for (let page = 2; page < pagination.currentPage; page++) {
          await loadPage(page);
        }
      }
    }
  }, [pagination.hasPrevPage, pagination.currentPage, loadPage]);

  /**
   * 🔄 Refrescar datos
   */
  const refreshData = useCallback(async () => {
    setMembers([]);
    setDocumentCache(new Map());
    setLastDocumentPerPage(new Map());
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    await loadPage(1);
  }, [loadPage]);

  // ==================== FUNCIONES DE FILTROS ====================

  /**
   * 🔍 Aplicar filtros locales a los miembros cargados
   */
  const applyFilters = useCallback(() => {
    let filtered = [...members];
    
    // Filtro por búsqueda (texto)
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.memberships.some(m => m.activityName?.toLowerCase().includes(term))
      );
    }
    
    // Filtro por membresías
    if (filters.membershipFilter === 'with_active') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.status === 'active')
      );
    } else if (filters.membershipFilter === 'with_auto') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.autoRenewal && m.status === 'active')
      );
    } else if (filters.membershipFilter === 'expired') {
      const today = new Date();
      filtered = filtered.filter(member => 
        member.memberships.some(m => {
          const endDate = new Date(m.endDate);
          return endDate <= today && m.status === 'active';
        })
      );
    }
    
    setFilteredMembers(filtered);
  }, [members, filters]);

  /**
   * 🔍 Establecer término de búsqueda
   */
  const setSearchTerm = useCallback((term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
  }, []);

  /**
   * 🔍 Establecer filtro de estado
   */
  const setStatusFilter = useCallback((status: FilterState['statusFilter']) => {
    setFilters(prev => ({ ...prev, statusFilter: status }));
    // Recargar datos si cambió el filtro de estado (afecta la query)
    if (status !== filters.statusFilter) {
      refreshData();
    }
  }, [filters.statusFilter, refreshData]);

  /**
   * 🔍 Establecer filtro de membresía
   */
  const setMembershipFilter = useCallback((filter: FilterState['membershipFilter']) => {
    setFilters(prev => ({ ...prev, membershipFilter: filter }));
  }, []);

  /**
   * 🧹 Limpiar todos los filtros
   */
  const clearFilters = useCallback(() => {
    const needsReload = filters.statusFilter !== 'all';
    
    setFilters({
      searchTerm: '',
      statusFilter: 'all',
      membershipFilter: 'all'
    });
    
    if (needsReload) {
      refreshData();
    }
  }, [filters.statusFilter, refreshData]);

  // ==================== FUNCIONES UTILITARIAS ====================

  /**
   * 📊 Obtener total de membresías
   */
  const getTotalMembershipsCount = useCallback((): number => {
    return filteredMembers.reduce((total, member) => 
      total + member.memberships.filter(m => m.status === 'active').length, 0
    );
  }, [filteredMembers]);

  /**
   * 🔄 Obtener total de auto-renovaciones
   */
  const getAutoRenewalCount = useCallback((): number => {
    return filteredMembers.reduce((total, member) => 
      total + member.memberships.filter(m => m.autoRenewal && m.status === 'active').length, 0
    );
  }, [filteredMembers]);

  // ==================== EFECTOS ====================

  // Cargar primera página al montar o cambiar gymId
  useEffect(() => {
    if (gymId) {
      refreshData();
    }
  }, [gymId]); // Solo depende de gymId para evitar loops

  // Aplicar filtros cuando cambien los miembros o filtros
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ==================== RETURN ====================

  return {
    // Datos
    members,
    filteredMembers,
    
    // Estados
    pagination,
    filters,
    error,
    
    // Funciones de paginación
    loadPage,
    loadNextPage,
    loadPreviousPage,
    refreshData,
    
    // Funciones de filtros
    setSearchTerm,
    setStatusFilter,
    setMembershipFilter,
    clearFilters,
    
    // Utilidades
    getTotalMembershipsCount,
    getAutoRenewalCount
  };
};