// src/components/Layout/GymLayout.tsx
// VERSIÓN ACTUALIZADA CON CONTROL DE SUSCRIPCIÓN

import React from 'react';
import Sidebar from './Sidebar';
import SubscriptionCheck from '../common/SubscriptionCheck';
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
      
      <div className="flex-1 md:ml-64 overflow-y-auto overflow-x-hidden">
        {/* ✅ ENVOLVER CON SubscriptionCheck */}
        <SubscriptionCheck>
          <div className="bg-gray-50 min-h-full">
            {children}
          </div>
        </SubscriptionCheck>
      </div>
    </div>
  );
};

export default GymLayout;