// src/utils/storage.utils.ts

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const uploadProfilePhoto = async (file: File, userId: string): Promise<string> => {
  return uploadFile(file, `profile_photos/${userId}`);
};

export const uploadGymLogo = async (file: File, gymId: string): Promise<string> => {
  return uploadFile(file, `gym_logos/${gymId}`);
};

export default {
  uploadFile,
  uploadProfilePhoto,
  uploadGymLogo
};