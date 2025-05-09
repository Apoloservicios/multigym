// src/services/auth.service.ts

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Registro de nuevo gimnasio
export const registerGym = async (
email: string, 
password: string, 
gymName: string, 
ownerName: string, 
phone: string,
cuit: string
) => {
try {
  // Crear usuario en Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Enviar correo de verificación
  await sendEmailVerification(user);
  
  // Fecha actual
  const now = new Date();
  
  // Fecha de finalización del período de prueba (10 días)
  const trialEndDate = new Date();
  trialEndDate.setDate(now.getDate() + 10);
  
  // Crear documento en la colección gyms
  await setDoc(doc(db, 'gyms', user.uid), {
    name: gymName,
    owner: ownerName,
    email: email,
    phone: phone,
    cuit: cuit,
    registrationDate: serverTimestamp(),
    status: 'trial',
    trialEndsAt: trialEndDate,
    subscriptionData: {
      plan: '',
      startDate: null,
      endDate: null,
      price: 0,
      paymentMethod: '',
      lastPayment: null,
      renewalRequested: false
    }
  });
  
  // Crear el primer usuario admin para este gimnasio
  await setDoc(doc(db, `gyms/${user.uid}/users`, user.uid), {
    email: email,
    name: ownerName,
    role: 'admin',
    phone: phone,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    isActive: true
  });
  
  return { success: true, user };
} catch (error: any) {
  console.error('Error registrando gimnasio:', error);
  
  // Proporcionar mensajes de error más específicos basados en los códigos de error de Firebase
  let errorMessage = 'Error desconocido al registrar el gimnasio.';
  
  switch (error.code) {
    case 'auth/email-already-in-use':
      errorMessage = 'Este correo electrónico ya está registrado.';
      break;
    case 'auth/invalid-email':
      errorMessage = 'Formato de correo electrónico inválido.';
      break;
    case 'auth/weak-password':
      errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
      break;
  }
  
  return { success: false, error: errorMessage };
}
};

// Registro de empleado de gimnasio
export const registerGymEmployee = async (
email: string, 
password: string, 
name: string,
phone: string,
gymId: string,
role: 'admin' | 'user'
) => {
try {
  // Verificar que el gimnasio existe
  const gymDoc = await getDoc(doc(db, 'gyms', gymId));
  if (!gymDoc.exists()) {
    return { success: false, error: 'El gimnasio no existe' };
  }
  
  // Crear usuario en Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Enviar correo de verificación
  await sendEmailVerification(user);
  
  // Crear documento en la subcolección users del gimnasio
  await setDoc(doc(db, `gyms/${gymId}/users`, user.uid), {
    email: email,
    name: name,
    role: role,
    phone: phone,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    isActive: false // Inicialmente inactivo hasta que sea aprobado por el admin
  });
  
  return { success: true, user };
} catch (error: any) {
  console.error('Error registrando empleado:', error);
  
  // Proporcionar mensajes de error más específicos
  let errorMessage = 'Error desconocido al registrar el empleado.';
  
  switch (error.code) {
    case 'auth/email-already-in-use':
      errorMessage = 'Este correo electrónico ya está registrado.';
      break;
    case 'auth/invalid-email':
      errorMessage = 'Formato de correo electrónico inválido.';
      break;
    case 'auth/weak-password':
      errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
      break;
  }
  
  return { success: false, error: errorMessage };
}
};

// Inicio de sesión (MODIFICADO)
export const loginUser = async (email: string, password: string) => {
try {
  let user: User;
  
  // Si no hay contraseña, asumimos que el usuario ya está autenticado
  if (!password) {
    if (!auth.currentUser) {
      throw new Error('Usuario no autenticado');
    }
    user = auth.currentUser;
  } else {
    // Autenticar con Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  }
  
  console.log("Usuario autenticado correctamente:", user.uid);
  
  // MODIFICACIÓN: Buscar superadmin primero por email
  const adminsRef = collection(db, 'admins');
  const adminQuery = query(adminsRef, where('email', '==', email));
  const adminSnapshot = await getDocs(adminQuery);
  
  if (!adminSnapshot.empty) {
    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data();
    console.log("Admin encontrado por email:", adminDoc.id);
    
    // Verificar tanto "rol" como "role" (por si acaso)
    const role = adminData.rol || adminData.role;
    if (role === "superadmin") {
      console.log("Usuario identificado como superadmin");
      
      // Guardar información en localStorage para persistir la sesión
      localStorage.setItem('userRole', 'superadmin');
      localStorage.setItem('userEmail', email);
      
      return { 
        success: true, 
        user,
        userData: { 
          ...adminData, 
          id: user.uid,
          email: user.email || email,
          role: 'superadmin',
          isActive: true
        }, 
        role: 'superadmin',
        gymId: null 
      };
    }
  }
  
  // Intentar buscar por ID directamente (forma original)
  const adminDocRef = doc(db, 'admins', user.uid);
  const adminDoc = await getDoc(adminDocRef);
  
  if (adminDoc.exists()) {
    const adminData = adminDoc.data();
    console.log("Admin encontrado por ID:", adminDoc.id);
    
    // Verificar tanto "rol" como "role"
    const role = adminData.rol || adminData.role;
    if (role === "superadmin") {
      console.log("Usuario identificado como superadmin");
      
      // Guardar información en localStorage para persistir la sesión
      localStorage.setItem('userRole', 'superadmin');
      localStorage.setItem('userEmail', email);
      
      return { 
        success: true, 
        user, 
        userData: { ...adminData, id: user.uid }, 
        role: 'superadmin',
        gymId: null 
      };
    }
  }
  
  // Luego verificamos si es propietario de gimnasio (el ID del doc coincide con el UID)
  const gymDoc = await getDoc(doc(db, 'gyms', user.uid));
  if (gymDoc.exists()) {
    // Obtener datos del usuario desde la subcolección users
    const userDoc = await getDoc(doc(db, `gyms/${user.uid}/users`, user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Guardar información en localStorage
      localStorage.setItem('userRole', userData.role);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('gymId', user.uid);
      
      return { 
        success: true, 
        user, 
        userData: { ...userData, id: user.uid }, 
        gymData: { ...gymDoc.data(), id: user.uid },
        role: userData.role,
        gymId: user.uid
      };
    }
  }
  
  // Si no es propietario, buscamos en qué gimnasio está registrado como empleado
  const gymsRef = collection(db, 'gyms');
  const gymsSnapshot = await getDocs(gymsRef);
  
  for (const gym of gymsSnapshot.docs) {
    const userDocRef = doc(db, `gyms/${gym.id}/users`, user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Actualizar último login
      await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
      
      // Verificar si el usuario está activo
      if (!userData.isActive) {
        await signOut(auth);
        return { success: false, error: 'Tu cuenta está pendiente de activación por el administrador.' };
      }
      
      // Guardar información en localStorage
      localStorage.setItem('userRole', userData.role);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('gymId', gym.id);
      
      return { 
        success: true, 
        user, 
        userData: { ...userData, id: user.uid }, 
        gymData: { ...gym.data(), id: gym.id },
        role: userData.role,
        gymId: gym.id
      };
    }
  }
  
  // Si llegamos aquí, el usuario existe en Firebase Auth pero no en Firestore
  console.warn('Usuario autenticado pero no encontrado en Firestore');
  return { success: false, error: 'Usuario no encontrado en el sistema.' };
  
} catch (error: any) {
  console.error('Error en inicio de sesión:', error);
  
  // Proporcionar mensajes de error más específicos
  let errorMessage = 'Error al iniciar sesión. Verifica tus credenciales e intenta de nuevo.';
  
  switch (error.code) {
    case 'auth/invalid-email':
      errorMessage = 'Formato de correo electrónico inválido.';
      break;
    case 'auth/user-not-found':
      errorMessage = 'No existe una cuenta con este correo.';
      break;
    case 'auth/wrong-password':
      errorMessage = 'Contraseña incorrecta.';
      break;
    case 'auth/too-many-requests':
      errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.';
      break;
  }
  
  return { success: false, error: errorMessage };
}
};

// Cerrar sesión (MODIFICADO)
export const logoutUser = async () => {
try {
  // Limpiar localStorage antes de cerrar sesión
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('gymId');
  
  await signOut(auth);
  return { success: true };
} catch (error) {
  console.error('Error al cerrar sesión:', error);
  return { success: false, error };
}
};

// Recuperar contraseña
export const resetPassword = async (email: string) => {
try {
  await sendPasswordResetEmail(auth, email);
  return { success: true };
} catch (error) {
  console.error('Error al enviar correo de recuperación:', error);
  return { success: false, error };
}
};

// Obtener usuario actual
export const getCurrentUser = (): User | null => {
return auth.currentUser;
};

// NUEVA FUNCIÓN: Verificar autenticación almacenada
export const checkStoredAuth = () => {
const userRole = localStorage.getItem('userRole');
const userEmail = localStorage.getItem('userEmail');
const gymId = localStorage.getItem('gymId');

return {
  isAuthenticated: !!userRole,
  userRole,
  userEmail,
  gymId
};
};