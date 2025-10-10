// src/pages/public/PublicRegistration.tsx
// 📋 FORMULARIO PÚBLICO DE AUTO-REGISTRO
// Los socios pueden registrarse escaneando el QR del gym

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, MapPin, FileText, 
  CheckCircle, AlertCircle, Loader, Home 
} from 'lucide-react';
import { 
  collection, 
  doc, 
  getDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// Interface para el registro pendiente
interface PendingRegistration {
  gymId: string;
  gymName: string;
  
  // Datos personales
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  
  // Estado
  status: 'pending' | 'approved' | 'rejected';
  
  // Timestamps
  createdAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
}

const PublicRegistration: React.FC = () => {
  const { gymId } = useParams<{ gymId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [loadingGym, setLoadingGym] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [gymName, setGymName] = useState('');
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    birthDate: '',
    address: ''
  });

  // Validar que el gym existe
  useEffect(() => {
    const validateGym = async () => {
      if (!gymId) {
        setError('Link inválido. Falta el ID del gimnasio.');
        setLoadingGym(false);
        return;
      }

      try {
        const gymRef = doc(db, 'gyms', gymId);
        const gymSnap = await getDoc(gymRef);
        
        if (!gymSnap.exists()) {
          setError('Gimnasio no encontrado. Verifica el link con el gimnasio.');
          setLoadingGym(false);
          return;
        }

        const gymData = gymSnap.data();
        setGymName(gymData.name || 'Gimnasio');
        setLoadingGym(false);
      } catch (err) {
        console.error('Error validating gym:', err);
        setError('Error al validar el gimnasio. Intenta nuevamente.');
        setLoadingGym(false);
      }
    };

    validateGym();
  }, [gymId]);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validar formulario
  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'El nombre es obligatorio';
    if (!formData.lastName.trim()) return 'El apellido es obligatorio';
    if (!formData.dni.trim()) return 'El DNI es obligatorio';
    if (formData.dni.length < 7 || formData.dni.length > 8) {
      return 'El DNI debe tener 7 u 8 dígitos';
    }
    if (!formData.email.trim()) return 'El email es obligatorio';
    if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Email inválido';
    if (!formData.phone.trim()) return 'El teléfono es obligatorio';
    if (!formData.birthDate) return 'La fecha de nacimiento es obligatoria';
    if (!formData.address.trim()) return 'La dirección es obligatoria';
    
    return null;
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validar
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Crear registro pendiente
      const registrationData: Omit<PendingRegistration, 'id'> = {
        gymId: gymId!,
        gymName: gymName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dni: formData.dni.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        birthDate: formData.birthDate,
        address: formData.address.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'pendingRegistrations'), registrationData);

      setSuccess(true);
      
      // Limpiar formulario
      setFormData({
        firstName: '',
        lastName: '',
        dni: '',
        email: '',
        phone: '',
        birthDate: '',
        address: ''
      });

    } catch (err) {
      console.error('Error submitting registration:', err);
      setError('Error al enviar el registro. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga inicial
  if (loadingGym) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Validando gimnasio...</p>
        </div>
      </div>
    );
  }

  // Pantalla de error
  if (error && !gymName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Contacta con el gimnasio para obtener el link correcto.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de éxito
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Registro Enviado!
          </h2>
          <p className="text-gray-600 mb-4">
            Tu solicitud ha sido enviada a <strong>{gymName}</strong>
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              📧 Recibirás un email cuando tu registro sea aprobado.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            El gimnasio revisará tu información y te contactará pronto.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            Enviar otro registro
          </button>
        </div>
      </div>
    );
  }

  // Formulario principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <Home className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">{gymName}</h1>
          </div>
          <p className="text-center text-gray-600">
            Completa tus datos para unirte al gimnasio
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Datos Personales */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Datos Personales
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI *
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Datos de Contacto */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-blue-600" />
              Datos de Contacto
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2612345678"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle Falsa 123"
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            * Campos obligatorios
          </p>
        </form>
      </div>
    </div>
  );
};

export default PublicRegistration;