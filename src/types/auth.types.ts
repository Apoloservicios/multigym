// src/types/auth.types.ts

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  phone?: string;
  createdAt: any; // Timestamp de Firebase
  lastLogin?: any; // Timestamp de Firebase
  isActive: boolean;
}

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
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  gymName: string;
  ownerName: string;
  phone: string;
  cuit: string;
}

// Objeto con funciones útiles relacionadas con estos tipos
const authTypes = {
  createEmptyUser: (): User => ({
    id: '',
    email: '',
    name: '',
    role: 'user',
    createdAt: new Date(),
    isActive: true
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
  
  createEmptyLoginFormData: (): LoginFormData => ({
    email: '',
    password: ''
  }),
  
  createEmptyRegisterFormData: (): RegisterFormData => ({
    email: '',
    password: '',
    confirmPassword: '',
    gymName: '',
    ownerName: '',
    phone: '',
    cuit: ''
  })
};

export default authTypes;