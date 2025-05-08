// src/components/members/MemberAttendanceHistory.tsx

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Attendance } from '../../types/gym.types';
import { getMemberAttendanceHistory } from '../../services/attendance.service';
import useAuth from '../../hooks/useAuth';

interface MemberAttendanceHistoryProps {
  memberId: string;
  memberName: string;
}

const MemberAttendanceHistory: React.FC<MemberAttendanceHistoryProps> = ({ 
  memberId, 
  memberName 
}) => {
  const { gymData } = useAuth();
  
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<string>('all');
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Cargar historial de asistencias
  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      if (!gymData?.id || !memberId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        // Aquí deberías implementar este método en un servicio
        // Por ahora, usaremos datos de ejemplo
        const history = await getMemberAttendanceHistory(gymData.id, memberId);
        setAttendances(history);
      } catch (err: any) {
        console.error('Error loading attendance history:', err);
        setError(err.message || 'Error al cargar el historial de asistencias');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAttendanceHistory();
  }, [gymData?.id, memberId]);
  
  // Filtrar asistencias por período
  const filteredAttendances = () => {
    // Primero filtrar por término de búsqueda
    let filteredBySearch = attendances;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredBySearch = attendances.filter(att => 
        att.activityName.toLowerCase().includes(search)
      );
    }
    
    // Luego filtrar por período
    if (period === 'all') {
      return filteredBySearch;
    }
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const firstDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    
    return filteredBySearch.filter(att => {
      const attDate = att.timestamp.toDate ? att.timestamp.toDate() : new Date(att.timestamp);
      
      switch (period) {
        case 'current':
          return attDate >= firstDayOfMonth;
        case 'previous':
          return attDate >= firstDayOfPreviousMonth && attDate <= lastDayOfPreviousMonth;
        case 'year':
          return attDate >= firstDayOfYear;
        default:
          return true;
      }
    });
  };
  
  // Formatear fecha y hora
  const formatDateTime = (timestamp: any) => {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Función para refrescar los datos
  const refreshData = async () => {
    setLoading(true);
    try {
      const history = await getMemberAttendanceHistory(gymData?.id || '', memberId);
      setAttendances(history);
      setError('');
    } catch (err: any) {
      console.error('Error refreshing attendance history:', err);
      setError(err.message || 'Error al actualizar el historial de asistencias');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Historial de Asistencias</h2>
      <p className="text-gray-600 mb-6">Socio: {memberName}</p>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-3 md:space-y-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por actividad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        </div>
        
        <div className="flex space-x-3">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los períodos</option>
            <option value="current">Mes actual</option>
            <option value="previous">Mes anterior</option>
            <option value="year">Año actual</option>
          </select>
          
          <button 
            onClick={refreshData}
            disabled={loading}
            className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500">Cargando asistencias...</p>
        </div>
      ) : filteredAttendances().length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          {searchTerm ? (
            <p className="text-gray-500">No se encontraron asistencias para "{searchTerm}"</p>
          ) : (
            <p className="text-gray-500">No hay asistencias registradas en este período</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Fecha y Hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Actividad</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 border-b">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendances().map((att) => (
                <tr key={att.id} className="hover:bg-gray-50 border-b border-gray-100">
                  <td className="px-4 py-3 text-sm">{formatDateTime(att.timestamp)}</td>
                  <td className="px-4 py-3 text-sm">{att.activityName}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      att.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {att.status === 'success' ? 'Exitosa' : 'Error'}
                      {att.error && `: ${att.error}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MemberAttendanceHistory;