// src/App.tsx
import { BrowserRouter as Router, useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import RouterProvider from './components/common/RouterProvider';

// Importamos los componentes
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
import Exercises from './pages/exercises/Exercises';
import Routines from './pages/routines/Routines';
import MemberRoutines from './pages/member-routines/MemberRoutines';

// Firebase
import { auth } from './config/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { loginUser } from './services/auth.service';
import './index.css';

// Importar las páginas del superadmin
import SuperadminDashboard from './pages/superadmin/Dashboard';
import GymsManager from './pages/superadmin/Gyms';
import SubscriptionsManager from './pages/superadmin/Subscriptions';
import RevenueManager from './pages/superadmin/Revenue';
import GymAccountDetails from './pages/superadmin/GymAccountDetails';

// Tipo para los datos del usuario autenticado
type UserData = {
  id: string;
  role: 'superadmin' | 'admin' | 'user';
  gymId: string | null;
};

// Componente interno que usa useLocation
const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Actualizar la página actual basada en la ruta
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/superadmin/gym-account')) {
      setCurrentPage('superadmin-gym-account');
    } else if (path.includes('/superadmin/gyms')) {
      setCurrentPage('superadmin-gyms');
    } else if (path.includes('/superadmin/dashboard')) {
      setCurrentPage('superadmin-dashboard');
    } else if (path.includes('/superadmin/subscriptions')) {
      setCurrentPage('superadmin-subscriptions');
    } else if (path.includes('/superadmin/revenue')) {
      setCurrentPage('superadmin-revenue');
    }
  }, [location]);
  
  // Verificar estado de autenticación al cargar la aplicación
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userInfo = await loginUser(user.email || '', '');
          
          if (userInfo.success) {
            setUserData({
              id: user.uid,
              role: userInfo.role || 'user',
              gymId: userInfo.gymId || null
            });
            setIsLoggedIn(true);
          } else {
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
      case 'exercises':
        return <Exercises />;
      case 'routines':
        return <Routines />;
      case 'member-routines':
        return <MemberRoutines />;
      case 'business':
        return <BusinessProfile />;
      case 'memberships':
        return <Memberships />;
      case 'activities':
        return <Activities />;
      case 'users':
        return <Users />;
      case 'superadmin-dashboard':
        return <SuperadminDashboard />;
      case 'superadmin-gyms':
        return <GymsManager />;
      case 'superadmin-subscriptions':
        return <SubscriptionsManager />;
      case 'superadmin-revenue':
        return <RevenueManager />;
      case 'superadmin-gym-account':
        return <GymAccountDetails />;
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
    
    if (userData.role === 'superadmin') {
      return true;
    }
    
    if (userData.role === 'admin') {
      const adminPages = [
        'dashboard', 'members', 'attendance', 'cashier', 'reports',
        'exercises', 'routines', 'member-routines',
        'business', 'memberships', 'activities', 'users'
      ];
      return adminPages.includes(page);
    }
    
    if (userData.role === 'user') {
      const allowedPages = [
        'dashboard', 'members', 'attendance', 'exercises', 
        'routines', 'member-routines'
      ];
      return allowedPages.includes(page);
    }
    
    return false;
  };
  
  // Si el usuario intenta acceder a una página no autorizada, redirigirlo al dashboard
  if (!canAccessPage(currentPage)) {
    setCurrentPage('dashboard');
  }
  
  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    
    // Si es una navegación especial, usar el router
    if (page === 'superadmin-gym-account') {
      // No hacer nada, la navegación se maneja con el botón
      return;
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        activePage={currentPage} 
        onNavigate={handleNavigate} 
        userRole={userData?.role || 'user'} 
      />
      
      <div className="flex-1 md:ml-64 overflow-y-auto">
        {renderPage()}
      </div>
    </div>
  );
};

// Componente principal App que envuelve todo con Router
const App: React.FC = () => {
  return (
    <Router>
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </Router>
  );
};

export default App;