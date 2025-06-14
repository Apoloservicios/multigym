// src/components/memberships/AutoRenewalDashboard.tsx
// 🆕 DASHBOARD MEJORADO con orden de componentes corregido

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Calendar, 
  User, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Settings,
  Play,
  Pause,
  Eye,
  RotateCcw,
  AlertTriangle,
  History
} from 'lucide-react';
import { MembershipAssignment } from '../../types/member.types';
import { 
  getUpcomingAutoRenewals, 
  processExpiredMemberships,
  getMembershipExpirationStats,
  getExpiredAutoRenewals // Nueva función que crearemos
} from '../../services/membershipExpiration.service';
import { renewSingleMembership } from '../../services/membershipAutoRenewal.service'; // Nueva función
import useAuth from '../../hooks/useAuth';

interface AutoRenewalStats {
  activeCount: number;
  expiredCount: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  autoRenewalCount: number;
  totalCount: number;
}

interface ProcessResult {
  success: boolean;
  renewedMemberships: MembershipAssignment[];
  expiredMemberships: MembershipAssignment[];
  errors: string[];
}

// 🔧 COMPONENTES DECLARADOS ANTES DEL COMPONENTE PRINCIPAL

// Componente para la tabla de renovaciones
const RenewalTable: React.FC<{
  memberships: MembershipAssignment[];
  onRenewIndividual: (membership: MembershipAssignment) => void;
  processingIndividual: string | null;
  showRenewButton: boolean;
}> = ({ memberships, onRenewIndividual, processingIndividual, showRenewButton }) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR');
    } catch {
      return 'Fecha inválida';
    }
  };

  const getRenewalStatus = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const membershipEndDate = new Date(endDate);
    const diffTime = membershipEndDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'vencida', color: 'bg-red-100 text-red-800', days: Math.abs(diffDays) };
    } else if (diffDays === 0) {
      return { status: 'hoy', color: 'bg-orange-100 text-orange-800', days: 0 };
    } else if (diffDays <= 3) {
      return { status: 'pronto', color: 'bg-yellow-100 text-yellow-800', days: diffDays };
    } else {
      return { status: 'normal', color: 'bg-green-100 text-green-800', days: diffDays };
    }
  };

  return (
    <div className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Socio
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Membresía
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vencimiento
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Costo
            </th>
            {showRenewButton && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {memberships.map((membership) => {
            const renewalStatus = getRenewalStatus(membership.endDate);
            
            return (
              <tr key={membership.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User className="text-gray-400 mr-2" size={16} />
                    <div className="text-sm font-medium text-gray-900">
                      {membership.memberName || 'Nombre no disponible'}
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{membership.activityName}</div>
                  <div className="text-sm text-gray-500">
                    {membership.maxAttendances > 0 
                      ? `${membership.currentAttendances}/${membership.maxAttendances} asistencias`
                      : 'Ilimitado'
                    }
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(membership.endDate)}</div>
                  <div className="text-xs text-gray-500">
                    {renewalStatus.days === 0 
                      ? 'Vence hoy' 
                      : renewalStatus.days > 0 
                        ? `${renewalStatus.days} días restantes` 
                        : `Vencida hace ${renewalStatus.days} días`
                    }
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${renewalStatus.color}`}>
                    <RefreshCw size={12} className="mr-1" />
                    {renewalStatus.status === 'vencida' ? 'Vencida' :
                     renewalStatus.status === 'hoy' ? 'Vence hoy' :
                     renewalStatus.status === 'pronto' ? 'Vence pronto' : 'Programada'}
                  </span>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <DollarSign size={14} className="mr-1" />
                    ${membership.cost?.toLocaleString('es-AR') || '0'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {membership.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                  </div>
                </td>

                {showRenewButton && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onRenewIndividual(membership)}
                      disabled={processingIndividual === membership.id}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                    >
                      {processingIndividual === membership.id ? (
                        <RefreshCw size={12} className="animate-spin mr-1" />
                      ) : (
                        <RotateCcw size={12} className="mr-1" />
                      )}
                      {processingIndividual === membership.id ? 'Renovando...' : 'Renovar'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Componente para el historial de procesos
const ProcessHistoryCard: React.FC<{ process: any }> = ({ process }) => {
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('es-AR');
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          {process.success ? (
            <CheckCircle className="text-green-500 mr-2" size={20} />
          ) : (
            <AlertCircle className="text-red-500 mr-2" size={20} />
          )}
          <div>
            <h4 className="font-medium text-gray-900">
              Proceso {process.success ? 'Exitoso' : 'Fallido'}
            </h4>
            <p className="text-sm text-gray-500">
              {formatDateTime(new Date(process.timestamp))}
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Renovadas:</span>
          <span className="ml-2 font-medium text-green-600">
            {process.renewedMemberships?.length || 0}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Expiradas:</span>
          <span className="ml-2 font-medium text-red-600">
            {process.expiredMemberships?.length || 0}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Errores:</span>
          <span className="ml-2 font-medium text-orange-600">
            {process.errors?.length || 0}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Total:</span>
          <span className="ml-2 font-medium text-gray-900">
            {(process.renewedMemberships?.length || 0) + (process.expiredMemberships?.length || 0)}
          </span>
        </div>
      </div>
      
      {process.errors && process.errors.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
          <p className="text-xs text-red-700 font-medium">Errores encontrados:</p>
          <ul className="text-xs text-red-600 mt-1 space-y-1">
            {process.errors.slice(0, 3).map((error: string, index: number) => (
              <li key={index}>• {error}</li>
            ))}
            {process.errors.length > 3 && (
              <li>• Y {process.errors.length - 3} errores más...</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// 🔧 COMPONENTE PRINCIPAL DECLARADO DESPUÉS DE LOS COMPONENTES AUXILIARES
const AutoRenewalDashboard: React.FC = () => {
  const { gymData } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'expired' | 'history'>('upcoming');
  const [upcomingRenewals, setUpcomingRenewals] = useState<MembershipAssignment[]>([]);
  const [expiredRenewals, setExpiredRenewals] = useState<MembershipAssignment[]>([]);
  const [processHistory, setProcessHistory] = useState<ProcessResult[]>([]);
  const [stats, setStats] = useState<AutoRenewalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [processingIndividual, setProcessingIndividual] = useState<string | null>(null);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
    }
  }, [gymData?.id]);

  const loadDashboardData = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Cargar todos los datos en paralelo
      const [upcoming, expired, statistics] = await Promise.all([
        getUpcomingAutoRenewals(gymData.id, 14), // Próximos 14 días
        getExpiredAutoRenewals(gymData.id), // Nueva función para vencidas
        getMembershipExpirationStats(gymData.id)
      ]);
      
      setUpcomingRenewals(upcoming);
      setExpiredRenewals(expired);
      setStats(statistics);
      
      // Cargar historial desde localStorage
      const savedHistory = localStorage.getItem(`renewalHistory_${gymData.id}`);
      if (savedHistory) {
        setProcessHistory(JSON.parse(savedHistory));
      }
      
    } catch (err: any) {
      console.error('Error cargando dashboard:', err);
      setError(err.message || 'Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processAllRenewals = async () => {
    if (!gymData?.id) return;
    
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      
      console.log('🚀 Iniciando proceso masivo de renovaciones...');
      
      const result = await processExpiredMemberships(gymData.id);
      
      if (result.success) {
        const renewedCount = result.renewedMemberships?.length || 0;
        const expiredCount = result.expiredMemberships?.length || 0;
        
        setSuccess(`Proceso completado exitosamente:
        • ${renewedCount} membresías renovadas automáticamente
        • ${expiredCount} membresías expiradas
        ${result.errors.length > 0 ? `• ${result.errors.length} errores encontrados` : ''}`);
        
        setLastProcessed(new Date());
        
        // Guardar en historial
        const newHistoryEntry: ProcessResult = {
          ...result,
          timestamp: new Date()
        } as any;
        
        const updatedHistory = [newHistoryEntry, ...processHistory].slice(0, 10); // Mantener últimos 10
        setProcessHistory(updatedHistory);
        localStorage.setItem(`renewalHistory_${gymData.id}`, JSON.stringify(updatedHistory));
        
        // Recargar datos
        await loadDashboardData();
        
      } else {
        setError(`Error en el proceso: ${result.errors.join(', ')}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error procesando renovaciones:', err);
      setError(err.message || 'Error procesando renovaciones');
    } finally {
      setProcessing(false);
    }
  };

  const renewIndividualMembership = async (membership: MembershipAssignment) => {
    if (!gymData?.id || !membership.id || !membership.memberId) return;
    
    try {
      setProcessingIndividual(membership.id);
      setError(null);
      
      await renewSingleMembership(gymData.id, membership.memberId, membership.id);
      
      setSuccess(`Membresía ${membership.activityName} renovada exitosamente`);
      
      // Recargar datos
      await loadDashboardData();
      
    } catch (err: any) {
      console.error('Error renovando membresía individual:', err);
      setError(`Error renovando ${membership.activityName}: ${err.message}`);
    } finally {
      setProcessingIndividual(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Cargando dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Renovaciones Automáticas</h2>
          <p className="text-gray-600">Gestiona y monitorea las renovaciones automáticas de membresías</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
          <button
            onClick={processAllRenewals}
            disabled={processing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Play size={16} className={`mr-2 ${processing ? 'animate-pulse' : ''}`} />
            {processing ? 'Procesando...' : 'Procesar Masivo'}
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="text-red-400" size={20} />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="text-green-400" size={20} />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Éxito</h3>
              <p className="text-sm text-green-700 whitespace-pre-line">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <RefreshCw className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Con Renovación Automática</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.autoRenewalCount}</p>
                <p className="text-xs text-gray-400">de {stats.totalCount} membresías</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Próximas Renovaciones</p>
                <p className="text-2xl font-semibold text-gray-900">{upcomingRenewals.length}</p>
                <p className="text-xs text-gray-400">próximos 14 días</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Vencidas c/ Auto-Renovación</p>
                <p className="text-2xl font-semibold text-gray-900">{expiredRenewals.length}</p>
                <p className="text-xs text-gray-400">requieren atención</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Membresías Activas</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeCount}</p>
                <p className="text-xs text-gray-400">total activas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upcoming'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar size={16} className="inline mr-2" />
              Próximas ({upcomingRenewals.length})
            </button>
            
            <button
              onClick={() => setActiveTab('expired')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expired'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AlertTriangle size={16} className="inline mr-2" />
              Vencidas ({expiredRenewals.length})
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <History size={16} className="inline mr-2" />
              Historial ({processHistory.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Pestaña: Próximas Renovaciones */}
          {activeTab === 'upcoming' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Próximas Renovaciones Automáticas
              </h3>
              {upcomingRenewals.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay renovaciones próximas</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se encontraron membresías con renovación automática que venzan pronto.
                  </p>
                </div>
              ) : (
                <RenewalTable 
                  memberships={upcomingRenewals}
                  onRenewIndividual={renewIndividualMembership}
                  processingIndividual={processingIndividual}
                  showRenewButton={false}
                />
              )}
            </div>
          )}

          {/* Pestaña: Vencidas */}
          {activeTab === 'expired' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Membresías Vencidas con Renovación Automática
                </h3>
                {expiredRenewals.length > 0 && (
                  <button
                    onClick={processAllRenewals}
                    disabled={processing}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Renovar Todas ({expiredRenewals.length})
                  </button>
                )}
              </div>
              
              {expiredRenewals.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Todas las renovaciones al día</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No hay membresías vencidas pendientes de renovación automática.
                  </p>
                </div>
              ) : (
                <RenewalTable 
                  memberships={expiredRenewals}
                  onRenewIndividual={renewIndividualMembership}
                  processingIndividual={processingIndividual}
                  showRenewButton={true}
                />
              )}
            </div>
          )}

          {/* Pestaña: Historial */}
          {activeTab === 'history' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Historial de Procesos de Renovación
              </h3>
              {processHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin historial</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se han ejecutado procesos de renovación aún.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processHistory.map((process, index) => (
                    <ProcessHistoryCard key={index} process={process} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoRenewalDashboard;