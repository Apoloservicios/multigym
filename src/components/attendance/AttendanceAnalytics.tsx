// src/components/attendance/AttendanceAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Users, Clock, Calendar, Target, AlertCircle } from 'lucide-react';
import { analyzeGymTraffic, analyzeAttendancePattern, generateRecommendations } from '../../services/attendance.analytics';
import { GymTrafficAnalytics, AttendancePattern } from '../../services/attendance.analytics';
import useAuth from '../../hooks/useAuth';

interface AttendanceAnalyticsProps {
  memberId?: string; // Si se pasa, muestra analytics específicos del socio
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ memberId }) => {
  const { gymData } = useAuth();
  const [gymAnalytics, setGymAnalytics] = useState<GymTrafficAnalytics | null>(null);
  const [memberPattern, setMemberPattern] = useState<AttendancePattern | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);

  useEffect(() => {
    if (gymData?.id) {
      loadAnalytics();
    }
  }, [gymData?.id, memberId, selectedPeriod]);

  const loadAnalytics = async () => {
    if (!gymData?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Cargar analytics del gimnasio
      const traffic = await analyzeGymTraffic(gymData.id, selectedPeriod);
      setGymAnalytics(traffic);

      // Si hay un memberId específico, cargar analytics del miembro
      if (memberId) {
        const pattern = await analyzeAttendancePattern(gymData.id, memberId);
        setMemberPattern(pattern);

        const recs = await generateRecommendations(gymData.id, memberId);
        setRecommendations(recs);
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Error al cargar los análisis');
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Cargando análisis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertCircle size={20} className="text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {memberId ? 'Análisis Personal de Asistencias' : 'Analytics del Gimnasio'}
        </h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={7}>Última semana</option>
          <option value={30}>Último mes</option>
          <option value={90}>Últimos 3 meses</option>
          <option value={365}>Último año</option>
        </select>
      </div>

      {/* Analytics específicos del miembro */}
      {memberId && memberPattern && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Sesiones/Semana</p>
                <p className="text-2xl font-bold text-blue-900">{memberPattern.averageSessionsPerWeek}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Racha Actual</p>
                <p className="text-2xl font-bold text-green-900">{memberPattern.currentStreak} días</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Mejor Racha</p>
                <p className="text-2xl font-bold text-purple-900">{memberPattern.longestStreak} días</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Última Asistencia</p>
                <p className="text-sm font-bold text-orange-900">
                  {memberPattern.lastAttendance ? 
                    memberPattern.lastAttendance.toLocaleDateString('es-AR') : 
                    'Sin registro'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recomendaciones personalizadas */}
      {recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Recomendaciones Personalizadas</h3>
          <ul className="space-y-2">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <Target className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <span className="text-yellow-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analytics del gimnasio */}
      {gymAnalytics && !memberId && (
        <>
          {/* KPIs del gimnasio */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Capacidad Pico</p>
                  <p className="text-2xl font-bold text-gray-900">{gymAnalytics.peakCapacity}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Promedio Diario</p>
                  <p className="text-2xl font-bold text-gray-900">{gymAnalytics.averageDailyAttendance}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                {gymAnalytics.growthRate >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Crecimiento</p>
                  <p className={`text-2xl font-bold ${
                    gymAnalytics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {gymAnalytics.growthRate > 0 ? '+' : ''}{gymAnalytics.growthRate}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Retención</p>
                  <p className="text-2xl font-bold text-purple-600">{gymAnalytics.retentionRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tráfico por hora */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Tráfico por Hora</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gymAnalytics.busyHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={formatHour}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `Hora: ${formatHour(hour as number)}`}
                    formatter={(value) => [value, 'Asistencias']}
                  />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tráfico por día de la semana */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Asistencias por Día de la Semana</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gymAnalytics.busyDays}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ day, count }) => `${day}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {gymAnalytics.busyDays.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Patrones personales del miembro */}
      {memberId && memberPattern && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Días preferidos */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Tus Días Preferidos</h3>
            <div className="space-y-2">
              {memberPattern.preferredDays.map((day, index) => (
                <div key={day} className="flex items-center">
                  <span className={`inline-block w-4 h-4 rounded-full bg-blue-500 mr-3`} 
                        style={{ backgroundColor: COLORS[index] }}></span>
                  <span className="capitalize">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Horarios preferidos */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Tus Horarios Preferidos</h3>
            <div className="space-y-2">
              {memberPattern.preferredHours.map((hour, index) => (
                <div key={hour} className="flex items-center">
                  <span className={`inline-block w-4 h-4 rounded-full bg-green-500 mr-3`} 
                        style={{ backgroundColor: COLORS[index] }}></span>
                  <span>{formatHour(hour)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalytics;