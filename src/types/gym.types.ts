// src/types/gym.types.ts

// Definición de la interfaz Attendance con los tipos correctos
export interface Attendance {
  id: string;
  memberId: string;
  memberName: string;
  timestamp: any; // Timestamp de Firebase
  membershipId: string;
  activityName: string;
  status: 'success' | 'error';
  error?: string;
}

// Resto de las interfaces
export interface Gym {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  cuit: string;
  address?: string;
  website?: string;
  socialMedia?: string;
  logo?: string;
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
}

export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  cuit: string;
  email: string;
  website: string;
  socialMedia: string;
  logo: string | null;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
}

// Actualización de tipos para incluir todas las categorías utilizadas
export type TransactionIncomeCategory = 'membership' | 'extra' | 'product' | 'service' | 'other';
export type TransactionExpenseCategory = 'withdrawal' | 'supplier' | 'services' | 'maintenance' | 'salary' | 'other' | 'refund';
export type TransactionCategory = TransactionIncomeCategory | TransactionExpenseCategory;

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category?: TransactionCategory;
  amount: number;
  description: string;
  memberId?: string;
  membershipId?: string;
  date: any;
  userId: string;
  userName: string;
  paymentMethod?: string;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DailyCash {
  id: string;
  date: string;
  openingTime: any;
  closingTime?: any;
  openingAmount: number;
  closingAmount?: number;
  totalIncome: number;
  totalExpense: number;
  membershipIncome: number;
  otherIncome: number;
  status: 'open' | 'closed';
  openedBy: string;
  closedBy?: string;
  notes?: string;
}

// Crear un namespace para los tipos (esto no interfiere con las interfaces exportadas)
export namespace GymTypeUtils {
  export const createEmptyGym = (): Gym => ({
    id: '',
    name: '',
    owner: '',
    email: '',
    phone: '',
    cuit: '',
    status: 'trial',
    registrationDate: new Date()
  });
  
  export const createEmptyAttendance = (): Attendance => ({
    id: '',
    memberId: '',
    memberName: '',
    timestamp: new Date(),
    membershipId: '',
    activityName: '',
    status: 'success'
  });
}

// No es necesario exportar un objeto default si no lo vas a usar directamente
