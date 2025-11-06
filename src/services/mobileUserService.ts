// src/services/mobileUserService.ts
// Servicio para crear usuarios móviles para socios

import { 
  createUserWithEmailAndPassword, 
  deleteUser,
  sendPasswordResetEmail,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, // ← AGREGAR
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, secondaryAuth, db } from '../config/firebase';

export interface MobileUserCredentials {
  email: string;
  password: string;
  uid: string;
}

export interface CreateMobileUserParams {
  gymId: string;
  memberId: string;
  memberEmail: string;
  memberName: string;
  generatePassword?: string; // Opcional: contraseña personalizada
}

/**
 * Verificar si un socio ya tiene usuario móvil
 */
export const checkMobileUserExists = async (
  gymId: string,
  memberId: string
): Promise<{ exists: boolean; uid?: string; email?: string }> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('gymId', '==', gymId),
      where('memberId', '==', memberId),
      where('role', '==', 'member')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return {
        exists: true,
        uid: userDoc.id,
        email: userData.email
      };
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('Error verificando usuario móvil:', error);
    throw error;
  }
};

/**
 * Generar contraseña segura automática
 */
const generateSecurePassword = (): string => {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

/**
 * Crear usuario móvil para un socio
 */
export const createMobileUser = async (
  params: CreateMobileUserParams
): Promise<MobileUserCredentials> => {
  const { gymId, memberId, memberEmail, memberName, generatePassword } = params;
  
  try {
    // 1. Verificar si ya existe
    const existing = await checkMobileUserExists(gymId, memberId);
    if (existing.exists) {
      throw new Error('Este socio ya tiene un usuario móvil creado');
    }
    
    // 2. Generar contraseña (personalizada o automática)
    const password = generatePassword || generateSecurePassword();
    
    // 3. Crear usuario en Firebase Authentication
    console.log('📱 Creando usuario en Firebase Auth...');
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      memberEmail,
      password
    );
    
    const newUser = userCredential.user;
    console.log('✅ Usuario creado en Auth:', newUser.uid);
    
    try {
      // 4. Crear documento en Firestore users/
      console.log('📄 Creando documento en Firestore...');
      await setDoc(doc(db, 'users', newUser.uid), {
        email: memberEmail,
        role: 'member',
        gymId: gymId,
        memberId: memberId,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'system',
        createdByName: auth.currentUser?.email || 'system'
      });
      
      console.log('✅ Usuario móvil creado exitosamente');
      
      return {
        email: memberEmail,
        password: password,
        uid: newUser.uid
      };
      
    } catch (firestoreError) {
      // Si falla Firestore, eliminar el usuario de Auth
      console.error('❌ Error en Firestore, eliminando usuario de Auth...');
      await deleteUser(newUser);
      throw firestoreError;
    }
    
  } catch (error: any) {
    console.error('❌ Error creando usuario móvil:', error);
    
    // Mensajes de error más amigables
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(
        'Este email ya está registrado en otro gimnasio. ' +
        'El socio debe solicitar la desactivación de su acceso móvil en su gimnasio anterior, ' +
        'o puede usar un email diferente para crear una nueva cuenta.'
      );
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('El email del socio no es válido');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    } else {
      throw error;
    }
  }
};

/**
 * Eliminar usuario móvil de un socio
 */
export const deleteMobileUser = async (
  uid: string
): Promise<void> => {
  try {
    // 1. Eliminar documento de Firestore
    await deleteDoc(doc(db, 'users', uid));
    
    // 2. Nota: No podemos eliminar el usuario de Auth desde aquí
    // porque requiere que el usuario esté autenticado
    // Esto se debe hacer manualmente desde Firebase Console
    // o con Cloud Functions con privilegios admin
    
    console.log('✅ Usuario móvil desactivado');
    
  } catch (error) {
    console.error('❌ Error eliminando usuario móvil:', error);
    throw error;
  }
};

/**
 * Regenerar contraseña de usuario móvil
 */
export const regenerateMobilePassword = async (
  email: string
): Promise<string> => {
  try {
    const newPassword = generateSecurePassword();
    
    // Nota: Cambiar contraseña requiere Cloud Functions con Admin SDK
    // Por ahora, el admin debe hacerlo manualmente desde Firebase Console
    // o implementar un endpoint con Firebase Admin
    
    throw new Error('Funcionalidad disponible próximamente. Por ahora, edita la contraseña desde Firebase Console.');
    
  } catch (error) {
    console.error('❌ Error regenerando contraseña:', error);
    throw error;
  }
};

/**
 * Enviar email de recuperación de contraseña
 */
export const sendPasswordResetEmailToMember = async (
  email: string
): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Email de recuperación enviado');
  } catch (error: any) {
    console.error('❌ Error enviando email de recuperación:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('No existe un usuario con ese email');
    }
    throw error;
  }
};

/**
 * Desactivar usuario móvil (soft delete)
 */
export const deactivateMobileUser = async (
  uid: string
): Promise<void> => {
  try {
    // Marcar como inactivo en Firestore
    await updateDoc(doc(db, 'users', uid), {
      isActive: false,
      deactivatedAt: serverTimestamp(),
      deactivatedBy: auth.currentUser?.uid || 'system'
    });
    
    console.log('✅ Usuario móvil desactivado');
    
  } catch (error) {
    console.error('❌ Error desactivando usuario móvil:', error);
    throw error;
  }
};

/**
 * Reactivar usuario móvil
 */
export const reactivateMobileUser = async (
  uid: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive: true,
      reactivatedAt: serverTimestamp(),
      reactivatedBy: auth.currentUser?.uid || 'system'
    });
    
    console.log('✅ Usuario móvil reactivado');
    
  } catch (error) {
    console.error('❌ Error reactivando usuario móvil:', error);
    throw error;
  }
};

/**
 * Obtener información completa del usuario móvil
 */
export const getMobileUserInfo = async (
  gymId: string,
  memberId: string
): Promise<{ uid: string; email: string; isActive: boolean; createdAt: any } | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('gymId', '==', gymId),
      where('memberId', '==', memberId),
      where('role', '==', 'member')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        email: userData.email,
        isActive: userData.isActive !== false, // Por defecto true si no existe el campo
        createdAt: userData.createdAt
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error obteniendo info de usuario móvil:', error);
    throw error;
  }
};

/**
 * Buscar si un email ya está registrado (en cualquier gym)
 */
export const findUserByEmail = async (
  email: string
): Promise<{ exists: boolean; gymId?: string; memberId?: string } | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '==', email),
      where('role', '==', 'member')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      return {
        exists: true,
        gymId: userData.gymId,
        memberId: userData.memberId
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    throw error;
  }
};

/**
 * Transferir usuario móvil de un gimnasio a otro
 */
export const transferMobileUser = async (
  uid: string,
  newGymId: string,
  newMemberId: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      gymId: newGymId,
      memberId: newMemberId,
      isActive: true, // Reactivar automáticamente
      transferredAt: serverTimestamp(),
      transferredBy: auth.currentUser?.uid || 'system'
    });
    
    console.log('✅ Usuario móvil transferido');
    
  } catch (error) {
    console.error('❌ Error transfiriendo usuario móvil:', error);
    throw error;
  }
};

/**
 * Buscar usuario móvil por email (en cualquier gimnasio)
 */
export const findMobileUserByEmail = async (
  email: string
): Promise<{
  uid: string;
  email: string;
  gymId: string;
  memberId: string;
  isActive: boolean;
} | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '==', email),
      where('role', '==', 'member')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      return {
        uid: userDoc.id,
        email: userData.email,
        gymId: userData.gymId,
        memberId: userData.memberId,
        isActive: userData.isActive !== false
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    throw error;
  }
};