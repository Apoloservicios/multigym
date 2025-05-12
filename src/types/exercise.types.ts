// src/types/exercise.types.ts - Actualización para incluir campos de ejercicios globales

// Tipos de grupos musculares
export type MuscleGroup = 
  | 'espalda' 
  | 'pecho' 
  | 'hombros' 
  | 'brazos' 
  | 'piernas' 
  | 'abdominales' 
  | 'gluteos'
  | 'cardio'
  | 'fullbody'
  | 'calentamiento'
  | 'elongacion';

// Nivel de dificultad
export type DifficultyLevel = 'principiante' | 'intermedio' | 'avanzado';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  difficulty: DifficultyLevel;
  instructions: string;
  isActive: boolean;
  // Define image para permitir string, null o undefined
  image?: string | null;
  video?: string | null;
  createdAt?: any;
  updatedAt?: any;
  
  // Nuevos campos para manejar ejercicios globales
  isGlobal?: boolean; // True si es un ejercicio global del superadmin
  canEdit?: boolean;  // True si el gimnasio puede editar este ejercicio
  globalCreatedBy?: string; // ID del superadmin que creó el ejercicio global
}

// Resto de interfaces permanecen igual...
export interface RoutineExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: string; // Puede ser "12" o "8-12" o "Al fallo"
  rest: number; // Descanso en segundos
  order: number;
  notes?: string;
  // Nuevo campo para identificar si es un ejercicio global
  isGlobal?: boolean;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  level: DifficultyLevel;
  daysPerWeek: number; // Número de días por semana (de 2 a 6)
  goal: string; // Objetivo de la rutina (ej. "Hipertrofia", "Fuerza", "Definición", etc.)
  duration: number; // Duración en semanas
  exercises: {
    [day: string]: RoutineExercise[]; // Ejercicios por día (day1, day2, etc.)
  };
  isActive: boolean;
  isTemplate: boolean; // Si es una plantilla que puede reutilizarse
  createdAt?: any; // Timestamp de Firebase
  updatedAt?: any; // Timestamp de Firebase
}

// Asignación de rutina a un socio
export interface MemberRoutine {
  id: string;
  memberId: string;
  memberName: string;
  routineId: string;
  routineName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'cancelled';
  progress: number; // Porcentaje de progreso (0-100)
  trainerNotes?: string;
  memberFeedback?: string;
  createdAt?: any; // Timestamp de Firebase
  updatedAt?: any; // Timestamp de Firebase
}

// Objeto con funciones útiles
const exerciseTypes = {
  createEmptyExercise: (): Exercise => ({
    id: '',
    name: '',
    description: '',
    muscleGroup: 'espalda',
    difficulty: 'principiante',
    instructions: '',
    isActive: true,
    isGlobal: false,
    canEdit: true
  }),
  
  createEmptyRoutineExercise: (): RoutineExercise => ({
    id: '',
    exerciseId: '',
    exerciseName: '',
    muscleGroup: 'espalda',
    sets: 3,
    reps: '12',
    rest: 60,
    order: 1,
    isGlobal: false
  }),
  
  createEmptyRoutine: (): Routine => ({
    id: '',
    name: '',
    description: '',
    level: 'principiante',
    daysPerWeek: 3,
    goal: 'Mantenimiento',
    duration: 4,
    exercises: {},
    isActive: true,
    isTemplate: false
  }),
  
  createEmptyMemberRoutine: (): MemberRoutine => ({
    id: '',
    memberId: '',
    memberName: '',
    routineId: '',
    routineName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 28)).toISOString().split('T')[0],
    status: 'active',
    progress: 0
  }),
  
  // Lista de grupos musculares para dropdowns y filtros
  muscleGroups: [
    { value: 'espalda', label: 'Espalda' },
    { value: 'pecho', label: 'Pecho' },
    { value: 'hombros', label: 'Hombros' },
    { value: 'brazos', label: 'Brazos' },
    { value: 'piernas', label: 'Piernas' },
    { value: 'abdominales', label: 'Abdominales' },
    { value: 'gluteos', label: 'Glúteos' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'fullbody', label: 'Full Body' },
    { value: 'calentamiento', label: 'Calentamiento' },
    { value: 'elongacion', label: 'Elongación' }
  ],
  
  // Lista de niveles de dificultad
  difficultyLevels: [
    { value: 'principiante', label: 'Principiante' },
    { value: 'intermedio', label: 'Intermedio' },
    { value: 'avanzado', label: 'Avanzado' }
  ],
  
  // Objetivos de entrenamiento comunes
  trainingGoals: [
    'Mantenimiento',
    'Pérdida de peso',
    'Aumento de masa muscular',
    'Tonificación',
    'Fuerza',
    'Resistencia',
    'Rehabilitación',
    'Definición'
  ]
};

export default exerciseTypes;