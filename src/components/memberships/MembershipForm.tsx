// src/components/memberships/MembershipForm.tsx
// VERSIÓN CORREGIDA - Valores por defecto ajustados

import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Calendar, DollarSign, Users } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { getMemberships, assignMembership } from '../../services/membershipService';
import { getCurrentDateString, htmlDateToLocalDate, calculateEndDate } from '../../utils/date.utils';

interface FormData {
  membershipId: string;
  startDate: string;
  cost: string | number;
  paymentStatus: 'paid' | 'pending';
  notes: string;
  autoRenewal: boolean;
  paymentFrequency: 'monthly' | 'single'; // Cambiado para siempre ser monthly
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
  
  // 🔧 CORREGIDO: Valores por defecto actualizados
  const [formData, setFormData] = useState<FormData>({
    membershipId: '',
    startDate: '',
    cost: '',
    paymentStatus: 'pending', // Por defecto PENDIENTE
    notes: '',
    autoRenewal: true, // Por defecto ACTIVADA
    paymentFrequency: 'monthly' // Por defecto MENSUAL
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
        const allMemberships = await getMemberships(gymData.id);
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
    setFormData(prev => ({
      ...prev,
      startDate: today
    }));
  }, [gymData?.id]);
  
  // Actualizar costo cuando se selecciona una membresía
  useEffect(() => {
    if (formData.membershipId) {
      const selected = memberships.find(m => m.id === formData.membershipId);
      if (selected) {
        setSelectedMembership(selected);
        setFormData(prev => ({
          ...prev,
          cost: selected.cost
        }));
      }
    } else {
      setSelectedMembership(null);
    }
  }, [formData.membershipId, memberships]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: any = value;
    
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      parsedValue = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));
    
    // Limpiar error del campo cuando se edita
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
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
      
      const membershipData = {
        memberId,
        activityId: selectedMembership.activityId,
        activityName: selectedMembership.activityName,
        membershipName: selectedMembership.name, // Agregar nombre de la membresía
        startDate: formData.startDate,
        endDate: calculateEndDate(
          htmlDateToLocalDate(formData.startDate), 
          selectedMembership.duration
        ).toISOString().split('T')[0],
        cost: Number(formData.cost),
        paymentStatus: formData.paymentStatus,
        status: 'active' as const,
        active: true, // 🔧 AGREGAR ESTE CAMPO
        maxAttendances: selectedMembership.maxAttendances,
        currentAttendances: 0,
        description: formData.notes || selectedMembership.description,
        autoRenewal: formData.autoRenewal,
        paymentFrequency: formData.paymentFrequency,
        paymentType: 'monthly',
        membershipId: formData.membershipId // ID de la definición de membresía
      };
      
      console.log('📊 Datos de membresía a guardar:', membershipData);
      
      const result = await assignMembership(gymData.id, memberId, membershipData);
      
      if (result) {
        setSuccess(true);
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
                className={`w-full px-4 py-2 border ${
                  errors.membershipId ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                required
              >
                <option value="">Seleccione una membresía</option>
                {memberships.map(membership => (
                  <option key={membership.id} value={membership.id}>
                    {membership.activityName} - {membership.name} - ${membership.cost}
                  </option>
                ))}
              </select>
              {errors.membershipId && (
                <p className="mt-1 text-sm text-red-600">{errors.membershipId}</p>
              )}
            </div>
            
            {/* Información de la membresía seleccionada */}
            {selectedMembership && (
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Detalles de la membresía</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Duración:</span>{' '}
                    <span className="font-medium">{selectedMembership.duration} días</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Asistencias:</span>{' '}
                    <span className="font-medium">{selectedMembership.maxAttendances}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha de fin:</span>{' '}
                    <span className="font-medium">{getEndDateString()}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Fecha de inicio y Costo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de inicio *
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
                    className={`pl-10 w-full px-4 py-2 border ${
                      errors.startDate ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>
              
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
                    className={`pl-10 w-full px-4 py-2 border ${
                      errors.cost ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                {errors.cost && (
                  <p className="mt-1 text-sm text-red-600">{errors.cost}</p>
                )}
              </div>
            </div>
            
            {/* 🔧 SECCIÓN CORREGIDA - Estado de Pago y Auto-renovación */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium text-gray-700">Configuración de pago</h4>
              
              {/* Estado de pago - Por defecto PENDIENTE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado de pago inicial
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="pending"
                      checked={formData.paymentStatus === 'pending'}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    <span className="text-sm">Pendiente</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="paid"
                      checked={formData.paymentStatus === 'paid'}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    <span className="text-sm">Pagado</span>
                  </label>
                </div>
              </div>
              
              {/* Auto-renovación - Por defecto ACTIVADA */}
              <div className="flex items-center justify-between">
                <label htmlFor="autoRenewal" className="text-sm font-medium text-gray-700">
                  Auto-renovación mensual
                </label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoRenewal"
                    name="autoRenewal"
                    checked={formData.autoRenewal}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className={`text-sm ${formData.autoRenewal ? 'text-green-600' : 'text-gray-500'}`}>
                    {formData.autoRenewal ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
              </div>
              
              {/* Información sobre pago mensual */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-700">
                <p className="font-medium mb-1">ℹ️ Información importante:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Todas las membresías se cobran mensualmente</li>
                  <li>Con auto-renovación activada, se renovará automáticamente cada mes</li>
                  <li>El socio puede pagar en cualquier momento del mes</li>
                </ul>
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
              />
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Asignando...
                </>
              ) : (
                'Asignar Membresía'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MembershipForm;