import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Building, User } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { loginUser } from '../../services/auth.service';

interface LoginProps {
  onLogin: (userInfo: any) => void;
  onRegisterClick: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Intentamos autenticar con Firebase
      await signInWithEmailAndPassword(auth, email, password);
      
      // Obtenemos los datos del usuario y su rol desde Firestore
      const userInfo = await loginUser(email, password);
      
      if (userInfo.success) {
        onLogin(userInfo);
      } else {
        setError(userInfo.error?.toString() || 'Error desconocido al iniciar sesión');
      }
    } catch (err: any) {
      // Manejar errores de autenticación de Firebase
      let errorMessage = 'Error al iniciar sesión. Intenta nuevamente.';
      
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = 'El correo electrónico no es válido.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No existe una cuenta con este correo.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.';
          break;
      }
      
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Bienvenido</h2>
            <p className="text-gray-600 mt-2">Inicia sesión en tu cuenta</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
              <AlertCircle size={18} className="mr-2" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="tucorreo@ejemplo.com"
                  required
                />
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
            >
              {loading ? (
                <span className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <LogIn size={18} className="mr-2" />
              )}
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿No tienes una cuenta?{' '}
              <button 
                onClick={onRegisterClick}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Registra tu gimnasio
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;