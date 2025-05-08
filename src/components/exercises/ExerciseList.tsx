// src/components/exercises/ExerciseList.tsx
import React, { useState, useEffect } from 'react';
import { 
  Search, Edit, Trash, Filter, Grid, List, Plus, 
  Eye, CheckCircle, XCircle, AlertCircle, ArrowUpDown
} from 'lucide-react';
import { getExercises, toggleExerciseStatus, deleteExercise } from '../../services/exercise.service';
import { Exercise, MuscleGroup, DifficultyLevel } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';

interface ExerciseListProps {
  onNewExercise: () => void;
  onEditExercise: (exercise: Exercise) => void;
  onViewExercise: (exercise: Exercise) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = ({ 
  onNewExercise, 
  onEditExercise,
  onViewExercise
}) => {
  const { gymData } = useAuth();
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [exerciseToToggle, setExerciseToToggle] = useState<Exercise | null>(null);
  const [newStatus, setNewStatus] = useState(false);
  
  // Filtros
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<MuscleGroup | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<boolean | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'muscleGroup'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Cargar ejercicios al montar
  useEffect(() => {
    loadExercises();
  }, [gymData?.id]);
  
  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [exercises, searchTerm, muscleGroupFilter, difficultyFilter, activeFilter, sortBy, sortDirection]);
  
  const loadExercises = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getExercises(gymData.id);
      setExercises(data);
    } catch (err: any) {
      console.error('Error loading exercises:', err);
      setError(err.message || 'Error al cargar los ejercicios');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let result = [...exercises];
    
    // Filtro de búsqueda
    if (searchTerm) {
      result = result.filter(ex => 
        ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ex.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtro por grupo muscular
    if (muscleGroupFilter !== 'all') {
      result = result.filter(ex => ex.muscleGroup === muscleGroupFilter);
    }
    
    // Filtro por dificultad
    if (difficultyFilter !== 'all') {
      result = result.filter(ex => ex.difficulty === difficultyFilter);
    }
    
    // Filtro por estado activo/inactivo
    if (activeFilter !== 'all') {
      result = result.filter(ex => ex.isActive === activeFilter);
    }
    
    // Ordenamiento
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      } else {
        // Por grupo muscular
        return sortDirection === 'asc' 
          ? a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)
          : b.muscleGroup.localeCompare(a.muscleGroup) || a.name.localeCompare(b.name);
      }
    });
    
    setFilteredExercises(result);
  };
  
  const handleDeleteClick = (exercise: Exercise) => {
    setExerciseToDelete(exercise);
    setIsDeleteModalOpen(true);
  };
  
  const handleToggleStatus = (exercise: Exercise) => {
    setExerciseToToggle(exercise);
    setNewStatus(!exercise.isActive);
    setIsStatusModalOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!gymData?.id || !exerciseToDelete) return;
    
    setLoading(true);
    
    try {
      await deleteExercise(gymData.id, exerciseToDelete.id);
      
      // Actualizar la lista local
      setExercises(prevExercises => 
        prevExercises.filter(e => e.id !== exerciseToDelete.id)
      );
      
      setIsDeleteModalOpen(false);
      setExerciseToDelete(null);
    } catch (err: any) {
      console.error('Error deleting exercise:', err);
      setError(err.message || 'Error al eliminar el ejercicio');
    } finally {
      setLoading(false);
    }
  };
  
  const confirmToggleStatus = async () => {
    if (!gymData?.id || !exerciseToToggle) return;
    
    setLoading(true);
    
    try {
      await toggleExerciseStatus(gymData.id, exerciseToToggle.id, newStatus);
      
      // Actualizar la lista local
      setExercises(prevExercises => 
        prevExercises.map(e => 
          e.id === exerciseToToggle.id ? { ...e, isActive: newStatus } : e
        )
      );
      
      setIsStatusModalOpen(false);
      setExerciseToToggle(null);
    } catch (err: any) {
      console.error('Error toggling exercise status:', err);
      setError(err.message || 'Error al cambiar el estado del ejercicio');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const toggleSortField = () => {
    setSortBy(prev => prev === 'name' ? 'muscleGroup' : 'name');
    setSortDirection('asc');
  };
  
  const getMuscleGroupLabel = (group: MuscleGroup): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
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
            placeholder="Buscar ejercicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <select
            value={muscleGroupFilter}
            onChange={(e) => setMuscleGroupFilter(e.target.value as MuscleGroup | 'all')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los grupos</option>
            {exerciseTypes.muscleGroups.map(group => (
              <option key={group.value} value={group.value}>{group.label}</option>
            ))}
          </select>
          
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as DifficultyLevel | 'all')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las dificultades</option>
            {exerciseTypes.difficultyLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
          
          <select
            value={activeFilter === 'all' ? 'all' : activeFilter ? 'true' : 'false'}
            onChange={(e) => setActiveFilter(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
          
          <button
            onClick={toggleSortField}
            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            title={`Ordenar por ${sortBy === 'name' ? 'nombre' : 'grupo muscular'}`}
          >
            <ArrowUpDown size={16} />
            <span>{sortBy === 'name' ? 'Nombre' : 'Grupo'}</span>
          </button>
          
          <button
            onClick={toggleSortDirection}
            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            title={`Orden ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}`}
          >
            {sortDirection === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
          
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredExercises.map(exercise => (
        <div 
          key={exercise.id}
          className={`bg-white rounded-lg shadow overflow-hidden ${!exercise.isActive ? 'opacity-70' : ''}`}
        >
          {/* Imagen o placeholder */}
          <div className="h-48 bg-gray-100 flex items-center justify-center relative">
            {exercise.image ? (
              <img 
                src={exercise.image} 
                alt={exercise.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <div className="text-3xl font-bold text-blue-200 mb-2">
                  {getMuscleGroupLabel(exercise.muscleGroup)}
                </div>
                <div className="text-gray-400">Sin imagen</div>
              </div>
            )}
            
            {/* Badge de estado */}
            <div className="absolute top-2 right-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                exercise.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {exercise.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
          
          {/* Información */}
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-1 truncate" title={exercise.name}>
              {exercise.name}
            </h3>
            
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs">
                {getMuscleGroupLabel(exercise.muscleGroup)}
              </span>
              <span className="mx-1">•</span>
              <span className="bg-purple-100 text-purple-800 rounded-full px-2 py-0.5 text-xs">
                {getDifficultyLabel(exercise.difficulty)}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {exercise.description}
            </p>
            
            {/* Acciones */}
            <div className="flex justify-between">
              <button
                onClick={() => onViewExercise(exercise)}
                className="text-blue-600 hover:text-blue-800"
              >
                <Eye size={18} />
              </button>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggleStatus(exercise)}
                  className={exercise.isActive ? "text-orange-600 hover:text-orange-800" : "text-green-600 hover:text-green-800"}
                  title={exercise.isActive ? "Desactivar" : "Activar"}
                >
                  {exercise.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                </button>
                
                <button
                  onClick={() => onEditExercise(exercise)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Editar"
                >
                  <Edit size={18} />
                </button>
                
                <button
                  onClick={() => handleDeleteClick(exercise)}
                  className="text-red-600 hover:text-red-800"
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
              Grupo Muscular
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dificultad
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
          {filteredExercises.map(exercise => (
            <tr 
              key={exercise.id}
              className={!exercise.isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{exercise.name}</div>
                <div className="text-sm text-gray-500 truncate max-w-xs">{exercise.description}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getMuscleGroupLabel(exercise.muscleGroup)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {getDifficultyLabel(exercise.difficulty)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  exercise.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {exercise.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => onViewExercise(exercise)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Ver detalles"
                  >
                    <Eye size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleToggleStatus(exercise)}
                    className={exercise.isActive ? "text-orange-600 hover:text-orange-800" : "text-green-600 hover:text-green-800"}
                    title={exercise.isActive ? "Desactivar" : "Activar"}
                  >
                    {exercise.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </button>
                  
                  <button
                    onClick={() => onEditExercise(exercise)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteClick(exercise)}
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
      {/* Botón para añadir nuevo ejercicio */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ejercicios</h2>
        <button
          onClick={onNewExercise}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nuevo Ejercicio
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
          <span className="ml-3 text-gray-500">Cargando ejercicios...</span>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No se encontraron ejercicios con los criterios seleccionados.</p>
          <button
            onClick={onNewExercise}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 inline-flex items-center"
          >
            <Plus size={18} className="mr-2" />
            Crear Nuevo Ejercicio
          </button>
        </div>
      ) : (
        // Vista de ejercicios (grid o lista)
        viewMode === 'grid' ? renderGridView() : renderListView()
      )}
      
      {/* Modal de confirmación de eliminación */}
      {isDeleteModalOpen && exerciseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-5">
              ¿Estás seguro de que deseas eliminar el ejercicio <strong>{exerciseToDelete.name}</strong>? Esta acción no se puede deshacer.
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
      
      {/* Modal de cambio de estado */}
      {isStatusModalOpen && exerciseToToggle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              {newStatus ? 'Activar ejercicio' : 'Desactivar ejercicio'}
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              {newStatus 
                ? `¿Estás seguro de que deseas activar el ejercicio "${exerciseToToggle.name}"?`
                : `¿Estás seguro de que deseas desactivar el ejercicio "${exerciseToToggle.name}"?`
              }
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggleStatus}
                className={`px-4 py-2 text-white rounded-md ${
                  newStatus ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
                disabled={loading}
              >
                {loading ? 'Procesando...' : newStatus ? 'Activar' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseList;