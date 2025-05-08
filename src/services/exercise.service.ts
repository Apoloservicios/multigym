// src/services/exercise.service.ts

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
  import { Exercise, MuscleGroup, DifficultyLevel } from '../types/exercise.types';
  
  // Obtener todos los ejercicios
  export const getExercises = async (gymId: string): Promise<Exercise[]> => {
    try {
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const q = query(exercisesRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const exercises: Exercise[] = [];
      querySnapshot.forEach(doc => {
        exercises.push({
          id: doc.id,
          ...doc.data()
        } as Exercise);
      });
      
      return exercises;
    } catch (error) {
      console.error('Error getting exercises:', error);
      throw error;
    }
  };
  
  // Obtener ejercicios por grupo muscular
  export const getExercisesByMuscleGroup = async (gymId: string, muscleGroup: MuscleGroup): Promise<Exercise[]> => {
    try {
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const q = query(
        exercisesRef,
        where('muscleGroup', '==', muscleGroup),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      
      const exercises: Exercise[] = [];
      querySnapshot.forEach(doc => {
        exercises.push({
          id: doc.id,
          ...doc.data()
        } as Exercise);
      });
      
      return exercises;
    } catch (error) {
      console.error(`Error getting exercises for muscle group ${muscleGroup}:`, error);
      throw error;
    }
  };
  
  // Obtener ejercicios por nivel de dificultad
  export const getExercisesByDifficulty = async (gymId: string, difficulty: DifficultyLevel): Promise<Exercise[]> => {
    try {
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const q = query(
        exercisesRef,
        where('difficulty', '==', difficulty),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      
      const exercises: Exercise[] = [];
      querySnapshot.forEach(doc => {
        exercises.push({
          id: doc.id,
          ...doc.data()
        } as Exercise);
      });
      
      return exercises;
    } catch (error) {
      console.error(`Error getting exercises for difficulty ${difficulty}:`, error);
      throw error;
    }
  };
  
  // Obtener un ejercicio por su ID
  export const getExerciseById = async (gymId: string, exerciseId: string): Promise<Exercise | null> => {
    try {
      const exerciseRef = doc(db, `gyms/${gymId}/exercises`, exerciseId);
      const exerciseSnap = await getDoc(exerciseRef);
      
      if (exerciseSnap.exists()) {
        return {
          id: exerciseSnap.id,
          ...exerciseSnap.data()
        } as Exercise;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting exercise by ID:', error);
      throw error;
    }
  };
  
 // En src/services/exercise.service.ts

export const createExercise = async (gymId: string, exerciseData: any): Promise<Exercise> => {
  try {
    const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
    
    // Crear una copia y limpiar los campos undefined
    const sanitizedData: Record<string, any> = {};
    
    // Solo incluir campos con valores definidos (no undefined)
    Object.keys(exerciseData).forEach(key => {
      if (exerciseData[key] !== undefined) {
        // Para mayor seguridad, convertir undefined a null para Firestore
        sanitizedData[key] = exerciseData[key] === undefined ? null : exerciseData[key];
      }
    });
    
    // Asegurarse de que campos requeridos estén presentes
    const requiredFields = ['name', 'description', 'muscleGroup', 'difficulty', 'instructions'];
    requiredFields.forEach(field => {
      if (!sanitizedData.hasOwnProperty(field)) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    });
    
    // Incluir campos adicionales para Firestore
    const dataToSave = {
      ...sanitizedData,
      isActive: sanitizedData.isActive !== undefined ? sanitizedData.isActive : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(exercisesRef, dataToSave);
    
    return {
      id: docRef.id,
      ...dataToSave
    } as Exercise;
  } catch (error) {
    console.error('Error creating exercise:', error);
    throw error;
  }
};
  
  // Actualizar un ejercicio existente
  export const updateExercise = async (
    gymId: string, 
    exerciseId: string, 
    exerciseData: Partial<Exercise>
  ): Promise<boolean> => {
    try {
      const exerciseRef = doc(db, `gyms/${gymId}/exercises`, exerciseId);
      
      // Incluir timestamp de actualización
      await updateDoc(exerciseRef, {
        ...exerciseData,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }
  };
  
  // Eliminar un ejercicio
  export const deleteExercise = async (gymId: string, exerciseId: string): Promise<boolean> => {
    try {
      const exerciseRef = doc(db, `gyms/${gymId}/exercises`, exerciseId);
      await deleteDoc(exerciseRef);
      return true;
    } catch (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  };
  
  // Marcar un ejercicio como activo/inactivo
  export const toggleExerciseStatus = async (
    gymId: string, 
    exerciseId: string, 
    isActive: boolean
  ): Promise<boolean> => {
    try {
      const exerciseRef = doc(db, `gyms/${gymId}/exercises`, exerciseId);
      
      await updateDoc(exerciseRef, {
        isActive: isActive,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error toggling exercise status:', error);
      throw error;
    }
  };
  
  export default {
    getExercises,
    getExercisesByMuscleGroup,
    getExercisesByDifficulty,
    getExerciseById,
    createExercise,
    updateExercise,
    deleteExercise,
    toggleExerciseStatus
  };