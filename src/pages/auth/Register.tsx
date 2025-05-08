import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Building, Phone, CreditCard, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { registerGym, registerGymEmployee } from '../../services/auth.service';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface RegisterProps {
  onLoginClick: () => void;
  onRegistrationSuccess: () => void;
}

type RegisterMode = 'select' | 'gymOwner' | 'gymEmployee';

interface GymOption {
  id: string;
  name: string;
}

const Register: React.FC<RegisterProps> = ({ onLoginClick, onRegistrationSuccess }) => {
  const [mode, setMode] = useState<RegisterMode>('select');
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  
  // Datos del formulario para registro de gimnasio
  const [gymData, setGymData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    gymName: '',
    ownerName: '',
    phone: '',
    cuit: ''
  });
  
  // Datos del formulario para registro de empleado
  const [employeeData, setEmployeeData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    selectedGymId: ''
  });
  
  // Cargar gimnasios disponibles para registro de empleados
  useEffect(() => {
    const fetchGyms = async () => {
      if (mode === 'gymEmployee') {
        try {
          const gymsCollection = collection(db, 'gyms');
          const gymsSnapshot = await getDocs(gymsCollection);
          
          const gymsData: GymOption[] = [];
          gymsSnapshot.forEach(doc => {
            gymsData.push({
              id: doc.id,
              name: doc.data().name
            });
          });
          
          setGyms(gymsData);
        } catch (error) {
          console.error('Error al cargar gimnasios:', error);
        }
      }
    };
    
    fetchGyms();
  }, [mode]);
  
  // Manejar cambios en el formulario de gimnasio
  const handleGymInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGymData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Manejar cambios en el formulario de empleado
  const handleEmployeeInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEmployeeData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Validar formulario de gimnasio
  const validateGymForm = () => {
    if (!gymData.email || !gymData.password || !gymData.confirmPassword || 
        !gymData.gymName || !gymData.ownerName || !gymData.phone || !gymData.cuit) {
      setError('Todos los campos son obligatorios');
      return false;
    }
    
    if (gymData.password !== gymData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    
    if (gymData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    
    return true;
  };
  
  // Validar formulario de empleado
  const validateEmployeeForm = () => {
    if (!employeeData.email || !employeeData.password || !employeeData.confirmPassword || 
        !employeeData.name || !employeeData.phone || !employeeData.selectedGymId) {
      setError('Todos los campos son obligatorios');
      return false;
    }
    
    if (employeeData.password !== employeeData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    
    if (employeeData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    
    return true;
  };
  
  // Manejar envío del formulario de gimnasio
  const handleGymSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateGymForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await registerGym(
        gymData.email, 
        gymData.password, 
        gymData.gymName, 
        gymData.ownerName,
        gymData.phone,
        gymData.cuit
      );
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onRegistrationSuccess();
        }, 2000);
      } else {
        setError(result.error?.toString() || 'Error al registrar gimnasio');
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar gimnasio');
    } finally {
      setLoading(false);
    }
  };
  
  // Manejar envío del formulario de empleado
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateEmployeeForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await registerGymEmployee(
        employeeData.email,
        employeeData.password,
        employeeData.name,
        employeeData.phone,
        employeeData.selectedGymId,
        'user' // Rol por defecto para empleados
      );
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onRegistrationSuccess();
        }, 2000);
      } else {
        setError(result.error?.toString() || 'Error al registrar empleado');
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar empleado');
    } finally {
      setLoading(false);
    }
  };
  
  // Renderizar la pantalla de selección de modo
  const renderModeSelection = () => (
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Crear una cuenta</h2>
        <p className="text-gray-600 mt-2">Selecciona el tipo de registro</p>
      </div>
      
      <div className="space-y-4">
        <button
          onClick={() => setMode('gymOwner')}
          className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center">
            <Building size={24} className="text-blue-600 mr-3" />
            <div className="text-left">
              <h3 className="font-medium text-gray-800">Soy dueño de un gimnasio</h3>
              <p className="text-sm text-gray-500">Registrar un nuevo gimnasio en el sistema</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setMode('gymEmployee')}
          className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center">
            <User size={24} className="text-blue-600 mr-3" />
            <div className="text-left">
              <h3 className="font-medium text-gray-800">Soy empleado de un gimnasio</h3>
              <p className="text-sm text-gray-500">Registrarme como empleado de un gimnasio existente</p>
            </div>
          </div>
        </button>
      </div>
      
      <div className="mt-8 text-center">
        <button
          onClick={onLoginClick}
          className="text-blue-600 hover:text-blue-800 flex items-center justify-center mx-auto"
        >
          <ArrowLeft size={16} className="mr-1" />
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
  
  // Renderizar el formulario de registro de gimnasio
  const renderGymRegistration = () => (
    <div className="max-w-md w-full">
      <div className="mb-6">
        <button 
          onClick={() => setMode('select')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <ArrowLeft size={16} className="mr-1" />
          Volver
        </button>
      </div>
      
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Registrar Gimnasio</h2>
        <p className="text-gray-600 mt-2">Crea una cuenta para tu negocio</p>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
          <CheckCircle size={18} className="mr-2" />
          Registro exitoso. Redirigiendo al inicio de sesión...
        </div>
      )}
      
      <form onSubmit={handleGymSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="gymName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Gimnasio *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building size={18} className="text-gray-400" />
              </div>
              <input
                id="gymName"
                name="gymName"
                type="text"
                value={gymData.gymName}
                onChange={handleGymInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre de tu gimnasio"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Propietario *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input
                id="ownerName"
                name="ownerName"
                type="text"
                value={gymData.ownerName}
                onChange={handleGymInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tu nombre completo"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={gymData.email}
                onChange={handleGymInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={gymData.phone}
                  onChange={handleGymInputChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Teléfono"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-1">
                CUIT *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard size={18} className="text-gray-400" />
                </div>
                <input
                  id="cuit"
                  name="cuit"
                  type="text"
                  value={gymData.cuit}
                  onChange={handleGymInputChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="CUIT"
                  required
                />
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={gymData.password}
                onChange={handleGymInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={gymData.confirmPassword}
                onChange={handleGymInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repite tu contraseña"
                required
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            ) : (
              <Building size={18} className="mr-2" />
            )}
            {loading ? 'Registrando...' : 'Registrar Gimnasio'}
          </button>
        </div>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          ¿Ya tienes una cuenta?{' '}
          <button 
            onClick={onLoginClick}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
  
  // Renderizar el formulario de registro de empleado
  const renderEmployeeRegistration = () => (
    <div className="max-w-md w-full">
      <div className="mb-6">
        <button 
          onClick={() => setMode('select')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <ArrowLeft size={16} className="mr-1" />
          Volver
        </button>
      </div>
      
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Registro de Empleado</h2>
        <p className="text-gray-600 mt-2">Únete a tu gimnasio en el sistema</p>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
          <CheckCircle size={18} className="mr-2" />
          Registro exitoso. Tu solicitud será revisada por el administrador.
        </div>
      )}
      
      <form onSubmit={handleEmployeeSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="selectedGymId" className="block text-sm font-medium text-gray-700 mb-1">
              Selecciona tu Gimnasio *
            </label>
            <select
              id="selectedGymId"
              name="selectedGymId"
              value={employeeData.selectedGymId}
              onChange={handleEmployeeInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar gimnasio</option>
              {gyms.map(gym => (
                <option key={gym.id} value={gym.id}>{gym.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input
                id="name"
                name="name"
                type="text"
                value={employeeData.name}
                onChange={handleEmployeeInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tu nombre completo"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={employeeData.email}
                onChange={handleEmployeeInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={18} className="text-gray-400" />
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={employeeData.phone}
                onChange={handleEmployeeInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Teléfono"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={employeeData.password}
                onChange={handleEmployeeInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={employeeData.confirmPassword}
                onChange={handleEmployeeInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repite tu contraseña"
                required
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            ) : (
              <User size={18} className="mr-2" />
            )}
            {loading ? 'Registrando...' : 'Registrar como Empleado'}
          </button>
        </div>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          * Tu cuenta deberá ser aprobada por el administrador del gimnasio antes de poder acceder al sistema.
        </p>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-gray-600">
          ¿Ya tienes una cuenta?{' '}
          <button 
            onClick={onLoginClick}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
  
  // Contenedor principal
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Imagen lado izquierdo (50%) */}
      <div className="hidden md:block md:w-1/2 bg-blue-600">
        <div className="h-full flex items-center justify-center p-10">
          <div className="text-white text-center">
            <h1 className="text-4xl font-bold mb-4">Sistema de Gestión para Gimnasios</h1>
            <p className="text-xl mb-6">Administra socios, membresías y más</p>
            <div className="flex justify-center space-x-6">
              <div className="p-4 bg-white bg-opacity-10 rounded-lg">
                <Building size={48} className="mx-auto mb-2 text-white" />
                <p className="font-medium">Administra tu gimnasio</p>
              </div>
              <div className="p-4 bg-white bg-opacity-10 rounded-lg">
                <User size={48} className="mx-auto mb-2 text-white" />
                <p className="font-medium">Gestiona tus socios</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Formulario lado derecho (50%) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        {mode === 'select' && renderModeSelection()}
        {mode === 'gymOwner' && renderGymRegistration()}
        {mode === 'gymEmployee' && renderEmployeeRegistration()}
      </div>
    </div>
  );
};

export default Register;