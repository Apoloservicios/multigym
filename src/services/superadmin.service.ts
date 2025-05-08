// src/services/superadmin.service.ts

import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc,
    query,
    where,
    orderBy,
    limit as limitQuery,
    Timestamp,
    serverTimestamp
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import {
    SubscriptionPlan,
    GymSubscription,
    Payment,
    Gym,
    SuperadminStats,
    SubscriptionChartData,
    RevenueChartData
  } from '../types/superadmin.types';
  import { toJsDate } from '../utils/date.utils';
  
  // ============= PLANES DE SUSCRIPCIÓN =============
  
  // Obtener todos los planes de suscripción
  export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
    try {
      const plansRef = collection(db, 'subscriptionPlans');
      const q = query(plansRef, orderBy('price'));
      const querySnapshot = await getDocs(q);
      
      const plans: SubscriptionPlan[] = [];
      querySnapshot.forEach(doc => {
        plans.push({
          id: doc.id,
          ...doc.data()
        } as SubscriptionPlan);
      });
      
      return plans;
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  };
  
  // Obtener un plan de suscripción por ID
  export const getSubscriptionPlanById = async (planId: string): Promise<SubscriptionPlan | null> => {
    try {
      const planRef = doc(db, 'subscriptionPlans', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        return {
          id: planSnap.id,
          ...planSnap.data()
        } as SubscriptionPlan;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting subscription plan:', error);
      throw error;
    }
  };
  
  // Crear un nuevo plan de suscripción
  export const createSubscriptionPlan = async (plan: Omit<SubscriptionPlan, 'id'>): Promise<SubscriptionPlan> => {
    try {
      const plansRef = collection(db, 'subscriptionPlans');
      
      const newPlan = {
        ...plan,
        isActive: plan.isActive !== undefined ? plan.isActive : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(plansRef, newPlan);
      
      return {
        id: docRef.id,
        ...plan
      } as SubscriptionPlan;
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  };
  
  // Actualizar un plan de suscripción
  export const updateSubscriptionPlan = async (planId: string, plan: Partial<SubscriptionPlan>): Promise<boolean> => {
    try {
      const planRef = doc(db, 'subscriptionPlans', planId);
      
      const updateData = {
        ...plan,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(planRef, updateData);
      return true;
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      throw error;
    }
  };
  
  // Eliminar un plan de suscripción
  export const deleteSubscriptionPlan = async (planId: string): Promise<boolean> => {
    try {
      // Comprobar si hay gimnasios usando este plan
      const subscriptionsRef = collection(db, 'subscriptions');
      const q = query(subscriptionsRef, where('planId', '==', planId), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error('No se puede eliminar el plan porque hay gimnasios que lo están utilizando');
      }
      
      const planRef = doc(db, 'subscriptionPlans', planId);
      await deleteDoc(planRef);
      return true;
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      throw error;
    }
  };
  
  // ============= SUSCRIPCIONES DE GIMNASIOS =============
  
  // Obtener todas las suscripciones
  export const getGymSubscriptions = async (status?: string): Promise<GymSubscription[]> => {
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      
      let q;
      if (status) {
        q = query(
          subscriptionsRef, 
          where('status', '==', status),
          orderBy('endDate', 'desc')
        );
      } else {
        q = query(
          subscriptionsRef, 
          orderBy('endDate', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const subscriptions: GymSubscription[] = [];
      querySnapshot.forEach(doc => {
        subscriptions.push({
          id: doc.id,
          ...doc.data()
        } as GymSubscription);
      });
      
      return subscriptions;
    } catch (error) {
      console.error('Error getting gym subscriptions:', error);
      throw error;
    }
  };
  
  // Obtener suscripciones por vencer en los próximos X días
  export const getExpiringSubscriptions = async (days: number = 7): Promise<GymSubscription[]> => {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);
      
      const subscriptionsRef = collection(db, 'subscriptions');
      const q = query(
        subscriptionsRef,
        where('status', '==', 'active'),
        where('endDate', '>=', Timestamp.fromDate(now)),
        where('endDate', '<=', Timestamp.fromDate(futureDate)),
        orderBy('endDate')
      );
      
      const querySnapshot = await getDocs(q);
      
      const subscriptions: GymSubscription[] = [];
      querySnapshot.forEach(doc => {
        subscriptions.push({
          id: doc.id,
          ...doc.data()
        } as GymSubscription);
      });
      
      return subscriptions;
    } catch (error) {
      console.error('Error getting expiring subscriptions:', error);
      throw error;
    }
  };
  
  // Obtener una suscripción por ID
  export const getSubscriptionById = async (subscriptionId: string): Promise<GymSubscription | null> => {
    try {
      const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
      const subscriptionSnap = await getDoc(subscriptionRef);
      
      if (subscriptionSnap.exists()) {
        return {
          id: subscriptionSnap.id,
          ...subscriptionSnap.data()
        } as GymSubscription;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw error;
    }
  };
  
  // Asignar una suscripción a un gimnasio
  export const assignSubscription = async (
    gymId: string,
    planId: string,
    startDate: Date,
    paymentMethod: string,
    notes?: string
  ): Promise<GymSubscription> => {
    try {
      // Obtener los datos del gimnasio
      const gymRef = doc(db, 'gyms', gymId);
      const gymSnap = await getDoc(gymRef);
      
      if (!gymSnap.exists()) {
        throw new Error('El gimnasio no existe');
      }
      
      const gymData = { 
        ...gymSnap.data(),
        id: gymSnap.id 
      } as Gym;
      
      // Obtener el plan seleccionado
      const planRef = doc(db, 'subscriptionPlans', planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) {
        throw new Error('El plan seleccionado no existe');
      }
      
      const plan = { id: planSnap.id, ...planSnap.data() } as SubscriptionPlan;
      
      // Calcular fecha de finalización
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.duration);
      
      // Crear registro de suscripción
      const subscriptionData = {
        gymId,
        gymName: gymData.name,
        planId,
        planName: plan.name,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        price: plan.price,
        status: 'active',
        paymentMethod,
        paymentDate: Timestamp.fromDate(new Date()),
        renewalRequested: false,
        autoRenewal: false,
        notes,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'subscriptions'), subscriptionData);
      
      // Actualizar el gimnasio
      await updateDoc(gymRef, {
        status: 'active',
        'subscriptionData.plan': plan.name,
        'subscriptionData.startDate': Timestamp.fromDate(startDate),
        'subscriptionData.endDate': Timestamp.fromDate(endDate),
        'subscriptionData.price': plan.price,
        'subscriptionData.paymentMethod': paymentMethod,
        'subscriptionData.lastPayment': Timestamp.fromDate(new Date()),
        'subscriptionData.renewalRequested': false,
        updatedAt: serverTimestamp()
      });
      
      // Crear registro de pago
      const paymentData = {
        subscriptionId: docRef.id,
        gymId,
        gymName: gymData.name,
        amount: plan.price,
        date: Timestamp.fromDate(new Date()),
        method: paymentMethod,
        status: 'completed',
        notes,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'subscriptionPayments'), paymentData);
      
      // Convertir createdAt a Date para compatibilidad con FirebaseDate
      const finalSubscriptionData = {
        ...subscriptionData,
        id: docRef.id,
        createdAt: new Date()
      } as unknown as GymSubscription;
      
      return finalSubscriptionData;
    } catch (error) {
      console.error('Error assigning subscription:', error);
      throw error;
    }
  };
  
  // Renovar una suscripción
  export const renewSubscription = async (
    subscriptionId: string,
    paymentMethod: string,
    autoRenewal: boolean = false,
    notes?: string
  ): Promise<GymSubscription> => {
    try {
      // Obtener la suscripción actual
      const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
      const subscriptionSnap = await getDoc(subscriptionRef);
      
      if (!subscriptionSnap.exists()) {
        throw new Error('La suscripción no existe');
      }
      
      const currentSubscription = { 
        id: subscriptionSnap.id, 
        ...subscriptionSnap.data() 
      } as GymSubscription;
      
      // Obtener el plan actual
      const planRef = doc(db, 'subscriptionPlans', currentSubscription.planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) {
        throw new Error('El plan de suscripción no existe');
      }
      
      const plan = { id: planSnap.id, ...planSnap.data() } as SubscriptionPlan;
      
      // Calcular nuevas fechas de inicio y fin
      const now = new Date();
      let startDate: Date;
      
      // Si la suscripción actual no ha expirado, comenzar desde la fecha de finalización
      if (toJsDate(currentSubscription.endDate)! > now) {
        startDate = toJsDate(currentSubscription.endDate)!;
      } else {
        startDate = now;
      }
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + plan.duration);
      
      // Marcar la suscripción actual como renovada
      await updateDoc(subscriptionRef, {
        status: 'active',
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        paymentMethod,
        paymentDate: Timestamp.fromDate(now),
        renewalRequested: false,
        autoRenewal,
        lastRenewalDate: Timestamp.fromDate(now),
        nextRenewalDate: autoRenewal ? Timestamp.fromDate(endDate) : null,
        updatedAt: serverTimestamp()
      });
      
      // Actualizar el gimnasio
      const gymRef = doc(db, 'gyms', currentSubscription.gymId);
      await updateDoc(gymRef, {
        status: 'active',
        'subscriptionData.startDate': Timestamp.fromDate(startDate),
        'subscriptionData.endDate': Timestamp.fromDate(endDate),
        'subscriptionData.paymentMethod': paymentMethod,
        'subscriptionData.lastPayment': Timestamp.fromDate(now),
        'subscriptionData.renewalRequested': false,
        updatedAt: serverTimestamp()
      });
      
      // Crear registro de pago
      const paymentData = {
        subscriptionId,
        gymId: currentSubscription.gymId,
        gymName: currentSubscription.gymName,
        amount: plan.price,
        date: Timestamp.fromDate(now),
        method: paymentMethod,
        status: 'completed',
        notes: notes || 'Renovación de suscripción',
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'subscriptionPayments'), paymentData);
      
      // Obtener la suscripción actualizada
      const updatedSubscriptionSnap = await getDoc(subscriptionRef);
      
      return {
        id: updatedSubscriptionSnap.id,
        ...updatedSubscriptionSnap.data()
      } as GymSubscription;
    } catch (error) {
      console.error('Error renewing subscription:', error);
      throw error;
    }
  };
  
  // Cancelar una suscripción
  export const cancelSubscription = async (
    subscriptionId: string,
    cancelReason: string
  ): Promise<boolean> => {
    try {
      const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
      const subscriptionSnap = await getDoc(subscriptionRef);
      
      if (!subscriptionSnap.exists()) {
        throw new Error('La suscripción no existe');
      }
      
      const subscription = { 
        id: subscriptionSnap.id, 
        ...subscriptionSnap.data() 
      } as GymSubscription;
      
      // Actualizar suscripción
      await updateDoc(subscriptionRef, {
        status: 'cancelled',
        autoRenewal: false,
        notes: cancelReason,
        updatedAt: serverTimestamp()
      });
      
      // Actualizar gimnasio
      const gymRef = doc(db, 'gyms', subscription.gymId);
      await updateDoc(gymRef, {
        status: 'suspended',
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  };
  
  // ============= PAGOS =============
  
  // Obtener pagos en un rango de fechas
  export const getPayments = async (startDate: Date, endDate: Date): Promise<Payment[]> => {
    try {
      const paymentsRef = collection(db, 'subscriptionPayments');
      const q = query(
        paymentsRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const payments: Payment[] = [];
      querySnapshot.forEach(doc => {
        payments.push({
          id: doc.id,
          ...doc.data()
        } as Payment);
      });
      
      return payments;
    } catch (error) {
      console.error('Error getting payments:', error);
      throw error;
    }
  };
  
  // Registrar un nuevo pago
  export const registerPayment = async (payment: Omit<Payment, 'id'>): Promise<Payment> => {
    try {
      const paymentsRef = collection(db, 'subscriptionPayments');
      
      const newPayment = {
        ...payment,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(paymentsRef, newPayment);
      
      // Si el pago es para una suscripción, actualizar la suscripción
      if (payment.subscriptionId) {
        const subscriptionRef = doc(db, 'subscriptions', payment.subscriptionId);
        const subscriptionSnap = await getDoc(subscriptionRef);
        
        if (subscriptionSnap.exists()) {
          await updateDoc(subscriptionRef, {
            paymentDate: payment.date,
            paymentMethod: payment.method,
            status: payment.status === 'completed' ? 'active' : 'pending',
            updatedAt: serverTimestamp()
          });
          
          // También actualizar el gimnasio si el pago es exitoso
          if (payment.status === 'completed') {
            const gymRef = doc(db, 'gyms', payment.gymId);
            await updateDoc(gymRef, {
              status: 'active',
              'subscriptionData.lastPayment': payment.date,
              'subscriptionData.paymentMethod': payment.method,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
      
      return {
        id: docRef.id,
        ...payment
      } as Payment;
    } catch (error) {
      console.error('Error registering payment:', error);
      throw error;
    }
  };
  
  // Generar reporte de ingresos
  export const generateRevenueReport = async (startDate: Date, endDate: Date): Promise<string> => {
    try {
      // En un entorno real, esto generaría un archivo Excel o similar
      // Para este ejemplo, retornamos un URL de descarga simulado
      return 'data:text/csv;charset=utf-8,' + encodeURIComponent('Reporte de ingresos generado');
    } catch (error) {
      console.error('Error generating revenue report:', error);
      throw error;
    }
  };
  
  // ============= GIMNASIOS =============
  
  // Obtener todos los gimnasios
  export const getGyms = async (status?: string): Promise<Gym[]> => {
    try {
      const gymsRef = collection(db, 'gyms');
      
      let q;
      if (status) {
        q = query(
          gymsRef, 
          where('status', '==', status),
          orderBy('registrationDate', 'desc')
        );
      } else {
        q = query(
          gymsRef, 
          orderBy('registrationDate', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const gyms: Gym[] = [];
      querySnapshot.forEach(doc => {
        gyms.push({
          id: doc.id,
          ...doc.data()
        } as Gym);
      });
      
      return gyms;
    } catch (error) {
      console.error('Error getting gyms:', error);
      throw error;
    }
  };
  
  // Crear un nuevo gimnasio
  export const createGym = async (gymData: Omit<Gym, 'id'>): Promise<Gym> => {
    try {
      // En un sistema real aquí se crearía también el usuario admin del gimnasio
      
      // Verificar si el gimnasio ya existe con el mismo email
      const gymsRef = collection(db, 'gyms');
      const emailQuery = query(gymsRef, where('email', '==', gymData.email));
      const querySnapshot = await getDocs(emailQuery);
      
      if (!querySnapshot.empty) {
        throw new Error('Ya existe un gimnasio registrado con este email');
      }
      
      // Crear el gimnasio
      const newGym = {
        ...gymData,
        status: gymData.status || 'trial',
        registrationDate: Timestamp.now(),
        trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)), // 10 días de prueba
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(gymsRef, newGym);
      
      // Convertir createdAt a Date para compatibilidad con FirebaseDate
      const finalGymData = {
        ...newGym,
        id: docRef.id,
        createdAt: new Date()
      } as unknown as Gym;
      
      return finalGymData;
    } catch (error) {
      console.error('Error creating gym:', error);
      throw error;
    }
  };
  
  // Actualizar un gimnasio
  export const updateGym = async (gymId: string, gymData: Partial<Gym>): Promise<boolean> => {
    try {
      const gymRef = doc(db, 'gyms', gymId);
      
      // Si estamos cambiando el email, verificar que no exista otro gimnasio con ese email
      if (gymData.email) {
        const gymsRef = collection(db, 'gyms');
        const emailQuery = query(
          gymsRef, 
          where('email', '==', gymData.email),
          where('__name__', '!=', gymId) // Excluir el propio gimnasio
        );
        const querySnapshot = await getDocs(emailQuery);
        
        if (!querySnapshot.empty) {
          throw new Error('Ya existe otro gimnasio registrado con este email');
        }
      }
      
      await updateDoc(gymRef, {
        ...gymData,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating gym:', error);
      throw error;
    }
  };
  
  // Actualizar el estado de un gimnasio
  export const updateGymStatus = async (
    gymId: string, 
    status: 'active' | 'trial' | 'suspended',
    notes?: string
  ): Promise<boolean> => {
    try {
      const gymRef = doc(db, 'gyms', gymId);
      
      await updateDoc(gymRef, {
        status,
        statusNotes: notes,
        updatedAt: serverTimestamp()
      });
      
      // Si el estado es 'trial', actualizar la fecha de fin de prueba
      if (status === 'trial') {
        await updateDoc(gymRef, {
          trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)) // 10 días de prueba
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error updating gym status:', error);
      throw error;
    }
  };
  
  // ============= ESTADÍSTICAS =============
  
  // Obtener estadísticas para el dashboard del superadmin
  export const getSuperadminStats = async (): Promise<SuperadminStats> => {
    try {
      // Inicializar estadísticas
      const stats: SuperadminStats = {
        totalGyms: 0,
        activeGyms: 0,
        trialGyms: 0,
        suspendedGyms: 0,
        totalRevenue: 0,
        revenueThisMonth: 0,
        pendingPayments: 0,
        newGymsThisMonth: 0
      };
      
      // Obtener gimnasios
      const gymsRef = collection(db, 'gyms');
      const gymsSnapshot = await getDocs(gymsRef);
      
      // Contar gimnasios por estado
      stats.totalGyms = gymsSnapshot.size;
      
      // Establecer fecha del primer día del mes actual
      const today = new Date();
      const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      gymsSnapshot.forEach(doc => {
        const gym = doc.data() as Gym;
        
        // Contar por estado
        if (gym.status === 'active') {
          stats.activeGyms++;
        } else if (gym.status === 'trial') {
          stats.trialGyms++;
        } else if (gym.status === 'suspended') {
          stats.suspendedGyms++;
        }
        
        // Comprobar si es nuevo este mes
        const registrationDate = toJsDate(gym.registrationDate);
        if (registrationDate && registrationDate >= firstDayOfCurrentMonth) {
          stats.newGymsThisMonth++;
        }
      });
      
      // Obtener pagos
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
      
      const paymentsRef = collection(db, 'subscriptionPayments');
      
      // Todos los pagos completados (para ingresos totales)
      const allCompletedQuery = query(
        paymentsRef,
        where('status', '==', 'completed')
      );
      const allCompletedSnapshot = await getDocs(allCompletedQuery);
      
      // Pagos del mes actual
      const monthPaymentsQuery = query(
        paymentsRef,
        where('date', '>=', Timestamp.fromDate(firstDayOfMonth)),
        where('date', '<=', Timestamp.fromDate(lastDayOfMonth))
      );
      const monthPaymentsSnapshot = await getDocs(monthPaymentsQuery);
      
      // Pagos pendientes
      const pendingPaymentsQuery = query(
        paymentsRef,
        where('status', '==', 'pending')
      );
      const pendingPaymentsSnapshot = await getDocs(pendingPaymentsQuery);
      
      // Calcular ingresos
      allCompletedSnapshot.forEach(doc => {
        const payment = doc.data() as Payment;
        stats.totalRevenue += payment.amount;
      });
      
      monthPaymentsSnapshot.forEach(doc => {
        const payment = doc.data() as Payment;
        if (payment.status === 'completed') {
          stats.revenueThisMonth += payment.amount;
        }
      });
      
      stats.pendingPayments = pendingPaymentsSnapshot.size;
      
      return stats;
    } catch (error) {
      console.error('Error getting superadmin stats:', error);
      throw error;
    }
  };
  
  // Obtener datos para el gráfico de suscripciones
  export const getSubscriptionChartData = async (
    period: 'month' | '3months' | 'year'
  ): Promise<SubscriptionChartData> => {
    try {
      const now = new Date();
      let startDate: Date;
      
      // Determinar fecha de inicio según periodo
      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      }
      
      // Obtener suscripciones
      const subscriptionsRef = collection(db, 'subscriptions');
      const q = query(
        subscriptionsRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      
      // Preparar datos para el gráfico
      const datePoints: string[] = [];
      const newSubscriptionsValues: number[] = [];
      const renewalsValues: number[] = [];
      const totalValues: number[] = [];
      
      // Determinar intervalo según periodo
      const interval = period === 'year' ? 
        { unit: 'month', count: 12 } : 
        period === '3months' ? 
          { unit: 'week', count: 12 } : 
          { unit: 'day', count: 30 };
      
      // Generar puntos de fecha e inicializar valores
      for (let i = 0; i < interval.count; i++) {
        const date = new Date(now);
        
        if (interval.unit === 'day') {
          date.setDate(date.getDate() - (interval.count - i - 1));
          datePoints.push(date.toISOString().split('T')[0]);
        } else if (interval.unit === 'week') {
          date.setDate(date.getDate() - (interval.count - i - 1) * 7);
          datePoints.push(`Sem ${i + 1}`);
        } else {
          date.setMonth(date.getMonth() - (interval.count - i - 1));
          datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
        }
        newSubscriptionsValues.push(0);
        renewalsValues.push(0);
        totalValues.push(0);
      }
      
      // Procesar suscripciones
      querySnapshot.forEach(doc => {
        const subscription = doc.data() as GymSubscription;
        
        if (subscription.createdAt) {
          const createdAt = toJsDate(subscription.createdAt);
          
          if (createdAt && createdAt >= startDate && createdAt <= now) {
            // Determinar a qué punto corresponde esta suscripción
            let index = -1;
            
            if (interval.unit === 'day') {
              const dayDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
              index = interval.count - dayDiff - 1;
            } else if (interval.unit === 'week') {
                const weekDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7));
                index = interval.count - weekDiff - 1;
              } else {
                const monthDiff = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
                index = interval.count - monthDiff - 1;
              }
              
              if (index >= 0 && index < interval.count) {
                // Clasificar entre nuevas suscripciones y renovaciones
                if (subscription.lastRenewalDate) {
                  renewalsValues[index]++;
                } else {
                  newSubscriptionsValues[index]++;
                }
                totalValues[index]++;
              }
            }
          }
        });
        
        return { 
          dates: datePoints, 
          values: { 
            newSubscriptions: newSubscriptionsValues, 
            renewals: renewalsValues,
            total: totalValues
          } 
        };
      } catch (error) {
        console.error('Error getting subscription chart data:', error);
        throw error;
      }
    };
    
    // Obtener datos para el gráfico de ingresos
    export const getRevenueChartData = async (
      period: 'month' | '3months' | 'year'
    ): Promise<RevenueChartData> => {
      try {
        const now = new Date();
        let startDate: Date;
        
        // Determinar fecha de inicio según periodo
        switch (period) {
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
          case '3months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            break;
          case 'year':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }
        
        // Obtener pagos
        const paymentsRef = collection(db, 'subscriptionPayments');
        const q = query(
          paymentsRef,
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(now)),
          where('status', '==', 'completed'),
          orderBy('date', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        
        // Preparar datos para el gráfico
        const datePoints: string[] = [];
        const amountValues: number[] = [];
        const cumulativeValues: number[] = [];
        
        // Determinar intervalo según periodo
        const interval = period === 'year' ? 
          { unit: 'month', count: 12 } : 
          period === '3months' ? 
            { unit: 'week', count: 12 } : 
            { unit: 'day', count: 30 };
        
        // Generar puntos de fecha e inicializar valores
        for (let i = 0; i < interval.count; i++) {
          const date = new Date(now);
          
          if (interval.unit === 'day') {
            date.setDate(date.getDate() - (interval.count - i - 1));
            datePoints.push(date.toISOString().split('T')[0]);
          } else if (interval.unit === 'week') {
            date.setDate(date.getDate() - (interval.count - i - 1) * 7);
            datePoints.push(`Sem ${i + 1}`);
          } else {
            date.setMonth(date.getMonth() - (interval.count - i - 1));
            datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
          }
          amountValues.push(0);
        }
        
        // Procesar pagos
        querySnapshot.forEach(doc => {
          const payment = doc.data() as Payment;
          
          if (payment.date) {
            const paymentDate = toJsDate(payment.date);
            
            if (paymentDate && paymentDate >= startDate && paymentDate <= now) {
              // Determinar a qué punto corresponde este pago
              let index = -1;
              
              if (interval.unit === 'day') {
                const dayDiff = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
                index = interval.count - dayDiff - 1;
              } else if (interval.unit === 'week') {
                const weekDiff = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
                index = interval.count - weekDiff - 1;
              } else {
                const monthDiff = (now.getFullYear() - paymentDate.getFullYear()) * 12 + (now.getMonth() - paymentDate.getMonth());
                index = interval.count - monthDiff - 1;
              }
              
              if (index >= 0 && index < interval.count) {
                amountValues[index] += payment.amount;
              }
            }
          }
        });
        
        // Calcular valores acumulativos
        let cumulative = 0;
        const cumulativeData = amountValues.map(value => {
          cumulative += value;
          return cumulative;
        });
        
        return { 
          dates: datePoints, 
          values: { 
            amount: amountValues,
            cumulative: cumulativeData
          } 
        };
      } catch (error) {
        console.error('Error getting revenue chart data:', error);
        throw error;
      }
    };
    
    // Verificar suscripciones vencidas y pendientes de pago
    export const checkExpiringSubscriptions = async (): Promise<void> => {
      try {
        const now = new Date();
        
        // Obtener suscripciones activas
        const subscriptionsRef = collection(db, 'subscriptions');
        const activeSubscriptionsQuery = query(
          subscriptionsRef,
          where('status', '==', 'active')
        );
        
        const querySnapshot = await getDocs(activeSubscriptionsQuery);
        
        // Verificar cada suscripción
        querySnapshot.forEach(async (docSnap) => {
          const subscription = { id: docSnap.id, ...docSnap.data() } as GymSubscription;
          const endDate = toJsDate(subscription.endDate);
          
          if (endDate && endDate < now) {
            // La suscripción ha expirado
            
            // Si tiene renovación automática, renovar
            if (subscription.autoRenewal) {
              try {
                // Renovar suscripción con el mismo método de pago
                await renewSubscription(
                  subscription.id,
                  subscription.paymentMethod,
                  true,
                  'Renovación automática'
                );
              } catch (error) {
                console.error(`Error en renovación automática para suscripción ${subscription.id}:`, error);
                
                // Marcar como expirada si hay error en la renovación
                await updateDoc(doc(db, 'subscriptions', subscription.id), {
                  status: 'expired',
                  notes: 'Error en renovación automática',
                  updatedAt: serverTimestamp()
                });
                
                // Suspender gimnasio
                await updateDoc(doc(db, 'gyms', subscription.gymId), {
                  status: 'suspended',
                  updatedAt: serverTimestamp()
                });
              }
            } else {
              // Marcar como expirada
              await updateDoc(doc(db, 'subscriptions', subscription.id), {
                status: 'expired',
                updatedAt: serverTimestamp()
              });
              
              // Suspender gimnasio
              await updateDoc(doc(db, 'gyms', subscription.gymId), {
                status: 'suspended',
                updatedAt: serverTimestamp()
              });
            }
          }
        });
      } catch (error) {
        console.error('Error checking expiring subscriptions:', error);
        throw error;
      }
    };
    
    // Funciones adicionales que podrían ser necesarias
    
    // Obtener miembros recientes
    export const getRecentMembers = async (limit: number = 5): Promise<any[]> => {
      try {
        // Esta es una implementación temporal
        return []; // En un entorno real, obtendríamos datos de Firestore
      } catch (error) {
        console.error('Error getting recent members:', error);
        throw error;
      }
    };
    
    // Obtener miembros con cumpleaños próximos
    export const getMembersWithUpcomingBirthdays = async (days: number = 30, limit: number = 5): Promise<any[]> => {
      try {
        // Esta es una implementación temporal
        return []; // En un entorno real, obtendríamos datos de Firestore
      } catch (error) {
        console.error('Error getting upcoming birthdays:', error);
        throw error;
      }
    };
    
    // Obtener suscripciones vencidas o por vencer
    export const getExpiredSubscriptions = async (limit: number = 5): Promise<any[]> => {
      try {
        // Esta es una implementación temporal
        return []; // En un entorno real, obtendríamos datos de Firestore
      } catch (error) {
        console.error('Error getting expired subscriptions:', error);
        throw error;
      }
    };
    
    // ============= EXPORTACIÓN =============
    const superadminService = {
      getSubscriptionPlans,
      getSubscriptionPlanById,
      createSubscriptionPlan,
      updateSubscriptionPlan,
      deleteSubscriptionPlan,
      getGymSubscriptions,
      getExpiringSubscriptions,
      getSubscriptionById,
      assignSubscription,
      renewSubscription,
      cancelSubscription,
      getPayments,
      registerPayment,
      generateRevenueReport,
      getGyms,
      createGym,
      updateGym,
      updateGymStatus,
      getSuperadminStats,
      getSubscriptionChartData,
      getRevenueChartData,
      checkExpiringSubscriptions,
      getRecentMembers,
      getMembersWithUpcomingBirthdays,
      getExpiredSubscriptions
    };
    
    export default superadminService;