// src/components/dashboard/RenewalManagementCard.tsx
// 🆕 NUEVO: Card para gestionar renovaciones desde el dashboard principal

import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, AlertCircle, CheckCircle, Calendar, Users } from 'lucide-react';
import { processExpiredMemberships, getUpcomingAutoRenewals } from '../../services/membershipExpiration.service';
import useAuth from '../../hooks/useAuth';

interface RenewalCardProps {
  onNavigateToRenewals?: () => void;
}

const RenewalManagementCard: React.FC<RenewalCardProps> = ({ onNavigateToRenewals }) => {
  const { gymData } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Cargar próximas renovaciones al montar el componente
  useEffect(() => {
    if (gymData?.id) {
      loadUpcomingRenewals();
    }
  }, [gymData?.id]);

  const loadUpcomingRenewals = async () => {
    if (!gymData?.id) return;
    
    try {
      const upcoming = await getUpcomingAutoRenewals(gymData.id, 7); // Próximos 7 días
      setUpcomingCount(upcoming.length);
    } catch (err) {
      console.error('Error cargando próximas renovaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const runManualProcess = async () => {
    if (!gymData?.id) return;
    
    try {
      setProcessing(true);
      setError(null);
      
      console.log('🚀 Ejecutando proceso manual de renovaciones...');
      
      const result = await processExpiredMemberships(gymData.id);
      setLastResult(result);
      
      if (result.success) {
        console.log('✅ Proceso completado exitosamente');
        // Recargar el conteo de próximas renovaciones
        await loadUpcomingRenewals();
      } else {
        setError(`Errores encontrados: ${result.errors.join(', ')}`);
      }
      
    } catch (err: any) {
      console.error('❌ Error en proceso manual:', err);
      setError(err.message || 'Error ejecutando el proceso');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <RefreshCw className="text-blue-600 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Renovaciones Automáticas
            </h3>
            <p className="text-sm text-gray-600">
              Gestiona membresías vencidas y renovaciones automáticas
            </p>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center">
            <Calendar className="text-blue-600 mr-2" size={16} />
            <div>
              <p className="text-sm text-blue-600 font-medium">Próximas Renovaciones</p>
              <p className="text-lg font-semibold text-blue-900">
                {loading ? '...' : upcomingCount}
              </p>
            </div>
          </div>
        </div>
        
        {lastResult && (
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-2" size={16} />
              <div>
                <p className="text-sm text-green-600 font-medium">Último Proceso</p>
                <p className="text-lg font-semibold text-green-900">
                  {(lastResult.renewedMemberships?.length || 0) + (lastResult.expiredMemberships?.length || 0)} procesadas
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="text-red-400" size={16} />
            <p className="ml-2 text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {lastResult && lastResult.success && !error && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex">
            <CheckCircle className="text-green-400" size={16} />
            <div className="ml-2 text-sm text-green-800">
              <p>Proceso completado exitosamente:</p>
              <ul className="mt-1 list-disc list-inside">
                <li>{lastResult.renewedMemberships?.length || 0} membresías renovadas automáticamente</li>
                <li>{lastResult.expiredMemberships?.length || 0} membresías expiradas</li>
                {lastResult.errors?.length > 0 && (
                  <li className="text-red-700">{lastResult.errors.length} errores encontrados</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="space-y-3">
        <button
          onClick={runManualProcess}
          disabled={processing}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={16} className={`mr-2 ${processing ? 'animate-pulse' : ''}`} />
          {processing ? 'Procesando...' : 'Ejecutar Proceso Ahora'}
        </button>

        {onNavigateToRenewals && (
          <button
            onClick={onNavigateToRenewals}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Users size={16} className="mr-2" />
            Ver Dashboard Completo
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500 text-center">
        Recomendado ejecutar diariamente para mantener las renovaciones al día
      </p>
    </div>
  );
};

export default RenewalManagementCard;