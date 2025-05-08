// src/components/members/MemberRoutinesTab.tsx
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Target, Activity, Plus, ChevronDown, ChevronUp, 
  Eye, Check, X, AlertCircle 
} from 'lucide-react';
import { MemberRoutine } from '../../types/exercise.types';
import { Member } from '../../types/member.types';
import { 
  getMemberRoutines, 
  getRoutineById, 
  updateMemberRoutineStatus 
} from '../../services/routine.service';
import useAuth from '../../hooks/useAuth';

interface MemberRoutinesTabProps {
  memberId: string;
  memberName: string;
  onAssignRoutine: () => void;
}

const MemberRoutinesTab: React.FC<MemberRoutinesTabProps> = ({
  memberId,
  memberName,
  onAssignRoutine
}) => {
  const { gymData } = useAuth();
  
  const [routines, setRoutines] = useState<MemberRoutine[]>([]);
  const [routineDetails, setRoutineDetails] = useState<{[key: string]: any}>({});
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal de cambio de estado
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [routineToUpdate, setRoutineToUpdate] = useState<MemberRoutine | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  
  // Cargar rutinas del miembro
  useEffect(() => {
    loadMemberRoutines();
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
      const routineDetailsObj: {[key: string]: any} = {};
      
      routineIds.forEach(async (routineId) => {
        try {
          const routine = await getRoutineById(gymData.id, routineId);
          if (routine) {
            routineDetailsObj[routineId] = routine;
          }
        } catch (err) {
          console.error(`Error loading routine details for ${routineId}:`, err);
        }
      });
      
      setRoutineDetails(routineDetailsObj);
    } catch (err: any) {
      console.error('Error loading member routines:', err);
      setError(err.message || 'Error al cargar las rutinas asignadas');
    } finally {
      setLoading(false);
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
    } catch (err: any) {
      console.error('Error updating routine status:', err);
      setError(err.message || 'Error al actualizar el estado de la rutina');
    } finally {
      setLoading(false);
    }
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
  
  // Renderizar modal de cambio de estado
  const renderStatusChangeModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {newStatus === 'active' ? 'Reactivar Rutina' : 
           newStatus === 'completed' ? 'Completar Rutina' : 
           'Cancelar Rutina'}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4">
          {newStatus === 'active' 
            ? `¿Estás seguro de que deseas reactivar la rutina "${routineToUpdate?.routineName}"?`
            : newStatus === 'completed'
              ? `¿Estás seguro de que deseas marcar como completada la rutina "${routineToUpdate?.routineName}"?`
              : `¿Estás seguro de que deseas cancelar la rutina "${routineToUpdate?.routineName}"?`
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
  );
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Rutinas de Entrenamiento</h3>
        <button 
          onClick={onAssignRoutine}
          className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Plus size={16} className="mr-1" />
          Asignar Rutina
        </button>
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
      
      {/* Lista de rutinas asignadas */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-3 text-gray-500">Cargando rutinas...</p>
        </div>
      ) : routines.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-2">El socio no tiene rutinas asignadas</p>
          <button 
            onClick={onAssignRoutine}
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
                      </div>
                      
                      {routine.trainerNotes && (
                        <div className="bg-yellow-50 p-2 rounded-md text-sm text-yellow-800">
                          <strong>Notas:</strong> {routine.trainerNotes}
                        </div>
                      )}
                      
                      <div className="flex pt-2">
                        {routine.status === 'active' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(routine, 'completed');
                              }}
                              className="mr-2 px-2 py-1 border border-green-300 rounded text-xs text-green-700 hover:bg-green-50 flex items-center"
                            >
                              <Check size={14} className="mr-1" />
                              Completar
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(routine, 'cancelled');
                              }}
                              className="px-2 py-1 border border-red-300 rounded text-xs text-red-700 hover:bg-red-50 flex items-center"
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
                            className="px-2 py-1 border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50 flex items-center"
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
      {isStatusModalOpen && renderStatusChangeModal()}
    </div>
  );
};

export default MemberRoutinesTab;