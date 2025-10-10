// src/pages/dashboard/DashboardImproved.tsx
// 🎯 VERSIÓN LIMPIA - SOLO SISTEMA DE PAGOS MENSUALES
// ✅ Eliminado todo el sistema de renovaciones

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Calendar,
  Download,
  Info
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useFinancial from '../../hooks/useFinancial';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  getCurrentDateInArgentina,
  formatArgentinianDateTime
} from '../../utils/timezone.utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { exportTransactionsToExcel } from '../../utils/excel.utils';

// 📊 Interfaz de métricas mejoradas
interface EnhancedDashboardMetrics {
  // Socios
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  
  // Financiero - Hoy
  todayIncome: number;
  todayExpenses: number;
  todayNet: number;
  refundsToday: number;
  
  // Financiero - Mes
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  refundsThisMonth: number;
  
  // Pagos Mensuales
  pendingPayments: number;
  pendingAmount: number;
  overduePayments: number;
  overdueAmount: number;
  
  // Estado de caja
  isCashOpen?: boolean;
}

// 💳 Pago mensual pendiente
interface PendingPayment {
  id: string;
  memberName: string;
  activityName: string;
  amount: number;
  dueDate: string;
  month: string;
  status: 'pending' | 'overdue';
  daysOverdue?: number;
}

const DashboardImproved: React.FC = () => {
  const { gymData } = useAuth();
  const {
    dailySummary,
    transactions,
    loading: financialLoading,
    loadDailySummary
  } = useFinancial();

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
    overduePayments: 0,
    overdueAmount: 0,
    refundsToday: 0,
    refundsThisMonth: 0,
    isCashOpen: false
  });

  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Verificar si debe cargar
  const shouldLoad = () => {
    if (!gymData?.id) {
      console.log('⏸️ No hay gymId, no se carga dashboard');
      return false;
    }
    return true;
  };

  // 📊 Cargar métricas de socios
  const loadMemberMetrics = async (gymId: string) => {
    try {
      const membersRef = collection(db, `gyms/${gymId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      let active = 0;
      let inactive = 0;
      let withDebt = 0;

      membersSnapshot.forEach((doc) => {
        const member = doc.data();
        if (member.status === 'active') active++;
        else inactive++;
        
        if (member.totalDebt && member.totalDebt > 0) withDebt++;
      });

      return {
        totalMembers: membersSnapshot.size,
        activeMembers: active,
        inactiveMembers: inactive,
        membersWithDebt: withDebt
      };
    } catch (err) {
      console.error('Error loading member metrics:', err);
      throw err;
    }
  };

  // 💰 Cargar métricas financieras mensuales
  const loadMonthlyFinancialMetrics = async (gymId: string) => {
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      let totalIncome = 0;
      let totalExpenses = 0;
      let totalRefunds = 0;

      // Recorrer cada día del mes
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        try {
          const dailyCashRef = collection(db, `gyms/${gymId}/dailyCash/${dateStr}/transactions`);
          const q = query(dailyCashRef, orderBy('timestamp', 'desc'));
          const snapshot = await getDocs(q);

          snapshot.forEach((doc) => {
            const tx = doc.data();
            if (tx.type === 'income') {
              totalIncome += tx.amount || 0;
            } else if (tx.type === 'expense') {
              totalExpenses += tx.amount || 0;
            } else if (tx.type === 'refund') {
              totalRefunds += tx.amount || 0;
            }
          });
        } catch (err) {
          // Día sin transacciones
          continue;
        }
      }

      return {
        monthlyIncome: totalIncome,
        monthlyExpenses: totalExpenses,
        monthlyNet: totalIncome - totalExpenses,
        refundsThisMonth: totalRefunds
      };
    } catch (err) {
      console.error('Error loading monthly metrics:', err);
      return {
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyNet: 0,
        refundsThisMonth: 0
      };
    }
  };

  // 📅 Cargar pagos mensuales pendientes
  const loadMonthlyPayments = async (gymId: string) => {
    try {
      const paymentsRef = collection(db, `gyms/${gymId}/monthlyPayments`);
      const q = query(
        paymentsRef,
        where('status', 'in', ['pending', 'overdue']),
        orderBy('dueDate', 'asc')
      );

      const snapshot = await getDocs(q);
      const payments: PendingPayment[] = [];
      let pendingCount = 0;
      let pendingTotal = 0;
      let overdueCount = 0;
      let overdueTotal = 0;

      const today = new Date();

      snapshot.forEach((doc) => {
        const payment = doc.data();
        const dueDate = new Date(payment.dueDate);
        const isOverdue = today > dueDate;

        const paymentData: PendingPayment = {
          id: doc.id,
          memberName: payment.memberName || 'Desconocido',
          activityName: payment.activityName || 'Actividad',
          amount: payment.amount || 0,
          dueDate: payment.dueDate,
          month: payment.month,
          status: isOverdue ? 'overdue' : 'pending',
          daysOverdue: isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
        };

        payments.push(paymentData);

        if (isOverdue) {
          overdueCount++;
          overdueTotal += payment.amount || 0;
        } else {
          pendingCount++;
          pendingTotal += payment.amount || 0;
        }
      });

      setPendingPayments(payments.slice(0, 10)); // Mostrar solo los 10 primeros

      return {
        pendingPayments: pendingCount,
        pendingAmount: pendingTotal,
        overduePayments: overdueCount,
        overdueAmount: overdueTotal
      };
    } catch (err) {
      console.error('Error loading monthly payments:', err);
      return {
        pendingPayments: 0,
        pendingAmount: 0,
        overduePayments: 0,
        overdueAmount: 0
      };
    }
  };

  // 📊 Cargar todas las métricas
  const loadDashboardData = useCallback(async () => {
    if (!shouldLoad()) return;

    setLoading(true);
    setError('');

    try {
      const gymId = gymData!.id;

      // Cargar todas las métricas en paralelo
      const [memberMetrics, monthlyFinancial, monthlyPaymentMetrics] = await Promise.all([
        loadMemberMetrics(gymId),
        loadMonthlyFinancialMetrics(gymId),
        loadMonthlyPayments(gymId)
      ]);

      setMetrics(prev => ({
        ...prev,
        ...memberMetrics,
        ...monthlyFinancial,
        ...monthlyPaymentMetrics
      }));

    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id]);

  // 🔄 Sincronizar con datos financieros diarios
  useEffect(() => {
    if (dailySummary && !financialLoading) {
      setMetrics(prev => ({
        ...prev,
        todayIncome: dailySummary.totalIncome,
        todayExpenses: dailySummary.totalExpenses,
        todayNet: dailySummary.netAmount,
        refundsToday: dailySummary.refunds || 0
        // isCashOpen se obtiene por otro medio si es necesario
      }));
    }
  }, [dailySummary, financialLoading]);

  // 🚀 Cargar datos al montar y cuando hay transacciones
  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
    }
  }, [gymData?.id, loadDashboardData]);

  // 🔄 Refrescar datos
  const handleRefresh = async () => {
    if (refreshing || !shouldLoad()) return;
    setRefreshing(true);
    const today = getCurrentDateInArgentina();
    await loadDailySummary(today);
    await loadDashboardData();
    setRefreshing(false);
  };

  // 📥 Exportar datos a Excel
  const handleExportExcel = async () => {
    if (!gymData?.id) return;

    try {
      const today = getCurrentDateInArgentina();
      await exportTransactionsToExcel(
        transactions,
        gymData.name || 'Gimnasio', // Cambiar businessName por name
        `transacciones_${today}`
      );
    } catch (err) {
      console.error('Error exportando:', err);
    }
  };

  if (loading && !metrics.totalMembers) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Resumen general del gimnasio
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="mr-2" size={16} />
            Exportar
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Métricas de Socios */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalMembers}</p>
            </div>
            <Users className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-green-600">{metrics.activeMembers}</p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactivos</p>
              <p className="text-2xl font-bold text-gray-600">{metrics.inactiveMembers}</p>
            </div>
            <Users className="h-12 w-12 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Deuda</p>
              <p className="text-2xl font-bold text-red-600">{metrics.membersWithDebt}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
        </div>
      </div>

      {/* Métricas Financieras - Hoy */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Calendar className="mr-2" size={20} />
          Resumen de Hoy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border-l-4 border-green-500 pl-4">
            <p className="text-sm text-gray-600">Ingresos</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(metrics.todayIncome)}
            </p>
          </div>
          <div className="border-l-4 border-red-500 pl-4">
            <p className="text-sm text-gray-600">Egresos</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(metrics.todayExpenses)}
            </p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-sm text-gray-600">Balance Neto</p>
            <p className={`text-xl font-bold ${metrics.todayNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.todayNet)}
            </p>
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <p className="text-sm text-gray-600">Reintegros</p>
            <p className="text-xl font-bold text-orange-600">
              {formatCurrency(metrics.refundsToday)}
            </p>
          </div>
        </div>
      </div>

      {/* Métricas Financieras - Mes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="mr-2" size={20} />
          Resumen del Mes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border-l-4 border-green-500 pl-4">
            <p className="text-sm text-gray-600">Ingresos</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(metrics.monthlyIncome)}
            </p>
          </div>
          <div className="border-l-4 border-red-500 pl-4">
            <p className="text-sm text-gray-600">Egresos</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(metrics.monthlyExpenses)}
            </p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-sm text-gray-600">Balance Neto</p>
            <p className={`text-xl font-bold ${metrics.monthlyNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.monthlyNet)}
            </p>
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <p className="text-sm text-gray-600">Reintegros</p>
            <p className="text-xl font-bold text-orange-600">
              {formatCurrency(metrics.refundsThisMonth)}
            </p>
          </div>
        </div>
      </div>

      {/* Pagos Mensuales */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <CreditCard className="mr-2" size={20} />
          Pagos Mensuales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{metrics.pendingPayments}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Total: {formatCurrency(metrics.pendingAmount)}
                </p>
              </div>
              <Clock className="h-10 w-10 text-yellow-500" />
            </div>
          </div>

          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{metrics.overduePayments}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Total: {formatCurrency(metrics.overdueAmount)}
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
          </div>
        </div>

        {/* Lista de pagos pendientes */}
        {pendingPayments.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Próximos Vencimientos</h3>
            <div className="space-y-2">
              {pendingPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{payment.memberName}</p>
                    <p className="text-sm text-gray-600">{payment.activityName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                    <p className={`text-xs ${payment.status === 'overdue' ? 'text-red-600' : 'text-gray-500'}`}>
                      {payment.status === 'overdue' 
                        ? `Vencido hace ${payment.daysOverdue} días`
                        : `Vence: ${payment.dueDate}`
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer con info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Sistema de Pagos Mensuales Activo</p>
            <p className="mt-1">
              Los pagos se generan automáticamente el día 1 de cada mes y vencen el día 15.
              <br />
              Última actualización: {formatArgentinianDateTime(Timestamp.now())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardImproved;