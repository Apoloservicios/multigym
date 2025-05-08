// src/components/routines/RoutineForm.tsx
import React, { useState, useEffect } from 'react';
import { 
  Save, X, AlertCircle, Check, ToggleLeft, ToggleRight, Plus, Trash, 
  Calendar, Activity, Target, BarChart, ArrowUpDown
} from 'lucide-react';
import { Routine, RoutineExercise, DifficultyLevel } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';
import { getExercises } from '../../services/exercise.service';
import useAuth from '../../hooks/useAuth';

interface RoutineFormProps {
  initialData?: Routine;
  isEdit: boolean;
  onSave: (routineData: Omit<Routine, 'id'>) => Promise<void>;
  onCancel: () => void;
}

const RoutineForm: React.FC<RoutineFormProps> = ({
  initialData,
  isEdit,
  onSave,
  onCancel
}) => {
  const { gymData } = useAuth();
  
  const [formData, setFormData] = useState<Omit<Routine, 'id'>>({
    name: '',
    description: '',
    level: 'principiante',
    daysPerWeek: 3,
    goal: 'Mantenimiento',
    duration: 4,
    exercises: {},
    isActive: true,
    isTemplate: false
  });
  
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Estado para manejar la pestaña activa (el día seleccionado)
  const [activeDay, setActiveDay] = useState<string>('day1');
  
  // Cargar datos iniciales si estamos en modo de edición
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        level: initialData.level,
        daysPerWeek: initialData.daysPerWeek,
        goal: initialData.goal,
        duration: initialData.duration,
        exercises: initialData.exercises,
        isActive: initialData.isActive,
        isTemplate: initialData.isTemplate
      });
    } else {
      // Para un nuevo registro, inicializar la estructura de exercises para los días
      initializeExercisesStructure(3); // Por defecto, 3 días a la semana
    }
    
    // Cargar ejercicios
    loadExercises();
  }, [isEdit, initialData]);
  
  // Cargar lista de ejercicios desde Firestore
  const loadExercises = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    try {
      const data = await getExercises(gymData.id);
      // Filtrar solo ejercicios activos
      setExercises(data.filter(ex => ex.isActive));
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Error al cargar los ejercicios. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  // Inicializar estructura de ejercicios para los días de la semana
  const initializeExercisesStructure = (daysCount: number) => {
    const exercises: { [key: string]: RoutineExercise[] } = {};
    
    for (let i = 1; i <= daysCount; i++) {
      exercises[`day${i}`] = [];
    }
    
    setFormData(prev => ({
      ...prev,
      exercises
    }));
  };
  
  // Manejar cambios en inputs básicos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'daysPerWeek') {
      const daysPerWeek = parseInt(value, 10);
      // Si cambia el número de días, debemos actualizar la estructura de ejercicios
      if (daysPerWeek !== formData.daysPerWeek) {
        handleDaysChange(daysPerWeek);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'daysPerWeek' || name === 'duration' ? parseInt(value, 10) : value
    }));
  };
  
  // Manejar cambio en días por semana
  const handleDaysChange = (daysCount: number) => {
    const currentDays = Object.keys(formData.exercises).length;
    const newExercises = { ...formData.exercises };
    
    if (daysCount > currentDays) {
      // Añadir nuevos días
      for (let i = currentDays + 1; i <= daysCount; i++) {
        newExercises[`day${i}`] = [];
      }
    } else if (daysCount < currentDays) {
      // Eliminar días sobrantes
      for (let i = currentDays; i > daysCount; i--) {
        delete newExercises[`day${i}`];
      }
    }
    
    setFormData(prev => ({
      ...prev,
      exercises: newExercises,
      daysPerWeek: daysCount
    }));
    
    // Si el día activo ya no existe, seleccionar el último día disponible
    if (parseInt(activeDay.replace('day', ''), 10) > daysCount) {
      setActiveDay(`day${daysCount}`);
    }
  };
  
  // Manejar cambios en toggles
  const handleToggle = (field: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };
  
  // Añadir un ejercicio al día activo
  const handleAddExercise = () => {
    const newExercise: RoutineExercise = {
      id: Date.now().toString(), // ID temporal
      exerciseId: '',
      exerciseName: '',
      muscleGroup: 'espalda',
      sets: 3,
      reps: '12',
      rest: 60,
      order: formData.exercises[activeDay]?.length + 1 || 1,
      notes: ''
    };
    
    setFormData(prev => ({
      ...prev,
      exercises: {
        ...prev.exercises,
        [activeDay]: [...(prev.exercises[activeDay] || []), newExercise]
      }
    }));
  };
  
  // Eliminar un ejercicio
  const handleRemoveExercise = (exerciseId: string) => {
    setFormData(prev => {
      const updatedExercises = prev.exercises[activeDay].filter(ex => ex.id !== exerciseId);
      
      // Reordenar los ejercicios restantes
      const reorderedExercises = updatedExercises.map((ex, idx) => ({
        ...ex,
        order: idx + 1
      }));
      
      return {
        ...prev,
        exercises: {
          ...prev.exercises,
          [activeDay]: reorderedExercises
        }
      };
    });
  };
  
  // Actualizar un ejercicio
  const handleExerciseChange = (exerciseId: string, field: string, value: any) => {
    setFormData(prev => {
      const updatedExercises = prev.exercises[activeDay].map(ex => {
        if (ex.id === exerciseId) {
          if (field === 'exerciseId') {
            // Si cambia el ejercicio, actualizar también el nombre y grupo muscular
            const selectedExercise = exercises.find(e => e.id === value);
            if (selectedExercise) {
              return {
                ...ex,
                exerciseId: value,
                exerciseName: selectedExercise.name,
                muscleGroup: selectedExercise.muscleGroup
              };
            }
          }
          
          return {
            ...ex,
            [field]: field === 'sets' || field === 'rest' ? parseInt(value, 10) : value
          };
        }
        return ex;
      });
      
      return {
        ...prev,
        exercises: {
          ...prev.exercises,
          [activeDay]: updatedExercises
        }
      };
    });
  };
  
  // Mover un ejercicio hacia arriba o abajo (cambiar orden)
  const handleMoveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    const currentExercises = [...formData.exercises[activeDay]];
    const index = currentExercises.findIndex(ex => ex.id === exerciseId);
    
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === currentExercises.length - 1)
    ) {
      return; // No se puede mover más arriba/abajo
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const exerciseToMove = currentExercises[index];
    const exerciseToSwap = currentExercises[newIndex];
    
    // Intercambiar posiciones
    currentExercises[index] = { ...exerciseToSwap, order: exerciseToMove.order };
    currentExercises[newIndex] = { ...exerciseToMove, order: exerciseToSwap.order };
    
    // Ordenar por orden
    const sortedExercises = currentExercises.sort((a, b) => a.order - b.order);
    
    setFormData(prev => ({
      ...prev,
      exercises: {
        ...prev.exercises,
        [activeDay]: sortedExercises
      }
    }));
  };
  
  // Validar formulario
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('El nombre de la rutina es obligatorio');
      return false;
    }
    
    if (!formData.description.trim()) {
      setError('La descripción es obligatoria');
      return false;
    }
    
    if (!formData.goal.trim()) {
      setError('El objetivo es obligatorio');
      return false;
    }
    
    // Verificar que todos los días tengan al menos un ejercicio
    const emptyDays = Object.keys(formData.exercises).filter(
      day => formData.exercises[day].length === 0
    );
    
    if (emptyDays.length > 0) {
      setError(`Los siguientes días no tienen ejercicios: ${emptyDays.join(', ')}`);
      return false;
    }
    
    // Verificar que todos los ejercicios tengan un ejercicio seleccionado
    let hasEmptyExercise = false;
    Object.keys(formData.exercises).forEach(day => {
      formData.exercises[day].forEach(ex => {
        if (!ex.exerciseId) {
          hasEmptyExercise = true;
        }
      });
    });
    
    if (hasEmptyExercise) {
      setError('Todos los ejercicios deben tener un ejercicio seleccionado');
      return false;
    }
    
    return true;
  };
  
  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await onSave(formData);
      setSuccess(true);
      
      // Mostrar mensaje de éxito por unos segundos antes de redirigir
      setTimeout(() => {
        onCancel();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving routine:', err);
      setError(err.message || 'Error al guardar la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  // Renderizar pestañas de días
  const renderDayTabs = () => {
    const tabs = [];
    
    for (let i = 1; i <= formData.daysPerWeek; i++) {
      const dayKey = `day${i}`;
      tabs.push(
        <button
          key={dayKey}
          onClick={() => setActiveDay(dayKey)}
          className={`px-4 py-2 ${activeDay === dayKey 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} 
            rounded-t-lg transition-colors`}
        >
          Día {i}
        </button>
      );
    }
    
    return (
      <div className="flex space-x-1 mb-4 overflow-x-auto">
        {tabs}
      </div>
    );
  };
  
  // Renderizar contenido de día activo
  const renderDayContent = () => {
    const exercises = formData.exercises[activeDay] || [];
    
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Ejercicios para Día {activeDay.replace('day', '')}</h3>
          <button
            type="button"
            onClick={handleAddExercise}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center text-sm"
          >
            <Plus size={16} className="mr-1" />
            Añadir Ejercicio
          </button>
        </div>
        
        {exercises.length === 0 ? (
          <div className="text-center py-8 bg-white rounded border border-dashed border-gray-300">
            <p className="text-gray-500">No hay ejercicios añadidos para este día</p>
            <button
              type="button"
              onClick={handleAddExercise}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Añadir Primer Ejercicio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {index + 1}
                    </span>
                    <h4 className="ml-2 font-medium">
                      {exercise.exerciseName || 'Selecciona un ejercicio'}
                    </h4>
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(exercise.id, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      <ArrowUpDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(exercise.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ejercicio *
                    </label>
                    <select
                      value={exercise.exerciseId}
                      onChange={(e) => handleExerciseChange(exercise.id, 'exerciseId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar ejercicio</option>
                      {exercises.map((ex:any) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name} ({getMuscleGroupLabel(ex.muscleGroup)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Series
                      </label>
                      <input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) => handleExerciseChange(exercise.id, 'sets', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reps
                      </label>
                      <input
                        type="text"
                        value={exercise.reps}
                        onChange={(e) => handleExerciseChange(exercise.id, 'reps', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12 o 8-12"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descanso (s)
                      </label>
                      <input
                        type="number"
                        value={exercise.rest}
                        onChange={(e) => handleExerciseChange(exercise.id, 'rest', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="10"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas (opcional)
                    </label>
                    <input
                      type="text"
                      value={exercise.notes || ''}
                      onChange={(e) => handleExerciseChange(exercise.id, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Con mancuernas, lento en excéntrica, etc."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Función auxiliar para obtener la etiqueta de grupo muscular
  const getMuscleGroupLabel = (muscleGroup: string): string => {
    const group = exerciseTypes.muscleGroups.find(g => g.value === muscleGroup);
    return group ? group.label : muscleGroup;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        {isEdit ? 'Editar Rutina' : 'Nueva Rutina'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
          <Check size={18} className="mr-2" />
          {isEdit ? 'Rutina actualizada correctamente' : 'Rutina creada correctamente'}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre de la rutina"
                required
              />
            </div>
            
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de Dificultad *
              </label>
              <select
                id="level"
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {exerciseTypes.difficultyLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="daysPerWeek" className="block text-sm font-medium text-gray-700 mb-1">
                Días por Semana *
              </label>
              <select
                id="daysPerWeek"
                name="daysPerWeek"
                value={formData.daysPerWeek}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {[2, 3, 4, 5, 6].map(day => (
                  <option key={day} value={day}>
                    {day} días por semana
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duración (semanas) *
              </label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {[1, 2, 3, 4, 6, 8, 12].map(week => (
                  <option key={week} value={week}>
                    {week} {week === 1 ? 'semana' : 'semanas'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1">
                Objetivo *
              </label>
              <select
                id="goal"
                name="goal"
                value={formData.goal}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {exerciseTypes.trainingGoals.map(goal => (
                  <option key={goal} value={goal}>
                    {goal}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descripción *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange as any}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descripción de la rutina"
                required
              ></textarea>
            </div>
            
            {/* Toggles */}
            <div>
              <div className="flex items-center">
                <button 
                  type="button"
                  onClick={() => handleToggle('isActive')}
                  className="flex items-center focus:outline-none"
                >
                  {formData.isActive ? (
                    <ToggleRight size={32} className="text-blue-600 mr-2" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-400 mr-2" />
                  )}
                  <span className="font-medium">
                    {formData.isActive ? 'Rutina Activa' : 'Rutina Inactiva'}
                  </span>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formData.isActive 
                  ? 'La rutina estará disponible para asignar a socios' 
                  : 'La rutina no estará disponible para asignar a socios'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <button 
                  type="button"
                  onClick={() => handleToggle('isTemplate')}
                  className="flex items-center focus:outline-none"
                >
                  {formData.isTemplate ? (
                    <ToggleRight size={32} className="text-blue-600 mr-2" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-400 mr-2" />
                  )}
                  <span className="font-medium">
                    {formData.isTemplate ? 'Es Plantilla' : 'No es Plantilla'}
                  </span>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formData.isTemplate 
                  ? 'Esta rutina puede usarse como plantilla para crear otras rutinas' 
                  : 'Esta rutina es específica y no se usará como plantilla'}
              </p>
            </div>
          </div>
          
          {/* Ejercicios por día */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Ejercicios por Día</h3>
            {renderDayTabs()}
            {renderDayContent()}
          </div>
          
          {/* Botones de acción */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              disabled={loading}
            >
              <X size={18} className="mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  {isEdit ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RoutineForm;