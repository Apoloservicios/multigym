// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, CreditCard, AlertTriangle, TrendingUp, ChevronRight,
  BarChart2, DollarSign, RefreshCw, Filter, User, UserPlus
} from 'lucide-react';
import { navigateTo } from '../../services/navigation.service';
import useAuth from '../../hooks/useAuth';
import { getRecentMembers, getMembersWithUpcomingBirthdays, getExpiredMemberships } from '../../services/member.service';
import { getDashboardStats } from '../../services/stats.service';
import { formatCurrency } from '../../utils/formatting.utils';
import { Member, MembershipAssignment } from '../../types/member.types';
import MemberChart from './MemberChart';
import SalesChart from './SalesChart';
import { formatDate, formatDateTime } from '../../utils/date.utils';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisMonth: number;
  totalRevenue: number;
  membershipRevenue: number;
  otherRevenue: number;
  membersByStatus: Record<string, number>;
  revenueByPeriod: Record<string, number>;
}

const Dashboard: React.FC = () => {
  const { gymData } = useAuth();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Member[]>([]);
  const [expiringMemberships, setExpiringMemberships] = useState<MembershipAssignment[]>([]);
  const [memberChartPeriod, setMemberChartPeriod] = useState<'month' | '3months' | 'year'>('month');
  const [salesChartPeriod, setSalesChartPeriod] = useState<'month' | '3months' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);
  
  // Cargar datos al iniciar
  useEffect(() => {
    loadDashboardData();
  }, [gymData?.id]);
  
  // Cargar datos del dashboard
  const loadDashboardData = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Cargar estadísticas
      const dashboardStats = await getDashboardStats(gymData.id);
      setStats(dashboardStats);
      
      // Cargar miembros recientes
      const recent = await getRecentMembers(gymData.id, 5);
      setRecentMembers(recent);
      
      // Cargar próximos cumpleaños
      const birthdays = await getMembersWithUpcomingBirthdays(gymData.id, 30, 5);
      setUpcomingBirthdays(birthdays);
      
      // Cargar membresías por vencer o vencidas
      const expired = await getExpiredMemberships(gymData.id, 5);
      setExpiringMemberships(expired);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };
  
  // Obtener color según el valor del KPI
  const getKpiColor = (value: number, threshold: number): string => {
    return value >= threshold ? 'text-green-600' : 'text-red-600';
  };
  
  // Actualizar periodo para gráficos
  const handleMemberChartPeriodChange = (period: 'month' | '3months' | 'year') => {
    setMemberChartPeriod(period);
  };
  
  const handleSalesChartPeriodChange = (period: 'month' | '3months' | 'year') => {
    setSalesChartPeriod(period);
  };
  
  // Mantener para referencia futura pero no usamos por ahora
  const navigateToMembers = () => {
    navigateTo('members');
  };
  
  // Mantener para referencia futura pero no usamos por ahora
  const navigateToMemberWithFilter = (memberId: string, memberName: string) => {
    navigateTo('members');
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
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Resumen general del gimnasio</p>
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
              <p className="text-gray-500 text-sm">Total Socios</p>
              <p className="text-2xl font-bold">{stats?.totalMembers || 0}</p>
              <p className="text-sm mt-1">
                <span className={getKpiColor(stats?.newMembersThisMonth || 0, 0)}>
                  {stats?.newMembersThisMonth || 0} nuevos este mes
                </span>
              </p>
            </div>
            <div className="bg-blue-100 rounded-full h-12 w-12 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Socios Activos</p>
              <p className="text-2xl font-bold">{stats?.activeMembers || 0}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  {stats?.inactiveMembers || 0} inactivos
                </span>
              </p>
            </div>
            <div className="bg-green-100 rounded-full h-12 w-12 flex items-center justify-center">
              <User className="h-6 w-6 text-green-600" />
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
                  Este mes
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
              <p className="text-gray-500 text-sm">Ingresos por Membresías</p>
              <p className="text-2xl font-bold">{formatCurrency(stats?.membershipRevenue || 0)}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  Otros: {formatCurrency(stats?.otherRevenue || 0)}
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
            <h2 className="text-lg font-semibold">Evolución de Socios</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleMemberChartPeriodChange('month')}
                className={`px-2 py-1 text-xs rounded ${
                  memberChartPeriod === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Mes
              </button>
              <button 
                onClick={() => handleMemberChartPeriodChange('3months')}
                className={`px-2 py-1 text-xs rounded ${
                  memberChartPeriod === '3months' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3 Meses
              </button>
              <button 
                onClick={() => handleMemberChartPeriodChange('year')}
                className={`px-2 py-1 text-xs rounded ${
                  memberChartPeriod === 'year' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Año
              </button>
            </div>
          </div>
          <div className="h-72">
            <MemberChart period={memberChartPeriod} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Ingresos</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleSalesChartPeriodChange('month')}
                className={`px-2 py-1 text-xs rounded ${
                  salesChartPeriod === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Mes
              </button>
              <button 
                onClick={() => handleSalesChartPeriodChange('3months')}
                className={`px-2 py-1 text-xs rounded ${
                  salesChartPeriod === '3months' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3 Meses
              </button>
              <button 
                onClick={() => handleSalesChartPeriodChange('year')}
                className={`px-2 py-1 text-xs rounded ${
                  salesChartPeriod === 'year' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Último Año
              </button>
            </div>
          </div>
          <div className="h-72">
            <SalesChart period={salesChartPeriod} />
          </div>
        </div>
      </div>
      
      {/* Tarjetas inferiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Miembros recientes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-100">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">Socios Recientes</h2>
            </div>
          </div>
          <div className="divide-y">
            {recentMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay socios recientes
              </div>
            ) : (
              recentMembers.map(member => (
                <div
                  key={member.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    {member.photo ? (
                      <img src={member.photo} alt={member.firstName} className="w-10 h-10 rounded-full object-cover mr-3" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium mr-3">
                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{member.firstName} {member.lastName}</div>
                      <div className="text-xs text-gray-500">Registrado el {formatDate(member.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Próximos cumpleaños */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-purple-50 p-4 border-b border-purple-100">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">Próximos Cumpleaños</h2>
            </div>
          </div>
          <div className="divide-y">
            {upcomingBirthdays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay cumpleaños próximos
              </div>
            ) : (
              upcomingBirthdays.map(member => (
                <div
                  key={member.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <div className="rounded-full bg-purple-100 p-2 mr-3">
                      <Calendar size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium">{member.firstName} {member.lastName}</div>
                      <div className="text-xs text-gray-500">
                        {member.birthDate ? formatDate(member.birthDate) : 'Fecha no disponible'}
                        {member.daysUntilBirthday !== undefined && (
                          <span className="ml-2 font-medium">
                            {member.daysUntilBirthday === 0 
                              ? ' (¡Hoy!)' 
                              : member.daysUntilBirthday === 1 
                                ? ' (¡Mañana!)' 
                                : ` (En ${member.daysUntilBirthday} días)`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Membresías por vencer o vencidas */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-yellow-50 p-4 border-b border-yellow-100">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">Membresías Vencidas</h2>
            </div>
          </div>
          <div className="divide-y">
            {expiringMemberships.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay membresías vencidas o por vencer
              </div>
            ) : (
              expiringMemberships.map(membership => (
                <div
                  key={membership.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <div className="rounded-full bg-yellow-100 p-2 mr-3">
                      <AlertTriangle size={16} className="text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-medium">{membership.memberName || 'Socio'}</div>
                      <div className="text-sm text-gray-700">
                        {membership.activityName}
                      </div>
                      <div className="text-xs text-red-500 font-medium">
                        Vencida: {formatDate(membership.endDate)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;