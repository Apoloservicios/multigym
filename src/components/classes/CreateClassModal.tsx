// src/components/classes/CreateClassModal.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createClassDefinition,
  createSingleClass,
  getActivities
} from '../../services/classService';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' }
];

    export const CreateClassModal: React.FC<CreateClassModalProps> = ({
    isOpen,
    onClose,
    onSuccess
    }) => {
    const { currentUser, userData } = useAuth();
   const gymId = currentUser?.uid; 
    
    const [tabValue, setTabValue] = useState<'simple' | 'recurring'>('simple');
    
    // Campos comunes
    const [activities, setActivities] = useState<any[]>([]);
    const [activityId, setActivityId] = useState('');
    const [instructor, setInstructor] = useState('');
    const [capacity, setCapacity] = useState(10);
    const [cancellationDeadline, setCancellationDeadline] = useState(15);
    const [allowWaitlist, setAllowWaitlist] = useState(true);
    const [maxWaitlist, setMaxWaitlist] = useState(5);
    
    // Clase Simple
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('16:00');
    const [endTime, setEndTime] = useState('17:00');
    
    // Clase Recurrente
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Lun, Mié, Vie
    const [recStartTime, setRecStartTime] = useState('16:00');
    const [recEndTime, setRecEndTime] = useState('17:00');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    useEffect(() => {
        if (isOpen && gymId) {
        loadActivities();
        }
    }, [isOpen, gymId]);
    
    const loadActivities = async () => {
        try {
        const acts = await getActivities(gymId!);
        setActivities(acts);
        if (acts.length > 0) {
            setActivityId(acts[0].id);
        }
        } catch (error) {
        console.error('Error cargando actividades:', error);
        }
    };
  
  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };
  
  const validateForm = () => {
    if (!activityId) {
      setError('Selecciona una actividad');
      return false;
    }
    if (!instructor.trim()) {
      setError('Ingresa el nombre del instructor');
      return false;
    }
    if (capacity < 1) {
      setError('La capacidad debe ser mayor a 0');
      return false;
    }
    if (tabValue === 'simple' && !date) {
      setError('Selecciona una fecha');
      return false;
    }
    if (tabValue === 'recurring' && selectedDays.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return false;
    }
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const selectedActivity = activities.find(a => a.id === activityId);
      
      if (tabValue === 'simple') {
        // CLASE SIMPLE
        await createSingleClass(gymId!, {
          activityId,
          activityName: selectedActivity?.name || '',
          instructor,
          capacity,
          date: date,
          startTime,
          endTime,
          cancellationDeadline,
          allowWaitlist,
          maxWaitlist
        });
      } else {
        // CLASE RECURRENTE
        await createClassDefinition(gymId!, {
          activityId,
          activityName: selectedActivity?.name || '',
          instructor,
          capacity,
          duration: calculateDuration(recStartTime, recEndTime),
          isRecurring: true,
          recurrence: {
            days: selectedDays,
            startTime: recStartTime,
            endTime: recEndTime
          },
          requiresMembership: true,
          allowedActivityIds: [activityId],
          cancellationDeadline,
          allowWaitlist,
          maxWaitlist,
          status: 'active'
        });
      }
      
      onSuccess();
      handleClose();
      
    } catch (error: any) {
      console.error('Error creando clase:', error);
      setError(error.message || 'Error al crear la clase');
    } finally {
      setLoading(false);
    }
  };
  
  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };
  
  const handleClose = () => {
    setError('');
    setTabValue('simple');
    setActivityId('');
    setInstructor('');
    setCapacity(10);
    setDate('');
    setStartTime('16:00');
    setEndTime('17:00');
    setSelectedDays([1, 3, 5]);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Crear Nueva Clase</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              type="button"
              onClick={() => setTabValue('simple')}
              className={`px-4 py-2 font-medium ${
                tabValue === 'simple'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Clase Simple
            </button>
            <button
              type="button"
              onClick={() => setTabValue('recurring')}
              className={`px-4 py-2 font-medium ml-4 ${
                tabValue === 'recurring'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Clase Recurrente
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {/* CAMPOS COMUNES */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actividad *
              </label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar actividad</option>
                {activities.map(activity => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructor *
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre del instructor"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacidad (cupos) *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="100"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Límite de cancelación (minutos antes)
              </label>
              <input
                type="number"
                value={cancellationDeadline}
                onChange={(e) => setCancellationDeadline(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="1440"
              />
              <p className="text-xs text-gray-500 mt-1">
                Los socios pueden cancelar hasta X minutos antes del inicio
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allowWaitlist"
                checked={allowWaitlist}
                onChange={(e) => setAllowWaitlist(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="allowWaitlist" className="ml-2 text-sm text-gray-700">
                Permitir lista de espera
              </label>
            </div>
            
            {allowWaitlist && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo en lista de espera
                </label>
                <input
                  type="number"
                  value={maxWaitlist}
                  onChange={(e) => setMaxWaitlist(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="20"
                />
              </div>
            )}
          </div>
          
          {/* CAMPOS ESPECÍFICOS - CLASE SIMPLE */}
          {tabValue === 'simple' && (
            <div className="space-y-4 mb-6 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora inicio *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora fin *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* CAMPOS ESPECÍFICOS - CLASE RECURRENTE */}
          {tabValue === 'recurring' && (
            <div className="space-y-4 mb-6 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de la semana *
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <label
                      key={day.value}
                      className={`px-4 py-2 border rounded-md cursor-pointer transition-colors ${
                        selectedDays.includes(day.value)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(day.value)}
                        onChange={() => handleDayToggle(day.value)}
                        className="sr-only"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora inicio *
                  </label>
                  <input
                    type="time"
                    value={recStartTime}
                    onChange={(e) => setRecStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora fin *
                  </label>
                  <input
                    type="time"
                    value={recEndTime}
                    onChange={(e) => setRecEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded text-sm">
                ℹ️ Se generarán automáticamente las clases para las próximas 4 semanas
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Creando...' : 'Crear Clase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};