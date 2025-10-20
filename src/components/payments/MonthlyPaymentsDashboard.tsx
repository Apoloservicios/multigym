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
  TrendingDown,
  MessageCircle,
  CreditCard
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useMonthlyPaymentsAutomation from '../../hooks/useMonthlyPaymentsAutomation';
import { useNavigate } from 'react-router-dom';
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
   const navigate = useNavigate(); 

  // Estados
  const [loading, setLoading] = useState(true);
  const [pendingPayments, setPendingPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Estados para paginación y ordenamiento
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<'name' | 'amount' | 'dueDate'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
   * 📱 Notificar deuda por WhatsApp
   */
  const handleNotifyDebt = (payment: MonthlyPaymentListItem) => {
    // Obtener el teléfono del socio - NOTA: necesitas agregarlo al tipo
    const phoneNumber = (payment as any).memberPhone || '';
    
    if (!phoneNumber) {
      alert('Este socio no tiene teléfono registrado');
      return;
    }
    
    // Limpiar el teléfono
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone.startsWith('54')) {
      cleanPhone = '54' + cleanPhone;
    }
    
    // Construir el mensaje
    const totalDebt = payment.pendingActivities.reduce((sum, act) => sum + act.amount, 0);
    const activities = payment.pendingActivities.map(act => act.activityName).join(', ');
    
    // Obtener la fecha de vencimiento más próxima
    const nextDueDate = payment.pendingActivities[0]?.dueDate || 'Consultar';
    
    const message = `Hola ${payment.memberName}! 👋

Le informamos que según nuestro sistema posee una deuda pendiente de *$${totalDebt.toLocaleString('es-AR')}*

📋 *Actividades:* ${activities}
📅 *Vencimiento:* ${nextDueDate}

Por favor, acérquese al gimnasio para regularizar su situación.

¡Gracias! 💪`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

/**
 * 💳 Ir a la cuenta del socio para pagar
 */


const handleGoToPay = (memberId: string) => {
  // Guardar en sessionStorage ANTES de navegar
  sessionStorage.setItem('memberDetailActiveTab', 'cuenta');
  
  // Navegar pasando el memberId en el state
  navigate('/members', { 
    state: { memberId }
  });
};

  /**
   * 🔍 Filtrar pagos - DEBE ESTAR ANTES DE sortedPayments
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
   * Función para ordenar - DESPUÉS de filteredPayments
   */
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'name') {
      comparison = a.memberName.localeCompare(b.memberName);
    } else if (sortField === 'amount') {
      const amountA = a.pendingActivities.reduce((sum, act) => sum + act.amount, 0);
      const amountB = b.pendingActivities.reduce((sum, act) => sum + act.amount, 0);
      comparison = amountA - amountB;
    } else if (sortField === 'dueDate') {
      // Usar la primera fecha de vencimiento pendiente
      const dateA = a.pendingActivities[0]?.dueDate || '';
      const dateB = b.pendingActivities[0]?.dueDate || '';
      comparison = dateA.localeCompare(dateB);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  /**
   * Paginación
   */
  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = sortedPayments.slice(startIndex, startIndex + itemsPerPage);

  /**
   * Función para cambiar orden
   */
  const handleSort = (field: 'name' | 'amount' | 'dueDate') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
                {/* Socio - CON ORDENAMIENTO */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Socio
                    {sortField === 'name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>

                {/* Actividades */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividades
                </th>

                {/* Total - CON ORDENAMIENTO */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Total Pendiente
                    {sortField === 'amount' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>

                {/* Estado */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>

                {/* Acciones */}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron resultados' : 'No hay pagos pendientes'}
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment) => (
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
                      <div className="flex items-center justify-end gap-2">
                        {/* Botón Notificar */}
                        <button
                          onClick={() => handleNotifyDebt(payment)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1 px-3 py-1 border border-blue-300 rounded-md hover:bg-blue-50"
                          title="Notificar por WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Notificar
                        </button>

                        {/* Botón Ir a Pagar */}
                        <button
                          onClick={() => handleGoToPay(payment.memberId)}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1 px-3 py-1 border border-green-300 rounded-md hover:bg-green-50"
                          title="Ir a pagar"
                        >
                          <CreditCard className="w-4 h-4" />
                          Ir a Pagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CONTROLES DE PAGINACIÓN - VA AQUÍ, DESPUÉS DE LA TABLA */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
            <div className="text-sm text-gray-700">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedPayments.length)} de {sortedPayments.length} socios
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Anterior
              </button>
              
              <span className="text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
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