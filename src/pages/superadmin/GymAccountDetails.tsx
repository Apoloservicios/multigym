// src/pages/superadmin/GymAccountDetails.tsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CreditCard, Calendar, DollarSign, FileText, 
  CheckCircle, XCircle, Clock, Download, Filter, AlertTriangle,
  TrendingUp, Receipt, RefreshCw
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Gym, Payment, GymSubscription } from '../../types/superadmin.types';
import { formatDate, formatDateTime, toJsDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import superadminService from '../../services/superadmin.service';

interface AccountSummary {
  totalPaid: number;
  pendingPayments: number;
  lastPaymentDate: Date | null;
  subscriptionStatus: 'active' | 'expired' | 'pending' | 'trial';
  daysRemaining: number;
  paymentMethod: string;
}

const GymAccountDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gymId = searchParams.get('gymId');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [gym, setGym] = useState<Gym | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<GymSubscription[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (gymId) {
      loadAccountDetails();
    }
  }, [gymId]);
  
  const loadAccountDetails = async () => {
    if (!gymId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Cargar datos del gimnasio
      const gyms = await superadminService.getGyms();
      const gymData = gyms.find(g => g.id === gymId);
      if (gymData) {
        setGym(gymData);
      }
      
      // Cargar historial de pagos
      const allPayments = await superadminService.getPayments(
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // último año
        new Date()
      );
      const gymPayments = allPayments.filter(p => p.gymId === gymId);
      setPayments(gymPayments);
      
      // Cargar historial de suscripciones
      const allSubscriptions = await superadminService.getGymSubscriptions();
      const gymSubscriptions = allSubscriptions.filter(s => s.gymId === gymId);
      setSubscriptions(gymSubscriptions);
      
      // Calcular resumen de cuenta
      calculateAccountSummary(gymPayments, gymSubscriptions);
    } catch (err: any) {
      console.error('Error loading account details:', err);
      setError('Error al cargar los detalles de la cuenta');
    } finally {
      setLoading(false);
    }
  };
  
  const calculateAccountSummary = (payments: Payment[], subscriptions: GymSubscription[]) => {
    // Calcular total pagado
    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Calcular pagos pendientes
    const pendingPayments = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Última fecha de pago
    const completedPayments = payments.filter(p => p.status === 'completed');
    let lastPaymentDate: Date | null = null;
    
    if (completedPayments.length > 0) {
      const sortedPayments = completedPayments.sort((a, b) => {
        const dateA = toJsDate(a.date);
        const dateB = toJsDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
      
      if (sortedPayments.length > 0 && sortedPayments[0].date) {
        lastPaymentDate = toJsDate(sortedPayments[0].date);
      }
    }
    
    // Suscripción actual
    const currentSubscription = subscriptions
      .filter(s => s.status === 'active')
      .sort((a, b) => {
        const dateA = toJsDate(a.endDate);
        const dateB = toJsDate(b.endDate);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      })[0];
    
    // Estado de la suscripción y días restantes
    let subscriptionStatus: 'active' | 'expired' | 'pending' | 'trial' = 'expired';
    let daysRemaining = 0;
    let paymentMethod = '';
    
    if (currentSubscription) {
      const now = new Date();
      const endDate = toJsDate(currentSubscription.endDate);
      
      if (endDate) {
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (currentSubscription.status === 'active' && daysRemaining > 0) {
          subscriptionStatus = 'active';
        } else if (currentSubscription.status === 'pending') {
          subscriptionStatus = 'pending';
        } else {
          subscriptionStatus = 'expired';
        }
      }
      
      paymentMethod = currentSubscription.paymentMethod;
    } else if (gym?.status === 'trial') {
      subscriptionStatus = 'trial';
    }
    
    setAccountSummary({
      totalPaid,
      pendingPayments,
      lastPaymentDate,
      subscriptionStatus,
      daysRemaining,
      paymentMethod
    });
  };
  
  const handleExportReport = () => {
    // Aquí implementarías la exportación a Excel/PDF
    // Por ahora solo un alert
    alert('Funcionalidad de exportación en desarrollo');
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Completado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} className="mr-1" />
            Pendiente
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Fallido
          </span>
        );
      default:
        return null;
    }
  };
  
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard size={16} className="text-blue-500" />;
      case 'transfer':
        return <FileText size={16} className="text-purple-500" />;
      case 'cash':
        return <DollarSign size={16} className="text-green-500" />;
      default:
        return <CreditCard size={16} className="text-gray-500" />;
    }
  };
  
  const filterPayments = () => {
    let filtered = [...payments];
    
    // Filtro por fecha
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(p => {
        const paymentDate = toJsDate(p.date);
        return paymentDate && paymentDate >= filterDate;
      });
    }
    
    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    // Ordenar por fecha descendente
    return filtered.sort((a, b) => {
      const dateA = toJsDate(a.date);
      const dateB = toJsDate(b.date);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !gym) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || 'Gimnasio no encontrado'}
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/superadmin-gyms')}
            className="mr-4 p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Estado de Cuenta - {gym.name}</h1>
            <p className="text-gray-600">Historial completo de pagos y suscripciones</p>
          </div>
        </div>
        
        <button
          onClick={handleExportReport}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Download size={18} className="mr-2" />
          Exportar Reporte
        </button>
      </div>
      
      {/* Resumen de cuenta */}
      {accountSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Pagado</p>
                <p className="text-2xl font-bold">{formatCurrency(accountSummary.totalPaid)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pagos Pendientes</p>
                <p className="text-2xl font-bold">{formatCurrency(accountSummary.pendingPayments)}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Estado de Suscripción</p>
                <p className="text-lg font-semibold capitalize">{accountSummary.subscriptionStatus}</p>
                {accountSummary.daysRemaining > 0 && (
                  <p className="text-sm text-gray-500">{accountSummary.daysRemaining} días restantes</p>
                )}
              </div>
              <CheckCircle className={`h-8 w-8 ${
                accountSummary.subscriptionStatus === 'active' ? 'text-green-500' : 'text-gray-400'
              }`} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Último Pago</p>
                <p className="text-lg font-semibold">
                  {accountSummary.lastPaymentDate ? formatDate(accountSummary.lastPaymentDate) : 'Sin pagos'}
                </p>
                {accountSummary.paymentMethod && (
                  <p className="text-sm text-gray-500 capitalize">{accountSummary.paymentMethod}</p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}
      
      {/* Información del gimnasio */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Información del Gimnasio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Propietario</p>
            <p className="font-medium">{gym.owner}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{gym.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Teléfono</p>
            <p className="font-medium">{gym.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">CUIT</p>
            <p className="font-medium">{gym.cuit}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fecha de Registro</p>
            <p className="font-medium">{formatDate(gym.registrationDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estado Actual</p>
            <p className="font-medium capitalize">{gym.status}</p>
          </div>
        </div>
      </div>
      
      {/* Historial de Suscripciones */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Historial de Suscripciones</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método de Pago</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{subscription.planName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>{formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(subscription.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(subscription.price)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getPaymentMethodIcon(subscription.paymentMethod)}
                      <span className="ml-2 capitalize">{subscription.paymentMethod}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Historial de Pagos */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Historial de Pagos</h2>
          <div className="flex items-center space-x-4">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border-gray-300"
            >
              <option value="all">Todos los pagos</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
              <option value="year">Último año</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border-gray-300"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completados</option>
              <option value="pending">Pendientes</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filterPayments().map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>{formatDateTime(payment.date)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.description || 'Pago de suscripción'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getPaymentMethodIcon(payment.method)}
                      <span className="ml-2 capitalize">{payment.method}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.reference || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filterPayments().length === 0 && (
          <div className="text-center py-6 text-gray-500">
            No se encontraron pagos con los filtros seleccionados
          </div>
        )}
      </div>
    </div>
  );
};

export default GymAccountDetails;