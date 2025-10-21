// src/components/members/MemberAttendanceHistory.tsx
import React, { useState, useEffect } from 'react';
import { Activity, Calendar, AlertCircle } from 'lucide-react';
import { AttendanceRecord } from '../../types/attendance.types';
import attendanceService from '../../services/attendance.service';
import useAuth from '../../hooks/useAuth';

interface MemberAttendanceHistoryProps {
  member: any; // El objeto completo del socio con toda su información
  onClose?: () => void;
}

const MemberAttendanceHistory: React.FC<MemberAttendanceHistoryProps> = ({ 
  member,
  onClose
}) => {
  const { gymData } = useAuth();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');

  // 🆕 Detectar si el socio tiene deuda
  const memberHasDebt = (member.totalDebt && member.totalDebt > 0) || member.hasDebt;
  const memberDebtAmount = member.totalDebt || 0;

  useEffect(() => {
    loadAttendances();
  }, [member.id, gymData?.id]);

  const loadAttendances = async () => {
    if (!gymData?.id || !member.id) return;

    setLoading(true);
    try {
      const data = await attendanceService.getMemberAttendanceHistory(gymData.id, member.id);
      setAttendances(data);
    } catch (error) {
      console.error('Error loading attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: any): string => {
    if (!timestamp) return 'No disponible';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const getFilteredAttendances = () => {
    const now = new Date();
    
    switch (filter) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return attendances.filter(a => {
          const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          return date >= weekAgo;
        });
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return attendances.filter(a => {
          const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          return date >= monthAgo;
        });
      default:
        return attendances;
    }
  };

  const filteredAttendances = getFilteredAttendances();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros y alerta de deuda */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity size={20} className="mr-2" />
          Historial de Asistencias
        </h3>

        {/* 🆕 ALERTA DE DEUDA */}
        {memberHasDebt && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span className="text-sm font-medium text-red-700">
              Deuda: ${memberDebtAmount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              filter === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Última semana
          </button>
          <button
            onClick={() => setFilter('month')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              filter === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Último mes
          </button>
        </div>
      </div>

      {/* Contador de asistencias */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar size={16} />
        <span>
          {filteredAttendances.length} asistencia{filteredAttendances.length !== 1 ? 's' : ''}
        </span>
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
                  <tr 
                    key={attendance.id || index} 
                    className={`
                      ${memberHasDebt ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                      transition-colors
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {/* 🆕 Indicador visual de deuda */}
                        {memberHasDebt && (
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" title="Socio con deuda"></div>
                        )}
                        {formatDateTime(attendance.timestamp)}
                      </div>
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
                      {attendance.registeredByUserName || 'Sistema'}
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