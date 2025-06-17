// src/types/gym.types.ts - CORREGIDO PARA COMPATIBILIDAD

import { Timestamp } from 'firebase/firestore';

// ============ TIPOS EXISTENTES CORREGIDOS ============

export interface Transaction {
  id?: string;
  gymId?: string;
  memberId?: string;
  memberName?: string;
  membershipAssignmentId?: string; // Para pagos de membresías
  membershipId?: string; // AGREGAR PARA COMPATIBILIDAD
  
  // Campos existentes en tu sistema
  amount: number;
  description: string;
  date?: any; // Para compatibilidad con código existente
  category?: string; // Para compatibilidad con código existente
  userName?: string; // Para compatibilidad con código existente
  userId?: string; // Para compatibilidad con código existente
  
  // Tipos compatibles - incluimos 'income' para el código existente
  type: 'income' | 'expense' | 'membership_payment' | 'penalty' | 'refund' | 'other_income';
  
  // Métodos de pago compatibles
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'other' | string;
  
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  
  // Campos nuevos opcionales
  processedBy?: string; // ID del usuario que procesó
  createdAt?: any; // Timestamp de Firebase
  completedAt?: any;
  refundedAt?: any;
  notes?: string;
  originalTransactionId?: string; // Para refunds
  updatedAt?: any;
}

// DailyCash compatible con código existente
export interface DailyCash {
  id?: string;
  gymId: string;
  date: string; // YYYY-MM-DD
  
  // Campos existentes en tu código
  openingAmount?: number; // Campo que usa tu código existente
  closingAmount?: number; // Campo que usa tu código existente
  openingTime?: any; // Campo que usa tu código existente
  closingTime?: any; // Campo que usa tu código existente
  totalExpense?: number; // Campo que usa tu código existente (singular)
  membershipIncome?: number; // Campo que usa tu código existente
  otherIncome?: number; // Campo que usa tu código existente
  
  // Campos nuevos (compatibles)
  openingBalance: number;
  closingBalance?: number;
  totalIncome: number;
  totalExpenses: number; // Nuevo campo (plural)
  
  status: 'open' | 'closed';
  openedBy: string;
  closedBy?: string;
  openedAt: any; // Timestamp
  closedAt?: any;
  lastUpdated: any;
  notes?: string;
  
  // Breakdown por método de pago
  paymentMethodBreakdown?: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
  };
}

// ============ NUEVOS TIPOS PARA EL SISTEMA MEJORADO ============

export interface PaymentTransaction {
  id?: string;
  gymId: string;
  memberId: string;
  memberName: string;
  membershipAssignmentId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  type: 'membership_payment' | 'penalty' | 'refund' | 'other_income';
  processedBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  refundedAt?: Timestamp;
  notes?: string;
}

export interface DailyCashRegister {
  id?: string;
  gymId: string;
  date: string; // YYYY-MM-DD
  openingBalance: number;
  closingBalance?: number;
  totalIncome: number;
  totalExpenses: number;
  status: 'open' | 'closed';
  openedBy: string;
  closedBy?: string;
  openedAt: Timestamp;
  closedAt?: Timestamp;
  lastUpdated: Timestamp;
}

export interface PaymentSummary {
  totalAmount: number;
  paymentMethod: string;
  count: number;
  percentage: number;
}

export interface FinancialSummary {
  date: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
  paymentBreakdown: PaymentSummary[];
  pendingPayments: number;
  refunds: number;
}

// ============ TIPOS EXISTENTES MANTENIDOS ============

export interface Gym {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  cuit: string;
  status: 'active' | 'trial' | 'suspended';
  registrationDate: any;
  trialEndsAt?: any;
  subscriptionData?: {
    plan: string;
    startDate: any;
    endDate: any;
    price: number;
    paymentMethod: string;
    lastPayment: any;
    renewalRequested: boolean;
  };
  logo?: string;
  logoUrl?: string;
}

export interface BusinessProfile {
  id?: string;
  gymId: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  businessHours?: {
    [key: string]: {
      open: string;
      close: string;
      isOpen: boolean;
    };
  };
  logo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Activity {
  id?: string;
  gymId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Attendance {
  id: string;
  memberId: string;
  memberName: string;
  membershipId: string;
  activityName: string;
  timestamp: Timestamp | Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
  notes?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Tipos de categorías para compatibilidad - COMPLETADOS
export type TransactionIncomeCategory = 'membership' | 'extra' | 'penalty' | 'product' | 'service' | 'other';
export type TransactionExpenseCategory = 'withdrawal' | 'refund' | 'expense' | 'supplier' | 'services' | 'maintenance' | 'salary' | 'other';

// AGREGAR TIPO FALTANTE
export type TransactionCategory = TransactionIncomeCategory | TransactionExpenseCategory;

// 🔧 AGREGAR ESTE TIPO AL FINAL DEL ARCHIVO gym.types.ts

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: any;
  updatedAt?: any;
  // Agregar otros campos que uses en tu sistema
  dni?: string;
  address?: string;
  birthDate?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  memberNumber?: string;
  joinDate?: string;
}