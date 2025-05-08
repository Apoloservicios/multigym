// src/types/subscription.types.ts

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration: number; // días
  price: number;
  features: string[];
  isActive: boolean;
}

export interface GymSubscription {
  id: string;
  gymId: string;
  planId: string;
  planName: string;
  startDate: any; // Timestamp de Firebase
  endDate: any; // Timestamp de Firebase
  price: number;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  paymentMethod: string;
  paymentDate: any; // Timestamp de Firebase
  renewalRequested: boolean;
  autoRenewal: boolean;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  gymId: string;
  amount: number;
  date: any; // Timestamp de Firebase
  method: 'transfer' | 'card' | 'cash' | 'other';
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
  notes?: string;
}

// Objeto con funciones útiles relacionadas con estos tipos
const subscriptionTypes = {
  createEmptySubscriptionPlan: (): SubscriptionPlan => ({
    id: '',
    name: '',
    duration: 30,
    price: 0,
    features: [],
    isActive: true
  }),
  
  createEmptyGymSubscription: (): GymSubscription => ({
    id: '',
    gymId: '',
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
  
  createEmptySubscriptionPayment: (): SubscriptionPayment => ({
    id: '',
    subscriptionId: '',
    gymId: '',
    amount: 0,
    date: new Date(),
    method: 'transfer',
    status: 'pending'
  }),
  
  // Calcular fecha de finalización basada en una fecha de inicio y duración
  calculateEndDate: (startDate: Date, durationDays: number): Date => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    return endDate;
  }
};

export default subscriptionTypes;