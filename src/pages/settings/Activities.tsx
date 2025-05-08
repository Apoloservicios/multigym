// src/pages/settings/Activities.tsx
import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash, Search, AlertCircle, Check, X, ToggleLeft, ToggleRight, Info
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { 
  getActivities, 
  createActivity, 
  updateActivity, 
  deleteActivity, 
  Activity 
} from '../../services/activity.service';

const Activities: React.FC = () => {
  const { gymData } = useAuth();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  
  // Cargar actividades al montar el componente
  useEffect(() => {
    fetchActivities();
  }, [gymData?.id]);
  
  // Función para cargar las actividades desde Firestore
  const fetchActivities = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const activitiesData = await getActivities(gymData.id);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  };
  
  // Filtrar actividades según el término de búsqueda
  const filteredActivities = activities.filter(activity => 
    activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Abrir modal para nueva actividad
  const handleNewActivity = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true
    });
    setIsEditing(false);
    setError('');
    setIsModalOpen(true);
  };
  
  // Abrir modal para editar actividad
  const handleEditActivity = (activity: Activity) => {
    setFormData({
      name: activity.name,
      description: activity.description,
      isActive: activity.isActive !== undefined ? activity.isActive : true
    });
    setCurrentActivity(activity);
    setIsEditing(true);
    setError('');
    setIsModalOpen(true);
  };
  
  // Abrir modal para confirmar eliminación
  const handleDeleteClick = (activity: Activity) => {
    setCurrentActivity(activity);
    setIsDeleteModalOpen(true);
  };
  
  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Manejar cambio en el toggle de estado activo
  const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };
  
  // Validar formulario
  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('El nombre de la actividad es obligatorio');
      return false;
    }
    
    if (!formData.description.trim()) {
      setError('La descripción es obligatoria');
      return false;
    }
    
    return true;
  };
  
  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setError('');
    setSuccess(false);
    
    try {
      if (isEditing && currentActivity) {
        // Actualizar actividad existente
        await updateActivity(gymData.id, currentActivity.id, formData);
        
        // Actualizar en la lista local
        setActivities(prev => 
          prev.map(activity => 
            activity.id === currentActivity.id 
              ? { ...activity, ...formData } 
              : activity
          )
        );
      } else {
        // Crear nueva actividad
        const newActivity = await createActivity(gymData.id, formData);
        
        // Añadir a la lista local
        setActivities(prev => [...prev, newActivity]);
      }
      
      setSuccess(true);
      
      // Cerrar modal después de un breve retraso
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error('Error saving activity:', err);
      setError(err.message || 'Error al guardar la actividad');
    }
  };
  
  // Manejar eliminación de actividad
  const confirmDelete = async () => {
    if (!gymData?.id || !currentActivity) {
      return;
    }
    
    try {
      await deleteActivity(gymData.id, currentActivity.id);
      
      // Eliminar de la lista local
      setActivities(prev => prev.filter(activity => activity.id !== currentActivity.id));
      
      setIsDeleteModalOpen(false);
      setCurrentActivity(null);
    } catch (err: any) {
      console.error('Error deleting activity:', err);
      setError(err.message || 'Error al eliminar la actividad');
    }
  };
  
  // Renderizar pantalla de carga
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Cargando actividades...</span>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración de Actividades</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Cabecera con buscador y botón de añadir */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <div className="w-full sm:w-auto mb-4 sm:mb-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar actividades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <button
            onClick={handleNewActivity}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
          >
            <Plus size={18} className="mr-2" />
            Nueva Actividad
          </button>
        </div>
        
        {/* Lista de actividades */}
        {activities.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Info size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No hay actividades configuradas</h3>
            <p className="text-gray-500 mb-4">Agrega actividades para poder asignarlas a las membresías</p>
            <button 
              onClick={handleNewActivity}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Crear Actividad
            </button>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No se encontraron actividades con el término "{searchTerm}"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{activity.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 line-clamp-2">{activity.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activity.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.isActive !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditActivity(activity)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(activity)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Modal para crear/editar actividad */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? 'Editar Actividad' : 'Nueva Actividad'}
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
                {isEditing ? 'Actividad actualizada correctamente' : 'Actividad creada correctamente'}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Nombre de la actividad */}
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
                    placeholder="ej. Musculación, Pilates, Yoga..."
                    required
                  />
                </div>
                
                {/* Descripción */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe la actividad"
                    required
                  ></textarea>
                </div>
                
                {/* Estado (activo/inactivo) */}
                <div>
                  <div className="flex items-center">
                    <button 
                      type="button"
                      onClick={handleToggleActive}
                      className="flex items-center focus:outline-none"
                    >
                      {formData.isActive ? (
                        <ToggleRight size={32} className="text-blue-600 mr-2" />
                      ) : (
                        <ToggleLeft size={32} className="text-gray-400 mr-2" />
                      )}
                      <span className="font-medium">
                        {formData.isActive ? 'Actividad Activa' : 'Actividad Inactiva'}
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.isActive 
                      ? 'La actividad estará disponible para asignar a membresías' 
                      : 'La actividad no estará disponible para nuevas membresías'}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                >
                  <X size={18} className="mr-2" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
                >
                  <Check size={18} className="mr-2" />
                  {isEditing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de confirmación de eliminación */}
      {isDeleteModalOpen && currentActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Eliminar Actividad</h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro que deseas eliminar la actividad <strong>{currentActivity.name}</strong>? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Activities;