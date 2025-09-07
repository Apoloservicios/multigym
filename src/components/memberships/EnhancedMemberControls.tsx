// src/components/memberships/EnhancedMemberControls.tsx
// 🎯 CONTROLES MEJORADOS CON RENOVACIÓN MANUAL INTEGRADA

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
  Users,
  Zap,
  Calendar,
  DollarSign,
  Play,
  Pause,
  Ban
} from 'lucide-react';
import { collection, doc, getDocs, updateDoc, query, where, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import AutoRenewalService from '../../services/autoRenewal.service';
import { formatCurrency } from '../../utils/formatting.utils';

interface MembershipStatus {
  id: string;
  activityId: string;
  activityName: string;
  cost: number;
  status: 'active' | 'paused' | 'cancelled';
  autoRenewal: boolean;
  startDate: string;
  endDate: string;
  maxAttendances: number;
  currentAttendances: number;
}

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  totalDebt: number;
  memberships: MembershipStatus[];
}

const EnhancedMemberControls: React.FC = () => {
  const { gymData } = useAuth();
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [renewingMembership, setRenewingMembership] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'with_active' | 'with_auto' | 'expired'>('all');

  // Cargar datos al inicializar
  useEffect(() => {
    if (gymData?.id) {
      loadMembersWithMemberships();
    }
  }, [gymData?.id]);

  // Aplicar filtros
  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter, membershipFilter]);

  // Limpiar mensajes después de un tiempo
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * 📋 Cargar todos los socios con sus membresías
   */
  const loadMembersWithMemberships = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Cargando socios con membresías...');
      
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnap = await getDocs(membersRef);
      
      const membersData: MemberWithMemberships[] = [];
      
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        
        // Cargar membresías del socio
        const membershipRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
        const membershipSnap = await getDocs(membershipRef);
        
        const memberships: MembershipStatus[] = membershipSnap.docs.map(membershipDoc => ({
          id: membershipDoc.id,
          activityId: membershipDoc.data().activityId || '',
          activityName: membershipDoc.data().activityName || 'Sin actividad',
          cost: membershipDoc.data().cost || 0,
          status: membershipDoc.data().status || 'active',
          autoRenewal: membershipDoc.data().autoRenewal || false,
          startDate: membershipDoc.data().startDate || '',
          endDate: membershipDoc.data().endDate || '',
          maxAttendances: membershipDoc.data().maxAttendances || 0,
          currentAttendances: membershipDoc.data().currentAttendances || 0
        }));
        
        membersData.push({
          id: memberDoc.id,
          firstName: memberData.firstName || 'Sin nombre',
          lastName: memberData.lastName || 'Sin apellido',
          email: memberData.email || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships
        });
      }
      
      setMembers(membersData);
      console.log(`✅ Cargados ${membersData.length} socios`);
      
    } catch (err: any) {
      console.error('❌ Error cargando socios:', err);
      setError('Error al cargar los socios');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Filtrar miembros según criterios
   */
  const filterMembers = useCallback(() => {
    let filtered = [...members];
    
    // Filtro por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.memberships.some(m => m.activityName.toLowerCase().includes(term))
      );
    }
    
    // Filtro por estado del socio
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }
    
    // Filtro por membresías
    if (membershipFilter === 'with_active') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.status === 'active')
      );
    } else if (membershipFilter === 'with_auto') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.autoRenewal && m.status === 'active')
      );
    } else if (membershipFilter === 'expired') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(member => 
        member.memberships.some(m => {
          const endDate = new Date(m.endDate);
          return endDate <= today && m.status === 'active';
        })
      );
    }
    
    setFilteredMembers(filtered);
  }, [members, searchTerm, statusFilter, membershipFilter]);

  /**
   * 🔄 Cambiar estado del socio
   */
  const updateMemberStatus = async (memberId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    setUpdating(memberId);
    setError('');
    
    try {
      const memberRef = doc(db, `gyms/${gymData!.id}/members/${memberId}`);
      await updateDoc(memberRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, status: newStatus }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      setSuccess(`Estado de ${member?.firstName} ${member?.lastName} cambiado a ${newStatus}`);
      
    } catch (err: any) {
      console.error('❌ Error actualizando estado del socio:', err);
      setError('Error al actualizar el estado del socio');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Cambiar estado de la membresía
   */
  const updateMembershipStatus = async (memberId: string, membershipId: string, newStatus: 'active' | 'paused' | 'cancelled') => {
    setUpdating(`${memberId}-${membershipId}`);
    setError('');
    
    try {
      const membershipRef = doc(db, `gyms/${gymData!.id}/members/${memberId}/memberships/${membershipId}`);
      await updateDoc(membershipRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
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
      setSuccess(`Estado de ${membership?.activityName} cambiado a ${newStatus}`);
      
    } catch (err: any) {
      console.error('❌ Error actualizando estado de membresía:', err);
      setError('Error al actualizar el estado de la membresía');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Toggle auto-renovación
   */
  const toggleAutoRenewal = async (memberId: string, membershipId: string, currentAutoRenewal: boolean) => {
    setUpdating(`${memberId}-${membershipId}-auto`);
    setError('');
    
    try {
      const membershipRef = doc(db, `gyms/${gymData!.id}/members/${memberId}/memberships/${membershipId}`);
      await updateDoc(membershipRef, {
        autoRenewal: !currentAutoRenewal,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
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
      
    } catch (err: any) {
      console.error('❌ Error cambiando auto-renovación:', err);
      setError('Error al cambiar la auto-renovación');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🚀 Renovar membresía manualmente
   */
  const renewMembershipManually = async (memberId: string, membershipId: string) => {
    setRenewingMembership(membershipId);
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
        maxAttendances: membership.maxAttendances,
        description: ''
      };
      
      const result = await AutoRenewalService.renewMembershipWithUpdatedPrice(
        gymData!.id, 
        membershipToRenew
      );
      
      if (result.renewed) {
        let message = `✅ Membresía de ${result.memberName} renovada exitosamente`;
        if (result.priceChanged) {
          message += `\n💰 Precio actualizado: ${formatCurrency(result.oldPrice)} → ${formatCurrency(result.newPrice)}`;
        }
        
        setSuccess(message);
        
        // Recargar datos para mostrar los cambios
        await loadMembersWithMemberships();
      } else {
        setError(`Error renovando membresía: ${result.error}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error renovando membresía:', err);
      setError('Error renovando la membresía manualmente');
    } finally {
      setRenewingMembership(null);
    }
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
   * 🔍 Verificar si una membresía está vencida
   */
  const isMembershipExpired = (endDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const membershipEndDate = new Date(endDate);
    return membershipEndDate <= today;
  };

  /**
   * 🧹 Limpiar filtros
   */
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMembershipFilter('all');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin mr-3" size={24} />
        <span className="text-gray-600">Cargando control de estados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen final */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen de Estados</h3>
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
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-gray-200">
          <div>
            <p className="text-gray-600">Membresías Vencidas:</p>
            <p className="font-semibold text-red-600">
              {filteredMembers.reduce((sum, m) => 
                sum + m.memberships.filter(mb => 
                  mb.status === 'active' && isMembershipExpired(mb.endDate)
                ).length, 0
              )}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Membresías Pausadas:</p>
            <p className="font-semibold text-yellow-600">
              {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.status === 'paused').length, 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Membresías Canceladas:</p>
            <p className="font-semibold text-gray-600">
              {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.status === 'cancelled').length, 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Total Deuda:</p>
            <p className="font-semibold text-red-600">
              {formatCurrency(filteredMembers.reduce((sum, m) => sum + (m.totalDebt || 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMemberControls;