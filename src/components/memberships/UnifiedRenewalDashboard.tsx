// src/components/memberships/UnifiedRenewalDashboard.tsx
// 📊 DASHBOARD PRINCIPAL UNIFICADO - SOLUCIÓN COMPLETA

import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
  Filter,
  Search,
  Download,
  Settings
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

import MembershipService from '../../services/membershipService';
import { MembershipAssignment } from '../../types/gym.types';
import IndividualMembershipManagement from './IndividualMembershipManagement';
interface MembershipStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  withAutoRenewal: number;
}

interface ExpiredMembershipWithDetails extends MembershipAssignment {
  daysExpired: number;
  totalDebt: number;
}

const UnifiedRenewalDashboard: React.FC = () => {
  const { gymData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'expired' | 'manage' | 'reports'>('overview');
  
  // Estados para estadísticas
  const [stats, setStats] = useState<MembershipStats>({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0,
    withAutoRenewal: 0
  });
  
  // Estados para membresías vencidas (SOLUCIÓN AL PROBLEMA)
  const [expiredMemberships, setExpiredMemberships] = useState<ExpiredMembershipWithDetails[]>([]);
  const [loadingExpired, setLoadingExpired] = useState<boolean>(false);
  const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [renewalInProgress, setRenewalInProgress] = useState<string[]>([]);

  // 🔄 Cargar estadísticas principales
  const loadStats = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      const membershipStats = await MembershipService.getMembershipStats(gymData.id);
      setStats(membershipStats);
      
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
      setError('Error al cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 SOLUCIÓN: Cargar membresías vencidas
  const loadExpiredMemberships = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoadingExpired(true);
      const expired = await MembershipService.getExpiredMemberships(gymData.id);
      
      // Agregar información adicional
      const expiredWithDetails: ExpiredMembershipWithDetails[] = expired.map(membership => {
        const today = new Date();
        const endDate = new Date(membership.endDate);
        const daysExpired = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...membership,
          daysExpired: Math.max(0, daysExpired),
          totalDebt: membership.cost * Math.ceil(daysExpired / 30) // Aproximación de deuda
        };
      });
      
      setExpiredMemberships(expiredWithDetails);
      console.log(`✅ Cargadas ${expiredWithDetails.length} membresías vencidas`);
      
    } catch (err) {
      console.error('Error cargando membresías vencidas:', err);
      setError('Error al cargar las membresías vencidas');
    } finally {
      setLoadingExpired(false);
    }
  };

  // 🔄 Renovar membresía individual
  const handleRenewMembership = async (membershipId: string, months: number = 1) => {
    if (!gymData?.id) return;
    
    setRenewalInProgress(prev => [...prev, membershipId]);
    setError('');
    setSuccess('');
    
    try {
      const result = await MembershipService.renewExpiredMembership(
        gymData.id,
        membershipId,
        months
      );
      
      if (result.success) {
        setSuccess(`Membresía renovada exitosamente por ${months} mes(es)`);
        // Recargar datos
        await Promise.all([loadStats(), loadExpiredMemberships()]);
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Error al renovar la membresía');
      }
      
    } catch (err) {
      console.error('Error renovando membresía:', err);
      setError('Error inesperado al renovar la membresía');
    } finally {
      setRenewalInProgress(prev => prev.filter(id => id !== membershipId));
    }
  };

  // 🔄 Renovación masiva
  const handleMassiveRenewal = async () => {
    if (!gymData?.id || selectedMemberships.length === 0) return;
    
    setError('');
    setSuccess('');
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Renovar cada membresía seleccionada
      for (const membershipId of selectedMemberships) {
        try {
          const result = await MembershipService.renewExpiredMembership(
            gymData.id,
            membershipId,
            1 // 1 mes por defecto
          );
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          
        } catch (err) {
          errorCount++;
        }
      }
      
      // Mostrar resultado
      if (successCount > 0) {
        setSuccess(`${successCount} membresías renovadas exitosamente`);
      }
      if (errorCount > 0) {
        setError(`${errorCount} membresías no pudieron renovarse`);
      }
      
      // Limpiar selección y recargar datos
      setSelectedMemberships([]);
      await Promise.all([loadStats(), loadExpiredMemberships()]);
      
    } catch (err) {
      console.error('Error en renovación masiva:', err);
      setError('Error en la renovación masiva');
    }
  };

  // 🔄 Toggle selección de membresía
  const toggleMembershipSelection = (membershipId: string) => {
    setSelectedMemberships(prev => 
      prev.includes(membershipId)
        ? prev.filter(id => id !== membershipId)
        : [...prev, membershipId]
    );
  };

  // 🔄 Seleccionar todas las membresías vencidas
  const toggleSelectAll = () => {
    if (selectedMemberships.length === expiredMemberships.length) {
      setSelectedMemberships([]);
    } else {
      setSelectedMemberships(expiredMemberships.map(m => m.id));
    }
  };

  // 📊 Filtrar membresías vencidas por búsqueda
  const filteredExpiredMemberships = expiredMemberships.filter(membership =>
    membership.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    membership.activityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔄 Efectos
  useEffect(() => {
    if (gymData?.id) {
      loadStats();
      if (activeTab === 'expired') {
        loadExpiredMemberships();
      }
    }
  }, [gymData?.id, activeTab]);

  // 🎨 Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  // 🎨 Obtener color para días vencidos
  const getDaysExpiredColor = (days: number) => {
    if (days <= 7) return 'text-yellow-600 bg-yellow-50';
    if (days <= 30) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span>Cargando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Renovaciones</h1>
          <p className="text-gray-600">Dashboard unificado para el control de membresías</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadStats();
              if (activeTab === 'expired') loadExpiredMemberships();
            }}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw size={16} className="mr-1" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <AlertTriangle size={16} className="mr-2" />
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <CheckCircle size={16} className="mr-2" />
            {success}
          </div>
        </div>
      )}

      {/* Pestañas de navegación */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Resumen', icon: TrendingUp },
            { key: 'expired', label: 'Vencidas', icon: AlertTriangle, badge: stats.expired },
            { key: 'manage', label: 'Gestionar', icon: Users },
            { key: 'reports', label: 'Reportes', icon: Download }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} className="mr-2" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido según pestaña activa */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Estadísticas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Users className="text-blue-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Membresías</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Activas</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <AlertTriangle className="text-red-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Vencidas</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.expired}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Clock className="text-yellow-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Por Vencer</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.expiringSoon}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <RefreshCw className="text-purple-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Auto-renovación</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.withAutoRenewal}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas rápidas */}
          {stats.expired > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="text-red-600 mr-3" size={20} />
                  <div>
                    <h3 className="text-lg font-medium text-red-800">
                      {stats.expired} membresías vencidas requieren atención
                    </h3>
                    <p className="text-red-600">
                      Haz clic en la pestaña "Vencidas" para gestionarlas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('expired')}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Ver Vencidas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🆕 PESTAÑA VENCIDAS - SOLUCIÓN AL PROBLEMA PRINCIPAL */}
      {activeTab === 'expired' && (
        <div className="space-y-6">
          {/* Header de vencidas */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Membresías Vencidas ({expiredMemberships.length})
              </h2>
              <p className="text-gray-600">Gestiona las renovaciones pendientes</p>
            </div>
            
            {selectedMemberships.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedMemberships.length} seleccionadas
                </span>
                <button
                  onClick={handleMassiveRenewal}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Renovar Seleccionadas
                </button>
              </div>
            )}
          </div>

          {/* Buscador */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre del socio o actividad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={loadExpiredMemberships}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw size={16} className={`mr-1 ${loadingExpired ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {loadingExpired ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span>Cargando membresías vencidas...</span>
            </div>
          ) : (
            <>
              {filteredExpiredMemberships.length === 0 ? (
                <div className="text-center p-8">
                  <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    ¡Excelente! No hay membresías vencidas
                  </h3>
                  <p className="text-gray-600">
                    Todas las membresías están al día
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Header de tabla */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedMemberships.length === expiredMemberships.length}
                        onChange={toggleSelectAll}
                        className="mr-3"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Seleccionar todas ({expiredMemberships.length})
                      </span>
                    </div>
                  </div>

                  {/* Lista de membresías vencidas */}
                  <div className="divide-y divide-gray-200">
                    {filteredExpiredMemberships.map(membership => (
                      <div key={membership.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedMemberships.includes(membership.id)}
                              onChange={() => toggleMembershipSelection(membership.id)}
                              className="mr-4"
                            />
                            
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">
                                {membership.memberName}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {membership.activityName} • ${membership.cost}/mes
                              </p>
                              <div className="flex items-center mt-2 space-x-4">
                                <span className="text-sm text-gray-500">
                                  Venció: {formatDate(membership.endDate)}
                                </span>
                                <span className={`text-sm px-2 py-1 rounded-full ${getDaysExpiredColor(membership.daysExpired)}`}>
                                  {membership.daysExpired} días vencida
                                </span>
                                {membership.totalDebt > 0 && (
                                  <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                    Deuda: ${membership.totalDebt}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRenewMembership(membership.id, 1)}
                              disabled={renewalInProgress.includes(membership.id)}
                              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                              {renewalInProgress.includes(membership.id) ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                'Renovar 1 Mes'
                              )}
                            </button>
                            <button
                              onClick={() => handleRenewMembership(membership.id, 3)}
                              disabled={renewalInProgress.includes(membership.id)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              Renovar 3 Meses
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Placeholder para otras pestañas */}
          {/* Pestaña GESTIONAR - Usar componente existente */}
      {activeTab === 'manage' && (
        <IndividualMembershipManagement />
      )}

      

      {activeTab === 'reports' && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <Download className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Reportes Excel</h3>
          <p className="text-gray-600">Aquí irán las opciones de exportación</p>
        </div>
      )}
    </div>
  );
};

export default UnifiedRenewalDashboard;