// src/pages/superadmin/GlobalExercises.tsx
import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import GlobalExerciseList from '../../components/superadmin/GlobalExerciseList';
import GlobalExerciseForm from '../../components/superadmin/GlobalExerciseForm';
import GlobalExerciseDetail from '../../components/superadmin/GlobalExerciseDetail';
import { GlobalExercise } from '../../types/global-exercise.types';
import { createGlobalExercise, updateGlobalExercise, deleteGlobalExercise } from '../../services/global-exercise.service';
import { uploadToCloudinary } from '../../utils/cloudinary.utils';

type ViewType = 'list' | 'form' | 'detail';

const GlobalExercises: React.FC = () => {
  const [view, setView] = useState<ViewType>('list');
  const [selectedExercise, setSelectedExercise] = useState<GlobalExercise | null>(null);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleNewExercise = () => {
    setSelectedExercise(null);
    setIsEdit(false);
    setView('form');
  };
  
  const handleEditExercise = (exercise: GlobalExercise) => {
    setSelectedExercise(exercise);
    setIsEdit(true);
    setView('form');
  };
  
  const handleViewExercise = (exercise: GlobalExercise) => {
    setSelectedExercise(exercise);
    setView('detail');
  };
  
  const handleDeleteExercise = async (exercise: GlobalExercise) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el ejercicio "${exercise.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await deleteGlobalExercise(exercise.id);
      setView('list');
      setSelectedExercise(null);
      setSuccess('Ejercicio eliminado correctamente');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting global exercise:', err);
      setError(err.message || 'Error al eliminar el ejercicio');
    } finally {
      setLoading(false);
    }
  };
  
const handleSaveExercise = async (exerciseData: Omit<GlobalExercise, 'id'>, imageFile?: File) => {
  setLoading(true);
  setError(null);
  
  try {
    // Procesar la imagen si hay una nueva
    let imageUrl = exerciseData.image;
    
    if (imageFile) {
      try {
        imageUrl = await uploadToCloudinary(imageFile, 'global-exercises');
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        imageUrl = undefined; // Usar undefined en lugar de null
      }
    }
    
    // Preparar datos para guardar
    const dataToSave = {
      ...exerciseData,
      image: imageUrl,
      // No necesitamos forzar conversiones aquí ya que los datos vienen limpios del form
    };
    
    if (isEdit && selectedExercise) {
      // Actualizar ejercicio existente
      await updateGlobalExercise(selectedExercise.id, dataToSave);
      setSuccess('Ejercicio actualizado correctamente');
      
      // Actualizar el ejercicio seleccionado
      const updatedExercise: GlobalExercise = {
        ...selectedExercise,
        ...dataToSave,
        id: selectedExercise.id
      };
      
      setSelectedExercise(updatedExercise);
      setView('detail');
    } else {
      // Crear nuevo ejercicio
      const newExercise = await createGlobalExercise(dataToSave);
      setSuccess('Ejercicio creado correctamente');
      
      setSelectedExercise(newExercise);
      setView('detail');
    }
    
    setTimeout(() => setSuccess(null), 3000);
  } catch (err: any) {
    console.error('Error saving global exercise:', err);
    setError(err.message || 'Error al guardar el ejercicio');
  } finally {
    setLoading(false);
  }
};
  
  const renderView = () => {
    switch (view) {
      case 'form':
        return (
          <GlobalExerciseForm
            initialData={selectedExercise || undefined}
            isEdit={isEdit}
            onSave={handleSaveExercise}
            onCancel={() => selectedExercise ? setView('detail') : setView('list')}
          />
        );
      case 'detail':
        if (!selectedExercise) return null;
        return (
          <GlobalExerciseDetail
            exercise={selectedExercise}
            onBack={() => setView('list')}
            onEdit={handleEditExercise}
            onDelete={handleDeleteExercise}
          />
        );
      case 'list':
      default:
        return (
          <GlobalExerciseList
            onNewExercise={handleNewExercise}
            onEditExercise={handleEditExercise}
            onViewExercise={handleViewExercise}
          />
        );
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Ejercicios Globales</h1>
      
      {/* Breadcrumbs */}
      <div className="mb-6 flex items-center text-sm text-gray-600">
        <span 
          className={`${view === 'list' ? 'font-medium text-blue-600' : 'cursor-pointer hover:text-blue-600'}`}
          onClick={() => setView('list')}
        >
          Ejercicios Globales
        </span>
        
        {view !== 'list' && (
          <>
            <span className="mx-2">/</span>
            <span 
              className={view === 'detail' ? 'font-medium text-blue-600' : ''}
            >
              {view === 'form' 
                ? (isEdit ? 'Editar Ejercicio' : 'Nuevo Ejercicio') 
                : selectedExercise?.name
              }
            </span>
            
            {view === 'form' && isEdit && selectedExercise && (
              <>
                <span className="mx-2">/</span>
                <span>{selectedExercise.name}</span>
              </>
            )}
          </>
        )}
      </div>
      
      {/* Mensajes de error y éxito */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
          {success}
        </div>
      )}
      
      {/* Contenido principal */}
      {loading && view !== 'list' ? (
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

export default GlobalExercises;