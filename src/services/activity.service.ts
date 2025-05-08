// src/services/activity.service.ts
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  
  // Interface para actividades
  export interface Activity {
    id: string;
    name: string;
    description: string;
    isActive?: boolean;
    createdAt?: any;
    updatedAt?: any;
  }
  
  // Obtener todas las actividades de un gimnasio
  export const getActivities = async (gymId: string): Promise<Activity[]> => {
    try {
      const activitiesRef = collection(db, `gyms/${gymId}/activities`);
      const q = query(activitiesRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const activities: Activity[] = [];
      querySnapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data()
        } as Activity);
      });
      
      return activities;
    } catch (error) {
      console.error('Error getting activities:', error);
      throw error;
    }
  };
  
  // Obtener todas las actividades activas
 // Obtener todas las actividades activas
export const getActiveActivities = async (gymId: string): Promise<Activity[]> => {
  try {
    const activitiesRef = collection(db, `gyms/${gymId}/activities`);
    
    // Primero intentamos con un filtro para actividades activas
    let q = query(
      activitiesRef,
      where('isActive', '==', true),
      orderBy('name')
    );
    
    let querySnapshot = await getDocs(q);
    
    // Si no hay resultados, probamos obteniendo todas las actividades
    if (querySnapshot.empty) {
      console.log("No se encontraron actividades activas, obteniendo todas las actividades");
      q = query(activitiesRef, orderBy('name'));
      querySnapshot = await getDocs(q);
    }
    
    const activities: Activity[] = [];
    querySnapshot.forEach((doc) => {
      activities.push({
        id: doc.id,
        ...doc.data()
      } as Activity);
    });
    
    console.log("Actividades encontradas:", activities.length);
    return activities;
  } catch (error) {
    console.error('Error getting active activities:', error);
    throw error;
  }
};
  
  // Obtener una actividad por su ID
  export const getActivity = async (gymId: string, activityId: string): Promise<Activity | null> => {
    try {
      const activityRef = doc(db, `gyms/${gymId}/activities`, activityId);
      const activitySnap = await getDoc(activityRef);
      
      if (activitySnap.exists()) {
        return {
          id: activitySnap.id,
          ...activitySnap.data()
        } as Activity;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting activity:', error);
      throw error;
    }
  };
  
  // Crear una nueva actividad
  export const createActivity = async (gymId: string, activityData: Omit<Activity, 'id'>): Promise<Activity> => {
    try {
      const activitiesRef = collection(db, `gyms/${gymId}/activities`);
      
      // Establecer campos por defecto
      const newActivity = {
        ...activityData,
        isActive: activityData.isActive !== undefined ? activityData.isActive : true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(activitiesRef, newActivity);
      
      return {
        id: docRef.id,
        ...activityData
      };
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  };
  
  // Actualizar una actividad existente
  export const updateActivity = async (gymId: string, activityId: string, activityData: Partial<Activity>): Promise<boolean> => {
    try {
      const activityRef = doc(db, `gyms/${gymId}/activities`, activityId);
      
      // Actualizar con el timestamp
      const updateData = {
        ...activityData,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(activityRef, updateData);
      return true;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  };
  
  // Eliminar una actividad
  export const deleteActivity = async (gymId: string, activityId: string): Promise<boolean> => {
    try {
      const activityRef = doc(db, `gyms/${gymId}/activities`, activityId);
      
      // Verificar si hay membresías utilizando esta actividad antes de eliminarla
      // (Esta validación se podría implementar aquí o en el componente)
      
      await deleteDoc(activityRef);
      return true;
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  };
  
  export default {
    getActivities,
    getActiveActivities,
    getActivity,
    createActivity,
    updateActivity,
    deleteActivity
  };