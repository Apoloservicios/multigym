// src/components/members/MemberPayment.tsx - CORRECCIÓN PARA REFRESH

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


import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  runTransaction,
  orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  
  // 🔧 NUEVA FUNCIÓN: Recargar membresías pendientes
  const reloadPendingMemberships = async () => {
    if (!gymData?.id || !member.id) return;
    
    setLoadingMemberships(true);
    try {
      const updatedPendingMemberships = await getPendingMemberships(gymData.id, member.id);
      setPendingMemberships(updatedPendingMemberships);
      
      console.log('🔄 Membresías recargadas:', {
        count: updatedPendingMemberships.length,
        memberships: updatedPendingMemberships.map(m => ({
          id: m.id,
          activityName: m.activityName,
          paymentStatus: m.paymentStatus,
          cost: m.cost
        }))
      });
      
    } catch (err) {
      console.error('Error recargando membresías:', err);
    } finally {
      setLoadingMemberships(false);
    }
  };
  
  // Cargar membresías pendientes de pago
  useEffect(() => {
    reloadPendingMemberships();
  }, [gymData?.id, member.id]);
  
  // Manejar cambio de selección de membresías
  const handleMembershipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const membershipId = e.target.value;
    const isChecked = e.target.checked;
    
    let newMembershipIds: string[];
    if (isChecked) {
      newMembershipIds = [...formData.membershipIds, membershipId];
    } else {
      newMembershipIds = formData.membershipIds.filter(id => id !== membershipId);
    }
    
    // Calcular el nuevo total
    const selectedMemberships = pendingMemberships.filter(m => 
      newMembershipIds.includes(m.id || '')
    );
    const newAmount = selectedMemberships.reduce((sum, m) => sum + m.cost, 0);
    
    setFormData({
      ...formData,
      membershipIds: newMembershipIds,
      amount: newAmount
    });
  };
  
  // Manejar cambios en otros campos del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Enviar el formulario de pago
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id || !userData?.id) {
      setError('Datos de usuario incompletos');
      return;
    }
    
    if (formData.membershipIds.length === 0) {
      setError('Debe seleccionar al menos una membresía');
      return;
    }
    
    if (formData.amount <= 0) {
      setError('El monto debe ser mayor a cero');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      console.log('🔍 Fecha enviada desde MemberPayment:', formData.paymentDate);
      
      const paymentData = {
        gymId: gymData.id,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        membershipIds: formData.membershipIds,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod as 'cash' | 'card' | 'transfer' | 'other',
        paymentDate: formData.paymentDate,
        notes: formData.notes,
        userId: userData.id,
        userName: userData.name || userData.email || 'Usuario'
      };
      
      // Realizar el pago
      const result = await registerMembershipPayment(paymentData);
      
      if (result.success) {

        // Actualizar los pagos mensuales correspondientes
          const paymentsRef = collection(db, `gyms/${gymData.id}/monthlyPayments`);
          const q = query(
            paymentsRef,
            where('memberId', '==', member.id),
            where('status', '==', 'pending')
          );
          
          const paymentsSnap = await getDocs(q);
          
          for (const paymentDoc of paymentsSnap.docs) {
            const payment = paymentDoc.data();
            
            // Si pagaste una membresía que tiene un pago mensual pendiente
            if (formData.membershipIds.includes(payment.membershipId)) {
              await updateDoc(doc(db, `gyms/${gymData.id}/monthlyPayments`, paymentDoc.id), {
                status: 'paid',
                paidAt: Timestamp.now(),
                paidDate: formData.paymentDate,
                transactionId: result.transactionId
              });
            }
          }
        
        setSuccess(true);
        
        // 🔧 CORRECCIÓN CLAVE: Esperar un momento y luego recargar
        setTimeout(async () => {
          await reloadPendingMemberships();
          
          // Si ya no hay membresías pendientes, mostrar mensaje de éxito
          const updatedPending = await getPendingMemberships(gymData.id, member.id);
          if (updatedPending.length === 0) {
            setTimeout(() => {
              onSuccess(); // Cerrar modal y refrescar vista principal
            }, 1000);
          } else {
            // Resetear formulario para siguiente pago
            setFormData({
              membershipIds: [],
              paymentMethod: 'cash',
              paymentDate: getCurrentDateString(),
              notes: '',
              amount: 0
            });
          }
        }, 1500);
        
      } else {
        setError(result.error || 'Error al registrar el pago');
      }
      
    } catch (err: any) {
      console.error('Error in payment:', err);
      setError(err.message || 'Error al procesar el pago. Intente nuevamente.');
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
              Pago registrado correctamente. Actualizando vista...
            </div>
          )}
          
          <div className="space-y-6">
            {/* Membresías pendientes */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Membresías pendientes de pago ({pendingMemberships.length})
              </h3>
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
                      className="h-5 w-5 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      disabled={loading || success}
                    />
                    <label 
                      htmlFor={`membership-${membership.id}`}
                      className="ml-3 flex-1 cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{membership.activityName}</p>
                          <p className="text-sm text-gray-500">
                            {membership.startDate} - {membership.endDate}
                          </p>
                          {membership.description && (
                            <p className="text-xs text-gray-400 mt-1">{membership.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            ${membership.cost.toLocaleString('es-AR')}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Pendiente
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Monto total */}
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Total a pagar:</span>
                <span className="text-lg font-bold text-blue-900">
                  ${formData.amount.toLocaleString('es-AR')}
                </span>
              </div>
              {formData.membershipIds.length > 0 && (
                <p className="text-xs text-blue-700 mt-1">
                  {formData.membershipIds.length} membresía(s) seleccionada(s)
                </p>
              )}
            </div>
            
            {/* Método de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || success}
              >
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
                <option value="other">Otro</option>
              </select>
            </div>
            
            {/* Fecha de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Pago
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || success}
              />
            </div>
            
            {/* Notas opcionales */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observaciones del pago..."
                disabled={loading || success}
              />
            </div>
            
            {/* Botones */}
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading || success || formData.membershipIds.length === 0}
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-white font-medium ${
                  loading || success || formData.membershipIds.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign size={18} className="mr-2" />
                    Registrar Pago
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default MemberPayment;