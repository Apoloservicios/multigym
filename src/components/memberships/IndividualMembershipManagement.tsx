// src/components/memberships/IndividualMembershipManagement.tsx
// 👥 GESTIÓN INDIVIDUAL POR USUARIO - Vista completa de cada socio

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  DollarSign,
  Activity,
  ToggleLeft,
  ToggleRight,
  Edit,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Mail,
  Phone
} from 'lucide-react';

import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { formatCurrency, formatDisplayDate } from '../../utils/format.utils';
import { membershipRenewalService } from '../../services/membershipRenewalService';

// ==========================================
// INTERFACES
// ==========================================

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  totalDebt: number;
  memberships: MembershipDetails[];
  lastActivity?: Date;
}

interface MembershipDetails {
  id: string;
  activityId: string;
  activityName: string;
  startDate: Date;
  endDate: Date;
  cost: number;
  status: 'active' | 'expired' | 'cancelled' | 'paused';
  autoRenewal: boolean;
  maxAttendances: number;
  currentAttendances: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  isExpired: boolean;
  daysUntilExpiry: number;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const IndividualMembershipManagement: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estados principales
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'autoRenewal'>('all');
  
  // Estados de operaciones
  const [updatingMembership, setUpdatingMembership] = useState<string>('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // ==========================================
  // EFECTOS
  // ==========================================

  useEffect(() => {
    if (gymData?.id) {
      loadMembersData();
    }
  }, [gymData?.id]);

  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter]);

  // Auto-limpiar mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ==========================================
  // FUNCIONES PRINCIPALES
  // ==========================================

  /**
   * 📊 Cargar datos de todos los socios y sus membresías
   */
  const loadMembersData = async () => {
    if (!gymData?.id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('📊 Cargando datos de socios y membresías...');
      
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const membersData: MemberWithMemberships[] = [];
      
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        // Obtener membresías del socio
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const memberships: MembershipDetails[] = [];
        
        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();
          
          const startDate = membershipData.startDate?.toDate 
            ? membershipData.startDate.toDate() 
            : new Date(membershipData.startDate);
            
          const endDate = membershipData.endDate?.toDate 
            ? membershipData.endDate.toDate() 
            : new Date(membershipData.endDate);
          
          const now = new Date();
          const isExpired = endDate < now;
          const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          memberships.push({
            id: membershipDoc.id,
            activityId: membershipData.activityId,
            activityName: membershipData.activityName || 'Actividad General',
            startDate,
            endDate,
            cost: membershipData.cost || 0,
            status: membershipData.status || 'active',
            autoRenewal: membershipData.autoRenewal || false,
            maxAttendances: membershipData.maxAttendances || 0,
            currentAttendances: membershipData.currentAttendances || 0,
            paymentStatus: membershipData.paymentStatus || 'pending',
            isExpired,
            daysUntilExpiry
          });
        }
        
        // Ordenar membresías por fecha de vencimiento
        memberships.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
        
        membersData.push({
          id: memberDoc.id,
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          phone: memberData.phone || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships,
          lastActivity: memberData.lastAttendance?.toDate ? memberData.lastAttendance.toDate() : undefined
        });
      }
      
      // Ordenar por nombre
      membersData.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      
      setMembers(membersData);
      console.log(`✅ Cargados ${membersData.length} socios con sus membresías`);
      
    } catch (err: any) {
      console.error('❌ Error cargando datos:', err);
      setError(`Error cargando datos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🔍 Filtrar socios según criterios
   */
  const filterMembers = () => {
    let filtered = [...members];
    
    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.memberships.some(m => m.activityName.toLowerCase().includes(term))
      );
    }
    
    // Filtro por estado
    switch (statusFilter) {
      case 'active':
        filtered = filtered.filter(member => member.status === 'active');
        break;
      case 'expired':
        filtered = filtered.filter(member => 
          member.memberships.some(m => m.isExpired && m.status === 'active')
        );
        break;
      case 'autoRenewal':
        filtered = filtered.filter(member => 
          member.memberships.some(m => m.autoRenewal)
        );
        break;
    }
    
    setFilteredMembers(filtered);
  };

  /**
   * 🔄 Cambiar auto-renovación de una membresía
   */
  const toggleAutoRenewal = async (
    memberId: string, 
    membershipId: string, 
    currentValue: boolean
  ) => {
    if (!gymData?.id) return;
    
    setUpdatingMembership(`${memberId}-${membershipId}`);
    setError('');
    
    try {
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships`, membershipId);
      await updateDoc(membershipRef, {
        autoRenewal: !currentValue,
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
                    ? { ...membership, autoRenewal: !currentValue }
                    : membership
                )
              }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      setSuccess(`Auto-renovación de ${membership?.activityName} ${!currentValue ? 'activada' : 'desactivada'} para ${member?.firstName} ${member?.lastName}`);
      
    } catch (err: any) {
      console.error('❌ Error cambiando auto-renovación:', err);
      setError('Error al cambiar la auto-renovación');
    } finally {
      setUpdatingMembership('');
    }
  };

  /**
   * 🔄 Renovar membresía individual
   */
  const renewMembership = async (memberId: string, membershipId: string) => {
    if (!gymData?.id) return;
    
    setUpdatingMembership(`renew-${memberId}-${membershipId}`);
    setError('');
    
    try {
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      
      if (!membership || !member) {
        throw new Error('Membresía no encontrada');
      }
      
      // Convertir al formato esperado por el servicio
      const membershipToRenew = {
        id: membership.id,
        memberId,
        memberName: `${member.firstName} ${member.lastName}`,
        activityId: membership.activityId,
        activityName: membership.activityName,
        currentCost: membership.cost,
        endDate: membership.endDate,
        autoRenewal: membership.autoRenewal,
        status: membership.status,
        maxAttendances: membership.maxAttendances
      };
      
      const result = await membershipRenewalService.renewSingleMembership(gymData.id, membershipToRenew);
      
      if (result.success) {
        setSuccess(`✅ Membresía de ${member.firstName} ${member.lastName} renovada exitosamente`);
        // Recargar datos
        await loadMembersData();
      } else {
        setError(`❌ Error renovando membresía: ${result.error}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error renovación individual:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setUpdatingMembership('');
    }
  };

  /**
   * 🎨 Obtener color del estado de la membresía
   */
  const getMembershipStatusColor = (membership: MembershipDetails): string => {
    if (membership.isExpired) return 'text-red-600 bg-red-100';
    if (membership.daysUntilExpiry <= 7) return 'text-yellow-600 bg-yellow-100';
    if (membership.status === 'active') return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  /**
   * 🎨 Obtener texto del estado de la membresía
   */
  const getMembershipStatusText = (membership: MembershipDetails): string => {
    if (membership.isExpired) return 'Vencida';
    if (membership.daysUntilExpiry <= 0) return 'Vence hoy';
    if (membership.daysUntilExpiry <= 7) return `Vence en ${membership.daysUntilExpiry} días`;
    return 'Activa';
  };

  // ==========================================
  // COMPONENTES DE UI
  // ==========================================

  /**
   * 🎨 Tarjeta de socio con sus membresías
   */
  const MemberCard: React.FC<{ member: MemberWithMemberships }> = ({ member }) => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header del socio */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {member.firstName} {member.lastName}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                {member.email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    {member.email}
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-1" />
                    {member.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              member.status === 'active' ? 'bg-green-100 text-green-800' :
              member.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {member.status === 'active' ? 'Activo' : 
               member.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
            </span>
            
            {member.totalDebt > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Deuda: {formatCurrency(member.totalDebt)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Membresías del socio */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-medium text-gray-900">
            Membresías ({member.memberships.length})
          </h4>
          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </button>
        </div>
        
        {member.memberships.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Sin membresías activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {member.memberships.map((membership) => (
              <div key={membership.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  {/* Info de la membresía */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-medium text-gray-900">
                        {membership.activityName}
                      </h5>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMembershipStatusColor(membership)}`}>
                        {getMembershipStatusText(membership)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-500">Costo:</span>
                        <p className="font-medium">{formatCurrency(membership.cost)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Vencimiento:</span>
                        <p className="font-medium">{formatDisplayDate(membership.endDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Asistencias:</span>
                        <p className="font-medium">
                          {membership.currentAttendances}/{membership.maxAttendances || '∞'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Pago:</span>
                        <p className={`font-medium ${
                          membership.paymentStatus === 'paid' ? 'text-green-600' :
                          membership.paymentStatus === 'partial' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {membership.paymentStatus === 'paid' ? 'Pagado' :
                           membership.paymentStatus === 'partial' ? 'Parcial' : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Controles */}
                  <div className="flex items-center space-x-3 ml-4">
                    {/* Auto-renovación */}
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-xs text-gray-500">Auto-reno</span>
                      <button
                        onClick={() => toggleAutoRenewal(member.id, membership.id, membership.autoRenewal)}
                        disabled={updatingMembership === `${member.id}-${membership.id}`}
                        className={`p-1 rounded transition-colors ${
                          membership.autoRenewal ? 'text-green-600' : 'text-gray-400'
                        } hover:bg-gray-100 disabled:opacity-50`}
                      >
                        {membership.autoRenewal ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Renovar manualmente */}
                    {(membership.isExpired || membership.daysUntilExpiry <= 7) && (
                      <button
                        onClick={() => renewMembership(member.id, membership.id)}
                        disabled={updatingMembership === `renew-${member.id}-${membership.id}`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {updatingMembership === `renew-${member.id}-${membership.id}` ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Renovar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Cargando datos de socios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Gestión Individual por Usuario
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Vista detallada de cada socio con control granular de membresías
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">
            {filteredMembers.length} de {members.length} socios
          </span>
          <button
            onClick={loadMembersData}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controles de búsqueda y filtros */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar por nombre, email o actividad..."
            />
          </div>
          
          {/* Filtros */}
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
            >
              <option value="all">Todos los socios</option>
              <option value="active">Solo activos</option>
              <option value="expired">Con membresías vencidas</option>
              <option value="autoRenewal">Con auto-renovación</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de socios */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No se encontraron socios
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Intenta ajustar los filtros de búsqueda' 
              : 'No hay socios registrados en el sistema'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IndividualMembershipManagement;