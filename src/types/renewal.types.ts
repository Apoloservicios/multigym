// src/types/renewal.types.ts
// Tipos para el sistema de renovación de suscripciones

import { FirebaseDate } from './firebase.types';

export interface RenewalRequest {
  id: string;
  gymId: string;
  gymName: string;
  
  // Información del plan solicitado
  planId: string;
  planName: string;
  planDuration: number; // días
  planPrice: number;
  
  // Información del comprobante
  paymentProofUrl: string; // URL de Cloudinary
  paymentProofPublicId: string; // ID público de Cloudinary para eliminar
  paymentMethod: 'transfer' | 'deposit' | 'other';
  paymentReference?: string; // Número de referencia/operación
  paymentDate: FirebaseDate;
  
  // Estado de la solicitud
  status: 'pending' | 'approved' | 'rejected';
  
  // Información del solicitante
  requestedBy: string; // ID del usuario que solicitó
  requestedByName: string; // Nombre del usuario
  requestedByEmail: string; // Email del usuario
  
  // Información de revisión (superadmin)
  reviewedBy?: string; // ID del superadmin que revisó
  reviewedByName?: string; // Nombre del superadmin
  reviewedAt?: FirebaseDate;
  rejectionReason?: string;
  
  // Notas adicionales
  notes?: string;
  
  // Timestamps
  createdAt: FirebaseDate;
  updatedAt?: FirebaseDate;
}

// Función helper para crear una solicitud vacía
export const createEmptyRenewalRequest = (): Omit<RenewalRequest, 'id'> => ({
  gymId: '',
  gymName: '',
  planId: '',
  planName: '',
  planDuration: 30,
  planPrice: 0,
  paymentProofUrl: '',
  paymentProofPublicId: '',
  paymentMethod: 'transfer',
  paymentDate: new Date(),
  status: 'pending',
  requestedBy: '',
  requestedByName: '',
  requestedByEmail: '',
  notes: '',
  createdAt: new Date()
});

export default {
  createEmptyRenewalRequest
};