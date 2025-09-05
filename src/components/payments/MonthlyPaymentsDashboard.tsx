// src/components/payments/MonthlyPaymentsDashboard.tsx
// 📊 DASHBOARD PRINCIPAL DE COBROS MENSUALES - VERSIÓN COMPLETA

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Play,
  RefreshCw,
  Download,
  Eye,
  Settings
} from 'lucide-react';
import MonthlyPaymentsService from '../../services/monthlyPayments.service';
import { MonthlySummary, MonthlyPaymentListItem } from '../../types/monthlyPayments.types';

import useAuth from '../../hooks/useAuth';

import PaginatedPendingPayments from './PaginatedPendingPayments';
import OptimizedMemberControls from './OptimizedMemberControls';

const MonthlyPaymentsDashboard: React.FC = () => {
  // Estados
  const { gymData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [paymentsList, setPaymentsList] = useState<MonthlyPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentView, setCurrentView] = useState<'dashboard' | 'payments' | 'controls'>('dashboard');

  // Cargar datos al inicializar
  useEffect(() => {
    if (gymData?.id && currentView !== 'controls') {
      loadMonthlyData();
    }
  }, [gymData?.id, currentMonth, currentView]);

  /**
   * 📊 Cargar datos del mes seleccionado
   */
  const loadMonthlyData = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      
      // Cargar resumen del mes
      const monthSummary = await MonthlyPaymentsService.getMonthlySummary(gymData.id, year, month);
      setSummary(monthSummary);
      
      if (monthSummary) {
        console.log('✅ Datos cargados para', formatMonth(currentMonth));
      } else {
        console.log('⚠️ No hay datos para', formatMonth(currentMonth));
      }
      
    } catch (err: any) {
      console.error('❌ Error cargando datos mensuales:', err);
      setError('Error al cargar los datos del mes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🤖 Ejecutar generación automática del mes actual
   */
  const generateCurrentMonth = async () => {
    if (!gymData?.id || processing) return;
    
    setProcessing(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('🚀 Iniciando generación manual...');
      
      const result = await MonthlyPaymentsService.generateMonthlyPayments(gymData.id);
      
      if (result.success) {
        setSuccess(`✅ Proceso completado:
        • ${result.processedMembers} socios procesados
        • $${result.totalAmount.toLocaleString('es-AR')} total generado
        ${result.errors.length > 0 ? `• ${result.errors.length} errores` : ''}`);
        
        // Recargar datos
        setTimeout(() => {
          loadMonthlyData();
        }, 1000);
        
      } else {
        setError(`❌ Error en el proceso: ${result.errors.join(', ')}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error ejecutando generación:', err);
      setError('Error al generar pagos del mes');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 📅 Formatear mes para mostrar
   */
  const formatMonth = (monthString: string): string => {
    const [year, month] = monthString.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  /**
   * 💰 Formatear moneda
   */
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  /**
   * 📈 Calcular porcentaje de cobros
   */
  const getCollectionPercentage = (): number => {
    if (!summary || summary.totalToCollect === 0) return 0;
    return Math.round((summary.totalCollected / summary.totalToCollect) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header con navegación por pestañas */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Cobros</h1>
          <p className="text-gray-600">Gestión completa de cobros automáticos</p>
        </div>
        
        {/* Selector de mes - solo visible en vista dashboard y payments */}
        {currentView !== 'controls' && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar size={20} />
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - 6 + i);
                  const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                  return (
                    <option key={value} value={value}>
                      {formatMonth(value)}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <button
              onClick={loadMonthlyData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        )}
      </div>

      {/* Navegación por pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp size={16} className="inline mr-2" />
            Dashboard
          </button>
          
          <button
            onClick={() => setCurrentView('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'payments'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign size={16} className="inline mr-2" />
            Pagos Pendientes
            {summary && summary.membersWithDebt > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {summary.membersWithDebt}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setCurrentView('controls')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              currentView === 'controls'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            Control de Estados
          </button>
        </nav>
      </div>

      {/* Mensajes de estado globales */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-600 mr-2" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-2" size={20} />
            <pre className="text-green-800 whitespace-pre-wrap text-sm">{success}</pre>
          </div>
        </div>
      )}

      {/* Contenido según la vista seleccionada */}
      {currentView === 'dashboard' && (
        <>
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
                <p className="text-gray-600">Cargando datos de cobros...</p>
              </div>
            </div>
          )}

          {/* Si no hay datos para este mes */}
          {!summary && !loading && (
            <div className="text-center py-12">
              <Calendar className="mx-auto mb-4 text-gray-400" size={64} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay datos para {formatMonth(currentMonth)}
              </h3>
              <p className="text-gray-600 mb-6">
                Los pagos de este mes aún no han sido generados automáticamente.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={generateCurrentMonth}
                  disabled={processing}
                  className="flex items-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="animate-spin mr-2" size={20} />
                  ) : (
                    <Play className="mr-2" size={20} />
                  )}
                  {processing ? 'Generando...' : `Generar Cobros de ${formatMonth(currentMonth)}`}
                </button>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
                  <p className="text-sm text-blue-800">
                    Crea automáticamente las cuotas de {formatMonth(currentMonth)} para todos los socios activos con membresías de auto-renovación habilitadas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard con datos */}
          {summary && (
            <div className="space-y-6">
              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total a cobrar */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total a Cobrar</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(summary.totalToCollect)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total cobrado */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Cobrado</p>
                      <p className="text-2xl font-semibold text-green-600">
                        {formatCurrency(summary.totalCollected)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getCollectionPercentage()}% del total
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pendiente */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Pendiente</p>
                      <p className="text-2xl font-semibold text-red-600">
                        {formatCurrency(summary.totalPending)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {100 - getCollectionPercentage()}% del total
                      </p>
                    </div>
                  </div>
                </div>

                {/* Socios */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Socios</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {summary.totalMembers}
                      </p>
                      <p className="text-xs text-gray-500">
                        {summary.membersWithDebt} con deuda
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de progreso general */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Progreso de Cobros - {formatMonth(currentMonth)}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {summary.membersUpToDate} socios al día • {summary.membersWithDebt} con deuda
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${getCollectionPercentage()}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-600">0%</span>
                  <span className="font-medium text-gray-900">
                    {getCollectionPercentage()}% cobrado
                  </span>
                  <span className="text-gray-600">100%</span>
                </div>
              </div>

              {/* Breakdown por actividades */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Resumen por Actividad
                </h3>
                
                {Object.keys(summary.activitiesBreakdown).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(summary.activitiesBreakdown).map(([activityName, data]) => (
                      <div key={activityName} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{activityName}</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Socios:</span>
                            <span className="font-medium">{data.members}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-medium">{formatCurrency(data.totalCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">Cobrado:</span>
                            <span className="text-green-600 font-medium">{formatCurrency(data.collected)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600">Pendiente:</span>
                            <span className="text-red-600 font-medium">{formatCurrency(data.pending)}</span>
                          </div>
                        </div>
                        
                        {/* Mini barra de progreso por actividad */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ 
                                width: `${data.totalCost > 0 ? (data.collected / data.totalCost) * 100 : 0}%` 
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 text-center">
                            {data.totalCost > 0 
                              ? Math.round((data.collected / data.totalCost) * 100)
                              : 0}% cobrado
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No hay actividades registradas para este mes
                  </p>
                )}
              </div>

              {/* Acciones rápidas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
                
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setCurrentView('payments')}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="mr-2" size={16} />
                    Ver Pagos Pendientes
                  </button>
                  
                  <button
                    onClick={() => {/* TODO: Implementar exportar */}}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Download className="mr-2" size={16} />
                    Exportar a Excel
                  </button>
                  
                  <button
                    onClick={generateCurrentMonth}
                    disabled={processing}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {processing ? (
                      <RefreshCw className="animate-spin mr-2" size={16} />
                    ) : (
                      <RefreshCw className="mr-2" size={16} />
                    )}
                    {processing ? 'Procesando...' : 'Regenerar Mes'}
                  </button>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <CheckCircle className="text-blue-600 mt-1" size={16} />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">
                        Sistema de Automatización Activo
                      </h4>
                      <p className="text-sm text-blue-800 mt-1">
                        Los cobros se generan automáticamente el 1° de cada mes para todos los socios activos 
                        con membresías de auto-renovación habilitadas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {currentView === 'payments' && (
        <PaginatedPendingPayments
          year={parseInt(currentMonth.split('-')[0])}
          month={parseInt(currentMonth.split('-')[1])}
          onPaymentRegistered={() => loadMonthlyData()}
        />
      )}

      {currentView === 'controls' && (
        <OptimizedMemberControls />
      )}
    </div>
  );
};

export default MonthlyPaymentsDashboard;