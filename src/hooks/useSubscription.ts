// src/hooks/useSubscription.ts

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAuth from './useAuth';
import { GymSubscription, SubscriptionPlan } from '../types/subscription.types';

const useSubscription = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<GymSubscription | null>(null);
  const { gymData } = useAuth();

  // Cargar planes disponibles
  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const plansRef = collection(db, 'subscriptionPlans');
      const q = query(plansRef, where('isActive', '==', true), orderBy('price'));
      const querySnapshot = await getDocs(q);
      
      const plansData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SubscriptionPlan[];
      
      setPlans(plansData);
      return plansData;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar suscripción actual del gimnasio
  const loadCurrentSubscription = useCallback(async () => {
    if (!gymData?.id) return null;
    
    setLoading(true);
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const q = query(
        subscriptionsRef, 
        where('gymId', '==', gymData.id),
        where('status', '==', 'active'),
        orderBy('endDate', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setCurrentSubscription(null);
        return null;
      }
      
      const subscription = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      } as GymSubscription;
      
      setCurrentSubscription(subscription);
      return subscription;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [gymData?.id]);

  // Verificar si la suscripción está activa
  const isSubscriptionActive = useCallback(() => {
    if (!currentSubscription) return false;
    
    const now = new Date();
    const endDate = currentSubscription.endDate.toDate();
    
    return currentSubscription.status === 'active' && endDate > now;
  }, [currentSubscription]);

  // Verificar si el período de prueba está activo
  const isTrialActive = useCallback(() => {
    if (!gymData) return false;
    
    if (gymData.status !== 'trial') return false;
    
    if (!gymData.trialEndsAt) return false;
    
    const trialEndDate = gymData.trialEndsAt.toDate();
    const currentDate = new Date();
    
    return trialEndDate > currentDate;
  }, [gymData]);

  // Solicitar renovación de suscripción
  const requestRenewal = useCallback(async (planId: string) => {
    if (!gymData?.id) return false;
    
    setLoading(true);
    try {
      // Obtener el plan seleccionado
      const planRef = doc(db, 'subscriptionPlans', planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) {
        throw new Error('El plan seleccionado no existe');
      }
      
      const plan = { id: planSnap.id, ...planSnap.data() } as SubscriptionPlan;
      
      // Marcar suscripción actual como pendiente de renovación
      if (currentSubscription) {
        const subscriptionRef = doc(db, 'subscriptions', currentSubscription.id);
        await updateDoc(subscriptionRef, {
          renewalRequested: true,
          updatedAt: Timestamp.now()
        });
      }
      
      // Crear registro de solicitud de renovación
      const requestData = {
        gymId: gymData.id,
        planId: planId,
        planName: plan.name,
        price: plan.price,
        requestDate: Timestamp.now(),
        status: 'pending',
        note: currentSubscription ? 'Solicitud de renovación' : 'Nueva suscripción'
      };
      
      await addDoc(collection(db, 'subscriptionRequests'), requestData);
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [gymData?.id, currentSubscription]);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (gymData?.id) {
      loadPlans();
      loadCurrentSubscription();
    }
  }, [gymData?.id, loadPlans, loadCurrentSubscription]);

  return {
    loading,
    error,
    plans,
    currentSubscription,
    isSubscriptionActive,
    isTrialActive,
    loadPlans,
    loadCurrentSubscription,
    requestRenewal
  };
};

export default useSubscription;