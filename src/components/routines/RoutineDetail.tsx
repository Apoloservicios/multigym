// src/components/routines/RoutineDetail.tsx (continuación)
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Edit, Trash, Copy, Calendar, Activity, Target, 
  Clock, User, Dumbbell, ChevronDown, ChevronUp, Info 
} from 'lucide-react';
import { Routine, DifficultyLevel, MuscleGroup } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';
import { getExerciseById } from '../../services/exercise.service';
import useAuth from '../../hooks/useAuth';

interface RoutineDetailProps {
  routine: Routine;
  onBack: () => void;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
  onDuplicate: (routine: Routine) => void;
}

const RoutineDetail: React.FC<RoutineDetailProps> = ({ 
  routine, 
  onBack, 
  onEdit, 
  onDelete,
  onDuplicate
}) => {
  const { gymData } = useAuth();
  
  const [activeDay, setActiveDay] = useState<string>('day1');
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [exerciseDetails, setExerciseDetails] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState<boolean>(false);
  
  // Cargar detalles de ejercicios cuando se expande un día
  const loadExerciseDetails = async (exerciseId: string) => {
    if (!gymData?.id || exerciseDetails[exerciseId]) return;
    
    setLoading(true);
    try {
      const exerciseData = await getExerciseById(gymData.id, exerciseId);
      if (exerciseData) {
        setExerciseDetails(prev => ({
          ...prev,
          [exerciseId]: exerciseData
        }));
      }
    } catch (error) {
      console.error('Error loading exercise details:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Alternar expansión de ejercicio
  const toggleExerciseExpansion = (exerciseId: string) => {
    const newExpandedExercises = new Set(expandedExercises);
    
    if (expandedExercises.has(exerciseId)) {
      newExpandedExercises.delete(exerciseId);
    } else {
      newExpandedExercises.add(exerciseId);
      loadExerciseDetails(exerciseId);
    }
    
    setExpandedExercises(newExpandedExercises);
  };
  
  const getDifficultyLabel = (level: DifficultyLevel): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
  };
  
  const getMuscleGroupLabel = (group: MuscleGroup): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
  };
  
  // Renderizar pestañas de días
  const renderDayTabs = () => {
    const tabs = [];
    
    for (let i = 1; i <= routine.daysPerWeek; i++) {
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
  
  // Contenido del día seleccionado
  const renderDayContent = () => {
    const exercises = routine.exercises[activeDay] || [];
    
    if (exercises.length === 0) {
      return (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Info size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600">No hay ejercicios configurados para este día</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="bg-white rounded-lg border overflow-hidden">
            <div 
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExerciseExpansion(exercise.id)}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                  {exercise.order}
                </div>
                <div className="ml-3">
                  <h4 className="font-medium">{exercise.exerciseName}</h4>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                      {getMuscleGroupLabel(exercise.muscleGroup)}
                    </span>
                    <span>{exercise.sets} series x {exercise.reps} reps</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">
                  {exercise.rest}s descanso
                </span>
                {expandedExercises.has(exercise.id) ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </div>
            </div>
            
            {expandedExercises.has(exercise.id) && (
              <div className="px-4 py-3 bg-gray-50 border-t">
                {exerciseDetails[exercise.exerciseId] ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-1">Descripción:</h5>
                      <p className="text-sm text-gray-600">{exerciseDetails[exercise.exerciseId].description}</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-1">Detalles:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <Dumbbell size={14} className="mr-1 text-blue-500" />
                          Dificultad: {getDifficultyLabel(exerciseDetails[exercise.exerciseId].difficulty)}
                        </li>
                        {exercise.notes && (
                          <li className="flex items-start">
                            <Info size={14} className="mr-1 mt-0.5 text-blue-500" />
                            Notas: {exercise.notes}
                          </li>
                        )}
                      </ul>
                    </div>
                    
                    {exerciseDetails[exercise.exerciseId].image && (
                      <div className="md:col-span-2">
                        <img 
                          src={exerciseDetails[exercise.exerciseId].image} 
                          alt={exercise.exerciseName} 
                          className="h-48 w-auto object-contain mx-auto rounded-md"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando detalles...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Cabecera con acciones */}
      <div className="p-6 border-b flex flex-col sm:flex-row justify-between sm:items-center">
        <div className="flex items-center mb-4 sm:mb-0">
          <button
            onClick={onBack}
            className="p-2 mr-3 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold">{routine.name}</h2>
            <div className="flex items-center mt-1 space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                routine.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {routine.isActive ? 'Activa' : 'Inactiva'}
              </span>
              
              {routine.isTemplate && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Plantilla
                </span>
              )}
              
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {getDifficultyLabel(routine.level)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => onDuplicate(routine)}
            className="px-3 py-1 border border-purple-300 text-purple-700 rounded-md flex items-center hover:bg-purple-50"
          >
            <Copy size={18} className="mr-1" />
            Duplicar
          </button>
          <button
            onClick={() => onEdit(routine)}
            className="px-3 py-1 border border-blue-300 text-blue-700 rounded-md flex items-center hover:bg-blue-50"
          >
            <Edit size={18} className="mr-1" />
            Editar
          </button>
          <button
            onClick={() => onDelete(routine)}
            className="px-3 py-1 border border-red-300 text-red-700 rounded-md flex items-center hover:bg-red-50"
          >
            <Trash size={18} className="mr-1" />
            Eliminar
          </button>
        </div>
      </div>
      
      {/* Contenido */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-lg font-medium mb-4">Información General</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-4">{routine.description}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Calendar size={18} className="text-blue-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Duración</div>
                    <div className="text-gray-600">{routine.duration} semanas</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Activity size={18} className="text-green-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Frecuencia</div>
                    <div className="text-gray-600">{routine.daysPerWeek} días/semana</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Target size={18} className="text-red-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Objetivo</div>
                    <div className="text-gray-600">{routine.goal}</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <User size={18} className="text-purple-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Dificultad</div>
                    <div className="text-gray-600">{getDifficultyLabel(routine.level)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Resumen de Ejercicios</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(routine.exercises).map((day, index) => {
                  const dayExercises = routine.exercises[day];
                  return (
                    <div key={day} className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-medium">
                        {index + 1}
                      </div>
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-700">Día {day.replace('day', '')}</div>
                        <div className="text-gray-600">{dayExercises.length} ejercicios</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Grupos Musculares</h4>
                <div className="flex flex-wrap gap-1">
                  {/* Mostrar los grupos musculares únicos trabajados en esta rutina */}
                  {Array.from(new Set(
                    Object.values(routine.exercises)
                      .flat()
                      .map(ex => ex.muscleGroup)
                  )).map(group => (
                    <span 
                      key={group} 
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {getMuscleGroupLabel(group as MuscleGroup)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Detalle de Entrenamiento</h3>
          {renderDayTabs()}
          {renderDayContent()}
        </div>
      </div>
    </div>
  );
};

export default RoutineDetail;