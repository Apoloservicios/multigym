// src/components/routines/RoutineList.tsx
import React, { useState, useEffect } from 'react';
import { 
  Search, Edit, Trash, Filter, Grid, List, Plus, 
  Eye, Copy, CheckCircle, XCircle, AlertCircle, Calendar,Globe, Users
} from 'lucide-react';
import { getRoutines, duplicateRoutine, deleteRoutine } from '../../services/routine.service';
import { Routine, DifficultyLevel } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';

interface RoutineListProps {
  onNewRoutine: () => void;
  onEditRoutine: (routine: Routine) => void;
  onViewRoutine: (routine: Routine) => void;
  onDuplicateRoutine: (routine: Routine) => void;
}

const RoutineList: React.FC<RoutineListProps> = ({ 
  onNewRoutine, 
  onEditRoutine, 
  onViewRoutine,
  onDuplicateRoutine
}) => {
  const { gymData } = useAuth();
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [filteredRoutines, setFilteredRoutines] = useState<Routine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  
  // Filtros
  const [levelFilter, setLevelFilter] = useState<DifficultyLevel | 'all'>('all');
  const [daysFilter, setDaysFilter] = useState<number | 'all'>('all');
  const [templateFilter, setTemplateFilter] = useState<boolean | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<boolean | 'all'>(true); // Por defecto mostrar solo activas
  
  // Cargar rutinas al montar
  useEffect(() => {
    loadRoutines();
  }, [gymData?.id]);
  
  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [routines, searchTerm, levelFilter, daysFilter, templateFilter, activeFilter]);
  
  const loadRoutines = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getRoutines(gymData.id);
      setRoutines(data);
    } catch (err: any) {
      console.error('Error loading routines:', err);
      setError(err.message || 'Error al cargar las rutinas');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let result = [...routines];
    
    // Filtro de búsqueda
    if (searchTerm) {
      result = result.filter(routine => 
        routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        routine.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        routine.goal.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtro por nivel
    if (levelFilter !== 'all') {
      result = result.filter(routine => routine.level === levelFilter);
    }
    
    // Filtro por días
    if (daysFilter !== 'all') {
      result = result.filter(routine => routine.daysPerWeek === daysFilter);
    }
    
    // Filtro de plantillas
    if (templateFilter !== 'all') {
      result = result.filter(routine => routine.isTemplate === templateFilter);
    }
    
    // Filtro por estado
    if (activeFilter !== 'all') {
      result = result.filter(routine => routine.isActive === activeFilter);
    }
    
    // Ordenar por nombre
    result = result.sort((a, b) => a.name.localeCompare(b.name));
    
    setFilteredRoutines(result);
  };
  
  const handleDeleteClick = (routine: Routine) => {
    setRoutineToDelete(routine);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!gymData?.id || !routineToDelete) return;
    
    setLoading(true);
    
    try {
      await deleteRoutine(gymData.id, routineToDelete.id);
      
      // Actualizar la lista local
      setRoutines(prevRoutines => 
        prevRoutines.filter(r => r.id !== routineToDelete.id)
      );
      
      setIsDeleteModalOpen(false);
      setRoutineToDelete(null);
    } catch (err: any) {
      console.error('Error deleting routine:', err);
      setError(err.message || 'Error al eliminar la rutina');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDuplicate = async (routine: Routine) => {
    onDuplicateRoutine(routine);
  };
  
  const getDifficultyLabel = (level: DifficultyLevel): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
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
            placeholder="Buscar rutinas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as DifficultyLevel | 'all')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los niveles</option>
            {exerciseTypes.difficultyLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
          
          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los días</option>
            {[2, 3, 4, 5, 6].map(day => (
              <option key={day} value={day}>{day} días por semana</option>
            ))}
          </select>
          
          <select
            value={templateFilter === 'all' ? 'all' : templateFilter ? 'true' : 'false'}
            onChange={(e) => setTemplateFilter(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas</option>
            <option value="true">Solo plantillas</option>
            <option value="false">Solo personalizadas</option>
          </select>
          
          <select
            value={activeFilter === 'all' ? 'all' : activeFilter ? 'true' : 'false'}
            onChange={(e) => setActiveFilter(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Activas e inactivas</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas</option>
          </select>
          
          <div className="flex border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
              title="Vista de cuadrícula"
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
              title="Vista de lista"
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredRoutines.map(routine => (
        <div 
          key={routine.id}
          className={`bg-white rounded-lg shadow overflow-hidden ${!routine.isActive ? 'opacity-70' : ''}`}
        >
          {/* Encabezado con estado y tipo */}
          <div className="bg-blue-50 p-4 flex justify-between items-center">
            <div className="flex space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                routine.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {routine.isActive ? 'Activa' : 'Inactiva'}
              </span>
              
              {routine.isTemplate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Plantilla
                </span>
              )}
            </div>
            
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {getDifficultyLabel(routine.level)}
            </span>
          </div>
          
          {/* Información */}
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-1">{routine.name}</h3>


            <div className="mb-4">
                {/* Estadísticas de ejercicios */}
                <div className="text-xs text-gray-500">
                  {(() => {
                    let totalExercises = 0;
                    let globalExercises = 0;
                    Object.values(routine.exercises).forEach(dayExercises => {
                      dayExercises.forEach(exercise => {
                        totalExercises++;
                        if (exercise.isGlobal) globalExercises++;
                      });
                    });
                    return (
                      <span>
                        Total: {totalExercises} ejercicios
                        {globalExercises > 0 && (
                          <span className="block text-purple-600">
                            <Globe size={10} className="inline mr-1" />
                            {globalExercises} global{globalExercises !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </div>
              </div>
            
            <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
              <div className="flex items-center">
                <Calendar size={16} className="mr-1 text-blue-500" />
                <span>{routine.daysPerWeek} días/semana</span>
              </div>
              <div className="flex items-center">
                <Calendar size={16} className="mr-1 text-purple-500" />
                <span>{routine.duration} semanas</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{routine.description}</p>
            
            <div className="mb-4">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                Objetivo: {routine.goal}
              </span>
            </div>
            
            {/* Estadísticas */}
            <div className="border-t pt-3 mb-3">
              <div className="text-xs text-gray-500">
                Total de ejercicios:
                {Object.keys(routine.exercises).reduce((total, dayKey) => {
                  return total + routine.exercises[dayKey].length;
                }, 0)}
              </div>
            </div>
            
            {/* Acciones */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => onViewRoutine(routine)}
                className="px-3 py-1.5 border border-blue-300 text-blue-700 rounded-md text-sm hover:bg-blue-50 flex items-center"
              >
                <Eye size={16} className="mr-1" />
                Ver
              </button>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleDuplicate(routine)}
                  className="text-indigo-600 hover:text-indigo-800 p-1.5"
                  title="Duplicar"
                >
                  <Copy size={18} />
                </button>
                
                <button
                  onClick={() => onEditRoutine(routine)}
                  className="text-blue-600 hover:text-blue-800 p-1.5"
                  title="Editar"
                >
                  <Edit size={18} />
                </button>
                
                <button
                  onClick={() => handleDeleteClick(routine)}
                  className="text-red-600 hover:text-red-800 p-1.5"
                  title="Eliminar"
                >
                  <Trash size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderListView = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Días/Semana
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duración
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nivel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Objetivo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ejercicios
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredRoutines.map(routine => (
            <tr 
              key={routine.id}
              className={!routine.isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}
            >
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900 flex items-center">
                  {routine.name}
                  {routine.isTemplate && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Plantilla
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate max-w-xs">{routine.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {routine.daysPerWeek} días
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {routine.duration} semanas
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getDifficultyLabel(routine.level)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {routine.goal}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {(() => {
                    let totalExercises = 0;
                    let globalExercises = 0;
                    Object.values(routine.exercises).forEach(dayExercises => {
                      dayExercises.forEach(exercise => {
                        totalExercises++;
                        if (exercise.isGlobal) globalExercises++;
                      });
                    });
                    return (
                      <div>
                        <div>{totalExercises} total</div>
                        {globalExercises > 0 && (
                          <div className="text-xs text-purple-600 flex items-center">
                            <Globe size={10} className="mr-1" />
                            {globalExercises} global{globalExercises !== 1 ? 'es' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  routine.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {routine.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => onViewRoutine(routine)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Ver detalles"
                  >
                    <Eye size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDuplicate(routine)}
                    className="text-indigo-600 hover:text-indigo-800"
                    title="Duplicar"
                  >
                    <Copy size={18} />
                  </button>
                  
                  <button
                    onClick={() => onEditRoutine(routine)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClick(routine)}
                    className="text-red-600 hover:text-red-800"
                    title="Eliminar"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  return (
    <div>
      {/* Botón para añadir nueva rutina */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Rutinas</h2>
        <button
          onClick={onNewRoutine}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nueva Rutina
        </button>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          <span>{error}</span>
          <button 
            className="ml-auto" 
            onClick={() => setError(null)}
          >
            <XCircle size={20} />
          </button>
        </div>
      )}
      
      {/* Filtros */}
      {renderFilters()}
      
      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando rutinas...</span>
        </div>
      ) : filteredRoutines.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No se encontraron rutinas con los criterios seleccionados.</p>
          <button
            onClick={onNewRoutine}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 inline-flex items-center"
          >
            <Plus size={18} className="mr-2" />
            Crear Nueva Rutina
          </button>
        </div>
      ) : (
        // Vista de rutinas (grid o lista)
        viewMode === 'grid' ? renderGridView() : renderListView()
      )}
      
      {/* Modal de confirmación de eliminación */}
      {isDeleteModalOpen && routineToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-5">
              ¿Estás seguro de que deseas eliminar la rutina <strong>{routineToDelete.name}</strong>? Esta acción no se puede deshacer.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutineList;