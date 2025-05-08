// src/components/superadmin/SubscriptionPlanModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Plus, Minus, ToggleLeft, ToggleRight } from 'lucide-react';
import { SubscriptionPlan, subscriptionTypes } from '../../types/superadmin.types';
import { formatCurrency } from '../../utils/formatting.utils';

interface SubscriptionPlanModalProps {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSave: (plan: SubscriptionPlan) => void;
}

const SubscriptionPlanModal: React.FC<SubscriptionPlanModalProps> = ({ plan, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: '',
    description: '',
    duration: 30,
    price: 0,
    features: [],
    isActive: true,
    maxGyms: undefined,
    maxAdmins: undefined,
    maxUsers: undefined,
    maxMembers: undefined
  });
  
  const [newFeature, setNewFeature] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Inicializar el formulario cuando se abre el modal
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        description: plan.description || '',
        duration: plan.duration || 30,
        price: plan.price || 0,
        features: [...(plan.features || [])],
        isActive: plan.isActive !== undefined ? plan.isActive : true,
        maxGyms: plan.maxGyms,
        maxAdmins: plan.maxAdmins,
        maxUsers: plan.maxUsers,
        maxMembers: plan.maxMembers
      });
    } else {
      // Valores por defecto para nuevo plan
      setFormData({
        name: '',
        description: '',
        duration: 30,
        price: 0,
        features: [],
        isActive: true,
        maxGyms: undefined,
        maxAdmins: undefined,
        maxUsers: undefined,
        maxMembers: undefined
      });
    }
  }, [plan]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? undefined : Number(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };
  
  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      features: [...(prev.features || []), newFeature.trim()]
    }));
    
    setNewFeature('');
  };
  
  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index)
    }));
  };
  
  const validateForm = (): boolean => {
    // Verificar campos requeridos
    if (!formData.name || !formData.description) {
      setError('Por favor completa todos los campos obligatorios');
      return false;
    }
    
    // Validar precio
    if (formData.price === undefined || formData.price < 0) {
      setError('El precio debe ser mayor o igual a cero');
      return false;
    }
    
    // Validar duración
    if (!formData.duration || formData.duration <= 0) {
      setError('La duración debe ser mayor que cero');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Preparar datos para guardar
      const planToSave: SubscriptionPlan = {
        id: plan?.id || '',
        name: formData.name || '',
        description: formData.description || '',
        duration: formData.duration || 30,
        price: formData.price || 0,
        features: formData.features || [],
        isActive: formData.isActive !== undefined ? formData.isActive : true,
        maxGyms: formData.maxGyms,
        maxAdmins: formData.maxAdmins,
        maxUsers: formData.maxUsers,
        maxMembers: formData.maxMembers
      };
      
      onSave(planToSave);
    } catch (err: any) {
      console.error('Error saving subscription plan:', err);
      setError(err.message || 'Error al guardar el plan de suscripción');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {plan ? 'Editar Plan de Suscripción' : 'Nuevo Plan de Suscripción'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Información básica */}
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700">Información Básica</h3>
              <div className="space-y-4">
                {/* Nombre del plan */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Plan *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ej. Plan Básico, Plan Premium, etc."
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
                    placeholder="Describe brevemente el plan..."
                    required
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Duración */}
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                      Duración *
                    </label>
                    <select
                      id="duration"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {subscriptionTypes.durationOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Precio */}
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                      Precio *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">$</span>
                      </div>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        className="pl-7 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>
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
                        {formData.isActive ? 'Plan Activo' : 'Plan Inactivo'}
                      </span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.isActive 
                      ? 'El plan estará disponible para asignar a gimnasios' 
                      : 'El plan no estará disponible para nuevas suscripciones'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Características */}
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700">Características</h3>
              <div className="space-y-4">
                {/* Lista de características */}
                <div className="mt-2">
                  <div className="bg-gray-50 rounded-md p-3">
                    {formData.features && formData.features.length > 0 ? (
                      <ul className="space-y-2">
                        {formData.features.map((feature, index) => (
                          <li key={index} className="flex items-center justify-between">
                            <div className="text-sm">{feature}</div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFeature(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Minus size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-2">
                        No hay características definidas
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Agregar nueva característica */}
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Agregar nueva característica..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Límites */}
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700">Límites (Opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Número máximo de gimnasios */}
                <div>
                  <label htmlFor="maxGyms" className="block text-sm font-medium text-gray-700 mb-1">
                    Máximo de Gimnasios
                  </label>
                  <input
                    type="number"
                    id="maxGyms"
                    name="maxGyms"
                    value={formData.maxGyms === undefined ? '' : formData.maxGyms}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin límite"
                    min="1"
                  />
                </div>
                
                {/* Número máximo de administradores */}
                <div>
                  <label htmlFor="maxAdmins" className="block text-sm font-medium text-gray-700 mb-1">
                    Máximo de Administradores
                  </label>
                  <input
                    type="number"
                    id="maxAdmins"
                    name="maxAdmins"
                    value={formData.maxAdmins === undefined ? '' : formData.maxAdmins}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin límite"
                    min="1"
                  />
                </div>
                
                {/* Número máximo de usuarios */}
                <div>
                  <label htmlFor="maxUsers" className="block text-sm font-medium text-gray-700 mb-1">
                    Máximo de Usuarios
                  </label>
                  <input
                    type="number"
                    id="maxUsers"
                    name="maxUsers"
                    value={formData.maxUsers === undefined ? '' : formData.maxUsers}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin límite"
                    min="1"
                  />
                </div>
                
                {/* Número máximo de miembros */}
                <div>
                  <label htmlFor="maxMembers" className="block text-sm font-medium text-gray-700 mb-1">
                    Máximo de Miembros
                  </label>
                  <input
                    type="number"
                    id="maxMembers"
                    name="maxMembers"
                    value={formData.maxMembers === undefined ? '' : formData.maxMembers}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin límite"
                    min="1"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Deja en blanco para no establecer límites.
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              disabled={loading}
            >
              <X size={18} className="mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Check size={18} className="mr-2" />
              )}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionPlanModal;