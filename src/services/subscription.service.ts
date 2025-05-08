// src/services/subscription.service.ts
  
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    addDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    serverTimestamp
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { GymSubscription, SubscriptionPlan, SubscriptionPayment } from '../types/subscription.types';
  
  // Asignar suscripción a un gimnasio
  export const assignSubscription = async (
    gymId: string,
    planId: string,
    startDate: Date,
    paymentMethod: string,
    notes?: string
  ): Promise<GymSubscription> => {
    try {
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
      const gymRef = doc(db, 'gyms', gymId);
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
        amount: plan.price,
        date: Timestamp.fromDate(new Date()),
        method: paymentMethod,
        status: 'completed',
        notes,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'subscriptionPayments'), paymentData);
      
      return {
        id: docRef.id,
        ...subscriptionData
      } as GymSubscription;
    } catch (error) {
      console.error('Error assigning subscription:', error);
      throw error;
    }
  };
  
  // Obtener suscripción activa de un gimnasio
  export const getActiveSubscription = async (gymId: string): Promise<GymSubscription | null> => {
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const q = query(
        subscriptionsRef, 
        where('gymId', '==', gymId),
        where('status', '==', 'active'),
        orderBy('endDate', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      return {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      } as GymSubscription;
    } catch (error) {
      console.error('Error getting active subscription:', error);
      throw error;
    }
  };
  
  export {};