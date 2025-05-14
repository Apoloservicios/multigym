// src/components/routines/MemberRoutineDetail.tsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Calendar, Clock, Target, User, Activity, 
  CheckCircle, XCircle, AlertCircle, Globe, Building2,
  ChevronDown, ChevronUp, Info, Dumbbell,Printer
} from 'lucide-react';
import { MemberRoutine } from '../../types/exercise.types';
import { getRoutineById } from '../../services/routine.service';
import { getExerciseById } from '../../services/exercise.service';
import { formatDate } from '../../utils/date.utils';
import exerciseTypes from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';
import PrintableRoutine from './PrintableRoutine';
import { usePrint } from '../../hooks/usePrint';


interface MemberRoutineDetailProps {
  memberRoutine: MemberRoutine;
  onBack: () => void;
  onUpdateStatus?: (status: 'active' | 'completed' | 'cancelled', notes?: string) => void;
}

const MemberRoutineDetail: React.FC<MemberRoutineDetailProps> = ({
  memberRoutine,
  onBack,
  onUpdateStatus
}) => {
  const { gymData } = useAuth();
   const { componentRef, handlePrint } = usePrint();
  const [routineDetails, setRoutineDetails] = useState<any>(null);
  const [exerciseDetails, setExerciseDetails] = useState<{[key: string]: any}>({});
  const [activeDay, setActiveDay] = useState<string>('day1');
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingExerciseDetails, setLoadingExerciseDetails] = useState<Set<string>>(new Set());
  
  // Cargar detalles de la rutina
  useEffect(() => {
    loadRoutineDetails();
  }, [memberRoutine.routineId]);
  
  const loadRoutineDetails = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    try {
      const routine = await getRoutineById(gymData.id, memberRoutine.routineId);
      if (routine) {
        setRoutineDetails(routine);
        
        // Precargar algunos detalles de ejercicios del primer día
        const firstDayExercises = routine.exercises.day1 || [];
        if (firstDayExercises.length > 0) {
          firstDayExercises.slice(0, 2).forEach(exercise => {
            loadExerciseDetails(exercise.exerciseId);
          });
        }
      }
    } catch (err) {
      console.error('Error loading routine details:', err);
      setError('Error al cargar los detalles de la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar detalles de un ejercicio específico
  const loadExerciseDetails = async (exerciseId: string) => {
    if (!gymData?.id || exerciseDetails[exerciseId] || loadingExerciseDetails.has(exerciseId)) return;
    
    setLoadingExerciseDetails(prev => new Set(prev).add(exerciseId));
    
    try {
      const exercise = await getExerciseById(gymData.id, exerciseId);
      if (exercise) {
        setExerciseDetails(prev => ({
          ...prev,
          [exerciseId]: exercise
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
  
  // Calcular días transcurridos y progreso
  const calculateProgress = () => {
    const startDate = new Date(memberRoutine.startDate);
    const endDate = new Date(memberRoutine.endDate);
    const today = new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    const progressPercentage = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;
    
    return {
      totalDays,
      daysElapsed,
      daysRemaining,
      progressPercentage,
      isActive: today >= startDate && today <= endDate,
      isExpired: today > endDate
    };
  };
  
  const progress = calculateProgress();
  
  const getDifficultyLabel = (level: string): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
  };
  
  const getMuscleGroupLabel = (group: string): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle size={16} className="mr-1" />
            Activa
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <CheckCircle size={16} className="mr-1" />
            Completada
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle size={16} className="mr-1" />
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };
  
  // Renderizar pestañas de días
  const renderDayTabs = () => {
    if (!routineDetails) return null;
    
    const tabs = [];
    for (let i = 1; i <= routineDetails.daysPerWeek; i++) {
      const dayKey = `day${i}`;
      const exercises = routineDetails.exercises[dayKey] || [];
      
      tabs.push(
        <button
          key={dayKey}
          onClick={() => setActiveDay(dayKey)}
          className={`px-4 py-2 ${activeDay === dayKey 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} 
            rounded-t-lg transition-colors`}
        >
          <div>
            <div>Día {i}</div>
            <div className="text-xs">
              {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}
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
    if (!routineDetails) return null;
    
    const exercises = routineDetails.exercises[activeDay] || [];
    
    if (exercises.length === 0) {
      return (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Info size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600">No hay ejercicios configurados para este día</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {exercises.map((exercise: any) => (
          <div key={exercise.id} className="bg-white rounded-lg border p-4">
            <div 
              className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
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
                {expandedExercises.has(exercise.id) ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </div>
            </div>
            
            {expandedExercises.has(exercise.id) && (
              <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4">
                {loadingExerciseDetails.has(exercise.exerciseId) ? (
                  <div className="text-center py-4">
                    <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando detalles...</p>
                  </div>
                ) : exerciseDetails[exercise.exerciseId] ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Descripción:</h5>
                      <p className="text-sm text-gray-600">{exerciseDetails[exercise.exerciseId].description}</p>
                      
                      {exercise.notes && (
                        <div className="mt-2">
                          <h5 className="font-medium text-sm text-gray-700 mb-1">Notas del entrenador:</h5>
                          <p className="text-sm text-gray-600 italic">{exercise.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Instrucciones:</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-line">
                        {exerciseDetails[exercise.exerciseId].instructions}
                      </p>
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
                  <div className="text-center py-4 text-gray-500">
                    Error al cargar los detalles del ejercicio
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-500">Cargando detalles de la rutina...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center">
        <AlertCircle size={20} className="mr-2" />
        {error}
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Cabecera */}
      <div className="p-6 border-b">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="p-2 mr-3 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{memberRoutine.routineName}</h2>
            <p className="text-gray-600">Socio: {memberRoutine.memberName}</p>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(memberRoutine.status)}
          </div>
        </div>
      </div>
      
      {/* Información del progreso */}
      <div className="p-6 bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{progress.progressPercentage}%</div>
            <div className="text-sm text-gray-600">Progreso</div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${progress.progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{progress.daysElapsed}</div>
            <div className="text-sm text-gray-600">Días transcurridos</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${progress.daysRemaining > 0 ? 'text-orange-600' : 'text-red-600'}`}>
              {progress.daysRemaining}
            </div>
            <div className="text-sm text-gray-600">
              {progress.daysRemaining > 0 ? 'Días restantes' : 'Rutina vencida'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Información general */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Información de la Rutina</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha de inicio:</span>
                <span className="font-medium">{formatDate(memberRoutine.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha de finalización:</span>
                <span className="font-medium">{formatDate(memberRoutine.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-medium">{getStatusBadge(memberRoutine.status)}</span>
              </div>
              {routineDetails && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nivel:</span>
                    <span className="font-medium">{getDifficultyLabel(routineDetails.level)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Objetivo:</span>
                    <span className="font-medium">{routineDetails.goal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Días por semana:</span>
                    <span className="font-medium">{routineDetails.daysPerWeek}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Notas y Observaciones</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Notas del entrenador:</h4>
              <p className="text-sm text-gray-600 mb-3">
                {memberRoutine.trainerNotes || 'Sin notas del entrenador'}
              </p>
              
              <h4 className="font-medium text-sm text-gray-700 mb-2">Comentarios del socio:</h4>
              <p className="text-sm text-gray-600">
                {memberRoutine.memberFeedback || 'Sin comentarios del socio'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Detalle de ejercicios */}
      {routineDetails && (
        <div className="p-6 border-t">
          <h3 className="text-lg font-medium mb-4">Detalle de Ejercicios</h3>
          {renderDayTabs()}
          {renderDayContent()}
        </div>
      )}
    </div>
  );
};

export default MemberRoutineDetail;