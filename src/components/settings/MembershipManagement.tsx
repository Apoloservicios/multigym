// src/components/settings/MembershipManagement.tsx

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, ChevronDown, ChevronUp, DollarSign, Calendar, Clock, Check, X, AlertCircle, Star } from 'lucide-react';
import { Membership, Activity, MembershipFormData, FormErrors } from '../../types/membership.types';
import useAuth from '../../hooks/useAuth';
import { getMemberships, createMembership, updateMembership, deleteMembership, togglePopularMembership } from '../../services/membershipService';
import { getActiveActivities } from '../../services/activity.service';
import { formatCurrency } from '../../utils/formatting.utils';
import { getActivities } from '../../services/activity.service';

const MembershipManagement: React.FC = () => {
  const { gymData } = useAuth();
  
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);
  const [expandedMembership, setExpandedMembership] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<MembershipFormData>({
    activityId: '',
    name: '',
    description: '',
    cost: '',
    duration: 30,
    maxAttendances: '',
    isActive: true
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [formErrors, setFormErrors] = useState<FormErrors>({});
const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
const [successMessage, setSuccessMessage] = useState<string>('');
const [showForm, setShowForm] = useState<boolean>(false);
  
  // Cargar membresías y actividades al montar el componente
 // Cargar membresías y actividades al montar el componente
 useEffect(() => {
  const fetchData = async () => {
    if (!gymData?.id) {
      console.log("No hay gymData.id disponible");
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("Iniciando carga de datos para el gimnasio:", gymData.id);
    
    try {
      // Cargar membresías desde Firebase
      console.log("Intentando cargar membresías...");
      const membershipsData = await getMemberships(gymData.id);
      console.log("Membresías cargadas:", membershipsData.length);
      setMemberships(membershipsData);
      
      // Cargar actividades activas desde Firebase
      console.log("Intentando cargar actividades...");
      const activitiesData = await getActiveActivities(gymData.id);
      console.log("Actividades cargadas:", activitiesData);
      setActivities(activitiesData);
      
      if (activitiesData.length === 0) {
        console.log("No se encontraron actividades activas. Probando cargar todas las actividades...");
        // Para propósitos de depuración, intentemos cargar todas las actividades
        const allActivities = await getActivities(gymData.id);
        console.log("Todas las actividades:", allActivities);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error al cargar datos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, [gymData?.id]);
  
  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Convertir a número cuando sea apropiado
    const processedValue = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
    
    setFormData({
      ...formData,
      [name]: processedValue
    });
    
    // Limpiar error del campo cuando se edita
    if (error) {
      setError('');
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
  // ================= FUNCIÓN DE VALIDACIÓN =================

const validateForm = (): FormErrors => {
  const errors: FormErrors = {};
  
  if (!formData.activityId) {
    errors.activityId = 'Debe seleccionar una actividad';
  }
  
  if (!formData.name.trim()) {
    errors.name = 'El nombre es requerido';
  }
  
  if (!formData.description.trim()) {
    errors.description = 'La descripción es requerida';
  }
  
  const cost = typeof formData.cost === 'string' ? parseFloat(formData.cost) : formData.cost;
  if (!cost || cost <= 0) {
    errors.cost = 'El costo debe ser mayor a 0';
  }
  
  if (!formData.duration || formData.duration <= 0) {
    errors.duration = 'La duración debe ser mayor a 0';
  }
  
  const maxAttendances = typeof formData.maxAttendances === 'string' 
    ? parseInt(formData.maxAttendances) 
    : formData.maxAttendances;
  if (maxAttendances !== undefined && maxAttendances < 0) {
    errors.maxAttendances = 'Las asistencias no pueden ser negativas';
  }
  
  return errors;
};
  
  // Abrir modal para nueva membresía
  const handleNewMembership = () => {
    setFormData({
      activityId: '',
      name: '',
      description: '',
      cost: '',
      duration: 30,
      maxAttendances: '',
      isActive: true
    });
    setIsEditing(false);
    setIsModalOpen(true);
    setError('');
    setSuccess(false);
  };
  
  // Abrir modal para editar membresía
  const handleEditMembership = (membership: Membership) => {
    setFormData({
      activityId: membership.activityId,
      name: membership.name,
      description: membership.description,
      cost: String(membership.cost),
      duration: membership.duration,
      maxAttendances: String(membership.maxAttendances),
      isActive: membership.isActive !== undefined ? membership.isActive : true
    });
    setCurrentMembership(membership);
    setIsEditing(true);
    setIsModalOpen(true);
    setError('');
    setSuccess(false);
  };
  
  // Abrir modal para confirmar eliminación
  const handleDeleteClick = (membership: Membership) => {
    setCurrentMembership(membership);
    setIsDeleteModalOpen(true);
  };
  
  // Confirmar eliminación
  const confirmDelete = async () => {
    if (!gymData?.id || !currentMembership) {
      return;
    }
    
    try {
      const result = await deleteMembership(gymData.id, currentMembership.id);
      
      if (result) {
        // Eliminar de la lista local
        setMemberships(prev => prev.filter(m => m.id !== currentMembership.id));
        setIsDeleteModalOpen(false);
        setCurrentMembership(null);
      }
    } catch (err: any) {
      console.error('Error deleting membership:', err);
      setError(err.message || 'Error al eliminar la membresía');
    }
  };
  
  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Validar formulario
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      if (!gymData?.id) {
        setError('No se pudo obtener la información del gimnasio');
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Preparar datos de la membresía
        const membershipData = {
          activityId: formData.activityId,
          name: formData.name,
          description: formData.description,
          cost: typeof formData.cost === 'string' ? parseFloat(formData.cost) : formData.cost,
          duration: formData.duration,
          maxAttendances: typeof formData.maxAttendances === 'string' 
            ? parseInt(formData.maxAttendances) 
            : formData.maxAttendances,
          isActive: formData.isActive
        };

        if (editingMembership) {
          // Actualizar membresía existente
          const success = await updateMembership(
            gymData.id, 
            editingMembership.id, 
            membershipData
          );
          
          if (success) {
            // Actualizar estado local
            setMemberships(prev => prev.map(m => 
              m.id === editingMembership.id 
                ? { ...m, ...membershipData } 
                : m
            ));
            
            setSuccessMessage('Membresía actualizada exitosamente');
            setShowForm(false);
            setEditingMembership(null);
            resetForm();
          } else {
            setError('Error al actualizar la membresía');
          }
        } else {
          // 🔧 CREAR NUEVA MEMBRESÍA - USANDO LA NUEVA ESTRUCTURA
          const result = await createMembership(gymData.id, membershipData);
          
          if (result.success && result.membershipId && result.membership) {
            // Agregar la nueva membresía al estado
            setMemberships(prev => [result.membership!, ...prev]);
            
            setSuccessMessage('Membresía creada exitosamente');
            setShowForm(false);
            resetForm();
          } else {
            // Manejar error si la creación falló
            setError(result.error || 'Error al crear la membresía');
            return; // Salir para no mostrar éxito
          }
        }
      } catch (error) {
        console.error('Error en formulario:', error);
        setError('Error inesperado al procesar la membresía');
      } finally {
        setLoading(false);
      }
  };
  

const resetForm = () => {
  setFormData({
    activityId: '',
    name: '',
    description: '',
    cost: '',
    duration: 30,
    maxAttendances: '',
    isActive: true
  });
  setFormErrors({});
  setEditingMembership(null);
};



  
  // Manejar estado de "popular"
  const handleTogglePopular = async (membership: Membership) => {
    if (!gymData?.id) return;
    
    try {
      const newPopularState = !membership.isPopular;
      
      const result = await togglePopularMembership(
        gymData.id, 
        membership.id, 
        newPopularState
      );
      
      if (result) {
        // Actualizar en la lista local
        setMemberships(prev => 
          prev.map(m => m.id === membership.id ? { ...m, isPopular: newPopularState } : m)
        );
      }
    } catch (error) {
      console.error('Error toggling popular status:', error);
    }
  };
  
  // Manejar expansión/colapso de detalles
  const toggleExpand = (id: string) => {
    setExpandedMembership(expandedMembership === id ? null : id);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Membresías</h2>
          <p className="text-gray-600 mt-1">Configura las membresías disponibles en tu gimnasio</p>
        </div>
        
        <button 
          onClick={handleNewMembership}
          className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nueva Membresía
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-500">Cargando membresías...</p>
        </div>
      ) : memberships.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <DollarSign size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay membresías configuradas</h3>
          <p className="text-gray-500 mb-4">Comienza creando tu primera membresía para ofrecerla a tus socios</p>
          <button 
            onClick={handleNewMembership}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Crear Membresía
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {memberships.map((membership) => (
            <div key={membership.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div 
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between bg-white cursor-pointer"
                onClick={() => toggleExpand(membership.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium">{membership.name}</h3>
                    {membership.isPopular && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                        Popular
                      </span>
                    )}
                    {membership.isActive === false && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">{membership.activityName}</p>
                </div>
                
                <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                  <div className="text-xl font-bold text-gray-800">{formatCurrency(membership.cost)}</div>
                  
                  <div className="mt-2 sm:mt-0 flex items-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePopular(membership);
                      }}
                      title={membership.isPopular ? "Quitar marca de popular" : "Marcar como popular"}
                      className={`p-1 ${membership.isPopular ? 'text-yellow-500 hover:text-yellow-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Star size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditMembership(membership);
                      }}
                      className="ml-2 text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(membership);
                      }}
                      className="ml-2 text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash size={18} />
                    </button>
                    <button className="ml-2 text-gray-600 p-1">
                      {expandedMembership === membership.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              
              {expandedMembership === membership.id && (
                <div className="p-4 bg-gray-50 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Detalles</h4>
                      <p className="text-sm text-gray-600">{membership.description}</p>
                      
                      <div className="mt-4 flex items-center text-sm text-gray-600">
                        <Clock size={16} className="mr-2 text-gray-400" />
                        <span>Duración: {membership.duration} días</span>
                      </div>
                      
                      <div className="mt-2 flex items-center text-sm text-gray-600">
                        <Calendar size={16} className="mr-2 text-gray-400" />
                        <span>Asistencias: {membership.maxAttendances}</span>
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Estadísticas</h4>
                      <div className="flex flex-wrap gap-4">
                        <div className="bg-white p-3 rounded-md border flex-1 min-w-[120px]">
                          <p className="text-sm text-gray-600">Socios activos</p>
                          <p className="text-xl font-bold text-gray-800 mt-1">{membership.activeMembers}</p>
                        </div>
                        
                        <div className="bg-white p-3 rounded-md border flex-1 min-w-[120px]">
                          <p className="text-sm text-gray-600">Ingresos mensuales</p>
                          <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(membership.cost * membership.activeMembers)}</p>
                        </div>
                        
                        <div className="bg-white p-3 rounded-md border flex-1 min-w-[120px]">
                          <p className="text-sm text-gray-600">Costo por día</p>
                          <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(membership.cost / membership.duration)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Modal para crear/editar membresía */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Editar Membresía' : 'Nueva Membresía'}</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
                <AlertCircle size={18} className="mr-2" />
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
                <Check size={18} className="mr-2" />
                {isEditing ? 'Membresía actualizada correctamente' : 'Membresía creada correctamente'}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Actividad */}
                <div>
                  <label htmlFor="activityId" className="block text-sm font-medium text-gray-700 mb-1">
                    Actividad *
                  </label>
                  <select
                    id="activityId"
                    name="activityId"
                    value={formData.activityId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar actividad</option>
                    {activities.map(activity => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Nombre */}
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
                    placeholder="Ej: Musculación Mensual"
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
                    placeholder="Describe los beneficios y condiciones"
                  />
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
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                          <div className="block w-10 h-6 rounded-full bg-blue-600"></div>
                          <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                        </div>
                      ) : (
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                          <div className="block w-10 h-6 rounded-full bg-gray-300"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                        </div>
                      )}
                      <span className="font-medium ml-2">
                        {formData.isActive ? 'Membresía Activa' : 'Membresía Inactiva'}
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-12">
                    {formData.isActive 
                      ? 'La membresía estará disponible para asignar a socios' 
                      : 'La membresía no estará disponible para asignar a nuevos socios'}
                  </p>
                </div>
                
                {/* Costo */}
                <div>
                  <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                    Costo *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      id="cost"
                      name="cost"
                      value={formData.cost}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
                
                {/* Duración y Asistencias */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                      Duración (días) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="number"
                        id="duration"
                        name="duration"
                        value={formData.duration}
                        onChange={handleChange}
                        className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="30"
                        min="1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="maxAttendances" className="block text-sm font-medium text-gray-700 mb-1">
                      Asistencias Máx. *
                    </label>
                    <input
                      type="number"
                      id="maxAttendances"
                      name="maxAttendances"
                      value={formData.maxAttendances}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="30"
                      min="1"
                    />
                  </div>
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
      {isDeleteModalOpen && currentMembership && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Eliminar Membresía</h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro que deseas eliminar la membresía <strong>{currentMembership.name}</strong>? Esta acción no se puede deshacer.
              </p>
              
              {currentMembership.activeMembers > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 text-left">
                  <p className="text-sm text-yellow-800">
                    <strong>¡Advertencia!</strong> Esta membresía tiene {currentMembership.activeMembers} socios activos. 
                    Al eliminarla, no afectará a las membresías ya asignadas, pero no podrás asignarla a nuevos socios.
                  </p>
                </div>
              )}
              
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

export default MembershipManagement;