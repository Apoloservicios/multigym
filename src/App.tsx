// src/App.tsx - VERSIÓN FINAL COHERENTE CON EL SISTEMA
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Contexto de autenticación
import { AuthProvider } from './contexts/AuthContext';
import MembershipManagement from './pages/MembershipManagement';

// Componentes principales
import AppContent from './components/AppContent';

// Hook para automatización mensual


import MonthlyPaymentsDashboard from './components/payments/MonthlyPaymentsDashboard';
import MigrationAdminPanel from './components/admin/MigrationAdminPanel';

import './index.css';

// Componente principal App
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;