// src/components/payments/MonthlyPaymentsDashboard.tsx
// 💳 DASHBOARD DE PAGOS MENSUALES
// Panel principal para gestionar cobros mensuales

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Search,
  Filter,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useMonthlyPaymentsAutomation from '../../hooks/useMonthlyPaymentsAutomation';
import {
  getPendingPaymentsList,
  getMonthlySummary,
  registerPayment
} from '../../services/monthlyPayments.service';
import {
  MonthlyPaymentListItem,
  MonthlySummary
} from '../../types/monthlyPayments.types';

const MonthlyPaymentsDashboard: React.FC = () => {
  const { gymData } = useAuth();
  const automation = useMonthlyPaymentsAutomation(gymData?.id, true);

  // Estados
  const [loading, setLoading] = useState(true);
  const [pendingPayments, setPendingPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Cargar datos
  useEffect(() => {
    if (gymData?.id) {
      loadData();
    }
  }, [gymData?.id, selectedMonth]);

  /**
   * 📊 Cargar datos del mes
   */
  const loadData = async () => {
    if (!gymData?.id) return;

    setLoading(true);
    try {
      const [payments, monthlySummary] = await Promise.all([
        getPendingPaymentsList(gymData.id, selectedMonth || undefined),
        getMonthlySummary(gymData.id, selectedMonth || undefined)
      ]);

      setPendingPayments(payments);
      setSummary(monthlySummary);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 💰 Registrar un pago
   */
  const handlePayment = async (paymentId: string) => {
    if (!gymData?.id) return;

    try {
      const result = await registerPayment(gymData.id, paymentId, 'cash');
      
      if (result.success) {
        alert('Pago registrado correctamente');
        loadData(); // Recargar datos
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error registrando pago:', error);
      alert('Error al registrar el pago');
    }
  };

  /**
   * 🔍 Filtrar pagos
   */
  const filteredPayments = pendingPayments.filter(payment => {
    // Filtro por búsqueda
    const matchesSearch = payment.memberName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Filtro por estado
    let matchesStatus = true;
    if (filterStatus === 'overdue') {
      matchesStatus = payment.isOverdue;
    } else if (filterStatus === 'pending') {
      matchesStatus = !payment.isOverdue;
    }

    return matchesSearch && matchesStatus;
  });

  /**
   * 💵 Formatear moneda
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos Mensuales</h1>
          <p className="text-gray-600">
            Gestión de cobros del {selectedMonth || 'mes actual'}
          </p>
        </div>

        {/* Selector de mes */}
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
          <button
            onClick={() => automation.runManually()}
            disabled={automation.isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {automation.isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generar Pagos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total a cobrar */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total a Cobrar</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalToCollect)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          {/* Total cobrado */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cobrado</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalCollected)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          {/* Pendiente */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendiente</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(summary.totalPending)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          {/* Socios con deuda */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Con Deuda</p>
                <p className="text-2xl font-bold text-red-600">
                  {summary.membersWithDebt}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro de estado */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="overdue">Vencidos</option>
          </select>
        </div>
      </div>

      {/* Lista de pagos pendientes */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Pendiente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron resultados' : 'No hay pagos pendientes'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.memberId} className="hover:bg-gray-50">
                    {/* Socio */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.memberName}
                          </div>
                          {payment.memberEmail && (
                            <div className="text-sm text-gray-500">
                              {payment.memberEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actividades */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {payment.pendingActivities.map((activity, idx) => (
                          <div key={idx} className="mb-1">
                            {activity.activityName} - {formatCurrency(activity.amount)}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Total */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(payment.totalPending)}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.isOverdue ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Vencido ({payment.daysOverdue} días)
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          // Registrar pago de la primera actividad pendiente
                          if (payment.pendingActivities[0]) {
                            handlePayment(payment.pendingActivities[0].paymentId);
                          }
                        }}
                        className="text-green-600 hover:text-green-900 flex items-center justify-end gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Cobrar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estado de automatización */}
      {automation.lastResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Última generación automática
              </p>
              <p className="text-sm text-blue-700">
                {automation.lastRun?.toLocaleString('es-AR')} - {automation.lastResult.paymentsGenerated} pagos generados
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPaymentsDashboard;