// src/components/superadmin/GymFormModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Building2, User, Mail, Phone, CreditCard } from 'lucide-react';
import { Gym, subscriptionTypes } from '../../types/superadmin.types';
import { createGym, updateGym } from '../../services/superadmin.service';

interface GymFormModalProps {
  gym: Gym | null;
  onClose: () => void;
  onSave: (gym: Gym) => void;
}

const GymFormModal: React.FC<GymFormModalProps> = ({ gym, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Gym>>({
    name: '',
    owner: '',
    email: '',
    phone: '',
    cuit: '',
    status: 'trial',
    address: '',
    website: '',
    socialMedia: ''
  });
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Inicializar el formulario cuando se abre el modal
  useEffect(() => {
    if (gym) {
      setFormData({
        name: gym.name || '',
        owner: gym.owner || '',
        email: gym.email || '',
        phone: gym.phone || '',
        cuit: gym.cuit || '',
        status: gym.status || 'trial',
        address: gym.address || '',
        website: gym.website || '',
        socialMedia: gym.socialMedia || ''
      });
    } else {
      // Valores por defecto para nuevo gimnasio
      setFormData({
        name: '',
        owner: '',
        email: '',
        phone: '',
        cuit: '',
        status: 'trial',
        address: '',
        website: '',
        socialMedia: ''
      });
    }
  }, [gym]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const validateForm = (): boolean => {
    // Verificar campos requeridos
    if (!formData.name || !formData.owner || !formData.email || !formData.phone || !formData.cuit) {
      setError('Por favor completa todos los campos obligatorios');
      return false;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('El formato del email es inválido');
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
      let savedGym: Gym;
      
      if (gym?.id) {
        // Actualizar gimnasio existente
        await updateGym(gym.id, formData);
        savedGym = {
          ...gym,
          ...formData
        };
      } else {
        // Crear nuevo gimnasio
        savedGym = await createGym(formData as Omit<Gym, 'id'>);
      }
      
      onSave(savedGym);
    } catch (err: any) {
      console.error('Error saving gym:', err);
      setError(err.message || 'Error al guardar el gimnasio');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {gym ? 'Editar Gimnasio' : 'Nuevo Gimnasio'}
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
            {/* Datos básicos */}
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700">Información Básica</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre del gimnasio */}
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Gimnasio *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre del gimnasio"
                      required
                    />
                  </div>
                </div>
                
                {/* Propietario */}
                <div className="md:col-span-2">
                  <label htmlFor="owner" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Propietario *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="owner"
                      name="owner"
                      value={formData.owner}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre completo"
                      required
                    />
                  </div>
                </div>
                
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>
                </div>
                
                {/* Teléfono */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número de contacto"
                      required
                    />
                  </div>
                </div>
                
                {/* CUIT */}
                <div>
                  <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-1">
                    CUIT *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CreditCard size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="cuit"
                      name="cuit"
                      value={formData.cuit}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="XX-XXXXXXXX-X"
                      required
                    />
                  </div>
                </div>
                
                {/* Estado */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Estado *
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {subscriptionTypes.gymStatuses.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Información adicional */}
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700">Información Adicional</h3>
              <div className="space-y-4">
                {/* Dirección */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección física"
                  />
                </div>
                
                {/* Sitio web */}
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                    Sitio Web
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://ejemplo.com"
                  />
                </div>
                
                {/* Redes sociales */}
                <div>
                  <label htmlFor="socialMedia" className="block text-sm font-medium text-gray-700 mb-1">
                    Redes Sociales
                  </label>
                  <input
                    type="text"
                    id="socialMedia"
                    name="socialMedia"
                    value={formData.socialMedia}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="@usuario, /pagina"
                  />
                </div>
              </div>
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

export default GymFormModal;