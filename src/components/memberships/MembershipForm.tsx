import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Clock, Check, X, AlertCircle } from 'lucide-react';
import { Activity } from '../../types/membership.types';
import { getMemberships } from '../../services/membership.service';
import { assignMembership } from '../../services/member.service';
import useAuth from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatting.utils';
import { calculateEndDate, getCurrentDateString, htmlDateToLocalDate } from '../../utils/date.utils';

interface FormData {
  membershipId: string;
  startDate: string;
  cost: number | string;
  paymentStatus: 'paid' | 'pending';
  notes: string;
  autoRenewal: boolean; // Nuevo campo
  paymentFrequency: 'single' | 'monthly'; // Nuevo campo
}

interface FormErrors {
  membershipId?: string;
  startDate?: string;
  cost?: string;
  form?: string;
}

interface Membership {
  id: string;
  activityId: string;
  activityName: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  maxAttendances: number;
  isActive: boolean;
}

interface MembershipFormProps {
  memberId: string;
  memberName: string;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const MembershipForm: React.FC<MembershipFormProps> = ({ memberId, memberName, onSave, onCancel }) => {
  const { gymData } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    membershipId: '',
    startDate: '',
    cost: '',
    paymentStatus: 'pending',
    notes: '',
    autoRenewal: false,
    paymentFrequency: 'single'
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMemberships, setLoadingMemberships] = useState<boolean>(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<boolean>(false);
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null);
  
  // Cargar membresías disponibles
  useEffect(() => {
    const fetchMemberships = async () => {
      if (!gymData?.id) {
        setLoadingMemberships(false);
        return;
      }
      
      setLoadingMemberships(true);
      
      try {
        // Obtener todas las membresías
        const allMemberships = await getMemberships(gymData.id);
        
        // Filtrar solo las membresías activas
        const activeMemberships = allMemberships.filter(m => m.isActive !== false);
        
        setMemberships(activeMemberships);
      } catch (error) {
        console.error('Error loading memberships:', error);
      } finally {
        setLoadingMemberships(false);
      }
    };
    
    fetchMemberships();
    
    // Establecer fecha de inicio al día actual por defecto
   const today = getCurrentDateString();
    setFormData({
      ...formData,
      startDate: today
    });
  }, [gymData?.id]);
  
  // Actualizar costo y seleccionar la membresía cuando se selecciona
  useEffect(() => {
    if (formData.membershipId) {
      const selected = memberships.find(m => m.id === formData.membershipId);
      if (selected) {
        setSelectedMembership(selected);
        setFormData({
          ...formData,
          cost: selected.cost
        });
      }
    } else {
      setSelectedMembership(null);
    }
  }, [formData.membershipId, memberships]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Convertir a número cuando sea apropiado
    const parsedValue = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
    
    setFormData({
      ...formData,
      [name]: parsedValue
    });
    
    // Limpiar error del campo cuando se edita
    if (errors[name as keyof FormErrors]) {
      setErrors({
        ...errors,
        [name]: undefined
      });
    }
  };
  
  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!formData.membershipId) {
      newErrors.membershipId = 'Debe seleccionar una membresía';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'La fecha de inicio es requerida';
    }
    
    if (!formData.cost || Number(formData.cost) < 0) {
      newErrors.cost = 'El costo debe ser un valor válido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
const getEndDateString = (): string => {
  if (!selectedMembership || !formData.startDate) return 'No disponible';
  
  const startDate = htmlDateToLocalDate(formData.startDate);
  const endDate = calculateEndDate(startDate, selectedMembership.duration);
  
  return endDate.toLocaleDateString('es-AR');
};
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !gymData?.id) {
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      if (!selectedMembership) {
        throw new Error('No se ha seleccionado una membresía válida');
      }
      
      // Preparar datos de la membresía para asignar al socio
      const membershipData = {
        memberId,
        activityId: selectedMembership.activityId,
        activityName: selectedMembership.activityName,
        startDate: formData.startDate,
        endDate: calculateEndDate(
          htmlDateToLocalDate(formData.startDate), 
          selectedMembership.duration
        ).toISOString().split('T')[0],
        cost: Number(formData.cost),
        paymentStatus: formData.paymentStatus as 'paid' | 'pending',
        status: 'active' as 'active' | 'expired' | 'cancelled',
        maxAttendances: selectedMembership.maxAttendances,
        currentAttendances: 0,
        description: formData.notes || selectedMembership.description
      };
      
      // Asignar membresía al socio
      const result = await assignMembership(gymData.id, memberId, membershipData);
      
      if (result) {
        setSuccess(true);
        
        // Esperar un momento antes de cerrar
        setTimeout(() => {
          if (onSave) {
            onSave(membershipData);
          }
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error assigning membership:', error);
      setErrors({
        form: error.message || 'Error al asignar membresía. Intente nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Asignar Membresía</h2>
      <p className="text-gray-600 mb-6">Socio: {memberName}</p>
      
      {loadingMemberships ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500">Cargando membresías disponibles...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {errors.form && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
              <AlertCircle size={18} className="mr-2" />
              {errors.form}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
              <Check size={18} className="mr-2" />
              Membresía asignada correctamente
            </div>
          )}
          
          <div className="space-y-4">
            {/* Membresía */}
            <div>
              <label htmlFor="membershipId" className="block text-sm font-medium text-gray-700 mb-1">
                Membresía *
              </label>
              <select
                id="membershipId"
                name="membershipId"
                value={formData.membershipId}
                onChange={handleChange}
                className={`w-full px-4 py-2 border ${errors.membershipId ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                disabled={loading || success}
              >
                <option value="">Seleccionar membresía</option>
                {memberships.map(membership => (
                  <option key={membership.id} value={membership.id}>
                    {membership.name} - {membership.activityName} - {formatCurrency(membership.cost)}
                  </option>
                ))}
              </select>
              {errors.membershipId && (
                <p className="mt-1 text-sm text-red-600">{errors.membershipId}</p>
              )}
              
              {selectedMembership && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm">
                  <p className="font-medium">{selectedMembership.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-gray-600">
                    <span className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      Duración: {selectedMembership.duration} días
                    </span>
                    <span className="flex items-center">
                      <Clock size={14} className="mr-1" />
                      Asistencias: {selectedMembership.maxAttendances}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Fecha de inicio */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Inicio *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`pl-10 w-full px-4 py-2 border ${errors.startDate ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  disabled={loading || success}
                />
              </div>
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
              
              {selectedMembership && formData.startDate && (
                <p className="mt-1 text-sm text-gray-500">
                  Fecha de finalización: {getEndDateString()}
                </p>
              )}
            </div>
            
            {/* Costo */}
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                Costo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign size={18} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  id="cost"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  className={`pl-10 w-full px-4 py-2 border ${errors.cost ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="0.00"
                  min="0"
                  disabled={loading || success}
                />
              </div>
              {errors.cost && (
                <p className="mt-1 text-sm text-red-600">{errors.cost}</p>
              )}
            </div>
            
            {/* Estado de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado de Pago
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="paid"
                    checked={formData.paymentStatus === 'paid'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={loading || success}
                  />
                  <span className="ml-2 text-sm text-gray-700">Pagada</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="pending"
                    checked={formData.paymentStatus === 'pending'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={loading || success}
                  />
                  <span className="ml-2 text-sm text-gray-700">Pendiente</span>
                </label>
              </div>
            </div>



            <div>
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="autoRenewal"
                  name="autoRenewal"
                  checked={formData.autoRenewal}
                  onChange={(e) => setFormData({...formData, autoRenewal: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoRenewal" className="ml-2 block text-sm text-gray-700">
                  Renovación automática
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-6">
                La membresía se renovará automáticamente al vencimiento
              </p>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecuencia de pago
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentFrequency"
                    value="single"
                    checked={formData.paymentFrequency === 'single'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Pago único</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentFrequency"
                    value="monthly"
                    checked={formData.paymentFrequency === 'monthly'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Pago mensual</span>
                </label>
              </div>
            </div>
            
            {/* Notas */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Agregar notas o comentarios sobre esta membresía"
                disabled={loading || success}
              />
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="mt-8 flex justify-end space-x-3">
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
              disabled={loading || success}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Check size={18} className="mr-2" />
              )}
              {loading ? 'Guardando...' : success ? 'Asignado' : 'Asignar Membresía'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MembershipForm;