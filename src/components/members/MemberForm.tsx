// src/components/members/MemberForm.tsx
// ✅ ACTUALIZADO CON NUEVOS CAMPOS: FOTO, CONTACTO EMERGENCIA Y CUESTIONARIO

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Camera, X, UserPlus, Heart } from 'lucide-react';
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
  // ✅ FUNCIÓN HELPER PARA CONVERTIR DATOS INICIALES
  const convertInitialData = (data: any): Partial<MemberFormData> => {
    if (!data) return {};
      
    const birthDateString = data.birthDate ? firebaseDateToHtmlDate(data.birthDate) : '';
    
    return {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      birthDate: birthDateString,
      photo: null,
      status: data.status || 'active',
      dni: data.dni || '',
      // ✅ Nuevos campos
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactPhone: data.emergencyContactPhone || '',
      hasExercisedBefore: data.hasExercisedBefore || undefined,
      fitnessGoal: Array.isArray(data.fitnessGoal) ? data.fitnessGoal : [],
      fitnessGoalOther: data.fitnessGoalOther || '',
      medicalConditions: data.medicalConditions || '',
      injuries: data.injuries || '',
      allergies: data.allergies || '',
      hasMedicalCertificate: data.hasMedicalCertificate || undefined
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
      dni: '',
      // ✅ Nuevos campos
      emergencyContactName: '',
      emergencyContactPhone: '',
      hasExercisedBefore: undefined,
      fitnessGoal: [],
      fitnessGoalOther: '',
      medicalConditions: '',
      injuries: '',
      allergies: '',
      hasMedicalCertificate: undefined
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photo || null
  );

  // Manejar cambios en inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Manejar checkboxes para fitnessGoal (múltiples objetivos)
    if (name === 'fitnessGoal' && type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        fitnessGoal: checked
          ? [...(prev.fitnessGoal || []), value]
          : (prev.fitnessGoal || []).filter(goal => goal !== value)
      }));
      return;
    }
    
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
          photo: 'Por favor selecciona un archivo de imagen válido'
        }));
        return;
      }

      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          photo: 'La imagen no debe superar los 5MB'
        }));
        return;
      }

      setFormData(prev => ({
        ...prev,
        photo: file
      }));

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Limpiar error de foto
      setErrors(prev => ({
        ...prev,
        photo: ''
      }));
    }
  };

  // Quitar foto
  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      photo: null
    }));
    setPhotoPreview(null);
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es obligatorio';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es obligatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'La fecha de nacimiento es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error al enviar formulario:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{title}</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECCIÓN: FOTO */}
        <div className="pb-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Camera className="h-5 w-5 mr-2 text-blue-600" />
            Foto del Socio
          </h3>
          
          <div className="flex items-start gap-6">
            {/* Preview de la foto */}
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <Camera className="h-12 w-12 text-gray-400" />
              </div>
            )}

            {/* Input para subir foto */}
            <div className="flex-1">
              <label className="cursor-pointer block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click para {photoPreview ? 'cambiar' : 'subir'} foto
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG o GIF (máx. 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              {errors.photo && (
                <p className="text-sm text-red-600 mt-2">{errors.photo}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN: DATOS PERSONALES */}
        <div className="pb-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            Datos Personales
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ingresa el nombre"
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>

            {/* Apellido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ingresa el apellido"
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>

            {/* DNI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DNI
              </label>
              <input
                type="text"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345678"
              />
            </div>

            {/* Fecha de Nacimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.birthDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.birthDate && (
                <p className="text-sm text-red-600 mt-1">{errors.birthDate}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="ejemplo@email.com"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="261 123-4567"
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Dirección */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle, Número, Ciudad"
                />
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN: CONTACTO DE EMERGENCIA */}
        <div className="pb-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <UserPlus className="h-5 w-5 mr-2 text-red-600" />
            Contacto de Emergencia
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Contacto
              </label>
              <input
                type="text"
                name="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: María González"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Celular del Contacto
              </label>
              <input
                type="tel"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 261 123-4567"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN: CUESTIONARIO DE SALUD Y FITNESS */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Heart className="h-5 w-5 mr-2 text-pink-600" />
            Información de Salud y Fitness
          </h3>
          
          <div className="space-y-6">
            {/* Pregunta 1: Ejercicio anterior */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Practicó ejercicio con regularidad antes?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="hasExercisedBefore"
                    value="yes"
                    checked={formData.hasExercisedBefore === 'yes'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Sí</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="hasExercisedBefore"
                    value="no"
                    checked={formData.hasExercisedBefore === 'no'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-gray-700">No</span>
                </label>
              </div>
            </div>

            {/* Pregunta 2: Objetivo principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Cuál es su objetivo principal? (puede elegir varios)
              </label>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="lose_weight"
                    checked={(formData.fitnessGoal || []).includes('lose_weight')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Bajar de peso</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="gain_muscle"
                    checked={(formData.fitnessGoal || []).includes('gain_muscle')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Ganar masa muscular</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="cardiovascular"
                    checked={(formData.fitnessGoal || []).includes('cardiovascular')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Mejorar salud cardiovascular</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="flexibility"
                    checked={(formData.fitnessGoal || []).includes('flexibility')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Mejorar flexibilidad</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="general_health"
                    checked={(formData.fitnessGoal || []).includes('general_health')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Salud general y bienestar</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="fitnessGoal"
                    value="other"
                    checked={(formData.fitnessGoal || []).includes('other')}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">Otro</span>
                </label>
              </div>
              
              {(formData.fitnessGoal || []).includes('other') && (
                <input
                  type="text"
                  name="fitnessGoalOther"
                  value={formData.fitnessGoalOther}
                  onChange={handleChange}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Especifica el objetivo..."
                />
              )}
            </div>

            {/* Pregunta 3: Enfermedades o condiciones médicas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Padece alguna enfermedad o condición médica?
              </label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: presión arterial alta, diabetes, problemas cardíacos, etc."
              />
            </div>

            {/* Pregunta 4: Lesiones o limitaciones físicas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Tiene alguna lesión o limitación física?
              </label>
              <textarea
                name="injuries"
                value={formData.injuries}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: problemas de espalda, rodilla, etc."
              />
            </div>

            {/* Pregunta 5: Alergias */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Tiene alguna alergia que debamos conocer?
              </label>
              <textarea
                name="allergies"
                value={formData.allergies}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: medicamentos, alimentos, etc."
              />
            </div>

            {/* Pregunta 6: Certificado médico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Tiene un certificado médico que acredite su aptitud física?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="hasMedicalCertificate"
                    value="yes"
                    checked={formData.hasMedicalCertificate === 'yes'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Sí</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="hasMedicalCertificate"
                    value="no"
                    checked={formData.hasMedicalCertificate === 'no'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-gray-700">No</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Guardando...
              </>
            ) : (
              'Guardar Socio'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemberForm;