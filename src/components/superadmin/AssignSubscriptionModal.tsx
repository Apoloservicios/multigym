// src/components/superadmin/AssignSubscriptionModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Calendar, CreditCard } from 'lucide-react';
import { Gym, SubscriptionPlan } from '../../types/superadmin.types';
import { assignSubscription, getSubscriptionPlans } from '../../services/superadmin.service';
import { formatCurrency } from '../../utils/formatting.utils';

interface AssignSubscriptionModalProps {
  gym: Gym;
  onClose: () => void;
  onAssigned: () => void;
}

const AssignSubscriptionModal: React.FC<AssignSubscriptionModalProps> = ({ 
  gym, 
  onClose, 
  onAssigned 
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadPlans();
  }, []);
  
  const loadPlans = async () => {
    try {
      const subscriptionPlans = await getSubscriptionPlans();
      setPlans(subscriptionPlans.filter(plan => plan.isActive));
    } catch (err: any) {
      console.error('Error loading subscription plans:', err);
      setError('Error al cargar los planes de suscripción');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      setError('Por favor selecciona un plan');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await assignSubscription(
        gym.id,
        selectedPlan,
        new Date(startDate),
        paymentMethod,
        notes
      );
      
      onAssigned();
    } catch (err: any) {
      console.error('Error assigning subscription:', err);
      setError(err.message || 'Error al asignar la suscripción');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Asignar Suscripción
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <h3 className="text-md font-medium mb-2 text-gray-700">Datos del Gimnasio</h3>
          <div className="space-y-1">
            <p><span className="font-medium">Nombre:</span> {gym.name}</p>
            <p><span className="font-medium">Propietario:</span> {gym.owner}</p>
            <p><span className="font-medium">Estado actual:</span> {gym.status}</p>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Plan de suscripción */}
            <div>
              <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
                Plan de Suscripción *
              </label>
              <select
                id="plan"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar plan</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - {formatCurrency(plan.price)} - {plan.duration} días
                  </option>
                ))}
              </select>
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            {/* Método de pago */}
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Método de Pago *
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="transfer">Transferencia Bancaria</option>
                <option value="card">Tarjeta de Crédito/Débito</option>
                <option value="cash">Efectivo</option>
                <option value="other">Otro</option>
              </select>
            </div>
            
            {/* Notas */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Información adicional sobre la suscripción..."
              ></textarea>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
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
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Check size={18} className="mr-2" />
              )}
              {loading ? 'Asignando...' : 'Asignar Suscripción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignSubscriptionModal;