// src/services/routine.service.ts

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
  import { Routine, MemberRoutine, DifficultyLevel } from '../types/exercise.types';
  
  // Obtener todas las rutinas
  export const getRoutines = async (gymId: string): Promise<Routine[]> => {
    try {
      const routinesRef = collection(db, `gyms/${gymId}/routines`);
      const q = query(routinesRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const routines: Routine[] = [];
      querySnapshot.forEach(doc => {
        routines.push({
          id: doc.id,
          ...doc.data()
        } as Routine);
      });
      
      return routines;
    } catch (error) {
      console.error('Error getting routines:', error);
      throw error;
    }
  };
  
  // Obtener rutinas por nivel de dificultad
  export const getRoutinesByLevel = async (gymId: string, level: DifficultyLevel): Promise<Routine[]> => {
    try {
      const routinesRef = collection(db, `gyms/${gymId}/routines`);
      const q = query(
        routinesRef,
        where('level', '==', level),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      
      const routines: Routine[] = [];
      querySnapshot.forEach(doc => {
        routines.push({
          id: doc.id,
          ...doc.data()
        } as Routine);
      });
      
      return routines;
    } catch (error) {
      console.error(`Error getting routines for level ${level}:`, error);
      throw error;
    }
  };
  
  // Obtener rutinas por número de días por semana
  export const getRoutinesByDaysPerWeek = async (gymId: string, daysPerWeek: number): Promise<Routine[]> => {
    try {
      const routinesRef = collection(db, `gyms/${gymId}/routines`);
      const q = query(
        routinesRef,
        where('daysPerWeek', '==', daysPerWeek),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      
      const routines: Routine[] = [];
      querySnapshot.forEach(doc => {
        routines.push({
          id: doc.id,
          ...doc.data()
        } as Routine);
      });
      
      return routines;
    } catch (error) {
      console.error(`Error getting routines for ${daysPerWeek} days per week:`, error);
      throw error;
    }
  };
  
  // Obtener una rutina por su ID
  export const getRoutineById = async (gymId: string, routineId: string): Promise<Routine | null> => {
    try {
      const routineRef = doc(db, `gyms/${gymId}/routines`, routineId);
      const routineSnap = await getDoc(routineRef);
      
      if (routineSnap.exists()) {
        return {
          id: routineSnap.id,
          ...routineSnap.data()
        } as Routine;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting routine by ID:', error);
      throw error;
    }
  };
  
  // Crear una nueva rutina
  export const createRoutine = async (gymId: string, routineData: Omit<Routine, 'id'>): Promise<Routine> => {
  try {
    const routinesRef = collection(db, `gyms/${gymId}/routines`);
    
    // Preparar datos para Firestore con valores por defecto
    const newRoutine = {
      ...routineData,
      isActive: routineData.isActive !== undefined ? routineData.isActive : true,
      isTemplate: routineData.isTemplate !== undefined ? routineData.isTemplate : true, // ← Por defecto true
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(routinesRef, newRoutine);
    
    return {
      id: docRef.id,
      ...newRoutine
    } as Routine;
  } catch (error) {
    console.error('Error creating routine:', error);
    throw error;
  }
};
  
  // Actualizar una rutina existente
  export const updateRoutine = async (
    gymId: string, 
    routineId: string, 
    routineData: Partial<Routine>
  ): Promise<boolean> => {
    try {
      const routineRef = doc(db, `gyms/${gymId}/routines`, routineId);
      
      // Incluir timestamp de actualización
      await updateDoc(routineRef, {
        ...routineData,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating routine:', error);
      throw error;
    }
  };
  
  // Eliminar una rutina
  export const deleteRoutine = async (gymId: string, routineId: string): Promise<boolean> => {
    try {
      // Primero verificar si hay socios usando esta rutina
      const memberRoutinesRef = collection(db, `gyms/${gymId}/memberRoutines`);
      const q = query(memberRoutinesRef, where('routineId', '==', routineId), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error('No se puede eliminar la rutina porque hay socios asignados a ella');
      }
      
      const routineRef = doc(db, `gyms/${gymId}/routines`, routineId);
      await deleteDoc(routineRef);
      return true;
    } catch (error) {
      console.error('Error deleting routine:', error);
      throw error;
    }
  };
  
  // Duplicar una rutina existente (útil para crear a partir de plantillas)
  export const duplicateRoutine = async (gymId: string, routineId: string, newName: string): Promise<Routine | null> => {
    try {
      // Obtener la rutina original
      const originalRoutine = await getRoutineById(gymId, routineId);
      
      if (!originalRoutine) {
        throw new Error('Rutina original no encontrada');
      }
      
      // Crear una nueva rutina con los datos de la original
      const newRoutine: Omit<Routine, 'id'> = {
        ...originalRoutine,
        name: newName,
        isTemplate: false,
        createdAt: undefined, // Esto se generará al crear
        updatedAt: undefined  // Esto se generará al crear
      };
      
      // No copiar el ID de la rutina original
      delete (newRoutine as any).id;
      
      // Crear la nueva rutina
      return await createRoutine(gymId, newRoutine);
    } catch (error) {
      console.error('Error duplicating routine:', error);
      throw error;
    }
  };
  
  // Asignar una rutina a un socio
  export const assignRoutineToMember = async (
    gymId: string, 
    memberId: string, 
    memberName: string, 
    routineId: string, 
    startDate: string,
    duration: number,
    trainerNotes?: string
  ): Promise<MemberRoutine> => {
    try {
      // Obtener la rutina
      const routine = await getRoutineById(gymId, routineId);
      
      if (!routine) {
        throw new Error('Rutina no encontrada');
      }
      
      // Calcular fecha de finalización
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + duration * 7); // duration es en semanas
      
      const endDate = endDateObj.toISOString().split('T')[0];
      
      // Crear objeto de asignación
      const memberRoutineData: Omit<MemberRoutine, 'id'> = {
        memberId,
        memberName,
        routineId,
        routineName: routine.name,
        startDate,
        endDate,
        status: 'active',
        progress: 0,
        trainerNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Guardar la asignación
      const memberRoutinesRef = collection(db, `gyms/${gymId}/memberRoutines`);
      const docRef = await addDoc(memberRoutinesRef, memberRoutineData);
      
      return {
        id: docRef.id,
        ...memberRoutineData
      } as MemberRoutine;
    } catch (error) {
      console.error('Error assigning routine to member:', error);
      throw error;
    }
  };
  
  // Obtener las rutinas asignadas a un socio
  export const getMemberRoutines = async (gymId: string, memberId?: string): Promise<MemberRoutine[]> => {
    try {
      const memberRoutinesRef = collection(db, `gyms/${gymId}/memberRoutines`);
      let q;
      
      if (memberId) {
        q = query(
          memberRoutinesRef,
          where('memberId', '==', memberId),
          orderBy('startDate', 'desc')
        );
      } else {
        q = query(
          memberRoutinesRef,
          orderBy('startDate', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const memberRoutines: MemberRoutine[] = [];
      querySnapshot.forEach(doc => {
        memberRoutines.push({
          id: doc.id,
          ...doc.data()
        } as MemberRoutine);
      });
      
      return memberRoutines;
    } catch (error) {
      console.error('Error getting member routines:', error);
      throw error;
    }
  };
  
  // Actualizar el progreso de una rutina asignada
  export const updateMemberRoutineProgress = async (
    gymId: string, 
    memberRoutineId: string, 
    progress: number,
    memberFeedback?: string
  ): Promise<boolean> => {
    try {
      const memberRoutineRef = doc(db, `gyms/${gymId}/memberRoutines`, memberRoutineId);
      
      await updateDoc(memberRoutineRef, {
        progress,
        memberFeedback,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating member routine progress:', error);
      throw error;
    }
  };
  
  // Cambiar el estado de una rutina asignada (completar, cancelar)
  export const updateMemberRoutineStatus = async (
    gymId: string, 
    memberRoutineId: string, 
    status: 'active' | 'completed' | 'cancelled',
    trainerNotes?: string
  ): Promise<boolean> => {
    try {
      const memberRoutineRef = doc(db, `gyms/${gymId}/memberRoutines`, memberRoutineId);
      
      await updateDoc(memberRoutineRef, {
        status,
        trainerNotes,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating member routine status:', error);
      throw error;
    }
  };
  
  export default {
    getRoutines,
    getRoutinesByLevel,
    getRoutinesByDaysPerWeek,
    getRoutineById,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    duplicateRoutine,
    assignRoutineToMember,
    getMemberRoutines,
    updateMemberRoutineProgress,
    updateMemberRoutineStatus
  };