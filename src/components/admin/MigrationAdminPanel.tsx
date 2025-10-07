// src/components/admin/MigrationAdminPanel.tsx
// 🔧 PANEL DE ADMINISTRACIÓN - Migración y gestión del sistema

import React, { useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Database,
  PlayCircle,
  Eye,
  Download,
  Info
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import {
  migrateToNewPaymentSystem,
  verifyMigration,
  dryRunMigration
} from '../../utils/migrateToNewPaymentSystem';
import { generateMonthlyPayments } from '../../services/monthlyPayments.service';

const MigrationAdminPanel: React.FC = () => {
  const { gymData } = useAuth();

  // Estados
  const [loading, setLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  /**
   * 📝 Agregar log
   */
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  /**
   * 🧪 Ejecutar simulación
   */
  const handleDryRun = async () => {
    if (!gymData?.id) return;

    setLoading(true);
    setLogs([]);
    addLog('🧪 Iniciando simulación...');

    try {
      // Capturar console.log
      const originalLog = console.log;
      console.log = (...args) => {
        addLog(args.join(' '));
        originalLog(...args);
      };

      await dryRunMigration(gymData.id);

      console.log = originalLog;
      addLog('✅ Simulación completada');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Verificar estado actual
   */
  const handleVerify = async () => {
    if (!gymData?.id) return;

    setLoading(true);
    setLogs([]);
    addLog('🔍 Verificando sistema...');

    try {
      const result = await verifyMigration(gymData.id);
      setVerificationResult(result);
      addLog(`📊 Sistema antiguo: ${result.oldSystem} membresías`);
      addLog(`📊 Sistema nuevo: ${result.newSystem} membresías`);
      addLog('✅ Verificación completada');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🚀 Ejecutar migración real
   */
  const handleMigrate = async () => {
    if (!gymData?.id) return;

    const confirmed = window.confirm(
      '⚠️ ¿Estás seguro de ejecutar la migración?\n\n' +
      'Esto creará las nuevas membresías en el sistema.\n' +
      'Las antiguas NO se borrarán (por seguridad).\n\n' +
      '💡 Recomendación: Primero ejecuta la simulación.'
    );

    if (!confirmed) return;

    setLoading(true);
    setLogs([]);
    addLog('🚀 Iniciando migración real...');

    try {
      // Capturar console.log
      const originalLog = console.log;
      console.log = (...args) => {
        addLog(args.join(' '));
        originalLog(...args);
      };

      const result = await migrateToNewPaymentSystem(gymData.id);
      setMigrationResult(result);

      console.log = originalLog;

      if (result.success) {
        addLog('🎉 ¡Migración completada exitosamente!');
        
        // Ofrecer generar pagos
        const generatePayments = window.confirm(
          '✅ Migración completa.\n\n' +
          '¿Quieres generar los pagos mensuales ahora?'
        );

        if (generatePayments) {
          addLog('💰 Generando pagos mensuales...');
          const paymentResult = await generateMonthlyPayments(gymData.id);
          addLog(`✅ Pagos generados: ${paymentResult.paymentsGenerated}`);
        }
      } else {
        addLog('⚠️ Migración completada con errores');
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 💰 Generar pagos manualmente
   */
  const handleGeneratePayments = async () => {
    if (!gymData?.id) return;

    setLoading(true);
    setLogs([]);
    addLog('💰 Generando pagos mensuales...');

    try {
      const result = await generateMonthlyPayments(gymData.id);
      
      addLog(`✅ Pagos generados: ${result.paymentsGenerated}`);
      addLog(`📊 Total monto: $${result.summary.totalAmount}`);
      addLog(`👥 Socios procesados: ${result.summary.totalMembers}`);
      
      if (result.summary.skipped.suspended > 0) {
        addLog(`⏭️ Saltados (suspendidos): ${result.summary.skipped.suspended}`);
      }
      
      if (result.summary.skipped.alreadyExists > 0) {
        addLog(`⏭️ Ya existentes: ${result.summary.skipped.alreadyExists}`);
      }

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📥 Descargar logs
   */
  const handleDownloadLogs = () => {
    const logsText = logs.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-logs-${new Date().toISOString()}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Panel de Administración</h1>
            <p className="text-blue-100 mt-1">
              Migración al nuevo sistema de pagos mensuales
            </p>
          </div>
        </div>
      </div>

      {/* Info importante */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div className="text-sm text-yellow-900">
            <p className="font-medium mb-2">⚠️ Antes de migrar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ejecuta primero la <strong>Simulación</strong> para ver qué pasaría</li>
              <li>Verifica el estado actual con <strong>Verificar Sistema</strong></li>
              <li>Lee los logs cuidadosamente</li>
              <li>La migración NO borra datos antiguos (por seguridad)</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Acciones principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Simulación */}
        <button
          onClick={handleDryRun}
          disabled={loading}
          className="bg-white border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors disabled:opacity-50"
        >
          <Eye className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Simulación</h3>
          <p className="text-sm text-gray-600">
            Ver qué pasaría sin guardar
          </p>
        </button>

        {/* Verificar */}
        <button
          onClick={handleVerify}
          disabled={loading}
          className="bg-white border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition-colors disabled:opacity-50"
        >
          <Info className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Verificar Sistema</h3>
          <p className="text-sm text-gray-600">
            Estado actual de los datos
          </p>
        </button>

        {/* Migrar */}
        <button
          onClick={handleMigrate}
          disabled={loading}
          className="bg-white border-2 border-orange-200 rounded-lg p-6 hover:border-orange-400 transition-colors disabled:opacity-50"
        >
          <PlayCircle className="w-8 h-8 text-orange-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Ejecutar Migración</h3>
          <p className="text-sm text-gray-600">
            Migrar al nuevo sistema
          </p>
        </button>

        {/* Generar pagos */}
        <button
          onClick={handleGeneratePayments}
          disabled={loading}
          className="bg-white border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Generar Pagos</h3>
          <p className="text-sm text-gray-600">
            Crear pagos del mes actual
          </p>
        </button>
      </div>

      {/* Resultados de verificación */}
      {verificationResult && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Resultado de Verificación
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Sistema Antiguo</p>
              <p className="text-2xl font-bold text-gray-900">
                {verificationResult.oldSystem}
              </p>
              <p className="text-xs text-gray-500">membresías</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Sistema Nuevo</p>
              <p className="text-2xl font-bold text-blue-600">
                {verificationResult.newSystem}
              </p>
              <p className="text-xs text-gray-500">membresías</p>
            </div>
          </div>
        </div>
      )}

      {/* Resultado de migración */}
      {migrationResult && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {migrationResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
            Resultado de Migración
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Procesadas</p>
              <p className="text-xl font-bold text-gray-900">
                {migrationResult.membershipsProcessed}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Creadas</p>
              <p className="text-xl font-bold text-green-600">
                {migrationResult.membershipsCreated}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Saltadas</p>
              <p className="text-xl font-bold text-yellow-600">
                {migrationResult.details.skipped}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Errores</p>
              <p className="text-xl font-bold text-red-600">
                {migrationResult.errors.length}
              </p>
            </div>
          </div>

          {migrationResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-900 mb-2">Errores:</p>
              <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                {migrationResult.errors.map((error: string, idx: number) => (
                  <p key={idx} className="text-xs text-red-800 mb-1">• {error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Console de logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">
              📋 Logs de Operación
            </h3>
            <button
              onClick={handleDownloadLogs}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`mb-1 ${
                  log.includes('❌') ? 'text-red-400' :
                  log.includes('✅') ? 'text-green-400' :
                  log.includes('⚠️') ? 'text-yellow-400' :
                  log.includes('🎉') ? 'text-blue-400' :
                  'text-gray-300'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado del sistema */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <div>
              <p className="font-semibold text-gray-900">Procesando...</p>
              <p className="text-sm text-gray-600">Por favor espera</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationAdminPanel;