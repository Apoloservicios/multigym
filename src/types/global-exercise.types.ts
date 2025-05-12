// src/types/global-exercise.types.ts

// Reutilizamos los tipos básicos del module de ejercicios regular
import { MuscleGroup, DifficultyLevel } from './exercise.types';


export interface GlobalExercise {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  difficulty: DifficultyLevel;
  instructions: string;
  isActive: boolean;
  // Cambiar string | undefined a string | null | undefined
  image?: string | null;
  video?: string | null;
  category?: 'basico' | 'avanzado' | 'maquina' | 'peso_libre' | 'funcional';
  equipment?: string | null; // Cambiar de string a string | null
  variations?: string[]; // Arrays siempre definidos, pero pueden estar vacíos
  tips?: string[]; 
  commonMistakes?: string[];
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

// Categorías de ejercicios para mejor organización
export const exerciseCategories = [
  { value: 'basico', label: 'Básico' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'maquina', label: 'Con Máquina' },
  { value: 'peso_libre', label: 'Peso Libre' },
  { value: 'funcional', label: 'Funcional' }
];

export interface GlobalExerciseFilter {
  muscleGroup?: MuscleGroup;
  difficulty?: DifficultyLevel;
  category?: string;
  isActive?: boolean;
  searchTerm?: string;
}