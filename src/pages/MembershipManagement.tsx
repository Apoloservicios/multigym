// src/pages/MembershipManagement.tsx
// 🔄 ACTUALIZADO PARA USAR EL NUEVO SISTEMA DE RENOVACIONES
// Reemplaza el dashboard antiguo con el nuevo sistema unificado

import React, { useState } from 'react';
import { Calendar, RefreshCw, Users, DollarSign, TrendingUp } from 'lucide-react';

// Importar el NUEVO dashboard de renovaciones
import UnifiedRenewalDashboard from '../components/memberships/UnifiedMembershipDashboard';
import MonthlyReportGenerator from '../components/memberships/MonthlyReportGenerator';

// Hook para automatización mensual
import { useMonthlyRenewalAutomation } from '../hooks/useMonthlyRenewalAutomation';
import useAuth from '../hooks/useAuth';

const MembershipManagement: React.FC = () => {
  const { gymData } = useAuth();
  
  // Activar automatización mensual
  useMonthlyRenewalAutomation(gymData?.id, true);
  
  // Estado para controlar qué vista mostrar
  const [activeView, setActiveView] = useState<'dashboard' | 'reports'>('dashboard');
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header principal */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Membresías
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Sistema automatizado de renovaciones y control de pagos
              </p>
            </div>
            
            {/* Navegación entre vistas */}
            <div className="flex space-x-3">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Dashboard Principal
              </button>
              
              <button
                onClick={() => setActiveView('reports')}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'reports'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Reportes
              </button>
            </div>
          </div>
        </div>

        {/* Vista principal: Dashboard de renovaciones */}
        {activeView === 'dashboard' && (
          <div className="space-y-8">
            {/* Dashboard unificado - SIN PROP currentMonth */}
            <UnifiedRenewalDashboard />
          </div>
        )}

        {/* Vista de reportes */}
        {activeView === 'reports' && (
          <div className="space-y-8">
            <MonthlyReportGenerator 
              onReportGenerated={() => {
                console.log('Reporte generado exitosamente');
              }}
            />
          </div>
        )}

        {/* Footer informativo */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Users className="h-6 w-6 text-blue-600 mr-3" />
            <h3 className="text-lg font-medium text-blue-900">
              Sistema Automatizado MultiGym
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="flex items-center text-blue-800">
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="font-medium">Renovaciones Automáticas</span>
              </div>
              <p className="text-blue-700">
                El sistema procesa automáticamente las renovaciones al inicio de cada mes, 
                aplicando los precios actuales de las actividades.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center text-blue-800">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="font-medium">Control de Pagos</span>
              </div>
              <p className="text-blue-700">
                Monitoreo en tiempo real de pagos pendientes y generación de reportes 
                Excel para control cruzado con el sistema.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center text-blue-800">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="font-medium">Gestión Inteligente</span>
              </div>
              <p className="text-blue-700">
                Identificación automática de membresías vencidas, renovaciones pendientes 
                y optimización de la gestión de socios.
              </p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              🚀 <strong>Nuevo Sistema Implementado:</strong> Este dashboard reemplaza todas las funcionalidades 
              anteriores con una solución unificada, automatizada y completamente funcional.
            </p>
          </div>
        </div>
        
        {/* Información de estado del sistema */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <RefreshCw className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Sistema de Automatización Activo
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  • La automatización mensual está <strong>habilitada</strong> para este gimnasio<br/>
                  • Las renovaciones se procesan automáticamente los primeros 3 días de cada mes<br/>
                  • Los precios se actualizan automáticamente desde las actividades configuradas<br/>
                  • El sistema genera logs completos de todas las operaciones realizadas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipManagement;