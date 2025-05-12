// src/components/superadmin/GlobalExerciseDetail.tsx
import React from 'react';
import { ArrowLeft, Edit, Trash, ExternalLink, Dumbbell, Info, AlertTriangle } from 'lucide-react';
import { GlobalExercise } from '../../types/global-exercise.types';
import exerciseTypes from '../../types/exercise.types';
import { exerciseCategories } from '../../types/global-exercise.types';

interface GlobalExerciseDetailProps {
  exercise: GlobalExercise;
  onBack: () => void;
  onEdit: (exercise: GlobalExercise) => void;
  onDelete: (exercise: GlobalExercise) => void;
}

const GlobalExerciseDetail: React.FC<GlobalExerciseDetailProps> = ({ 
  exercise, 
  onBack, 
  onEdit, 
  onDelete 
}) => {
  const getMuscleGroupLabel = (group: string): string => {
    const found = exerciseTypes.muscleGroups.find(g => g.value === group);
    return found ? found.label : group;
  };
  
  const getDifficultyLabel = (level: string): string => {
    const found = exerciseTypes.difficultyLevels.find(d => d.value === level);
    return found ? found.label : level;
  };
  
  const getCategoryLabel = (category: string): string => {
    const found = exerciseCategories.find(c => c.value === category);
    return found ? found.label : category;
  };
  
  // Helper para formatear URLs de videos de YouTube para embedding
  const getEmbedUrl = (videoUrl: string): string => {
    if (!videoUrl) return '';
    
    let videoId = '';
    
    if (videoUrl.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(new URL(videoUrl).search);
      videoId = urlParams.get('v') || '';
    } else if (videoUrl.includes('youtu.be/')) {
      videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (videoUrl.includes('youtube.com/embed/')) {
      videoId = videoUrl.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    }
    
    return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
  };
  
  const renderListSection = (items: string[] | undefined, title: string, icon: React.ReactNode) => {
    if (!items || items.length === 0) return null;
    
    return (
      <div>
        <h3 className="text-lg font-medium mb-2 flex items-center">
          {icon}
          <span className="ml-2">{title}</span>
        </h3>
        <ul className="list-disc list-inside space-y-1">
          {items.map((item, index) => (
            <li key={index} className="text-gray-600">{item}</li>
          ))}
        </ul>
      </div>
    );
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
              {exercise.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {getCategoryLabel(exercise.category)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
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
        </div>
      </div>
      
      {/* Contenido */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda */}
          <div className="space-y-6">
            {/* Imagen */}
            <div>
              {exercise.image ? (
                <img 
                  src={exercise.image} 
                  alt={exercise.name} 
                  className="w-full h-auto max-h-96 object-contain rounded-lg border"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">Sin imagen disponible</span>
                </div>
              )}
            </div>
            
            {/* Descripción */}
            <div>
              <h3 className="text-lg font-medium mb-2">Descripción</h3>
              <p className="text-gray-600">{exercise.description}</p>
            </div>
            
            {/* Equipamiento */}
            {exercise.equipment && (
              <div>
                <h3 className="text-lg font-medium mb-2">Equipamiento Necesario</h3>
                <p className="text-gray-600">{exercise.equipment}</p>
              </div>
            )}
            
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
                    className="rounded-lg w-full h-64"
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
          
          {/* Columna derecha */}
          <div className="space-y-6">
            {/* Instrucciones */}
            <div>
              <h3 className="text-lg font-medium mb-2">Instrucciones</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 whitespace-pre-line">{exercise.instructions}</p>
              </div>
            </div>
            
            {/* Variaciones */}
            {renderListSection(exercise.variations, 'Variaciones', <Dumbbell size={18} className="text-blue-500" />)}
            
            {/* Consejos */}
            {renderListSection(exercise.tips, 'Consejos y Recomendaciones', <Info size={18} className="text-green-500" />)}
            
            {/* Errores Comunes */}
            {renderListSection(exercise.commonMistakes, 'Errores Comunes a Evitar', <AlertTriangle size={18} className="text-red-500" />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalExerciseDetail;