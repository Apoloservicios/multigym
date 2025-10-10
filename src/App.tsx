// src/App.tsx - VERSIÓN LIMPIA
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

// Contexto de autenticación
import { AuthProvider } from './contexts/AuthContext';

// Componente principal de rutas
import AppContent from './components/AppContent';
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