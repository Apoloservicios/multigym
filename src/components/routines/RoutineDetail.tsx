// src/components/routines/RoutineDetail.tsx - Parte 1
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Edit, Trash, Copy, Calendar, Activity, Target, 
  Clock, User, Dumbbell, ChevronDown, ChevronUp, Info, Globe, Building2 
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
  const [loadingExerciseDetails, setLoadingExerciseDetails] = useState<Set<string>>(new Set());
  
  // Cargar detalles de ejercicios cuando se expande un día
  const loadExerciseDetails = async (exerciseId: string) => {
    if (!gymData?.id || exerciseDetails[exerciseId] || loadingExerciseDetails.has(exerciseId)) return;
    
    setLoadingExerciseDetails(prev => new Set(prev).add(exerciseId));
    
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
      setLoadingExerciseDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseId);
        return newSet;
      });
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
  
  // Calcular estadísticas de la rutina
  const calculateRoutineStats = () => {
    let totalExercises = 0;
    let totalGlobalExercises = 0;
    const muscleGroups = new Set<string>();
    
    Object.values(routine.exercises).forEach(dayExercises => {
      dayExercises.forEach(exercise => {
        totalExercises++;
        if (exercise.isGlobal) {
          totalGlobalExercises++;
        }
        muscleGroups.add(exercise.muscleGroup);
      });
    });
    
    return {
      totalExercises,
      totalGlobalExercises,
      totalGymExercises: totalExercises - totalGlobalExercises,
      uniqueMuscleGroups: Array.from(muscleGroups)
    };
  };
  
  const stats = calculateRoutineStats();
  
  // Renderizar pestañas de días
  const renderDayTabs = () => {
    const tabs = [];
    
    for (let i = 1; i <= routine.daysPerWeek; i++) {
      const dayKey = `day${i}`;
      const dayExercises = routine.exercises[dayKey] || [];
      const globalCount = dayExercises.filter(ex => ex.isGlobal).length;
      
      tabs.push(
        <button
          key={dayKey}
          onClick={() => setActiveDay(dayKey)}
          className={`px-4 py-2 ${activeDay === dayKey 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} 
            rounded-t-lg transition-colors relative`}
        >
          <div>
            <div>Día {i}</div>
            <div className="text-xs">
              {dayExercises.length} ejercicio{dayExercises.length !== 1 ? 's' : ''}
              {globalCount > 0 && (
                <span className="text-purple-200 block">
                  {globalCount} global{globalCount !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
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
              <div className="flex items-center flex-1">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium mr-3">
                  {exercise.order}
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="font-medium">{exercise.exerciseName}</h4>
                    {exercise.isGlobal && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Globe size={10} className="mr-1" />
                        Global
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                      {getMuscleGroupLabel(exercise.muscleGroup)}
                    </span>
                    <span>{exercise.sets} series × {exercise.reps} reps</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-3">
                  {exercise.rest}s descanso
                </span>
                {loadingExerciseDetails.has(exercise.exerciseId) ? (
                  <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  expandedExercises.has(exercise.id) ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )
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
                        <li className="flex items-center">
                          {exercise.isGlobal ? (
                            <>
                              <Globe size={14} className="mr-1 text-purple-500" />
                              <span className="text-purple-700">Ejercicio Global</span>
                            </>
                          ) : (
                            <>
                              <Building2 size={14} className="mr-1 text-blue-500" />
                              <span className="text-blue-700">Ejercicio Propio</span>
                            </>
                          )}
                        </li>
                        {exercise.notes && (
                          <li className="flex items-start">
                            <Info size={14} className="mr-1 mt-0.5 text-blue-500" />
                            <span>Notas: {exercise.notes}</span>
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
                    
                    {exerciseDetails[exercise.exerciseId].instructions && (
                      <div className="md:col-span-2">
                        <h5 className="font-medium text-sm text-gray-700 mb-1">Instrucciones:</h5>
                        <p className="text-sm text-gray-600 whitespace-pre-line">
                          {exerciseDetails[exercise.exerciseId].instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-sm text-gray-500">
                      Error al cargar los detalles del ejercicio
                    </div>
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
            <h3 className="text-lg font-medium mb-4">Estadísticas de Ejercicios</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalExercises}</div>
                  <div className="text-sm text-gray-600">Total Ejercicios</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.totalGlobalExercises}</div>
                  <div className="text-sm text-gray-600">Ejercicios Globales</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.totalGymExercises}</div>
                  <div className="text-sm text-gray-600">Ejercicios Propios</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{routine.daysPerWeek}</div>
                  <div className="text-sm text-gray-600">Días de Entrenamiento</div>
                </div>
              </div>
              
              <div className="p-3 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Grupos Musculares</h4>
                <div className="flex flex-wrap gap-1">
                  {stats.uniqueMuscleGroups.map(group => (
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
            
            {/* Resumen por días */}
            <div className="mt-4 bg-purple-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-800 mb-2">Resumen por Días</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(routine.exercises).map((day, index) => {
                  const dayExercises = routine.exercises[day];
                  const globalCount = dayExercises.filter(ex => ex.isGlobal).length;
                  return (
                    <div key={day} className="text-center">
                      <div className="font-medium text-purple-700">Día {index + 1}</div>
                      <div className="text-xs text-gray-600">
                        {dayExercises.length} total
                        {globalCount > 0 && (
                          <span className="block text-purple-600">
                            {globalCount} global{globalCount !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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