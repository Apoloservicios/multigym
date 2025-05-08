// src/types/superadmin.types.ts
import { FirebaseDate } from './firebase.types';

// Tipo para los planes de suscripción al sistema
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  duration: number; // días
  price: number;
  features: string[];
  isActive: boolean;
  maxGyms?: number; // número máximo de gimnasios permitidos (opcional)
  maxAdmins?: number; // número máximo de administradores permitidos (opcional)
  maxUsers?: number; // número máximo de usuarios permitidos (opcional)
  maxMembers?: number; // número máximo de miembros permitidos (opcional)
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
}

// Tipo para las suscripciones de gimnasios al sistema
export interface GymSubscription {
  id: string;
  gymId: string;
  gymName: string;
  planId: string;
  planName: string;
  startDate: FirebaseDate;
  endDate: FirebaseDate;
  price: number;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  paymentMethod: string;
  paymentDate: FirebaseDate;
  renewalRequested: boolean;
  autoRenewal: boolean;
  lastRenewalDate?: FirebaseDate;
  nextRenewalDate?: FirebaseDate;
  trialEndDate?: FirebaseDate;
  notes?: string;
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
}

// Tipo para los pagos de suscripciones
// Tipo para los pagos de suscripciones
export interface Payment {
  id: string;
  subscriptionId: string;
  gymId: string;
  gymName: string;
  amount: number;
  date: FirebaseDate;
  method: 'transfer' | 'card' | 'cash' | 'other';
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
  notes?: string;
  description?: string;
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
}

// Tipo para los gimnasios
export interface Gym {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  cuit: string;
  status: 'active' | 'trial' | 'suspended';
  registrationDate: FirebaseDate;
  trialEndsAt?: FirebaseDate;
  subscriptionData?: {
    plan: string;
    startDate: FirebaseDate;
    endDate: FirebaseDate;
    price: number;
    paymentMethod: string;
    lastPayment: FirebaseDate;
    renewalRequested: boolean;
  };
  address?: string;
  website?: string;
  socialMedia?: string;
  logo?: string;
  totalDebt?: number;
  lastLoginDate?: FirebaseDate;
  activeUsers?: number;
  totalMembers?: number;
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
}

// Tipo para las estadísticas del dashboard del superadmin
export interface SuperadminStats {
  totalGyms: number;
  activeGyms: number;
  trialGyms: number;
  suspendedGyms: number;
  totalRevenue: number;
  revenueThisMonth: number;
  pendingPayments: number;
  newGymsThisMonth: number;
  topGymsByRevenue?: { 
    id: string; 
    name: string; 
    revenue: number 
  }[];
  gymsByStatus?: { 
    status: string; 
    count: number 
  }[];
}

// Tipo para el gráfico de suscripciones
export interface SubscriptionChartData {
  dates: string[];
  values: {
    newSubscriptions: number[];
    renewals: number[];
    total: number[];
  };
}

// Tipo para el gráfico de ingresos
export interface RevenueChartData {
  dates: string[];
  values: {
    amount: number[];
    cumulative: number[];
  };
}

// Objetos con funciones útiles 
export const subscriptionTypes = {
  createEmptySubscriptionPlan: (): SubscriptionPlan => ({
    id: '',
    name: '',
    description: '',
    duration: 30,
    price: 0,
    features: [],
    isActive: true
  }),
  
  createEmptyGymSubscription: (): GymSubscription => ({
    id: '',
    gymId: '',
    gymName: '',
    planId: '',
    planName: '',
    startDate: new Date(),
    endDate: new Date(),
    price: 0,
    status: 'pending',
    paymentMethod: '',
    paymentDate: new Date(),
    renewalRequested: false,
    autoRenewal: false
  }),
  
  createEmptyPayment: (): Payment => ({
    id: '',
    subscriptionId: '',
    gymId: '',
    gymName: '',
    amount: 0,
    date: new Date(),
    method: 'transfer',
    status: 'pending'
  }),
  
  createEmptyGym: (): Gym => ({
    id: '',
    name: '',
    owner: '',
    email: '',
    phone: '',
    cuit: '',
    status: 'trial',
    registrationDate: new Date()
  }),
  
  // Duración de los planes en opciones para select
  durationOptions: [
    { value: 7, label: '7 días' },
    { value: 15, label: '15 días' },
    { value: 30, label: '1 mes' },
    { value: 90, label: '3 meses' },
    { value: 180, label: '6 meses' },
    { value: 365, label: '1 año' }
  ],
  
  // Métodos de pago disponibles
  paymentMethods: [
    { value: 'transfer', label: 'Transferencia Bancaria' },
    { value: 'card', label: 'Tarjeta de Crédito/Débito' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'other', label: 'Otro' }
  ],
  
  // Estados de los gimnasios
  gymStatuses: [
    { value: 'active', label: 'Activo' },
    { value: 'trial', label: 'En Prueba' },
    { value: 'suspended', label: 'Suspendido' }
  ]
};
