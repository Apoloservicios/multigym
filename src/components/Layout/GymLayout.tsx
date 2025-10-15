
// 📍 ARCHIVO: src/components/Layout/GymLayout.tsx
// 🔧 VERSIÓN FINAL - SIN PADDING QUE CAUSE DESPLAZAMIENTO

import React from 'react';
import Sidebar from './Sidebar';

import { useAuth } from '../../contexts/AuthContext';
import useMonthlyPaymentsAutomation from '../../hooks/useMonthlyPaymentsAutomation';

interface GymLayoutProps {
  children: React.ReactNode;
}

const GymLayout: React.FC<GymLayoutProps> = ({ children }) => {
  const { gymData } = useAuth();
  
  // 🤖 Activar el scheduler automático
  useMonthlyPaymentsAutomation(gymData?.id, true);
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      {/* ✅ CRÍTICO: Sin p-6, solo bg-gray-50 */}
      <div className="flex-1 md:ml-64 overflow-y-auto overflow-x-hidden">
        <div className="bg-gray-50 min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default GymLayout;