// src/services/exercise.service.ts - Actualización para incluir ejercicios globales

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
  
  // Función auxiliar para mapear ejercicios con información de origen
  const mapExerciseWithSource = (doc: any, isGlobal: boolean = false): Exercise => ({
    id: doc.id,
    ...doc.data(),
    isGlobal, // Marcamos si es global o no
    canEdit: !isGlobal // Los ejercicios globales no se pueden editar
  });

  // Obtener ejercicios globales (del superadmin)
  export const getGlobalExercises = async (): Promise<Exercise[]> => {
    try {
      const exercisesRef = collection(db, 'globalExercises');
      const q = query(
        exercisesRef, 
        where('isActive', '==', true),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      
      const exercises: Exercise[] = [];
      querySnapshot.forEach(doc => {
        exercises.push(mapExerciseWithSource(doc, true));
      });
      
      return exercises;
    } catch (error) {
      console.error('Error getting global exercises:', error);
      return []; // Retornamos array vacío en caso de error para no romper la app
    }
  };
  
  // Obtener todos los ejercicios (propios + globales)
  export const getAllExercises = async (gymId: string): Promise<Exercise[]> => {
    try {
      // Obtener ejercicios propios del gimnasio
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const q = query(exercisesRef, orderBy('name'));
      const gymQuerySnapshot = await getDocs(q);
      
      const gymExercises: Exercise[] = [];
      gymQuerySnapshot.forEach(doc => {
        gymExercises.push(mapExerciseWithSource(doc, false));
      });
      
      // Obtener ejercicios globales
      const globalExercises = await getGlobalExercises();
      
      // Combinar ambos arrays, poniendo primero los ejercicios propios
      return [...gymExercises, ...globalExercises];
    } catch (error) {
      console.error('Error getting all exercises:', error);
      throw error;
    }
  };
  
  // Mantener la función original para compatibilidad
  export const getExercises = async (gymId: string): Promise<Exercise[]> => {
    // Por ahora, mantener la funcionalidad original
    try {
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const q = query(exercisesRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const exercises: Exercise[] = [];
      querySnapshot.forEach(doc => {
        exercises.push(mapExerciseWithSource(doc, false));
      });
      
      return exercises;
    } catch (error) {
      console.error('Error getting exercises:', error);
      throw error;
    }
  };
  
  // Obtener ejercicios por grupo muscular (propios + globales)
  export const getAllExercisesByMuscleGroup = async (gymId: string, muscleGroup: MuscleGroup): Promise<Exercise[]> => {
    try {
      // Obtener ejercicios propios por grupo muscular
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const gymQuery = query(
        exercisesRef,
        where('muscleGroup', '==', muscleGroup),
        where('isActive', '==', true),
        orderBy('name')
      );
      const gymQuerySnapshot = await getDocs(gymQuery);
      
      const gymExercises: Exercise[] = [];
      gymQuerySnapshot.forEach(doc => {
        gymExercises.push(mapExerciseWithSource(doc, false));
      });
      
      // Obtener ejercicios globales por grupo muscular
      const globalExercisesRef = collection(db, 'globalExercises');
      const globalQuery = query(
        globalExercisesRef,
        where('muscleGroup', '==', muscleGroup),
        where('isActive', '==', true),
        orderBy('name')
      );
      const globalQuerySnapshot = await getDocs(globalQuery);
      
      const globalExercises: Exercise[] = [];
      globalQuerySnapshot.forEach(doc => {
        globalExercises.push(mapExerciseWithSource(doc, true));
      });
      
      return [...gymExercises, ...globalExercises];
    } catch (error) {
      console.error(`Error getting exercises for muscle group ${muscleGroup}:`, error);
      throw error;
    }
  };
  
  // Obtener ejercicios por dificultad (propios + globales)
  export const getAllExercisesByDifficulty = async (gymId: string, difficulty: DifficultyLevel): Promise<Exercise[]> => {
    try {
      // Obtener ejercicios propios por dificultad
      const exercisesRef = collection(db, `gyms/${gymId}/exercises`);
      const gymQuery = query(
        exercisesRef,
        where('difficulty', '==', difficulty),
        where('isActive', '==', true),
        orderBy('name')
      );
      const gymQuerySnapshot = await getDocs(gymQuery);
      
      const gymExercises: Exercise[] = [];
      gymQuerySnapshot.forEach(doc => {
        gymExercises.push(mapExerciseWithSource(doc, false));
      });
      
      // Obtener ejercicios globales por dificultad
      const globalExercisesRef = collection(db, 'globalExercises');
      const globalQuery = query(
        globalExercisesRef,
        where('difficulty', '==', difficulty),
        where('isActive', '==', true),
        orderBy('name')
      );
      const globalQuerySnapshot = await getDocs(globalQuery);
      
      const globalExercises: Exercise[] = [];
      globalQuerySnapshot.forEach(doc => {
        globalExercises.push(mapExerciseWithSource(doc, true));
      });
      
      return [...gymExercises, ...globalExercises];
    } catch (error) {
      console.error(`Error getting exercises for difficulty ${difficulty}:`, error);
      throw error;
    }
  };
  
  // Los demás métodos permanecen igual (create, update, delete, etc.)
  // ya que estas operaciones solo se pueden hacer en ejercicios propios
  
  export const getExerciseById = async (gymId: string, exerciseId: string): Promise<Exercise | null> => {
    try {
      // Primero intentamos buscarlo en los ejercicios del gimnasio
      const gymExerciseRef = doc(db, `gyms/${gymId}/exercises`, exerciseId);
      const gymExerciseSnap = await getDoc(gymExerciseRef);
      
      if (gymExerciseSnap.exists()) {
        return mapExerciseWithSource(gymExerciseSnap, false);
      }
      
      // Si no está en los ejercicios del gimnasio, buscar en los globales
      const globalExerciseRef = doc(db, 'globalExercises', exerciseId);
      const globalExerciseSnap = await getDoc(globalExerciseRef);
      
      if (globalExerciseSnap.exists()) {
        return mapExerciseWithSource(globalExerciseSnap, true);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting exercise by ID:', error);
      throw error;
    }
  };
  
  // Los demás métodos permanecen sin cambios
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
        isGlobal: false, // Los ejercicios creados por gimnasios no son globales
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(exercisesRef, dataToSave);
      
      return {
        id: docRef.id,
        ...dataToSave,
        canEdit: true
      } as Exercise;
    } catch (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
  };
  
  // El resto de métodos permanecen igual...
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
    getAllExercises,
    getGlobalExercises,
    getAllExercisesByMuscleGroup,
    getAllExercisesByDifficulty,
    getExerciseById,
    createExercise,
    updateExercise,
    deleteExercise,
    toggleExerciseStatus
  };