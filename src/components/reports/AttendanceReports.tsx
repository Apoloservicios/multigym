// src/components/reports/AttendanceReports.tsx
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, Download, FilterX, BarChart2, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useAuth from '../../hooks/useAuth';
import { Attendance } from '../../types/gym.types';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AttendanceReports: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estado para las fechas del reporte
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1); // Un mes atrás por defecto
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Estado para los datos del reporte
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Datos procesados para gráficos
  const [dailyAttendance, setDailyAttendance] = useState<any[]>([]);
  const [activityAttendance, setActivityAttendance] = useState<any[]>([]);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [totalAttendances, setTotalAttendances] = useState<number>(0);
  
  // Cargar datos
  useEffect(() => {
    loadAttendanceData();
  }, [gymData?.id, startDate, endDate]);
  
  // Función para cargar datos de asistencias
  const loadAttendanceData = async () => {
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
      
      // Consultar colección de asistencias
      const attendancesRef = collection(db, `gyms/${gymData.id}/attendances`);
      const q = query(
        attendancesRef,
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const attendances: Attendance[] = [];
      
      querySnapshot.forEach(doc => {
        attendances.push({
          id: doc.id,
          ...doc.data()
        } as Attendance);
      });
      
      setAttendanceData(attendances);
      
      // Procesar datos para gráficos
      processAttendanceData(attendances);
    } catch (err: any) {
      console.error('Error loading attendance data:', err);
      setError(err.message || 'Error al cargar los datos de asistencias');
    } finally {
      setLoading(false);
    }
  };
  
  // Procesar datos para gráficos
  const processAttendanceData = (attendances: Attendance[]) => {
    // Calcular total y tasa de éxito
    const total = attendances.length;
    const successful = attendances.filter(a => a.status === 'success').length;
    const successRateValue = total > 0 ? (successful / total) * 100 : 0;
    
    setTotalAttendances(total);
    setSuccessRate(parseFloat(successRateValue.toFixed(2)));
    
    // Agrupar por fecha
    const byDate: Record<string, number> = {};
    attendances.forEach(att => {
      const date = att.timestamp.toDate ? 
        att.timestamp.toDate().toISOString().split('T')[0] : 
        new Date(att.timestamp).toISOString().split('T')[0];
      
      byDate[date] = (byDate[date] || 0) + 1;
    });
    
    const dailyData = Object.entries(byDate).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      count
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    setDailyAttendance(dailyData);
    
    // Agrupar por actividad
    const byActivity: Record<string, number> = {};
    attendances.forEach(att => {
      const activity = att.activityName || 'Sin especificar';
      byActivity[activity] = (byActivity[activity] || 0) + 1;
    });
    
    const activityData = Object.entries(byActivity)
      .map(([activity, count]) => ({ activity, count }))
      .sort((a, b) => b.count - a.count);
    
    setActivityAttendance(activityData);
  };
  
  // Exportar a CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      // Crear contenido CSV
      let csvContent = 'Fecha,Hora,Socio,ID Socio,Actividad,Estado,Error\n';
      
      attendanceData.forEach(att => {
        const date = att.timestamp.toDate ? 
          att.timestamp.toDate().toLocaleDateString('es-AR') : 
          new Date(att.timestamp).toLocaleDateString('es-AR');
        
        const time = att.timestamp.toDate ? 
          att.timestamp.toDate().toLocaleTimeString('es-AR') : 
          new Date(att.timestamp).toLocaleTimeString('es-AR');
        
        const memberName = att.memberName.replace(/,/g, ' ');
        const activity = att.activityName.replace(/,/g, ' ');
        const error = att.error ? att.error.replace(/,/g, ' ') : '';
        
        csvContent += `${date},${time},${memberName},${att.memberId},${activity},${att.status},${error}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `asistencias_${startDate}_${endDate}.csv`);
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
      <h2 className="text-xl font-semibold mb-6">Informe de Asistencias</h2>
      
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
              onClick={loadAttendanceData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Search size={18} className="mr-2" />
              Generar Informe
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={isExporting || attendanceData.length === 0}
              className={`px-4 py-2 rounded-md flex items-center ${
                isExporting || attendanceData.length === 0
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
          <span className="ml-3 text-gray-500">Generando informe...</span>
        </div>
      ) : attendanceData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FilterX size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay datos para mostrar</h3>
          <p className="text-gray-500">
            {startDate && endDate ? 
              `No se encontraron asistencias para el período seleccionado` : 
              'Selecciona un rango de fechas para generar el informe'}
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total de Asistencias</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{totalAttendances}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Período: {new Date(startDate).toLocaleDateString('es-AR')} al {new Date(endDate).toLocaleDateString('es-AR')}
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Tasa de Éxito</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{successRate}%</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Asistencias exitosas: {attendanceData.filter(a => a.status === 'success').length}
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Promedio Diario</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {dailyAttendance.length > 0 
                      ? Math.round(totalAttendances / dailyAttendance.length) 
                      : 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                En {dailyAttendance.length} {dailyAttendance.length === 1 ? 'día' : 'días'} con actividad
              </p>
            </div>
          </div>
          
          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Asistencias por Día</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Asistencias" fill="#4F46E5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Asistencias por Actividad</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityAttendance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="activity" width={150} />
                    <Tooltip />
                    <Bar dataKey="count" name="Asistencias" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Tabla de asistencias */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Detalle de Asistencias</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.slice(0, 100).map((att) => (
                    <tr key={att.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {att.timestamp && att.timestamp.toDate 
                          ? att.timestamp.toDate().toLocaleString('es-AR')
                          : new Date(att.timestamp).toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{att.memberName}</div>
                        <div className="text-sm text-gray-500">{att.memberId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {att.activityName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          att.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {att.status === 'success' ? 'Exitosa' : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {attendanceData.length > 100 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Mostrando 100 de {attendanceData.length} asistencias. Exporta a CSV para ver todos los datos.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceReports;