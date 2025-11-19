// src/pages/settings/BusinessProfile.tsx
// VERSIÓN ACTUALIZADA con sistema de renovación

import React, { useState, useEffect } from 'react';
import { 
  Building2, Phone, Mail, Globe, Instagram, Facebook, Save, Upload, 
  AlertCircle, CheckCircle, Calendar, Clock, AlertTriangle, CreditCard  
} from 'lucide-react';
import { getGymInfo, updateBusinessProfile, BusinessProfile as BusinessProfileType, gymToBusinessProfile, ensureGymFields } from '../../services/gym.service';
import useAuth from '../../hooks/useAuth';
import { toJsDate } from '../../utils/date.utils';
import RenewalRequestModal from '../../components/subscription/RenewalRequestModal';

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
  
  // Estado para el modal de renovación
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
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

  // Funciones para verificar estado de suscripción
  const isSubscriptionActive = (): boolean => {
    if (!gymData) return false;
    
    if (gymData.status !== 'active') return false;
    
    if (!gymData.subscriptionData?.endDate) return false;
    
    const endDate = toJsDate(gymData.subscriptionData.endDate);
    const currentDate = new Date();
    
    return endDate ? endDate > currentDate : false;
  };
  
  const isTrialActive = (): boolean => {
    if (!gymData) return false;
    
    if (gymData.status !== 'trial') return false;
    
    if (!gymData.trialEndsAt) return false;
    
    const trialEndDate = toJsDate(gymData.trialEndsAt);
    const currentDate = new Date();
    
    return trialEndDate ? trialEndDate > currentDate : false;
  };
  
  // Manejar cambios en los campos del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Manejar cambio de archivo de logo
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        setError('El logo no puede superar los 5MB');
        return;
      }
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten imágenes');
        return;
      }
      
      setLogoFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Guardar cambios
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id) {
      setError('No se pudo identificar el gimnasio');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      await updateBusinessProfile(gymData.id, formData, logoFile);
      setSuccess(true);
      setLogoFile(null);
      
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error updating business profile:', err);
      
      if (err.code === 'storage/unauthorized') {
        setError('Error de permisos al subir el logo. Por favor, inténtalo de nuevo o usa una imagen diferente.');
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

  // Renderizar sección de suscripción
  const renderSubscriptionSection = () => {
    const now = new Date();
    let endDate: Date | null = null;
    let daysLeft = 0;
    let statusText = '';
    let statusColor = '';
    
    if (gymData?.status === 'active' && gymData.subscriptionData?.endDate) {
      endDate = toJsDate(gymData.subscriptionData.endDate);
      if (endDate) {
        daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft > 0) {
          statusText = `Activa - Vence en ${daysLeft} día(s)`;
          statusColor = daysLeft <= 7 ? 'text-yellow-800 bg-yellow-50 border-yellow-200' : 'text-green-800 bg-green-50 border-green-200';
        } else {
          statusText = 'Vencida';
          statusColor = 'text-red-800 bg-red-50 border-red-200';
        }
      }
    } else if (gymData?.status === 'trial' && gymData.trialEndsAt) {
      endDate = toJsDate(gymData.trialEndsAt);
      if (endDate) {
        daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft > 0) {
          statusText = `Período de Prueba - ${daysLeft} día(s) restantes`;
          statusColor = 'text-blue-800 bg-blue-50 border-blue-200';
        } else {
          statusText = 'Período de Prueba Finalizado';
          statusColor = 'text-red-800 bg-red-50 border-red-200';
        }
      }
    } else if (gymData?.status === 'suspended') {
      statusText = 'Cuenta Suspendida';
      statusColor = 'text-red-800 bg-red-50 border-red-200';
    }

    const needsRenewal = 
      (gymData?.status === 'active' && !isSubscriptionActive()) ||
      (gymData?.status === 'trial' && !isTrialActive()) ||
      gymData?.status === 'suspended' ||
      (daysLeft > 0 && daysLeft <= 7);

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <CreditCard className="mr-2" size={24} />
            Estado de Suscripción
          </h2>
        </div>

        <div className={`p-4 rounded-lg border mb-4 ${statusColor}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold text-lg mb-2">{statusText}</p>
              {endDate && (
                <p className="text-sm">
                  <Calendar size={14} className="inline mr-1" />
                  {gymData?.status === 'active' ? 'Fecha de vencimiento: ' : 'Fecha de finalización: '}
                  {endDate.toLocaleDateString('es-AR')}
                </p>
              )}
              {gymData?.subscriptionData && (
                <p className="text-sm mt-1">
                  Plan actual: <strong>{gymData.subscriptionData.plan || 'No especificado'}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {needsRenewal && (
          <div className="mt-4">
            <button
              onClick={() => setShowRenewalModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <CreditCard size={20} className="mr-2" />
              Solicitar Renovación de Suscripción
            </button>
            
            <p className="text-sm text-gray-600 mt-3 text-center">
              Sube tu comprobante de pago y nuestro equipo lo revisará para activar tu suscripción.
            </p>
          </div>
        )}

        {!needsRenewal && daysLeft > 7 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 text-center">
              Tu suscripción está activa. Puedes renovarla antes del vencimiento si lo deseas.
            </p>
            <button
              onClick={() => setShowRenewalModal(true)}
              className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Renovar Anticipadamente
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración del Negocio</h1>
        <p className="text-gray-600 mt-1">Administra la información de tu gimnasio</p>
      </div>

      {/* Sección de Suscripción */}
      {renderSubscriptionSection()}

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="text-green-600 mr-3" size={20} />
          <span className="text-green-800">Perfil actualizado correctamente</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="text-red-600 mr-3" size={20} />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Formulario de perfil */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo del Gimnasio
            </label>
            
            {logoPreview && (
              <div className="mb-4">
                <img 
                  src={logoPreview} 
                  alt="Logo preview" 
                  className="h-32 w-32 object-contain border rounded-lg"
                />
              </div>
            )}
            
            <div className="flex items-center">
              <label className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload size={20} className="mr-2 text-gray-600" />
                <span className="text-sm text-gray-600">Seleccionar Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
              {logoFile && (
                <span className="ml-3 text-sm text-gray-600">{logoFile.name}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG o JPEG - Máximo 5MB</p>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 size={16} className="inline mr-1" />
              Nombre del Gimnasio *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre del gimnasio"
            />
          </div>

          {/* CUIT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CUIT
            </label>
            <input
              type="text"
              name="cuit"
              value={formData.cuit}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="XX-XXXXXXXX-X"
            />
          </div>

          {/* Dirección */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Calle, número, ciudad"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone size={16} className="inline mr-1" />
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+54 9 XXX XXX XXXX"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail size={16} className="inline mr-1" />
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="contacto@gimnasio.com"
            />
          </div>

          {/* Sitio Web */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe size={16} className="inline mr-1" />
              Sitio Web
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://www.gimnasio.com"
            />
          </div>

          {/* Redes Sociales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Instagram size={16} className="inline mr-1" />
              Redes Sociales
            </label>
            <input
              type="text"
              name="socialMedia"
              value={formData.socialMedia}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="@gimnasio"
            />
          </div>
        </div>

        {/* Botón de guardar */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} className="mr-2" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de renovación */}
      <RenewalRequestModal
        isOpen={showRenewalModal}
        onClose={() => setShowRenewalModal(false)}
        onSuccess={() => {
          // Aquí podrías recargar los datos del gimnasio si es necesario
          console.log('Renovación solicitada con éxito');
        }}
      />
    </div>
  );
};

export default BusinessProfile;