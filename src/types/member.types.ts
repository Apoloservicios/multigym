// src/types/member.types.ts - ACTUALIZADO SIN PERDER FUNCIONALIDADES

import { FirebaseDate as CentralFirebaseDate } from './firebase.types';

// Define un alias para mantener la compatibilidad
export type FirebaseDate = CentralFirebaseDate;

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  // Usar el tipo específico para fechas de Firebase
  birthDate?: FirebaseDate;
  photo?: string | null;
  status: 'active' | 'inactive';
  totalDebt: number;
  lastAttendance?: FirebaseDate;
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
  // Campo adicional usado en algunas funciones
  daysUntilBirthday?: number;
}

export interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  photo: File | null;
  status: 'active' | 'inactive';
}

export interface MembershipAssignment {
  id?: string;
  memberId: string;
  activityId: string;
  activityName: string;
  startDate: string;
  endDate: string;
  cost: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  status: 'active' | 'expired' | 'cancelled';
  maxAttendances: number;
  currentAttendances: number;
  description: string;
  
  // Campos adicionales para mejor gestión financiera
  memberName?: string;
  autoRenewal?: boolean;
  paymentFrequency?: 'single' | 'monthly';
  lastRenewalDate?: string;
  
  // 🆕 PROPIEDADES AGREGADAS PARA RENOVACIONES AUTOMÁTICAS
  renewedAutomatically?: boolean;  // Si fue renovada automáticamente
  renewedManually?: boolean;       // Si fue renovada manualmente
  previousMembershipId?: string;   // ID de la membresía anterior (para renovaciones)
  renewalDate?: any;               // Firebase Timestamp - fecha de renovación
  
  // 🆕 PROPIEDADES AGREGADAS PARA CANCELACIONES MEJORADAS
  cancelReason?: string;           // Motivo de cancelación
  cancelDate?: any;                // Firebase Timestamp - fecha de cancelación (alias para cancelledAt)
  cancelledBy?: string;            // Quién canceló la membresía
  debtAction?: 'keep' | 'cancel';  // Qué se hizo con la deuda al cancelar
  
  // Nuevos campos para el sistema financiero mejorado
  paidAmount?: number; // Cuánto se ha pagado
  paidAt?: any; // Timestamp cuando se pagó completamente
  partialPayments?: {
    amount: number;
    date: any;
    transactionId: string;
  }[]; // Para pagos parciales
  
  // Para cancelaciones (mantener nombres originales por compatibilidad)
  cancelledAt?: any;               // Firebase Timestamp - mantener por compatibilidad
  cancellationReason?: string;     // Mantener por compatibilidad (alias de cancelReason)
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

// Objeto con funciones útiles relacionadas con estos tipos
const memberTypes = {
  createEmptyMember: (): Member => ({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'active',
    totalDebt: 0
  }),
  
  createEmptyMemberFormData: (): MemberFormData => ({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    photo: null,
    status: 'active'
  }),
  
  createEmptyMembershipAssignment: (): MembershipAssignment => ({
    memberId: '',
    activityId: '',
    activityName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    cost: 0,
    paymentStatus: 'pending',
    status: 'active',
    maxAttendances: 0,
    currentAttendances: 0,
    description: '',
    // Agregamos valores por defecto para los nuevos campos
    autoRenewal: false,
    paymentFrequency: 'single',
    // 🆕 Valores por defecto para las nuevas propiedades
    renewedAutomatically: false,
    renewedManually: false
  })
};

export default memberTypes;