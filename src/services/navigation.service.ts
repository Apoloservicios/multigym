// src/services/navigation.service.ts
import { NavigateFunction } from 'react-router-dom';

// Variable para almacenar la función de navegación
let navigateFunction: NavigateFunction | null = null;

/**
 * Establece la función de navegación para uso global
 * @param navigate - Función de navegación de React Router
 */
export const setNavigate = (navigate: NavigateFunction | null): void => {
  navigateFunction = navigate;
};

/**
 * Navega a una ruta específica usando la función de navegación global
 * @param to - Ruta a la que navegar
 * @param options - Opciones adicionales de navegación
 * @returns true si la navegación fue exitosa, false si no hay una función de navegación disponible
 */
export const navigateTo = (to: string, options?: { replace?: boolean }): boolean => {
  if (navigateFunction) {
    navigateFunction(to, options);
    return true;
  } else {
    console.warn('Navigation function not available. Make sure you are using this within a Router context.');
    return false;
  }
};

export default {
  setNavigate,
  navigateTo
};