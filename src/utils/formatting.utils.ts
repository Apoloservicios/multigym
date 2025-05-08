// src/utils/formatting.utils.ts

// Formatear un número como moneda
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return '$0';
  }
  
  try {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `$${amount}`;
  }
};

// Formatear un número de teléfono
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  try {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  } catch (error) {
    console.error('Error formatting phone:', error);
    return phone;
  }
};

// Formatear un CUIT
export const formatCUIT = (cuit: string | null | undefined): string => {
  if (!cuit) return '';
  
  try {
    const cleaned = cuit.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
    }
    
    return cuit;
  } catch (error) {
    console.error('Error formatting CUIT:', error);
    return cuit;
  }
};

export default {
  formatCurrency,
  formatPhone,
  formatCUIT
};