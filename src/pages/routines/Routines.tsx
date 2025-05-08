// src/pages/routines/Routines.tsx (actualizado)
import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import RoutineList from '../../components/routines/RoutineList';
import RoutineForm from '../../components/routines/RoutineForm';
import RoutineDetail from '../../components/routines/RoutineDetail';
import { Routine } from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';
import { createRoutine, updateRoutine, deleteRoutine, duplicateRoutine } from '../../services/routine.service';

type ViewType = 'list' | 'form' | 'detail' | 'duplicate';

const Routines: React.FC = () => {
  const { gymData } = useAuth();
  
  const [view, setView] = useState<ViewType>('list');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleNewRoutine = () => {
    setSelectedRoutine(null);
    setIsEdit(false);
    setView('form');
  };
  
  const handleEditRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    setIsEdit(true);
    setView('form');
  };
  
  const handleViewRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    setView('detail');
  };
  
  const handleDuplicateRoutineClick = (routine: Routine) => {
    setSelectedRoutine(routine);
    setView('duplicate');
  };
  
  const handleDuplicateRoutine = async (newName: string) => {
    if (!gymData?.id || !selectedRoutine) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const duplicatedRoutine = await duplicateRoutine(gymData.id, selectedRoutine.id, newName);
      setSuccess(`Rutina "${selectedRoutine.name}" duplicada como "${newName}" correctamente`);
      
      if (duplicatedRoutine) {
        setSelectedRoutine(duplicatedRoutine);
        setView('detail');
      } else {
        setView('list');
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error duplicating routine:', err);
      setError(err.message || 'Error al duplicar la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteRoutine = async (routine: Routine) => {
    if (!gymData?.id) return;
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la rutina "${routine.name}"?`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await deleteRoutine(gymData.id, routine.id);
      setSuccess(`Rutina "${routine.name}" eliminada correctamente`);
      
      if (selectedRoutine?.id === routine.id) {
        setSelectedRoutine(null);
        setView('list');
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting routine:', err);
      setError(err.message || 'Error al eliminar la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveRoutine = async (routineData: Omit<Routine, 'id'>) => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isEdit && selectedRoutine) {
        // Actualizar rutina existente
        await updateRoutine(gymData.id, selectedRoutine.id, routineData);
        setSuccess(`Rutina "${routineData.name}" actualizada correctamente`);
        
        // Actualizar la rutina seleccionada
        const updatedRoutine = {
          ...selectedRoutine,
          ...routineData
        };
        setSelectedRoutine(updatedRoutine);
        setView('detail');
      } else {
        // Crear nueva rutina
        const newRoutine = await createRoutine(gymData.id, routineData);
        setSuccess(`Rutina "${routineData.name}" creada correctamente`);
        
        setSelectedRoutine(newRoutine);
        setView('detail');
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving routine:', err);
      setError(err.message || 'Error al guardar la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  // Componente para duplicar rutina
  const DuplicateRoutineModal = () => {
    const [newName, setNewName] = useState(selectedRoutine ? `${selectedRoutine.name} (copia)` : '');
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Duplicar Rutina</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        <p className="mb-4">
          Vas a crear una copia de la rutina <strong>{selectedRoutine?.name}</strong>. 
          Por favor, proporciona un nombre para la nueva rutina:
        </p>
        
        <div className="mb-4">
          <label htmlFor="newName" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la nueva rutina *
          </label>
          <input
            type="text"
            id="newName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre para la rutina duplicada"
            required
          />
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setView('detail')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateRoutine(newName)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={loading || !newName.trim()}
          >
            {loading ? 'Duplicando...' : 'Duplicar'}
          </button>
        </div>
      </div>
    );
  };
  
  const renderView = () => {
    switch (view) {
      case 'form':
        return (
          <RoutineForm
            initialData={selectedRoutine || undefined}
            isEdit={isEdit}
            onSave={handleSaveRoutine}
            onCancel={() => selectedRoutine ? setView('detail') : setView('list')}
          />
        );
      case 'detail':
        if (!selectedRoutine) return null;
        return (
          <RoutineDetail
            routine={selectedRoutine}
            onBack={() => setView('list')}
            onEdit={handleEditRoutine}
            onDelete={handleDeleteRoutine}
            onDuplicate={handleDuplicateRoutineClick}
          />
        );
      case 'duplicate':
        if (!selectedRoutine) return null;
        return <DuplicateRoutineModal />;
      case 'list':
      default:
        return (
          <RoutineList
            onNewRoutine={handleNewRoutine}
            onEditRoutine={handleEditRoutine}
            onViewRoutine={handleViewRoutine}
            onDuplicateRoutine={handleDuplicateRoutineClick}
          />
        );
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Rutinas</h1>
      
      {/* Migas de pan (breadcrumbs) */}
      <div className="mb-6 flex items-center text-sm text-gray-600">
        <span 
          className={`${view === 'list' ? 'font-medium text-blue-600' : 'cursor-pointer hover:text-blue-600'}`}
          onClick={() => setView('list')}
        >
          Rutinas
        </span>
        
        {view !== 'list' && (
          <>
            <span className="mx-2">/</span>
            <span 
              className={view === 'detail' ? 'font-medium text-blue-600' : ''}
            >
              {view === 'form' 
                ? (isEdit ? 'Editar Rutina' : 'Nueva Rutina') 
                : view === 'duplicate'
                  ? 'Duplicar Rutina'
                  : selectedRoutine?.name
              }
            </span>
            
            {view === 'form' && isEdit && selectedRoutine && (
              <>
                <span className="mx-2">/</span>
                <span>{selectedRoutine.name}</span>
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

export default Routines;