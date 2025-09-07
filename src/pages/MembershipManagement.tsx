// src/pages/MembershipManagement.tsx
// 📝 PÁGINA PRINCIPAL DEL SISTEMA UNIFICADO DE GESTIÓN DE MEMBRESÍAS

import React, { useState } from 'react';
import UnifiedMembershipDashboard from '../components/memberships/UnifiedMembershipDashboard';
import { Info } from 'lucide-react';

const MembershipManagement: React.FC = () => {
  // Estado para el mes actual - configurable por el usuario
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Función para formatear el mes en el selector
  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con selector de mes */}
        <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestión de Membresías
            </h1>
            <p className="text-gray-600 mt-1">
              Sistema unificado de cobros automáticos y renovaciones con actualización de precios
            </p>
          </div>
          
          {/* Selector de mes */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">
              Mes de trabajo:
            </label>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
            >
              {/* Generar opciones para los últimos 12 meses y próximos 6 */}
              {Array.from({ length: 18 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - 12 + i);
                const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                return (
                  <option key={value} value={value}>
                    {formatMonth(value)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Dashboard unificado */}
        <UnifiedMembershipDashboard currentMonth={currentMonth} />
        
        {/* Footer informativo */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Info className="h-6 w-6 text-blue-600 mt-0.5" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-blue-900 mb-3">
                Información sobre el Sistema Unificado
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">💰 Actualización Automática de Precios</h4>
                  <p>Las renovaciones automáticas consultan el precio actual de cada actividad en tiempo real, 
                  garantizando que los aumentos se apliquen sin intervención manual.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">🔄 Proceso de Renovación Inteligente</h4>
                  <div className="space-y-1">
                    <p>1. Identifica membresías vencidas con auto-renovación</p>
                    <p>2. Consulta precio actual en la base de datos</p>
                    <p>3. Renueva con precio actualizado</p>
                    <p>4. Genera pago pendiente correspondiente</p>
                    <p>5. Registra cambios en historial</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">⚙️ Configuración Recomendada</h4>
                  <div className="space-y-1">
                    <p>• Mantén actualizados los precios en Actividades</p>
                    <p>• Revisa semanalmente las próximas renovaciones</p>
                    <p>• Procesa renovaciones vencidas diariamente</p>
                    <p>• Verifica el historial de cambios de precios</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <h4 className="font-medium text-blue-900 mb-1">🚀 Características Principales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-800">
                  <span>✅ Precios siempre actualizados</span>
                  <span>✅ Proceso automático del 1° del mes</span>
                  <span>✅ Renovaciones individuales y masivas</span>
                  <span>✅ Historial completo de operaciones</span>
                  <span>✅ Control granular de estados</span>
                  <span>✅ Compatible con sistema existente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipManagement;