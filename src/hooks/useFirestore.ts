// src/hooks/useFirestore.ts

import { useState, useEffect, useCallback } from 'react';
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
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAuth from './useAuth';

const useFirestore = <T>(collectionName: string) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { gymData } = useAuth();

  // Determinar la ruta de la colección basada en si es una subcolección de gimnasio
  const getCollectionPath = useCallback(() => {
    if (collectionName === 'gyms' || collectionName === 'admins' || collectionName === 'subscriptionPlans') {
      return collectionName;
    } else if (gymData?.id) {
      return `gyms/${gymData.id}/${collectionName}`;
    } else {
      throw new Error('No gym ID available for subcollection');
    }
  }, [collectionName, gymData?.id]);

  // Obtener todos los documentos de la colección
  const getAll = useCallback(async () => {
    setLoading(true);
    try {
      const collectionRef = collection(db, getCollectionPath());
      const querySnapshot = await getDocs(collectionRef);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      setData(documents);
      return documents;
    } catch (err: any) {
      setError(err.message);
      return [] as T[];
    } finally {
      setLoading(false);
    }
  }, [getCollectionPath]);

  // Obtener un documento por ID
  const getById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, getCollectionPath(), id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      } else {
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getCollectionPath]);

  // Añadir un nuevo documento
  const add = useCallback(async (data: Omit<T, 'id'>) => {
    setLoading(true);
    try {
      const collectionRef = collection(db, getCollectionPath());
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: Timestamp.now()
      });
      return { id: docRef.id, ...data } as T;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getCollectionPath]);

  // Actualizar un documento
  const update = useCallback(async (id: string, data: Partial<T>) => {
    setLoading(true);
    try {
      const docRef = doc(db, getCollectionPath(), id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCollectionPath]);

  // Eliminar un documento
  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, getCollectionPath(), id);
      await deleteDoc(docRef);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCollectionPath]);

  // Suscribirse a cambios en la colección
  const subscribe = useCallback((callback: (items: T[]) => void) => {
    try {
      const collectionRef = collection(db, getCollectionPath());
      const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        
        setData(documents);
        callback(documents);
      });
      
      return unsubscribe;
    } catch (err: any) {
      setError(err.message);
      return () => {};
    }
  }, [getCollectionPath]);

  return {
    data,
    loading,
    error,
    getAll,
    getById,
    add,
    update,
    remove,
    subscribe
  };
};

export default useFirestore;