// src/types/index.ts

// Importar los tipos
import { 
  Gym as GymType, 
  BusinessProfile as BusinessProfileType, 
  Activity as ActivityType, 
  Transaction as TransactionType, 
  DailyCash as DailyCashType, 
  Attendance as AttendanceType 
} from './gym.types';

import { 
  Member as MemberType, 
  MemberFormData as MemberFormDataType, 
  MembershipAssignment as MembershipAssignmentType 
} from './member.types';

import { 
  Membership as MembershipType, 
  MembershipFormData as MembershipFormDataType, 
  FormErrors as FormErrorsType 
} from './membership.types';

import { 
  User as UserType, 
  LoginFormData as LoginFormDataType, 
  RegisterFormData as RegisterFormDataType 
} from './auth.types';

import { 
  SubscriptionPlan as SubscriptionPlanType, 
  GymSubscription as GymSubscriptionType, 
  SubscriptionPayment as SubscriptionPaymentType 
} from './subscription.types';

// Importar los objetos con las funciones de ayuda
import memberTypes from './member.types';
import membershipTypes from './membership.types';
import authTypes from './auth.types';
import subscriptionTypes from './subscription.types';

// Con TypeScript se recomienda usar 'export type' cuando se trabaja con módulos aislados
export type Gym = GymType;
export type BusinessProfile = BusinessProfileType;
export type Activity = ActivityType;
export type Transaction = TransactionType;
export type DailyCash = DailyCashType;
export type Attendance = AttendanceType;

export type Member = MemberType;
export type MemberFormData = MemberFormDataType;
export type MembershipAssignment = MembershipAssignmentType;

export type Membership = MembershipType;
export type MembershipFormData = MembershipFormDataType;
export type FormErrors = FormErrorsType;

export type User = UserType;
export type LoginFormData = LoginFormDataType;
export type RegisterFormData = RegisterFormDataType;

export type SubscriptionPlan = SubscriptionPlanType;
export type GymSubscription = GymSubscriptionType;
export type SubscriptionPayment = SubscriptionPaymentType;

// Para gym.types no necesitamos un objeto con funciones porque lo exportaremos explícitamente
const gymTypes = {
  // Añadir aquí las funciones que necesites de gym.types
};

// Exportar un objeto con todas las funciones de utilidad
const types = {
  gym: gymTypes,
  member: memberTypes,
  membership: membershipTypes,
  auth: authTypes,
  subscription: subscriptionTypes
};

// Exportar el objeto principal
export default types;