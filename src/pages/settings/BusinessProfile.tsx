// src/pages/settings/BusinessProfile.tsx
import React, { useState, useEffect } from 'react';
import { Building2, Phone, Mail, Globe, Instagram, Facebook, Save, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { getGymInfo, updateBusinessProfile, BusinessProfile as BusinessProfileType, gymToBusinessProfile, ensureGymFields } from '../../services/gym.service';
import useAuth from '../../hooks/useAuth';

const BusinessProfile: React.FC = () => {
  const { gymData, currentUser } = useAuth();
  
  const [formData, setFormData] = useState<BusinessProfileType>({
    name: '',
    address: '',
    phone: '',
    cuit: '',
    email: '',
    website: '',
    socialMedia: '',
    logo: null
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  
  // Cargar datos del gimnasio al montar el componente
  useEffect(() => {
    const loadGymData = async () => {
      if (!gymData?.id) {
        setDataLoading(false);
        return;
      }
      
      setDataLoading(true);
      
      try {
        // Asegurar que todos los campos necesarios existen
        await ensureGymFields(gymData.id);
        
        // Cargar información del gimnasio
        const gym = await getGymInfo(gymData.id);
        
        if (gym) {
          const businessProfile = gymToBusinessProfile(gym);
          setFormData(businessProfile);
          
          // Si hay un logo, establecer la vista previa
          if (gym.logo) {
            setLogoPreview(gym.logo);
          }
        }
      } catch (error) {
        console.error('Error loading gym data:', error);
        setError('Error al cargar datos del gimnasio');
      } finally {
        setDataLoading(false);
      }
    };
    
    loadGymData();
  }, [gymData?.id]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validar tamaño máximo (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('El archivo de imagen no debe superar los 2MB');
        return;
      }
      
      setLogoFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Limpiar error si existe
      if (error) {
        setError('');
      }
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setError('');
    
    try {
      console.log('Actualizando perfil con datos:', formData);
      
      // Primero, asegurarnos de que los campos existen
      await ensureGymFields(gymData.id);
      
      // Luego actualizar el perfil
      const result = await updateBusinessProfile(gymData.id, formData, logoFile);
      
      if (result) {
        setSuccess(true);
        
        // Volver a cargar los datos actualizados
        const updatedGym = await getGymInfo(gymData.id);
        if (updatedGym) {
          const updatedProfile = gymToBusinessProfile(updatedGym);
          setFormData(updatedProfile);
          
          if (updatedGym.logo) {
            setLogoPreview(updatedGym.logo);
          }
        }
        
        // Resetear el archivo del logo después de subir
        setLogoFile(null);
        
        // Ocultar mensaje de éxito después de 3 segundos
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        throw new Error('No se pudo actualizar el perfil');
      }
    } catch (err: any) {
      console.error('Error updating business profile:', err);
      
      // Mensaje de error específico para problemas con Cloudinary
      if (err.message && err.message.includes('Cloudinary')) {
        setError('Error al subir el logo. Por favor, inténtalo de nuevo o usa una imagen diferente.');
      } else {
        setError(err.message || 'Error al actualizar el perfil del negocio');
      }
    } finally {
      setLoading(false);
    }
  };
  
  if (dataLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Cargando datos del gimnasio...</span>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Perfil del Negocio</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
            <CheckCircle size={18} className="mr-2" />
            Perfil actualizado correctamente
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre del Gimnasio */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Gimnasio
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
                  placeholder="Nombre de tu gimnasio"
                  required
                />
              </div>
            </div>
            
            {/* Domicilio */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Domicilio
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
            
            {/* Celular */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Celular
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
                />
              </div>
            </div>
            
            {/* CUIT */}
            <div>
              <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-1">
                CUIT
              </label>
              <input
                type="text"
                id="cuit"
                name="cuit"
                value={formData.cuit}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CUIT de la empresa"
              />
            </div>
            
            {/* Correo */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo
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
                  placeholder="Email de contacto"
                />
              </div>
            </div>
            
            {/* Sitio Web */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                Sitio Web
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe size={18} className="text-gray-400" />
                </div>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL de tu sitio web"
                />
              </div>
            </div>
            
            {/* Redes Sociales */}
            <div>
              <label htmlFor="socialMedia" className="block text-sm font-medium text-gray-700 mb-1">
                Redes Sociales
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="flex space-x-1">
                    <Instagram size={18} className="text-gray-400" />
                    <Facebook size={18} className="text-gray-400" />
                  </div>
                </div>
                <input
                  type="text"
                  id="socialMedia"
                  name="socialMedia"
                  value={formData.socialMedia}
                  onChange={handleChange}
                  className="pl-16 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="@tusredes, /tupagina"
                />
              </div>
            </div>
            
            {/* Logo */}
            <div className="md:col-span-2">
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
                Logo
              </label>
              <div className="flex items-center">
                <div className="flex-shrink-0 mr-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-cover rounded-md" />
                  ) : (
                    <div className="h-20 w-20 bg-gray-200 rounded-md flex items-center justify-center">
                      <Building2 size={32} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <span className="flex items-center">
                    <Upload size={18} className="mr-2" />
                    Seleccionar archivo
                  </span>
                  <input
                    type="file"
                    id="logo"
                    name="logo"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Formatos permitidos: PNG, JPG, GIF. Tamaño máximo: 2MB
              </p>
            </div>
          </div>
          
          {/* Mensajes de estado y botón de guardar */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {success && (
                <div className="text-green-600 flex items-center">
                  <span className="mr-2">&#10003;</span>
                  <span>Cambios guardados correctamente</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Save size={18} className="mr-2" />
              )}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BusinessProfile;