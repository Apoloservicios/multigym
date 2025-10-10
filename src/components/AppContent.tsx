// src/components/AppContent.tsx - VERSIÓN LIMPIA
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Hook de autenticación
import { useAuth } from '../contexts/AuthContext';

// Layouts
import SuperadminLayout from './Layout/SuperadminLayout';
import GymLayout from './Layout/GymLayout';

// Páginas de autenticación
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';

// Páginas del superadmin
import SuperadminDashboard from '../pages/superadmin/Dashboard';
import GymsManager from '../pages/superadmin/Gyms';
import SubscriptionsManager from '../pages/superadmin/Subscriptions';
import RevenueManager from '../pages/superadmin/Revenue';
import GymAccountDetails from '../pages/superadmin/GymAccountDetails';
import GlobalExercises from '../pages/superadmin/GlobalExercises';

// Páginas del gimnasio
import Dashboard from '../pages/dashboard/Dashboard';
import DashboardImproved from '../pages/dashboard/DashboardImproved';
import Members from '../pages/members/Members';
import Attendance from '../pages/attendance/Attendance';
import Cashier from '../pages/cashier/Cashier';
import Reports from '../pages/reports/Reports';
import BusinessProfile from '../pages/settings/BusinessProfile';
import Memberships from '../pages/settings/Memberships';
import Activities from '../pages/settings/Activities';
import Users from '../pages/settings/Users';
import Exercises from '../pages/exercises/Exercises';
import Routines from '../pages/routines/Routines';
import MemberRoutines from '../pages/member-routines/MemberRoutines';
import MonthlyPaymentsDashboard from '../components/payments/MonthlyPaymentsDashboard';

// ✅ NUEVOS IMPORTS - Auto-registro unificado
import UnifiedRegistration from '../pages/public/UnifiedRegistration';
import PendingRegistrations from '../pages/admin/PendingRegistrations';
import QRCodeGenerator from '../pages/admin/QRCodeGenerator';


// Componente de protección de rutas
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  requiredRole?: 'superadmin' | 'admin' | 'user';
  allowedRoles?: Array<'superadmin' | 'admin' | 'user'>;
}> = ({ children, requiredRole, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <span className="text-gray-600">Verificando permisos...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Verificar rol específico requerido
  if (requiredRole && userRole !== requiredRole) {
    if (userRole === 'superadmin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Verificar roles permitidos
  if (allowedRoles && !allowedRoles.includes(userRole as any)) {
    if (userRole === 'superadmin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

// Componente principal de contenido
const AppContent: React.FC = () => {
  const { currentUser, userRole, loading } = useAuth();
  const location = useLocation();

  // Redireccionamiento automático basado en rol
  useEffect(() => {
    if (!loading && currentUser && location.pathname === '/') {
      if (userRole === 'superadmin') {
        window.location.replace('/superadmin/dashboard');
      } else {
        window.location.replace('/dashboard');
      }
    }
  }, [currentUser, userRole, loading, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <span className="text-gray-600">Iniciando aplicación...</span>
          {currentUser && (
            <div className="mt-2 text-sm text-gray-500">
              Cargando datos para {currentUser.email}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route 
        path="/login" 
        element={
          currentUser ? (
            userRole === 'superadmin' ? (
              <Navigate to="/superadmin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Login />
          )
        } 
      />
      
      <Route 
        path="/register" 
        element={
          currentUser ? (
            userRole === 'superadmin' ? (
              <Navigate to="/superadmin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Register />
          )
        } 
      />

      {/* ✅ RUTA PÚBLICA UNIFICADA - Registro y Actualización */}
      <Route 
        path="/register/:gymId" 
        element={<UnifiedRegistration />} 
      />

      {/* Rutas del superadmin */}
      <Route path="/superadmin/*" element={
        <ProtectedRoute requiredRole="superadmin">
          <SuperadminLayout>
            <Routes>
              <Route path="dashboard" element={<SuperadminDashboard />} />
              <Route path="gyms" element={<GymsManager />} />
              <Route path="subscriptions" element={<SubscriptionsManager />} />
              <Route path="revenue" element={<RevenueManager />} />
              <Route path="gym-account/:gymId" element={<GymAccountDetails />} />
              <Route path="exercises" element={<GlobalExercises />} />
              <Route path="" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </SuperadminLayout>
        </ProtectedRoute>
      } />

      {/* Rutas del gimnasio */}
      <Route path="/*" element={
        <ProtectedRoute allowedRoles={['admin', 'user']}>
          <GymLayout>
            <Routes>
              {/* Dashboards */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="dashboard-financial" element={<DashboardImproved />} />
              
              {/* Gestión */}
              <Route path="members" element={<Members />} />
              <Route path="attendance" element={<Attendance />} />
              
              {/* Finanzas - Solo admins */}
              <Route path="cashier" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Cashier />
                </ProtectedRoute>
              } />
              <Route path="reports" element={<Reports />} />
              
              {/* ✅ Pagos Mensuales (Sistema Nuevo) */}
              <Route path="payments" element={
                <ProtectedRoute allowedRoles={['admin', 'user']}>
                  <MonthlyPaymentsDashboard />
                </ProtectedRoute>
              } />

              {/* Entrenamiento */}
              <Route path="exercises" element={<Exercises />} />
              <Route path="routines" element={<Routines />} />
              <Route path="member-routines" element={<MemberRoutines />} />
              
              {/* Configuración - Solo admins */}
              <Route path="settings/business" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BusinessProfile />
                </ProtectedRoute>
              } />
              <Route path="settings/memberships" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Memberships />
                </ProtectedRoute>
              } />
              <Route path="settings/activities" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Activities />
                </ProtectedRoute>
              } />
              <Route path="settings/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } />

              {/* ✅ NUEVAS RUTAS - Auto-registro */}
              
              {/* Panel de registros pendientes - Solo admins */}
              <Route path="pending-registrations" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PendingRegistrations />
                </ProtectedRoute>
              } />

              {/* Generador de código QR - Solo admins */}
              <Route path="qr-generator" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <QRCodeGenerator />
                </ProtectedRoute>
              } />
              
              {/* Ruta por defecto */}
              <Route path="/" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </GymLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppContent;