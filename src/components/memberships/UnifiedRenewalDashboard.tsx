// src/components/memberships/UnifiedRenewalDashboard.tsx
// 🎯 DASHBOARD COMPLETAMENTE NUEVO - REEMPLAZA TODOS LOS ANTERIORES
// Este componente centraliza TODA la gestión de renovaciones - VERSIÓN COMPLETA

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Users,
  DollarSign,
  Download,
  Play,
  Pause,
  Eye,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  X,
  Settings,
  History,
  Activity
} from 'lucide-react';

import { 
  membershipRenewalService,
  MembershipToRenew,
  RenewalResult,
  RenewalStats
} from '../../services/membershipRenewalService';

import useAuth from '../../hooks/useAuth';
import { formatCurrency, formatDisplayDate } from '../../utils/format.utils';
import MonthlyReportGenerator from './MonthlyReportGenerator';



// ==========================================
// INTERFACES
// ==========================================

interface ProcessProgress {
  current: number;
  total: number;
  currentItem: string;
  isActive: boolean;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const UnifiedRenewalDashboard: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState<'overview' | 'expired' | 'manage' | 'reports'>('overview');
  const [stats, setStats] = useState<RenewalStats | null>(null);
  const [membershipsToRenew, setMembershipsToRenew] = useState<MembershipToRenew[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  
  // Estados de proceso
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<ProcessProgress>({
    current: 0,
    total: 0,
    currentItem: '',
    isActive: false
  });
  
  // Estados de UI
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lastProcessResult, setLastProcessResult] = useState<RenewalResult | null>(null);

  // ==========================================
  // EFECTOS
  // ==========================================

  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
    }
  }, [gymData?.id]);

  // Auto-limpiar mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ==========================================
  // FUNCIONES PRINCIPALES
  // ==========================================

  /**
   * 📊 Cargar todos los datos del dashboard
   */
  const loadDashboardData = async () => {
    if (!gymData?.id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('📊 Cargando datos del dashboard...');
      
      // Cargar stats y membresías en paralelo
      const [statsData, membershipsData] = await Promise.all([
        membershipRenewalService.getRenewalStats(gymData.id),
        membershipRenewalService.getMembershipsNeedingRenewal(gymData.id)
      ]);
      
      setStats(statsData);
      setMembershipsToRenew(membershipsData);
      
      console.log('✅ Datos cargados exitosamente');
      
    } catch (err: any) {
      console.error('❌ Error cargando dashboard:', err);
      setError(`Error cargando datos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🚀 Procesar todas las renovaciones automáticas
   */
  const processAllRenewals = async () => {
    if (!gymData?.id || isProcessing) return;
    
    setIsProcessing(true);
    setError('');
    setSuccess('');
    setProcessProgress({ current: 0, total: 0, currentItem: '', isActive: true });
    
    try {
      console.log('🚀 Iniciando proceso masivo de renovaciones...');
      
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
      
      setLastProcessResult(result);
      
      if (result.renewedCount > 0) {
        setSuccess(
          `🎉 Proceso completado exitosamente!\n` +
          `• ${result.renewedCount} membresías renovadas\n` +
          `• ${result.errorCount} errores\n` +
          `• Total procesadas: ${result.totalProcessed}`
        );
      } else {
        setSuccess('ℹ️ No había membresías pendientes de renovación');
      }
      
      // Recargar datos
      await loadDashboardData();
      
    } catch (err: any) {
      console.error('❌ Error en proceso masivo:', err);
      setError(`Error procesando renovaciones: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessProgress(prev => ({ ...prev, isActive: false }));
    }
  };

  /**
   * 🔄 Renovar membresía individual
   */
  const renewIndividualMembership = async (membership: MembershipToRenew) => {
    if (!gymData?.id) return;
    
    try {
      const result = await membershipRenewalService.renewSingleMembership(gymData.id, membership);
      
      if (result.success) {
        setSuccess(`✅ Membresía de ${membership.memberName} renovada exitosamente`);
        // Recargar datos
        await loadDashboardData();
      } else {
        setError(`❌ Error renovando membresía: ${result.error}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error renovación individual:', err);
      setError(`Error: ${err.message}`);
    }
  };

  /**
   * 📥 Generar reporte Excel
   */
  const generateExcelReport = async () => {
    // Esta función la implementaremos en el componente MonthlyReportGenerator
    console.log('📥 Generando reporte Excel...');
    setSuccess('📥 Función de Excel disponible en la pestaña "Reportes"');
  };

  // ==========================================
  // COMPONENTES DE UI
  // ==========================================

  /**
   * 🎨 Componente de progreso
   */
  const ProgressIndicator: React.FC<{ progress: ProcessProgress }> = ({ progress }) => {
    if (!progress.isActive) return null;
    
    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Procesando Renovaciones</h3>
            <span className="text-sm text-gray-500">{percentage}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            Procesando {progress.current} de {progress.total}
          </div>
          
          <div className="text-xs text-gray-500 truncate">
            {progress.currentItem}
          </div>
        </div>
      </div>
    );
  };

  /**
   * 🎨 Tarjetas de estadísticas
   */
  const StatsCards: React.FC<{ stats: RenewalStats }> = ({ stats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Membresías Totales
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
              <RefreshCw className="h-8 w-8 text-green-400" />
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
              <AlertTriangle className="h-8 w-8 text-red-400" />
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
              <TrendingUp className="h-8 w-8 text-blue-400" />
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
  );

  /**
   * 🎨 Tabla de membresías vencidas
   */
  const ExpiredMembershipsTable: React.FC<{ memberships: MembershipToRenew[] }> = ({ memberships }) => {
    if (memberships.length === 0) {
      return (
        <div className="text-center py-12">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            ¡Excelente! Todas las renovaciones están al día
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            No hay membresías vencidas pendientes de renovación automática.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="bg-red-50 px-4 py-3 border-b border-red-200">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-800">
              {memberships.length} membresías requieren renovación automática
            </h3>
          </div>
        </div>
        
        <ul className="divide-y divide-gray-200">
          {memberships.map((membership) => (
            <li key={`${membership.memberId}-${membership.id}`} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900">
                        {membership.memberName}
                      </p>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Vencida
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4" />
                      <p>
                        {membership.activityName} • Venció: {formatDisplayDate(membership.endDate)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center text-sm text-gray-900">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatCurrency(membership.currentCost)}
                  </div>
                  
                  <button
                    onClick={() => renewIndividualMembership(membership)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Renovar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  /**
   * 🎨 Componente de gestión individual
   */
  const IndividualManagementView: React.FC = () => (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="text-center py-12">
        <Settings className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Gestión Individual por Usuario
        </h3>
        <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
          Esta funcionalidad permitirá ver y gestionar las membresías de cada usuario individualmente, 
          configurar auto-renovación, ver historial de pagos y más.
        </p>
        <div className="mt-6">
          <div className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white">
            <Clock className="h-4 w-4 mr-2" />
            Próximamente disponible
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * 🎨 Vista de reportes ACTUALIZADA
   */
  const ReportsView: React.FC = () => (
    <div className="space-y-6">
      {/* Generador de reportes Excel */}
      <MonthlyReportGenerator 
        onReportGenerated={() => {
          setSuccess('📊 Reporte generado exitosamente');
        }}
      />
      
      {/* Mostrar últimos resultados si existen */}
      {lastProcessResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Resumen del Último Proceso de Renovación
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {lastProcessResult.renewedCount}
              </div>
              <div className="text-sm text-green-800">Renovaciones Exitosas</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {lastProcessResult.errorCount}
              </div>
              <div className="text-sm text-red-800">Errores Encontrados</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {lastProcessResult.totalProcessed}
              </div>
              <div className="text-sm text-blue-800">Total Procesadas</div>
            </div>
          </div>
          
          {lastProcessResult.errorMemberships.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Errores Detallados:
              </h4>
              <div className="bg-red-50 rounded-lg p-3">
                {lastProcessResult.errorMemberships.slice(0, 5).map((errorItem: any, index: number) => (
                  <div key={index} className="text-xs text-red-700 mb-1">
                    • {errorItem.membership.memberName} - {errorItem.membership.activityName}: {errorItem.error}
                  </div>
                ))}
                {lastProcessResult.errorMemberships.length > 5 && (
                  <div className="text-xs text-red-600 italic">
                    ... y {lastProcessResult.errorMemberships.length - 5} errores más
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Cargando datos de renovaciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Renovaciones Automáticas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sistema centralizado para gestionar todas las renovaciones de membresías
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          
          <button
            onClick={generateExcelReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 whitespace-pre-line">
                {success}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setSuccess('')}
                  className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                {error}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setError('')}
                  className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      {stats && <StatsCards stats={stats} />}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Resumen', icon: Eye },
            { key: 'expired', label: 'Vencidas', icon: AlertTriangle, count: membershipsToRenew.length },
            { key: 'manage', label: 'Gestionar', icon: Users },
            { key: 'reports', label: 'Reportes', icon: FileSpreadsheet }
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        
        {/* PESTAÑA: Resumen */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Estado Actual del Sistema
              </h3>
              
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Membresías totales:</span>
                      <span className="font-medium">{stats.totalMemberships}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Con auto-renovación:</span>
                      <span className="font-medium text-green-600">{stats.withAutoRenewal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Vencidas:</span>
                      <span className="font-medium text-red-600">{stats.expired}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Vencen pronto:</span>
                      <span className="font-medium text-yellow-600">{stats.expiringSoon}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Renovadas este mes:</span>
                      <span className="font-medium text-blue-600">{stats.renewedThisMonth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tasa de renovación:</span>
                      <span className="font-medium">
                        {stats.withAutoRenewal > 0 
                          ? Math.round((stats.withAutoRenewal / stats.totalMemberships) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {membershipsToRenew.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-md font-medium text-red-900">
                        Acción Requerida
                      </h4>
                      <p className="text-sm text-red-600">
                        {membershipsToRenew.length} membresías requieren renovación inmediata
                      </p>
                    </div>
                    
                    <button
                      onClick={processAllRenewals}
                      disabled={isProcessing}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      {isProcessing ? 'Procesando...' : `Procesar ${membershipsToRenew.length} Renovaciones`}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Sistema de automatización */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Activity className="h-6 w-6 text-blue-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Estado de la Automatización
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">🤖 Sistema Automático</h4>
                  <p className="text-sm text-blue-700">
                    El sistema verifica y procesa renovaciones automáticamente los primeros 3 días de cada mes.
                    Las membresías con auto-renovación habilitada se renuevan sin intervención manual.
                  </p>
                  <div className="mt-3 flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-blue-600 mr-1" />
                    <span className="text-blue-800">Sistema activo y funcionando</span>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">💰 Precios Inteligentes</h4>
                  <p className="text-sm text-green-700">
                    Las renovaciones automáticas consultan el precio actual de cada actividad.
                    Los aumentos de precios se aplican automáticamente sin intervención manual.
                  </p>
                  <div className="mt-3 flex items-center text-sm">
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-green-800">Actualización automática de precios</span>
                  </div>
                </div>
              </div>
            </div>
            
            {lastProcessResult && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Último Proceso Ejecutado
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {lastProcessResult.renewedCount}
                    </div>
                    <div className="text-sm text-green-800">Renovadas</div>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {lastProcessResult.errorCount}
                    </div>
                    <div className="text-sm text-red-800">Errores</div>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {lastProcessResult.totalProcessed}
                    </div>
                    <div className="text-sm text-blue-800">Total</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: Vencidas */}
        {activeTab === 'expired' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Membresías Vencidas con Auto-renovación
              </h3>
              
              {membershipsToRenew.length > 0 && (
                <button
                  onClick={processAllRenewals}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
            
            {/* Información adicional sobre membresías vencidas */}
            {membershipsToRenew.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Información sobre las renovaciones
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Las membresías mostradas tienen auto-renovación habilitada</li>
                        <li>Se aplicarán los precios actuales de cada actividad</li>
                        <li>Se crearán nuevas membresías válidas por 30 días</li>
                        <li>Se generarán transacciones pendientes de pago</li>
                        <li>Las membresías anteriores se marcarán como expiradas</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <ExpiredMembershipsTable memberships={membershipsToRenew} />
          </div>
        )}

        {/* PESTAÑA: Gestionar */}
        {activeTab === 'manage' && (
          <IndividualManagementView />
        )}

        {/* PESTAÑA: Reportes */}
        {activeTab === 'reports' && (
          <ReportsView />
        )}
      </div>

      {/* Indicador de progreso modal */}
      <ProgressIndicator progress={processProgress} />
    </div>
  );
};

export default UnifiedRenewalDashboard;