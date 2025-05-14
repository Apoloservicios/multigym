// src/pages/members/Members.tsx

import React, { useState, useEffect } from 'react';
import MemberList from '../../components/members/MemberList';
import MemberForm from '../../components/members/MemberForm';
import MemberDetail from '../../components/members/MemberDetail';
import MemberQR from '../../components/members/MemberQR';
import MemberPayment from '../../components/members/MemberPayment';
import MembershipForm from '../../components/memberships/MembershipForm';
import { Member } from '../../types/member.types';
import useFirestore from '../../hooks/useFirestore';
import useAuth from '../../hooks/useAuth';
import { AlertCircle } from 'lucide-react';

type ViewType = 'list' | 'form' | 'detail' | 'qr' | 'membership' | 'payment';

const Members: React.FC = () => {
  const { gymData } = useAuth();
  const membersFirestore = useFirestore<Member>('members');
  
  const [view, setView] = useState<ViewType>('list');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Funciones para manejar navegación entre componentes
  const handleNewMember = () => {
    setIsEdit(false);
    setSelectedMember(null);
    setView('form');
  };
  
  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setIsEdit(true);
    setView('form');
  };
  
  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setView('detail');
  };
  
  const handleGenerateQR = (member: Member) => {
    setSelectedMember(member);
    setView('qr');
  };
  
  const handleAssignMembership = (member: Member) => {
    setSelectedMember(member);
    setView('membership');
  };
  
  const handleRegisterPayment = (member: Member) => {
    setSelectedMember(member);
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
  
  // Manejar guardado de socio (nuevo o editado)
  // Reemplaza la función handleSaveMember:
const handleSaveMember = async (formData: any) => {
  if (!gymData?.id) return;
  
  setLoading(true);
  setError('');
  
  try {
    console.log("Recibidos datos para guardar:", formData);
    
    if (isEdit && selectedMember) {
      // Actualizar socio existente
      console.log("Actualizando socio existente ID:", selectedMember.id);
      
      // Llamar directamente al servicio
      const result = await updateMemberDirectly(gymData.id, selectedMember.id, formData);
      
      if (result) {
        console.log("Socio actualizado correctamente");
        // Actualizar selectedMember con los nuevos datos
        const updatedMember = await membersFirestore.getById(selectedMember.id);
        if (updatedMember) {
          setSelectedMember(updatedMember);
          setView('detail');
        } else {
          setSelectedMember(null);
          setView('list');
        }
      }
    } else {
      // Crear nuevo socio
      console.log("Creando nuevo socio");
      
      // Llamar directamente al servicio
      const newMember = await addMemberDirectly(gymData.id, formData);
      
      if (newMember) {
        console.log("Nuevo socio creado con ID:", newMember.id);
        setSelectedMember(newMember);
        setView('detail');
      }
    }
  } catch (err: any) {
    console.error('Error saving member:', err);
    setError(err.message || 'Error al guardar el socio');
  } finally {
    setLoading(false);
  }
};

// Añade estas funciones auxiliares:
const addMemberDirectly = async (gymId: string, memberData: any) => {
  try {
    // Si hay foto, subir a Cloudinary primero
    let photoUrl = null;
    if (memberData.photo) {
      try {
        console.log("Subiendo foto a Cloudinary...");
        const formData = new FormData();
        formData.append('file', memberData.photo);
        formData.append('upload_preset', 'sis_gimnasio'); // Tu preset de Cloudinary
        
        const cloudinaryResponse = await fetch(
          'https://api.cloudinary.com/v1_1/dqadslasl/image/upload', // Tu cloud_name de Cloudinary
          {
            method: 'POST',
            body: formData
          }
        );
        
        if (!cloudinaryResponse.ok) {
          throw new Error(`Error de Cloudinary: ${cloudinaryResponse.statusText}`);
        }
        
        const cloudinaryData = await cloudinaryResponse.json();
        photoUrl = cloudinaryData.secure_url;
        console.log("Foto subida exitosamente:", photoUrl);
      } catch (uploadError) {
        console.error("Error al subir foto:", uploadError);
        // Continuamos sin la foto
      }
    }
    
    // Preparar datos para Firestore (sin la foto original, usando la URL)
    const memberForFirestore = {
      ...memberData,
      photo: photoUrl,
      totalDebt: 0
    };
    
    // Eliminar el archivo de foto del objeto
    delete memberForFirestore.photo;
    
    // Ahora guardamos en Firestore
    const newMember = await membersFirestore.add({
      ...memberForFirestore,
      photo: photoUrl
    });
    
    return newMember;
  } catch (error) {
    console.error("Error en addMemberDirectly:", error);
    throw error;
  }
};

const updateMemberDirectly = async (gymId: string, memberId: string, memberData: any) => {
  try {
    // Si hay una nueva foto, subir a Cloudinary primero
    let photoUrl = undefined; // undefined significa que no se actualiza
    if (memberData.photo instanceof File) {
      try {
        console.log("Subiendo foto a Cloudinary...");
        const formData = new FormData();
        formData.append('file', memberData.photo);
        formData.append('upload_preset', 'sis_gimnasio'); // Tu preset de Cloudinary
        
        const cloudinaryResponse = await fetch(
          'https://api.cloudinary.com/v1_1/dqadslasl/image/upload', // Tu cloud_name de Cloudinary
          {
            method: 'POST',
            body: formData
          }
        );
        
        if (!cloudinaryResponse.ok) {
          throw new Error(`Error de Cloudinary: ${cloudinaryResponse.statusText}`);
        }
        
        const cloudinaryData = await cloudinaryResponse.json();
        photoUrl = cloudinaryData.secure_url;
        console.log("Foto subida exitosamente:", photoUrl);
      } catch (uploadError) {
        console.error("Error al subir foto:", uploadError);
        // Continuamos sin actualizar la foto
      }
    }
    
    // Preparar datos para actualizar (sin la foto original, usando la URL)
    const memberForUpdate: any = { ...memberData };
    
    // Eliminar el archivo de foto del objeto
    delete memberForUpdate.photo;
    
    // Solo incluir la foto si se subió con éxito
    if (photoUrl !== undefined) {
      memberForUpdate.photo = photoUrl;
    }
    
    // Ahora actualizamos en Firestore
    const result = await membersFirestore.update(memberId, memberForUpdate);
    
    return result;
  } catch (error) {
    console.error("Error en updateMemberDirectly:", error);
    throw error;
  }
};
  
  // Renderizado condicional según la vista actual
  const renderView = () => {
    switch (view) {
      case 'form':
        return (
          <MemberForm 
            isEdit={isEdit}
            initialData={selectedMember}
            onSave={handleSaveMember}
            onCancel={() => setView(selectedMember ? 'detail' : 'list')}
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
              onRefreshMember={async () => {
                // Recargar los datos del socio después de cualquier cambio
                try {
                  const updatedMember = await membersFirestore.getById(selectedMember.id);
                  if (updatedMember) {
                    setSelectedMember(updatedMember);
                  }
                } catch (err) {
                  console.error('Error recargando datos del socio:', err);
                }
              }}
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
        return (
          <MemberPayment 
            member={selectedMember}
            onSuccess={() => {
              // Recargar los datos del socio después del pago
              const reloadMember = async () => {
                if (!gymData?.id) return;
                
                try {
                  const updatedMember = await membersFirestore.getById(selectedMember.id);
                  if (updatedMember) {
                    setSelectedMember(updatedMember);
                  }
                } catch (err) {
                  console.error('Error reloading member:', err);
                }
              };
              
              reloadMember();
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
              // Recargar los datos del socio después de asignar membresía
              const reloadMember = async () => {
                if (!gymData?.id) return;
                
                try {
                  const updatedMember = await membersFirestore.getById(selectedMember.id);
                  if (updatedMember) {
                    setSelectedMember(updatedMember);
                  }
                } catch (err) {
                  console.error('Error reloading member:', err);
                }
              };
              
              reloadMember();
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
      {/* Mensaje de error */}
      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {/* Cabecera de navegación */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {view === 'list' && 'Socios'}
          {view === 'form' && (isEdit ? 'Editar Socio' : 'Nuevo Socio')}
          {view === 'detail' && 'Detalle de Socio'}
          {view === 'qr' && 'Código QR'}
          {view === 'membership' && 'Asignar Membresía'}
          {view === 'payment' && 'Registrar Pago'}
        </h1>
        
        {/* Migas de pan para navegación */}
        {view !== 'list' && (
          <nav className="text-sm text-blue-600 mt-1">
            <button onClick={() => setView('list')}>Socios</button>
            {view !== 'form' && selectedMember && (
              <>
                <span className="mx-2">/</span>
                <button onClick={() => setView('detail')}>
                  {selectedMember.firstName} {selectedMember.lastName}
                </button>
              </>
            )}
          </nav>
        )}
      </div>
      
      {/* Contenido principal */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando...</span>
        </div>
      ) : (
        renderView()
      )}
    </div>
  );
};

export default Members;