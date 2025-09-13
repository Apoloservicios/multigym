// PÁGINA PRINCIPAL DE GESTIÓN DE MEMBRESÍAS - ACTUALIZADA
import React from 'react';
import { CreditCard, Activity, CheckCircle } from 'lucide-react';
import UnifiedRenewalDashboard from '../components/memberships/UnifiedRenewalDashboard';
import { useMonthlyRenewalAutomation } from '../hooks/useMonthlyRenewalAutomation';

const MembershipManagement: React.FC = () => {
  // Hook de automatización mensual
  const { automationState, forceRun } = useMonthlyRenewalAutomation();

  return (
    <div className="p-6">
      {/* Header con información del sistema */}
      <div className="mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestión de Membresías
                </h1>
                <p className="text-sm text-gray-500">
                  Sistema automatizado de renovaciones y control de pagos
                </p>
              </div>
            </div>
            
            {/* Indicador de automatización */}
            <div className="flex items-center space-x-6">
              {/* Estado del sistema */}
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Sistema Automático
                </div>
                <div className={`flex items-center justify-end mt-1 ${
                  automationState.isEnabled ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {automationState.isEnabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Activo</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium">Desactivado</span>
                  )}
                </div>
              </div>

              {/* Próxima ejecución */}
              {automationState.nextRun && (
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Próxima Ejecución
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-1">
                    {new Date(automationState.nextRun).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              )}

              {/* Estado de ejecución */}
              {automationState.isRunning && (
                <div className="flex items-center text-blue-600">
                  <Activity className="h-4 w-4 animate-pulse mr-2" />
                  <span className="text-sm font-medium">Procesando...</span>
                </div>
              )}
            </div>
          </div>

          {/* Barra de estado del sistema */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                {automationState.lastRun && (
                  <div className="flex items-center text-gray-600">
                    <span className="text-xs uppercase tracking-wide mr-2">Última ejecución:</span>
                    <span className="font-medium">
                      {new Date(automationState.lastRun).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                )}
                
                {automationState.error && (
                  <div className="flex items-center text-red-600">
                    <span className="text-xs">Error: {automationState.error}</span>
                  </div>
                )}
              </div>

              {/* Botón de ejecución manual */}
              {!automationState.isRunning && (
                <button
                  onClick={forceRun}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Ejecutar Ahora
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard principal */}
      <UnifiedRenewalDashboard />
    </div>
  );
};

export default MembershipManagement;