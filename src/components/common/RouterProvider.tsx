// src/components/common/RouterProvider.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setNavigate } from '../../services/navigation.service';

/**
 * Componente que proporciona la función de navegación a nivel global
 * Se debe usar este componente dentro del contexto de un Router
 */
const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  
  // Establecer la función de navegación cuando el componente se monta
  // y limpiarla cuando se desmonta
  useEffect(() => {
    setNavigate(navigate);
    
    return () => {
      // Limpiar la referencia cuando el componente se desmonta
      setNavigate(null);
    };
  }, [navigate]);
  
  return <>{children}</>;
};

export default RouterProvider;