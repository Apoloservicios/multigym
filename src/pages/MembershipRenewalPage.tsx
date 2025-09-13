// src/pages/MembershipRenewalPage.tsx - CORREGIDO
import React from 'react';
// Cambiado al componente correcto
import UnifiedRenewalDashboard from '../components/memberships/UnifiedRenewalDashboard';
import MonthlyReportGenerator from '../components/memberships/MonthlyReportGenerator';
import { useMonthlyRenewalAutomation } from '../hooks/useMonthlyRenewalAutomation';
import useAuth from '../hooks/useAuth';

const MembershipRenewalPage: React.FC = () => {
  const { gymData } = useAuth();
  
  // Activar automatización mensual (sin parámetros)
  const { automationState } = useMonthlyRenewalAutomation();
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema de Renovaciones Automáticas
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestiona las renovaciones de membresías de forma automática y eficiente
          </p>
          
          {/* Estado de automatización */}
          {automationState && (
            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {automationState.isEnabled ? '✓ Automatización Activa' : 'Automatización Desactivada'}
            </div>
          )}
        </div>
        
        {/* Dashboard principal */}
        <div className="mb-8">
          <UnifiedRenewalDashboard />
        </div>
        
        {/* Generador de reportes */}
        <div>
          <MonthlyReportGenerator />
        </div>
      </div>
    </div>
  );
};

export default MembershipRenewalPage;