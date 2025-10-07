import React from 'react';
import Sidebar from './Sidebar';

import { useAuth } from '../../contexts/AuthContext';
import useMonthlyPaymentsAutomation from '../../hooks/useMonthlyPaymentsAutomation';

interface GymLayoutProps {
  children: React.ReactNode;
}

const GymLayout: React.FC<GymLayoutProps> = ({ children }) => {
  const { gymData } = useAuth();
  
  // 🤖 Activar el scheduler automático   -->> anterior useMonthlyPaymentScheduler();
 
   useMonthlyPaymentsAutomation(gymData?.id, true);
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 md:ml-64 overflow-y-auto">
        <div className="p-6 bg-gray-50 min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default GymLayout;