// src/components/renewals/ManualRenewalManager.tsx
// 🔧 COMPONENTE NUEVO: PASO 3 - ORGANIZAR RENOVACIONES
// Interfaz unificada para renovaciones manuales + integración con sistema automático

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Calendar, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Filter,
  Eye,
  Plus
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatting.utils';
import { getCurrentDateInArgentina } from '../../utils/timezone.utils';
import MonthlyPaymentsService from '../../services/monthlyPayments.service';

// ===================== INTERFACES =====================

interface MemberForRenewal {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
  totalDebt: number;
  
  // Membresías
  memberships: MembershipForRenewal[];
  
  // Estado de pagos mensuales
  hasCurrentMonthPayment: boolean;
  currentMonthPending: number;
  lastPaymentDate?: string;
}

interface MembershipForRenewal {
  id: string;
  activityName: string;
  startDate: string;
  endDate: string;
  cost: number;
  status: 'active' | 'expired' | 'cancelled';
  paymentStatus: 'paid' | 'pending' | 'overdue';
  autoRenewal: boolean;
  daysUntilExpiration: number;
  isExpired: boolean;
}

interface RenewalAction {
  memberId: string;
  membershipId: string;
  actionType: 'renew' | 'extend' | 'modify';
  newEndDate: string;
  newCost?: number;
  generatePayment: boolean;
  notes?: string;
}

// ===================== COMPONENTE PRINCIPAL =====================

const ManualRenewalManager: React.FC = () => {
  const { gymData, userData } = useAuth();
  
  // Estados principales
  const [members, setMembers] = useState<MemberForRenewal[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberForRenewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring' | 'expired' | 'debt'>('all');
  const [autoRenewalFilter, setAutoRenewalFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Estados del modal
  const [selectedMember, setSelectedMember] = useState<MemberForRenewal | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalData, setRenewalData] = useState<RenewalAction | null>(null);

  // ===================== CARGAR DATOS =====================

  useEffect(() => {
    if (gymData?.id) {
      loadMembersForRenewal();
    }
  }, [gymData?.id]);

  useEffect(() => {
    applyFilters();
  }, [members, searchTerm, statusFilter, autoRenewalFilter]);

  const loadMembersForRenewal = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      // TODO: Implementar consulta optimizada que combine miembros + membresías + pagos mensuales
      // Por ahora, simulamos la estructura
      
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      // Simular datos mientras implementamos la consulta real
      const mockMembers: MemberForRenewal[] = [
        {
          id: 'member1',
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@email.com',
          status: 'active',
          totalDebt: 15000,
          hasCurrentMonthPayment: false,
          currentMonthPending: 8000,
          memberships: [
            {
              id: 'membership1',
              activityName: 'Musculación',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
              cost: 8000,
              status: 'active',
              paymentStatus: 'pending',
              autoRenewal: true,
              daysUntilExpiration: 30,
              isExpired: false
            }
          ]
        },
        {
          id: 'member2',
          firstName: 'María',
          lastName: 'González',
          email: 'maria@email.com',
          status: 'active',
          totalDebt: 0,
          hasCurrentMonthPayment: true,
          currentMonthPending: 0,
          memberships: [
            {
              id: 'membership2',
              activityName: 'Crossfit',
              startDate: '2024-01-01',
              endDate: '2024-09-30',
              cost: 12000,
              status: 'expired',
              paymentStatus: 'paid',
              autoRenewal: false,
              daysUntilExpiration: -5,
              isExpired: true
            }
          ]
        }
      ];
      
      setMembers(mockMembers);
      
    } catch (err: any) {
      console.error('Error cargando miembros para renovación:', err);
      setError('Error al cargar los datos de renovación');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...members];
    
    // Filtro de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email?.toLowerCase().includes(term)
      );
    }
    
    // Filtro de estado
    switch (statusFilter) {
      case 'expiring':
        filtered = filtered.filter(member =>
          member.memberships.some(m => 
            m.daysUntilExpiration <= 30 && m.daysUntilExpiration > 0
          )
        );
        break;
      case 'expired':
        filtered = filtered.filter(member =>
          member.memberships.some(m => m.isExpired)
        );
        break;
      case 'debt':
        filtered = filtered.filter(member => member.totalDebt > 0);
        break;
    }
    
    // Filtro de auto-renovación
    if (autoRenewalFilter !== 'all') {
      filtered = filtered.filter(member =>
        member.memberships.some(m => 
          autoRenewalFilter === 'enabled' ? m.autoRenewal : !m.autoRenewal
        )
      );
    }
    
    setFilteredMembers(filtered);
  };

  // ===================== ACCIONES DE RENOVACIÓN =====================

  const handleRenewMembership = async (
    memberId: string, 
    membershipId: string, 
    months: number = 1
  ) => {
    if (!gymData?.id || !userData?.id) return;
    
    setProcessing(membershipId);
    setError('');
    
    try {
      const today = new Date();
      const newEndDate = new Date(today);
      newEndDate.setMonth(newEndDate.getMonth() + months);
      
      // TODO: Implementar renovación manual en el servicio
      // await MembershipService.renewMembership(gymId, membershipId, {
      //   newEndDate: newEndDate.toISOString().split('T')[0],
      //   renewedBy: userData.id,
      //   generateMonthlyPayment: true
      // });
      
      setSuccess(`Membresía renovada por ${months} ${months === 1 ? 'mes' : 'meses'}`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Recargar datos
      await loadMembersForRenewal();
      
    } catch (err: any) {
      console.error('Error renovando membresía:', err);
      setError(err.message || 'Error al renovar la membresía');
      setTimeout(() => setError(''), 5000);
    } finally {
      setProcessing(null);
    }
  };

  const handleGenerateCurrentMonthPayment = async (memberId: string) => {
    if (!gymData?.id) return;
    
    setProcessing(memberId);
    setError('');
    
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      // Generar pago mensual manualmente
         const result = await MonthlyPaymentsService.generateMonthlyPayments(
        gymData.id
        );
      
      if (result.success) {
        setSuccess('Pago mensual generado exitosamente');
        setTimeout(() => setSuccess(''), 3000);
        await loadMembersForRenewal();
      } else {
        throw new Error(result.errors?.[0] || 'Error generando pago mensual');
      }
      
    } catch (err: any) {
      console.error('Error generando pago mensual:', err);
      setError(err.message || 'Error al generar el pago mensual');
      setTimeout(() => setError(''), 5000);
    } finally {
      setProcessing(null);
    }
  };

  // ===================== FUNCIONES DE UTILIDAD =====================

  const getMemberStatusColor = (member: MemberForRenewal) => {
    const hasExpired = member.memberships.some(m => m.isExpired);
    const hasExpiring = member.memberships.some(m => m.daysUntilExpiration <= 7 && m.daysUntilExpiration > 0);
    const hasDebt = member.totalDebt > 0;
    
    if (hasExpired) return 'text-red-600 bg-red-50';
    if (hasExpiring || hasDebt) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getMemberStatusText = (member: MemberForRenewal) => {
    const hasExpired = member.memberships.some(m => m.isExpired);
    const hasExpiring = member.memberships.some(m => m.daysUntilExpiration <= 7 && m.daysUntilExpiration > 0);
    const hasDebt = member.totalDebt > 0;
    
    if (hasExpired) return 'Membresía Vencida';
    if (hasExpiring) return 'Por Vencer';
    if (hasDebt) return 'Con Deuda';
    return 'Al Día';
  };

  const formatDaysUntilExpiration = (days: number) => {
    if (days < 0) return `Vencida hace ${Math.abs(days)} días`;
    if (days === 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    return `Vence en ${days} días`;
  };

  // ===================== RENDER =====================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        <span>Cargando datos de renovación...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Renovaciones Manuales</h2>
          <p className="text-gray-600">Gestiona renovaciones de membresías y pagos mensuales</p>
        </div>
        
        <button
          onClick={loadMembersForRenewal}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro de estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="expiring">Por vencer (30 días)</option>
            <option value="expired">Vencidos</option>
            <option value="debt">Con deuda</option>
          </select>

          {/* Filtro de auto-renovación */}
          <select
            value={autoRenewalFilter}
            onChange={(e) => setAutoRenewalFilter(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Auto-renovación: Todas</option>
            <option value="enabled">Habilitada</option>
            <option value="disabled">Deshabilitada</option>
          </select>

          {/* Estadísticas rápidas */}
          <div className="text-sm text-gray-600">
            <div>Total: {filteredMembers.length} socios</div>
            <div>Vencidos: {filteredMembers.filter(m => m.memberships.some(ms => ms.isExpired)).length}</div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="text-red-600 mr-2" size={16} />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="text-green-600 mr-2" size={16} />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Lista de socios */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Socios para Renovación ({filteredMembers.length})
          </h3>
          
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No hay socios que coincidan con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMembers.map(member => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                  {/* Información del socio */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMemberStatusColor(member)}`}>
                          {getMemberStatusText(member)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        {member.email && <span>{member.email}</span>}
                        {member.totalDebt > 0 && (
                          <span className="text-red-600 font-medium">
                            Deuda: {formatCurrency(member.totalDebt)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRenewalModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <Eye size={16} className="inline mr-1" />
                        Ver Detalles
                      </button>
                    </div>
                  </div>

                  {/* Membresías */}
                  <div className="space-y-2">
                    {member.memberships.map(membership => (
                      <div key={membership.id} className="bg-gray-50 rounded-md p-3">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{membership.activityName}</span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                membership.autoRenewal 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {membership.autoRenewal ? 'Auto-renovación' : 'Manual'}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                              <span>{formatCurrency(membership.cost)}/mes</span>
                              <span>{formatDaysUntilExpiration(membership.daysUntilExpiration)}</span>
                              <span>Hasta: {new Date(membership.endDate).toLocaleDateString('es-AR')}</span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleRenewMembership(member.id, membership.id, 1)}
                              disabled={processing === membership.id}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {processing === membership.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                'Renovar 1 mes'
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleRenewMembership(member.id, membership.id, 3)}
                              disabled={processing === membership.id}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Renovar 3 meses
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagos mensuales */}
                  {!member.hasCurrentMonthPayment && member.currentMonthPending > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-yellow-800">
                            No tiene pago generado para este mes
                          </span>
                          <div className="text-xs text-yellow-600">
                            Monto pendiente: {formatCurrency(member.currentMonthPending)}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleGenerateCurrentMonthPayment(member.id)}
                          disabled={processing === member.id}
                          className="flex items-center px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
                        >
                          {processing === member.id ? (
                            <RefreshCw size={12} className="animate-spin mr-1" />
                          ) : (
                            <Plus size={12} className="mr-1" />
                          )}
                          Generar Pago Mensual
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles (opcional) */}
      {showRenewalModal && selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Detalles de Renovación - {selectedMember.firstName} {selectedMember.lastName}
                </h3>
                <button
                  onClick={() => {
                    setShowRenewalModal(false);
                    setSelectedMember(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              {/* Contenido del modal */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Información del Socio</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <div>{selectedMember.email || 'No registrado'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Estado:</span>
                      <div className="capitalize">{selectedMember.status}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Deuda Total:</span>
                      <div className={selectedMember.totalDebt > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {formatCurrency(selectedMember.totalDebt)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Último Pago:</span>
                      <div>{selectedMember.lastPaymentDate || 'No registrado'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Membresías Activas</h4>
                  <div className="space-y-3">
                    {selectedMember.memberships.map(membership => (
                      <div key={membership.id} className="border border-gray-200 rounded-md p-3 bg-white">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium">{membership.activityName}</h5>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            membership.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : membership.status === 'expired'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {membership.status === 'active' ? 'Activa' : 
                             membership.status === 'expired' ? 'Vencida' : 'Cancelada'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span>Inicio:</span> {new Date(membership.startDate).toLocaleDateString('es-AR')}
                          </div>
                          <div>
                            <span>Fin:</span> {new Date(membership.endDate).toLocaleDateString('es-AR')}
                          </div>
                          <div>
                            <span>Costo:</span> {formatCurrency(membership.cost)}/mes
                          </div>
                          <div>
                            <span>Auto-renovación:</span> {membership.autoRenewal ? 'Sí' : 'No'}
                          </div>
                        </div>
                        
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <span className={`font-medium ${
                            membership.isExpired ? 'text-red-600' : 
                            membership.daysUntilExpiration <= 7 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {formatDaysUntilExpiration(membership.daysUntilExpiration)}
                          </span>
                        </div>
                        
                        {/* Acciones rápidas */}
                        <div className="flex space-x-2 mt-3">
                          <button
                            onClick={() => handleRenewMembership(selectedMember.id, membership.id, 1)}
                            disabled={processing === membership.id}
                            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {processing === membership.id ? (
                              <RefreshCw size={14} className="animate-spin mx-auto" />
                            ) : (
                              'Renovar 1 mes'
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleRenewMembership(selectedMember.id, membership.id, 3)}
                            disabled={processing === membership.id}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            Renovar 3 meses
                          </button>
                          
                          <button
                            onClick={() => handleRenewMembership(selectedMember.id, membership.id, 6)}
                            disabled={processing === membership.id}
                            className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            Renovar 6 meses
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estado de pagos mensuales */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Estado de Pagos Mensuales</h4>
                  
                  {selectedMember.hasCurrentMonthPayment ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-2" />
                      <span>Tiene pago generado para el mes actual</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center text-yellow-600">
                        <AlertCircle size={16} className="mr-2" />
                        <span>No tiene pago generado para este mes</span>
                      </div>
                      
                      {selectedMember.currentMonthPending > 0 && (
                        <div className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div>
                            <div className="text-sm font-medium text-yellow-800">
                              Monto pendiente: {formatCurrency(selectedMember.currentMonthPending)}
                            </div>
                            <div className="text-xs text-yellow-600">
                              Haga clic para generar el pago mensual automáticamente
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleGenerateCurrentMonthPayment(selectedMember.id)}
                            disabled={processing === selectedMember.id}
                            className="flex items-center px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
                          >
                            {processing === selectedMember.id ? (
                              <RefreshCw size={14} className="animate-spin mr-2" />
                            ) : (
                              <Plus size={14} className="mr-2" />
                            )}
                            Generar Pago
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Botones del modal */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRenewalModal(false);
                    setSelectedMember(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
                
                <button
                  onClick={() => {
                    // TODO: Navegar al estado de cuenta del socio
                    console.log('Navegar a estado de cuenta');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Ver Estado de Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualRenewalManager;