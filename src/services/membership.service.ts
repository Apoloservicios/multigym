// src/services/membership.service.ts
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
  import { Membership } from '../types/membership.types';
  
  // Obtener todas las membresías de un gimnasio
  export const getMemberships = async (gymId: string): Promise<Membership[]> => {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const q = query(membershipsRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const memberships: Membership[] = [];
      querySnapshot.forEach((doc) => {
        memberships.push({
          id: doc.id,
          ...doc.data()
        } as Membership);
      });
      
      return memberships;
    } catch (error) {
      console.error('Error getting memberships:', error);
      throw error;
    }
  };
  
  // Obtener todas las membresías activas
  export const getActiveMemberships = async (gymId: string): Promise<Membership[]> => {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      const q = query(
        membershipsRef,
        where('isActive', '==', true),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      
      const memberships: Membership[] = [];
      querySnapshot.forEach((doc) => {
        memberships.push({
          id: doc.id,
          ...doc.data()
        } as Membership);
      });
      
      return memberships;
    } catch (error) {
      console.error('Error getting active memberships:', error);
      throw error;
    }
  };
  
  // Obtener una membresía por su ID
  export const getMembership = async (gymId: string, membershipId: string): Promise<Membership | null> => {
    try {
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      const membershipSnap = await getDoc(membershipRef);
      
      if (membershipSnap.exists()) {
        return {
          id: membershipSnap.id,
          ...membershipSnap.data()
        } as Membership;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting membership:', error);
      throw error;
    }
  };
  
  // Crear una nueva membresía
  export const createMembership = async (gymId: string, membershipData: Omit<Membership, 'id'>): Promise<Membership> => {
    try {
      const membershipsRef = collection(db, `gyms/${gymId}/memberships`);
      
      // Establecer campos por defecto
      const newMembership = {
        ...membershipData,
        isActive: membershipData.isActive !== undefined ? membershipData.isActive : true,
        isPopular: membershipData.isPopular !== undefined ? membershipData.isPopular : false,
        activeMembers: membershipData.activeMembers !== undefined ? membershipData.activeMembers : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(membershipsRef, newMembership);
      
      return {
        id: docRef.id,
        ...membershipData
      };
    } catch (error) {
      console.error('Error creating membership:', error);
      throw error;
    }
  };
  
  // Actualizar una membresía existente
  export const updateMembership = async (gymId: string, membershipId: string, membershipData: Partial<Membership>): Promise<boolean> => {
    try {
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      
      // Actualizar con el timestamp
      const updateData = {
        ...membershipData,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(membershipRef, updateData);
      return true;
    } catch (error) {
      console.error('Error updating membership:', error);
      throw error;
    }
  };
  
  // Eliminar una membresía
  export const deleteMembership = async (gymId: string, membershipId: string): Promise<boolean> => {
    try {
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      
      // En un caso real, se debería verificar si hay socios con esta membresía
      // antes de eliminarla o marcarla como inactiva en lugar de eliminarla completamente
      
      await deleteDoc(membershipRef);
      return true;
    } catch (error) {
      console.error('Error deleting membership:', error);
      throw error;
    }
  };
  
  // Marcar/desmarcar una membresía como popular
  export const togglePopularMembership = async (gymId: string, membershipId: string, isPopular: boolean): Promise<boolean> => {
    try {
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      
      await updateDoc(membershipRef, {
        isPopular: isPopular,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error toggling popular status:', error);
      throw error;
    }
  };
  
  // Actualizar contador de miembros activos
  export const updateActiveMembersCount = async (gymId: string, membershipId: string, count: number): Promise<boolean> => {
    try {
      const membershipRef = doc(db, `gyms/${gymId}/memberships`, membershipId);
      
      await updateDoc(membershipRef, {
        activeMembers: count,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating active members count:', error);
      throw error;
    }
  };
  
  export default {
    getMemberships,
    getActiveMemberships,
    getMembership,
    createMembership,
    updateMembership,
    deleteMembership,
    togglePopularMembership,
    updateActiveMembersCount
  };