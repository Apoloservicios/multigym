// src/components/members/MemberRoutinesTab.tsx - Archivo completo con impresión
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Target, Activity, Plus, ChevronDown, ChevronUp, 
  Eye, Check, X, AlertCircle, Dumbbell, Clock, Printer
} from 'lucide-react';
import { MemberRoutine, Routine } from '../../types/exercise.types';
import { 
  getMemberRoutines, 
  getRoutineById, 
  updateMemberRoutineStatus,
  assignRoutineToMember,
  getRoutines 
} from '../../services/routine.service';
import useAuth from '../../hooks/useAuth';
import PrintableRoutine from '../routines/PrintableRoutine';
import { usePrint } from '../../hooks/usePrint';

interface MemberRoutinesTabProps {
  memberId: string;
  memberName: string;
  onRefreshMember?: () => void;
}

const MemberRoutinesTab: React.FC<MemberRoutinesTabProps> = ({
  memberId,
  memberName,
  onRefreshMember
}) => {
  const { gymData, userData } = useAuth();
  
  const [routines, setRoutines] = useState<MemberRoutine[]>([]);
  const [routineDetails, setRoutineDetails] = useState<{[key: string]: Routine}>({});
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para asignar nueva rutina
  const [showNewRoutineForm, setShowNewRoutineForm] = useState<boolean>(false);
  const [availableRoutines, setAvailableRoutines] = useState<Routine[]>([]);
  const [assigningRoutine, setAssigningRoutine] = useState<boolean>(false);
  
  // Estados para el modal de cambio de estado
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [routineToUpdate, setRoutineToUpdate] = useState<MemberRoutine | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  
  // Estados para ver detalles de rutina
  const [selectedRoutineDetails, setSelectedRoutineDetails] = useState<Routine | null>(null);
  const [showRoutineDetails, setShowRoutineDetails] = useState<boolean>(false);
  
  // Estados para impresión
  const { componentRef: printRef, handlePrint } = usePrint();
  const [routineToPrint, setRoutineToPrint] = useState<MemberRoutine | null>(null);
  
  // Cargar rutinas del miembro
  useEffect(() => {
    loadMemberRoutines();
    loadAvailableRoutines();
  }, [gymData?.id, memberId]);
  
  const loadMemberRoutines = async () => {
    if (!gymData?.id || !memberId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const routinesData = await getMemberRoutines(gymData.id, memberId);
      setRoutines(routinesData);
      
      // Cargar detalles de las rutinas
      const routineIds = new Set(routinesData.map(r => r.routineId));
      const routineDetailsObj: {[key: string]: Routine} = {};
      
      const routineIdsArray = Array.from(routineIds);
      
      for (const routineId of routineIdsArray) {
        try {
          const routine = await getRoutineById(gymData.id, routineId);
          if (routine) {
            routineDetailsObj[routineId] = routine;
          }
        } catch (err) {
          console.error(`Error cargando detalles de rutina ${routineId}:`, err);
        }
      }
      
      setRoutineDetails(routineDetailsObj);
    } catch (err: any) {
      console.error('Error cargando rutinas del socio:', err);
      setError(err.message || 'Error al cargar las rutinas asignadas');
    } finally {
      setLoading(false);
    }
  };
  
  const loadAvailableRoutines = async () => {
    if (!gymData?.id) return;
    
    try {
      const allRoutines = await getRoutines(gymData.id);
      // Filtrar solo rutinas activas
      const activeRoutines = allRoutines.filter(r => r.isActive !== false);
      setAvailableRoutines(activeRoutines);
    } catch (err) {
      console.error('Error cargando rutinas disponibles:', err);
    }
  };
  
  const toggleExpandRoutine = (routineId: string) => {
    setExpandedRoutineId(expandedRoutineId === routineId ? null : routineId);
  };
  
  const handleToggleStatus = (routine: MemberRoutine, status: 'active' | 'completed' | 'cancelled') => {
    setRoutineToUpdate(routine);
    setNewStatus(status);
    setStatusNote('');
    setIsStatusModalOpen(true);
  };
  
  const confirmStatusChange = async () => {
    if (!gymData?.id || !routineToUpdate) return;
    
    setLoading(true);
    
    try {
      await updateMemberRoutineStatus(
        gymData.id,
        routineToUpdate.id,
        newStatus as 'active' | 'completed' | 'cancelled',
        statusNote
      );
      
      // Actualizar la lista local
      setRoutines(prev => 
        prev.map(r => 
          r.id === routineToUpdate.id ? { ...r, status: newStatus as any } : r
        )
      );
      
      setSuccess(`Rutina actualizada a estado "${newStatus}" correctamente`);
      setTimeout(() => setSuccess(null), 3000);
      
      setIsStatusModalOpen(false);
      setRoutineToUpdate(null);
      
      // Refrescar datos del socio
      if (onRefreshMember) {
        onRefreshMember();
      }
    } catch (err: any) {
      console.error('Error actualizando estado de rutina:', err);
      setError(err.message || 'Error al actualizar el estado de la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para manejar la impresión
  const handlePrintRoutine = (routine: MemberRoutine) => {
    setRoutineToPrint(routine);
    // Esperar un tick para que se actualice el estado
    setTimeout(() => {
      handlePrint();
    }, 100);
  };
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Activa
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Completada
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  // Formulario para asignar nueva rutina
  const AssignRoutineForm = () => {
    const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState(4);
    const [trainerNotes, setTrainerNotes] = useState('');
    
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!selectedRoutineId || !gymData?.id || !userData) {
        setError('Por favor, completa todos los campos requeridos');
        return;
      }
      
      setAssigningRoutine(true);
      
      try {
        const selectedRoutine = availableRoutines.find(r => r.id === selectedRoutineId);
        if (!selectedRoutine) {
          throw new Error('Rutina seleccionada no encontrada');
        }
        
        await assignRoutineToMember(
          gymData.id,
          memberId,
          memberName,
          selectedRoutineId,
          startDate,
          duration,
          trainerNotes
        );
        
        setSuccess('Rutina asignada exitosamente');
        setShowNewRoutineForm(false);
        loadMemberRoutines();
        
        // Limpiar formulario
        setSelectedRoutineId('');
        setTrainerNotes('');
        setDuration(4);
        
        // Refrescar datos del socio
        if (onRefreshMember) {
          onRefreshMember();
        }
      } catch (err: any) {
        console.error('Error asignando rutina:', err);
        setError(err.message || 'Error al asignar la rutina');
      } finally {
        setAssigningRoutine(false);
      }
    };
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-3">Asignar Nueva Rutina</h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="routine" className="block text-sm font-medium text-gray-700 mb-1">
              Seleccionar Rutina
            </label>
            <select
              id="routine"
              value={selectedRoutineId}
              onChange={(e) => setSelectedRoutineId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar rutina...</option>
              {availableRoutines.map(routine => (
                <option key={routine.id} value={routine.id}>
                  {routine.name} - {routine.goal} ({routine.daysPerWeek} días/semana)
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Inicio
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duración (semanas)
              </label>
              <input
                type="number"
                id="duration"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                min="1"
                max="52"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas del Entrenador (opcional)
            </label>
            <textarea
              id="notes"
              value={trainerNotes}
              onChange={(e) => setTrainerNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Agregar notas específicas para este socio..."
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowNewRoutineForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={assigningRoutine}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {assigningRoutine ? 'Asignando...' : 'Asignar Rutina'}
            </button>
          </div>
        </form>
      </div>
    );
  };
  
  // Modal para ver detalles de una rutina
  const RoutineDetailsModal = () => {
    if (!selectedRoutineDetails) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{selectedRoutineDetails.name}</h3>
              <button
                onClick={() => setShowRoutineDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Descripción</label>
                  <p className="text-gray-900">{selectedRoutineDetails.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Nivel</label>
                  <p className="text-gray-900 capitalize">{selectedRoutineDetails.level}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Objetivo</label>
                  <p className="text-gray-900">{selectedRoutineDetails.goal}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Días por semana</label>
                  <p className="text-gray-900">{selectedRoutineDetails.daysPerWeek}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duración</label>
                  <p className="text-gray-900">{selectedRoutineDetails.duration} semanas</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Estado</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedRoutineDetails.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedRoutineDetails.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Ejercicios por día</h4>
              <div className="space-y-4">
                {Object.entries(selectedRoutineDetails.exercises).map(([day, exercises]) => (
                  <div key={day} className="border rounded-lg p-4">
                    <h5 className="font-medium mb-3 capitalize">{day.replace('day', 'Día ')}</h5>
                    <div className="space-y-3">
                      {exercises.map((exercise, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded">
                          <div className="font-medium">{exercise.exerciseName}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {exercise.sets} series x {exercise.reps} repeticiones - {exercise.rest}s descanso
                          </div>
                          {exercise.notes && (
                            <div className="text-sm text-gray-500 mt-1">{exercise.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Rutinas de Entrenamiento</h3>
        <button 
          onClick={() => setShowNewRoutineForm(!showNewRoutineForm)}
          className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Plus size={16} className="mr-1" />
          Asignar Rutina
        </button>
      </div>
      
      {/* Mensajes de error y éxito */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-100 text-green-700 rounded-md">
          {success}
        </div>
      )}
      
      {/* Formulario para asignar nueva rutina */}
      {showNewRoutineForm && <AssignRoutineForm />}
      
      {/* Lista de rutinas asignadas */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-3 text-gray-500">Cargando rutinas...</p>
        </div>
      ) : routines.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <Dumbbell size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">El socio no tiene rutinas asignadas</p>
          <button 
            onClick={() => setShowNewRoutineForm(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm inline-flex items-center"
          >
            <Plus size={16} className="mr-1" />
            Asignar Primera Rutina
          </button>
        </div>
      ) : (
        <div className="divide-y">
          {routines.map(routine => (
            <div key={routine.id} className="py-4">
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleExpandRoutine(routine.id)}
              >
                <div>
                  <h4 className="font-medium">{routine.routineName}</h4>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <Calendar size={14} className="mr-1" />
                    <span>{formatDate(routine.startDate)} - {formatDate(routine.endDate)}</span>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {getStatusBadge(routine.status)}
                  {expandedRoutineId === routine.id ? (
                    <ChevronUp size={20} className="ml-2 text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="ml-2 text-gray-400" />
                  )}
                </div>
              </div>
              
              {expandedRoutineId === routine.id && (
                <div className="mt-3 pl-4 border-l-2 border-blue-100">
                  {routineDetails[routine.routineId] ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        {routineDetails[routine.routineId].description}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                          <Activity size={12} className="mr-1" />
                          {routineDetails[routine.routineId].daysPerWeek} días/semana
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
                          <Target size={12} className="mr-1" />
                          {routineDetails[routine.routineId].goal}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-700">
                          <Clock size={12} className="mr-1" />
                          {routineDetails[routine.routineId].duration} semanas
                        </span>
                      </div>
                      
                      {routine.trainerNotes && (
                        <div className="bg-yellow-50 p-2 rounded-md text-sm text-yellow-800">
                          <strong>Notas:</strong> {routine.trainerNotes}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintRoutine(routine);
                          }}
                          className="px-3 py-1 border border-purple-300 rounded text-xs text-purple-700 hover:bg-purple-50 flex items-center"
                        >
                          <Printer size={14} className="mr-1" />
                          Imprimir
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoutineDetails(routineDetails[routine.routineId]);
                            setShowRoutineDetails(true);
                          }}
                          className="px-3 py-1 border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50 flex items-center"
                        >
                          <Eye size={14} className="mr-1" />
                          Ver Detalles
                        </button>
                        
                        {routine.status === 'active' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(routine, 'completed');
                              }}
                              className="px-3 py-1 border border-green-300 rounded text-xs text-green-700 hover:bg-green-50 flex items-center"
                            >
                              <Check size={14} className="mr-1" />
                              Completar
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(routine, 'cancelled');
                              }}
                              className="px-3 py-1 border border-red-300 rounded text-xs text-red-700 hover:bg-red-50 flex items-center"
                            >
                              <X size={14} className="mr-1" />
                              Cancelar
                            </button>
                          </>
                        )}
                        
                        {routine.status !== 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(routine, 'active');
                            }}
                            className="px-3 py-1 border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50 flex items-center"
                          >
                            <Activity size={14} className="mr-1" />
                            Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <div className="inline-block h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="text-sm text-gray-500">Cargando detalles...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Modal de cambio de estado */}
      {isStatusModalOpen && routineToUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              {newStatus === 'active' ? 'Reactivar Rutina' : 
               newStatus === 'completed' ? 'Completar Rutina' : 
               'Cancelar Rutina'}
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              {newStatus === 'active' 
                ? `¿Estás seguro de que deseas reactivar la rutina "${routineToUpdate.routineName}"?`
                : newStatus === 'completed'
                  ? `¿Estás seguro de que deseas marcar como completada la rutina "${routineToUpdate.routineName}"?`
                  : `¿Estás seguro de que deseas cancelar la rutina "${routineToUpdate.routineName}"?`
              }
            </p>
            
            <div className="mb-4">
              <label htmlFor="statusNote" className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                id="statusNote"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Añade un comentario sobre este cambio..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStatusChange}
                className={`px-4 py-2 text-white rounded-md ${
                  newStatus === 'active' ? 'bg-blue-600 hover:bg-blue-700' : 
                  newStatus === 'completed' ? 'bg-green-600 hover:bg-green-700' : 
                  'bg-red-600 hover:bg-red-700'
                }`}
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de detalles de rutina */}
      {showRoutineDetails && <RoutineDetailsModal />}
      
      {/* Componente para impresión (oculto) */}
      <div className="hidden">
        {routineToPrint && routineDetails[routineToPrint.routineId] && gymData && (
          <PrintableRoutine
            ref={printRef}
            memberRoutine={routineToPrint}
            routineDetails={routineDetails[routineToPrint.routineId]}
            member={{
              id: memberId,
              firstName: memberName.split(' ')[0] || memberName,
              lastName: memberName.split(' ').slice(1).join(' ') || '',
              email: '',
              phone: '',
              status: 'active',
              totalDebt: 0
            }}
            gymData={gymData}
          />
        )}
      </div>
    </div>
  );
};

export default MemberRoutinesTab;