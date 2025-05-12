import React, { useState, useEffect } from 'react';
import { 
  Search, Edit, Trash, Filter, Grid, List, Plus, Eye, CheckCircle, 
  XCircle, AlertCircle, ArrowUpDown, RefreshCw, Copy, Activity
} from 'lucide-react';
import { getGlobalExercises, toggleGlobalExerciseStatus, deleteGlobalExercise } from '../../services/global-exercise.service';
import { GlobalExercise, GlobalExerciseFilter, exerciseCategories } from '../../types/global-exercise.types';
import exerciseTypes from '../../types/exercise.types';

interface GlobalExerciseListProps {
  onNewExercise: () => void;
  onEditExercise: (exercise: GlobalExercise) => void;
  onViewExercise: (exercise: GlobalExercise) => void;
}

const GlobalExerciseList: React.FC<GlobalExerciseListProps> = ({ 
  onNewExercise, 
  onEditExercise,
  onViewExercise
}) => {
  const [exercises, setExercises] = useState<GlobalExercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<GlobalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<GlobalExercise | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [exerciseToToggle, setExerciseToToggle] = useState<GlobalExercise | null>(null);
  const [newStatus, setNewStatus] = useState(false);
  
  // Filtros
  const [filter, setFilter] = useState<GlobalExerciseFilter>({
    searchTerm: '',
    muscleGroup: undefined,
    difficulty: undefined,
    category: undefined,
    isActive: undefined
  });
  
  const [sortBy, setSortBy] = useState<'name' | 'muscleGroup' | 'difficulty'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byCategory: {} as Record<string, number>
  });
  
  // Cargar ejercicios al montar
  useEffect(() => {
    loadExercises();
  }, []);
  
  // Aplicar filtros cuando cambian
  useEffect(() => {
    applyFilters();
  }, [exercises, filter, sortBy, sortDirection]);
  
  const loadExercises = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getGlobalExercises();
      setExercises(data);
      calculateStats(data);
    } catch (err: any) {
      console.error('Error loading global exercises:', err);
      setError(err.message || 'Error al cargar los ejercicios globales');
    } finally {
      setLoading(false);
    }
  };
  
  const calculateStats = (exerciseList: GlobalExercise[]) => {
    const total = exerciseList.length;
    const active = exerciseList.filter(ex => ex.isActive).length;
    const inactive = total - active;
    
    const byCategory = exerciseList.reduce((acc, ex) => {
      const category = ex.category || 'sin_categoria';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    setStats({ total, active, inactive, byCategory });
  };
  
  const applyFilters = () => {
    let result = [...exercises];
    
    // Filtro de búsqueda
    if (filter.searchTerm) {
      const search = filter.searchTerm.toLowerCase();
      result = result.filter(ex => 
        ex.name.toLowerCase().includes(search) ||
        ex.description.toLowerCase().includes(search) ||
        (ex.equipment && ex.equipment.toLowerCase().includes(search))
      );
    }
    
    // Filtros específicos
    if (filter.muscleGroup) {
      result = result.filter(ex => ex.muscleGroup === filter.muscleGroup);
    }
    
    if (filter.difficulty) {
      result = result.filter(ex => ex.difficulty === filter.difficulty);
    }
    
    if (filter.category) {
      result = result.filter(ex => ex.category === filter.category);
    }
    
    if (filter.isActive !== undefined) {
      result = result.filter(ex => ex.isActive === filter.isActive);
    }
    
    // Ordenamiento
    result.sort((a, b) => {
      let aValue: string = '';
      let bValue: string = '';
      
      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'muscleGroup':
          aValue = a.muscleGroup;
          bValue = b.muscleGroup;
          break;
        case 'difficulty':
          aValue = a.difficulty;
          bValue = b.difficulty;
          break;
      }
      
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    setFilteredExercises(result);
  };
  
  const handleDeleteClick = (exercise: GlobalExercise) => {
    setExerciseToDelete(exercise);
    setIsDeleteModalOpen(true);
  };
  
  const handleToggleStatus = (exercise: GlobalExercise) => {
    setExerciseToToggle(exercise);
    setNewStatus(!exercise.isActive);
    setIsStatusModalOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!exerciseToDelete) return;
    
    setLoading(true);
    
    try {
      await deleteGlobalExercise(exerciseToDelete.id);
      
      // Actualizar la lista local
      setExercises(prevExercises => 
        prevExercises.filter(e => e.id !== exerciseToDelete.id)
      );
      
      setIsDeleteModalOpen(false);
      setExerciseToDelete(null);
    } catch (err: any) {
      console.error('Error deleting global exercise:', err);
      setError(err.message || 'Error al eliminar el ejercicio');
    } finally {
      setLoading(false);
    }
  };
  
  const confirmToggleStatus = async () => {
    if (!exerciseToToggle) return;
    
    setLoading(true);
    
    try {
      await toggleGlobalExerciseStatus(exerciseToToggle.id, newStatus);
      
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
  
  const handleFilterChange = (field: keyof GlobalExerciseFilter, value: any) => {
    setFilter(prev => ({
      ...prev,
      [field]: value === 'all' ? undefined : value
    }));
  };
  
  const resetFilters = () => {
    setFilter({
      searchTerm: '',
      muscleGroup: undefined,
      difficulty: undefined,
      category: undefined,
      isActive: undefined
    });
  };
  
  const getMuscleGroupLabel = (group: string): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
  };
  
  const getDifficultyLabel = (level: string): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
  };
  
  const getCategoryLabel = (category: string): string => {
    const found = exerciseCategories.find(c => c.value === category);
    return found ? found.label : category;
  };
  
  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Ejercicios</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Activity size={24} className="text-blue-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Activos</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle size={24} className="text-green-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Inactivos</p>
            <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
          </div>
          <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
            <XCircle size={24} className="text-red-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Categorías</p>
            <p className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</p>
          </div>
          <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Filter size={24} className="text-purple-600" />
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderFilters = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Buscador */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar ejercicios..."
            value={filter.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filter.muscleGroup || 'all'}
            onChange={(e) => handleFilterChange('muscleGroup', e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los grupos</option>
            {exerciseTypes.muscleGroups.map(group => (
              <option key={group.value} value={group.value}>{group.label}</option>
            ))}
          </select>
          
          <select
            value={filter.difficulty || 'all'}
            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las dificultades</option>
            {exerciseTypes.difficultyLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
          
          <select
            value={filter.category || 'all'}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las categorías</option>
            {exerciseCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <select
            value={filter.isActive === undefined ? 'all' : filter.isActive ? 'true' : 'false'}
            onChange={(e) => handleFilterChange('isActive', e.target.value === 'all' ? undefined : e.target.value === 'true')}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
          
          <button
            onClick={resetFilters}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center"
          >
            <RefreshCw size={16} className="mr-1" />
            Limpiar
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
            
            {/* Badges */}
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                exercise.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {exercise.isActive ? 'Activo' : 'Inactivo'}
              </span>
              {exercise.category && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {getCategoryLabel(exercise.category)}
                </span>
              )}
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
            
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {exercise.description}
            </p>
            
            {exercise.equipment && (
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Equipamiento:</span> {exercise.equipment}
              </p>
            )}
            
            {/* Acciones */}
            <div className="flex justify-between">
              <button
                onClick={() => onViewExercise(exercise)}
                className="text-blue-600 hover:text-blue-800"
                title="Ver detalles"
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
              Categoría
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
              <td className="px-6 py-4">
                <div className="flex items-center">
                  {exercise.image ? (
                    <img 
                      src={exercise.image} 
                      alt={exercise.name}
                      className="h-10 w-10 rounded object-cover mr-3"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center mr-3">
                      <span className="text-gray-500 text-xs">IMG</span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{exercise.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{exercise.description}</div>
                  </div>
                </div>
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
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {getCategoryLabel(exercise.category || 'basico')}
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
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ejercicios Globales</h2>
        <button
          onClick={onNewExercise}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nuevo Ejercicio
        </button>
      </div>
      
      {/* Estadísticas */}
      {renderStats()}
      
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
     
     {/* Contenido principal */}
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
             ¿Estás seguro de que deseas eliminar el ejercicio <strong>{exerciseToDelete.name}</strong>? 
             Esta acción no se puede deshacer y el ejercicio será eliminado de forma permanente.
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
               ? `¿Estás seguro de que deseas activar el ejercicio "${exerciseToToggle.name}"? Estará disponible para todos los gimnasios.`
               : `¿Estás seguro de que deseas desactivar el ejercicio "${exerciseToToggle.name}"? No estará visible para los gimnasios.`
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

export default GlobalExerciseList;