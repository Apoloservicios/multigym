// src/components/exercises/ExerciseDetail.tsx
import React from 'react';
import { ArrowLeft, Edit, Trash, ExternalLink, Globe, Building2 } from 'lucide-react';
import { Exercise, MuscleGroup, DifficultyLevel } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';


interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onEdit: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
}

const ExerciseDetail: React.FC<ExerciseDetailProps> = ({ 
  exercise, 
  onBack, 
  onEdit, 
  onDelete 
}) => {
  const getMuscleGroupLabel = (group: MuscleGroup): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
  };
  
  const getDifficultyLabel = (level: DifficultyLevel): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
  };
  
  // Helper para formatear URLs de videos de YouTube para embedding
  const getEmbedUrl = (videoUrl: string): string => {
    if (!videoUrl) return '';
    
    let videoId = '';
    
    // YouTube URL Formats:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    
    if (videoUrl.includes('youtube.com/watch')) {
      // Extract from youtube.com/watch format
      const urlParams = new URLSearchParams(new URL(videoUrl).search);
      videoId = urlParams.get('v') || '';
    } else if (videoUrl.includes('youtu.be/')) {
      // Extract from youtu.be format
      videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (videoUrl.includes('youtube.com/embed/')) {
      // Extract from youtube.com/embed format
      videoId = videoUrl.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    return videoUrl; // Return original if format not recognized
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Cabecera con acciones */}
      <div className="p-6 border-b flex flex-col sm:flex-row justify-between sm:items-center">
        <div className="flex items-center mb-4 sm:mb-0">
          <button
            onClick={onBack}
            className="p-2 mr-3 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold">{exercise.name}</h2>
            <div className="flex items-center mt-1 space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                exercise.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {exercise.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {getMuscleGroupLabel(exercise.muscleGroup)}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {getDifficultyLabel(exercise.difficulty)}
              </span>
              {/* Nuevo badge para mostrar si es ejercicio global */}
              {exercise.isGlobal ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  <Globe size={12} className="mr-1" />
                  Global
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <Building2 size={12} className="mr-1" />
                  Propio
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* Solo mostrar acciones para ejercicios no globales */}
          {!exercise.isGlobal ? (
            <>
              <button
                onClick={() => onEdit(exercise)}
                className="px-3 py-1 border border-gray-300 rounded-md flex items-center hover:bg-gray-50"
              >
                <Edit size={18} className="mr-1" />
                Editar
              </button>
              <button
                onClick={() => onDelete(exercise)}
                className="px-3 py-1 border border-red-300 text-red-700 rounded-md flex items-center hover:bg-red-50"
              >
                <Trash size={18} className="mr-1" />
                Eliminar
              </button>
            </>
          ) : (
            <div className="bg-gray-50 px-4 py-2 rounded-md flex items-center text-gray-600">
              <Globe size={18} className="mr-2" />
              <span className="text-sm">Ejercicio global (solo lectura)</span>
 	    </div>)}
        </div>
      </div>
      
      {/* Contenido */}
      <div className="p-6">
        {/* Mensaje informativo para ejercicios globales */}
        {exercise.isGlobal && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-md mb-6">
            <div className="flex items-center">
              <Globe size={18} className="mr-2" />
              <div>
                <p className="text-sm font-medium">Ejercicio Global</p>
                <p className="text-xs mt-1">
                  Este ejercicio está disponible para todos los gimnasios. 
                  Solo puede ser editado desde el panel de administración global.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Imagen y detalles básicos */}
          <div>
            {/* Imagen */}
            <div className="mb-6">
              {exercise.image ? (
                <img 
                  src={exercise.image} 
                  alt={exercise.name} 
                  className="w-full h-auto max-h-80 object-contain rounded-lg border"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">Sin imagen disponible</span>
                </div>
              )}
            </div>
            
            {/* Descripción */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Descripción</h3>
              <p className="text-gray-600">{exercise.description}</p>
            </div>
            
            {/* Información adicional */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-3">Información del Ejercicio</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Grupo Muscular:</span>
                  <span className="font-medium">{getMuscleGroupLabel(exercise.muscleGroup)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Dificultad:</span>
                  <span className="font-medium">{getDifficultyLabel(exercise.difficulty)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`font-medium ${exercise.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {exercise.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium flex items-center">
                    {exercise.isGlobal ? (
                      <>
                        <Globe size={16} className="mr-1 text-purple-600" />
                        Global
                      </>
                    ) : (
                      <>
                        <Building2 size={16} className="mr-1 text-blue-600" />
                        Propio del gimnasio
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Instrucciones y Video */}
          <div>
            {/* Instrucciones */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Instrucciones Detalladas</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 whitespace-pre-line">{exercise.instructions}</p>
              </div>
            </div>
            
            {/* Video */}
            {exercise.video && (
              <div>
                <h3 className="text-lg font-medium mb-2">Video Demostrativo</h3>
                <div className="aspect-w-16 aspect-h-9 mb-2">
                  <iframe
                    src={getEmbedUrl(exercise.video)}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`Video de ${exercise.name}`}
                    className="rounded-lg w-full h-full"
                  ></iframe>
                </div>
                <a 
                  href={exercise.video} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={16} className="mr-1" />
                  Ver en sitio original
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetail;