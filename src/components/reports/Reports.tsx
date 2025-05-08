// src/components/reports/Reports.tsx
import React, { useState } from 'react';
import { FileText, DollarSign, Users, Calendar } from 'lucide-react';
import CashierReports from './CashierReports';
import AttendanceReports from './AttendanceReports';
import MembersReports from './MembersReports';
import MembershipsReports from './MembershipsReports';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cash');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Informes</h1>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap -mb-px">
            <button
              onClick={() => setActiveTab('cash')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'cash'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Caja Diaria
            </button>
            
            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Asistencias
            </button>
            
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5 mr-2" />
              Socios
            </button>
            
            <button
              onClick={() => setActiveTab('memberships')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'memberships'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-5 h-5 mr-2" />
              Membresías
            </button>
          </nav>
        </div>
      </div>

      <div>
        {activeTab === 'cash' && <CashierReports />}
        {activeTab === 'attendance' && <AttendanceReports />}
        {activeTab === 'members' && <MembersReports />}
        {activeTab === 'memberships' && <MembershipsReports />}
      </div>
    </div>
  );
};

export default Reports;