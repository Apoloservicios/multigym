// src/components/common/SubscriptionCheck.tsx
// Control de acceso según suscripción - CON ACCESO LIMITADO

import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { toJsDate } from '../../utils/date.utils';

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

const SubscriptionCheck: React.FC<SubscriptionCheckProps> = ({ children }) => {
  const { gymData, userRole } = useAuth();
  const location = useLocation();
  
  // Los superadmins siempre tienen acceso
  if (userRole === 'superadmin') {
    return <>{children}</>;
  }
  
  // Verificar si la suscripción está activa
  const isSubscriptionActive = (): boolean => {
    if (!gymData) return false;
    
    if (userRole === 'superadmin') return true;
    
    if (gymData.status !== 'active') return false;
    
    if (!gymData.subscriptionData?.endDate) return false;
    
    const endDate = toJsDate(gymData.subscriptionData.endDate);
    const currentDate = new Date();
    
    return endDate ? endDate > currentDate : false;
  };

  // Verificar si el trial está activo
  const isTrialActive = (): boolean => {
    if (!gymData) return false;
    
    if (userRole === 'superadmin') return true;
    
    if (gymData.status !== 'trial') return false;
    
    if (!gymData.trialEndsAt) return false;
    
    const trialEndDate = toJsDate(gymData.trialEndsAt);
    const currentDate = new Date();
    
    return trialEndDate ? trialEndDate > currentDate : false;
  };
  
  // Calcular días restantes
  const getDaysRemaining = (date: any): number => {
    const targetDate = toJsDate(date);
    if (!targetDate) return 0;
    
    const currentDate = new Date();
    const timeDiff = targetDate.getTime() - currentDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  // Rutas permitidas cuando la suscripción está vencida
  const allowedPathsWhenExpired = [
    '/dashboard',
    '/dashboard-financial',
    '/settings/business',
    '/business',
    '/business-profile'
  ];

  // Verificar si la ruta actual está permitida cuando está vencido
  const isAllowedPath = (): boolean => {
    return allowedPathsWhenExpired.some(path => 
      location.pathname.startsWith(path)
    );
  };

  // Determinar el estado de la suscripción
  const getSubscriptionStatus = (): 'active' | 'expired' => {
    if ((gymData?.status === 'active' && isSubscriptionActive()) || 
        (gymData?.status === 'trial' && isTrialActive())) {
      return 'active';
    }
    return 'expired';
  };

  const subscriptionStatus = getSubscriptionStatus();

  // Si la suscripción está activa, mostrar contenido normal con advertencia si quedan pocos días
  if (subscriptionStatus === 'active') {
    const daysLeft = gymData?.status === 'active' 
      ? getDaysRemaining(gymData.subscriptionData?.endDate) 
      : getDaysRemaining(gymData?.trialEndsAt);
    
    if (daysLeft <= 7 && daysLeft > 0) {
      return (
        <>
          <div className="bg-yellow-50 border-b border-yellow-200 p-3">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle size={20} className="text-yellow-700 mr-2" />
                <span className="text-yellow-800 text-sm">
                  {gymData?.status === 'active' 
                    ? `Tu suscripción vencerá en ${daysLeft} día(s). Renovar para continuar.` 
                    : `Tu período de prueba finaliza en ${daysLeft} día(s). Suscribite para continuar.`}
                </span>
              </div>
            </div>
          </div>
          {children}
        </>
      );
    }
    
    return <>{children}</>;
  }

  // Si la suscripción está vencida/suspendida
  if (subscriptionStatus === 'expired' || gymData?.status === 'suspended') {
    // Si está en una ruta permitida, mostrar con banner de restricción
    if (isAllowedPath()) {
      return (
        <>
          <div className="bg-red-600 text-white p-3">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <Lock size={20} className="mr-2" />
                <span className="text-sm font-medium">
                  {gymData?.status === 'suspended' 
                    ? 'Cuenta Suspendida - Funciones limitadas' 
                    : 'Suscripción Vencida - Acceso limitado. Renovar en Configuración del Negocio.'}
                </span>
              </div>
            </div>
          </div>
          {children}
        </>
      );
    }

    // Si intenta acceder a una ruta NO permitida, redirigir al dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default SubscriptionCheck;