// src/pages/dashboard/Dashboard.tsx - ACTUALIZADO CON RENOVACIONES AUTOMÁTICAS

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserCheck, 
  DollarSign, 
  Activity, 
  Calendar,
  AlertTriangle,
  Clock,
  RefreshCw,
  Gift,
  Cake
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getMembersWithUpcomingBirthdays } from '../../services/member.service';
import QuickAttendanceRegister from '../../components/attendance/QuickAttendanceRegister';
import AttendanceStatsComponent from '../../components/attendance/AttendanceStats';
import { formatArgentinianDateTime, timestampToArgentinianDate } from '../../utils/timezone.utils';

// 🆕 NUEVO: Importar el card de renovaciones automáticas
import RenewalManagementCard from '../../components/dashboard/RenewalManagementCard';

// 🆕 NUEVO: Props para navegación
interface DashboardProps {
  onNavigate?: (page: string) => void;
}

// Tipos para las métricas del dashboard
interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  totalRevenue: number;
  monthlyRevenue: number;
  todayAttendance: number;
  thisWeekAttendance: number;
  expiringMemberships: number;
  pendingPayments: number;
  upcomingBirthdays: number;
}

interface AttendanceRecord {
  id: string;
  memberName: string;
  activityName: string;
  timestamp: any;
}

interface RecentActivity {
  type: 'member_added' | 'payment_received' | 'membership_assigned' | 'attendance';
  title: string;
  description: string;
  timestamp: any;
  icon: React.ReactNode;
  iconColor: string;
}

interface UpcomingBirthday {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: any;
  daysUntilBirthday: number;
  photo?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { gymData } = useAuth();
  
  // Estados principales
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    membersWithDebt: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    todayAttendance: 0,
    thisWeekAttendance: 0,
    expiringMemberships: 0,
    pendingPayments: 0,
    upcomingBirthdays: 0
  });
  
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🆕 NUEVA FUNCIÓN: Navegar al dashboard de renovaciones automáticas
  const handleNavigateToRenewals = () => {
    if (onNavigate) {
      onNavigate('auto-renewals');
    }
  };

  // Obtener fechas para filtros temporales
  const getDateRanges = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      today: Timestamp.fromDate(today),
      thisMonth: Timestamp.fromDate(thisMonth),
      thisWeek: Timestamp.fromDate(thisWeek),
      now: Timestamp.fromDate(now)
    };
  }, []);

  // Cargar próximos cumpleaños
  const loadUpcomingBirthdays = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      const birthdayMembers = await getMembersWithUpcomingBirthdays(gymData.id, 30, 10);
      
      const birthdays: UpcomingBirthday[] = birthdayMembers.map(member => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        birthDate: member.birthDate,
        daysUntilBirthday: (member as any).daysUntilBirthday || 0,
        photo: member.photo || undefined
      }));
      
      setUpcomingBirthdays(birthdays);
      
      return birthdays.length;
    } catch (err: any) {
      console.error('Error loading upcoming birthdays:', err);
      return 0;
    }
  }, [gymData?.id]);

  // Cargar métricas principales
  const loadMetrics = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      const { today, thisMonth, thisWeek } = getDateRanges();
      
      // Obtener conteos de miembros con Promise.all para paralelizar
      const [
        totalMembersSnap,
        activeMembersSnap,
        inactiveMembersSnap,
        membersWithDebtSnap
      ] = await Promise.all([
        getDocs(collection(db, `gyms/${gymData.id}/members`)),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'active')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'inactive')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('totalDebt', '>', 0)
        ))
      ]);

      // Obtener asistencias con manejo de errores mejorado
      let todayAttendanceCount = 0;
      let weekAttendanceCount = 0;
      
      try {
        // Intentar consulta optimizada para asistencias de hoy
        const todayAttendanceSnap = await getDocs(query(
          collection(db, `gyms/${gymData.id}/attendance`),
          where('timestamp', '>=', today),
          where('status', '==', 'success')
        ));
        todayAttendanceCount = todayAttendanceSnap.size;
      } catch (todayErr) {
        console.warn('Error getting today attendance, trying fallback:', todayErr);
        // Fallback: obtener todas las asistencias y filtrar manualmente
        try {
          const allAttendanceSnap = await getDocs(
            collection(db, `gyms/${gymData.id}/attendance`)
          );
          
          const todayTimestamp = today.seconds;
          allAttendanceSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'success' && 
                data.timestamp && 
                data.timestamp.seconds >= todayTimestamp) {
              todayAttendanceCount++;
            }
          });
        } catch (fallbackErr) {
          console.error('Fallback attendance query failed:', fallbackErr);
        }
      }

      try {
        // Intentar consulta para asistencias de la semana
        const weekAttendanceSnap = await getDocs(query(
          collection(db, `gyms/${gymData.id}/attendance`),
          where('timestamp', '>=', thisWeek),
          where('status', '==', 'success')
        ));
        weekAttendanceCount = weekAttendanceSnap.size;
      } catch (weekErr) {
        console.warn('Error getting week attendance, trying fallback:', weekErr);
        // Fallback similar para la semana
        try {
          const allAttendanceSnap = await getDocs(
            collection(db, `gyms/${gymData.id}/attendance`)
          );
          
          const weekTimestamp = thisWeek.seconds;
          allAttendanceSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'success' && 
                data.timestamp && 
                data.timestamp.seconds >= weekTimestamp) {
              weekAttendanceCount++;
            }
          });
        } catch (fallbackErr) {
          console.error('Fallback week attendance query failed:', fallbackErr);
        }
      }

      // Obtener transacciones para revenue
      const [monthlyTransactionsSnap, allTransactionsSnap] = await Promise.all([
        getDocs(query(
          collection(db, `gyms/${gymData.id}/transactions`),
          where('date', '>=', thisMonth),
          where('type', '==', 'income'),
          where('status', '==', 'completed')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/transactions`),
          where('type', '==', 'income'),
          where('status', '==', 'completed')
        ))
      ]);

      // Obtener membresías que expiran pronto (próximos 7 días)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const expiringMembershipsSnap = await getDocs(query(
        collection(db, `gyms/${gymData.id}/membershipAssignments`),
        where('status', '==', 'active'),
        where('endDate', '<=', Timestamp.fromDate(nextWeek))
      ));

      // Obtener pagos pendientes
      const pendingPaymentsSnap = await getDocs(query(
        collection(db, `gyms/${gymData.id}/membershipAssignments`),
        where('paymentStatus', '==', 'pending')
      ));

      // Cargar próximos cumpleaños
      const birthdayCount = await loadUpcomingBirthdays();

      // Calcular revenues
      let monthlyRevenue = 0;
      monthlyTransactionsSnap.forEach(doc => {
        const data = doc.data();
        monthlyRevenue += data.amount || 0;
      });

      let totalRevenue = 0;
      allTransactionsSnap.forEach(doc => {
        const data = doc.data();
        totalRevenue += data.amount || 0;
      });

      // Actualizar métricas
      setMetrics({
        totalMembers: totalMembersSnap.size,
        activeMembers: activeMembersSnap.size,
        inactiveMembers: inactiveMembersSnap.size,
        membersWithDebt: membersWithDebtSnap.size,
        totalRevenue,
        monthlyRevenue,
        todayAttendance: todayAttendanceCount,
        thisWeekAttendance: weekAttendanceCount,
        expiringMemberships: expiringMembershipsSnap.size,
        pendingPayments: pendingPaymentsSnap.size,
        upcomingBirthdays: birthdayCount || 0
      });

    } catch (err: any) {
      console.error('Error loading metrics:', err);
      setError('Error al cargar las métricas del dashboard');
    }
  }, [gymData?.id, getDateRanges, loadUpcomingBirthdays]);

  // Cargar asistencias recientes
  const loadRecentAttendance = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      // Usar el servicio de asistencias actualizado
      const attendanceRef = collection(db, `gyms/${gymData.id}/attendance`);
      const q = query(
        attendanceRef,
        where('status', '==', 'success'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);

      const attendance: AttendanceRecord[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        attendance.push({
          id: doc.id,
          memberName: data.memberName || `${data.memberFirstName || ''} ${data.memberLastName || ''}`.trim() || 'Desconocido',
          activityName: data.activityName || 'General',
          timestamp: data.timestamp
        });
      });

      setRecentAttendance(attendance);
    } catch (err: any) {
      console.error('Error loading recent attendance:', err);
      // Si hay error con la consulta ordenada, intentar sin orderBy
      try {
        const attendanceRef = collection(db, `gyms/${gymData.id}/attendance`);
        const q = query(
          attendanceRef,
          where('status', '==', 'success'),
          limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        const attendance: AttendanceRecord[] = [];
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          attendance.push({
            id: doc.id,
            memberName: data.memberName || `${data.memberFirstName || ''} ${data.memberLastName || ''}`.trim() || 'Desconocido',
            activityName: data.activityName || 'General',
            timestamp: data.timestamp
          });
        });

        // Ordenar manualmente por timestamp
        attendance.sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.seconds || 0;
          return bTime - aTime;
        });

        setRecentAttendance(attendance.slice(0, 5));
      } catch (fallbackErr) {
        console.error('Error in fallback attendance query:', fallbackErr);
        setRecentAttendance([]);
      }
    }
  }, [gymData?.id]);

  // Generar actividades recientes basadas en datos reales
  const generateRecentActivities = useCallback(async () => {
    if (!gymData?.id) return;
    
    try {
      const activities: RecentActivity[] = [];
      const { thisWeek } = getDateRanges();

      // Obtener miembros recientes
      const recentMembersSnap = await getDocs(query(
        collection(db, `gyms/${gymData.id}/members`),
        where('createdAt', '>=', thisWeek),
        orderBy('createdAt', 'desc'),
        limit(3)
      ));

      recentMembersSnap.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'member_added',
          title: 'Nuevo socio registrado',
          description: `${data.firstName} ${data.lastName} se unió al gimnasio`,
          timestamp: data.createdAt,
          icon: <Users size={16} />,
          iconColor: 'text-blue-600'
        });
      });

      // Obtener pagos recientes
      const recentPaymentsSnap = await getDocs(query(
        collection(db, `gyms/${gymData.id}/transactions`),
        where('type', '==', 'income'),
        where('status', '==', 'completed'),
        where('date', '>=', thisWeek),
        orderBy('date', 'desc'),
        limit(3)
      ));

      recentPaymentsSnap.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'payment_received',
          title: 'Pago recibido',
          description: `${formatCurrency(data.amount)} de ${data.memberName || 'socio'}`,
          timestamp: data.date,
          icon: <DollarSign size={16} />,
          iconColor: 'text-green-600'
        });
      });

      // Obtener membresías asignadas recientemente
      const recentMembershipsSnap = await getDocs(query(
        collection(db, `gyms/${gymData.id}/membershipAssignments`),
        where('createdAt', '>=', thisWeek),
        orderBy('createdAt', 'desc'),
        limit(2)
      ));

      recentMembershipsSnap.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'membership_assigned',
          title: 'Membresía asignada',
          description: `${data.activityName} asignada a ${data.memberName}`,
          timestamp: data.createdAt,
          icon: <Calendar size={16} />,
          iconColor: 'text-purple-600'
        });
      });

      // Ordenar actividades por fecha
      activities.sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
      });

      setRecentActivities(activities.slice(0, 5));
    } catch (err: any) {
      console.error('Error loading recent activities:', err);
    }
  }, [gymData?.id, getDateRanges]);

  // Cargar todos los datos
  const loadDashboardData = useCallback(async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadMetrics(),
        loadRecentAttendance(),
        generateRecentActivities()
      ]);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id, loadMetrics, loadRecentAttendance, generateRecentActivities]);

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Formatear fecha para mostrar
  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'Fecha no disponible';
    
    // ✅ USAR LA FUNCIÓN DE TIMEZONE ARGENTINO
    return formatArgentinianDateTime(timestamp);
  };

  // Función para formatear días hasta cumpleaños
  const formatDaysUntilBirthday = (days: number) => {
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    return `En ${days} días`;
  };

  // Función para obtener fecha de cumpleaños formateada
  const formatBirthdayDate = (birthDate: any) => {
    if (!birthDate) return '';
    
    try {
      // ✅ CORRECCIÓN ESPECÍFICA PARA FECHAS DE CUMPLEAÑOS
      let dateToFormat: Date | null = null;
      
      // Si ya es un string en formato YYYY-MM-DD (como se guarda en el form)
      if (typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        const [year, month, day] = birthDate.split('-').map(Number);
        // Crear fecha sin problemas de timezone
        dateToFormat = new Date(year, month - 1, day);
      }
      // Si es un timestamp de Firebase
      else if (birthDate?.toDate && typeof birthDate.toDate === 'function') {
        const firebaseDate = birthDate.toDate();
        // Usar UTC para evitar problemas de timezone
        dateToFormat = new Date(
          firebaseDate.getUTCFullYear(),
          firebaseDate.getUTCMonth(),
          firebaseDate.getUTCDate()
        );
      }
      // Si es un objeto con seconds (timestamp serializado)
      else if (birthDate?.seconds) {
        const firebaseDate = new Date(birthDate.seconds * 1000);
        dateToFormat = new Date(
          firebaseDate.getUTCFullYear(),
          firebaseDate.getUTCMonth(),
          firebaseDate.getUTCDate()
        );
      }
      // Si es una Date normal
      else if (birthDate instanceof Date) {
        dateToFormat = new Date(
          birthDate.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate()
        );
      }
      
      if (!dateToFormat || isNaN(dateToFormat.getTime())) {
        return '';
      }
      
      // Formatear solo día y mes
      return dateToFormat.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit'
      });
      
    } catch (error) {
      console.error('Error formatting birthday date:', error);
      return '';
    }
  };

  if (loading && Object.values(metrics).every(v => v === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Resumen general de {gymData?.name || 'tu gimnasio'}
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin mr-2' : 'mr-2'} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total de Socios */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Socios</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalMembers.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-green-600">
                  {metrics.activeMembers} activos
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  • {metrics.inactiveMembers} inactivos
                </span>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Users size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Asistencia Hoy */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Asistencia Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.todayAttendance}</p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-blue-600">
                  {metrics.thisWeekAttendance} esta semana
                </span>
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <UserCheck size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Revenue Mensual */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue Mensual</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics.monthlyRevenue)}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-500">
                  Total: {formatCurrency(metrics.totalRevenue)}
                </span>
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg">
              <DollarSign size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Atención Requerida</p>
              <div className="mt-2 space-y-1">
                {metrics.expiringMemberships > 0 && (
                  <div className="text-sm text-amber-600">
                    {metrics.expiringMemberships} membresías por vencer
                  </div>
                )}
                {metrics.pendingPayments > 0 && (
                  <div className="text-sm text-red-600">
                    {metrics.pendingPayments} pagos pendientes
                  </div>
                )}
                {metrics.membersWithDebt > 0 && (
                  <div className="text-sm text-orange-600">
                    {metrics.membersWithDebt} socios con deuda
                  </div>
                )}
                {metrics.upcomingBirthdays > 0 && (
                  <div className="text-sm text-pink-600">
                    {metrics.upcomingBirthdays} cumpleaños próximos
                  </div>
                )}
                {metrics.expiringMemberships === 0 && metrics.pendingPayments === 0 && 
                 metrics.membersWithDebt === 0 && metrics.upcomingBirthdays === 0 && (
                  <div className="text-sm text-green-600">
                    Todo al día ✓
                  </div>
                )}
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <AlertTriangle size={24} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 NUEVA SECCIÓN: Card de Renovaciones Automáticas */}
      <div className="mb-8">
        <div className="max-w-md">
          <RenewalManagementCard onNavigateToRenewals={handleNavigateToRenewals} />
        </div>
      </div>

      {/* Sección de contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asistencias Recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Asistencias Recientes</h2>
          </div>
          <div className="p-6">
            {recentAttendance.length === 0 ? (
              <div className="text-center py-8">
                <Activity size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No hay asistencias recientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAttendance.map((attendance) => (
                  <div key={attendance.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="bg-green-100 p-2 rounded-full mr-3">
                        <UserCheck size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{attendance.memberName}</p>
                        <p className="text-sm text-gray-600">{attendance.activityName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {formatDateTime(attendance.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Próximos Cumpleaños */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Próximos Cumpleaños</h2>
              <div className="bg-pink-50 p-2 rounded-full">
                <Cake size={20} className="text-pink-600" />
              </div>
            </div>
          </div>
          <div className="p-6">
            {upcomingBirthdays.length === 0 ? (
              <div className="text-center py-8">
                <Gift size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No hay cumpleaños próximos</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBirthdays.map((birthday) => (
                  <div key={birthday.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-100">
                    <div className="flex items-center">
                      <div className="relative">
                        {birthday.photo ? (
                          <img 
                            src={birthday.photo} 
                            alt={`${birthday.firstName} ${birthday.lastName}`}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                            <Users size={16} className="text-pink-600" />
                          </div>
                        )}
                        {birthday.daysUntilBirthday === 0 && (
                          <div className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            !
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {birthday.firstName} {birthday.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatBirthdayDate(birthday.birthDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                        birthday.daysUntilBirthday === 0 
                          ? 'bg-pink-500 text-white' 
                          : birthday.daysUntilBirthday === 1
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {formatDaysUntilBirthday(birthday.daysUntilBirthday)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Actividad Reciente</h2>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <Clock size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No hay actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`bg-gray-100 p-2 rounded-full ${activity.iconColor}`}>
                      {activity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        {/* Tasa de Asistencia */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasa de Asistencia</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Hoy</span>
                <span className="text-sm font-medium">
                  {metrics.activeMembers > 0 
                    ? `${Math.round((metrics.todayAttendance / metrics.activeMembers) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ 
                    width: `${metrics.activeMembers > 0 
                      ? Math.min((metrics.todayAttendance / metrics.activeMembers) * 100, 100)
                      : 0
                    }%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de Pagos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Pagos</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Al día</span>
              <span className="text-sm font-medium text-green-600">
                {metrics.totalMembers - metrics.membersWithDebt}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Con deuda</span>
              <span className="text-sm font-medium text-red-600">
                {metrics.membersWithDebt}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pagos pendientes</span>
              <span className="text-sm font-medium text-yellow-600">
                {metrics.pendingPayments}
              </span>
            </div>
          </div>
        </div>

        {/* Próximos Vencimientos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Próximos Vencimientos</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Esta semana</span>
              <span className="text-sm font-medium text-amber-600">
                {metrics.expiringMemberships}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Membresías que vencen en los próximos 7 días
            </div>
          </div>
        </div>

        {/* Resumen de Cumpleaños */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Cake size={20} className="mr-2 text-pink-600" />
            Cumpleaños
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Este mes</span>
              <span className="text-sm font-medium text-pink-600">
                {metrics.upcomingBirthdays}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Próximos cumpleaños en 30 días
            </div>
            {upcomingBirthdays.filter(b => b.daysUntilBirthday === 0).length > 0 && (
              <div className="bg-pink-50 p-2 rounded-lg border border-pink-100">
                <div className="flex items-center">
                  <Gift size={14} className="text-pink-600 mr-1" />
                  <span className="text-xs text-pink-700 font-medium">
                    {upcomingBirthdays.filter(b => b.daysUntilBirthday === 0).length} cumpleaños hoy
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer del dashboard */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Datos actualizados automáticamente cada 5 minutos. 
          Última actualización: {new Date().toLocaleTimeString('es-AR')}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;