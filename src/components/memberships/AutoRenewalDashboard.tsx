// src/components/memberships/AutoRenewalDashboard.tsx
// 🆕 DASHBOARD MEJORADO con progreso REAL conectado al servicio

import React, { useState, useEffect, useRef } from 'react';
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
  History,
  X,
  Zap,
  Timer,
  Activity
} from 'lucide-react';
import { MembershipAssignment } from '../../types/member.types';
import { 
  getUpcomingAutoRenewals, 
  processExpiredMemberships,
  getMembershipExpirationStats,
  getExpiredAutoRenewals
} from '../../services/membershipExpiration.service';
import { renewSingleMembership } from '../../services/membershipAutoRenewal.service';
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

// 🆕 NUEVO: Interface para progreso del proceso
interface ProcessProgress {
  current: number;
  total: number;
  stage: 'preparing' | 'processing' | 'completing' | 'done';
  currentItem: string;
  estimatedTimeRemaining: number;
}

// 🔧 COMPONENTE MEJORADO: Barra de progreso con detalles
const ProgressBar: React.FC<{
  progress: ProcessProgress;
  onCancel: () => void;
  showCancel: boolean;
}> = ({ progress, onCancel, showCancel }) => {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'preparing': return 'Preparando proceso...';
      case 'processing': return 'Procesando renovaciones...';
      case 'completing': return 'Finalizando...';
      case 'done': return 'Proceso completado';
      default: return 'Procesando...';
    }
  };

  return (
    <div className="bg-white border-l-4 border-blue-500 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-3">
            <Zap size={20} className="text-blue-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Proceso de Renovación en Curso
            </h3>
            <p className="text-sm text-gray-600">
              {getStageText(progress.stage)}
            </p>
          </div>
        </div>
        
        {showCancel && (
          <button
            onClick={onCancel}
            className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            <X size={16} className="mr-1" />
            Cancelar
          </button>
        )}
      </div>

      {/* Barra de progreso principal */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progreso: {progress.current} de {progress.total}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(percentage)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
            style={{ width: `${percentage}%` }}
          >
            {/* Animación de brillo */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 transform -skew-x-12 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Información detallada */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center">
          <Activity size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Procesando:</span>
            <p className="font-medium text-gray-900 truncate">
              {progress.currentItem || 'Preparando...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Timer size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Tiempo estimado:</span>
            <p className="font-medium text-gray-900">
              {formatTime(progress.estimatedTimeRemaining)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Clock size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Estado:</span>
            <p className="font-medium text-blue-600">
              {getStageText(progress.stage)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para la tabla de renovaciones (igual que antes)
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

// Componente para el historial de procesos (igual que antes)
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

// 🔧 COMPONENTE PRINCIPAL MEJORADO
const AutoRenewalDashboard: React.FC = () => {
  const { gymData } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'expired' | 'history'>('upcoming');
  const [upcomingRenewals, setUpcomingRenewals] = useState<MembershipAssignment[]>([]);
  const [expiredRenewals, setExpiredRenewals] = useState<MembershipAssignment[]>([]);
  const [processHistory, setProcessHistory] = useState<ProcessResult[]>([]);
  const [stats, setStats] = useState<AutoRenewalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // 🆕 NUEVO: Estados para loading con progreso
  const [loadingProgress, setLoadingProgress] = useState<{
    current: number;
    total: number;
    currentTask: string;
  }>({ current: 0, total: 5, currentTask: 'Inicializando...' });
  const [processing, setProcessing] = useState<boolean>(false);
  const [processingIndividual, setProcessingIndividual] = useState<string | null>(null);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 🆕 NUEVOS ESTADOS para progreso y cancelación
  const [processProgress, setProcessProgress] = useState<ProcessProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState<boolean>(false);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [processStartTime, setProcessStartTime] = useState<Date | null>(null);

  // Refs para control de cancelación
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
    }
  }, [gymData?.id]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadDashboardData = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // 🆕 NUEVO: Progreso de carga paso a paso
      const updateLoadingProgress = (current: number, task: string) => {
        setLoadingProgress({ current, total: 5, currentTask: task });
      };
      
      // Paso 1: Cargar próximas renovaciones
      updateLoadingProgress(1, 'Cargando próximas renovaciones...');
      const upcoming = await getUpcomingAutoRenewals(gymData.id, 14);
      
      // Paso 2: Cargar renovaciones vencidas
      updateLoadingProgress(2, 'Cargando renovaciones vencidas...');
      const expired = await getExpiredAutoRenewals(gymData.id);
      
      // Paso 3: Cargar estadísticas
      updateLoadingProgress(3, 'Calculando estadísticas...');
      const statistics = await getMembershipExpirationStats(gymData.id);
      
      // Paso 4: Cargar historial
      updateLoadingProgress(4, 'Cargando historial de procesos...');
      const savedHistory = localStorage.getItem(`renewalHistory_${gymData.id}`);
      let historyData = [];
      if (savedHistory) {
        historyData = JSON.parse(savedHistory);
      }
      
      // Paso 5: Finalizar
      updateLoadingProgress(5, 'Finalizando carga...');
      
      // Establecer todos los datos
      setUpcomingRenewals(upcoming);
      setExpiredRenewals(expired);
      setStats(statistics);
      setProcessHistory(historyData);
      
      // Pequeño delay para mostrar "Finalizando carga..."
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err: any) {
      console.error('Error cargando dashboard:', err);
      setError(err.message || 'Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 NUEVA FUNCIÓN: Actualizar progreso
  const updateProgress = (current: number, total: number, currentItem: string, stage: 'preparing' | 'processing' | 'completing' | 'done') => {
    if (cancelRequested) return;
    
    const elapsed = (Date.now() - (processStartTime?.getTime() || Date.now())) / 1000;
    const itemsPerSecond = current / Math.max(elapsed, 1);
    const remainingItems = Math.max(0, total - current);
    const estimatedTimeRemaining = remainingItems / Math.max(itemsPerSecond, 0.1);
    
    setProcessProgress({
      current,
      total,
      stage,
      currentItem,
      estimatedTimeRemaining
    });
  };

  // 🆕 NUEVA FUNCIÓN: Cancelar proceso
  const cancelProcess = () => {
    setCancelRequested(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setProcessing(false);
    setShowProgress(false);
    setProcessProgress(null);
    setError('Proceso cancelado por el usuario');
  };

  // 🔄 FUNCIÓN COMPLETAMENTE NUEVA: Procesar renovaciones con progreso REAL
  const processAllRenewalsWithProgress = async () => {
    if (!gymData?.id || expiredRenewals.length === 0) return;
    
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      setShowProgress(true);
      setProcessStartTime(new Date());
      setCancelRequested(false);
      
      // Crear AbortController para cancelación
      abortControllerRef.current = new AbortController();
      
      console.log('🚀 Iniciando proceso paso a paso de renovaciones...');
      
      const totalItems = expiredRenewals.length;
      let processedCount = 0;
      const renewedMemberships: MembershipAssignment[] = [];
      const processedExpired: MembershipAssignment[] = [];
      const errors: string[] = [];
      
      // Fase 1: Preparación
      updateProgress(0, totalItems, 'Inicializando proceso...', 'preparing');
      
      // Pequeño delay para mostrar la preparación
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (cancelRequested) {
        throw new Error('Proceso cancelado');
      }
      
      // Fase 2: Procesar cada membresía individualmente
      for (const membership of expiredRenewals) {
        if (cancelRequested) {
          throw new Error('Proceso cancelado');
        }
        
        try {
          processedCount++;
          updateProgress(
            processedCount, 
            totalItems, 
            `${membership.memberName} - ${membership.activityName}`, 
            'processing'
          );
          
          // Llamar al servicio de renovación individual
          if (membership.id && membership.memberId) {
            await renewSingleMembership(gymData.id, membership.memberId, membership.id);
            renewedMemberships.push(membership);
            console.log(`✅ Renovada: ${membership.memberName} - ${membership.activityName}`);
          } else {
            throw new Error('Datos de membresía incompletos');
          }
          
          // Delay pequeño para simular procesamiento real y mostrar progreso
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (err: any) {
          console.error(`❌ Error renovando ${membership.memberName}:`, err);
          errors.push(`${membership.memberName}: ${err.message}`);
          processedExpired.push(membership);
        }
      }
      
      // Verificar cancelación antes de finalizar
      if (cancelRequested) {
        throw new Error('Proceso cancelado');
      }
      
      // Fase 3: Finalizando
      updateProgress(totalItems, totalItems, 'Finalizando proceso...', 'completing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fase 4: Completado
      updateProgress(totalItems, totalItems, 'Proceso completado', 'done');
      
      // Crear resultado
      const result: ProcessResult = {
        success: true,
        renewedMemberships,
        expiredMemberships: processedExpired,
        errors
      };
      
      const renewedCount = renewedMemberships.length;
      const expiredCount = processedExpired.length;
      
      setSuccess(`Proceso completado exitosamente:
      • ${renewedCount} membresías renovadas automáticamente
      • ${expiredCount} membresías expiradas
      ${errors.length > 0 ? `• ${errors.length} errores encontrados` : ''}`);
      
      setLastProcessed(new Date());
      
      // Guardar en historial
      const newHistoryEntry = {
        ...result,
        timestamp: new Date()
      } as any;
      
      const updatedHistory = [newHistoryEntry, ...processHistory].slice(0, 10);
      setProcessHistory(updatedHistory);
      localStorage.setItem(`renewalHistory_${gymData.id}`, JSON.stringify(updatedHistory));
      
      // Recargar datos
      await loadDashboardData();
      
      // Ocultar progreso después de 2 segundos
      setTimeout(() => {
        setShowProgress(false);
        setProcessProgress(null);
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ Error procesando renovaciones:', err);
      if (err.message === 'Proceso cancelado') {
        setError('Proceso cancelado por el usuario');
      } else {
        setError(err.message || 'Error procesando renovaciones');
      }
      setShowProgress(false);
      setProcessProgress(null);
    } finally {
      setProcessing(false);
      setCancelRequested(false);
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
    const loadingPercentage = (loadingProgress.current / loadingProgress.total) * 100;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            {/* Icono y título */}
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cargando Dashboard de Renovaciones
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              {loadingProgress.currentTask}
            </p>
            
            {/* Barra de progreso */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Paso {loadingProgress.current} de {loadingProgress.total}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(loadingPercentage)}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${loadingPercentage}%` }}
                >
                  {/* Animación de brillo */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 transform -skew-x-12 animate-pulse"></div>
                </div>
              </div>
            </div>
            
            {/* Pasos del proceso */}
            <div className="space-y-2 text-xs text-gray-500">
              <div className={`flex items-center ${loadingProgress.current >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
                {loadingProgress.current >= 1 ? (
                  <CheckCircle size={12} className="mr-2" />
                ) : (
                  <div className="w-3 h-3 border border-gray-300 rounded-full mr-2"></div>
                )}
                Próximas renovaciones
              </div>
              
              <div className={`flex items-center ${loadingProgress.current >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
                {loadingProgress.current >= 2 ? (
                  <CheckCircle size={12} className="mr-2" />
                ) : (
                  <div className="w-3 h-3 border border-gray-300 rounded-full mr-2"></div>
                )}
                Renovaciones vencidas
              </div>
              
              <div className={`flex items-center ${loadingProgress.current >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
                {loadingProgress.current >= 3 ? (
                  <CheckCircle size={12} className="mr-2" />
                ) : (
                  <div className="w-3 h-3 border border-gray-300 rounded-full mr-2"></div>
                )}
                Estadísticas del sistema
              </div>
              
              <div className={`flex items-center ${loadingProgress.current >= 4 ? 'text-green-600' : 'text-gray-400'}`}>
                {loadingProgress.current >= 4 ? (
                  <CheckCircle size={12} className="mr-2" />
                ) : (
                  <div className="w-3 h-3 border border-gray-300 rounded-full mr-2"></div>
                )}
                Historial de procesos
              </div>
              
              <div className={`flex items-center ${loadingProgress.current >= 5 ? 'text-green-600' : 'text-gray-400'}`}>
                {loadingProgress.current >= 5 ? (
                  <CheckCircle size={12} className="mr-2" />
                ) : (
                  <div className="w-3 h-3 border border-gray-300 rounded-full mr-2"></div>
                )}
                Finalizando carga
              </div>
            </div>
            
            {/* Información adicional */}
            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                💡 Con muchos socios, este proceso puede tardar unos segundos
              </p>
            </div>
          </div>
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
            disabled={loading || processing}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
          <button
            onClick={processAllRenewalsWithProgress}
            disabled={processing || expiredRenewals.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Play size={16} className={`mr-2 ${processing ? 'animate-pulse' : ''}`} />
            {processing ? 'Procesando...' : `Procesar ${expiredRenewals.length} Renovaciones`}
          </button>
        </div>
      </div>

      {/* 🆕 NUEVA SECCIÓN: Barra de progreso REAL */}
      {showProgress && processProgress && (
        <ProgressBar
          progress={processProgress}
          onCancel={cancelProcess}
          showCancel={processing && !cancelRequested}
        />
      )}

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

      {/* 🆕 NUEVA SECCIÓN: Info de último proceso */}
      {lastProcessed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="text-blue-600 mr-3" size={20} />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Último proceso ejecutado
              </p>
              <p className="text-sm text-blue-600">
                {lastProcessed.toLocaleString('es-AR')} • 
                {processStartTime && (
                  <span className="ml-1">
                    Duración: {Math.round((lastProcessed.getTime() - processStartTime.getTime()) / 1000)}s
                  </span>
                )}
              </p>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Próximas Renovaciones Automáticas
                </h3>
                {upcomingRenewals.length > 0 && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar size={16} className="mr-1" />
                    Próximos 14 días
                  </div>
                )}
              </div>
              
              {upcomingRenewals.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay renovaciones próximas</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se encontraron membresías con renovación automática que venzan pronto.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="text-green-600 mr-2" size={20} />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Renovaciones programadas
                        </p>
                        <p className="text-sm text-green-600">
                          Estas membresías se renovarán automáticamente cuando venzan
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <RenewalTable 
                    memberships={upcomingRenewals}
                    onRenewIndividual={renewIndividualMembership}
                    processingIndividual={processingIndividual}
                    showRenewButton={false}
                  />
                </div>
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
                  <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-500">
                      {expiredRenewals.length} membresías pendientes
                    </div>
                    <button
                      onClick={processAllRenewalsWithProgress}
                      disabled={processing}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing ? (
                        <RefreshCw size={16} className="animate-spin mr-2" />
                      ) : (
                        <Zap size={16} className="mr-2" />
                      )}
                      {processing ? 'Procesando...' : `Renovar Todas (${expiredRenewals.length})`}
                    </button>
                  </div>
                )}
              </div>
              
              {expiredRenewals.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Todas las renovaciones al día</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No hay membresías vencidas pendientes de renovación automática.
                  </p>
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                      🎉 ¡Excelente! Todas las membresías con renovación automática están al día.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="text-red-600 mr-2" size={20} />
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          Atención requerida
                        </p>
                        <p className="text-sm text-red-600">
                          Estas membresías están vencidas y requieren renovación automática
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <RenewalTable 
                    memberships={expiredRenewals}
                    onRenewIndividual={renewIndividualMembership}
                    processingIndividual={processingIndividual}
                    showRenewButton={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Pestaña: Historial */}
          {activeTab === 'history' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Historial de Procesos de Renovación
                </h3>
                {processHistory.length > 0 && (
                  <div className="text-sm text-gray-500">
                    Últimos {processHistory.length} procesos
                  </div>
                )}
              </div>
              
              {processHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin historial</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se han ejecutado procesos de renovación aún.
                  </p>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      💡 El historial aparecerá aquí después de ejecutar el primer proceso de renovación.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {processHistory.map((process, index) => (
                    <ProcessHistoryCard key={index} process={process} />
                  ))}
                  
                  {/* Información adicional del historial */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <History className="text-gray-400 mr-2" size={16} />
                        <span className="text-sm text-gray-600">
                          Se mantienen los últimos 10 procesos
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (gymData?.id) {
                            localStorage.removeItem(`renewalHistory_${gymData.id}`);
                            setProcessHistory([]);
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Limpiar historial
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🆕 NUEVA SECCIÓN: Consejos y recomendaciones */}
      {!processing && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="bg-blue-100 p-2 rounded-full mr-4">
              <Settings className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Consejos para Renovaciones Automáticas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">📅 Frecuencia recomendada</h4>
                  <p>Ejecuta el proceso diariamente para mantener todas las renovaciones al día.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">⚡ Proceso masivo</h4>
                  <p>Usa el botón "Procesar Todas" para renovar múltiples membresías de una vez.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">🔍 Monitoreo</h4>
                  <p>Revisa regularmente la pestaña "Próximas" para planificar renovaciones.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">📊 Historial</h4>
                  <p>Consulta el historial para revisar procesos anteriores y detectar patrones.</p>
                </div>
              </div>
              
              {expiredRenewals.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Nota:</strong> Tienes {expiredRenewals.length} membresías vencidas pendientes. 
                    El proceso con barra de progreso te permite ver exactamente qué se está renovando en tiempo real.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoRenewalDashboard;