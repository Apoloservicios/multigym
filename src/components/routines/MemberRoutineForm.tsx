// src/components/routines/MemberRoutineForm.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Target, User, Save, X, AlertCircle, Check } from 'lucide-react';
import { Routine } from '../../types/exercise.types';
import { Member } from '../../types/member.types';
import { getRoutines } from '../../services/routine.service';
import { assignRoutineToMember } from '../../services/routine.service';
import useAuth from '../../hooks/useAuth';

interface MemberRoutineFormProps {
  memberId: string;
  memberName: string;
  onSave: () => void;
  onCancel: () => void;
}

const MemberRoutineForm: React.FC<MemberRoutineFormProps> = ({
  memberId,
  memberName,
  onSave,
  onCancel
}) => {
  const { gymData } = useAuth();
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  
  // Formulario
  const [formData, setFormData] = useState({
    routineId: '',
    startDate: new Date().toISOString().split('T')[0],
    duration: 4, // Por defecto 4 semanas
    trainerNotes: ''
  });
  
  // Cargar rutinas disponibles
  useEffect(() => {
    const fetchRoutines = async () => {
      if (!gymData?.id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const data = await getRoutines(gymData.id);
        // Filtrar solo rutinas activas
        const activeRoutines = data.filter(r => r.isActive);
        setRoutines(activeRoutines);
      } catch (err) {
        console.error('Error loading routines:', err);
        setError('Error al cargar las rutinas disponibles');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoutines();
  }, [gymData?.id]);
  
  // Cuando cambia la rutina seleccionada, actualizar la duración
  useEffect(() => {
    if (selectedRoutine) {
      setFormData(prev => ({
        ...prev,
        duration: selectedRoutine.duration
      }));
    }
  }, [selectedRoutine]);
  
  // Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'routineId') {
      const routine = routines.find(r => r.id === value);
      setSelectedRoutine(routine || null);
    }
    
    setFormData({
      ...formData,
      [name]: name === 'duration' ? parseInt(value, 10) : value
    });
  };
  
  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id || !selectedRoutine) {
      setError('Debe seleccionar una rutina');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await assignRoutineToMember(
        gymData.id,
        memberId,
        memberName,
        formData.routineId,
        formData.startDate,
        formData.duration,
        formData.trainerNotes
      );
      
      setSuccess(true);
      
      // Redirigir después de un breve delay
      setTimeout(() => {
        onSave();
      }, 1500);
    } catch (err: any) {
      console.error('Error assigning routine:', err);
      setError(err.message || 'Error al asignar la rutina');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Renderizar detalles de la rutina seleccionada
  const renderRoutineDetails = () => {
    if (!selectedRoutine) return null;
    
    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">{selectedRoutine.name}</h3>
        <p className="text-sm text-blue-700 mb-3">{selectedRoutine.description}</p>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center">
            <Calendar size={16} className="text-blue-500 mr-1" />
            <span>{selectedRoutine.daysPerWeek} días/semana</span>
          </div>
          <div className="flex items-center">
            <Target size={16} className="text-blue-500 mr-1" />
            <span>{selectedRoutine.goal}</span>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Asignar Rutina</h2>
      <p className="text-gray-600 mb-6">Socio: {memberName}</p>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500">Cargando rutinas disponibles...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
              <AlertCircle size={18} className="mr-2" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
              <Check size={18} className="mr-2" />
              Rutina asignada correctamente
            </div>
          )}
          
          <div className="space-y-4">
            {/* Rutina */}
            <div>
              <label htmlFor="routineId" className="block text-sm font-medium text-gray-700 mb-1">
                Rutina *
              </label>
              <select
                id="routineId"
                name="routineId"
                value={formData.routineId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting || success}
                required
              >
                <option value="">Seleccionar rutina</option>
                {routines.map(routine => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name} - {routine.level} ({routine.daysPerWeek} días/semana)
                  </option>
                ))}
              </select>
              
              {/* Mostrar detalles de la rutina seleccionada */}
              {renderRoutineDetails()}
            </div>
            
            {/* Fecha de inicio */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Inicio *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                  disabled={submitting || success}
                  required
                />
              </div>
            </div>
            
            {/* Duración */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duración (semanas) *
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="52"
                disabled={submitting || success}
                required
              />
              {selectedRoutine && (
                <p className="mt-1 text-sm text-gray-500">
                  Duración recomendada: {selectedRoutine.duration} semanas
                </p>
              )}
            </div>
            
            {/* Notas */}
            <div>
              <label htmlFor="trainerNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas para el Socio (opcional)
              </label>
              <textarea
                id="trainerNotes"
                name="trainerNotes"
                value={formData.trainerNotes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Instrucciones específicas, recomendaciones, etc."
                disabled={submitting || success}
              />
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              disabled={submitting || success}
            >
              <X size={18} className="mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || success || !formData.routineId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
            >
              {submitting ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Save size={18} className="mr-2" />
              )}
              {submitting ? 'Asignando...' : success ? 'Asignado' : 'Asignar Rutina'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MemberRoutineForm;