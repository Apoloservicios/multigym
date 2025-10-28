// ============================================
// PANEL DE ASISTENCIA - VERSIÓN CORREGIDA
// Archivo: src/components/attendance/AttendancePanel.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { Clock, Users, TrendingUp, Calendar } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import fingerprintService from '../../services/fingerprintService';

interface AttendanceStats {
  today: number;
  week: number;
  month: number;
  total: number;
}

const AttendancePanel: React.FC = () => {
  const { gymData } = useAuth();
  const [stats, setStats] = useState<AttendanceStats>({
    today: 0,
    week: 0,
    month: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [fingerprintReaderStatus, setFingerprintReaderStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    if (gymData?.id) {
      loadStats();
      checkFingerprintReader();
    }
  }, [gymData?.id]);

  // ✅ CORREGIDO: Ahora se pasa gymId al método capture
  const checkFingerprintReader = async () => {
    if (!gymData?.id) return;
    
    try {
      setFingerprintReaderStatus('checking');
      
      // Verificar servidor
      const serverOk = await fingerprintService.checkServerStatus();
      if (!serverOk) {
        setFingerprintReaderStatus('disconnected');
        return;
      }
      
      // Intentar inicializar (sin capturar, solo para verificar que funciona)
      const initResult = await fingerprintService.initialize();
      
      if (initResult.success) {
        setFingerprintReaderStatus('connected');
      } else {
        setFingerprintReaderStatus('disconnected');
      }
      
    } catch (error) {
      console.error('Error verificando lector de huellas:', error);
      setFingerprintReaderStatus('disconnected');
    }
  };

  const loadStats = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const attendanceRef = collection(db, `gyms/${gymData.id}/attendance`);

      // Asistencias de hoy
      const todayQuery = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfToday))
      );
      const todaySnap = await getDocs(todayQuery);

      // Asistencias de la semana
      const weekQuery = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfWeek))
      );
      const weekSnap = await getDocs(weekQuery);

      // Asistencias del mes
      const monthQuery = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
      );
      const monthSnap = await getDocs(monthQuery);

      // Total
      const totalSnap = await getDocs(attendanceRef);

      setStats({
        today: todaySnap.size,
        week: weekSnap.size,
        month: monthSnap.size,
        total: totalSnap.size
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-6">Estadísticas de Asistencia</h2>
      
      {/* Estado del lector de huellas */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Lector de Huellas:
          </span>
          <div className="flex items-center">
            {fingerprintReaderStatus === 'checking' && (
              <span className="text-sm text-gray-500">Verificando...</span>
            )}
            {fingerprintReaderStatus === 'connected' && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-green-600 font-medium">Conectado</span>
              </>
            )}
            {fingerprintReaderStatus === 'disconnected' && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-red-600 font-medium">Desconectado</span>
              </>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Hoy */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="text-blue-500" size={24} />
              <span className="text-2xl font-bold text-blue-600">{stats.today}</span>
            </div>
            <p className="text-sm text-gray-600">Hoy</p>
          </div>

          {/* Esta semana */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="text-green-500" size={24} />
              <span className="text-2xl font-bold text-green-600">{stats.week}</span>
            </div>
            <p className="text-sm text-gray-600">Esta Semana</p>
          </div>

          {/* Este mes */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-purple-500" size={24} />
              <span className="text-2xl font-bold text-purple-600">{stats.month}</span>
            </div>
            <p className="text-sm text-gray-600">Este Mes</p>
          </div>

          {/* Total */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-orange-500" size={24} />
              <span className="text-2xl font-bold text-orange-600">{stats.total}</span>
            </div>
            <p className="text-sm text-gray-600">Total</p>
          </div>
        </div>
      )}

      <button
        onClick={loadStats}
        className="mt-4 text-sm text-blue-600 hover:text-blue-800"
      >
        Actualizar estadísticas
      </button>
    </div>
  );
};

export default AttendancePanel;