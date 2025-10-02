// src/components/members/MemberForm.tsx - CORREGIDO: Sin duplicación ni múltiples exports

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Camera, X } from 'lucide-react';
import { MemberFormData } from '../../types/member.types';
import { 
  htmlDateToLocalDate, 
  localDateToHtmlDate, 
  safelyConvertToDate,
  formatDisplayDate,
  calculateAge,
  dateToString,
  firebaseDateToHtmlDate,
  htmlDateToUTCDate
} from '../../utils/date.utils';

interface MemberFormProps {
  initialData?: Partial<MemberFormData> | any;
  onSubmit: (data: MemberFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
}

const MemberForm: React.FC<MemberFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  title = 'Nuevo Socio'
}) => {
  // ✅ FUNCIÓN HELPER PARA CONVERTIR DATOS INICIALES (CORREGIDA PARA TIMEZONE)
const convertInitialData = (data: any): Partial<MemberFormData> => {
  if (!data) return {};
    
  // ✅ USAR LA NUEVA FUNCIÓN QUE MANEJA TIMEZONE CORRECTAMENTE
  const birthDateString = data.birthDate ? firebaseDateToHtmlDate(data.birthDate) : '';
  
  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    birthDate: birthDateString,
    photo: null,
    status: data.status || 'active'
  };
};

  // Inicializar datos del formulario
  const [formData, setFormData] = useState<MemberFormData>(() => {
    const defaultData: MemberFormData = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      birthDate: '',
      photo: null,
      status: 'active',
      dni: ''       // ⭐ NUEVO

    };

    if (initialData) {
      const convertedData = convertInitialData(initialData);
      return {
        ...defaultData,
        ...convertedData
      };
    }

    return defaultData;
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Manejar cambios en inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error específico
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Manejar cambio de archivo de foto
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({
          ...prev,
          photo: 'Debe seleccionar un archivo de imagen válido'
        }));
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          photo: 'La imagen debe ser menor a 5MB'
        }));
        return;
      }

      setFormData(prev => ({
        ...prev,
        photo: file
      }));

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Limpiar error
      setErrors(prev => ({
        ...prev,
        photo: ''
      }));
    }
  };

  // Remover foto
  const removePhoto = () => {
    setFormData(prev => ({
      ...prev,
      photo: null
    }));
    setPhotoPreview(null);
    
    // Limpiar input de archivo
    const photoInput = document.getElementById('photo') as HTMLInputElement;
    if (photoInput) {
      photoInput.value = '';
    }
  };


const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Limpiar errores previos
  setErrors({});
  
  // Objeto para acumular errores
  const newErrors: { [key: string]: string } = {};
  
  // ✅ VALIDACIONES OBLIGATORIAS
  if (!formData.firstName.trim()) {
    newErrors.firstName = 'El nombre es obligatorio';
  }
  
  if (!formData.lastName.trim()) {
    newErrors.lastName = 'El apellido es obligatorio';
  }
  
  if (!formData.phone.trim()) {
    newErrors.phone = 'El teléfono es obligatorio';
  }
  
  // ✅ EMAIL OPCIONAL - Solo validar formato si hay algo
  if (formData.email && formData.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }
  }
  
  // ✅ DNI OPCIONAL - Solo validar si hay algo
  if (formData.dni && formData.dni.trim()) {
    if (!/^\d+$/.test(formData.dni)) {
      newErrors.dni = 'El DNI debe contener solo números';
    }
  }
  
  // Validar fecha de nacimiento si existe
  if (formData.birthDate) {
    const birthDate = htmlDateToLocalDate(formData.birthDate);
    const today = new Date();
    
    if (birthDate > today) {
      newErrors.birthDate = 'La fecha de nacimiento no puede ser futura';
    }
    
    const age = calculateAge(birthDate);
    if (age !== null && age > 120) {
      newErrors.birthDate = 'La fecha de nacimiento no es válida';
    }
  }
  
  // Si hay errores, mostrarlos y no continuar
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }
  
  // ✅ GUARDAR - Usar el prop onSubmit que ya existe
  try {
    await onSubmit(formData);
  } catch (err: any) {
    setErrors({
      general: err.message || 'Error al guardar el socio'
    });
  }
};

  // Calcular edad si hay fecha de nacimiento
  const displayAge = formData.birthDate ? calculateAge(htmlDateToLocalDate(formData.birthDate)) : null;

  // ✅ MOSTRAR FOTO EXISTENTE SI ES MODO EDICIÓN
  React.useEffect(() => {
    if (initialData?.photo && typeof initialData.photo === 'string') {
      setPhotoPreview(initialData.photo);
    }
  }, [initialData?.photo]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Foto */}
        <div className="flex justify-center">
          <div className="relative">
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <Camera size={24} className="text-gray-400" />
              </div>
            )}
            
            <input
              type="file"
              id="photo"
              accept="image/*"
              onChange={handlePhotoChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
        {errors.photo && (
          <p className="text-center text-sm text-red-600">{errors.photo}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`pl-10 w-full px-4 py-2 border ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Nombre del socio"
              />
            </div>
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
            )}
          </div>

          {/* Apellido */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Apellido *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`pl-10 w-full px-4 py-2 border ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Apellido del socio"
              />
            </div>
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
            )}
          </div>
        {/* DNI - OPCIONAL */}
        <div>
          <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-1">
            DNI <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <input
            type="text"
            id="dni"
            name="dni"
            value={formData.dni || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border ${
              errors.dni ? 'border-red-500' : 'border-gray-300'
            } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="12345678"
            maxLength={8}
          />
          {errors.dni && (
            <p className="mt-1 text-sm text-red-600">{errors.dni}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Solo números, sin puntos ni guiones
          </p>
        </div>

        {/* Email - OPCIONAL */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-gray-400 text-xs">(opcional)</span>
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
              className={`pl-10 w-full px-4 py-2 border ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="correo@ejemplo.com"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
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
                className={`pl-10 w-full px-4 py-2 border ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Número de contacto"
              />
            </div>
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>

          {/* Dirección */}
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dirección del socio"
              />
            </div>
          </div>

          {/* Fecha de nacimiento */}
          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Nacimiento
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className={`pl-10 w-full px-4 py-2 border ${
                  errors.birthDate ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            {formData.birthDate && displayAge !== null && (
              <p className="mt-1 text-sm text-gray-600">
                Edad: {displayAge} años
              </p>
            )}
            {errors.birthDate && (
              <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>
            )}
          </div>

          {/* Estado */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Guardando...' : 'Guardar Socio'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemberForm;