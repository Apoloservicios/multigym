// src/pages/superadmin/Revenue.tsx
import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Calendar, RefreshCw, Download, CreditCard, Check, AlertCircle 
} from 'lucide-react';
import { getPayments, generateRevenueReport } from '../../services/superadmin.service';
import { Payment } from '../../types/superadmin.types';
import PaymentsTable from '../../components/superadmin/PaymentsTable';
import DateRangePicker from '../../components/common/DateRangePicker';
import { formatCurrency } from '../../utils/formatting.utils';
import superadminService from '../../services/superadmin.service';



const RevenueManager: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Primer día del mes actual
    end: new Date()
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportGenerating, setReportGenerating] = useState<boolean>(false);

  // Estadísticas
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [pendingPayments, setPendingPayments] = useState<number>(0);
  const [completedPayments, setCompletedPayments] = useState<number>(0);

  useEffect(() => {
    loadPayments();
  }, [dateRange]);

  // Aplicar filtros cuando cambian
  useEffect(() => {
    if (!payments.length) {
      setFilteredPayments([]);
      return;
    }

    let result = payments;

    // Filtrar por término de búsqueda
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        result = result.filter(payment =>
          payment.gymId.toLowerCase().includes(search) ||
          payment.gymName.toLowerCase().includes(search) ||
          (payment.description && payment.description.toLowerCase().includes(search)) ||
          (payment.reference && payment.reference.toLowerCase().includes(search))
        );
      }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      result = result.filter(payment => payment.status === statusFilter);
    }

    setFilteredPayments(result);

    // Calcular estadísticas
    calculateStats(result);
  }, [payments, searchTerm, statusFilter]);

  const loadPayments = async () => {
    if (!dateRange.start || !dateRange.end) return;
    
    setLoading(true);
    setError(null);

    try {
      const paymentsData = await superadminService.getPayments(dateRange.start, dateRange.end);
      setPayments(paymentsData);
      setFilteredPayments(paymentsData);
      
      // Calcular estadísticas
      calculateStats(paymentsData);
    } catch (err: any) {
      console.error('Error loading payments:', err);
      setError('Error al cargar los pagos. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData: Payment[]) => {
    let total = 0;
    let pending = 0;
    let completed = 0;

    paymentsData.forEach(payment => {
      if (payment.status === 'completed') {
        completed++;
        total += payment.amount;
      } else if (payment.status === 'pending') {
        pending++;
      }
    });

    setTotalRevenue(total);
    setPendingPayments(pending);
    setCompletedPayments(completed);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const handleDateRangeChange = (range: { start: Date | null; end: Date | null }) => {
    setDateRange(range);
    setIsDatePickerOpen(false);
  };

  const handleGenerateReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      setError('Por favor seleccione un rango de fechas válido para generar el reporte.');
      return;
    }

    setReportGenerating(true);
    setError(null);

    try {
      const reportUrl = await superadminService.generateRevenueReport(dateRange.start, dateRange.end);
      
      // Crear enlace para descargar
      const link = document.createElement('a');
      link.href = reportUrl;
      link.setAttribute('download', 'reporte-ingresos.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess('Reporte generado correctamente');
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError('Error al generar el reporte. Por favor, intente de nuevo.');
    } finally {
      setReportGenerating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Ingresos</h1>
          <p className="text-gray-600">Administra los pagos y genera reportes</p>
        </div>

        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 border rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={reportGenerating}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            <Download size={16} className="mr-2" />
            {reportGenerating ? 'Generando...' : 'Exportar Reporte'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex items-center">
          <Check size={20} className="mr-2" />
          {success}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Ingresos</p>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  {completedPayments} pagos completados
                </span>
              </p>
            </div>
            <div className="bg-green-100 rounded-full h-12 w-12 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pagos Pendientes</p>
              <p className="text-2xl font-bold">{pendingPayments}</p>
              <p className="text-sm mt-1">
                <span className="text-gray-500">
                  Requieren atención
                </span>
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full h-12 w-12 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 relative">
          <div className="flex justify-between">
            <div>
              <p className="text-gray-500 text-sm">Rango de Fechas</p>
              <p className="text-lg font-medium">
                {dateRange.start?.toLocaleDateString()} - {dateRange.end?.toLocaleDateString()}
              </p>
              <button 
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} 
                className="text-blue-600 text-sm mt-1 hover:underline"
              >
                Cambiar fechas
              </button>
            </div>
            <div className="bg-blue-100 rounded-full h-12 w-12 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          
          {isDatePickerOpen && (
            <div className="absolute z-10 mt-2 right-0 bg-white rounded-lg shadow-lg p-4">
              <DateRangePicker 
                startDate={dateRange.start}
                endDate={dateRange.end}
                onChange={handleDateRangeChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por gimnasio, descripción o referencia"
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center">
            <div className="mr-2">
              <Filter size={18} className="text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completados</option>
              <option value="pending">Pendientes</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de pagos */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <PaymentsTable payments={filteredPayments} />
      )}
    </div>
  );
};

export default RevenueManager;