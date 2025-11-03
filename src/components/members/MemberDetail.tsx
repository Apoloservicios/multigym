// src/components/members/MemberDetail.tsx - FUNCIONALIDAD DE REINTEGRO CORREGIDA

import React, { useState, useEffect } from 'react';
import { Member } from '../../types/member.types';
import { MembershipAssignment } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { firebaseDateToHtmlDate } from '../../utils/date.utils';
import MemberAccountStatement from './MemberAccountStatement';
import MemberPayment from './MemberPayment';
import MemberAttendanceHistory from './MemberAttendanceHistory';
import MemberRoutinesTab from './MemberRoutinesTab';
import MembershipCancellationModal from '../memberships/MembershipCancellationModal'; // 🆕 MODAL CORRECTO
import useAuth from '../../hooks/useAuth';
import { getMemberMemberships, confirmMembershipCancellation } from '../../services/member.service';
import DeleteMembershipModal from '../memberships/DeleteMembershipModal'; // 🔧 MANTENER PARA COMPATIBILIDAD
import { 
  Mail, Phone, Calendar, MapPin, Edit, Trash, QrCode, CreditCard, Plus, Clock, DollarSign, 
  ChevronDown, ChevronUp, FileText, History, User, Dumbbell, CheckCircle, AlertCircle, 
  RefreshCw, RotateCcw, Ban, XCircle, AlertTriangle, Edit2, Trash2,Heart,Fingerprint 
} from 'lucide-react';

import { formatDisplayDate, toJsDate } from '../../utils/date.utils';

import FingerprintEnrollment from './FingerprintEnrollment';
import { fingerprintService } from '../../services/fingerprintService';


interface MemberDetailProps {
  member: Member;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
  onGenerateQr: (member: Member) => void;
  onAssignMembership: (member: Member) => void;
  onRefreshMember?: () => void;
}

const MemberDetail: React.FC<MemberDetailProps> = ({ 
  member, 
  onEdit, 
  onDelete, 
  onGenerateQr, 
  onAssignMembership,
  onRefreshMember
}) => {
  const { gymData } = useAuth();

  const [memberships, setMemberships] = useState<MembershipAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [calculatedDebt, setCalculatedDebt] = useState<number>(0);
const [activeView, setActiveView] = useState<'details' | 'memberships' | 'account' | 'attendance' | 'payment' | 'routines'>('details');

// Estados para secciones expandibles
const [expandedSections, setExpandedSections] = useState({
  emergency: false,
  health: false
});
  


const toggleSection = (section: 'emergency' | 'health') => {
  setExpandedSections(prev => ({
    ...prev,
    [section]: !prev[section]
  }));
};

  const [showFingerprintEnrollment, setShowFingerprintEnrollment] = useState(false);
const [hasFingerprint, setHasFingerprint] = useState(false);

useEffect(() => {
  if (member.fingerprint && member.fingerprint.template) {
    setHasFingerprint(true);
  } else {
    setHasFingerprint(false);
  }
}, [member]);


// 4. FUNCIÓN PARA ELIMINAR HUELLA
const handleDeleteFingerprint = async () => {
  if (!gymData?.id) return;
  
  const confirmed = window.confirm(
    '¿Estás seguro de eliminar la huella digital registrada? El socio deberá registrarla nuevamente.'
  );
  
  if (!confirmed) return;
  
  try {
    const result = await fingerprintService.deleteFingerprint(gymData.id, member.id);
    
    if (result.success) {
      alert('Huella eliminada correctamente');
      setHasFingerprint(false);
      onRefreshMember?.();
    } else {
      alert('Error al eliminar huella: ' + result.error);
    }
  } catch (error: any) {
    alert('Error al eliminar huella: ' + error.message);
  }
};
  

useEffect(() => {
  const savedTab = sessionStorage.getItem('memberDetailActiveTab');
  console.log('🔄 useEffect inicial - Tab guardado:', savedTab);
  
  if (savedTab === 'cuenta') {
    console.log('✅ Cambiando a tab CUENTA');
    setActiveView('account');
    sessionStorage.removeItem('memberDetailActiveTab');
  }
}, []); 

  // 🆕 ESTADOS PARA EL MODAL DE CANCELACIÓN MEJORADO
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [membershipToCancel, setMembershipToCancel] = useState<MembershipAssignment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
  // 🔧 MANTENER MODAL LEGACY SOLO PARA COMPATIBILIDAD EN CASOS ESPECÍFICOS
  const [membershipToDelete, setMembershipToDelete] = useState<MembershipAssignment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // Función para formatear fechas sin problemas de timezone
  const formatDisplayDateFixed = (dateInput: any): string => {
    if (!dateInput) return 'No disponible';
    
    const htmlDate = firebaseDateToHtmlDate(dateInput);
    if (!htmlDate) return 'No disponible';
    
    const [year, month, day] = htmlDate.split('-');
    return `${day}/${month}/${year}`;
  };
  
  // Cargar membresías del socio
 const loadMemberMemberships = async () => {
  if (!gymData?.id || !member.id) return;
  
  setLoading(true);
  try {
    const membershipData = await getMemberMemberships(gymData.id, member.id);
    setMemberships(membershipData);
    
    // 🔧 CALCULAR DEUDA DE MEMBRESÍAS PENDIENTES
    let totalPendingDebt = 0;
    membershipData.forEach(membership => {
      if (membership.paymentStatus === 'pending' && 
          membership.status !== 'cancelled' && 
          membership.cost > 0) {
        totalPendingDebt += membership.cost;
      }
    });
    
    setCalculatedDebt(totalPendingDebt);
    console.log('💰 Deuda calculada de membresías pendientes:', totalPendingDebt);
    
  } catch (error) {
    console.error('Error loading memberships:', error);
    setError('Error al cargar las membresías del socio');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  // Recargar membresías cuando se vuelve a la vista de cuenta o membresías
  if (activeView === 'account' || activeView === 'memberships') {
    loadMemberMemberships();
  }
}, [activeView]);

  useEffect(() => {
    loadMemberMemberships();
  }, [gymData?.id, member.id]);
  
  // 🆕 FUNCIÓN PRINCIPAL: Manejar cancelación con gestión de deuda
  const handleCancelMembership = async (membershipId: string) => {
    const membership = memberships.find(m => m.id === membershipId);
    if (!membership) return;
    
    console.log('🔍 MEMBER DETAIL: Iniciando cancelación de membresía:', {
      membershipId,
      activityName: membership.activityName,
      paymentStatus: membership.paymentStatus,
      cost: membership.cost,
      status: membership.status
    });
    
    // 🚫 SI YA ESTÁ CANCELADA, NO HACER NADA
    if (membership.status === 'cancelled') {
      setError('Esta membresía ya está cancelada');
      return;
    }
    
    // 🆕 SIEMPRE MOSTRAR MODAL MEJORADO PARA MEMBRESÍAS ACTIVAS/EXPIRADAS
    setMembershipToCancel(membership);
    setShowCancellationModal(true);
  };

  // 🆕 FUNCIÓN: Ejecutar la cancelación con gestión de deuda
    const performCancellation = async (
      membership: MembershipAssignment, 
      debtAction: 'keep' | 'cancel', 
      reason: string
    ) => {
      if (!gymData?.id || !membership.id) return;
      
      try {
        setCancelling(true);
        setError('');
        
        console.log('🚀 MEMBER DETAIL: Ejecutando cancelación:', {
          membershipId: membership.id,
          debtAction,
          reason,
          paymentStatus: membership.paymentStatus,
          cost: membership.cost
        });
        
        await confirmMembershipCancellation(
          gymData.id,
          member.id,
          membership.id,
          debtAction,
          reason
        );
        
        setSuccess(`Membresía ${membership.activityName} cancelada exitosamente`);
        
        // 🔧 RECARGAR DATOS INMEDIATAMENTE
        await loadMemberMemberships();
        
        // Refrescar el componente padre si es necesario
        if (onRefreshMember) {
          onRefreshMember();
        }

        
        
      } catch (err: any) {
        console.error('❌ Error cancelando membresía:', err);
        setError(err.message || 'Error al cancelar la membresía');
      } finally {
        setCancelling(false);
        setShowCancellationModal(false);
        setMembershipToCancel(null);
      }
    };

  // 🔧 FUNCIÓN LEGACY PARA COMPATIBILIDAD CON MODAL ANTIGUO
  const handleDeleteMembership = async (withRefund: boolean) => {
    console.log('🔍 MEMBER DETAIL: Usando modal legacy con withRefund:', withRefund);
    
    if (!membershipToDelete || !gymData?.id) return;
    
    // 🔧 CONVERTIR A NUEVA LÓGICA
    const debtAction: 'keep' | 'cancel' = (() => {
      if (membershipToDelete.paymentStatus === 'paid' && withRefund) {
        return 'cancel'; // Reintegro = cancelar deuda
      } else if (membershipToDelete.paymentStatus === 'pending') {
        return withRefund ? 'cancel' : 'keep';
      } else {
        return 'keep';
      }
    })();
    
    const reason = withRefund ? 'Eliminación con reintegro' : 'Eliminación sin reintegro';
    
    await performCancellation(membershipToDelete, debtAction, reason);
    
    setIsDeleteModalOpen(false);
    setMembershipToDelete(null);
  };

  // 🆕 FUNCIÓN: Obtener información del estado de renovación
  const getRenewalInfo = (membership: MembershipAssignment) => {
    const info = [];
    
    if (membership.autoRenewal) {
      info.push({
        label: 'Auto-renovación',
        color: 'bg-blue-100 text-blue-800',
        icon: <RefreshCw size={10} />
      });
    }
    
    if (membership.renewedAutomatically) {
      info.push({
        label: membership.renewedManually ? 'Renovada (Manual)' : 'Renovada (Auto)',
        color: 'bg-green-100 text-green-800',
        icon: <RotateCcw size={10} />
      });
    }
    
    if (membership.previousMembershipId) {
      info.push({
        label: 'Es renovación',
        color: 'bg-purple-100 text-purple-800',
        icon: <History size={10} />
      });
    }
    
    return info;
  };

  // 🆕 COMPONENTE MEJORADO: Fila de membresía con lógica de iconos corregida
  const EnhancedMembershipRow: React.FC<{
    membership: MembershipAssignment;
    onCancel: (membershipId: string) => void;
  }> = ({ membership, onCancel }) => {
    const [showDetails, setShowDetails] = useState(false);
    
    const getStatusColor = (status: string) => {
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
    
    const getStatusText = (status: string) => {
      switch (status) {
        case 'active':
          return 'Activa';
        case 'expired':
          return 'Vencida';
        case 'cancelled':
          return 'Cancelada';
        default:
          return status;
      }
    };
    
const formatDate = (dateString: string) => {
  console.log('🔍 formatDate recibió:', dateString);
  try {
    if (!dateString) {
      console.log('❌ Fecha vacía');
      return 'Fecha no disponible';
    }
    
    if (dateString.includes('/')) {
      console.log('✅ Ya está en formato DD/MM/YYYY');
      return dateString;
    }
    
    const date = new Date(dateString + 'T12:00:00');
    console.log('📅 Fecha creada:', date);
    
    if (isNaN(date.getTime())) {
      console.log('❌ Fecha inválida');
      return 'Fecha inválida';
    }
    
    const formatted = date.toLocaleDateString('es-AR');
    console.log('✅ Fecha formateada:', formatted);
    return formatted;
  } catch (error) {
    console.error('💥 Error formateando fecha:', error);
    return 'Fecha inválida';
  }
};

    
    const isExpired = () => {
      const today = new Date();
      const endDate = new Date(membership.endDate);
      return endDate < today;
    };
    
    // 🆕 LÓGICA CORREGIDA PARA MOSTRAR BOTONES APROPIADOS
    const getActionButton = () => {
      if (membership.status === 'cancelled') {
        // 🚫 MEMBRESÍA YA CANCELADA - MOSTRAR COMO INFORMACIÓN SOLAMENTE
        return (
          <span className="text-xs text-gray-500 italic">
            Cancelada
          </span>
        );
      } else if (membership.status === 'active' || membership.status === 'expired') {
        // ✅ MEMBRESÍA ACTIVA O EXPIRADA - MOSTRAR BOTÓN DE CANCELAR
        return (
          <button
            onClick={() => onCancel(membership.id!)}
            className="text-red-600 hover:text-red-900 p-1"
            title="Cancelar membresía"
          >
            <Ban size={16} />
          </button>
        );
      }
      
      return null;
    };
    
    const renewalInfo = getRenewalInfo(membership);
    
    return (
      <>
        <tr className={`hover:bg-gray-50 ${membership.status === 'cancelled' ? 'opacity-60' : ''}`}>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {membership.activityName}
                </div>
                {membership.description && (
                  <div className="text-sm text-gray-500">
                    {membership.description.substring(0, 30)}
                    {membership.description.length > 30 && '...'}
                  </div>
                )}
              </div>
            </div>
          </td>
          
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatDate(membership.startDate)} - {formatDate(membership.endDate)}
          </div>
          <div className="text-sm text-gray-500">
            {(() => {
              // Verificar que las fechas existan
              if (!membership.startDate || !membership.endDate) {
                return 'Fechas no disponibles';
              }
              
              // Agregar tiempo para evitar problemas de timezone
              const start = new Date(membership.startDate + 'T12:00:00');
              const end = new Date(membership.endDate + 'T12:00:00');
              
              // Verificar que sean fechas válidas
              if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return 'Fechas inválidas';
              }
              
              // Calcular diferencia en días
              const diffTime = end.getTime() - start.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // Validar resultado
              if (isNaN(diffDays) || diffDays < 0) {
                return 'Cálculo inválido';
              }
              
              return `${diffDays} días`;
            })()}
          </div>
        </td>
          
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="space-y-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(membership.status)}`}>
                {getStatusText(membership.status)}
              </span>
              
              {/* Indicadores adicionales */}
              <div className="flex flex-wrap gap-1">
                {renewalInfo.map((info, index) => (
                  <span key={index} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${info.color}`}>
                    {info.icon}
                    <span className="ml-1">{info.label}</span>
                  </span>
                ))}
                
                {membership.status === 'active' && isExpired() && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-800">
                    <AlertTriangle size={10} className="mr-1" />
                    Vencida
                  </span>
                )}
              </div>
            </div>
          </td>
          
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">
              {membership.maxAttendances > 0 ? (
                <>
                  {membership.currentAttendances || 0} / {membership.maxAttendances}
                  <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ 
                        width: `${Math.min((membership.currentAttendances || 0) / membership.maxAttendances * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </>
              ) : (
                <span className="text-gray-500">Ilimitado</span>
              )}
            </div>
          </td>
          
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">
              ${membership.cost?.toLocaleString('es-AR') || '0'}
            </div>
            <div className="text-sm text-gray-500">
              {membership.paymentStatus === 'paid' ? (
                <span className="text-green-600">Pagada</span>
              ) : (
                <span className="text-red-600">Pendiente</span>
              )}
            </div>
          </td>
          
          <td className="px-6 py-4 whitespace-nowrap">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 hover:text-blue-900 text-sm"
            >
              {showDetails ? (
                <ChevronUp size={16} className="inline" />
              ) : (
                <ChevronDown size={16} className="inline" />
              )}
              {showDetails ? ' Ocultar' : ' Ver más'}
            </button>
          </td>
          
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div className="flex justify-end">
              {getActionButton()}
            </div>
          </td>
        </tr>
        
        {/* Fila de detalles expandida */}
        {showDetails && (
          <tr className="bg-gray-50">
            <td colSpan={7} className="px-6 py-4">
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Detalles de la Membresía</h5>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Creada:</span>
                    <p className="font-medium">
                      {membership.createdAt ? formatDate(membership.createdAt.toDate().toISOString()) : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Frecuencia de pago:</span>
                    <p className="font-medium">
                      {membership.paymentFrequency === 'monthly' ? 'Mensual' : 'Único'}
                    </p>
                  </div>
                  
                  {membership.previousMembershipId && (
                    <div>
                      <span className="text-gray-500">Renovación de:</span>
                      <p className="font-medium text-blue-600">
                        ID: {membership.previousMembershipId.slice(-8)}
                      </p>
                    </div>
                  )}
                  
                 {membership.renewedAt && (
                    <div>
                      <span className="text-gray-500">Renovada el:</span>
                      <p className="font-medium">
                        {formatDate(membership.renewedAt.toDate().toISOString())}
                      </p>
                    </div>
                  )}
                </div>
                
                {membership.description && (
                  <div>
                    <span className="text-gray-500 text-sm">Descripción:</span>
                    <p className="mt-1 text-sm text-gray-700">{membership.description}</p>
                  </div>
                )}
                
                {membership.cancelReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <span className="text-red-700 text-sm font-medium">Motivo de cancelación:</span>
                    <p className="mt-1 text-sm text-red-600">{membership.cancelReason}</p>
                    {(membership.cancelDate || membership.cancelledAt) && (
                      <p className="text-xs text-red-500 mt-1">
                        Cancelada el: {formatDate((membership.cancelDate || membership.cancelledAt).toDate().toISOString())}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  // Función para renderizar el contenido según la vista activa
  const renderActiveView = () => {
    switch (activeView) {
      case 'account':
        return (
               <MemberAccountStatement 
                  memberId={member.id}
                  memberName={`${member.firstName} ${member.lastName}`}
                  totalDebt={calculatedDebt} // Usar la deuda calculada actualizada
                  onPaymentClick={() => setActiveView('payment')}
                  onRefresh={loadMemberMemberships} // Agregar función de refresh
                  member={member}  
                />
              
        );
        case 'payment':
          return (
            <MemberPayment 
              member={member}
              onSuccess={async () => {
                setSuccess('Pago registrado correctamente');
                
                // 🔧 RECARGAR MEMBRESÍAS DESPUÉS DEL PAGO
                await loadMemberMemberships();
                
                // Cambiar a la vista de cuenta después de un pequeño delay
                setTimeout(() => {
                  setActiveView('account');
                  setSuccess(''); // Limpiar mensaje
                }, 1500);
                
                // Si hay función de refresh del componente padre, llamarla
                if (onRefreshMember) {
                  onRefreshMember();
                }
              }}
              onCancel={() => setActiveView('account')}
            />
          );
      case 'attendance':
        return <MemberAttendanceHistory member={member} />;
      case 'routines':
        return <MemberRoutinesTab memberId={member.id} memberName={`${member.firstName} ${member.lastName}`} />;

      case 'memberships':
        return (
          <div className="space-y-6">
            {/* Header con botón de acción */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Membresías del Socio</h3>
              <button
                onClick={() => onAssignMembership(member)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Asignar Nueva Membresía
              </button>
            </div>
            
            {/* Estadísticas mejoradas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Activas</p>
                    <p className="text-2xl font-semibold text-green-900">
                      {memberships.filter(m => m.status === 'active').length}
                    </p>
                    <p className="text-xs text-green-700">
                      {memberships.filter(m => m.status === 'active' && m.autoRenewal).length} con auto-renovación
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-red-600">Vencidas</p>
                    <p className="text-2xl font-semibold text-red-900">
                      {memberships.filter(m => m.status === 'expired').length}
                    </p>
                    <p className="text-xs text-red-700">
                      {memberships.filter(m => m.renewedAutomatically).length} fueron renovadas
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Pendientes de Pago</p>
                    <p className="text-2xl font-semibold text-yellow-900">
                      {memberships.filter(m => m.paymentStatus === 'pending' && m.status !== 'cancelled').length}
                    </p>
                    <p className="text-xs text-yellow-700">
                      Deuda: ${calculatedDebt.toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Ban className="h-8 w-8 text-gray-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Canceladas</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {memberships.filter(m => m.status === 'cancelled').length}
                    </p>
                    <p className="text-xs text-gray-700">historial</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de membresías mejorada */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-md font-medium text-gray-900">Historial Completo de Membresías</h4>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : memberships.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin membresías</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Este socio no tiene membresías asignadas aún.
                  </p>
                  <button
                    onClick={() => onAssignMembership(member)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Asignar Primera Membresía
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actividad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Período
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Asistencias
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Costo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Detalles
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {memberships
                        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                        .map((membership) => (
                          <EnhancedMembershipRow 
                            key={membership.id}
                            membership={membership}
                            onCancel={handleCancelMembership}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'details':
      default:
        return (
          <div className="space-y-6">
            {/* Información Personal */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Información Personal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                {/* ⭐ AGREGAR NÚMERO Y DNI */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Número de Socio</h4>
                  <p className="text-lg font-bold text-blue-600">
                    #{member.memberNumber || 'Sin asignar'}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">DNI</h4>
                  <p className="text-lg font-semibold text-gray-900">
                    {member.dni || 'Sin especificar'}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Email</h4>
                  <p className="text-gray-900">{member.email || 'No disponible'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Teléfono</h4>
                  <p className="text-gray-900">{member.phone || 'No disponible'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Dirección</h4>
                  <p className="text-gray-900">{member.address || 'No disponible'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Fecha de Nacimiento</h4>
                  <p className="text-gray-900">{formatDisplayDateFixed(member.birthDate)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Estado</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {member.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

            {hasFingerprint && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Fingerprint size={14} className="mr-1" />
                    Huella Registrada
                  </span>
                </div>
              )}

             {/* ✅ SECCIÓN: Contacto de Emergencia - EXPANDIBLE */}
              {(member.emergencyContactName || member.emergencyContactPhone) && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('emergency')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Contacto de Emergencia</h3>
                        <p className="text-xs text-gray-500">
                          {expandedSections.emergency ? 'Clic para ocultar' : 'Clic para ver detalles'}
                        </p>
                      </div>
                    </div>
                    {expandedSections.emergency ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedSections.emergency && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-orange-50/30 space-y-3">
                      {member.emergencyContactName && (
                        <div className="flex items-start space-x-3">
                          <User className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-500">Nombre</p>
                            <p className="text-sm text-gray-900">{member.emergencyContactName}</p>
                          </div>
                        </div>
                      )}
                      
                      {member.emergencyContactPhone && (
                        <div className="flex items-start space-x-3">
                          <Phone className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-500">Teléfono</p>
                            <p className="text-sm text-gray-900">{member.emergencyContactPhone}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ✅ SECCIÓN: Información de Salud - EXPANDIBLE */}
              {(member.hasExercisedBefore || member.fitnessGoal || member.medicalConditions || 
                member.injuries || member.allergies || member.hasMedicalCertificate) && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('health')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Heart className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Información de Salud y Fitness</h3>
                        <p className="text-xs text-gray-500">
                          {expandedSections.health ? 'Clic para ocultar' : 'Clic para ver detalles'}
                        </p>
                      </div>
                    </div>
                    {expandedSections.health ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedSections.health && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-green-50/30 space-y-4">
                      {/* Experiencia previa */}
                      {member.hasExercisedBefore && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">¿Ha realizado ejercicio antes?</p>
                          <p className="text-sm text-gray-900">
                            {member.hasExercisedBefore === 'yes' ? '✓ Sí' : '✗ No'}
                          </p>
                        </div>
                      )}
                      
                      {/* Objetivos de fitness */}
                      {member.fitnessGoal && member.fitnessGoal.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">Objetivos de fitness</p>
                          <div className="flex flex-wrap gap-2">
                            {member.fitnessGoal.map((goal, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                              >
                                {goal === 'weight_loss' && 'Pérdida de peso'}
                                {goal === 'muscle_gain' && 'Aumento de masa muscular'}
                                {goal === 'resistance' && 'Mejorar resistencia'}
                                {goal === 'flexibility' && 'Flexibilidad'}
                                {goal === 'health' && 'Salud general'}
                                {goal === 'other' && (member.fitnessGoalOther || 'Otro')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Condiciones médicas */}
                      {member.medicalConditions && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Condiciones médicas</p>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{member.medicalConditions}</p>
                        </div>
                      )}
                      
                      {/* Lesiones */}
                      {member.injuries && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Lesiones o limitaciones</p>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{member.injuries}</p>
                        </div>
                      )}
                      
                      {/* Alergias */}
                      {member.allergies && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Alergias</p>
                          <p className="text-sm text-gray-900 whitespace-pre-line">{member.allergies}</p>
                        </div>
                      )}
                      
                      {/* Certificado médico */}
                      {member.hasMedicalCertificate && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Certificado médico</p>
                          <p className="text-sm text-gray-900">
                            {member.hasMedicalCertificate === 'yes' ? '✓ Tiene certificado' : '✗ No tiene certificado'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Información Financiera */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Información Financiera</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Deuda Total</h4>
                  <p className={`text-2xl font-bold ${calculatedDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(calculatedDebt)}
                  </p>
                  {calculatedDebt > 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      {memberships.filter(m => m.paymentStatus === 'pending' && m.status !== 'cancelled').length} membresía(s) pendiente(s)
                    </p>
                  )}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Última Asistencia</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {member.lastAttendance ? formatDisplayDateFixed(member.lastAttendance) : 'Nunca'}
                  </p>
                </div>
              </div>
            </div>

            {/* Membresías Activas Resumidas */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Membresías Activas</h3>
                <button
                  onClick={() => setActiveView('memberships')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver todas las membresías
                </button>
              </div>
              
              {memberships.filter(m => m.status === 'active').length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>No hay membresías activas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships
                    .filter(m => m.status === 'active')
                    .slice(0, 3)
                    .map((membership) => (
                      <div key={membership.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium text-green-900">{membership.activityName}</h4>
                            <div className="flex space-x-2 text-sm text-green-700">
                                <span>
                                  {membership.maxAttendances && membership.maxAttendances > 0 
                                    ? `${membership.currentAttendances || 0}/${membership.maxAttendances} asistencias`
                                    : 'Asistencias ilimitadas'
                                  }
                                </span>
                              {membership.autoRenewal && (
                                <span className="flex items-center">
                                  <RefreshCw size={12} className="mr-1" />
                                  Auto-renovación
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-600 font-medium">
                              {formatCurrency(membership.cost || 0)}
                            </div>
                            <div className="text-xs text-green-600">
                              {membership.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header con información básica */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {member.photo ? (
              <img 
                src={member.photo} 
                alt={`${member.firstName} ${member.lastName}`} 
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                <div className="text-blue-600 font-medium text-xl">
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                {/* ⭐ MOSTRAR NÚMERO DE SOCIO */}
                <div className="text-sm text-gray-500 mb-1">
                  Socio #{member.memberNumber || 'Sin número'}
                </div>
                
                <h1 className="text-2xl font-bold">
                  {member.firstName} {member.lastName}
                </h1>
                
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {member.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        (member.totalDebt && member.totalDebt > 0) || calculatedDebt > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {(member.totalDebt && member.totalDebt > 0) || calculatedDebt > 0
                          ? `Deuda: ${formatCurrency(member.totalDebt || calculatedDebt)}`
                          : 'Sin deuda'
                        }
                      </span>
                </div>
              </div>
              
              <div className="flex mt-4 md:mt-0 space-x-2">
                <button 
                  onClick={() => onEdit(member)}
                  className="px-3 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Edit size={16} className="mr-1" />
                  Editar
                </button>
                <button 
                  onClick={() => onDelete(member.id)}
                  className="px-3 py-1 border border-gray-300 rounded text-red-600 hover:bg-red-50 flex items-center"
                >
                  <Trash size={16} className="mr-1" />
                  Eliminar
                </button>.

                 <button
                    onClick={() => setShowFingerprintEnrollment(true)}
                    className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
                      hasFingerprint
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <Fingerprint size={18} className="mr-2" />
                    {hasFingerprint ? 'Actualizar Huella' : 'Registrar Huella'}
                  </button>
                  
                  {hasFingerprint && (
                    <button
                      onClick={handleDeleteFingerprint}
                      className="flex items-center px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={18} className="mr-2" />
                      Eliminar Huella
                    </button>
                  )}
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {/* ⭐ MOSTRAR DNI */}
              <div className="flex items-center">
                <User size={16} className="text-gray-400 mr-2" />
                <span className="text-gray-500 mr-2">DNI:</span>
                <span className="font-medium">{member.dni || 'Sin especificar'}</span>
              </div>
              
              <div className="flex items-center">
                <Mail size={16} className="text-gray-400 mr-2" />
                <span>{member.email || 'No disponible'}</span>
              </div>
              
              <div className="flex items-center">
                <Phone size={16} className="text-gray-400 mr-2" />
                <span>{member.phone || 'No disponible'}</span>
              </div>
              
              <div className="flex items-center">
                <MapPin size={16} className="text-gray-400 mr-2" />
                <span>{member.address || 'No disponible'}</span>
              </div>
              
              <div className="flex items-center">
                <Calendar size={16} className="text-gray-400 mr-2" />
                <span>{formatDisplayDateFixed(member.birthDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Menú de navegación */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap">
          <button 
            onClick={() => setActiveView('details')}
            className={`flex-1 text-center py-3 px-4 text-sm font-medium ${activeView === 'details' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'} flex items-center justify-center`}
          >
            <User size={18} className="mr-2" />
            Detalles
          </button>
          
          <button 
            onClick={() => setActiveView('memberships')}
            className={`flex-1 text-center py-3 px-4 text-sm font-medium ${activeView === 'memberships' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'} flex items-center justify-center`}
          >
            <CreditCard size={18} className="mr-2" />
            Membresías
          </button>
          
          <button 
            onClick={() => setActiveView('routines')}
            className={`flex-1 text-center py-3 px-4 text-sm font-medium ${activeView === 'routines' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'} flex items-center justify-center`}
          >
            <Dumbbell size={18} className="mr-2" />
            Rutinas
          </button>
          
           <button 
            onClick={() => setActiveView('account')}
            className={`flex-1 text-center py-3 px-4 text-sm font-medium ${activeView === 'account' || activeView === 'payment' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'} flex items-center justify-center`}
          >
            <FileText size={18} className="mr-2" />
            Cuenta
          </button>
          
          <button 
            onClick={() => setActiveView('attendance')}
            className={`flex-1 text-center py-3 px-4 text-sm font-medium ${activeView === 'attendance' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'} flex items-center justify-center`}
          >
            <History size={18} className="mr-2" />
            Asistencias
          </button>
        </div>
      </div>
      
      {/* Contenido según la vista activa */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
            <CheckCircle size={18} className="mr-2" />
            {success}
          </div>
        )}
        
        {renderActiveView()}
      </div>
      
      {/* 🆕 MODAL DE CANCELACIÓN MEJORADO - PRINCIPAL */}
      {showCancellationModal && membershipToCancel && (
        <MembershipCancellationModal
          isOpen={showCancellationModal}
          membership={membershipToCancel}
          memberName={`${member.firstName} ${member.lastName}`}
          onConfirm={(debtAction, reason) => performCancellation(membershipToCancel, debtAction, reason)}
          onCancel={() => {
            setShowCancellationModal(false);
            setMembershipToCancel(null);
          }}
          loading={cancelling}
        />
      )}

      {showFingerprintEnrollment && gymData?.id && (
        <FingerprintEnrollment
          gymId={gymData.id}
          memberId={member.id}
          memberName={`${member.firstName} ${member.lastName}`}
          onSuccess={() => {
            setShowFingerprintEnrollment(false);
            setHasFingerprint(true);
            onRefreshMember?.();
            alert('¡Huella registrada correctamente!');
          }}
          onCancel={() => setShowFingerprintEnrollment(false)}
        />
      )}
      
      {/* 🔧 MODAL LEGACY - SOLO PARA CASOS DE COMPATIBILIDAD */}
      {isDeleteModalOpen && membershipToDelete && (
        <DeleteMembershipModal
          membershipName={membershipToDelete.activityName}
          isPaid={membershipToDelete.paymentStatus === 'paid'}
          memberName={`${member.firstName} ${member.lastName}`}
          onConfirm={handleDeleteMembership}
          onCancel={() => {
            setIsDeleteModalOpen(false);
            setMembershipToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default MemberDetail;