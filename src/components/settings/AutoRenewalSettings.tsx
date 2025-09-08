// src/components/settings/AutoRenewalSettings.tsx
// ⚙️ PANEL DE CONFIGURACIÓN: Gestión de renovaciones automáticas

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Clock, 
  Bell, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Save,
  RotateCcw
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';

interface AutoRenewalConfig {
  enabled: boolean;
  frequency: 'daily' | 'manual' | 'weekly';
  notifyOnly: boolean;
  lastCheck?: string;
  autoProcessAtLogin: boolean;
  processTimeHour: number; // Hora del día para procesar (0-23)
  notificationDaysBefore: number; // Días antes del vencimiento para notificar
}

const AutoRenewalSettings: React.FC = () => {
  const { gymData } = useAuth();
  const [config, setConfig] = useState<AutoRenewalConfig>({
    enabled: true,
    frequency: 'manual',
    notifyOnly: true,
    autoProcessAtLogin: false,
    processTimeHour: 9, // 9 AM por defecto
    notificationDaysBefore: 3
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      if (!gymData?.id) return;
      
      setLoading(true);
      try {
        const configDoc = await getDoc(doc(db, `gyms/${gymData.id}/settings/autoRenewal`));
        
        if (configDoc.exists()) {
          setConfig({ ...config, ...configDoc.data() });
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        setMessage({ type: 'error', text: 'Error al cargar la configuración' });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [gymData?.id]);

  // Guardar configuración
  const saveConfig = async () => {
    if (!gymData?.id) return;
    
    setSaving(true);
    try {
      await setDoc(doc(db, `gyms/${gymData.id}/settings/autoRenewal`), config);
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  // Restablecer a valores por defecto
  const resetToDefaults = () => {
    setConfig({
      enabled: true,
      frequency: 'manual',
      notifyOnly: true,
      autoProcessAtLogin: false,
      processTimeHour: 9,
      notificationDaysBefore: 3
    });
  };

  const updateConfig = (updates: Partial<AutoRenewalConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Settings className="text-blue-600 mr-3" size={24} />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Configuración de Auto-renovaciones
            </h2>
            <p className="text-sm text-gray-600">
              Gestiona cómo y cuándo se procesan las renovaciones automáticas
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RotateCcw size={16} className="mr-1" />
            Restablecer
          </button>
          
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} className="mr-1" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? <CheckCircle size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Estado general */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <RefreshCw className="mr-2 text-green-600" size={20} />
            Estado General
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Sistema de auto-renovaciones
                </label>
                <p className="text-xs text-gray-500">
                  Habilita o deshabilita completamente el sistema
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Modo de operación */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <Clock className="mr-2 text-blue-600" size={20} />
            Modo de Operación
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                ¿Qué debe hacer el sistema con membresías vencidas?
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="notify-only"
                    checked={config.notifyOnly}
                    onChange={() => updateConfig({ notifyOnly: true })}
                    className="mr-2"
                  />
                  <label htmlFor="notify-only" className="text-sm">
                    <span className="font-medium">Solo notificar</span> - Alertar sobre membresías vencidas pero no renovar automáticamente
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="auto-renew"
                    checked={!config.notifyOnly}
                    onChange={() => updateConfig({ notifyOnly: false })}
                    className="mr-2"
                  />
                  <label htmlFor="auto-renew" className="text-sm">
                    <span className="font-medium">Renovar automáticamente</span> - Procesar renovaciones sin intervención manual
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Frecuencia de verificación
              </label>
              <select
                value={config.frequency}
                onChange={(e) => updateConfig({ frequency: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual solamente</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {config.frequency === 'manual' && 'Las verificaciones solo se ejecutan manualmente'}
                {config.frequency === 'daily' && 'Se verifica automáticamente todos los días'}
                {config.frequency === 'weekly' && 'Se verifica automáticamente cada semana'}
              </p>
            </div>
          </div>
        </div>

        {/* Configuración de login */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <Bell className="mr-2 text-orange-600" size={20} />
            Verificación al Iniciar Sesión
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Verificar al iniciar sesión
                </label>
                <p className="text-xs text-gray-500">
                  Ejecutar verificación automática cada vez que un usuario inicia sesión
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoProcessAtLogin}
                  onChange={(e) => updateConfig({ autoProcessAtLogin: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {config.autoProcessAtLogin && (
              <div className="pl-4 border-l-2 border-orange-200 bg-orange-50 p-3 rounded">
                <div className="flex items-start">
                  <AlertTriangle className="text-orange-600 mr-2 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Impacto en el rendimiento
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Esta opción puede hacer que el login sea más lento, especialmente con muchas membresías.
                      Se recomienda usar verificación programada en su lugar.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuración avanzada */}
        {config.frequency !== 'manual' && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Info className="mr-2 text-purple-600" size={20} />
              Configuración Avanzada
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Hora de procesamiento diario
                </label>
                <select
                  value={config.processTimeHour}
                  onChange={(e) => updateConfig({ processTimeHour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hora preferida para ejecutar el procesamiento automático (solo aplica a verificaciones programadas)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Días de anticipación para notificaciones
                </label>
                <select
                  value={config.notificationDaysBefore}
                  onChange={(e) => updateConfig({ notificationDaysBefore: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 día antes</option>
                  <option value={3}>3 días antes</option>
                  <option value={7}>7 días antes</option>
                  <option value={14}>14 días antes</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Con cuántos días de anticipación notificar sobre membresías próximas a vencer
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resumen de configuración actual */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">📋 Resumen de Configuración Actual</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sistema habilitado:</span>
              <span className={config.enabled ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {config.enabled ? '✅ Sí' : '❌ No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Modo de operación:</span>
              <span className="font-medium">
                {config.notifyOnly ? '🔔 Solo notificar' : '⚡ Renovar automáticamente'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Frecuencia:</span>
              <span className="font-medium">{
                config.frequency === 'manual' ? '👆 Manual' :
                config.frequency === 'daily' ? '📅 Diaria' : '📆 Semanal'
              }</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Verificar al login:</span>
              <span className={config.autoProcessAtLogin ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                {config.autoProcessAtLogin ? '⚠️ Habilitado' : '✅ Deshabilitado'}
              </span>
            </div>
            {config.lastCheck && (
              <div className="flex justify-between">
                <span className="text-gray-600">Última verificación:</span>
                <span className="font-medium">{config.lastCheck}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">💡 Recomendaciones</h4>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Para gimnasios pequeños (&lt;100 socios):</strong> Verificación manual o diaria con notificación solamente.</p>
            <p><strong>Para gimnasios medianos (100-500 socios):</strong> Verificación diaria con renovación automática, sin verificación al login.</p>
            <p><strong>Para gimnasios grandes (&gt;500 socios):</strong> Verificación semanal programada, definitivamente sin verificación al login.</p>
            <p><strong>Importante:</strong> La verificación al login puede impactar significativamente el rendimiento con muchos usuarios.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoRenewalSettings;