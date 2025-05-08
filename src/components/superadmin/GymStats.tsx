// src/components/superadmin/GymStats.tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, RefreshCw, Clock, ChevronRight } from 'lucide-react';
import { getExpiringSubscriptions } from '../../services/superadmin.service';
import { GymSubscription } from '../../types/superadmin.types';
import { formatDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import { navigateTo } from '../../services/navigation.service';

interface GymStatsProps {
  showExpiring?: boolean;
  limit?: number;
}

const GymStats: React.FC<GymStatsProps> = ({ showExpiring = true, limit = 5 }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<GymSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (showExpiring) {
      loadExpiringSubscriptions();
    }
  }, [showExpiring]);
  
  const loadExpiringSubscriptions = async () => {
    setLoading(true);
    
    try {
      const subscriptions = await getExpiringSubscriptions(30); // Próximos 30 días
      setExpiringSubscriptions(subscriptions.slice(0, limit));
    } catch (err: any) {
      console.error('Error loading expiring subscriptions:', err);
      setError('Error al cargar las suscripciones por vencer');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubscriptionClick = (subscription: GymSubscription) => {
    navigateTo(`/superadmin/subscriptions?id=${subscription.id}`);
  };
  
  const handleViewAllClick = () => {
    navigateTo('/superadmin/subscriptions?filter=expiring');
  };
  
  // Calcular días restantes
  const getDaysRemaining = (endDate: any): number => {
    if (!endDate) return 0;
    
    try {
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
      const now = new Date();
      
      // Diferencia en milisegundos
      const diffTime = end.getTime() - now.getTime();
      
      // Convertir a días
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error('Error calculating days remaining:', error);
      return 0;
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
        <AlertTriangle className="h-5 w-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }
  
  if (expiringSubscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p>No hay suscripciones por vencer próximamente</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Suscripciones por Vencer</h3>
        <button 
          onClick={loadExpiringSubscriptions}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
        >
          <RefreshCw size={14} className="mr-1" />
          Actualizar
        </button>
      </div>
      
      <div className="space-y-4">
        {expiringSubscriptions.map(subscription => {
          const daysRemaining = getDaysRemaining(subscription.endDate);
          const isExpired = daysRemaining < 0;
          
          return (
            <div 
              key={subscription.id}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleSubscriptionClick(subscription)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{subscription.gymName}</h4>
                  <p className="text-sm text-gray-600">Plan: {subscription.planName}</p>
                  <div className="flex items-center mt-1">
                    <Calendar size={14} className="text-gray-400 mr-1" />
                    <span className={`text-sm ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {isExpired ? 'Venció el ' : 'Vence el '} 
                      {formatDate(subscription.endDate)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isExpired 
                      ? 'bg-red-100 text-red-800' 
                      : daysRemaining <= 7
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isExpired 
                      ? `Vencido hace ${Math.abs(daysRemaining)} días` 
                      : daysRemaining === 0
                        ? 'Vence hoy'
                        : `${daysRemaining} días restantes`
                    }
                  </div>
                  <div className="text-right mt-2 font-medium">
                    {formatCurrency(subscription.price)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {expiringSubscriptions.length > 0 && (
        <div className="text-center mt-4">
          <button 
            onClick={handleViewAllClick}
            className="text-blue-600 hover:text-blue-800 inline-flex items-center"
          >
            Ver todas
            <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      )}
    </div>
  );
};

export default GymStats;