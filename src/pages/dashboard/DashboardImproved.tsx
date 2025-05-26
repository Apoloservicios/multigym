// src/pages/dashboard/DashboardImproved.tsx - Dashboard con sistema financiero mejorado

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserCheck, 
  DollarSign, 
  Activity, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useFinancial from '../../hooks/useFinancial';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// Tipos para las métricas del dashboard mejorado
interface EnhancedDashboardMetrics {
  // Métricas de socios
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  
  // Métricas financieras mejoradas
  todayIncome: number;
  todayExpenses: number;
  todayNet: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  pendingPayments: number;
  pendingAmount: number;
  
  // Métricas de asistencia
  todayAttendance: number;
  thisWeekAttendance: number;
  
  // Alertas mejoradas
  expiringMemberships: number;
  overduePayments: number;
  refundsToday: number;
}

interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface RecentFinancialActivity {
  id: string;
  type: 'payment' | 'refund' | 'expense';
  memberName: string; // 🔧 REQUERIDO
  amount: number;
  method: string; // 🔧 REQUERIDO
  timestamp: any;
  status: string;
}

const DashboardImproved: React.FC = () => {
  const { gymData } = useAuth();
  const { 
    transactions, 
    dailySummary, 
    loading: financialLoading, 
    error: financialError,
    refreshData: refreshFinancialData 
  } = useFinancial();
  
  // Estados principales
  const [metrics, setMetrics] = useState<EnhancedDashboardMetrics>({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    membersWithDebt: 0,
    todayIncome: 0,
    todayExpenses: 0,
    todayNet: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyNet: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    todayAttendance: 0,
    thisWeekAttendance: 0,
    expiringMemberships: 0,
    overduePayments: 0,
    refundsToday: 0
  });
  
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]); // 🔧 SIMPLIFICADO
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener fechas para filtros temporales
  const getDateRanges = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      today: Timestamp.fromDate(today),
      thisMonth: Timestamp.fromDate(thisMonth),
      thisWeek: Timestamp.fromDate(thisWeek),
      now: Timestamp.fromDate(now),
      todayString: today.toISOString().split('T')[0]
    };
  }, []);

  // Cargar métricas principales mejoradas
  const loadEnhancedMetrics = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      const { today, thisMonth, thisWeek, todayString } = getDateRanges();
      
      // Cargar métricas de socios (sin cambios)
      const [
        totalMembersSnap,
        activeMembersSnap,
        inactiveMembersSnap,
        membersWithDebtSnap
      ] = await Promise.all([
        getDocs(collection(db, `gyms/${gymData.id}/members`)),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'active')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'inactive')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('totalDebt', '>', 0)
        ))
      ]);

      // Cargar asistencias
      const [todayAttendanceSnap, weekAttendanceSnap] = await Promise.all([
        getDocs(query(
          collection(db, `gyms/${gymData.id}/attendance`),
          where('timestamp', '>=', today),
          where('status', '==', 'success')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/attendance`),
          where('timestamp', '>=', thisWeek),
          where('status', '==', 'success')
        ))
      ]);

      // Cargar membresías que expiran y pagos pendientes
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const [expiringMembershipsSnap, pendingPaymentsSnap, overduePaymentsSnap] = await Promise.all([
        getDocs(query(
          collection(db, `gyms/${gymData.id}/membershipAssignments`),
          where('status', '==', 'active'),
          where('endDate', '<=', Timestamp.fromDate(nextWeek))
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/membershipAssignments`),
          where('paymentStatus', '==', 'pending')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/membershipAssignments`),
          where('paymentStatus', '==', 'pending'),
          where('endDate', '<', Timestamp.fromDate(new Date()))
        ))
      ]);

      // Calcular métricas financieras desde el resumen diario y transacciones
      let todayIncome = 0;
      let todayExpenses = 0;
      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      let pendingAmount = 0;
      let refundsToday = 0;

      // Usar el dailySummary si está disponible
      if (dailySummary) {
        todayIncome = dailySummary.totalIncome;
        todayExpenses = dailySummary.totalExpenses;
        refundsToday = dailySummary.refunds;
      }

      // Calcular totales mensuales desde transacciones
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = t.createdAt.toDate();
        return transactionDate >= thisMonth.toDate();
      });

      monthlyTransactions.forEach(transaction => {
        if (transaction.status === 'completed') {
          if (transaction.amount > 0) {
            monthlyIncome += transaction.amount;
          } else {
            monthlyExpenses += Math.abs(transaction.amount);
          }
        }
      });

      // Calcular monto de pagos pendientes
      pendingPaymentsSnap.forEach(doc => {
        const data = doc.data();
        pendingAmount += data.cost || 0;
      });

      // Actualizar métricas
      setMetrics({
        totalMembers: totalMembersSnap.size,
        activeMembers: activeMembersSnap.size,
        inactiveMembers: inactiveMembersSnap.size,
        membersWithDebt: membersWithDebtSnap.size,
        todayIncome,
        todayExpenses,
        todayNet: todayIncome - todayExpenses,
        monthlyIncome,
        monthlyExpenses,
        monthlyNet: monthlyIncome - monthlyExpenses,
        pendingPayments: pendingPaymentsSnap.size,
        pendingAmount,
        todayAttendance: todayAttendanceSnap.size,
        thisWeekAttendance: weekAttendanceSnap.size,
        expiringMemberships: expiringMembershipsSnap.size,
        overduePayments: overduePaymentsSnap.size,
        refundsToday
      });

    } catch (err: any) {
      console.error('Error loading enhanced metrics:', err);
      setError('Error al cargar las métricas del dashboard');
    }
  }, [gymData?.id, getDateRanges, dailySummary, transactions]);

  // Generar breakdown de métodos de pago
  const generatePaymentBreakdown = useCallback(() => {
    if (!dailySummary || !dailySummary.paymentBreakdown) {
      setPaymentBreakdown([]);
      return;
    }

    const total = dailySummary.totalIncome;
    const breakdown = dailySummary.paymentBreakdown.map(payment => ({
      method: payment.paymentMethod,
      amount: payment.totalAmount,
      count: payment.count,
      percentage: total > 0 ? (payment.totalAmount / total) * 100 : 0
    }));

    setPaymentBreakdown(breakdown);
  }, [dailySummary]);

  // Generar actividades recientes desde transacciones
  const generateRecentActivities = useCallback(() => {
    if (!transactions.length) {
      setRecentActivities([]);
      return;
    }

    const recentTransactions = transactions
      .slice(0, 10)
      .map(transaction => ({
        id: transaction.id || '',
        type: transaction.amount > 0 ? 'payment' as const : 'refund' as const,
        memberName: transaction.memberName || 'N/A', // 🔧 VALOR POR DEFECTO
        amount: Math.abs(transaction.amount),
        method: transaction.paymentMethod || 'N/A', // 🔧 VALOR POR DEFECTO
        timestamp: transaction.createdAt,
        status: transaction.status || 'completed' // 🔧 VALOR POR DEFECTO
      }));

    setRecentActivities(recentTransactions);
  }, [transactions]);

  // Cargar todos los datos
  const loadDashboardData = useCallback(async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadEnhancedMetrics(),
        refreshFinancialData()
      ]);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id, loadEnhancedMetrics, refreshFinancialData]);

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Efectos
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    generatePaymentBreakdown();
    generateRecentActivities();
  }, [generatePaymentBreakdown, generateRecentActivities]);

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Formatear fecha para mostrar
  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'Fecha no disponible';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  // Obtener color para el indicador de red amount
  const getNetAmountColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Obtener icono para método de pago
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Wallet size={16} className="text-green-600" />;
      case 'card': return <CreditCard size={16} className="text-blue-600" />;
      case 'transfer': return <ArrowUpRight size={16} className="text-purple-600" />;
      default: return <DollarSign size={16} className="text-gray-600" />;
    }
  };

  if (loading && Object.values(metrics).every(v => v === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard mejorado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Financiero</h1>
          <p className="text-gray-600 mt-1">
            Gestión integral de {gymData?.name || 'tu gimnasio'}
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin mr-2' : 'mr-2'} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Error state */}
      {(error || financialError) && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-red-600 mr-2" />
            <span className="text-red-700">{error || financialError}</span>
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Métricas financieras principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Ingresos de Hoy */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Hoy</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.todayIncome)}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-500">
                  Neto: {formatCurrency(metrics.todayNet)}
                </span>
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <ArrowUpRight size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Ingresos Mensuales */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Mensuales</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(metrics.monthlyIncome)}
              </p>
              <div className="flex items-center mt-2">
                <span className={`text-sm ${getNetAmountColor(metrics.monthlyNet)}`}>
                  Neto: {formatCurrency(metrics.monthlyNet)}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Pagos Pendientes */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(metrics.pendingAmount)}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-500">
                  {metrics.pendingPayments} membresías
                </span>
              </div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg">
              <Clock size={24} className="text-amber-600" />
            </div>
          </div>
        </div>

        {/* Asistencia Hoy */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Asistencia Hoy</p>
              <p className="text-2xl font-bold text-purple-600">{metrics.todayAttendance}</p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-500">
                  {metrics.thisWeekAttendance} esta semana
                </span>
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <UserCheck size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Alertas mejoradas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas Financieras</h3>
          <div className="space-y-3">
            {metrics.overduePayments > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm text-red-700">Pagos vencidos</span>
                <span className="text-sm font-bold text-red-700">{metrics.overduePayments}</span>
              </div>
            )}
            {metrics.pendingPayments > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm text-yellow-700">Pagos pendientes</span>
                <span className="text-sm font-bold text-yellow-700">{metrics.pendingPayments}</span>
              </div>
            )}
            {metrics.refundsToday > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-700">Devoluciones hoy</span>
                <span className="text-sm font-bold text-orange-700">{metrics.refundsToday}</span>
              </div>
            )}
            {metrics.overduePayments === 0 && metrics.pendingPayments === 0 && metrics.refundsToday === 0 && (
              <div className="flex items-center justify-center p-3 bg-green-50 rounded-lg">
                <CheckCircle size={16} className="text-green-600 mr-2" />
                <span className="text-sm text-green-700">Todo al día</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Métodos de Pago Hoy</h3>
          <div className="space-y-3">
            {paymentBreakdown.length > 0 ? (
              paymentBreakdown.map((payment, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getPaymentMethodIcon(payment.method)}
                    <span className="text-sm text-gray-700 ml-2 capitalize">
                      {payment.method === 'cash' ? 'Efectivo' :
                       payment.method === 'card' ? 'Tarjeta' :
                       payment.method === 'transfer' ? 'Transferencia' : 'Otro'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatCurrency(payment.amount)}</div>
                    <div className="text-xs text-gray-500">{payment.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center">Sin pagos registrados</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Socios</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total socios</span>
              <span className="text-sm font-medium">{metrics.totalMembers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Activos</span>
              <span className="text-sm font-medium text-green-600">{metrics.activeMembers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Inactivos</span>
              <span className="text-sm font-medium">{metrics.inactiveMembers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">Con deuda</span>
              <span className="text-sm font-medium text-red-600">{metrics.membersWithDebt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad financiera reciente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Actividad Financiera Reciente</h2>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay actividad financiera reciente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${
                      activity.type === 'payment' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {activity.type === 'payment' ? (
                        <ArrowUpRight size={16} className="text-green-600" />
                      ) : (
                        <ArrowDownLeft size={16} className="text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.memberName}</p>
                      <p className="text-sm text-gray-600">
                        {activity.type === 'payment' ? 'Pago' : 'Devolución'} • {activity.method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      activity.type === 'payment' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {activity.type === 'payment' ? '+' : '-'}{formatCurrency(activity.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer del dashboard */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Sistema financiero integrado. Datos actualizados automáticamente cada 5 minutos.
          <br />
          Última actualización: {new Date().toLocaleTimeString('es-AR')}
        </p>
      </div>
    </div>
  );
};

export default DashboardImproved;