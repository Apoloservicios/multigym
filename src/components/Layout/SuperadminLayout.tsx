// src/components/Layout/SuperadminLayout.tsx
import React from 'react';
import Sidebar from './Sidebar';

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

const SuperadminLayout: React.FC<SuperadminLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 md:ml-64 overflow-y-auto">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-full">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminLayout;