// DASHBOARD UNIFICADO DE RENOVACIONES - PARTE 1
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Users,
  FileText,
  TrendingUp,
  Calendar,
  DollarSign,
  Zap
} from 'lucide-react';
import { membershipRenewalService } from '../../services/membershipRenewalService';
import IndividualMembershipManagement from './IndividualMembershipManagement';
import MonthlyReportGenerator from './MonthlyReportGenerator';
import useAuth from '../../hooks/useAuth';
import { formatDisplayDate } from '../../utils/date.utils';

interface DashboardStats {
  totalMemberships: number;
  withAutoRenewal: number;
  expired: number;
  expiringSoon: number;
  renewedThisMonth: number;
}

interface ProcessProgress {
  current: number;
  total: number;
  currentItem: string;
  isActive: boolean;
}

const UnifiedRenewalDashboard: React.FC = () => {
  const { gymData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'expired' | 'manage' | 'reports'>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [membershipsToRenew, setMembershipsToRenew] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processProgress, setProcessProgress] = useState<ProcessProgress>({
    current: 0,
    total: 0,
    currentItem: '',
    isActive: false
  });

  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
    }
  }, [gymData]);

  const loadDashboardData = async () => {
    if (!gymData?.id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const [statsData, membershipsData] = await Promise.all([
        membershipRenewalService.getRenewalStats(gymData.id),
        membershipRenewalService.getMembershipsNeedingRenewal(gymData.id)
      ]);
      
      setStats(statsData);
      setMembershipsToRenew(membershipsData);
    } catch (err: any) {
      setError('Error cargando datos del dashboard');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const processAllRenewals = async () => {
    if (!gymData?.id || isProcessing) return;
    
    setIsProcessing(true);
    setError('');
    setSuccess('');
    setProcessProgress({ current: 0, total: 0, currentItem: '', isActive: true });
    
    try {
      const result = await membershipRenewalService.processAllAutoRenewals(
        gymData.id,
        (current, total, currentItem) => {
          setProcessProgress({
            current,
            total,
            currentItem,
            isActive: true
          });
        }
      );
      
      if (result.success) {
        setSuccess(`✅ Proceso completado: ${result.renewedCount} membresías renovadas exitosamente`);
        await loadDashboardData();
      } else if (result.totalProcessed === 0) {
        setSuccess('No hay membresías pendientes de renovación');
      } else {
        setError(`Se encontraron ${result.errorCount} errores durante el proceso`);
      }
    } catch (err: any) {
      setError('Error procesando renovaciones automáticas');
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProcessProgress({ current: 0, total: 0, currentItem: '', isActive: false });
      
      // Limpiar mensajes después de 5 segundos
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
    }
  };

  // Componente de barra de progreso
  const ProgressBar = () => {
    if (!processProgress.isActive) return null;
    
    const percentage = processProgress.total > 0 
      ? Math.round((processProgress.current / processProgress.total) * 100)
      : 0;
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Procesando renovaciones...
            </span>
            <span className="text-sm text-gray-500">
              {processProgress.current} de {processProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-500 truncate">
            Procesando: {processProgress.currentItem}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Cargando dashboard...</span>
      </div>
    );
  }
  // CONTINUACIÓN - PARTE 2

  return (
    <div className="space-y-6">
      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {/* Navegación por pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Resumen
          </button>
          
          <button
            onClick={() => setActiveTab('expired')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'expired'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Vencidas
            {membershipsToRenew.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                {membershipsToRenew.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('manage')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'manage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Gestionar
          </button>
          
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'reports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4 mr-2" />
            Reportes
          </button>
        </nav>
      </div>

      {/* Contenido de las pestañas */}
      <div className="mt-6">
        {/* PESTAÑA: Resumen */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Tarjetas de estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Membresías
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.totalMemberships}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <RefreshCw className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Con Auto-renovación
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.withAutoRenewal}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Vencidas
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.expired}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Renovadas este mes
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.renewedThisMonth}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de control rápido */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Control Rápido
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={loadDashboardData}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar Datos
                </button>
                
                {membershipsToRenew.length > 0 && (
                  <button
                    onClick={processAllRenewals}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    {isProcessing ? 'Procesando...' : `Procesar ${membershipsToRenew.length} Renovaciones`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: Vencidas */}
        {activeTab === 'expired' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Membresías Vencidas con Auto-renovación
                </h3>
                {membershipsToRenew.length > 0 && (
                  <button
                    onClick={processAllRenewals}
                    disabled={isProcessing}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    {isProcessing ? 'Procesando...' : `Renovar Todas (${membershipsToRenew.length})`}
                  </button>
                )}
              </div>
              
              {membershipsToRenew.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No hay renovaciones pendientes
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Todas las membresías con auto-renovación están al día
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Socio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actividad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Venció
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {membershipsToRenew.map((membership) => (
                        <tr key={membership.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {membership.memberName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {membership.activityName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {formatDisplayDate(membership.endDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${membership.cost?.toLocaleString('es-AR') || '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA: Gestionar */}
        {activeTab === 'manage' && <IndividualMembershipManagement />}
        
        {/* PESTAÑA: Reportes */}
        {activeTab === 'reports' && <MonthlyReportGenerator />}
      </div>

      {/* Barra de progreso */}
      <ProgressBar />
    </div>
  );
};

export default UnifiedRenewalDashboard;