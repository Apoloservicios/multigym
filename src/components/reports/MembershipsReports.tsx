// src/components/reports/MembershipsReports.tsx
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, Download, FilterX, CreditCard, Dumbbell,
  AlertCircle, TrendingUp, DollarSign, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import useAuth from '../../hooks/useAuth';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatCurrency } from '../../utils/formatting.utils';

const MembershipsReports: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estado para las fechas del reporte
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Tres meses atrás por defecto
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Estado para los datos del reporte
  const [membershipsData, setMembershipsData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Datos procesados para gráficos
  const [activitiesData, setActivitiesData] = useState<any[]>([]);
  const [incomeByActivity, setIncomeByActivity] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  
  // Estadísticas
  const [totalMemberships, setTotalMemberships] = useState<number>(0);
  const [activeMemberships, setActiveMemberships] = useState<number>(0);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [avgDuration, setAvgDuration] = useState<number>(0);
  
  // Colores para los gráficos
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  
  // Cargar datos
  useEffect(() => {
    loadMembershipsData();
  }, [gymData?.id, startDate, endDate]);
  
  // Función para cargar datos de membresías
  const loadMembershipsData = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Convertir fechas para la consulta
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      // Vamos a recorrer todos los socios y sus membresías
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      let allMemberships: any[] = [];
      
      // Para cada socio, obtener sus membresías
      const memberPromises = membersSnapshot.docs.map(async (memberDoc) => {
        const memberId = memberDoc.id;
        const memberName = `${memberDoc.data().firstName} ${memberDoc.data().lastName}`;
        
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        membershipsSnapshot.docs.forEach(doc => {
          const membershipData = doc.data();
          
          // Solo incluir membresías creadas en el periodo
          if (membershipData.createdAt) {
            const createdDate = membershipData.createdAt.toDate 
              ? membershipData.createdAt.toDate() 
              : new Date(membershipData.createdAt);
              
            if (createdDate >= start && createdDate <= end) {
              allMemberships.push({
                id: doc.id,
                memberId,
                memberName,
                ...membershipData
              });
            }
          }
        });
      });
      
      await Promise.all(memberPromises);
      
      setMembershipsData(allMemberships);
      
      // Procesar datos para gráficos y estadísticas
      processMembershipsData(allMemberships);
    } catch (err: any) {
      console.error('Error loading memberships data:', err);
      setError(err.message || 'Error al cargar los datos de membresías');
    } finally {
      setLoading(false);
    }
  };
  
  // Procesar datos para gráficos y estadísticas
  const processMembershipsData = (memberships: any[]) => {
    // Estadísticas básicas
    const total = memberships.length;
    const active = memberships.filter(m => m.status === 'active').length;
    const income = memberships.reduce((sum, m) => sum + (m.cost || 0), 0);
    const avgDur = memberships.length > 0
      ? Math.round(memberships.reduce((sum, m) => sum + (m.duration || 0), 0) / memberships.length)
      : 0;
    
    setTotalMemberships(total);
    setActiveMemberships(active);
    setTotalIncome(income);
    setAvgDuration(avgDur);
    
    // Agrupar por actividad
    const byActivity: Record<string, any> = {};
    
    memberships.forEach(m => {
      const activity = m.activityName || 'Sin especificar';
      
      if (!byActivity[activity]) {
        byActivity[activity] = {
          count: 0,
          income: 0,
          active: 0
        };
      }
      
      byActivity[activity].count += 1;
      byActivity[activity].income += (m.cost || 0);
      
      if (m.status === 'active') {
        byActivity[activity].active += 1;
      }
    });
    
    // Datos para gráfico de actividades
    const activityGraphData = Object.entries(byActivity).map(([activity, data]) => ({
      name: activity,
      value: data.count
    }));
    
    setActivitiesData(activityGraphData);
    
    // Datos para gráfico de ingresos por actividad
    const incomeGraphData = Object.entries(byActivity).map(([activity, data]) => ({
      name: activity,
      value: data.income
    })).sort((a, b) => b.value - a.value);
    
    setIncomeByActivity(incomeGraphData);
    
    // Agrupar por mes
    const byMonth: Record<string, any> = {};
    
    // Inicializar los últimos 12 meses
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = {
        count: 0,
        income: 0
      };
    }
    
    // Contar por mes
    memberships.forEach(m => {
      if (!m.createdAt) return;
      
      const createdDate = m.createdAt.toDate 
        ? m.createdAt.toDate() 
        : new Date(m.createdAt);
      
      const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          count: 0,
          income: 0
        };
      }
      
      byMonth[monthKey].count += 1;
      byMonth[monthKey].income += (m.cost || 0);
    });
    
    const monthsData = Object.entries(byMonth).map(([month, data]) => {
      const [year, monthNum] = month.split('-');
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
      return {
        month: `${monthName} ${year}`,
        count: data.count,
        income: data.income
      };
    });
    
    setMonthlyData(monthsData);
  };
  
  // Exportar a CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      // Crear contenido CSV
      let csvContent = 'ID,Socio,Actividad,Costo,Fecha de Inicio,Fecha de Fin,Estado,Estado de Pago,Asistencias\n';
      
      membershipsData.forEach(m => {
        const memberName = m.memberName ? m.memberName.replace(/,/g, ' ') : '';
        const activityName = m.activityName ? m.activityName.replace(/,/g, ' ') : '';
        
        csvContent += `${m.id},${memberName},${activityName},${m.cost || 0},${m.startDate || ''},${m.endDate || ''},${m.status || ''},${m.paymentStatus || ''},${m.currentAttendances || 0}/${m.maxAttendances || 0}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `membresias_${startDate}_${endDate}.csv`);
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
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Informe de Membresías</h2>
      
      {/* Filtros de fecha */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h3 className="text-lg font-semibold mb-4 md:mb-0">Período del Informe</h3>
          
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
              onClick={loadMembershipsData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Search size={18} className="mr-2" />
              Generar Informe
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={isExporting || membershipsData.length === 0}
              className={`px-4 py-2 rounded-md flex items-center ${
                isExporting || membershipsData.length === 0
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
              const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
              setStartDate(threeMonthsAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Últimos 3 meses
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
          
          <button
            onClick={() => {
              const today = new Date();
              const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
              setStartDate(lastYear.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Último año
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Generando informe...</span>
        </div>
      ) : membershipsData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FilterX size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay datos para mostrar</h3>
          <p className="text-gray-500">
            No se encontraron membresías en el período seleccionado
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total de Membresías</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{totalMemberships}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  {activeMemberships} activas ({Math.round((activeMemberships / totalMemberships) * 100)}%)
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Ingresos Totales</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  Promedio: {formatCurrency(totalMemberships > 0 ? totalIncome / totalMemberships : 0)}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Duración Promedio</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{avgDuration} días</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  {Math.round(avgDuration / 30)} mes(es) aprox.
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Actividades</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">
                    {activitiesData.length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Dumbbell className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  Más popular: {activitiesData.length > 0 ? activitiesData.sort((a, b) => b.value - a.value)[0].name : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Membresías por Actividad</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activitiesData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {activitiesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} membresías`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Ingresos por Actividad</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={incomeByActivity}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Ingresos']} />
                    <Bar dataKey="value" fill="#10B981">
                      {incomeByActivity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Gráfico de evolución mensual */}
<div className="bg-white rounded-lg shadow-md p-6 mb-6">
  <h3 className="text-lg font-semibold mb-4">Evolución Mensual</h3>
  <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={monthlyData}
        margin={{ top: 5, right: 30, left: 20, bottom: 45 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month" 
          tick={{ 
            // @ts-ignore
            angle: -45
          }} 
          textAnchor="end" 
          height={50} 
        />
        <YAxis />
        <Tooltip 
          formatter={(value: any, name: any) => {
            if (name === "count") return [`${value} membresías`, "Cantidad"];
            if (name === "income") return [formatCurrency(Number(value)), "Ingresos"];
            return [value, name];
          }}
        />
        <Legend />
        <Bar dataKey="count" name="Membresías" fill="#4F46E5" />
        <Bar dataKey="income" name="Ingresos" fill="#10B981" />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>
          
          {/* Tabla de membresías */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Últimas Membresías</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periodo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {membershipsData.slice(0, 10).map((membership, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{membership.memberName || 'Sin nombre'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {membership.activityName || 'Sin actividad'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        {formatCurrency(membership.cost || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div>Inicio: {membership.startDate || 'N/A'}</div>
                          <div>Fin: {membership.endDate || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          membership.status === 'active' ? 'bg-green-100 text-green-800' : 
                          membership.status === 'expired' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {membership.status === 'active' ? 'Activa' : 
                          membership.status === 'expired' ? 'Vencida' : 
                          membership.status === 'cancelled' ? 'Cancelada' : 'Desconocido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          membership.paymentStatus === 'paid' ? 'bg-blue-100 text-blue-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {membership.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {membershipsData.length > 10 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Mostrando 10 de {membershipsData.length} membresías. Exporta a CSV para ver todos los datos.
                </div>
              )}
              
              {membershipsData.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-md">
                  <p className="text-gray-500">No hay membresías en el período seleccionado</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MembershipsReports;