// src/pages/settings/Memberships.tsx
import React from 'react';
import MembershipManagement from '../../components/settings/MembershipManagement';

const Memberships: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración de Membresías</h1>
      <MembershipManagement />
    </div>
  );
};

export default Memberships;