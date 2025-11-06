// ✅ Segunda instancia de Firebase para crear usuarios sin desloguear al admin
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyD43uNhtAKMTEbjPtQBId67MnrKL81axXg",
    authDomain: "sisgimnasio.firebaseapp.com",
    projectId: "sisgimnasio",
    storageBucket: "sisgimnasio.firebasestorage.app",
    messagingSenderId: "434544305726",
    appId: "1:434544305726:web:676b935206eb174ecf136f",
    measurementId: "G-W89SRSVT3D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ SEGUNDA INSTANCIA SOLO PARA CREAR USUARIOS
// Esto evita que el admin sea deslogueado al crear un usuario móvil
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);

export default app;