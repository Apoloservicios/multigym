// src/hooks/useFirestore.ts - VERSIÓN SIN ÍNDICES COMPLEJOS

import { useState, useCallback } from 'react';
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
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAuth from './useAuth';

interface PaginationOptions {
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

const useFirestore = <T>(collectionName: string) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const { gymData } = useAuth();

  // Determinar la ruta de la colección
  const getCollectionPath = useCallback(() => {
    if (collectionName === 'gyms' || collectionName === 'admins' || collectionName === 'subscriptionPlans') {
      return collectionName;
    } else if (gymData?.id) {
      return `gyms/${gymData.id}/${collectionName}`;
    } else {
      throw new Error('No gym ID available for subcollection');
    }
  }, [collectionName, gymData?.id]);

  // Obtener todos los documentos - MUY SIMPLE
  const getAll = useCallback(async (maxRecords: number = 1000) => {
    // console.log('🔄 getAll iniciado para:', collectionName);
    
    if (!gymData?.id && collectionName !== 'gyms' && collectionName !== 'admins' && collectionName !== 'subscriptionPlans') {
      // console.log('❌ No gym ID disponible');
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      const collectionPath = getCollectionPath();
      // console.log('📂 Accediendo a colección:', collectionPath);
      
      const collectionRef = collection(db, collectionPath);
      
      // Query MUY SIMPLE - solo obtener documentos con límite
      const q = query(collectionRef, limit(maxRecords));
      
      // console.log('🔍 Ejecutando query simple...');
      const querySnapshot = await getDocs(q);
      
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      // console.log('✅ Documentos obtenidos:', documents.length);
      setData(documents);
      setLoading(false);
      return documents;
    } catch (err: any) {
      // console.error('❌ Error in getAll:', err);
      setError(`Error al cargar datos: ${err.message}`);
      setLoading(false);
      return [] as T[];
    }
  }, [getCollectionPath, gymData?.id, collectionName]);

  // Búsqueda SUPER SIMPLE - todo en frontend
  const search = useCallback(async (
    searchTerm: string,
    searchFields: string[] = ['firstName', 'lastName', 'email'],
    limitResults: number = 50
  ) => {
    // console.log('🔍 Búsqueda iniciada para:', searchTerm);
    
    if (!gymData?.id) {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      const collectionPath = getCollectionPath();
      const collectionRef = collection(db, collectionPath);
      
      // Query SUPER SIMPLE - solo limit
      const q = query(collectionRef, limit(500));
      
      // console.log('🔍 Obteniendo todos los documentos para búsqueda...');
      const querySnapshot = await getDocs(q);
      
      const allDocuments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      console.log('📋 Documentos obtenidos:', allDocuments.length);
      
      // Filtrar COMPLETAMENTE en el frontend
      const searchTermLower = searchTerm.toLowerCase();
      const filtered = allDocuments.filter(doc => {
        const data = doc as any;
        
        return searchFields.some(field => {
          const fieldValue = String(data[field] || '').toLowerCase();
          return fieldValue.includes(searchTermLower);
        });
      }).slice(0, limitResults);
      
      // console.log('✅ Resultados filtrados:', filtered.length);
      setData(filtered);
      setLoading(false);
      return filtered;
    } catch (err: any) {
      // console.error('❌ Error in search:', err);
      setError(`Error en búsqueda: ${err.message}`);
      setLoading(false);
      return [] as T[];
    }
  }, [getCollectionPath, gymData?.id]);

  // CRUD básico
  const getById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const docRef = doc(db, getCollectionPath(), id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const result = { id: docSnap.id, ...docSnap.data() } as T;
        setLoading(false);
        return result;
      } else {
        setLoading(false);
        return null;
      }
    } catch (err: any) {
      // console.error('Error in getById:', err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [getCollectionPath]);

  const add = useCallback(async (data: Omit<T, 'id'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const collectionRef = collection(db, getCollectionPath());
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: Timestamp.now()
      });
      
      const result = { id: docRef.id, ...data } as T;
      setLoading(false);
      return result;
    } catch (err: any) {
      // console.error('Error in add:', err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [getCollectionPath]);

  const update = useCallback(async (id: string, data: Partial<T>) => {
    setLoading(true);
    setError(null);
    
    try {
      const docRef = doc(db, getCollectionPath(), id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
      setLoading(false);
      return true;
    } catch (err: any) {
      // console.error('Error in update:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  }, [getCollectionPath]);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const docRef = doc(db, getCollectionPath(), id);
      await deleteDoc(docRef);
      setLoading(false);
      return true;
    } catch (err: any) {
      // console.error('Error in remove:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  }, [getCollectionPath]);

  // Subscribe simplificado
  const subscribe = useCallback((
    callback: (items: T[]) => void,
    options: PaginationOptions = {}
  ) => {
    if (!gymData?.id) {
      return () => {};
    }

    try {
      const collectionRef = collection(db, getCollectionPath());
      
      // Query SUPER SIMPLE - solo limit
      const q = query(collectionRef, limit(100));
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          
          setData(documents);
          callback(documents);
        },
        (err) => {
          // console.error('Error in subscription:', err);
          setError(err.message);
        }
      );
      
      return unsubscribe;
    } catch (err: any) {
      // console.error('Error setting up subscription:', err);
      setError(err.message);
      return () => {};
    }
  }, [getCollectionPath, gymData?.id]);

  // Funciones vacías para mantener compatibilidad
  const getPaginated = useCallback(async () => {
    return getAll();
  }, [getAll]);

  const resetPagination = useCallback(() => {
    setLastVisible(null);
    setHasMore(true);
    setData([]);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    getAll,
    getPaginated,
    search,
    resetPagination,
    getById,
    add,
    update,
    remove,
    subscribe
  };
};

export default useFirestore;