// src/App.tsx
import { BrowserRouter as Router } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import RouterProvider from './components/common/RouterProvider';

// Nota: importamos desde 'Layout' con L mayúscula para evitar el error de casing
import Sidebar from './components/Layout/Sidebar';
import Members from './pages/members/Members';
import Attendance from './pages/attendance/Attendance';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import BusinessProfile from './pages/settings/BusinessProfile';
import Memberships from './pages/settings/Memberships';
import Dashboard from './pages/dashboard/Dashboard';
import Cashier from './pages/cashier/Cashier';
import Reports from './pages/reports/Reports';
import Activities from './pages/settings/Activities';
import Users from './pages/settings/Users';
// Importamos las nuevas páginas
import Exercises from './pages/exercises/Exercises';
import Routines from './pages/routines/Routines';
import MemberRoutines from './pages/member-routines/MemberRoutines';
import { auth } from './config/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { loginUser } from './services/auth.service';
import './index.css';

// Tipo para los datos del usuario autenticado
type UserData = {
  id: string;
  role: 'superadmin' | 'admin' | 'user';
  gymId: string | null;
};

// Definición del componente principal
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Verificar estado de autenticación al cargar la aplicación
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // En una implementación real, aquí obtendrías los datos del usuario desde Firestore
          // Para simplificar, usamos loginUser que ya tienes implementado
          const userInfo = await loginUser(user.email || '', ''); // Password vacío porque ya estamos autenticados
          
          if (userInfo.success) {
            setUserData({
              id: user.uid,
              role: userInfo.role || 'user',
              gymId: userInfo.gymId || null
            });
            setIsLoggedIn(true);
          } else {
            // Si hay un problema con los datos del usuario, cerramos sesión
            auth.signOut();
            setIsLoggedIn(false);
          }
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
        setUserData(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Función para manejar el inicio de sesión
  const handleLogin = async (userInfo: any) => {
    setUserData({
      id: userInfo.user.uid,
      role: userInfo.role,
      gymId: userInfo.gymId
    });
    setIsLoggedIn(true);
  };
  
  // Renderizar página basado en la selección actual
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <Members />;
      case 'attendance':
        return <Attendance />;
      case 'cashier':
        return <Cashier />;
      case 'reports':
        return <Reports />;
      // Nuevas páginas de ejercicios y rutinas
      case 'exercises':
        return <Exercises />;
      case 'routines':
        return <Routines />;
      case 'member-routines':
        return <MemberRoutines />;
      // Páginas de configuración
      case 'business':
        return <BusinessProfile />;
      case 'memberships':
        return <Memberships />;
      case 'activities':
        return <Activities />;
      case 'users':
        return <Users />;
      default:
        return <Dashboard />;
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Cargando...</span>
      </div>
    );
  }
  
  if (!isLoggedIn) {
    if (authPage === 'login') {
      return <Login 
        onLogin={handleLogin} 
        onRegisterClick={() => setAuthPage('register')}
      />;
    } else {
      return <Register 
        onLoginClick={() => setAuthPage('login')} 
        onRegistrationSuccess={() => setAuthPage('login')}
      />;
    }
  }
  
  // Verificar permisos según el rol
  const canAccessPage = (page: string): boolean => {
    if (!userData) return false;
    
    // Superadmin y admin tienen acceso a todo
    if (userData.role === 'superadmin' || userData.role === 'admin') {
      return true;
    }
    
    // Empleados pueden acceder sólo a ciertas páginas
    if (userData.role === 'user') {
      const allowedPages = ['dashboard', 'members', 'attendance', 'exercises', 'routines', 'member-routines'];
      return allowedPages.includes(page);
    }
    
    return false;
  };
  
  // Si el usuario intenta acceder a una página no autorizada, redirigirlo al dashboard
  if (!canAccessPage(currentPage)) {
    setCurrentPage('dashboard');
  }
  
  // Envolvemos la aplicación autenticada con Router y RouterProvider
  return (
    <Router>
      <RouterProvider>
        <div className="flex h-screen bg-gray-100">
          <Sidebar 
            activePage={currentPage} 
            onNavigate={setCurrentPage} 
            userRole={userData?.role || 'user'} 
          />
          
          <div className="flex-1 md:ml-64 overflow-y-auto">
            {renderPage()}
          </div>
        </div>
      </RouterProvider>
    </Router>
  );
};

export default App;