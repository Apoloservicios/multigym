// src/components/members/MemberDetail.tsx

import React, { useState, useEffect } from 'react';
import { Member } from '../../types/member.types';
import { MembershipAssignment } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import MemberAccountStatement from './MemberAccountStatement';
import MemberPayment from './MemberPayment';
import MemberAttendanceHistory from './MemberAttendanceHistory';
import MemberRoutinesTab from './MemberRoutinesTab';
import useAuth from '../../hooks/useAuth';
import { getMemberMemberships, deleteMembership } from '../../services/member.service';
import DeleteMembershipModal from '../memberships/DeleteMembershipModal';
import { Mail, Phone, Calendar, MapPin, Edit, Trash, QrCode, CreditCard, Plus, Clock, DollarSign, 
  ChevronDown, ChevronUp, FileText, History, User, Dumbbell, CheckCircle, AlertCircle } from 'lucide-react';

interface MemberDetailProps {
  member: Member;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
  onGenerateQr: (member: Member) => void;
  onAssignMembership: (member: Member) => void;
  onRefreshMember?: () => void; // ← AGREGAR ESTA LÍNEA si no existe
}

const MemberDetail: React.FC<MemberDetailProps> = ({ 
  member, 
  onEdit, 
  onDelete, 
  onGenerateQr, 
  onAssignMembership,
  onRefreshMember // ← AGREGAR ESTA LÍNEA si no existe
}) => {
  const { gymData } = useAuth();
  // Estado para controlar las diferentes vistas
  const [activeView, setActiveView] = useState<'details' | 'memberships' | 'account' | 'attendance' | 'payment' | 'routines'>('details');
  const [memberships, setMemberships] = useState<MembershipAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Estados para el modal de eliminación de membresía
  const [membershipToDelete, setMembershipToDelete] = useState<MembershipAssignment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // Cargar membresías del socio
  useEffect(() => {
    const fetchMemberships = async () => {
      if (!gymData?.id || !member.id) return;
      
      setLoading(true);
      try {
        const membershipData = await getMemberMemberships(gymData.id, member.id);
        setMemberships(membershipData);
      } catch (error) {
        console.error('Error loading memberships:', error);
        setError('Error al cargar las membresías del socio');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMemberships();
  }, [gymData?.id, member.id]);
  
  // Función mejorada para formatear fechas (cualquier tipo de fecha)
  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'No disponible';
    
    try {
      // Si es un objeto Timestamp de Firestore
      if (typeof dateInput === 'object' && 'seconds' in dateInput) {
        const date = new Date(dateInput.seconds * 1000);
        return date.toLocaleDateString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Si es un string o Date
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return 'Formato de fecha inválido';
      }
      
      return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateInput);
      return 'Error de formato';
    }
  };
  
  // Color según estado de la membresía
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Color según estado de pago
  const getPaymentStatusStyles = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Calcular porcentaje de asistencias
  const calculateAttendancePercentage = (current: number, max: number) => {
    if (!max) return 0;
    return Math.round((current / max) * 100);
  };
  
  // Función para manejar la eliminación
  const handleDeleteMembership = async (withRefund: boolean) => {
    if (!gymData?.id || !member.id || !membershipToDelete?.id) {
      setError('No se pudo procesar la solicitud');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await deleteMembership(gymData.id, member.id, membershipToDelete.id, withRefund);
      
      // Recargar todas las membresías actualizadas en lugar de simplemente filtrar la eliminada
      // Esto asegura que tengamos los estados actualizados de todas las membresías desde la BD
      const refreshedMemberships = await getMemberMemberships(gymData.id, member.id);
      setMemberships(refreshedMemberships);
      
      // Mostrar mensaje de éxito
      setSuccess(`Membresía ${membershipToDelete.activityName} cancelada exitosamente`);
      
      // Cerrar el modal
      setIsDeleteModalOpen(false);
      setMembershipToDelete(null);
      
      // Limpiar el mensaje de éxito después de un tiempo
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('Error cancelling membership:', error);
      setError(error.message || 'Error al cancelar la membresía');
      
      // Mantener el modal abierto en caso de error para que el usuario pueda intentarlo de nuevo
      setIsDeleteModalOpen(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Función para renderizar la vista activa
  const renderActiveView = () => {
    switch (activeView) {
      case 'account':
        return (
          <MemberAccountStatement 
            memberId={member.id} 
            memberName={`${member.firstName} ${member.lastName}`}
            totalDebt={member.totalDebt}
            onRegisterPayment={() => setActiveView('payment')}
          />
        );
      case 'payment':
        return (
          <MemberPayment 
            member={member}
            onSuccess={() => {
              // Actualizar datos y volver a la vista de cuenta
              setActiveView('account');
            }}
            onCancel={() => setActiveView('account')}
          />
        );
          case 'attendance':
            return (
              <MemberAttendanceHistory
                member={member}
                onClose={() => {
                  // Si setView está disponible en el scope:
                  // setView('detail');
                  // O si necesitas navegar hacia atrás:
                  window.history.back();
                  // O cualquier otra lógica que manejes para cerrar/volver
                }}
              />
            );
      case 'routines':
        return (
         <MemberRoutinesTab 
            memberId={member.id}
            memberName={`${member.firstName} ${member.lastName}`}
            onRefreshMember={onRefreshMember} 
          />
        );
      case 'memberships':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Membresías del Socio</h3>
              <button 
                onClick={() => onAssignMembership(member)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus size={18} className="mr-2" />
                Asignar Nueva Membresía
              </button>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : memberships.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <CreditCard size={24} className="text-gray-400" />
                </div>
                <h4 className="text-gray-600 text-sm font-medium">No hay membresías asignadas</h4>
                <button 
                  onClick={() => onAssignMembership(member)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Asignar Nueva Membresía
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {memberships.map((membership) => (
                  <div key={membership.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between">
                      <div>
                        <h3 className="font-medium">{membership.activityName}</h3>
                        <div className="flex items-center mt-1 space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(membership.status)}`}>
                            {membership.status === 'active' ? 'Activa' : 
                             membership.status === 'expired' ? 'Vencida' : 
                             membership.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusStyles(membership.paymentStatus)}`}>
                            {membership.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center mt-2 sm:mt-0">
                        <div className="text-sm text-gray-600 mr-4">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1" />
                            <span>{formatDate(membership.startDate)} - {formatDate(membership.endDate)}</span>
                          </div>
                          <div className="flex items-center mt-1">
                            <DollarSign size={14} className="mr-1" />
                            <span>{formatCurrency(membership.cost)}</span>
                          </div>
                        </div>
                        
                        {/* Mostrar botón de eliminar solo si la membresía no está ya cancelada */}
                        {membership.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setMembershipToDelete(membership);
                              setIsDeleteModalOpen(true);
                            }}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Cancelar membresía"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Asistencias: {membership.currentAttendances} de {membership.maxAttendances}</span>
                        <span>{calculateAttendancePercentage(membership.currentAttendances, membership.maxAttendances)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${calculateAttendancePercentage(membership.currentAttendances, membership.maxAttendances)}%` }}
                        ></div>
                      </div>
                      {membership.description && (
                        <p className="mt-2 text-sm text-gray-600">{membership.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Nombre Completo</h4>
                  <p>{member.firstName} {member.lastName}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Correo Electrónico</h4>
                  <p>{member.email || 'No especificado'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Teléfono</h4>
                  <p>{member.phone || 'No especificado'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Dirección</h4>
                  <p>{member.address || 'No especificado'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Fecha de Nacimiento</h4>
                  <p>{member.birthDate ? formatDate(member.birthDate) : 'No especificado'}</p>
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
            
            {/* Finanzas */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Información Financiera</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Deuda Total</h4>
                  <p className={`text-xl font-bold ${member.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(member.totalDebt)}
                  </p>
                  {member.totalDebt > 0 && (
                    <button 
                      onClick={() => setActiveView('payment')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <DollarSign size={16} className="mr-1" />
                      Registrar Pago
                    </button>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Última Asistencia</h4>
                  <p className="text-xl font-bold text-gray-700">
                    {member.lastAttendance ? formatDate(member.lastAttendance) : 'Nunca'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Membresías Activas */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Membresías Activas</h3>
                <button 
                  onClick={() => setActiveView('memberships')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Ver todas las membresías
                </button>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : memberships.filter(m => m.status === 'active').length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">No hay membresías activas</p>
                  <button 
                    onClick={() => onAssignMembership(member)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center mx-auto"
                  >
                    <Plus size={16} className="mr-1" />
                    Asignar Nueva Membresía
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships
                    .filter(m => m.status === 'active')
                    .map((membership) => (
                      <div key={membership.id} className="border rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{membership.activityName}</h4>
                          <p className="text-sm text-gray-500">
                            Vence: {formatDate(membership.endDate)}
                          </p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            membership.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {membership.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            {/* Acciones Rápidas */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button 
                  onClick={() => onGenerateQr(member)}
                  className="p-4 border rounded-lg hover:bg-gray-50 flex flex-col items-center justify-center"
                >
                  <QrCode size={24} className="mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Generar Código QR</span>
                </button>
                
                <button 
                  onClick={() => onAssignMembership(member)}
                  className="p-4 border rounded-lg hover:bg-gray-50 flex flex-col items-center justify-center"
                >
                  <Plus size={24} className="mb-2 text-green-600" />
                  <span className="text-sm font-medium">Asignar Membresía</span>
                </button>
                
                <button 
                  onClick={() => setActiveView('payment')}
                  className="p-4 border rounded-lg hover:bg-gray-50 flex flex-col items-center justify-center"
                >
                  <DollarSign size={24} className="mb-2 text-purple-600" />
                  <span className="text-sm font-medium">Registrar Pago</span>
                </button>
              </div>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Cabecera con información básica */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row">
          <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-6">
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
                <h1 className="text-2xl font-bold">
                  {member.firstName} {member.lastName}
                </h1>
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {member.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.totalDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {member.totalDebt > 0 ? 'Con deuda' : 'Sin deuda'}
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
                </button>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
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
                <span>{member.birthDate ? formatDate(member.birthDate) : 'No disponible'}</span>
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
      
      {/* Modal de eliminación de membresía */}
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