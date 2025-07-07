// src/components/Layout/GymLayout.tsx
import React from 'react';
import Sidebar from './Sidebar';

interface GymLayoutProps {
  children: React.ReactNode;
}

const GymLayout: React.FC<GymLayoutProps> = ({ children }) => {
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