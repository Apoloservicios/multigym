// src/pages/member-routines/MemberRoutines.tsx
import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Search, Plus, Filter, Calendar, User, 
  Activity, Check, X, Eye, Trash, RefreshCw, Users, Dumbbell, Target /* CORRECCIÓN: Añadido Target */
} from 'lucide-react';
import { MemberRoutine } from '../../types/exercise.types';
import { Member } from '../../types/member.types';
import { 
  getMemberRoutines, 
  updateMemberRoutineStatus,
  getRoutineById
} from '../../services/routine.service';
/* CORRECCIÓN: Reemplazado getMembers por useFirestore */
import useFirestore from '../../hooks/useFirestore';
import MemberRoutineForm from '../../components/routines/MemberRoutineForm';
import useAuth from '../../hooks/useAuth';

type ViewType = 'list' | 'form' | 'detail';

const MemberRoutines: React.FC = () => {
  const { gymData } = useAuth();
  
  /* CORRECCIÓN: Añadido membersFirestore */
  const membersFirestore = useFirestore<Member>('members');
  
  const [view, setView] = useState<ViewType>('list');
  const [memberRoutines, setMemberRoutines] = useState<MemberRoutine[]>([]);
  const [filteredRoutines, setFilteredRoutines] = useState<MemberRoutine[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<MemberRoutine | null>(null);
  const [routineDetails, setRoutineDetails] = useState<{[key: string]: any}>({});
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [routineToUpdate, setRoutineToUpdate] = useState<MemberRoutine | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  
  // Cargar datos al montar
  useEffect(() => {
    loadData();
  }, [gymData?.id]);
  
  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [memberRoutines, searchTerm, statusFilter, memberFilter]);
  
  const loadData = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Cargar miembros
      /* CORRECCIÓN: Usar membersFirestore.getAll() en lugar de getMembers */
      const membersData = await membersFirestore.getAll();
      setMembers(membersData);
      
      // Cargar todas las rutinas asignadas
      /* CORRECCIÓN: Añadido segundo parámetro vacío */
      const routinesData = await getMemberRoutines(gymData.id, '');
      setMemberRoutines(routinesData);
      
      // Precargar detalles de rutinas
      const routineIds = new Set(routinesData.map(r => r.routineId));
      const routineDetailsObj: {[key: string]: any} = {};
      
      /* CORRECCIÓN: Reemplazado el bucle for...of por Array.from().forEach */
      Array.from(routineIds).forEach(async (routineId) => {
        try {
          const routine = await getRoutineById(gymData.id, routineId);
          if (routine) {
            routineDetailsObj[routineId] = routine;
            // Actualizar el estado cuando se complete cada carga
            setRoutineDetails(prev => ({...prev, [routineId]: routine}));
          }
        } catch (err) {
          console.error(`Error loading routine details for ${routineId}:`, err);
        }
      });
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let result = [...memberRoutines];
    
    // Filtro de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(routine => 
        routine.memberName.toLowerCase().includes(search) ||
        routine.routineName.toLowerCase().includes(search)
      );
    }
    
    // Filtro por estado
    if (statusFilter !== 'all') {
      result = result.filter(routine => routine.status === statusFilter);
    }
    
    // Filtro por miembro
    if (memberFilter !== 'all') {
      result = result.filter(routine => routine.memberId === memberFilter);
    }
    
    // Ordenar por fecha de inicio (más reciente primero)
    result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    setFilteredRoutines(result);
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
      setMemberRoutines(prev => 
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
  
  const handleAssignRoutine = (member?: Member) => {
    if (member) {
      setSelectedMember(member);
    } else {
      setSelectedMember(null);
    }
    setView('form');
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
  
  const renderFilters = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-col md:flex-row justify-between space-y-3 md:space-y-0 md:space-x-4">
        {/* Buscador */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre de socio o rutina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los socios</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
          
          <button
            onClick={loadData}
            className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={() => handleAssignRoutine()}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} className="mr-1" />
            Asignar Rutina
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderMemberSelectionView = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Seleccionar Socio</h2>
      
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar socio por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {members
          .filter(member => 
            `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(member => (
            <div 
              key={member.id}
              className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer transition-colors"
              onClick={() => handleAssignRoutine(member)}
            >
              <div className="flex items-center mb-2">
                {member.photo ? (
                  <img 
                    src={member.photo} 
                    alt={`${member.firstName} ${member.lastName}`} 
                    className="w-10 h-10 rounded-full object-cover mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium mr-3">
                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                  </div>
                )}
                
                <div>
                  <h3 className="font-medium">{member.firstName} {member.lastName}</h3>
                  <p className="text-sm text-gray-600">{member.email}</p>
                </div>
              </div>
              
              <div className="ml-13 pl-4 border-l-2 border-blue-100">
                {/* Resumen de rutinas activas */}
                {memberRoutines.filter(r => r.memberId === member.id && r.status === 'active').length > 0 ? (
                  <p className="text-sm text-gray-600">
                    <span className="text-blue-600 font-medium">
                      {memberRoutines.filter(r => r.memberId === member.id && r.status === 'active').length}
                    </span> {' '}
                    rutinas activas
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Sin rutinas activas</p>
                )}
              </div>
            </div>
          ))}
      </div>
      
      <button
        onClick={() => setView('list')}
        className="mt-6 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        Volver a la lista
      </button>
    </div>
  );
  
  const renderRoutinesList = () => (
    <div className="space-y-4">
      {filteredRoutines.map(routine => (
        <div key={routine.id} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row justify-between">
            <div>
              <div className="flex items-center">
                <Dumbbell size={20} className="text-blue-500 mr-2" />
                <h3 className="font-medium">{routine.routineName}</h3>
              </div>
              
              <div className="flex items-center mt-2">
                <Users size={16} className="text-gray-500 mr-2" />
                <span className="text-gray-700">{routine.memberName}</span>
              </div>
            </div>
            
            <div className="mt-3 sm:mt-0 flex flex-col sm:items-end">
              <div className="flex items-center">
                <Calendar size={16} className="text-gray-500 mr-1" />
                <span className="text-sm text-gray-600">
                  {formatDate(routine.startDate)} - {formatDate(routine.endDate)}
                </span>
              </div>
              <div className="mt-1">{getStatusBadge(routine.status)}</div>
            </div>
          </div>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Detalles de la Rutina</h4>
              {routineDetails[routine.routineId] ? (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">{routineDetails[routine.routineId].description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      <Activity size={12} className="mr-1" />
                      {routineDetails[routine.routineId].daysPerWeek} días/semana
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                      <Target size={12} className="mr-1" />
                      {routineDetails[routine.routineId].goal}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-500 italic">Cargando detalles...</p>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Notas</h4>
              <div className="bg-gray-50 p-3 rounded-md h-full">
                {routine.trainerNotes ? (
                  <p className="text-sm text-gray-600">{routine.trainerNotes}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Sin notas adicionales</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border-t flex justify-end space-x-2">
            <button
              onClick={() => {/* TODO: implementar vista detalle */}}
              className="px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center text-sm"
              title="Ver detalles"
            >
              <Eye size={16} className="mr-1" />
              Detalles
            </button>
            
            {routine.status === 'active' && (
              <>
                <button
                  onClick={() => handleToggleStatus(routine, 'completed')}
                  className="px-3 py-1 border border-green-300 rounded-md text-green-700 hover:bg-green-50 flex items-center text-sm"
                  title="Marcar como completada"
                >
                  <Check size={16} className="mr-1" />
                  Completar
                </button>
                
                <button
                  onClick={() => handleToggleStatus(routine, 'cancelled')}
                  className="px-3 py-1 border border-red-300 rounded-md text-red-700 hover:bg-red-50 flex items-center text-sm"
                  title="Cancelar rutina"
                >
                  <X size={16} className="mr-1" />
                  Cancelar
                </button>
              </>
            )}
            
            {routine.status !== 'active' && (
              <button
                onClick={() => handleToggleStatus(routine, 'active')}
                className="px-3 py-1 border border-blue-300 rounded-md text-blue-700 hover:bg-blue-50 flex items-center text-sm"
                title="Reactivar rutina"
              >
                <Activity size={16} className="mr-1" />
                Reactivar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderEmptyState = () => (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <div className="mx-auto flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
        <Dumbbell size={24} className="text-blue-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay rutinas asignadas</h3>
      <p className="text-gray-500 mb-6">
        Asigna una rutina de entrenamiento a un socio para comenzar el seguimiento.
      </p>
      <button
        onClick={() => handleAssignRoutine()}
        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus size={18} className="mr-2" />
        Asignar Rutina
      </button>
    </div>
  );
  
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
            ? `¿Estás seguro de que deseas reactivar la rutina "${routineToUpdate?.routineName}" para ${routineToUpdate?.memberName}?`
            : newStatus === 'completed'
              ? `¿Estás seguro de que deseas marcar como completada la rutina "${routineToUpdate?.routineName}" para ${routineToUpdate?.memberName}?`
              : `¿Estás seguro de que deseas cancelar la rutina "${routineToUpdate?.routineName}" para ${routineToUpdate?.memberName}?`
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Rutinas Asignadas</h1>
      
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
      {loading && memberRoutines.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando rutinas...</span>
        </div>
      ) : (
        <>
          {view === 'list' && (
            <>
              {renderFilters()}
              
              {filteredRoutines.length === 0 ? (
                renderEmptyState()
              ) : (
                renderRoutinesList()
              )}
            </>
          )}
          
          {view === 'form' && selectedMember ? (
            <MemberRoutineForm
              memberId={selectedMember.id}
              memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
              onSave={() => {
                loadData();
                setView('list');
              }}
              onCancel={() => setView('list')}
            />
          ) : view === 'form' && (
            renderMemberSelectionView()
          )}
        </>
      )}
      
      {/* Modal de cambio de estado */}
      {isStatusModalOpen && renderStatusChangeModal()}
    </div>
  );
};

export default MemberRoutines;