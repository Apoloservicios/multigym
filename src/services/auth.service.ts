// src/services/auth.service.ts - VERSIÓN SIMPLE QUE FUNCIONA

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { RegisterFormData } from '../types/auth.types';

// ================== TIPOS ==================

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: any;
  role?: 'superadmin' | 'admin' | 'user';
  gymId?: string | null;
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  role?: 'superadmin' | 'admin' | 'user';
  gymId?: string | null;
  user?: any;
  error?: string;
}

// ================== FUNCIONES PRINCIPALES ==================

/**
 * REGISTRO DE GIMNASIO - VERSIÓN SIMPLE CON gymId AUTOMÁTICO
 */
export const registerGym = async (
  email: string,
  password: string,
  gymName: string,
  ownerName: string,
  phone: string,
  cuit: string
): Promise<AuthResponse> => {
  try {
    console.log('🏋️ Iniciando registro de gimnasio:', gymName);

    // 1. Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('✅ Usuario creado en Firebase Auth:', user.uid);

    // 2. Crear gimnasio
    const gymRef = doc(db, 'gyms', user.uid);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const gymData = {
      name: gymName,
      owner: ownerName,
      email: email,
      phone: phone,
      cuit: cuit,
      status: 'trial',
      registrationDate: serverTimestamp(),
      trialEndsAt: trialEndDate,
      logo: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(gymRef, gymData);
    console.log('✅ Gimnasio creado:', user.uid);

    // 3. 🔧 CREAR USUARIO ADMIN CON gymId AUTOMÁTICO
    const userRef = doc(db, `gyms/${user.uid}/users`, user.uid);
    const userData = {
      email: email,
      name: ownerName,
      role: 'admin',
      gymId: user.uid, // 🎯 CAMPO CRÍTICO: gymId automático
      phone: phone,
      isActive: true,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };

    await setDoc(userRef, userData);
    console.log('✅ Usuario admin creado con gymId:', user.uid);

    return {
      success: true,
      message: 'Gimnasio registrado exitosamente',
      user: userData,
      role: 'admin',
      gymId: user.uid
    };

  } catch (error: any) {
    console.error('❌ Error en registro:', error);
    
    // Limpiar usuario de Auth si hay error
    if (auth.currentUser) {
      try {
        await auth.currentUser.delete();
      } catch (deleteError) {
        console.error('Error al limpiar usuario Auth:', deleteError);
      }
    }

    return {
      success: false,
      error: error.message || 'Error al registrar gimnasio'
    };
  }
};

/**
 * LOGIN DE USUARIO
 */
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    console.log('🔐 Iniciando login para:', email);

    // 1. Autenticar con Firebase Auth
    let userCredential;
    if (password) {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } else {
      userCredential = { user: auth.currentUser };
    }

    if (!userCredential.user) {
      return {
        success: false,
        error: 'Error de autenticación'
      };
    }

    const user = userCredential.user;

    // 2. Buscar en superadmins primero
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    if (adminDoc.exists()) {
      const adminData = adminDoc.data();
      return {
        success: true,
        role: 'superadmin',
        gymId: null,
        user: {
          id: user.uid,
          ...adminData,
          role: 'superadmin'
        }
      };
    }

    // 3. Buscar en usuarios de gimnasio
    const gymsSnapshot = await getDocs(collection(db, 'gyms'));
    
    for (const gymDoc of gymsSnapshot.docs) {
      const gymId = gymDoc.id;
      const userDoc = await getDoc(doc(db, `gyms/${gymId}/users`, user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          success: true,
          role: userData.role,
          gymId: gymId,
          user: {
            id: user.uid,
            ...userData,
            gymId: gymId
          }
        };
      }
    }

    // Usuario no encontrado
    await signOut(auth);
    return {
      success: false,
      error: 'Usuario no encontrado en el sistema'
    };

  } catch (error: any) {
    console.error('❌ Error en login:', error);
    return {
      success: false,
      error: error.message || 'Error al iniciar sesión'
    };
  }
};

/**
 * CREAR USUARIO EN GIMNASIO
 */
export const createGymUser = async (
  gymId: string,
  userData: {
    email: string;
    name: string;
    password: string;
    phone?: string;
    role: 'admin' | 'user';
  }
): Promise<AuthResponse> => {
  try {
    // 1. Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const user = userCredential.user;

    // 2. Crear documento del usuario con gymId
    const userRef = doc(db, `gyms/${gymId}/users`, user.uid);
    const userDocData = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      gymId: gymId, // 🎯 gymId automático
      phone: userData.phone || '',
      isActive: true,
      createdAt: serverTimestamp(),
      lastLogin: null
    };

    await setDoc(userRef, userDocData);

    return {
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: user.uid,
        ...userDocData
      },
      role: userData.role,
      gymId: gymId
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al crear usuario'
    };
  }
};

/**
 * ALIAS PARA COMPATIBILIDAD
 */
export const registerGymEmployee = async (
  gymId: string,
  email: string,
  password: string,
  name: string,
  phone?: string,
  role: 'admin' | 'user' = 'user'
): Promise<AuthResponse> => {
  return createGymUser(gymId, {
    email,
    name,
    password,
    phone,
    role
  });
};

/**
 * LOGOUT
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log('👋 Usuario deslogueado');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw error;
  }
};

/**
 * RESET PASSWORD
 */
export const resetPassword = async (email: string): Promise<AuthResponse> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: 'Email de recuperación enviado'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al enviar email de recuperación'
    };
  }
};

/**
 * FUNCIÓN PARA CORREGIR USUARIOS EXISTENTES
 */
export const fixExistingUsers = async (): Promise<void> => {
  try {
    console.log('🔧 Iniciando corrección de usuarios existentes...');

    const gymsSnapshot = await getDocs(collection(db, 'gyms'));
    
    for (const gymDoc of gymsSnapshot.docs) {
      const gymId = gymDoc.id;
      const usersSnapshot = await getDocs(collection(db, `gyms/${gymId}/users`));
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        if (!userData.gymId) {
          console.log(`🔧 Corrigiendo usuario ${userDoc.id} - agregando gymId: ${gymId}`);
          
          await setDoc(
            doc(db, `gyms/${gymId}/users`, userDoc.id),
            { ...userData, gymId: gymId },
            { merge: true }
          );
        }
      }
    }

    console.log('✅ Corrección de usuarios completada');
  } catch (error) {
    console.error('❌ Error corrigiendo usuarios:', error);
    throw error;
  }
};

// ================== EXPORTACIONES ==================

export default {
  registerGym,
  registerGymEmployee,
  loginUser,
  createGymUser,
  logoutUser,
  resetPassword,
  fixExistingUsers
};