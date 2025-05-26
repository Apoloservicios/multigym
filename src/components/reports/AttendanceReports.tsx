// src/components/reports/AttendanceReports.tsx - VERSIÓN CORREGIDA COMPLETA

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Calendar, 
  Users, 
  TrendingUp, 
  Filter, 
  RefreshCw,
  BarChart3,
  Clock,
  UserCheck,
  Activity
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { 
  toJavaScriptDate, 
  formatFirebaseTimestamp, 
  formatTime,
  formatDateTime 
} from '../../utils/formatting.utils';
import { Attendance } from '../../types/gym.types';

// Interfaces para el reporte
interface AttendanceStats {
  totalAttendances: number;
  uniqueMembers: number;
  averagePerDay: number;
  peakHour: number;
  mostActiveDay: string;
  successRate: number;
}

interface DayAttendance {
  date: string;
  count: number;
  members: string[];
}

interface HourlyDistribution {
  hour: number;
  count: number;
}

interface MemberStats {
  memberId: string;
  memberName: string;
  attendances: number;
  lastAttendance: Date;
}

const AttendanceReports: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estados
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [filteredAttendances, setFilteredAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [activities, setActivities] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  // Función helper para manejar timestamps de forma segura
  const safeFormatTimestamp = (timestamp: any, format: 'date' | 'datetime' | 'time' | 'iso' = 'datetime'): string => {
    const jsDate = toJavaScriptDate(timestamp);
    
    if (!jsDate) return format === 'iso' ? '' : 'Fecha no disponible';
    
    try {
      switch (format) {
        case 'date':
          return jsDate.toLocaleDateString('es-AR');
        case 'time':
          return jsDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        case 'iso':
          return jsDate.toISOString().split('T')[0];
        default:
          return jsDate.toLocaleString('es-AR');
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return format === 'iso' ? '' : 'Fecha inválida';
    }
  };

  // Obtener rango de fechas según el período seleccionado
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate: now };
  };

  // Cargar asistencias
  const loadAttendances = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      // Obtener todas las asistencias del período
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const allAttendances: Attendance[] = [];
      const activitiesSet = new Set<string>();
      const membersMap = new Map<string, string>();
      
      // Para cada miembro, obtener sus asistencias
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const memberName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
        membersMap.set(memberDoc.id, memberName);
        
        const attendancesRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/attendances`);
        const q = query(
          attendancesRef,
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate)),
          orderBy('timestamp', 'desc')
        );
        
        const attendancesSnapshot = await getDocs(q);
        
        attendancesSnapshot.forEach(doc => {
          const attendanceData = doc.data();
          
          allAttendances.push({
            id: doc.id,
            memberId: memberDoc.id,
            memberName: memberName,
            membershipId: attendanceData.membershipId || '',
            activityName: attendanceData.activityName || 'General',
            timestamp: attendanceData.timestamp,
            status: attendanceData.status || 'success',
            error: attendanceData.error,
            notes: attendanceData.notes,
            createdAt: attendanceData.createdAt || attendanceData.timestamp,
            updatedAt: attendanceData.updatedAt
          });
          
          if (attendanceData.activityName) {
            activitiesSet.add(attendanceData.activityName);
          }
        });
      }
      
      setAttendances(allAttendances);
      setActivities(Array.from(activitiesSet));
      setMembers(Array.from(membersMap.entries()).map(([id, name]) => ({ id, name })));
      
    } catch (error) {
      console.error('Error loading attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...attendances];
    
    if (selectedActivity !== 'all') {
      filtered = filtered.filter(att => att.activityName === selectedActivity);
    }
    
    if (selectedMember !== 'all') {
      filtered = filtered.filter(att => att.memberId === selectedMember);
    }
    
    setFilteredAttendances(filtered);
  }, [attendances, selectedActivity, selectedMember]);

  // Calcular estadísticas
  useEffect(() => {
    if (filteredAttendances.length === 0) {
      setStats(null);
      return;
    }
    
    const { startDate, endDate } = getDateRange();
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Agrupar por día
    const byDate: Record<string, number> = {};
    filteredAttendances.forEach(att => {
      const date = safeFormatTimestamp(att.timestamp, 'iso');
      if (date) {
        byDate[date] = (byDate[date] || 0) + 1;
      }
    });
    
    // Agrupar por hora
    const byHour: Record<number, number> = {};
    filteredAttendances.forEach(att => {
      const jsDate = toJavaScriptDate(att.timestamp);
      if (jsDate) {
        const hour = jsDate.getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
      }
    });
    
    // Agrupar por día de la semana
    const byDayOfWeek: Record<string, number> = {};
    filteredAttendances.forEach(att => {
      const jsDate = toJavaScriptDate(att.timestamp);
      if (jsDate) {
        const dayName = jsDate.toLocaleDateString('es-AR', { weekday: 'long' });
        byDayOfWeek[dayName] = (byDayOfWeek[dayName] || 0) + 1;
      }
    });
    
    // Calcular estadísticas
    const uniqueMembers = new Set(filteredAttendances.map(att => att.memberId)).size;
    const successfulAttendances = filteredAttendances.filter(att => att.status === 'success').length;
    const peakHour = Object.entries(byHour).reduce((max, [hour, count]) => 
      count > (byHour[max] || 0) ? parseInt(hour) : max, 0);
    const mostActiveDay = Object.entries(byDayOfWeek).reduce((max, [day, count]) => 
      count > (byDayOfWeek[max] || 0) ? day : max, '');
    
    setStats({
      totalAttendances: filteredAttendances.length,
      uniqueMembers,
      averagePerDay: Math.round((filteredAttendances.length / daysDiff) * 10) / 10,
      peakHour,
      mostActiveDay,
      successRate: Math.round((successfulAttendances / filteredAttendances.length) * 100)
    });
  }, [filteredAttendances, selectedPeriod]);

  // Exportar a CSV
  const exportToCSV = () => {
    if (filteredAttendances.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    
    try {
      let csvContent = 'Fecha,Hora,Socio,Actividad,Estado,Notas\n';
      
      filteredAttendances.forEach(att => {
        const date = safeFormatTimestamp(att.timestamp, 'date');
        const time = safeFormatTimestamp(att.timestamp, 'time');
        const memberName = att.memberName.replace(/,/g, ' ');
        const activity = att.activityName.replace(/,/g, ' ');
        const status = att.status === 'success' ? 'Exitosa' : 'Error';
        const notes = (att.notes || '').replace(/,/g, ' ');
        
        csvContent += `${date},${time},${memberName},${activity},${status},${notes}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte-asistencias-${selectedPeriod}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error al exportar el archivo');
    }
  };

  // Cargar datos al montar y cuando cambien los filtros
  useEffect(() => {
    loadAttendances();
  }, [gymData?.id, selectedPeriod]);

  // Obtener distribución horaria para gráfico
  const getHourlyDistribution = (): HourlyDistribution[] => {
    const hourlyData: Record<number, number> = {};
    
    filteredAttendances.forEach(att => {
      const jsDate = toJavaScriptDate(att.timestamp);
      if (jsDate) {
        const hour = jsDate.getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + 1;
      }
    });
    
    return Object.entries(hourlyData)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Asistencias</h1>
          <p className="text-gray-600">Análisis detallado de asistencias al gimnasio</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={loadAttendances}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
          
          <button
            onClick={exportToCSV}
            disabled={filteredAttendances.length === 0}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={16} className="mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="quarter">Último trimestre</option>
            <option value="year">Último año</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Actividad</label>
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las actividades</option>
            {activities.map(activity => (
              <option key={activity} value={activity}>{activity}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Socio</label>
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los socios</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={() => {
              setSelectedActivity('all');
              setSelectedMember('all');
            }}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            <Filter size={16} className="inline mr-2" />
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Estadísticas principales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Asistencias</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalAttendances}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Socios Únicos</p>
                <p className="text-2xl font-bold text-green-600">{stats.uniqueMembers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Promedio/Día</p>
                <p className="text-2xl font-bold text-purple-600">{stats.averagePerDay}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Hora Pico</p>
                <p className="text-2xl font-bold text-orange-600">{stats.peakHour}:00</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Día Más Activo</p>
                <p className="text-lg font-bold text-red-600 capitalize">{stats.mostActiveDay}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-indigo-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.successRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribución horaria */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Distribución por Horario</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-12 gap-2">
            {Array.from({ length: 24 }, (_, i) => {
              const hourData = getHourlyDistribution().find(h => h.hour === i);
              const count = hourData?.count || 0;
              const maxCount = Math.max(...getHourlyDistribution().map(h => h.count));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              
              return (
                <div key={i} className="text-center">
                  <div className="h-20 flex items-end justify-center mb-2">
                    <div
                      className="w-6 bg-blue-500 rounded-t"
                      style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0px' }}
                      title={`${i}:00 - ${count} asistencias`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600">{i}</div>
                  <div className="text-xs font-bold text-gray-800">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla de asistencias */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Detalle de Asistencias ({filteredAttendances.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha y Hora
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <RefreshCw size={20} className="animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Cargando asistencias...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No se encontraron asistencias para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => (
                  <tr key={att.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {safeFormatTimestamp(att.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{att.memberName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {att.activityName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        att.status === 'success' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {att.status === 'success' ? 'Exitosa' : 'Error'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {att.notes || att.error || '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReports;