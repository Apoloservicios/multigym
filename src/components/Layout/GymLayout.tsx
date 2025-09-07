import React from 'react';
import Sidebar from './Sidebar';
import useMonthlyPaymentScheduler from '../../hooks/useMonthlyPaymentScheduler';
import { useAuth } from '../../contexts/AuthContext';

interface GymLayoutProps {
  children: React.ReactNode;
}

const GymLayout: React.FC<GymLayoutProps> = ({ children }) => {
  const { gymData } = useAuth();
  
  // 🤖 Activar el scheduler automático
  useMonthlyPaymentScheduler();
  
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