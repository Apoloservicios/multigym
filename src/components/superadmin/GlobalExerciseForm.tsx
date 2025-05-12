import React, { useState, useEffect } from 'react';
import { Save, X, Upload, AlertCircle, ToggleLeft, ToggleRight, Plus, Minus } from 'lucide-react';
import { GlobalExercise, exerciseCategories } from '../../types/global-exercise.types';
import exerciseTypes from '../../types/exercise.types';
import useAuth from '../../hooks/useAuth';
import { uploadToCloudinary } from '../../utils/cloudinary.utils';
import { checkExerciseNameExists } from '../../services/global-exercise.service';

interface GlobalExerciseFormProps {
  initialData?: GlobalExercise;
  isEdit: boolean;
  onSave: (exercise: Omit<GlobalExercise, 'id'>, file?: File) => Promise<void>;
  onCancel: () => void;
}

const GlobalExerciseForm: React.FC<GlobalExerciseFormProps> = ({
  initialData,
  isEdit,
  onSave,
  onCancel
}) => {
  const { currentUser } = useAuth();
  
  // Estado del formulario
 const [formData, setFormData] = useState<Omit<GlobalExercise, 'id'>>({
  name: '',
  description: '',
  muscleGroup: 'espalda',
  difficulty: 'principiante',
  instructions: '',
  isActive: true,
  image: undefined,
  video: undefined,
  category: 'basico',
  equipment: '',
  variations: [], // Inicializar como array vacío
  tips: [], // Inicializar como array vacío
  commonMistakes: [] // Inicializar como array vacío
});
  
  // Estado para manejar arrays dinámicos
  const [newVariation, setNewVariation] = useState<string>('');
  const [newTip, setNewTip] = useState<string>('');
  const [newMistake, setNewMistake] = useState<string>('');
  
  // Estado para manejo de imagen
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Estado para UI
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState<boolean>(false);
  
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
      video: initialData.video,
      category: initialData.category || 'basico',
      equipment: initialData.equipment || '',
      // Asegurar que los arrays siempre sean arrays
      variations: Array.isArray(initialData.variations) ? [...initialData.variations] : [],
      tips: Array.isArray(initialData.tips) ? [...initialData.tips] : [],
      commonMistakes: Array.isArray(initialData.commonMistakes) ? [...initialData.commonMistakes] : []
    });
    
    if (initialData.image) {
      setImagePreview(initialData.image);
    }
  }
}, [isEdit, initialData]);
  
  // Manejar cambios en campos básicos
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  
  // Usar type assertion para evitar errores de TypeScript
  setFormData(prev => ({
    ...prev,
    [name]: value as any
  }));
  
  // Si es el nombre, verificar si ya existe
  if (name === 'name' && value.trim()) {
    checkNameAvailability(value);
  }
};
  
  // Verificar si el nombre ya existe
  const checkNameAvailability = async (name: string) => {
    setCheckingName(true);
    try {
      const exists = await checkExerciseNameExists(name, isEdit ? initialData?.id : undefined);
      if (exists) {
        setError(`Ya existe un ejercicio con el nombre "${name}". Por favor, elige otro nombre.`);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Error checking exercise name:', err);
    } finally {
      setCheckingName(false);
    }
  };
  
  // Manejar cambio de imagen
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
  
  // Alternar estado activo/inactivo
  const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };
  
  // Funciones para manejar arrays dinámicos
const handleAddVariation = () => {
  if (newVariation.trim()) {
    setFormData(prev => ({
      ...prev,
      variations: [...(prev.variations || []), newVariation.trim()]
    }));
    setNewVariation('');
  }
};

const handleAddTip = () => {
  if (newTip.trim()) {
    setFormData(prev => ({
      ...prev,
      tips: [...(prev.tips || []), newTip.trim()]
    }));
    setNewTip('');
  }
};

const handleAddMistake = () => {
  if (newMistake.trim()) {
    setFormData(prev => ({
      ...prev,
      commonMistakes: [...(prev.commonMistakes || []), newMistake.trim()]
    }));
    setNewMistake('');
  }
};
  
  const handleRemoveVariation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variations: (prev.variations || []).filter((_, i) => i !== index)
    }));
  };
  
 
  const handleRemoveTip = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tips: (prev.tips || []).filter((_, i) => i !== index)
    }));
  };
  
  
  const handleRemoveMistake = (index: number) => {
    setFormData(prev => ({
      ...prev,
      commonMistakes: (prev.commonMistakes || []).filter((_, i) => i !== index)
    }));
  };

  
  // Validar formulario
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
  
  // Enviar formulario
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  setLoading(true);
  setError(null);
  
  try {
    // Preparar datos para guardar - incluir arrays aunque estén vacíos
    const cleanedData: Omit<GlobalExercise, 'id'> = {
      name: formData.name,
      description: formData.description,
      muscleGroup: formData.muscleGroup,
      difficulty: formData.difficulty,
      instructions: formData.instructions,
      isActive: formData.isActive,
      // Campos opcionales de texto - undefined si están vacíos
      image: formData.image || undefined,
      video: formData.video || undefined,
      equipment: formData.equipment || undefined,
      category: formData.category || 'basico',
      // Arrays - siempre incluir, aunque estén vacíos
      variations: formData.variations || [],
      tips: formData.tips || [],
      commonMistakes: formData.commonMistakes || [],
      // CreatedBy
      createdBy: !isEdit ? currentUser?.uid : formData.createdBy
    };
    
    console.log('Datos que se van a guardar:', cleanedData); // Para debug
    
    await onSave(cleanedData, imageFile || undefined);
  } catch (err: any) {
    console.error('Error saving global exercise:', err);
    setError(err.message || 'Error al guardar el ejercicio global');
  } finally {
    setLoading(false);
  }
};
  
  // Renderizar lista de elementos (variaciones, tips, errores)
  const renderListItems = (items: string[], onRemove: (index: number) => void, title: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No hay {title.toLowerCase()} definidos
        </div>
      );
    }
    
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start justify-between bg-gray-50 p-2 rounded">
            <span className="text-sm flex-1">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              <Minus size={16} />
            </button>
          </li>
        ))}
      </ul>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">
        {isEdit ? 'Editar Ejercicio Global' : 'Nuevo Ejercicio Global'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información básica */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium mb-4">Información Básica</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Ejercicio *
                </label>
                <div className="relative">
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
                  {checkingName && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Grupo Muscular */}
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
              
              {/* Dificultad */}
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
              
              {/* Categoría */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {exerciseCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Equipamiento */}
              <div>
                <label htmlFor="equipment" className="block text-sm font-medium text-gray-700 mb-1">
                  Equipamiento Necesario
                </label>
                <input
                  type="text"
                  id="equipment"
                  name="equipment"
                  value={formData.equipment || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej. Barra, Mancuernas, Máquina Smith, etc."
                />
              </div>
            </div>
          </div>
                  
          {/* Descripción e Instrucciones */}
          <div className="space-y-4">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descripción Breve *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Breve descripción del ejercicio y sus beneficios"
                required
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
                Instrucciones Detalladas *
              </label>
              <textarea
                id="instructions"
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Instrucciones paso a paso para realizar el ejercicio correctamente"
                required
              ></textarea>
            </div>
          </div>
          
          {/* Variaciones */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium mb-4">Variaciones del Ejercicio</h3>
            <div className="space-y-4">
              <div>
                {renderListItems(formData.variations || [], handleRemoveVariation, 'Variaciones')}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVariation}
                  onChange={(e) => setNewVariation(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agregar una variación del ejercicio"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariation())}
                />
                <button
                  type="button"
                  onClick={handleAddVariation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Consejos */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium mb-4">Consejos y Recomendaciones</h3>
            <div className="space-y-4">
              <div>
                {renderListItems(formData.tips || [], handleRemoveTip, 'Consejos')}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTip}
                  onChange={(e) => setNewTip(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agregar un consejo o recomendación"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTip())}
                />
                <button
                  type="button"
                  onClick={handleAddTip}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Errores Comunes */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium mb-4">Errores Comunes a Evitar</h3>
            <div className="space-y-4">
              <div>
                {renderListItems(formData.commonMistakes || [], handleRemoveMistake, 'Errores Comunes')}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMistake}
                  onChange={(e) => setNewMistake(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agregar un error común a evitar"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMistake())}
                />
                <button
                  type="button"
                  onClick={handleAddMistake}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Media */}
          <div className="space-y-4">
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
                      className="h-32 w-32 object-cover rounded-md"
                    />
                  ) : (
                    <div className="h-32 w-32 bg-gray-200 rounded-md flex items-center justify-center">
                   
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
             <p className="mt-2 text-sm text-gray-500">
               Formatos permitidos: JPG, PNG. Tamaño máximo: 2MB
             </p>
           </div>
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
               ? 'El ejercicio estará disponible para todos los gimnasios' 
               : 'El ejercicio no estará visible para los gimnasios'}
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
           disabled={loading || checkingName}
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

export default GlobalExerciseForm;