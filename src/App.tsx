// src/App.tsx - VERSIÓN FINAL COHERENTE CON EL SISTEMA
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Contexto de autenticación
import { AuthProvider } from './contexts/AuthContext';

// Componentes principales
import AppContent from './components/AppContent';

// Hook para automatización mensual
import useMonthlyPaymentScheduler from './hooks/useMonthlyPaymentScheduler';

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