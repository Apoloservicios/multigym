// src/types/gym.types.ts
// 🔧 TIPOS ACTUALIZADOS - PASO 4: PREPARAR PARA PRODUCTOS
// Nuevos campos para productos + mejoras en caja diaria
// 🆕 AGREGADO: MembershipAssignment para el nuevo sistema de renovaciones

// ===================== TIPOS EXISTENTES MEJORADOS =====================

export interface DailyCash {
  id?: string;
  gymId: string;
  date: string; // YYYY-MM-DD
  openingTime?: any; // Firebase Timestamp
  openedAt?: any; // 🔧 MANTENER COMPATIBILIDAD - alias para openingTime
  closingTime?: any; // Firebase Timestamp
  closedAt?: any; // 🔧 MANTENER COMPATIBILIDAD - alias para closingTime
  openingAmount: number;
  openingBalance?: number; // 🔧 MANTENER COMPATIBILIDAD - alias para openingAmount
  closingAmount?: number;
  expectedOpeningAmount?: number; // 🆕 Saldo esperado desde día anterior
  expectedClosingAmount?: number; // 🆕 Saldo calculado esperado
  cashDifference?: number; // 🆕 Diferencia entre físico y esperado
  lastUpdated?: any; // 🔧 AGREGAR para compatibilidad con otros servicios
  
  // Ingresos categorizados
  totalIncome: number;
  membershipIncome: number;
  productIncome?: number; // 🆕 Para productos futuros
  otherIncome: number;
  
  // Egresos categorizados
  totalExpense: number;
  totalExpenses?: number; // Mantener compatibilidad
  
  // Totales calculados
  netAmount?: number; // 🆕 Total de ingresos - egresos
  transactionCount?: number; // 🆕 Cantidad de transacciones del día
  
  // Estado y control
  status: 'open' | 'closed';
  openedBy: string;
  openedByName?: string; // 🆕 Nombre del usuario que abrió
  closedBy?: string;
  closedByName?: string; // 🆕 Nombre del usuario que cerró
  notes?: string;
  closingNotes?: string; // 🆕 Notas específicas del cierre
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

// ===================== TIPOS EXPANDIDOS PARA TRANSACCIONES =====================

// Categorías de ingresos expandidas
export type TransactionIncomeCategory = 
  | 'membership'    // Pagos de membresías
  | 'product'       // 🆕 Venta de productos (agua, vitaminas, etc.)
  | 'service'       // 🆕 Servicios adicionales
  | 'penalty'       // Multas o penalizaciones
  | 'other';        // Otros ingresos

// Categorías de egresos expandidas
export type TransactionExpenseCategory = 
  | 'expense'       // Gastos operativos generales
  | 'refund'        // Reintegros/devoluciones
  | 'withdrawal'    // Retiros de efectivo
  | 'supplier'      // 🆕 Pagos a proveedores
  | 'services'      // 🆕 Servicios contratados
  | 'maintenance'   // 🆕 Mantenimiento de equipos
  | 'salary'        // 🆕 Pagos de sueldos
  | 'product'       // 🆕 Compra de productos para revender
  | 'other';        // Otros gastos

export type TransactionCategory = TransactionIncomeCategory | TransactionExpenseCategory;

// ===================== INTERFACE TRANSACTION MEJORADA =====================

export interface Transaction {
  id?: string;
  type: 'income' | 'expense';
  category: TransactionCategory;
  amount: number;
  description: string;
  date: any; // Firebase Timestamp
  userId: string;
  userName: string;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Información adicional para membresías
  memberId?: string;
  memberName?: string;
  membershipId?: string;
  
  // 🆕 Información adicional para productos
  productId?: string; // ID del producto vendido
  productName?: string; // Nombre del producto
  quantity?: number; // Cantidad vendida
  unitPrice?: number; // Precio unitario
  
  // 🆕 Información adicional para servicios
  serviceId?: string; // ID del servicio
  serviceName?: string; // Nombre del servicio
  
  // Referencias y notas
  referenceId?: string; // Referencia a documento relacionado
  notes?: string;
  
  // Control de devoluciones
  refundedAt?: any; // Firebase Timestamp
  refundedBy?: string;
  refundReason?: string;
  originalTransactionId?: string; // Para reintegros
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

// ===================== 🆕 TIPOS PARA EL NUEVO SISTEMA DE RENOVACIONES =====================

// 🎯 TIPO PRINCIPAL PARA MEMBRESÍAS - SOLUCIÓN AL ERROR
export interface MembershipAssignment {
  id: string;
  memberId: string;
  memberName: string;
  activityId: string;
  activityName: string;
  cost: number;
  startDate: string;
  endDate: string;
  
  // 🎯 CAMPOS PRINCIPALES DEL NUEVO SISTEMA
  autoRenewal: boolean;          // Auto-renovación activada/desactivada
  paymentType: 'monthly';        // Solo pagos mensuales
  paymentStatus: 'paid' | 'pending' | 'overdue';
  
  status: 'active' | 'expired' | 'cancelled';
  assignedBy: string;
  assignedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  
  // Campos opcionales adicionales
  notes?: string;
  lastRenewalDate?: string;
  nextBillingDate?: string;
}

// ===================== NUEVOS TIPOS PARA PRODUCTOS =====================

export interface Product {
  id?: string;
  gymId: string;
  name: string;
  description?: string;
  category: ProductCategory;
  price: number;
  cost?: number; // Costo de adquisición
  stock: number;
  minStock?: number; // Stock mínimo para alertas
  maxStock?: number; // Stock máximo
  
  // Control de inventario
  stockMovements?: ProductStockMovement[];
  
  // Información adicional
  barcode?: string;
  sku?: string; // Código de producto
  supplier?: string;
  expirationDate?: string; // Para productos perecederos
  
  // Estado
  status: 'active' | 'inactive' | 'discontinued';
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

export type ProductCategory = 
  | 'beverages'     // Bebidas (agua, gatorade, etc.)
  | 'supplements'   // Suplementos y vitaminas
  | 'clothing'      // Ropa y accesorios
  | 'equipment'     // Equipamiento deportivo
  | 'accessories'   // Accesorios varios
  | 'food'         // Alimentos
  | 'other';       // Otros

export interface ProductStockMovement {
  id?: string;
  type: 'sale' | 'purchase' | 'adjustment' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  transactionId?: string; // Referencia a la transacción de venta
  userId: string;
  userName: string;
  date: any; // Firebase Timestamp
}

export interface ProductSale {
  id?: string;
  gymId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  
  // Cliente (opcional)
  memberId?: string;
  memberName?: string;
  customerName?: string; // Para ventas a no socios
  
  // Información de la venta
  userId: string;
  userName: string;
  paymentMethod: string;
  transactionId?: string; // Referencia a la transacción en caja
  
  // Timestamps
  createdAt?: any;
}

// ===================== TIPOS PARA SERVICIOS ADICIONALES =====================

export interface AdditionalService {
  id?: string;
  gymId: string;
  name: string;
  description?: string;
  price: number;
  duration?: number; // Duración en minutos
  category: ServiceCategory;
  
  // Control de disponibilidad
  isActive: boolean;
  requiresReservation?: boolean;
  maxParticipants?: number;
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

export type ServiceCategory = 
  | 'personal_training'  // Entrenamiento personal
  | 'nutrition'         // Consulta nutricional  
  | 'massage'           // Masajes
  | 'evaluation'        // Evaluaciones físicas
  | 'therapy'          // Terapias
  | 'classes'          // Clases especiales
  | 'other';           // Otros servicios

export interface ServiceBooking {
  id?: string;
  gymId: string;
  serviceId: string;
  serviceName: string;
  
  // Cliente
  memberId?: string;
  memberName?: string;
  customerName?: string; // Para no socios
  customerPhone?: string;
  customerEmail?: string;
  
  // Programación
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration: number; // Minutos
  
  // Estado
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  
  // Pago
  price: number;
  paymentStatus: 'pending' | 'paid';
  transactionId?: string;
  
  // Información adicional
  notes?: string;
  providerId?: string; // ID del profesional que brinda el servicio
  providerName?: string;
  
  // Timestamps
  createdAt?: any;
  updatedAt?: any;
}

// ===================== TIPOS AUXILIARES =====================

export interface CashRegisterSummary {
  date: string;
  openingAmount: number;
  closingAmount?: number;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  
  // Breakdown detallado
  membershipIncome: number;
  productIncome: number;
  serviceIncome: number;
  otherIncome: number;
  
  operationalExpenses: number;
  refunds: number;
  adjustments: number;
  
  // Control
  transactionCount: number;
  isConsistent: boolean;
  difference?: number;
}

export interface FinancialReport {
  period: {
    startDate: string;
    endDate: string;
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
  
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
  };
  
  breakdown: {
    membershipRevenue: number;
    productRevenue: number;
    serviceRevenue: number;
    otherRevenue: number;
    
    operationalExpenses: number;
    productCosts: number;
    salaries: number;
    maintenance: number;
    otherExpenses: number;
  };
  
  dailySummaries: CashRegisterSummary[];
  topProducts?: { productName: string; quantity: number; revenue: number; }[];
  topServices?: { serviceName: string; bookings: number; revenue: number; }[];
}


export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: any;
  updatedAt?: any;
  dni?: string;
  address?: string;
  birthDate?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  memberNumber?: string;
  joinDate?: string;
  totalDebt?: number; // Agregar este campo si no existe
}

// ===================== TIPOS EXISTENTES (MANTENIDOS PARA COMPATIBILIDAD) =====================

// Mantener tipos existentes para no romper código actual
export interface Gym {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo?: string;
  settings?: GymSettings;
  createdAt?: any;
  updatedAt?: any;
}

export interface GymSettings {
  defaultMembershipDuration?: number;
  defaultPaymentMethod?: string;
  currency?: string;
  timezone?: string;
  businessHours?: BusinessHours;
  autoRenewal?: AutoRenewalSettings;
  notifications?: NotificationSettings;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime?: string; // HH:MM
  closeTime?: string; // HH:MM
  breakStart?: string; // HH:MM
  breakEnd?: string; // HH:MM
}

export interface AutoRenewalSettings {
  enabled: boolean;
  daysBeforeExpiration?: number;
  notifyMember?: boolean;
  notifyStaff?: boolean;
  autoCharge?: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  reminderDays: number[];
}

// ===================== TIPOS AUXILIARES PARA VALIDACIÓN =====================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface CashValidationResult {
  isValid: boolean;
  expectedAmount: number;
  physicalAmount: number;
  difference: number;
  percentageDiff: number;
  tolerance: number;
}

export interface StockValidationResult {
  isValid: boolean;
  product: Product;
  currentStock: number;
  requestedQuantity: number;
  availableStock: number;
  isInsufficientStock: boolean;
}

// ===================== TIPOS PARA REPORTES Y ANALYTICS =====================

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  
  // Financiero
  todayRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalDebt: number;
  
  // Productos (futuro)
  totalProducts?: number;
  lowStockProducts?: number;
  topSellingProduct?: string;
  
  // Servicios (futuro)
  todayBookings?: number;
  monthlyBookings?: number;
  completedServices?: number;
  
  // Asistencia
  todayAttendance: number;
  weeklyAttendance: number;
  monthlyAttendance: number;
  
  // Vencimientos
  expiringMemberships: number;
  expiredMemberships: number;
  upcomingRenewals: number;
}

export interface SalesReport {
  period: {
    startDate: string;
    endDate: string;
  };
  
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  
  salesByCategory: {
    memberships: number;
    products: number;
    services: number;
    other: number;
  };
  
  salesByPaymentMethod: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
  };
  
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    profit?: number;
  }>;
  
  dailyBreakdown: Array<{
    date: string;
    sales: number;
    transactions: number;
  }>;
}

// ===================== TIPOS PARA INTEGRACIÓN CON ESTADO DE CUENTA =====================

export interface MemberAccountStatement {
  memberId: string;
  memberName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  
  summary: {
    totalCharges: number;
    totalPayments: number;
    currentBalance: number;
    previousBalance: number;
  };
  
  transactions: Array<{
    id: string;
    date: string;
    type: 'charge' | 'payment' | 'adjustment';
    description: string;
    amount: number;
    balance: number;
    paymentMethod?: string;
    reference?: string;
  }>;
  
  memberships: Array<{
    id: string;
    activityName: string;
    startDate: string;
    endDate: string;
    cost: number;
    status: 'active' | 'expired' | 'cancelled';
    paymentStatus: 'paid' | 'pending' | 'overdue';
  }>;
  
  productPurchases?: Array<{
    id: string;
    date: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
  
  serviceBookings?: Array<{
    id: string;
    date: string;
    serviceName: string;
    price: number;
    status: 'completed' | 'scheduled' | 'cancelled';
  }>;
}

// ===================== TIPOS PARA CONFIGURACIÓN DEL SISTEMA =====================

export interface SystemConfiguration {
  gymId: string;
  
  // Configuración de caja
  cashSettings: {
    requireDailyOpen: boolean;
    requireDailyClose: boolean;
    allowNegativeBalance: boolean;
    cashTolerance: number; // Tolerancia en diferencias de caja
    autoCreateDailyCash: boolean;
  };
  
  // Configuración de productos
  productSettings?: {
    enableInventory: boolean;
    requireStockControl: boolean;
    lowStockThreshold: number;
    allowNegativeStock: boolean;
    autoDeductStock: boolean;
  };
  
  // Configuración de servicios
  serviceSettings?: {
    enableServices: boolean;
    requireReservation: boolean;
    allowWalkIns: boolean;
    defaultDuration: number;
    reminderMinutes: number;
  };
  
  // Configuración de pagos
  paymentSettings: {
    defaultPaymentMethod: string;
    allowPartialPayments: boolean;
    autoGenerateMonthly: boolean;
    monthlyGenerationDay: number;
    allowOverpayments: boolean;
  };
  
  // Configuración de notificaciones
  notificationSettings: {
    enableEmailNotifications: boolean;
    enableSMSNotifications: boolean;
    reminderDays: number[];
    overdueReminderDays: number[];
  };
}

// ===================== EXPORTS PARA COMPATIBILIDAD =====================

// Re-exportar tipos comunes para mantener imports existentes
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type MembershipStatus = 'active' | 'inactive' | 'suspended' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

// Mantener interfaces legacy si es necesario
export interface LegacyTransaction {
  id?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: any;
  userId: string;
  userName: string;
  paymentMethod: string;
  status: string;
  memberId?: string;
  memberName?: string;
  membershipId?: string;
  notes?: string;
  createdAt?: any;
}

export interface LegacyDailyCash {
  id?: string;
  gymId: string;
  date: string;
  openingTime?: any;
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
  createdAt?: any;
  updatedAt?: any;
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
  timestamp: any; // Firebase Timestamp
  status: 'success' | 'error' | 'pending';
  error?: string;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
}