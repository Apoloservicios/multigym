// src/components/payments/MemberStatusControls.tsx
// 🎯 CONTROLES PARA MANEJAR ESTADOS DE SOCIOS Y MEMBRESÍAS

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Settings, 
  Pause, 
  Play, 
  Ban, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  ToggleLeft,
  ToggleRight,
  Save
} from 'lucide-react';
import { collection, doc, getDocs, updateDoc, getDoc } from 'firebase/firestore';
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
}

const MemberStatusControls: React.FC = () => {
  const { gymData } = useAuth();
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cargar datos al inicializar
  useEffect(() => {
    if (gymData?.id) {
      loadMembersWithMemberships();
    }
  }, [gymData?.id]);

  /**
   * 📋 Cargar todos los socios con sus membresías
   */
  const loadMembersWithMemberships = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
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
          ...membershipDoc.data()
        })) as MembershipStatus[];
        
        membersData.push({
          id: memberDoc.id,
          firstName: memberData.firstName || 'Sin nombre',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships
        });
      }
      
      // Ordenar por nombre
      membersData.sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
      
      setMembers(membersData);
      console.log('📋 Socios cargados con membresías:', membersData.length);
      
    } catch (err: any) {
      console.error('❌ Error cargando socios:', err);
      setError('Error al cargar los datos de socios');
    } finally {
      setLoading(false);
    }
  };

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
      setSuccess(`Membresía ${membership?.activityName} de ${member?.firstName} actualizada a: ${newStatus}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        <span className="text-gray-600">Cargando control de estados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Control de Estados - Socios y Membresías
          </h2>
          <p className="text-gray-600">
            Gestiona quién genera cuotas automáticamente el próximo mes
          </p>
        </div>
        
        <button
          onClick={loadMembersWithMemberships}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
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
              Importante: Lógica de Automatización
            </h4>
            <div className="text-sm text-blue-800 mt-1 space-y-1">
              <p>• <strong>Socio Inactivo:</strong> NO genera ninguna cuota automática</p>
              <p>• <strong>Membresía Pausada:</strong> NO genera cuota para esa actividad</p>
              <p>• <strong>Membresía Cancelada:</strong> NO genera cuota nunca más</p>
              <p>• <strong>Auto-renovación OFF:</strong> NO genera cuota aunque esté activa</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de socios con controles */}
      <div className="space-y-4">
        {members.map((member) => (
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

      {/* Resumen final */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Socios Activos:</p>
            <p className="font-semibold">{members.filter(m => m.status === 'active').length}</p>
          </div>
          <div>
            <p className="text-gray-600">Socios Inactivos:</p>
            <p className="font-semibold">{members.filter(m => m.status === 'inactive').length}</p>
          </div>
          <div>
            <p className="text-gray-600">Membresías Activas:</p>
            <p className="font-semibold">
              {members.reduce((sum, m) => sum + m.memberships.filter(mb => mb.status === 'active').length, 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Con Auto-renovación:</p>
            <p className="font-semibold">
              {members.reduce((sum, m) => sum + m.memberships.filter(mb => mb.autoRenewal && mb.status === 'active').length, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberStatusControls;