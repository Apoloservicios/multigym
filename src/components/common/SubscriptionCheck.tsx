// Nuevo archivo: src/components/common/SubscriptionCheck.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Clock, CheckCircle } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { toJsDate } from '../../utils/date.utils';

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

const SubscriptionCheck: React.FC<SubscriptionCheckProps> = ({ children }) => {
  const { gymData, userRole } = useAuth();
  const navigate = useNavigate();
  
  // Los superadmins siempre tienen acceso
  if (userRole === 'superadmin') {
    return <>{children}</>;
  }
  
  // Verificar estado de suscripción
 const isSubscriptionActive = (): boolean => {
  if (!gymData) return false;
  
  // Si es superadmin, siempre tiene acceso
  if (userRole === 'superadmin') return true;
  
  if (gymData.status !== 'active') return false;
  
  if (!gymData.subscriptionData?.endDate) return false;
  
  const endDate = toJsDate(gymData.subscriptionData.endDate);
  const currentDate = new Date();
  
  return endDate ? endDate > currentDate : false;
};

// En la función isTrialActive:
const isTrialActive = (): boolean => {
  if (!gymData) return false;
  
  // Si es superadmin, siempre tiene acceso
  if (userRole === 'superadmin') return true;
  
  if (gymData.status !== 'trial') return false;
  
  if (!gymData.trialEndsAt) return false;
  
  const trialEndDate = toJsDate(gymData.trialEndsAt);
  const currentDate = new Date();
  
  return trialEndDate ? trialEndDate > currentDate : false;
};
  
  // Formatear fechas en formato legible
  const formatDate = (date: any): string => {
    if (!date) return 'No disponible';
    
    const jsDate = toJsDate(date);
    return jsDate ? jsDate.toLocaleDateString('es-AR') : 'Fecha inválida';
  };
  
  // Calcular días restantes
  const getDaysRemaining = (date: any): number => {
    const targetDate = toJsDate(date);
    if (!targetDate) return 0;
    
    const currentDate = new Date();
    const timeDiff = targetDate.getTime() - currentDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };
  
  // Si la suscripción está activa o el período de prueba está vigente, mostrar el contenido normal
  if ((gymData?.status === 'active' && isSubscriptionActive()) || 
      (gymData?.status === 'trial' && isTrialActive())) {
    
    // Mostrar advertencia si quedan menos de 5 días de suscripción
    const daysLeft = gymData.status === 'active' 
      ? getDaysRemaining(gymData.subscriptionData?.endDate) 
      : getDaysRemaining(gymData.trialEndsAt);
    
    if (daysLeft <= 5 && daysLeft > 0) {
      return (
        <>
          <div className="bg-yellow-50 border-b border-yellow-200 p-3">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle size={20} className="text-yellow-700 mr-2" />
                <span className="text-yellow-800">
                  {gymData.status === 'active' 
                    ? `Tu suscripción vencerá en ${daysLeft} día(s). Por favor renueva para continuar usando el sistema.` 
                    : `Tu período de prueba finaliza en ${daysLeft} día(s). Adquiere una suscripción para continuar.`}
                </span>
              </div>
              <button 
                onClick={() => navigate('/business')}
                className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md transition-colors"
              >
                Ver detalles
              </button>
            </div>
          </div>
          {children}
        </>
      );
    }
    
    return <>{children}</>;
  }
  
  // Si la suscripción está vencida o el gimnasio está suspendido, mostrar pantalla de bloqueo
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-500 mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Acceso Restringido</h2>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          {gymData?.status === 'active' && !isSubscriptionActive() && (
            <p className="text-red-700">
              Tu suscripción ha <strong>vencido</strong> el {formatDate(gymData.subscriptionData?.endDate)}. 
              Para continuar utilizando el sistema, es necesario renovar tu plan.
            </p>
          )}
          
          {gymData?.status === 'trial' && !isTrialActive() && (
            <p className="text-red-700">
              Tu período de prueba ha <strong>finalizado</strong> el {formatDate(gymData.trialEndsAt)}. 
              Para continuar utilizando el sistema, es necesario adquirir una suscripción.
            </p>
          )}
          
          {gymData?.status === 'suspended' && (
            <p className="text-red-700">
              Tu cuenta ha sido <strong>suspendida</strong>. 
              Por favor contacta con soporte para resolver esta situación.
            </p>
          )}
        </div>
        
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">Información de contacto:</h3>
          <p className="text-gray-600">
            Email: soporte@multigym.com<br />
            Teléfono: (123) 456-7890
          </p>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={() => navigate('/business')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Ver detalles de suscripción
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCheck;