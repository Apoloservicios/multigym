// src/pages/settings/Users.tsx
import React from 'react';
import UserManagement from '../../components/settings/UserManagement';

const Users: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Usuarios</h1>
      <UserManagement />
    </div>
  );
};

export default Users;