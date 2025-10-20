// src/pages/members/Members.tsx - VERSIÓN CORREGIDA
// ✅ NUEVO: Ahora captura el memberId desde la navegación y abre el detalle automáticamente

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // ✅ AGREGADO
import MemberList from '../../components/members/MemberList';
import MemberForm from '../../components/members/MemberForm';
import MemberDetail from '../../components/members/MemberDetail';
import MemberQR from '../../components/members/MemberQR';
import MemberPayment from '../../components/members/MemberPayment';
import MembershipForm from '../../components/memberships/MembershipForm';
import { Member } from '../../types/member.types';
import { addMember, updateMember } from '../../services/member.service';
import useFirestore from '../../hooks/useFirestore';
import useAuth from '../../hooks/useAuth';
import { AlertCircle, CheckCircle } from 'lucide-react';

import { firebaseDateToHtmlDate } from '../../utils/date.utils';
type ViewType = 'list' | 'form' | 'detail' | 'qr' | 'membership' | 'payment';


const Members: React.FC = () => {
  const { gymData } = useAuth();
  const membersFirestore = useFirestore<Member>('members');
  const location = useLocation(); // ✅ AGREGADO
  
  const [view, setView] = useState<ViewType>('list');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // ✅ NUEVO: Detectar si venimos de otra página con un memberId
  useEffect(() => {
    const loadMemberFromNavigation = async () => {
      const state = location.state as { memberId?: string; activeTab?: string } | null;
      
      console.log('📍 Members.tsx - State recibido:', state);
      
      if (state?.memberId && gymData?.id) {
        setLoading(true);
        try {
          const member = await membersFirestore.getById(state.memberId);
          
          if (member) {
            console.log('👤 Socio cargado:', member.firstName, member.lastName);
            setSelectedMember(member);
            setView('detail');
            
            // Verificar sessionStorage
            const savedTab = sessionStorage.getItem('memberDetailActiveTab');
            console.log('💾 Tab en sessionStorage antes de mostrar detalle:', savedTab);
            
            // Limpiar el state de navegación
            window.history.replaceState({}, document.title);
          } else {
            setError('Socio no encontrado');
          }
        } catch (err) {
          console.error('Error cargando socio:', err);
          setError('Error al cargar los datos del socio');
        } finally {
          setLoading(false);
        }
      }
    };

    loadMemberFromNavigation();
  }, [location.state, gymData?.id]);
  
  // Limpiar mensajes después de un tiempo
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Funciones para manejar navegación entre componentes
  const handleNewMember = () => {
    setIsEdit(false);
    setSelectedMember(null);
    setError('');
    setSuccess('');
    setView('form');
  };
  
  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setIsEdit(true);
    setError('');
    setSuccess('');
    setView('form');
  };
  
  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setError('');
    setSuccess('');
    setView('detail');
  };
  
  const handleGenerateQR = (member: Member) => {
    setSelectedMember(member);
    setError('');
    setSuccess('');
    setView('qr');
  };
  
  const handleAssignMembership = (member: Member) => {
    setSelectedMember(member);
    setError('');
    setSuccess('');
    setView('membership');
  };
  
  const handleRegisterPayment = (member: Member) => {
    setSelectedMember(member);
    setError('');
    setSuccess('');
    setView('payment');
  };
  
  // Manejar eliminación de socio
  const handleDeleteMember = async (memberId: string) => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await membersFirestore.remove(memberId);
      
      if (result) {
        setSuccess('Socio eliminado correctamente');
        
        // Si eliminamos el socio que estamos viendo, volver a la lista
        if (selectedMember?.id === memberId) {
          setSelectedMember(null);
          setView('list');
        }
      } else {
        throw new Error('No se pudo eliminar el socio');
      }
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setError(err.message || 'Error al eliminar el socio');
    } finally {
      setLoading(false);
    }
  };
  
  // Manejar guardado de socio (nuevo o editado) - USANDO LOS SERVICIOS ORIGINALES
  const handleSaveMember = async (formData: any) => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log("Guardando socio:", formData);
      
      if (isEdit && selectedMember) {
        // Actualizar socio existente
        await updateMember(gymData.id, selectedMember.id, formData);
        setSuccess('Socio actualizado correctamente');
        
        // Recargar el socio actualizado
        await reloadSelectedMember();
      } else {
        // ✅ FIX: addMember retorna el Member completo, no solo el ID
        const newMember = await addMember(gymData.id, formData);
        
        if (!newMember) {
          throw new Error('No se pudo crear el socio');
        }
        
        setSuccess('Socio registrado correctamente');
        
        // Establecer el nuevo socio directamente (ya lo tenemos completo)
        setSelectedMember(newMember);
      }
      
      // Volver a la vista correcta
      setView(selectedMember ? 'detail' : 'list');
    } catch (err: any) {
      console.error('Error saving member:', err);
      setError(err.message || 'Error al guardar el socio');
    } finally {
      setLoading(false);
    }
  };

  // Recargar datos del socio seleccionado
  const reloadSelectedMember = async () => {
    if (!selectedMember?.id) return;
    
    try {
      const updatedMember = await membersFirestore.getById(selectedMember.id);
      if (updatedMember) {
        setSelectedMember(updatedMember);
      }
    } catch (err) {
      console.error('Error reloading member:', err);
    }
  };

  // Renderizar la vista apropiada según el estado
  const renderView = () => {
    switch (view) {
      case 'form':
        return (
          <MemberForm 
              initialData={selectedMember ? {
                firstName: selectedMember.firstName,
                lastName: selectedMember.lastName,
                email: selectedMember.email,
                phone: selectedMember.phone,
                address: selectedMember.address,
                birthDate: selectedMember.birthDate ? firebaseDateToHtmlDate(selectedMember.birthDate) : '',
                status: selectedMember.status,
                dni: selectedMember.dni || '',
                
                // Datos adicionales
                emergencyContactName: selectedMember.emergencyContactName || '',
                emergencyContactPhone: selectedMember.emergencyContactPhone || '',
                hasExercisedBefore: selectedMember.hasExercisedBefore || undefined,
                fitnessGoal: Array.isArray(selectedMember.fitnessGoal) ? 
                  selectedMember.fitnessGoal : [],
                fitnessGoalOther: selectedMember.fitnessGoalOther || '',
                medicalConditions: selectedMember.medicalConditions || '',
                injuries: selectedMember.injuries || '',
                allergies: selectedMember.allergies || '',
                hasMedicalCertificate: selectedMember.hasMedicalCertificate || undefined
                
              } : undefined}
              onSubmit={handleSaveMember}
              onCancel={() => setView(selectedMember ? 'detail' : 'list')}
              title={selectedMember ? 'Editar Socio' : 'Nuevo Socio'}
            />
        );
      case 'detail':
        if (!selectedMember) return null;
        return (
          <div className="space-y-6">
            <MemberDetail 
              member={selectedMember}
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
              onGenerateQr={handleGenerateQR}
              onAssignMembership={handleAssignMembership}
              onRefreshMember={reloadSelectedMember}
            />
          </div>
        );
      case 'qr':
        if (!selectedMember) return null;
        return (
          <MemberQR 
            member={selectedMember}
          />
        );
        case 'payment':
          if (!selectedMember) return null;
          // ✅ FIX: Guardar el ID en una constante para evitar errores de TypeScript
          const memberIdForPayment = selectedMember.id;
          const previousDebt = selectedMember.totalDebt;
          
          return (
            <MemberPayment 
              member={selectedMember}
              onSuccess={async () => {
                setSuccess('Pago registrado correctamente');
                
                // ✅ FIX: Recargar los datos del socio COMPLETOS
                try {
                  const updatedMember = await membersFirestore.getById(memberIdForPayment);
                  if (updatedMember) {
                    console.log('✅ Socio actualizado después de pago:', {
                      id: updatedMember.id,
                      nombre: `${updatedMember.firstName} ${updatedMember.lastName}`,
                      deudaAnterior: previousDebt,
                      deudaNueva: updatedMember.totalDebt
                    });
                    
                    // Actualizar el estado con los nuevos datos
                    setSelectedMember(updatedMember);
                  }
                } catch (error) {
                  console.error('Error recargando socio:', error);
                }
                
                // Volver a la vista de detalle
                setView('detail');
              }}
              onCancel={() => setView('detail')}
            />
          );
      case 'membership':
        if (!selectedMember) return null;
        return (
          <MembershipForm 
            memberId={selectedMember.id}
            memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
            onSave={() => {
              setSuccess('Membresía asignada correctamente');
              reloadSelectedMember();
              setView('detail');
            }}
            onCancel={() => setView('detail')}
          />
        );
      case 'list':
      default:
        return (
          <MemberList 
            onNewMember={handleNewMember}
            onViewMember={handleViewMember}
            onEditMember={handleEditMember}
            onDeleteMember={handleDeleteMember}
            onGenerateQr={handleGenerateQR}
            onRegisterPayment={handleRegisterPayment}
          />
        );
    }
  };
  
  return (
    <div className="p-6">
      {/* Mensajes de estado */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
          <AlertCircle size={20} className="mr-3" />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
          <CheckCircle size={20} className="mr-3" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="ml-auto text-green-700 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Cabecera de navegación */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {view === 'list' && 'Gestión de Socios'}
          {view === 'form' && (isEdit ? 'Editar Socio' : 'Nuevo Socio')}
          {view === 'detail' && 'Detalle de Socio'}
          {view === 'qr' && 'Código QR'}
          {view === 'membership' && 'Asignar Membresía'}
          {view === 'payment' && 'Registrar Pago'}
        </h1>
        
        {/* Migas de pan para navegación */}
        {view !== 'list' && (
          <nav className="text-sm text-blue-600 mt-1">
            <button 
              onClick={() => setView('list')}
              className="hover:text-blue-800"
            >
              Socios
            </button>
            {view !== 'form' && selectedMember && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <button 
                  onClick={() => setView('detail')}
                  className="hover:text-blue-800"
                >
                  {selectedMember.firstName} {selectedMember.lastName}
                </button>
              </>
            )}
            {view === 'form' && isEdit && selectedMember && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">Editar</span>
              </>
            )}
            {view === 'form' && !isEdit && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">Nuevo</span>
              </>
            )}
            {view === 'qr' && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">Código QR</span>
              </>
            )}
            {view === 'membership' && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">Asignar Membresía</span>
              </>
            )}
            {view === 'payment' && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-600">Registrar Pago</span>
              </>
            )}
          </nav>
        )}
      </div>
      
      {/* Contenido principal */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Procesando...</span>
        </div>
      ) : (
        renderView()
      )}
    </div>
  );
};

export default Members;