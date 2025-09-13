// src/components/dashboard/RenewalManagementCard.tsx - CORREGIDO
import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, AlertCircle, CheckCircle, Calendar, Users } from 'lucide-react';
// Cambiado al servicio correcto
import { membershipRenewalService } from '../../services/membershipRenewalService';
import useAuth from '../../hooks/useAuth';

interface RenewalCardProps {
  className?: string;
}

const RenewalManagementCard: React.FC<RenewalCardProps> = ({ className = '' }) => {
  const { gymData } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    expiringSoon: 0,
    withAutoRenewal: 0,
    needsRenewal: 0
  });
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (gymData?.id) {
      loadStats();
    }
  }, [gymData]);

  const loadStats = async () => {
    if (!gymData?.id) return;
    
    try {
      const renewalStats = await membershipRenewalService.getRenewalStats(gymData.id);
      const membershipsNeedingRenewal = await membershipRenewalService.getMembershipsNeedingRenewal(gymData.id);
      
      setStats({
        expiringSoon: renewalStats.expiringSoon,
        withAutoRenewal: renewalStats.withAutoRenewal,
        needsRenewal: membershipsNeedingRenewal.length
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const processRenewals = async () => {
    if (!gymData?.id || isProcessing) return;
    
    setIsProcessing(true);
    setMessage(null);
    
    try {
      const result = await membershipRenewalService.processAllAutoRenewals(gymData.id);
      
      if (result.success) {
        setMessage({
          type: 'success',
          text: `✅ ${result.renewedCount} membresías renovadas exitosamente`
        });
        setLastProcessed(new Date());
        await loadStats();
      } else if (result.totalProcessed === 0) {
        setMessage({
          type: 'info',
          text: 'No hay membresías pendientes de renovación'
        });
      } else {
        setMessage({
          type: 'error',
          text: `Se encontraron ${result.errorCount} errores durante el proceso`
        });
      }
    } catch (error) {
      console.error('Error procesando renovaciones:', error);
      setMessage({
        type: 'error',
        text: 'Error al procesar las renovaciones'
      });
    } finally {
      setIsProcessing(false);
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <RefreshCw className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Renovaciones Automáticas
          </h3>
        </div>
        <button
          onClick={loadStats}
          className="text-gray-400 hover:text-gray-600"
          title="Actualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.needsRenewal}</div>
          <div className="text-xs text-gray-500">Pendientes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.withAutoRenewal}</div>
          <div className="text-xs text-gray-500">Auto-renovación</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
          <div className="text-xs text-gray-500">Por vencer</div>
        </div>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Botón de procesamiento */}
      <button
        onClick={processRenewals}
        disabled={isProcessing || stats.needsRenewal === 0}
        className={`w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center ${
          isProcessing || stats.needsRenewal === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Procesar Renovaciones
          </>
        )}
      </button>

      {/* Última ejecución */}
      {lastProcessed && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Último proceso: {lastProcessed.toLocaleTimeString('es-AR')}
        </div>
      )}
    </div>
  );
};

export default RenewalManagementCard;