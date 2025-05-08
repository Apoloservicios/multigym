// src/services/user.service.ts

import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
  } from 'firebase/firestore';
  import { db, auth } from '../config/firebase';
  import { 
    createUserWithEmailAndPassword, 
    deleteUser,
    sendPasswordResetEmail,
    updateEmail,
    sendEmailVerification
  } from 'firebase/auth';
  
  // Interfaz para el usuario
  export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    phone?: string;
    createdAt?: any;
    lastLogin?: any;
    isActive: boolean;
  }
  
  // Obtener todos los usuarios del gimnasio
  export const getUsers = async (gymId: string): Promise<User[]> => {
    try {
      const usersRef = collection(db, `gyms/${gymId}/users`);
      const q = query(usersRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        } as User);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  };
  
  // Obtener un usuario por su ID
  export const getUserById = async (gymId: string, userId: string): Promise<User | null> => {
    try {
      const userRef = doc(db, `gyms/${gymId}/users`, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data()
        } as User;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  };
  
  // Crear un nuevo usuario
  export const createUser = async (
    gymId: string, 
    userData: { email: string; password: string; name: string; role: 'admin' | 'user'; phone?: string; }
  ): Promise<User> => {
    try {
      // Primero crear el usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      const user = userCredential.user;
      
      // Enviar correo de verificación
      await sendEmailVerification(user);
      
      // Crear documento del usuario en Firestore
      const userDoc = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone || '',
        createdAt: serverTimestamp(),
        lastLogin: null,
        isActive: true
      };
      
      await setDoc(doc(db, `gyms/${gymId}/users`, user.uid), userDoc);
      
      return {
        id: user.uid,
        ...userDoc,
        isActive: true
      } as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };
  
  // Actualizar un usuario existente
  export const updateUser = async (
    gymId: string, 
    userId: string, 
    userData: { name?: string; role?: 'admin' | 'user'; phone?: string; isActive?: boolean; }
  ): Promise<boolean> => {
    try {
      const userRef = doc(db, `gyms/${gymId}/users`, userId);
      
      // Actualizar documento del usuario en Firestore
      await updateDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };
  
  // Cambiar el correo electrónico de un usuario
  export const updateUserEmail = async (
    gymId: string,
    userId: string,
    newEmail: string
  ): Promise<boolean> => {
    try {
      // Esta operación requiere que el usuario esté autenticado recientemente
      // En una implementación real, podrías necesitar solicitar reautenticación
      if (auth.currentUser && auth.currentUser.uid === userId) {
        await updateEmail(auth.currentUser, newEmail);
        
        // Actualizar correo en Firestore
        const userRef = doc(db, `gyms/${gymId}/users`, userId);
        await updateDoc(userRef, {
          email: newEmail,
          updatedAt: serverTimestamp()
        });
        
        return true;
      } else {
        throw new Error('No tienes permisos para actualizar este correo electrónico');
      }
    } catch (error) {
      console.error('Error updating user email:', error);
      throw error;
    }
  };
  
  // Enviar correo de restablecimiento de contraseña
  export const sendPasswordReset = async (email: string): Promise<boolean> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('Error sending password reset:', error);
      throw error;
    }
  };
  
  // Activar o desactivar un usuario
  export const toggleUserActive = async (
    gymId: string,
    userId: string,
    isActive: boolean
  ): Promise<boolean> => {
    try {
      const userRef = doc(db, `gyms/${gymId}/users`, userId);
      
      await updateDoc(userRef, {
        isActive: isActive,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error toggling user active status:', error);
      throw error;
    }
  };
  
  // Eliminar un usuario
  export const deleteGymUser = async (gymId: string, userId: string): Promise<boolean> => {
    try {
      // Eliminar documento del usuario en Firestore
      const userRef = doc(db, `gyms/${gymId}/users`, userId);
      await deleteDoc(userRef);
      
      // En un caso real, también deberías eliminar el usuario de Authentication
      // Esto requiere privilegios de administrador o que el usuario esté autenticado
      // Ejemplo (no funciona en todos los contextos):
      // if (auth.currentUser) {
      //   await deleteUser(auth.currentUser);
      // }
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };
  
  export default {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    updateUserEmail,
    sendPasswordReset,
    toggleUserActive,
    deleteGymUser
  };