// src/components/members/MemberDetail.tsx - CORREGIDO TIMEZONE

import React, { useState, useEffect } from 'react';
import { Member } from '../../types/member.types';
import { MembershipAssignment } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { firebaseDateToHtmlDate } from '../../utils/date.utils'; // ✅ NUEVA IMPORTACIÓN
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
  const [activeView, setActiveView] = useState<'details' | 'memberships' | 'account' | 'attendance' | 'payment' | 'routines'>('details');
  const [memberships, setMemberships] = useState<MembershipAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  const [membershipToDelete, setMembershipToDelete] = useState<MembershipAssignment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // ✅ FUNCIÓN CORREGIDA PARA FORMATEAR FECHAS SIN PROBLEMAS DE TIMEZONE
  const formatDisplayDateFixed = (dateInput: any): string => {
    if (!dateInput) return 'No disponible';
    
    // Usar firebaseDateToHtmlDate para obtener la fecha exacta sin cambios de timezone
    const htmlDate = firebaseDateToHtmlDate(dateInput);
    
    if (!htmlDate) return 'No disponible';
    
    // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
    const [year, month, day] = htmlDate.split('-');
    return `${day}/${month}/${year}`;
  };
  
  // Cargar membresías del socio
  useEffect(() => {
    const fetchMemberships = async () => {
      if (!gymData?.id || !member.id) return;
      
      setLoading(true);
      try {
        // ✅ CORRECCIÓN: Verificar que la función está siendo llamada correctamente
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
  
  // Función para calcular porcentaje de asistencias
  const calculateAttendancePercentage = (current: number, max: number): number => {
    if (max <= 0) return 0;
    return Math.round((current / max) * 100);
  };

  // Función para formatear el estado de pago
  const getPaymentStatusColor = (status: string): string => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status: string): string => {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'pending': return 'Pendiente';
      case 'overdue': return 'Vencido';
      default: return status;
    }
  };

  // Función para manejar la eliminación de membresía
  const handleDeleteMembership = async () => {
    if (!membershipToDelete || !gymData?.id) return;
    
    try {
      await deleteMembership(gymData.id, member.id, membershipToDelete.id || '', false); // ✅ CORRECTO - 4 parámetros
      setMemberships(prev => prev.filter(m => m.id !== membershipToDelete.id));
      setSuccess('Membresía eliminada correctamente');
      setIsDeleteModalOpen(false);
      setMembershipToDelete(null);
      
      if (onRefreshMember) {
        onRefreshMember();
      }
    } catch (error) {
      console.error('Error deleting membership:', error);
      setError('Error al eliminar la membresía');
    }
  };

  // Función para renderizar el contenido según la vista activa
  const renderActiveView = () => {
    switch (activeView) {
      case 'account':
        return (
          <MemberAccountStatement
            memberId={member.id}
            memberName={`${member.firstName} ${member.lastName}`}
            totalDebt={member.totalDebt}
            onPaymentClick={() => setActiveView('payment')} // ✅ RESTAURAR FUNCIONALIDAD
          />
        );
      case 'payment':
        return (
          <MemberPayment 
            member={member}
            onSuccess={() => {
              setSuccess('Pago registrado correctamente');
              setActiveView('account');
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
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Membresías del Socio</h3>
              <button
                onClick={() => onAssignMembership(member)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                Asignar Membresía
              </button>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : memberships.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard size={48} className="mx-auto mb-2 text-gray-300" />
                <p>Este socio no tiene membresías asignadas</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {memberships.map((membership) => (
                  <div key={membership.id} className="bg-white border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div>
                        <h4 className="font-medium">{membership.activityName}</h4>
                        <p className="text-sm text-gray-600">{membership.activityName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getPaymentStatusColor(membership.paymentStatus)}`}>
                          {getPaymentStatusText(membership.paymentStatus)}
                        </span>
                        {membership.paymentStatus !== 'paid' && (
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
                  <p>{formatDisplayDateFixed(member.birthDate)}</p>
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

            {/* Información Financiera */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Información Financiera</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Deuda Total</h4>
                  <p className={`text-2xl font-bold ${member.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(member.totalDebt)}
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Última Asistencia</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {member.lastAttendance ? formatDisplayDateFixed(member.lastAttendance) : 'Nunca'}
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
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver todas las membresías
                </button>
              </div>
              
              {memberships.filter(m => m.paymentStatus === 'paid').length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>No hay membresías activas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships
                    .filter(m => m.paymentStatus === 'paid')
                    .slice(0, 3)
                    .map((membership) => (
                      <div key={membership.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium text-green-900">{membership.activityName}</h4>
                            <p className="text-sm text-green-700">{membership.activityName}</p>
                          </div>
                          <span className="text-green-600 font-medium">
                            {membership.currentAttendances}/{membership.maxAttendances}
                          </span>
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