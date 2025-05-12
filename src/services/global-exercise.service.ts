// src/services/global-exercise.service.ts

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
  serverTimestamp,
  limit ,
  deleteField 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { GlobalExercise, GlobalExerciseFilter } from '../types/global-exercise.types';

const COLLECTION_NAME = 'globalExercises';

// Obtener todos los ejercicios globales
export const getGlobalExercises = async (filter?: GlobalExerciseFilter): Promise<GlobalExercise[]> => {
  try {
    const exercisesRef = collection(db, COLLECTION_NAME);
    let q = query(exercisesRef, orderBy('name'));
    
    // Aplicar filtros si existen
    if (filter?.muscleGroup) {
      q = query(exercisesRef, where('muscleGroup', '==', filter.muscleGroup), orderBy('name'));
    }
    
    if (filter?.difficulty) {
      q = query(exercisesRef, where('difficulty', '==', filter.difficulty), orderBy('name'));
    }
    
    if (filter?.category) {
      q = query(exercisesRef, where('category', '==', filter.category), orderBy('name'));
    }
    
    if (filter?.isActive !== undefined) {
      q = query(exercisesRef, where('isActive', '==', filter.isActive), orderBy('name'));
    }
    
    const querySnapshot = await getDocs(q);
    
    let exercises: GlobalExercise[] = [];
    querySnapshot.forEach(doc => {
      exercises.push({
        id: doc.id,
        ...doc.data()
      } as GlobalExercise);
    });
    
    // Filtrar por término de búsqueda si existe
    if (filter?.searchTerm) {
      const searchTerm = filter.searchTerm.toLowerCase();
      exercises = exercises.filter(exercise => 
        exercise.name.toLowerCase().includes(searchTerm) ||
        exercise.description.toLowerCase().includes(searchTerm)
      );
    }
    
    return exercises;
  } catch (error) {
    console.error('Error getting global exercises:', error);
    throw error;
  }
};

// Obtener un ejercicio global por ID
export const getGlobalExerciseById = async (exerciseId: string): Promise<GlobalExercise | null> => {
  try {
    const exerciseRef = doc(db, COLLECTION_NAME, exerciseId);
    const exerciseSnap = await getDoc(exerciseRef);
    
    if (exerciseSnap.exists()) {
      return {
        id: exerciseSnap.id,
        ...exerciseSnap.data()
      } as GlobalExercise;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting global exercise by ID:', error);
    throw error;
  }
};

// Crear un nuevo ejercicio global
export const createGlobalExercise = async (exerciseData: Omit<GlobalExercise, 'id'>): Promise<GlobalExercise> => {
  try {
    const exercisesRef = collection(db, COLLECTION_NAME);
    
    // Preparar datos - asegurar que los arrays estén definidos
    const dataToSave = {
      ...exerciseData,
      // Asegurar que los arrays siempre estén definidos
      variations: exerciseData.variations || [],
      tips: exerciseData.tips || [],
      commonMistakes: exerciseData.commonMistakes || [],
      // Campos que pueden ser null en Firestore
      image: exerciseData.image || null,
      video: exerciseData.video || null,
      equipment: exerciseData.equipment || null,
      // Campos requeridos
      isActive: exerciseData.isActive !== undefined ? exerciseData.isActive : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('Datos a guardar en Firestore:', dataToSave); // Para debug
    
    const docRef = await addDoc(exercisesRef, dataToSave);
    
    return {
      id: docRef.id,
      ...dataToSave
    } as GlobalExercise;
  } catch (error) {
    console.error('Error creating global exercise:', error);
    throw error;
  }
};

// Actualizar un ejercicio global
export const updateGlobalExercise = async (
  exerciseId: string, 
  exerciseData: Partial<GlobalExercise>
): Promise<boolean> => {
  try {
    const exerciseRef = doc(db, COLLECTION_NAME, exerciseId);
    
    // Limpiar datos undefined y preparar para Firestore
    const sanitizedData: Record<string, any> = {};
    
    Object.keys(exerciseData).forEach(key => {
      const value = exerciseData[key as keyof typeof exerciseData];
      
      if (value === undefined) {
        // Para eliminar un campo en Firestore, usamos deleteField()
        sanitizedData[key] = deleteField();
      } else if (value === '' && (key === 'video' || key === 'image' || key === 'equipment')) {
        // Para campos opcionales, si es string vacío, lo guardamos como null
        sanitizedData[key] = null;
      } else {
        sanitizedData[key] = value;
      }
    });
    
    // Incluir timestamp de actualización
    const dataToUpdate = {
      ...sanitizedData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(exerciseRef, dataToUpdate);
    
    return true;
  } catch (error) {
    console.error('Error updating global exercise:', error);
    throw error;
  }
};

// Eliminar un ejercicio global
export const deleteGlobalExercise = async (exerciseId: string): Promise<boolean> => {
  try {
    const exerciseRef = doc(db, COLLECTION_NAME, exerciseId);
    await deleteDoc(exerciseRef);
    return true;
  } catch (error) {
    console.error('Error deleting global exercise:', error);
    throw error;
  }
};

// Activar/Desactivar un ejercicio global
export const toggleGlobalExerciseStatus = async (
  exerciseId: string, 
  isActive: boolean
): Promise<boolean> => {
  try {
    const exerciseRef = doc(db, COLLECTION_NAME, exerciseId);
    
    await updateDoc(exerciseRef, {
      isActive: isActive,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error toggling global exercise status:', error);
    throw error;
  }
};

// Validar si el nombre del ejercicio ya existe
export const checkExerciseNameExists = async (name: string, excludeId?: string): Promise<boolean> => {
  try {
    const exercisesRef = collection(db, COLLECTION_NAME);
    const q = query(exercisesRef, where('name', '==', name));
    const querySnapshot = await getDocs(q);
    
    if (excludeId) {
      return querySnapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking exercise name:', error);
    throw error;
  }
};

export default {
  getGlobalExercises,
  getGlobalExerciseById,
  createGlobalExercise,
  updateGlobalExercise,
  deleteGlobalExercise,
  toggleGlobalExerciseStatus,
  checkExerciseNameExists
};