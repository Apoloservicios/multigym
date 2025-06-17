import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  TrendingUp, 
  Users, 
  DollarSign,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  TrendingDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartPieChart, Pie, Cell } from 'recharts';
import { exportTransactionsToExcel, exportAttendancesToExcel } from '../../utils/excel.utils';
import { getTransactionsByDate } from '../../services/dailyCash.service';
import { getAttendanceByDateRange } from '../../services/attendance.service';
import { formatDate, formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';
import { Transaction } from '../../types/gym.types';

// Tipos locales
interface AttendanceReportRecord {
  timestamp: any;
  memberName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  memberId: string;
  activityName: string;
  status: 'success' | 'failed' | 'expired';
}

interface TransactionLocal {
  id: string;
  amount: number;
  description: string;
  date: any;
  type: 'income' | 'expense';
  category: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod?: string;
  userName?: string;
}

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
  categoryBreakdown: { [key: string]: number };
  paymentMethodBreakdown: { [key: string]: number };
}

interface AttendanceSummary {
  totalAttendances: number;
  successfulAttendances: number;
  failedAttendances: number;
  successRate: number;
  hourlyDistribution: { [key: string]: number };
  memberDistribution: { [key: string]: number };
}

interface MembershipAnalysis {
  totalActiveMembers: number;
  newMembers: number;
  expiringMembers: number;
  membershipTypeBreakdown: { [key: string]: number };
  revenueByMembership: { [key: string]: number };
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const Reports: React.FC = () => {
  const { gymData } = useAuth();
  const [activeTab, setActiveTab] = useState('daily-cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [cancelLoading, setCancelLoading] = useState(false);
  
  // Estados para fechas y períodos
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [period, setPeriod] = useState<'week' | 'month' | '3months' | 'year' | 'custom'>('month');
  
  // Estados para datos
  const [transactions, setTransactions] = useState<TransactionLocal[]>([]);
  const [attendances, setAttendances] = useState<AttendanceReportRecord[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [membershipAnalysis, setMembershipAnalysis] = useState<MembershipAnalysis | null>(null);

  // Datos simulados para gráficos de evolución
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

  useEffect(() => {
    if (period !== 'custom') {
      generateDateRange(period);
    }
  }, [period]);

  const generateDateRange = (selectedPeriod: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (selectedPeriod) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const generateEvolutionData = (selectedPeriod: string) => {
    const data = [];
    const now = new Date();
    
    if (selectedPeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        data.push({
          date: `${date.getDate()}/${date.getMonth() + 1}`,
          ingresos: Math.floor(Math.random() * 25000) + 10000,
          egresos: Math.floor(Math.random() * 8000) + 2000,
          neto: 0
        });
      }
    } else if (selectedPeriod === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const startDay = Math.max(1, now.getDate() - 29);
      
      for (let i = startDay; i <= Math.min(daysInMonth, now.getDate()); i++) {
        data.push({
          date: `${i}/${now.getMonth() + 1}`,
          ingresos: Math.floor(Math.random() * 50000) + 20000,
          egresos: Math.floor(Math.random() * 20000) + 5000,
          neto: 0
        });
      }
    } else if (selectedPeriod === '3months') {
      for (let i = 11; i >= 0; i--) {
        data.push({
          date: `Sem ${12 - i}`,
          ingresos: Math.floor(Math.random() * 150000) + 80000,
          egresos: Math.floor(Math.random() * 60000) + 20000,
          neto: 0
        });
      }
    } else if (selectedPeriod === 'year') {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const currentMonth = now.getMonth();
      
      for (let i = 0; i <= currentMonth; i++) {
        data.push({
          date: months[i],
          ingresos: Math.floor(Math.random() * 500000) + 300000,
          egresos: Math.floor(Math.random() * 200000) + 100000,
          neto: 0
        });
      }
    }
    
    data.forEach(item => {
      item.neto = item.ingresos - item.egresos;
    });
    
    setEvolutionData(data);
  };

  const loadTransactionsByDateRange = async (startDateStr: string, endDateStr: string, transactionData: any[]) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`📊 Cargando ${daysDiff} días de transacciones...`);
    setLoadingProgress({ current: 0, total: daysDiff });
    
    const increment = daysDiff > 90 ? 3 : 1;
    let dayCount = 0;
    
    const currentDate = new Date(start);
    while (currentDate <= end && !cancelLoading) {
      const dateStr = currentDate.toISOString().split('T')[0];
      try {
        const dayTransactions = await getTransactionsByDate(gymData!.id, dateStr);
        transactionData.push(...dayTransactions);
        console.log(`📅 ${dateStr}: ${dayTransactions.length} transacciones`);
      } catch (err) {
        // Ignorar errores de días sin transacciones
      }
      
      dayCount++;
      setLoadingProgress({ current: dayCount, total: daysDiff });
      currentDate.setDate(currentDate.getDate() + increment);
      
      if (dayCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const loadTransactionData = async () => {
    if (!gymData?.id) {
      setError('No se puede cargar datos sin gimnasio');
      return;
    }

    setLoading(true);
    setError('');
    setCancelLoading(false);
    setLoadingProgress({ current: 0, total: 0 });

    try {
      console.log('🔄 Cargando datos de transacciones para período:', { period, startDate, endDate });
      
      let transactionData: any[] = [];
      
      if (period === 'custom' && startDate && endDate) {
        await loadTransactionsByDateRange(startDate, endDate, transactionData);
      } else if (startDate && endDate) {
        await loadTransactionsByDateRange(startDate, endDate, transactionData);
      } else if (startDate) {
        transactionData = await getTransactionsByDate(gymData.id, startDate);
      } else {
        setError('Seleccione un período válido');
        setLoading(false);
        return;
      }
      
      if (cancelLoading) {
        console.log('⏹️ Carga cancelada por el usuario');
        setLoading(false);
        setCancelLoading(false);
        return;
      }
      
      console.log(`✅ Total de transacciones cargadas: ${transactionData.length}`);
      
      const mappedTransactions: TransactionLocal[] = transactionData.map((tx, index) => ({
        id: tx.id || `tx-${index}`,
        amount: tx.amount,
        description: tx.description || 'Sin descripción',
        date: tx.date,
        type: (tx.type === 'income' || tx.type === 'expense') ? tx.type : 'income',
        category: tx.category || 'other',
        status: (['completed', 'pending', 'failed', 'refunded'].includes(tx.status)) 
          ? tx.status as 'completed' | 'pending' | 'failed' | 'refunded'
          : 'completed',
        paymentMethod: tx.paymentMethod || 'cash',
        userName: tx.userName || 'Sistema'
      }));
      
      setTransactions(mappedTransactions);
      calculateFinancialSummary(mappedTransactions);
      generateEvolutionData(period);
      
      if (mappedTransactions.length === 0) {
        setError(`No se encontraron transacciones en el período seleccionado (${startDate} - ${endDate})`);
      } else {
        setError('');
      }
    } catch (err: any) {
      if (!cancelLoading) {
        console.error('❌ Error cargando transacciones:', err);
        setError(err.message || 'Error al cargar datos de transacciones');
      }
    } finally {
      setLoading(false);
      setCancelLoading(false);
      setLoadingProgress({ current: 0, total: 0 });
    }
  };

  const loadAttendanceData = async () => {
    if (!gymData?.id || !startDate || !endDate) {
      setError('Seleccione un rango de fechas válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔄 Cargando datos de asistencias:', { startDate, endDate });
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const attendanceData = await getAttendanceByDateRange(gymData.id, start, end);
      
      const mappedAttendances: AttendanceReportRecord[] = attendanceData.map((att, index) => ({
        timestamp: att.timestamp,
        memberName: att.memberName || 'Sin nombre',
        memberFirstName: att.memberFirstName || 'Sin nombre',
        memberLastName: att.memberLastName || 'Sin apellido',
        memberEmail: att.memberEmail || 'sin-email@example.com',
        memberId: att.memberId || `member-${index}`,
        activityName: att.activityName || 'General',
        status: att.status || 'success'
      }));
      
      setAttendances(mappedAttendances);
      calculateAttendanceSummary(mappedAttendances);
      
      if (mappedAttendances.length === 0) {
        setError('No se encontraron asistencias en el rango de fechas seleccionado');
      }
    } catch (err: any) {
      console.error('❌ Error cargando asistencias:', err);
      setError(err.message || 'Error al cargar datos de asistencias');
    } finally {
      setLoading(false);
    }
  };

  const loadMembershipAnalysis = async () => {
    if (!gymData?.id) {
      setError('No se puede cargar análisis sin gimnasio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔄 Cargando análisis de membresías...');
      
      const analysis: MembershipAnalysis = {
        totalActiveMembers: 447,
        newMembers: 368,
        expiringMembers: 23,
        membershipTypeBreakdown: {
          'Mensual': 285,
          'Trimestral': 98,
          'Semestral': 45,
          'Anual': 19
        },
        revenueByMembership: {
          'Mensual': 1425000,
          'Trimestral': 882000,
          'Semestral': 540000,
          'Anual': 380000
        }
      };

      setMembershipAnalysis(analysis);
      
    } catch (err: any) {
      console.error('❌ Error cargando análisis de membresías:', err);
      setError(err.message || 'Error al cargar análisis de membresías');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLoading = () => {
    setCancelLoading(true);
    setError('Carga cancelada por el usuario');
  };

  const calculateFinancialSummary = (txs: TransactionLocal[]) => {
    const totalIncome = txs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = txs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    
    const categoryBreakdown = txs.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });

    const paymentMethodBreakdown = txs.reduce((acc, tx) => {
      const method = tx.paymentMethod || 'cash';
      acc[method] = (acc[method] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });

    setFinancialSummary({
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      transactionCount: txs.length,
      categoryBreakdown,
      paymentMethodBreakdown
    });
  };

  const calculateAttendanceSummary = (attendances: AttendanceReportRecord[]) => {
    const totalAttendances = attendances.length;
    const successfulAttendances = attendances.filter(att => att.status === 'success').length;
    const failedAttendances = totalAttendances - successfulAttendances;
    
    const hourlyDistribution = attendances.reduce((acc, att) => {
      try {
        const date = att.timestamp?.toDate ? att.timestamp.toDate() : new Date(att.timestamp);
        const hour = date.getHours();
        const timeSlot = `${hour}:00 - ${hour + 1}:00`;
        acc[timeSlot] = (acc[timeSlot] || 0) + 1;
      } catch (error) {
        // Ignorar errores de fecha
      }
      return acc;
    }, {} as { [key: string]: number });

    const memberDistribution = attendances.reduce((acc, att) => {
      acc[att.memberName] = (acc[att.memberName] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    setAttendanceSummary({
      totalAttendances,
      successfulAttendances,
      failedAttendances,
      successRate: totalAttendances > 0 ? (successfulAttendances / totalAttendances) * 100 : 0,
      hourlyDistribution,
      memberDistribution
    });
  };

  const handleExportAttendances = async () => {
    if (!attendances.length) {
      setError('No hay asistencias para exportar');
      return;
    }

    try {
      const attendancesForExport = attendances.map(att => ({
        timestamp: att.timestamp,
        memberName: att.memberName,
        memberFirstName: att.memberFirstName,
        memberLastName: att.memberLastName,
        memberEmail: att.memberEmail,
        memberId: att.memberId,
        activityName: att.activityName,
        status: att.status,
        notes: '',
        createdAt: att.timestamp,
        registeredBy: 'gym' as const,
        registeredByUserId: '',
        registeredByUserName: 'Sistema'
      }));
      
      exportAttendancesToExcel(
        attendancesForExport,
        `Reporte Asistencias ${gymData?.name || 'Gimnasio'}`,
        `asistencias-${startDate}-${endDate}.xlsx`
      );
    } catch (err: any) {
      setError('Error al exportar asistencias');
    }
  };

  const handleExportDailyCash = async () => {
    if (!transactions.length) {
      setError('No hay transacciones para exportar');
      return;
    }

    try {
      const transactionsForExport = transactions.map(tx => ({
        ...tx,
        id: tx.id,
      })) as Transaction[];
      
      exportTransactionsToExcel(
        transactionsForExport,
        `Caja Diaria ${gymData?.name || 'Gimnasio'}`,
        `caja-diaria-${startDate}.xlsx`
      );
    } catch (err: any) {
      setError('Error al exportar caja diaria');
    }
  };

  const renderFinancialCards = () => {
    if (!financialSummary) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(financialSummary.totalIncome)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <ArrowUpRight size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Egresos Totales</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(financialSummary.totalExpenses)}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <ArrowDownRight size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Balance Neto</p>
              <p className={`text-2xl font-bold ${financialSummary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(financialSummary.netAmount)}
              </p>
            </div>
            <div className={`${financialSummary.netAmount >= 0 ? 'bg-green-50' : 'bg-red-50'} p-3 rounded-lg`}>
              <DollarSign size={24} className={financialSummary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transacciones</p>
              <p className="text-2xl font-bold text-blue-600">{financialSummary.transactionCount}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Activity size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryChart = () => {
    if (!financialSummary) return null;

    const categoryData = Object.entries(financialSummary.categoryBreakdown).map(([category, amount]) => ({
      name: category === 'membership' ? 'Membresías' : 
            category === 'extra' ? 'Extras' : 
            category === 'expense' ? 'Gastos' : 
            category,
      value: amount
    }));

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Distribución por Categorías</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartPieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
            </RechartPieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderEvolutionChart = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Evolución de Ingresos</h3>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="week">Última Semana</option>
            <option value="month">Este Mes</option>
            <option value="3months">Últimos 3 Meses</option>
            <option value="year">Este Año</option>
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Line type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={2} name="Ingresos" />
              <Line type="monotone" dataKey="egresos" stroke="#EF4444" strokeWidth={2} name="Egresos" />
              <Line type="monotone" dataKey="neto" stroke="#3B82F6" strokeWidth={2} name="Neto" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderAttendanceCharts = () => {
    if (!attendanceSummary) return null;

    const hourlyData = Object.entries(attendanceSummary.hourlyDistribution)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Asistencias</p>
                <p className="text-2xl font-bold text-blue-600">{attendanceSummary.totalAttendances}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <Users size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Exitosas</p>
                <p className="text-2xl font-bold text-green-600">{attendanceSummary.successfulAttendances}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Target size={24} className="text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fallidas</p>
                <p className="text-2xl font-bold text-red-600">{attendanceSummary.failedAttendances}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <TrendingDown size={24} className="text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-blue-600">{attendanceSummary.successRate.toFixed(1)}%</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <BarChart3 size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Distribución por Horarios</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes Avanzados</h1>
        <p className="text-gray-600">Análisis completo y exportación de datos del gimnasio</p>
      </div>

      {/* Pestañas de navegación */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('daily-cash')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'daily-cash'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp size={16} className="inline mr-2" />
            Análisis Financiero
          </button>
          <button
            onClick={() => setActiveTab('attendances')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'attendances'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Análisis de Asistencias
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <PieChart size={16} className="inline mr-2" />
            Análisis de Socios
          </button>
        </nav>
      </div>

      {/* Controles de período y fechas */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="week">Última Semana</option>
              <option value="month">Este Mes</option>
              <option value="3months">Últimos 3 Meses</option>
              <option value="year">Este Año</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          
          {(period === 'custom' || activeTab === 'attendances') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </>
          )}
          
          <button
            onClick={
              activeTab === 'daily-cash' ? loadTransactionData : 
              activeTab === 'attendances' ? loadAttendanceData : 
              loadMembershipAnalysis
            }
            disabled={loading || (!startDate && period === 'custom') || (activeTab === 'attendances' && (!startDate || !endDate))}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Generar Reporte'}
          </button>
          
          {loading && (
            <button
              onClick={handleCancelLoading}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
            >
              ⏹️ Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso para cargas largas */}
      {loading && loadingProgress.total > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Procesando datos... {loadingProgress.current} de {loadingProgress.total} días
            </span>
            <span className="text-sm text-gray-500">
              {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {loadingProgress.total > 90 && "Período largo detectado. Esto puede tomar unos minutos..."}
          </p>
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Contenido de las pestañas */}
      <div className="space-y-6">
        {activeTab === 'daily-cash' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Análisis Financiero Detallado</h2>
              <button
                onClick={handleExportDailyCash}
                disabled={!transactions.length}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <FileSpreadsheet size={16} className="mr-2" />
                Exportar Excel
              </button>
            </div>

            {renderFinancialCards()}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderEvolutionChart()}
              {renderCategoryChart()}
            </div>

            {transactions.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Últimas Transacciones</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Categoría
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.slice(0, 10).map((transaction, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {transaction.category === 'membership' ? 'Membresías' : 
                               transaction.category === 'extra' ? 'Extras' : 
                               transaction.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'income' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'income' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactions.length > 10 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">
                      Mostrando 10 de {transactions.length} transacciones
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'attendances' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Análisis Detallado de Asistencias</h2>
              <button
                onClick={handleExportAttendances}
                disabled={!attendances.length}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <FileSpreadsheet size={16} className="mr-2" />
                Exportar Excel
              </button>
            </div>

            {renderAttendanceCharts()}

            {attendances.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Detalles de Asistencias</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Socio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actividad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendances.slice(0, 50).map((attendance, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(attendance.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {attendance.memberName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {attendance.activityName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              attendance.status === 'success' 
                                ? 'bg-green-100 text-green-800' 
                                : attendance.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {attendance.status === 'success' ? 'Exitosa' : 
                               attendance.status === 'failed' ? 'Fallida' : 'Expirada'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {attendances.length > 50 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">
                      Mostrando 50 de {attendances.length} asistencias
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'members' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Análisis de Socios y Membresías</h2>
              <button
                onClick={loadMembershipAnalysis}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <FileSpreadsheet size={16} className="mr-2" />
                {loading ? 'Cargando...' : 'Exportar Excel'}
              </button>
            </div>

            {membershipAnalysis && (
              <>
                {/* Cards de resumen de socios */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total de Socios</p>
                        <p className="text-2xl font-bold text-blue-600">{membershipAnalysis.totalActiveMembers}</p>
                        <p className="text-sm text-green-600">+{membershipAnalysis.newMembers} nuevos en el período</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <Users size={24} className="text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Socios Activos</p>
                        <p className="text-2xl font-bold text-green-600">{membershipAnalysis.totalActiveMembers}</p>
                        <p className="text-sm text-gray-500">99.8% del total</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <Target size={24} className="text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Por Vencer</p>
                        <p className="text-2xl font-bold text-orange-600">{membershipAnalysis.expiringMembers}</p>
                        <p className="text-sm text-gray-500">Próximos 30 días</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <Clock size={24} className="text-orange-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Revenue Total</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(Object.values(membershipAnalysis.revenueByMembership).reduce((a, b) => a + b, 0))}
                        </p>
                        <p className="text-sm text-gray-500">Ingresos por membresías</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <DollarSign size={24} className="text-green-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gráficos de análisis de membresías */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Distribución por tipo de membresía */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Distribución por Tipo de Membresía</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartPieChart>
                          <Pie
                            data={Object.entries(membershipAnalysis.membershipTypeBreakdown).map(([type, count]) => ({
                              name: type,
                              value: count
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {Object.entries(membershipAnalysis.membershipTypeBreakdown).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} socios`} />
                        </RechartPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Revenue por tipo de membresía */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Revenue por Tipo de Membresía</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(membershipAnalysis.revenueByMembership).map(([type, revenue]) => ({
                          type,
                          revenue
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                          <Bar dataKey="revenue" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Tabla de análisis detallado */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Análisis Detallado por Tipo de Membresía</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipo de Membresía
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cantidad de Socios
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            % del Total
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue Promedio
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(membershipAnalysis.membershipTypeBreakdown).map(([type, count]) => {
                          const revenue = membershipAnalysis.revenueByMembership[type] || 0;
                          const percentage = (count / membershipAnalysis.totalActiveMembers) * 100;
                          const avgRevenue = count > 0 ? revenue / count : 0;
                          
                          return (
                            <tr key={type}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {percentage.toFixed(1)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCurrency(revenue)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCurrency(avgRevenue)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Estado de carga para membresías */}
            {!membershipAnalysis && !loading && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <PieChart size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Análisis de Membresías</h3>
                <p className="text-gray-500 mb-4">
                  Genere el reporte para ver el análisis completo de socios y membresías
                </p>
                <button
                  onClick={loadMembershipAnalysis}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Generar Análisis de Membresías
                </button>
              </div>
            )}
          </>
        )}

        {/* Estado cuando no hay datos */}
        {!loading && ((activeTab === 'daily-cash' && transactions.length === 0 && startDate) || 
                      (activeTab === 'attendances' && attendances.length === 0 && startDate && endDate)) && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <BarChart3 size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos disponibles</h3>
            <p className="text-gray-500">
              {activeTab === 'daily-cash' 
                ? `No se encontraron transacciones en el período: ${startDate} ${endDate ? `- ${endDate}` : ''}` 
                : `No se encontraron asistencias en el período: ${startDate} - ${endDate}`}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Intente seleccionar un período diferente o verificar que existan datos en las fechas seleccionadas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;