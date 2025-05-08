// src/pages/exercises/Exercises.tsx
import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import ExerciseList from '../../components/exercises/ExerciseList';
import ExerciseForm from '../../components/exercises/ExerciseForm';
import ExerciseDetail from '../../components/exercises/ExerciseDetail';
import { Exercise } from '../../types/exercise.types';
import { createExercise, updateExercise, deleteExercise } from '../../services/exercise.service';
import useAuth from '../../hooks/useAuth';
import { uploadToCloudinary } from '../../utils/cloudinary.utils';

type ViewType = 'list' | 'form' | 'detail';

const Exercises: React.FC = () => {
  const { gymData } = useAuth();
  
  const [view, setView] = useState<ViewType>('list');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleNewExercise = () => {
    setSelectedExercise(null);
    setIsEdit(false);
    setView('form');
  };
  
  const handleEditExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setIsEdit(true);
    setView('form');
  };
  
  const handleViewExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setView('detail');
  };
  
  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await deleteExercise(gymData.id, exercise.id);
      setView('list');
      setSelectedExercise(null);
      setSuccess('Ejercicio eliminado correctamente');
      
      // Reset success message after a few seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting exercise:', err);
      setError(err.message || 'Error al eliminar el ejercicio');
    } finally {
      setLoading(false);
    }
  };
  

// En la página Exercises.tsx, modifica la función handleSaveExercise

const handleSaveExercise = async (exerciseData: any, imageFile?: File) => {
  if (!gymData?.id) {
    setError('No se pudo obtener la información del gimnasio');
    return;
  }
  
  setLoading(true);
  setError(null);
  
  try {
    // Procesar la imagen si hay una nueva
    let imageUrl = exerciseData.image || null;
    
    if (imageFile) {
      try {
        imageUrl = await uploadToCloudinary(imageFile, `gyms/${gymData.id}/exercises`);
      } catch (err) {
        console.error('Error uploading image:', err);
        imageUrl = null;
      }
    }
    
    // Crear un objeto limpio con solo los campos necesarios y sin undefined
    const cleanData = {
      name: exerciseData.name,
      description: exerciseData.description,
      muscleGroup: exerciseData.muscleGroup,
      difficulty: exerciseData.difficulty,
      instructions: exerciseData.instructions,
      isActive: exerciseData.isActive !== undefined ? exerciseData.isActive : true,
      // Usar null explícitamente para campos opcionales
      image: imageUrl,
      video: exerciseData.video || null
    };
    
    if (isEdit && selectedExercise) {
      await updateExercise(gymData.id, selectedExercise.id, cleanData);
      setSuccess('Ejercicio actualizado correctamente');
      
      const updatedExercise: Exercise = {
        ...selectedExercise,
        ...cleanData,
        id: selectedExercise.id
      };
      
      setSelectedExercise(updatedExercise);
      setView('detail');
    } else {
      const newExercise = await createExercise(gymData.id, cleanData);
      setSuccess('Ejercicio creado correctamente');
      setSelectedExercise(newExercise);
      setView('detail');
    }
    
    setTimeout(() => setSuccess(null), 3000);
  } catch (err: any) {
    console.error('Error saving exercise:', err);
    setError(err.message || 'Error al guardar el ejercicio');
  } finally {
    setLoading(false);
  }
};


  const renderView = () => {
    switch (view) {
      case 'form':
        return (
          <ExerciseForm
            initialData={selectedExercise || undefined}
            isEdit={isEdit}
            onSave={handleSaveExercise}
            onCancel={() => selectedExercise ? setView('detail') : setView('list')}
          />
        );
      case 'detail':
        if (!selectedExercise) return null;
        return (
          <ExerciseDetail
            exercise={selectedExercise}
            onBack={() => setView('list')}
            onEdit={handleEditExercise}
            onDelete={handleDeleteExercise}
          />
        );
      case 'list':
      default:
        return (
          <ExerciseList
            onNewExercise={handleNewExercise}
            onEditExercise={handleEditExercise}
            onViewExercise={handleViewExercise}
          />
        );
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Ejercicios</h1>
      
      {/* Migas de pan (breadcrumbs) */}
      <div className="mb-6 flex items-center text-sm text-gray-600">
        <span 
          className={`${view === 'list' ? 'font-medium text-blue-600' : 'cursor-pointer hover:text-blue-600'}`}
          onClick={() => setView('list')}
        >
          Ejercicios
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

export default Exercises;