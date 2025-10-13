// src/types/member.types.ts - VERSIÓN ACTUALIZADA CON NUEVOS CAMPOS
// ✅ AGREGANDO CAMPOS DE EMERGENCIA Y CUESTIONARIO

import { FirebaseDate as CentralFirebaseDate } from './firebase.types';

export type FirebaseDate = CentralFirebaseDate;

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  birthDate?: FirebaseDate;
  photo?: string | null;
  status: 'active' | 'inactive';
  totalDebt: number;
  lastAttendance?: FirebaseDate;
  createdAt?: FirebaseDate;
  updatedAt?: FirebaseDate;
  daysUntilBirthday?: number;
  dni?: string;
  memberNumber?: number;
  hasDebt: boolean;
  activeMemberships: number;
  
  // ✅ NUEVOS CAMPOS - CONTACTO DE EMERGENCIA
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // ✅ NUEVOS CAMPOS - CUESTIONARIO DE SALUD Y FITNESS
  hasExercisedBefore?: 'yes' | 'no';
  fitnessGoal?: string[];
  fitnessGoalOther?: string; // Campo adicional si eligió "otra"
  medicalConditions?: string; // Texto libre
  injuries?: string; // Texto libre
  allergies?: string; // Texto libre
  hasMedicalCertificate?: 'yes' | 'no';
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
  dni?: string;
  memberNumber?: number;
  
  // ✅ NUEVOS CAMPOS - CONTACTO DE EMERGENCIA
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // ✅ NUEVOS CAMPOS - CUESTIONARIO
  hasExercisedBefore?: 'yes' | 'no';
  fitnessGoal?: string[]; // ✅ CAMBIAR A ARRAY
  fitnessGoalOther?: string;
  medicalConditions?: string;
  injuries?: string;
  allergies?: string;
  hasMedicalCertificate?: 'yes' | 'no';
}

export interface MembershipAssignment {
  id?: string;
  memberId: string;
  memberName?: string;
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
  autoRenewal?: boolean;
  paymentFrequency?: 'single' | 'monthly';
  lastRenewalDate?: string;
  renewedAutomatically?: boolean;
  renewedManually?: boolean;
  previousMembershipId?: string;
  renewedAt?: any;
  cancelReason?: string;
  cancelDate?: any;
  cancelledBy?: string;
  debtAction?: 'keep' | 'cancel';
  paidAmount?: number;
  paidAt?: any;
  partialPayments?: {
    amount: number;
    date: any;
    transactionId: string;
  }[];
  cancelledAt?: any;
  cancellationReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

const memberTypes = {
  createEmptyMember: (): Member => ({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'active',
    totalDebt: 0,
    hasDebt: false,
    activeMemberships: 0,
    // Nuevos valores por defecto
    emergencyContactName: '',
    emergencyContactPhone: '',
    hasExercisedBefore: undefined,
    fitnessGoal: [], // ✅ ARRAY vacío por defecto
    medicalConditions: '',
    injuries: '',
    allergies: '',
    hasMedicalCertificate: undefined
  }),
  
  createEmptyMemberFormData: (): MemberFormData => ({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    photo: null,
    status: 'active',
    dni: '',
    memberNumber: 0,
    // Nuevos valores por defecto
    emergencyContactName: '',
    emergencyContactPhone: '',
    hasExercisedBefore: undefined,
    fitnessGoal: [], // ✅ ARRAY vacío por defecto
    fitnessGoalOther: '',
    medicalConditions: '',
    injuries: '',
    allergies: '',
    hasMedicalCertificate: undefined
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
    autoRenewal: false,
    paymentFrequency: 'single',
    renewedAutomatically: false,
    renewedManually: false
  })
};

export default memberTypes;