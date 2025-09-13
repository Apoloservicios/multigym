// COMPONENTE OPTIMIZADO CON SCROLL VIRTUAL - PARA 500+ SOCIOS
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  User, 
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { collection, getDocs, updateDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { formatDisplayDate } from '../../utils/date.utils';

interface MemberWithMembership {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  membershipId?: string;
  activityName?: string;
  startDate?: Date;
  endDate?: Date;
  cost?: number;
  autoRenewal?: boolean;
  status?: string;
  paymentStatus?: string;
  membershipLoaded?: boolean;
}

const ITEMS_PER_BATCH = 20; // Cargar membresías de 20 en 20
const ROW_HEIGHT = 80; // Altura estimada de cada fila en píxeles

const IndividualMembershipManagement: React.FC = () => {
  const { gymData } = useAuth();
  const [allMembers, setAllMembers] = useState<MemberWithMembership[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Estados para scroll virtual
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingQueue = useRef<Set<string>>(new Set());

  // Cargar solo datos básicos al inicio
  useEffect(() => {
    if (gymData?.id) {
      loadBasicMembersData();
    }
  }, [gymData]);

  const loadBasicMembersData = async () => {
    if (!gymData?.id) return;
    
    setIsLoading(true);
    try {
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      console.log('Total de socios encontrados:', membersSnapshot.size);
      
      const membersData: MemberWithMembership[] = membersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          membershipLoaded: false
        };
      });
      
      // Ordenar por nombre
      membersData.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setAllMembers(membersData);
      
    } catch (error) {
      console.error('Error cargando datos básicos:', error);
      setErrorMessage('Error al cargar los datos de socios');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar membresías en lote
  const loadMembershipsBatch = useCallback(async (memberIds: string[]) => {
    if (!gymData?.id || loadingBatch) return;
    
    // Filtrar solo los que no están en cola y no han sido cargados
    const toLoad = memberIds.filter(id => {
      const member = allMembers.find(m => m.id === id);
      return member && !member.membershipLoaded && !loadingQueue.current.has(id);
    });
    
    if (toLoad.length === 0) return;
    
    // Agregar a la cola
    toLoad.forEach(id => loadingQueue.current.add(id));
    setLoadingBatch(true);
    
    try {
      const updates: MemberWithMembership[] = [];
      
      // Procesar en paralelo pero con límite
      const promises = toLoad.slice(0, ITEMS_PER_BATCH).map(async (memberId) => {
        try {
          const memberMembershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
          const memberMembershipsQuery = query(
            memberMembershipsRef, 
            orderBy('startDate', 'desc'),
            limit(1)
          );
          const snapshot = await getDocs(memberMembershipsQuery);
          
          const member = allMembers.find(m => m.id === memberId);
          if (!member) return null;
          
          if (!snapshot.empty) {
            const latestMembership = snapshot.docs[0];
            const data = latestMembership.data();
            
            return {
              ...member,
              membershipId: latestMembership.id,
              activityName: data.activityName || data.name || '',
              startDate: data.startDate?.toDate ? data.startDate.toDate() : 
                        data.startDate ? new Date(data.startDate) : undefined,
              endDate: data.endDate?.toDate ? data.endDate.toDate() : 
                      data.endDate ? new Date(data.endDate) : undefined,
              cost: data.cost || data.price || 0,
              autoRenewal: data.autoRenewal || false,
              status: data.status || 'active',
              paymentStatus: data.paymentStatus || 'pending',
              membershipLoaded: true
            };
          } else {
            return {
              ...member,
              membershipLoaded: true
            };
          }
        } catch (error) {
          console.error(`Error cargando membresía para ${memberId}:`, error);
          const member = allMembers.find(m => m.id === memberId);
          return member ? { ...member, membershipLoaded: true } : null;
        }
      });
      
      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null) as MemberWithMembership[];
      
      // Actualizar estado
      setAllMembers(prev => {
        const updated = [...prev];
        validResults.forEach(result => {
          const index = updated.findIndex(m => m.id === result.id);
          if (index !== -1) {
            updated[index] = result;
          }
        });
        return updated;
      });
      
      // Limpiar cola
      toLoad.forEach(id => loadingQueue.current.delete(id));
      
    } catch (error) {
      console.error('Error cargando lote de membresías:', error);
    } finally {
      setLoadingBatch(false);
    }
  }, [gymData?.id, allMembers, loadingBatch]);

  // Filtrar miembros
  const filteredMembers = useMemo(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      return allMembers;
    }
    
    const search = searchTerm.toLowerCase().trim();
    const words = search.split(' ').filter(w => w.length > 0);
    
    return allMembers.filter(member => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const email = (member.email || '').toLowerCase();
      
      // Buscar todas las palabras
      return words.every(word => 
        fullName.includes(word) || email.includes(word)
      );
    });
  }, [searchTerm, allMembers]);

  // Manejar scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;
    
    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const end = Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT);
    
    setVisibleRange({ 
      start: Math.max(0, start - 5), // Buffer de 5 items antes
      end: Math.min(filteredMembers.length, end + 5) // Buffer de 5 items después
    });
  }, [filteredMembers.length]);

  // Cargar membresías cuando cambia el rango visible
  useEffect(() => {
    const visibleMembers = filteredMembers.slice(visibleRange.start, visibleRange.end);
    const memberIds = visibleMembers.map(m => m.id);
    
    if (memberIds.length > 0 && !isLoading) {
      loadMembershipsBatch(memberIds);
    }
  }, [visibleRange, filteredMembers, isLoading, loadMembershipsBatch]);

  const toggleAutoRenewal = async (member: MemberWithMembership) => {
    if (!gymData?.id || !member.membershipId || !member.id) return;
    
    setProcessingId(member.id);
    try {
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${member.id}/memberships`, member.membershipId);
      await updateDoc(membershipRef, {
        autoRenewal: !member.autoRenewal
      });
      
      setSuccessMessage(`Auto-renovación ${!member.autoRenewal ? 'activada' : 'desactivada'} para ${member.firstName} ${member.lastName}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setAllMembers(prev => prev.map(m => 
        m.id === member.id 
          ? { ...m, autoRenewal: !member.autoRenewal }
          : m
      ));
      
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Error al actualizar');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (endDate?: Date) => {
    if (!endDate) return 'text-gray-500';
    const now = new Date();
    const days = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600';
    if (days <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = (endDate?: Date) => {
    if (!endDate) return 'Sin membresía';
    const now = new Date();
    const days = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `Vencida hace ${Math.abs(days)} días`;
    if (days === 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    if (days <= 7) return `Vence en ${days} días`;
    return `Activa por ${days} días`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Cargando socios...</span>
      </div>
    );
  }

  // Calcular elementos visibles para scroll virtual
  const visibleMembers = filteredMembers.slice(visibleRange.start, visibleRange.end);
  const totalHeight = filteredMembers.length * ROW_HEIGHT;
  const offsetY = visibleRange.start * ROW_HEIGHT;

  return (
    <div className="space-y-6">
      {/* Mensajes */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
          <XCircle className="h-5 w-5 mr-2" />
          {errorMessage}
        </div>
      )}

      {/* Búsqueda */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
          <span>{filteredMembers.length} socios encontrados</span>
          <button
            onClick={loadBasicMembersData}
            className="flex items-center text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla con scroll virtual */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? `No se encontraron socios` : 'No hay socios'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loadingBatch && (
            <div className="bg-blue-50 px-4 py-2 text-sm text-blue-700">
              Cargando membresías...
            </div>
          )}
          
          {/* Header fijo */}
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Socio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Actividad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Auto-Renovación
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Contenedor con scroll virtual */}
          <div 
            ref={containerRef}
            className="overflow-auto"
            style={{ height: '600px' }}
            onScroll={handleScroll}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                <table className="min-w-full">
                  <tbody className="bg-white divide-y divide-gray-200">
                    {visibleMembers.map((member) => (
                      <tr key={member.id} style={{ height: ROW_HEIGHT }} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap w-1/4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          {!member.membershipLoaded ? (
                            <span className="text-sm text-gray-400">...</span>
                          ) : (
                            <div className="text-sm text-gray-900">
                              {member.activityName || '-'}
                              {member.cost && (
                                <div className="text-xs text-gray-500">
                                  ${member.cost.toLocaleString('es-AR')}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          {!member.membershipLoaded ? (
                            <span className="text-sm text-gray-400">...</span>
                          ) : member.endDate ? (
                            <div>
                              <div className="text-sm text-gray-900">
                                {formatDisplayDate(member.endDate)}
                              </div>
                              <div className={`text-xs ${getStatusColor(member.endDate)}`}>
                                {getStatusText(member.endDate)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          {!member.membershipLoaded ? (
                            <span className="text-sm text-gray-400">...</span>
                          ) : member.membershipId ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              member.endDate && member.endDate < new Date()
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {member.endDate && member.endDate < new Date() ? 'Vencida' : 'Activa'}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Sin membresía
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/4">
                          {!member.membershipLoaded ? (
                            <span className="text-sm text-gray-400">...</span>
                          ) : member.membershipId ? (
                            <button
                              onClick={() => toggleAutoRenewal(member)}
                              disabled={processingId === member.id}
                              className="flex items-center space-x-2"
                            >
                              {member.autoRenewal ? (
                                <ToggleRight className="h-8 w-8 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-8 w-8 text-gray-400" />
                              )}
                              <span className={`text-sm ${member.autoRenewal ? 'text-green-600' : 'text-gray-500'}`}>
                                {member.autoRenewal ? 'Activada' : 'Desactivada'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Sistema optimizado para grandes volúmenes
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Los datos se cargan mientras navegas por la lista</li>
                <li>Solo se renderizan los elementos visibles (scroll virtual)</li>
                <li>Búsqueda instantánea sin recargar datos</li>
                <li>Optimizado para más de 500 socios</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndividualMembershipManagement;