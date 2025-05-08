// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDoc, doc, updateDoc, serverTimestamp, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Tipos para nuestro contexto
interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  phone?: string;
  createdAt: any; // Timestamp de Firebase
  lastLogin?: any; // Timestamp de Firebase
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
  subscriptionData?: {
    plan: string;
    startDate: any;
    endDate: any;
    price: number;
    paymentMethod: string;
    lastPayment: any;
    renewalRequested: boolean;
  };
  address?: string;
  website?: string;
  socialMedia?: string;
  logo?: string;
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
}

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Crear el proveedor del contexto
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [gymData, setGymData] = useState<GymData | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Primero verificamos si es un superadmin
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setUserData({ 
              ...adminDoc.data(), 
              id: user.uid,
              role: 'superadmin',
              isActive: true
            } as UserData);
            setUserRole('superadmin');
            setGymData(null);
            setLoading(false);
            return;
          }
          
          // Luego verificamos si es propietario de gimnasio
          const gymDoc = await getDoc(doc(db, 'gyms', user.uid));
          if (gymDoc.exists()) {
            setGymData({ ...gymDoc.data(), id: user.uid } as GymData);
            
            // Obtener datos del usuario desde la subcolección users
            const userDoc = await getDoc(doc(db, `gyms/${user.uid}/users`, user.uid));
            if (userDoc.exists()) {
              setUserData({ ...userDoc.data(), id: user.uid } as UserData);
              setUserRole(userDoc.data().role);
              
              // Actualizar último login
              await updateDoc(doc(db, `gyms/${user.uid}/users`, user.uid), {
                lastLogin: serverTimestamp()
              });
            }
            
            setLoading(false);
            return;
          }
          
          // Si no es propietario, buscamos en qué gimnasio está registrado como empleado
          // Nota: Esta búsqueda es simplificada. En una app real, deberíamos usar índices o alguna otra estructura
          // para mapear usuarios a gimnasios sin tener que recorrer todos los gimnasios.
          const gymsRef = collection(db, 'gyms');
          const gymsSnapshot = await getDocs(gymsRef);
          
          for (const gym of gymsSnapshot.docs) {
            const userDocRef = doc(db, `gyms/${gym.id}/users`, user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              setUserData({ ...userDoc.data(), id: user.uid } as UserData);
              setGymData({ ...gym.data(), id: gym.id } as GymData);
              setUserRole(userDoc.data().role);
              
              // Actualizar último login
              await updateDoc(userDocRef, {
                lastLogin: serverTimestamp()
              });
              
              setLoading(false);
              return;
            }
          }
          
          // Si llegamos aquí, el usuario existe en Firebase Auth pero no en Firestore
          console.warn('Usuario autenticado pero no encontrado en Firestore');
          setUserData(null);
          setGymData(null);
          setUserRole(null);
          
          // En un caso real, podríamos cerrar la sesión automáticamente
          // await auth.signOut();
        } catch (error) {
          console.error('Error al cargar datos de usuario:', error);
        }
      } else {
        setUserData(null);
        setGymData(null);
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
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
    checkSubscriptionStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;