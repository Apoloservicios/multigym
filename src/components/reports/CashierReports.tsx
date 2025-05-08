// src/components/reports/CashierReports.tsx
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, Download, FilterX, TrendingUp, TrendingDown, 
  DollarSign, BarChart2, AlertCircle, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  getDailyCashForDateRange, 
  getTransactionsSummary 
} from '../../services/dailyCash.service';
import useAuth from '../../hooks/useAuth';
import { DailyCash } from '../../types/gym.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const CashierReports: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estado para las fechas del reporte
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1); // Un mes atrás por defecto
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Estado para los datos del reporte
  const [dailyCashData, setDailyCashData] = useState<DailyCash[]>([]);
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    membershipIncome: number;
    otherIncome: number;
    transactionsByType: Record<string, number>;
    transactionsByCategory: Record<string, number>;
  } | null>(null);
  
  // Estado para control de la UI
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Cargar datos del reporte
  useEffect(() => {
    loadReportData();
  }, [gymData?.id, startDate, endDate]);

  // Función para cargar datos del reporte
  const loadReportData = async () => {
    if (!gymData?.id) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Obtener registros de caja para el rango de fechas
      const cashData = await getDailyCashForDateRange(gymData.id, startDate, endDate);
      setDailyCashData(cashData);
      
      // Obtener resumen de transacciones
      const summaryData = await getTransactionsSummary(gymData.id, startDate, endDate);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Error loading report data:', err);
      setError(err.message || 'Error al cargar los datos del reporte');
    } finally {
      setLoading(false);
    }
  };

  // Preparar datos para el gráfico de líneas
  const prepareLineChartData = () => {
    return dailyCashData.map(item => ({
      date: new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      ingresos: item.totalIncome || 0,
      egresos: item.totalExpense || 0,
      balance: (item.totalIncome || 0) - (item.totalExpense || 0)
    }));
  };

  // Preparar datos para el gráfico de barras de categorías
  const prepareCategoryChartData = () => {
    if (!summary) return [];
    
    return Object.entries(summary.transactionsByCategory).map(([category, amount]) => ({
      name: getCategoryName(category),
      value: amount
    }));
  };

  // Obtener nombre de categoría
  const getCategoryName = (category: string = ''): string => {
    switch (category.toLowerCase()) {
      case 'membership': return 'Membresías';
      case 'extra': return 'Ingresos Extras';
      case 'product': return 'Productos';
      case 'service': return 'Servicios';
      case 'withdrawal': return 'Retiros';
      case 'supplier': return 'Proveedores';
      case 'maintenance': return 'Mantenimiento';
      case 'salary': return 'Sueldos';
      case 'other': return 'Otros';
      default: return category;
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      // Crear contenido CSV
      let csvContent = 'Fecha,Ingresos,Egresos,Balance,Membresías,Otros Ingresos\n';
      
      dailyCashData.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('es-AR');
        const income = item.totalIncome || 0;
        const expense = item.totalExpense || 0;
        const balance = income - expense;
        const membershipIncome = item.membershipIncome || 0;
        const otherIncome = item.otherIncome || 0;
        
        csvContent += `${date},${income},${expense},${balance},${membershipIncome},${otherIncome}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_caja_${startDate}_${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Calcular tendencias
  const calculateTrend = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Reporte de Caja</h1>
      
      {/* Filtros de fecha */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h2 className="text-lg font-semibold mb-4 md:mb-0">Filtros del Reporte</h2>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span>a</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={loadReportData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Search size={18} className="mr-2" />
              Generar Reporte
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={isExporting || dailyCashData.length === 0}
              className={`px-4 py-2 rounded-md flex items-center ${
                isExporting || dailyCashData.length === 0
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Download size={18} className="mr-2" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        {/* Selector de fecha rápido */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date();
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() - today.getDay());
              setStartDate(startOfWeek.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Esta semana
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              setStartDate(startOfMonth.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Este mes
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
              setStartDate(startOfLastMonth.toISOString().split('T')[0]);
              setEndDate(endOfLastMonth.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Mes anterior
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const startOfYear = new Date(today.getFullYear(), 0, 1);
              setStartDate(startOfYear.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Este año
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Generando reporte...</span>
        </div>
      ) : dailyCashData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FilterX size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay datos para mostrar</h3>
          <p className="text-gray-500">
            {startDate && endDate ? 
              `No se encontraron registros de caja para el período seleccionado` : 
              'Selecciona un rango de fechas para generar el reporte'}
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalIncome)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center">
                  <ArrowUpRight size={16} className="text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">
                    {(summary.membershipIncome / summary.totalIncome * 100).toFixed(1)}% 
                  </span>
                  <span className="text-sm text-gray-500 ml-1">de membresías</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Egresos Totales</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.totalExpense)}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center">
                  <ArrowDownRight size={16} className="text-red-500 mr-1" />
                  <span className="text-sm text-gray-500">
                    Mayor categoría: {Object.entries(summary.transactionsByCategory)
                      .filter(([category]) => category !== 'membership' && category !== 'extra')
                      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Balance Neto</p>
                    <p className={`text-2xl font-bold mt-1 ${
                      summary.totalIncome - summary.totalExpense >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(summary.totalIncome - summary.totalExpense)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center">
                  {summary.totalIncome - summary.totalExpense >= 0 ? (
                    <ArrowUpRight size={16} className="text-green-500 mr-1" />
                  ) : (
                    <ArrowDownRight size={16} className="text-red-500 mr-1" />
                  )}
                  <span className="text-sm text-gray-500">
                    {dailyCashData.length} días analizados
                  </span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Membresías</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(summary.membershipIncome)}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <BarChart2 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center">
                  <ArrowUpRight size={16} className="text-green-500 mr-1" />
                  <span className="text-sm text-gray-500">
                    {(summary.membershipIncome / summary.totalIncome * 100).toFixed(1)}% del total
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Gráfico de evolución de ingresos/egresos */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-6">Evolución de Ingresos y Egresos</h2>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareLineChartData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value as number), '']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="ingresos" 
                    name="Ingresos" 
                    stroke="#10B981" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="egresos" 
                    name="Egresos" 
                    stroke="#EF4444" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    name="Balance" 
                    stroke="#3B82F6" 
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Distribución por categoría */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-6">Distribución por Categoría</h2>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={prepareCategoryChartData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value as number), '']}
                      />
                      <Bar 
                        dataKey="value" 
                        name="Monto" 
                        fill="#8884d8" 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-6">Detalle por Categoría</h2>
                
                <div className="space-y-4">
                  {summary && Object.entries(summary.transactionsByCategory)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([category, amount]) => (
                      <div key={category} className="flex items-center">
                        <div className={`w-2 h-8 rounded mr-3 ${
                          category === 'membership' || category === 'extra' || category === 'product' || category === 'service'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{getCategoryName(category)}</span>
                            <span className={category === 'membership' || category === 'extra' || category === 'product' || category === 'service'
                              ? 'text-green-600 font-medium' 
                              : 'text-red-600 font-medium'
                            }>
                              {formatCurrency(amount as number)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className={`h-1.5 rounded-full ${
                                category === 'membership' || category === 'extra' || category === 'product' || category === 'service'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }`} 
                              style={{ 
                                width: `${Math.min((amount as number) / 
                                  (category === 'membership' || category === 'extra' || category === 'product' || category === 'service' 
                                    ? summary.totalIncome 
                                    : summary.totalExpense) * 100, 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Tabla de registros diarios */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-6">Registros Diarios</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Egresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Membresías</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Otros Ing.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyCashData.map((item) => {
                    const date = new Date(item.date);
                    const income = item.totalIncome || 0;
                    const expense = item.totalExpense || 0;
                    const balance = income - expense;
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {date.toLocaleDateString('es-AR')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {date.toLocaleDateString('es-AR', { weekday: 'long' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                          {formatCurrency(income)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-medium">
                          {formatCurrency(expense)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <span className={balance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-purple-600">
                          {formatCurrency(item.membershipIncome || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600">
                          {formatCurrency(item.otherIncome || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer con totales */}
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">Totales</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-bold">
                      {formatCurrency(dailyCashData.reduce((sum, item) => sum + (item.totalIncome || 0), 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-bold">
                      {formatCurrency(dailyCashData.reduce((sum, item) => sum + (item.totalExpense || 0), 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                      {formatCurrency(dailyCashData.reduce((sum, item) => sum + ((item.totalIncome || 0) - (item.totalExpense || 0)), 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-purple-600 font-bold">
                      {formatCurrency(dailyCashData.reduce((sum, item) => sum + (item.membershipIncome || 0), 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600 font-bold">
                      {formatCurrency(dailyCashData.reduce((sum, item) => sum + (item.otherIncome || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CashierReports;