// src/pages/superadmin/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CreditCard, ChevronRight, BarChart2, 
  DollarSign, Calendar, TrendingUp, Activity, RefreshCw
} from 'lucide-react';
import { getSuperadminStats } from '../../services/superadmin.service';
import { formatCurrency } from '../../utils/formatting.utils';
import { navigateTo } from '../../services/navigation.service';
import GymStats from '../../components/superadmin/GymStats';
import SubscriptionChart from '../../components/superadmin/SubscriptionChart';
import RevenueChart from '../../components/superadmin/RevenueChart';
import PaymentsList from '../../components/superadmin/PaymentsList';
import GymsList from '../../components/superadmin/GymsList';
import superadminService from '../../services/superadmin.service';







interface SuperadminStats {
  totalGyms: number;
  activeGyms: number;
  trialGyms: number;
  suspendedGyms: number;
  totalRevenue: number;
  revenueThisMonth: number;
  pendingPayments: number;
  newGymsThisMonth: number;
}

const SuperadminDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<SuperadminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | '3months' | 'year'>('month');
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dashboardStats = await superadminService.getSuperadminStats();
      setStats(dashboardStats);
    } catch (err: any) {
      console.error('Error loading superadmin dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };
  
  const handlePeriodChange = (newPeriod: 'month' | '3months' | 'year') => {
    setPeriod(newPeriod);
  };
  
  const navigateToGyms = () => {
    navigateTo('/superadmin/gyms');
  };
  
  const navigateToSubscriptions = () => {
    navigateTo('/superadmin/subscriptions');
  };
  
  const navigateToRevenue = () => {
    navigateTo('/superadmin/revenue');
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
          <p className="text-gray-600">Gestión global de gimnasios</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <button 
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 border rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar Datos
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Gimnasios</p>
              <p className="text-2xl font-bold">{stats?.totalGyms || 0}</p>
              <p className="text-sm mt-1">
                <span className="text-green-600">
                  {stats?.newGymsThisMonth || 0} nuevos este mes
                </span>
              </p>
            </div>
            <div className="bg-blue-100 rounded-full h-12 w-12 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Gimnasios Activos</p>
              <p className="text-2xl font-bold">{stats?.activeGyms || 0}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  {stats?.trialGyms || 0} en prueba
                </span>
              </p>
            </div>
            <div className="bg-green-100 rounded-full h-12 w-12 flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Ingresos Totales</p>
              <p className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  {formatCurrency(stats?.revenueThisMonth || 0)} este mes
                </span>
              </p>
            </div>
            <div className="bg-purple-100 rounded-full h-12 w-12 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pagos Pendientes</p>
              <p className="text-2xl font-bold">{formatCurrency(stats?.pendingPayments || 0)}</p>
              <p className="text-sm mt-1">
                <span className="text-yellow-600">
                  {stats?.suspendedGyms || 0} gimnasios suspendidos
                </span>
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full h-12 w-12 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Nuevas Suscripciones</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => handlePeriodChange('month')}
                className={`px-2 py-1 text-xs rounded ${
                  period === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Mes
              </button>
              <button 
                onClick={() => handlePeriodChange('3months')}
                className={`px-2 py-1 text-xs rounded ${
                  period === '3months' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3 Meses
              </button>
              <button 
                onClick={() => handlePeriodChange('year')}
                className={`px-2 py-1 text-xs rounded ${
                  period === 'year' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Año
              </button>
            </div>
          </div>
          <div className="h-72">
            <SubscriptionChart period={period} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Ingresos</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => handlePeriodChange('month')}
                className={`px-2 py-1 text-xs rounded ${
                  period === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Mes
              </button>
              <button 
                onClick={() => handlePeriodChange('3months')}
                className={`px-2 py-1 text-xs rounded ${
                  period === '3months' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3 Meses
              </button>
              <button 
                onClick={() => handlePeriodChange('year')}
                className={`px-2 py-1 text-xs rounded ${
                  period === 'year' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Año
              </button>
            </div>
          </div>
          <div className="h-72">
            <RevenueChart period={period} />
          </div>
        </div>
      </div>
      
      {/* Otras secciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Gimnasios Recientes</h2>
              <button 
                onClick={navigateToGyms}
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              >
                Ver todos <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="p-4">
            <GymsList limit={5} sortBy="recent" gyms={[]} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-purple-50 p-4 border-b border-purple-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Últimos Pagos</h2>
              <button 
                onClick={navigateToRevenue}
                className="text-purple-600 hover:text-purple-800 flex items-center text-sm"
              >
                Ver todos <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="p-4">
            <PaymentsList limit={5} />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="bg-yellow-50 p-4 border-b border-yellow-100">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Suscripciones Por Vencer</h2>
            <button 
              onClick={navigateToSubscriptions}
              className="text-yellow-600 hover:text-yellow-800 flex items-center text-sm"
            >
              Ver todas <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <GymStats showExpiring={true} limit={5} />
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;