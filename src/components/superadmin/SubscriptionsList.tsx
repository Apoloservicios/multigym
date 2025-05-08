// src/components/superadmin/SubscriptionsList.tsx
import React, { useState } from 'react';
import { CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Calendar, ChevronsRight, RefreshCw } from 'lucide-react';
import { GymSubscription } from '../../types/superadmin.types';
import { formatDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import { cancelSubscription, renewSubscription } from '../../services/superadmin.service';

interface SubscriptionsListProps {
  subscriptions: GymSubscription[];
  onProcessPayment?: (subscription: GymSubscription) => void;
  onRefresh?: () => void;
}

const SubscriptionsList: React.FC<SubscriptionsListProps> = ({ 
  subscriptions, 
  onProcessPayment,
  onRefresh 
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubscription, setExpandedSubscription] = useState<string | null>(null);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Activa
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} className="mr-1" />
            Pendiente
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Expirada
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircle size={12} className="mr-1" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertTriangle size={12} className="mr-1" />
            Desconocido
          </span>
        );
    }
  };
  
  const handleRenewSubscription = async (subscription: GymSubscription) => {
    if (actionLoading) return;
    
    setActionLoading(subscription.id);
    setError(null);
    
    try {
      await renewSubscription(
        subscription.id,
        subscription.paymentMethod,
        subscription.autoRenewal
      );
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Error renewing subscription:', err);
      setError(`Error al renovar la suscripción: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleCancelSubscription = async (subscription: GymSubscription) => {
    if (actionLoading) return;
    
    if (!window.confirm(`¿Estás seguro de que deseas cancelar la suscripción para ${subscription.gymName}?`)) {
      return;
    }
    
    setActionLoading(subscription.id);
    setError(null);
    
    try {
      await cancelSubscription(
        subscription.id,
        'Cancelada por administrador'
      );
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(`Error al cancelar la suscripción: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };
  
  const toggleExpanded = (id: string) => {
    if (expandedSubscription === id) {
      setExpandedSubscription(null);
    } else {
      setExpandedSubscription(id);
    }
  };
  
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
  
  if (subscriptions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-500">No hay suscripciones disponibles</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {error && (
        <div className="bg-red-100 border-b border-red-300 text-red-700 px-4 py-3 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gimnasio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscriptions.map(subscription => {
              const daysRemaining = getDaysRemaining(subscription.endDate);
              const isExpired = daysRemaining < 0;
              
              return (
                <React.Fragment key={subscription.id}>
                  <tr className={`hover:bg-gray-50 ${expandedSubscription === subscription.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      <button 
                        onClick={() => toggleExpanded(subscription.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ChevronsRight size={20} className={`transform transition-transform ${expandedSubscription === subscription.id ? 'rotate-90' : ''}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{subscription.gymName}</div>
                      <div className="text-xs text-gray-500">ID: {subscription.gymId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{subscription.planName}</div>
                      <div className="text-xs text-gray-500">
                        {subscription.autoRenewal ? 'Renovación automática' : 'Sin renovación automática'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}</div>
                      <div className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {isExpired 
                          ? `Vencido hace ${Math.abs(daysRemaining)} días` 
                          : daysRemaining === 0
                            ? 'Vence hoy'
                            : `${daysRemaining} días restantes`
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(subscription.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(subscription.price)}</div>
                      <div className="text-xs text-gray-500">
                        {subscription.paymentMethod.charAt(0).toUpperCase() + subscription.paymentMethod.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2 justify-end">
                        {subscription.status === 'active' || subscription.status === 'expired' ? (
                          <button
                            onClick={() => handleRenewSubscription(subscription)}
                            disabled={actionLoading === subscription.id}
                            className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            {actionLoading === subscription.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <span className="flex items-center">
                                <RefreshCw size={14} className="mr-1" />
                                Renovar
                              </span>
                            )}
                          </button>
                        ) : subscription.status === 'pending' && onProcessPayment ? (
                          <button
                            onClick={() => onProcessPayment(subscription)}
                            className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                          >
                            <span className="flex items-center">
                              <CreditCard size={14} className="mr-1" />
                              Pago
                            </span>
                          </button>
                        ) : null}
                        
                        {subscription.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelSubscription(subscription)}
                            disabled={actionLoading === subscription.id}
                            className="text-red-600 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50"
                          >
                            {actionLoading === subscription.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <span className="flex items-center">
                                <XCircle size={14} className="mr-1" />
                                Cancelar
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Detalles de la suscripción */}
                  {expandedSubscription === subscription.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Detalles de la Suscripción</h4>
                            <div className="space-y-1 text-sm">
                              <p className="flex items-center">
                                <Calendar size={14} className="text-gray-400 mr-2" />
                                <span className="text-gray-700 font-medium">Fecha de inicio:</span>
                                <span className="ml-2">{formatDate(subscription.startDate)}</span>
                              </p>
                              <p className="flex items-center">
                                <Calendar size={14} className="text-gray-400 mr-2" />
                                <span className="text-gray-700 font-medium">Fecha de finalización:</span>
                                <span className="ml-2">{formatDate(subscription.endDate)}</span>
                              </p>
                              <p className="flex items-center">
                                <CreditCard size={14} className="text-gray-400 mr-2" />
                                <span className="text-gray-700 font-medium">Método de pago:</span>
                                <span className="ml-2">{subscription.paymentMethod.charAt(0).toUpperCase() + subscription.paymentMethod.slice(1)}</span>
                              </p>
                              <p className="flex items-center">
                                <Calendar size={14} className="text-gray-400 mr-2" />
                                <span className="text-gray-700 font-medium">Fecha de último pago:</span>
                                <span className="ml-2">{formatDate(subscription.paymentDate)}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Renovación</h4>
                            <div className="space-y-1 text-sm">
                              <p className="flex items-center">
                                <RefreshCw size={14} className="text-gray-400 mr-2" />
                                <span className="text-gray-700 font-medium">Renovación automática:</span>
                                <span className="ml-2">{subscription.autoRenewal ? 'Sí' : 'No'}</span>
                              </p>
                              {subscription.renewalRequested && (
                                <p className="flex items-center">
                                  <AlertTriangle size={14} className="text-yellow-500 mr-2" />
                                  <span className="text-yellow-700">Renovación solicitada por el gimnasio</span>
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Notas</h4>
                            <div className="bg-white p-2 rounded border border-gray-200 text-sm min-h-16">
                              {subscription.notes || 'Sin notas adicionales'}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionsList;