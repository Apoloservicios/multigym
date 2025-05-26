// src/components/members/MemberAttendanceHistory.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Activity, AlertCircle, Filter, Download, UserCheck, Building } from 'lucide-react';
import { Member } from '../../types/member.types';
import { AttendanceRecord, getMemberAttendanceHistory } from '../../services/attendance.service';
import useAuth from '../../hooks/useAuth';

interface MemberAttendanceHistoryProps {
  member: Member;
  onClose?: () => void;
}

const MemberAttendanceHistory: React.FC<MemberAttendanceHistoryProps> = ({
  member,
  onClose
}) => {
  const { gymData } = useAuth();
  
  // Usar AttendanceRecord en lugar de Attendance
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'this_month' | 'this_week'>('all');

  useEffect(() => {
    loadAttendanceHistory();
  }, [member.id, filter]);

  const loadAttendanceHistory = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      setError('');
      
      // Usar la función corregida del servicio
      const history = await getMemberAttendanceHistory(gymData.id, member.id, 50);
      
      // Filtrar según el filtro seleccionado
      const filteredHistory = filterAttendances(history);
      setAttendances(filteredHistory);
    } catch (err: any) {
      console.error('Error loading attendance history:', err);
      setError('Error al cargar el historial de asistencias');
    } finally {
      setLoading(false);
    }
  };

  const filterAttendances = (attendances: AttendanceRecord[]): AttendanceRecord[] => {
    if (filter === 'all') return attendances;

    const now = new Date();
    const startDate = new Date();

    if (filter === 'this_week') {
      startDate.setDate(now.getDate() - 7);
    } else if (filter === 'this_month') {
      startDate.setMonth(now.getMonth() - 1);
    }

    return attendances.filter(attendance => {
      try {
        const attendanceDate = attendance.timestamp?.toDate ? 
          attendance.timestamp.toDate() : 
          new Date(attendance.timestamp);
        
        return attendanceDate >= startDate;
      } catch (error) {
        return false;
      }
    });
  };

  const formatDateTime = (timestamp: any): string => {
    if (!timestamp) return 'Fecha no disponible';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('es-AR');
    } catch (error) {
      return '';
    }
  };

  const exportToCSV = () => {
    try {
      let csvContent = 'Fecha,Hora,Actividad,Estado,Notas,Registrado Por\n';
      
      filteredAttendances.forEach(attendance => {
        const date = formatDate(attendance.timestamp);
        const time = attendance.timestamp?.toDate ? 
          attendance.timestamp.toDate().toLocaleTimeString('es-AR') : '';
        const activity = attendance.activityName || 'General';
        const status = attendance.status === 'success' ? 'Exitosa' : 'Fallida';
        const notes = (attendance.notes || '').replace(/,/g, ' ');
        const registeredBy = attendance.registeredBy === 'member' ? 'Socio' : 
                           attendance.registeredByUserName || 'Gimnasio';
        
        csvContent += `${date},${time},${activity},${status},${notes},${registeredBy}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `asistencias_${member.firstName}_${member.lastName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
    }
  };

  // Filtrar las asistencias según el filtro actual
  const filteredAttendances = filterAttendances(attendances);

  // Calcular estadísticas
  const totalAttendances = filteredAttendances.length;
  const thisMonthAttendances = filterAttendances(attendances.filter(a => {
    try {
      const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  })).length;

  const gymRegistrations = filteredAttendances.filter(a => a.registeredBy === 'gym').length;
  const selfRegistrations = filteredAttendances.filter(a => a.registeredBy === 'member').length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando historial...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Historial de Asistencias
          </h2>
          <p className="text-gray-600">
            {member.firstName} {member.lastName}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            disabled={filteredAttendances.length === 0}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50 flex items-center"
          >
            <Download size={16} className="mr-1" />
            Exportar
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
          <AlertCircle size={20} className="mr-3" />
          <span>{error}</span>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center">
            <Activity size={20} className="text-blue-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalAttendances}</div>
              <div className="text-sm text-blue-700">Total Asistencias</div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center">
            <Calendar size={20} className="text-green-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-green-600">{thisMonthAttendances}</div>
              <div className="text-sm text-green-700">Este Mes</div>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-center">
            <Building size={20} className="text-purple-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-purple-600">{gymRegistrations}</div>
              <div className="text-sm text-purple-700">Por Gimnasio</div>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
          <div className="flex items-center">
            <UserCheck size={20} className="text-orange-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{selfRegistrations}</div>
              <div className="text-sm text-orange-700">Auto-registro</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm text-gray-700">Filtrar:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'this_month' | 'this_week')}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas</option>
            <option value="this_month">Este mes</option>
            <option value="this_week">Esta semana</option>
          </select>
        </div>
        
        <div className="text-sm text-gray-500">
          {filteredAttendances.length} asistencia{filteredAttendances.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Lista de asistencias */}
      {filteredAttendances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Activity size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Sin asistencias
          </h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? 'Este socio aún no tiene asistencias registradas' 
              : 'No hay asistencias en el período seleccionado'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha y Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actividad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrado Por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendances.map((attendance, index) => (
                  <tr key={attendance.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(attendance.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendance.activityName || 'General'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        attendance.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {attendance.status === 'success' ? 'Exitosa' : 'Fallida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {attendance.registeredBy === 'member' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          <UserCheck size={12} className="mr-1" />
                          Auto-registro
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                          <Building size={12} className="mr-1" />
                          {attendance.registeredByUserName || 'Gimnasio'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {attendance.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberAttendanceHistory;