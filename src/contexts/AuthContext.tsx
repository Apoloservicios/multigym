// src/contexts/AuthContext.tsx - VERSIÓN DEFINITIVA

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDoc, doc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toJsDate } from '../utils/date.utils';

// Tipos para nuestro contexto
interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  phone?: string;
  createdAt: any;
  lastLogin?: any;
  isActive: boolean;
}

export interface GymData {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  cuit: string;
  status: 'active' | 'trial' | 'suspended';
  registrationDate: any;
  trialEndsAt?: any;
  logo: string | null;
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

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  gymData: GymData | null;
  userRole: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isGymAdmin: boolean;
  isGymEmployee: boolean;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  checkTrialStatus: () => boolean;
  checkSubscriptionStatus: () => boolean;
  subscriptionEndDate: Date | null;
  trialEndDate: Date | null;
  subscriptionDaysLeft: number;
  subscriptionPlan: string | null;
  subscriptionStatus: 'active' | 'expired' | 'trial' | 'suspended';
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Crear el proveedor del contexto
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [gymData, setGymData] = useState<GymData | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isComponentMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!isComponentMounted) return;

      console.log("🔔 Auth state changed:", user ? `${user.email} (${user.uid})` : 'No user');
      setCurrentUser(user);
      
      if (user) {
        try {
          console.log("🔍 Verificando permisos para:", user.email);
          
          // PASO 1: Verificar si es superadmin por email
          console.log("1️⃣ Buscando superadmin por email...");
          const adminsRef = collection(db, 'admins');
          const adminQuery = query(adminsRef, where('email', '==', user.email));
          const adminSnapshot = await getDocs(adminQuery);
          
          if (!isComponentMounted) return;
          
          if (!adminSnapshot.empty) {
            const adminDoc = adminSnapshot.docs[0];
            const adminData = adminDoc.data();
            console.log("✅ Admin encontrado por email:", adminData);
            
            const role = adminData.rol || adminData.role;
            if (role === "superadmin") {
              console.log("🎉 SUPERADMIN CONFIRMADO");
              
              if (isComponentMounted) {
                setUserData({ 
                  id: adminDoc.id,
                  email: user.email || '',
                  name: adminData.name || 'SuperAdmin',
                  role: 'superadmin',
                  createdAt: adminData.createdAt || new Date(),
                  isActive: true
                });
                setUserRole('superadmin');
                setGymData(null);
                setLoading(false);
              }
              return;
            }
          }
          
          // PASO 2: Verificar por ID en admins
          console.log("2️⃣ Buscando admin por ID...");
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          
          if (!isComponentMounted) return;
          
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            console.log("✅ Admin encontrado por ID:", adminData);
            
            if (isComponentMounted) {
              setUserData({ 
                ...adminData, 
                id: user.uid,
                role: 'superadmin',
                isActive: true
              } as UserData);
              setUserRole('superadmin');
              setGymData(null);
              setLoading(false);
            }
            return;
          }
          
          // PASO 3: Verificar si es propietario de gimnasio
          console.log("3️⃣ Verificando como propietario de gimnasio...");
          const gymDoc = await getDoc(doc(db, 'gyms', user.uid));
          
          if (!isComponentMounted) return;
          
          if (gymDoc.exists()) {
            console.log("✅ Gimnasio encontrado");
            const gymDataResult = { ...gymDoc.data(), id: user.uid } as GymData;
            
            // Obtener datos del usuario desde la subcolección users
            const userDoc = await getDoc(doc(db, `gyms/${user.uid}/users`, user.uid));
            
            if (!isComponentMounted) return;
            
            if (userDoc.exists()) {
              const userDataResult = { ...userDoc.data(), id: user.uid } as UserData;
              
              // Actualizar último login
              await updateDoc(doc(db, `gyms/${user.uid}/users`, user.uid), {
                lastLogin: serverTimestamp()
              });
              
              if (isComponentMounted) {
                setUserData(userDataResult);
                setGymData(gymDataResult);
                setUserRole(userDataResult.role);
                setLoading(false);
              }
            }
            return;
          }
          
          // PASO 4: Buscar en gimnasios como empleado
          console.log("4️⃣ Buscando como empleado...");
          const gymsRef = collection(db, 'gyms');
          const gymsSnapshot = await getDocs(gymsRef);
          
          if (!isComponentMounted) return;
          
          for (const gym of gymsSnapshot.docs) {
            const userDocRef = doc(db, `gyms/${gym.id}/users`, user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              console.log("✅ Usuario encontrado como empleado");
              
              // Actualizar último login
              await updateDoc(userDocRef, {
                lastLogin: serverTimestamp()
              });
              
              if (isComponentMounted) {
                setUserData({ ...userDoc.data(), id: user.uid } as UserData);
                setGymData({ ...gym.data(), id: gym.id } as GymData);
                setUserRole(userDoc.data().role);
                setLoading(false);
              }
              return;
            }
          }
          
          // Si llegamos aquí, el usuario no se encontró
          console.log("❌ Usuario no encontrado en Firestore");
          if (isComponentMounted) {
            await auth.signOut();
            setUserData(null);
            setGymData(null);
            setUserRole(null);
          }
          
        } catch (error) {
          console.error('❌ Error al verificar usuario:', error);
          if (isComponentMounted) {
            await auth.signOut();
            setUserData(null);
            setGymData(null);
            setUserRole(null);
          }
        }
      } else {
        if (isComponentMounted) {
          setUserData(null);
          setGymData(null);
          setUserRole(null);
        }
      }
      
      if (isComponentMounted) {
        setLoading(false);
      }
    });

    return () => {
      isComponentMounted = false;
      unsubscribe();
    };
  }, []);

  // Verificar si el período de prueba está activo
  const checkTrialStatus = (): boolean => {
    if (!gymData) return false;
    if (gymData.status !== 'trial') return false;
    if (!gymData.trialEndsAt) return false;
    
    const trialEndDate = gymData.trialEndsAt.toDate ? gymData.trialEndsAt.toDate() : new Date(gymData.trialEndsAt);
    const currentDate = new Date();
    
    return trialEndDate > currentDate;
  };
  
  // Verificar si la suscripción está activa
  const checkSubscriptionStatus = (): boolean => {
    if (!gymData) return false;
    if (gymData.status !== 'active') return false;
    if (!gymData.subscriptionData?.endDate) return false;
    
    const endDate = gymData.subscriptionData.endDate.toDate ? 
                   gymData.subscriptionData.endDate.toDate() : 
                   new Date(gymData.subscriptionData.endDate);
    const currentDate = new Date();
    
    return endDate > currentDate;
  };

  // Funciones auxiliares
  const getSubscriptionEndDate = (): Date | null => {
    if (!gymData?.subscriptionData?.endDate) return null;
    return toJsDate(gymData.subscriptionData.endDate);
  };
  
  const getTrialEndDate = (): Date | null => {
    if (!gymData?.trialEndsAt) return null;
    return toJsDate(gymData.trialEndsAt);
  };
  
  const getSubscriptionDaysLeft = (): number => {
    const now = new Date();
    
    if (gymData?.status === 'active' && gymData.subscriptionData?.endDate) {
      const endDate = toJsDate(gymData.subscriptionData.endDate);
      if (!endDate) return 0;
      
      const timeDiff = endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return daysLeft > 0 ? daysLeft : 0;
    } else if (gymData?.status === 'trial' && gymData.trialEndsAt) {
      const endDate = toJsDate(gymData.trialEndsAt);
      if (!endDate) return 0;
      
      const timeDiff = endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return daysLeft > 0 ? daysLeft : 0;
    }
    
    return 0;
  };
  
  const getSubscriptionStatus = (): 'active' | 'expired' | 'trial' | 'suspended' => {
    if (!gymData) return 'expired';
    
    if (gymData.status === 'suspended') return 'suspended';
    
    if (gymData.status === 'trial') {
      const trialEndDate = getTrialEndDate();
      if (!trialEndDate) return 'expired';
      return trialEndDate > new Date() ? 'trial' : 'expired';
    }
    
    if (gymData.status === 'active') {
      const subscriptionEndDate = getSubscriptionEndDate();
      if (!subscriptionEndDate) return 'expired';
      return subscriptionEndDate > new Date() ? 'active' : 'expired';
    }
    
    return 'expired';
  };

  const value = {
    currentUser,
    userData,
    gymData,
    userRole,
    loading,
    isSuperAdmin: userRole === 'superadmin',
    isGymAdmin: userRole === 'admin',
    isGymEmployee: userRole === 'user',
    isTrialActive: checkTrialStatus(),
    isSubscriptionActive: checkSubscriptionStatus(),
    checkTrialStatus,
    checkSubscriptionStatus,
    subscriptionEndDate: getSubscriptionEndDate(),
    trialEndDate: getTrialEndDate(),
    subscriptionDaysLeft: getSubscriptionDaysLeft(),
    subscriptionPlan: gymData?.subscriptionData?.plan || null,
    subscriptionStatus: getSubscriptionStatus(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;