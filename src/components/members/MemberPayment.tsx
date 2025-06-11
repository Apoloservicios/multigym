// src/components/members/MemberPayment.tsx

import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, CreditCard, Check, X, AlertCircle, Receipt } from 'lucide-react';
import { Member } from '../../types/member.types';
import { MembershipAssignment } from '../../types/member.types';
import { Transaction } from '../../types/gym.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { registerMembershipPayment } from '../../services/payment.service';
import useAuth from '../../hooks/useAuth';
import { getPendingMemberships } from '../../services/payment.service';
import { getCurrentDateString } from '../../utils/date.utils';


interface MemberPaymentProps {
  member: Member;
  onSuccess: () => void;
  onCancel: () => void;
}

const MemberPayment: React.FC<MemberPaymentProps> = ({ member, onSuccess, onCancel }) => {
  const { gymData, userData } = useAuth();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMemberships, setLoadingMemberships] = useState<boolean>(true);
  const [pendingMemberships, setPendingMemberships] = useState<MembershipAssignment[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  
  // Estado para el formulario de pago
  const [formData, setFormData] = useState({
    membershipIds: [] as string[],
    paymentMethod: 'cash',
    paymentDate: getCurrentDateString(),
    notes: '',
    amount: 0
  });
  
  // Cargar membresías pendientes de pago
  useEffect(() => {
    const fetchPendingMemberships = async () => {
      if (!gymData?.id || !member.id) {
        setLoadingMemberships(false);
        return;
      }
      
      setLoadingMemberships(true);
      
      try {
        // Usar el servicio real para obtener las membresías pendientes
        const pendingMemberships = await getPendingMemberships(gymData.id, member.id);
        setPendingMemberships(pendingMemberships);
        
        // Calcular el monto total
        const totalAmount = pendingMemberships.reduce((sum: number, m: MembershipAssignment) => sum + m.cost, 0);
        setFormData(prev => ({
          ...prev,
          amount: totalAmount,
          // Por defecto, seleccionar todas las membresías pendientes
          membershipIds: pendingMemberships.map((m: MembershipAssignment) => m.id || '')
        }));
      } catch (error) {
        console.error('Error loading pending memberships:', error);
        setError('Error al cargar membresías pendientes');
      } finally {
        setLoadingMemberships(false);
      }
    };
    
    fetchPendingMemberships();
  }, [gymData?.id, member.id]);
  
  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Limpiar mensajes
    setError('');
  };
  
  // Manejar cambios en el checkbox de membresía
  const handleMembershipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked, value } = e.target;
    let updatedMembershipIds = [...formData.membershipIds];
    
    if (checked) {
      // Agregar a la lista de seleccionados
      updatedMembershipIds.push(value);
    } else {
      // Quitar de la lista de seleccionados
      updatedMembershipIds = updatedMembershipIds.filter(id => id !== value);
    }
    
    // Encontrar las membresías seleccionadas y calcular el nuevo monto
    const selectedMemberships = pendingMemberships.filter(m => 
      updatedMembershipIds.includes(m.id || '')
    );
    const newAmount = selectedMemberships.reduce((sum, m) => sum + m.cost, 0);
    
    setFormData({
      ...formData,
      membershipIds: updatedMembershipIds,
      amount: newAmount
    });
  };
  
  // Validar el formulario
  const validateForm = (): boolean => {
    if (formData.membershipIds.length === 0) {
      setError('Debe seleccionar al menos una membresía para pagar');
      return false;
    }
    
    if (!formData.paymentDate) {
      setError('La fecha de pago es requerida');
      return false;
    }
    
    if (formData.amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return false;
    }
    
    return true;
  };
  
  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !gymData?.id || !userData) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Registrar el pago
      const result = await registerMembershipPayment({
        gymId: gymData.id,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        membershipIds: formData.membershipIds,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        paymentDate: formData.paymentDate,
        notes: formData.notes,
        userId: userData.id,
        userName: userData.name
      });
      
      if (result.success) {
        setSuccess(true);
        
        // Esperar un momento antes de cerrar
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        throw new Error(result.error || 'Error al procesar el pago');
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setError(error.message || 'Error al procesar el pago. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Si no hay membresías pendientes
  if (!loadingMemberships && pendingMemberships.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">El socio no tiene pagos pendientes</h3>
          <p className="text-gray-500 mb-4">Todas las membresías están al día</p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Registrar Pago</h2>
      <p className="text-gray-600 mb-6">Socio: {member.firstName} {member.lastName}</p>
      
      {loadingMemberships ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500">Cargando membresías pendientes...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
              <AlertCircle size={18} className="mr-2" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
              <Check size={18} className="mr-2" />
              Pago registrado correctamente
            </div>
          )}
          
          <div className="space-y-6">
            {/* Membresías pendientes */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Membresías pendientes de pago</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto p-2">
                {pendingMemberships.map(membership => (
                  <div 
                    key={membership.id} 
                    className="flex items-start p-3 border rounded-md bg-gray-50 hover:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      id={`membership-${membership.id}`}
                      name="membershipIds"
                      value={membership.id}
                      checked={formData.membershipIds.includes(membership.id || '')}
                      onChange={handleMembershipChange}
                      className="h-5 w-5 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={loading || success}
                    />
                    <label 
                      htmlFor={`membership-${membership.id}`}
                      className="ml-3 flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{membership.activityName}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {membership.startDate} - {membership.endDate}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                          Pendiente de pago
                        </span>
                        <span className="text-lg font-bold text-gray-800">
                          {formatCurrency(membership.cost)}
                        </span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Deuda total */}
            <div className="p-4 bg-blue-50 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Monto total a pagar:</span>
                <span className="text-2xl font-bold text-blue-700">{formatCurrency(formData.amount)}</span>
              </div>
            </div>
            
            {/* Método de pago */}
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Método de pago
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard size={18} className="text-gray-400" />
                </div>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || success}
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta de débito/crédito</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            
            {/* Fecha de pago */}
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de pago
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  id="paymentDate"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || success}
                />
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
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Agregar información adicional..."
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
              disabled={loading || success || formData.membershipIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <Receipt size={18} className="mr-2" />
              )}
              {loading ? 'Procesando...' : success ? 'Pago registrado' : 'Registrar pago'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MemberPayment;