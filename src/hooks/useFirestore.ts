// src/hooks/useFirestore.ts - VERSIÓN SIMPLE SIN AGREGACIONES

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
  where,
  orderBy,
  limit,
  startAfter,
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

interface SearchOptions {
  field: string;
  value: string | number;
  operator?: '==' | '>=' | '<=' | '>' | '<';
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

  // Obtener todos los documentos - SIMPLE
  const getAll = useCallback(async () => {
    if (!gymData?.id && collectionName !== 'gyms' && collectionName !== 'admins' && collectionName !== 'subscriptionPlans') {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      const collectionRef = collection(db, getCollectionPath());
      const querySnapshot = await getDocs(collectionRef);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      setData(documents);
      setLoading(false);
      return documents;
    } catch (err: any) {
      console.error('Error in getAll:', err);
      setError(err.message);
      setLoading(false);
      return [] as T[];
    }
  }, [getCollectionPath, gymData?.id, collectionName]);

  // Búsqueda simple - SIN AGREGACIONES
  const search = useCallback(async (
    searchTerm: string,
    searchFields: string[] = ['firstName', 'lastName'],
    limitResults: number = 50
  ) => {
    if (!gymData?.id) {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      const collectionRef = collection(db, getCollectionPath());
      
      // UNA SOLA QUERY SIMPLE
      const q = query(
        collectionRef,
        orderBy('firstName'),
        limit(limitResults)
      );
      
      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      // Filtrar en el frontend
      const filtered = documents.filter(doc => {
        const data = doc as any;
        return searchFields.some(field => {
          const fieldValue = String(data[field] || '').toLowerCase();
          return fieldValue.includes(searchTerm.toLowerCase());
        });
      });
      
      setData(filtered);
      setLoading(false);
      return filtered;
    } catch (err: any) {
      console.error('Error in search:', err);
      setError(err.message);
      setLoading(false);
      return [] as T[];
    }
  }, [getCollectionPath, gymData?.id]);

  // Paginación SIMPLE - SIN AGREGACIONES
  const getPaginated = useCallback(async (
    options: PaginationOptions = {},
    filters: SearchOptions[] = [],
    resetPagination: boolean = false
  ) => {
    if (!gymData?.id) {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      const {
        pageSize = 20,
        orderByField = 'createdAt',
        orderDirection = 'desc'
      } = options;

      const collectionRef = collection(db, getCollectionPath());
      
      // Query SIMPLE sin agregaciones
      let q = query(collectionRef, orderBy(orderByField, orderDirection));
      
      // Solo filtros básicos (NO totalDebt)
      filters.forEach(filter => {
        if (filter.field !== 'totalDebt') {
          q = query(q, where(filter.field, filter.operator || '==', filter.value));
        }
      });
      
      q = query(q, limit(pageSize));
      
      if (!resetPagination && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }
      
      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      // Actualizar estado
      const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(newLastVisible);
      setHasMore(querySnapshot.docs.length === pageSize);
      
      if (resetPagination) {
        setData(documents);
      } else {
        setData(prev => [...prev, ...documents]);
      }
      
      setLoading(false);
      return documents;
    } catch (err: any) {
      console.error('Error in getPaginated:', err);
      setError(err.message);
      setLoading(false);
      return [] as T[];
    }
  }, [getCollectionPath, lastVisible, gymData?.id]);

  // Reset pagination
  const resetPagination = useCallback(() => {
    setLastVisible(null);
    setHasMore(true);
    setData([]);
  }, []);

  // CRUD básico sin agregaciones
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
      console.error('Error in getById:', err);
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
      console.error('Error in add:', err);
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
      console.error('Error in update:', err);
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
      console.error('Error in remove:', err);
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
      const {
        pageSize = 50,
        orderByField = 'createdAt',
        orderDirection = 'desc'
      } = options;

      const collectionRef = collection(db, getCollectionPath());
      const q = query(
        collectionRef, 
        orderBy(orderByField, orderDirection), 
        limit(pageSize)
      );
      
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
          console.error('Error in subscription:', err);
          setError(err.message);
        }
      );
      
      return unsubscribe;
    } catch (err: any) {
      console.error('Error setting up subscription:', err);
      setError(err.message);
      return () => {};
    }
  }, [getCollectionPath, gymData?.id]);

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