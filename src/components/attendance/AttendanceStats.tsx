// src/components/attendance/AttendanceStats.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Users, TrendingUp, Activity } from 'lucide-react';
import { attendanceService, AttendanceStats } from '../../services/attendance.service';
import useAuth from '../../hooks/useAuth';

interface AttendanceStatsProps {
  refreshTrigger?: number;
}

const AttendanceStatsComponent: React.FC<AttendanceStatsProps> = ({ refreshTrigger }) => {
  const { gymData } = useAuth();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [gymData?.id, refreshTrigger]);

  const loadStats = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      const attendanceStats = await attendanceService.getAttendanceStats(gymData.id);
      setStats(attendanceStats);

      // Preparar datos para el gráfico de los últimos 7 días
      const chartData = await prepareChartData();
      setChartData(chartData);
    } catch (error) {
      console.error('Error loading attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = async () => {
    if (!gymData?.id) return [];

    try {
      const data = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayAttendances = await attendanceService.getAttendanceByDateRange(
          gymData.id,
          date,
          nextDay
        );

        data.push({
          date: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          asistencias: dayAttendances.length,
          socios: new Set(dayAttendances.map(a => a.memberId)).size
        });
      }

      return data;
    } catch (error) {
      console.error('Error preparing chart data:', error);
      return [];
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Activity size={48} className="mx-auto mb-2 opacity-50" />
          <p>No hay datos de asistencia disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <TrendingUp size={20} className="mr-2 text-blue-600" />
        Estadísticas de Asistencia
      </h3>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalToday}</div>
          <div className="text-xs text-blue-700">Hoy</div>
        </div>
        
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.totalThisWeek}</div>
          <div className="text-xs text-green-700">Esta Semana</div>
        </div>
        
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{stats.uniqueMembersToday}</div>
          <div className="text-xs text-purple-700">Socios Únicos Hoy</div>
        </div>
        
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{stats.uniqueMembersThisWeek}</div>
          <div className="text-xs text-orange-700">Socios Únicos Semana</div>
        </div>
      </div>

      {/* Gráfico de los últimos 7 días */}
      {chartData.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Últimos 7 Días</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="asistencias" 
                  fill="#3b82f6" 
                  name="Asistencias"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="socios" 
                  fill="#10b981" 
                  name="Socios Únicos"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Asistencias recientes */}
      {stats.recentAttendances.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Users size={16} className="mr-2" />
            Asistencias Recientes
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {stats.recentAttendances.slice(0, 5).map((attendance) => (
              <div
                key={attendance.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                  <span className="font-medium text-gray-900 truncate">
                    {attendance.memberName}
                  </span>
                </div>
                <span className="text-gray-500 text-xs flex-shrink-0 ml-2">
                  {attendance.timestamp?.toDate ? 
                    attendance.timestamp.toDate().toLocaleTimeString('es-AR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 
                    'Hora no disponible'
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceStatsComponent;