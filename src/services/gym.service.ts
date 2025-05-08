// src/services/gym.service.ts

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadToCloudinary } from '../utils/cloudinary.utils';

// Interface para el perfil de negocio
export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  cuit: string;
  email: string;
  website: string;
  socialMedia: string;
  logo: string | null;
}

// Interface para el gimnasio completo
export interface Gym {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  cuit: string;
  address?: string;
  website?: string;
  socialMedia?: string;
  logo?: string;
  status: 'active' | 'trial' | 'suspended';
  registrationDate: any;
  trialEndsAt?: any;
  subscriptionData?: {
    plan: string;
    startDate: any;
    endDate: any;
    price: number;
    paymentMethod: string;
    lastPayment: any;
    renewalRequested: boolean;
  };
}

// Obtener información del gimnasio
export const getGymInfo = async (gymId: string): Promise<Gym | null> => {
  try {
    const gymRef = doc(db, 'gyms', gymId);
    const gymSnap = await getDoc(gymRef);
    
    if (gymSnap.exists()) {
      return { id: gymSnap.id, ...gymSnap.data() } as Gym;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting gym info:', error);
    throw error;
  }
};

// Verificar y actualizar campos requeridos en el gimnasio
export const ensureGymFields = async (gymId: string): Promise<boolean> => {
  try {
    const gymRef = doc(db, 'gyms', gymId);
    const gymSnap = await getDoc(gymRef);
    
    if (gymSnap.exists()) {
      const gymData = gymSnap.data();
      
      // Verificar si faltan campos y crear objeto de actualización
      const updates: Record<string, any> = {};
      
      if (gymData.address === undefined) updates.address = '';
      if (gymData.website === undefined) updates.website = '';
      if (gymData.socialMedia === undefined) updates.socialMedia = '';
      if (gymData.logo === undefined) updates.logo = null;
      
      // Si hay campos para actualizar, hacerlo
      if (Object.keys(updates).length > 0) {
        console.log('Updating missing fields in gym document:', updates);
        await updateDoc(gymRef, updates);
      }
      
      return true;
    } else {
      console.error('Gym document does not exist');
      return false;
    }
  } catch (error) {
    console.error('Error ensuring gym fields:', error);
    return false;
  }
};

// Actualizar información de perfil del negocio
export const updateBusinessProfile = async (gymId: string, profileData: BusinessProfile, logoFile?: File | null): Promise<boolean> => {
  try {
    const gymRef = doc(db, 'gyms', gymId);
    
    let logoUrl = profileData.logo;
    
    // Si hay un nuevo logo, subirlo a Cloudinary
    if (logoFile) {
      try {
        console.log('Intentando subir logo a Cloudinary:', logoFile.name);
        logoUrl = await uploadToCloudinary(logoFile, `gym_logos/${gymId}`);
        console.log('Logo subido correctamente a Cloudinary:', logoUrl);
      } catch (uploadError) {
        console.error('Error uploading logo to Cloudinary:', uploadError);
        // Continuamos sin actualizar el logo
      }
    }
    
    // Preparar datos para la actualización
    const updateData = {
      name: profileData.name,
      address: profileData.address || '',
      phone: profileData.phone,
      cuit: profileData.cuit,
      email: profileData.email,
      website: profileData.website || '',
      socialMedia: profileData.socialMedia || '',
      updatedAt: serverTimestamp()
    };
    
    // Solo incluir logo si tenemos uno
    if (logoUrl !== undefined) {
      Object.assign(updateData, { logo: logoUrl });
    }
    
    // Actualizar perfil
    await updateDoc(gymRef, updateData);
    console.log('Perfil actualizado correctamente');
    
    return true;
  } catch (error) {
    console.error('Error updating business profile:', error);
    throw error;
  }
};

// Convertir un objeto Gym a un objeto BusinessProfile
export const gymToBusinessProfile = (gym: Gym): BusinessProfile => {
  return {
    name: gym.name || '',
    address: gym.address || '',
    phone: gym.phone || '',
    cuit: gym.cuit || '',
    email: gym.email || '',
    website: gym.website || '',
    socialMedia: gym.socialMedia || '',
    logo: gym.logo || null
  };
};

export default {
  getGymInfo,
  updateBusinessProfile,
  gymToBusinessProfile,
  ensureGymFields
};