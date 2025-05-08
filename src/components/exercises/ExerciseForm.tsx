// src/components/exercises/ExerciseForm.tsx
import React, { useState, useEffect } from 'react';
import { Save, X, Upload, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { Exercise, MuscleGroup, DifficultyLevel } from '../../types/exercise.types';
import exerciseTypes from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';
import { uploadToCloudinary } from '../../utils/cloudinary.utils';

interface ExerciseFormProps {
  initialData?: Exercise;
  isEdit: boolean;
  onSave: (exercise: Omit<Exercise, 'id'>, file?: File) => Promise<void>;
  onCancel: () => void;
}

const ExerciseForm: React.FC<ExerciseFormProps> = ({
  initialData,
  isEdit,
  onSave,
  onCancel
}) => {
  const { gymData } = useAuth();
  
  const [formData, setFormData] = useState<Omit<Exercise, 'id'>>({
    name: '',
    description: '',
    muscleGroup: 'espalda',
    difficulty: 'principiante',
    instructions: '',
    isActive: true,
    image: undefined,
    video: undefined
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar datos iniciales si estamos en modo de edición
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        muscleGroup: initialData.muscleGroup,
        difficulty: initialData.difficulty,
        instructions: initialData.instructions,
        isActive: initialData.isActive,
        image: initialData.image,
        video: initialData.video
      });
      
      if (initialData.image) {
        setImagePreview(initialData.image);
      }
    }
  }, [isEdit, initialData]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validar tamaño máximo (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('La imagen no debe superar los 2MB');
        return;
      }
      
      setImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setError(null);
    }
  };
  
   const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };
  
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('El nombre del ejercicio es obligatorio');
      return false;
    }
    
    if (!formData.description.trim()) {
      setError('La descripción es obligatoria');
      return false;
    }
    
    if (!formData.instructions.trim()) {
      setError('Las instrucciones son obligatorias');
      return false;
    }
    
    return true;
  };
  
// En src/components/exercises/ExerciseForm.tsx

// Antes de enviar el formulario, asegúrate de que no hay campos undefined
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  // Crea una copia de los datos del formulario con valores null en lugar de undefined
  const formDataCleaned = {
    name: formData.name,
    description: formData.description,
    muscleGroup: formData.muscleGroup,
    difficulty: formData.difficulty,
    instructions: formData.instructions,
    isActive: formData.isActive,
    // Cambia undefined a null para Firestore
    image: formData.image || null,
    video: formData.video || null
  };
  
  setLoading(true);
  setError(null);
  
  try {
    await onSave(formDataCleaned, imageFile || undefined);
  } catch (err : any) {
    const error = err as Error; 
    console.error('Error saving exercise:', err);
    setError(err.message || 'Error al guardar el ejercicio');
  } finally {
    setLoading(false);
  }
};
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        {isEdit ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Nombre */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej. Press de Banca, Sentadillas, etc."
              required
            />
          </div>
          
          {/* Grupo Muscular y Dificultad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="muscleGroup" className="block text-sm font-medium text-gray-700 mb-1">
                Grupo Muscular *
              </label>
              <select
                id="muscleGroup"
                name="muscleGroup"
                value={formData.muscleGroup}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {exerciseTypes.muscleGroups.map(group => (
                  <option key={group.value} value={group.value}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de Dificultad *
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {exerciseTypes.difficultyLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Descripción */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción Breve *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Breve descripción del ejercicio"
              required
            ></textarea>
          </div>
          
          {/* Instrucciones */}
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones Detalladas *
            </label>
            <textarea
              id="instructions"
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Instrucciones paso a paso para realizar el ejercicio correctamente"
              required
            ></textarea>
          </div>
          
          {/* URL de Video */}
          <div>
            <label htmlFor="video" className="block text-sm font-medium text-gray-700 mb-1">
              URL de Video (opcional)
            </label>
            <input
              type="url"
              id="video"
              name="video"
              value={formData.video || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ej. https://www.youtube.com/watch?v=..."
            />
            <p className="mt-1 text-sm text-gray-500">
              Puedes añadir un enlace a YouTube u otra plataforma de video
            </p>
          </div>
          
          {/* Imagen */}
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              Imagen (opcional)
            </label>
            <div className="flex items-center mt-2">
              <div className="flex-shrink-0 mr-4">
                {imagePreview ? (
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-24 w-24 object-cover rounded-md"
                  />
                ) : (
                  <div className="h-24 w-24 bg-gray-200 rounded-md flex items-center justify-center">
                    <span className="text-gray-400">Sin imagen</span>
                  </div>
                )}
              </div>
              <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <span className="flex items-center">
                  <Upload size={18} className="mr-2" />
                  Seleccionar archivo
                </span>
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Formatos permitidos: JPG, PNG. Tamaño máximo: 2MB
            </p>
          </div>
          
          {/* Estado activo/inactivo */}
          <div>
            <div className="flex items-center">
              <button 
                type="button"
                onClick={handleToggleActive}
                className="flex items-center focus:outline-none"
              >
                {formData.isActive ? (
                  <ToggleRight size={32} className="text-blue-600 mr-2" />
                ) : (
                  <ToggleLeft size={32} className="text-gray-400 mr-2" />
                )}
                <span className="font-medium">
                  {formData.isActive ? 'Ejercicio Activo' : 'Ejercicio Inactivo'}
                </span>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {formData.isActive 
                ? 'El ejercicio estará disponible para asignar a rutinas' 
                : 'El ejercicio no estará disponible para nuevas rutinas'}
            </p>
          </div>
        </div>
        
        {/* Botones de acción */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            disabled={loading}
          >
            <X size={18} className="mr-2" />
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                {isEdit ? 'Actualizar' : 'Guardar'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExerciseForm;