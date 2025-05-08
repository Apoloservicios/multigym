// src/components/superadmin/PaymentModal.tsx
import React, { useState } from 'react';
import { X, Check, AlertCircle, CreditCard, FileText, Calendar } from 'lucide-react';
import { GymSubscription, subscriptionTypes } from '../../types/superadmin.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { formatDate } from '../../utils/date.utils';
import { registerPayment } from '../../services/superadmin.service';

interface PaymentModalProps {
  subscription: GymSubscription;
  onClose: () => void;
  onPaymentProcessed: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ subscription, onClose, onPaymentProcessed }) => {
  const [paymentMethod, setPaymentMethod] = useState<string>(subscription.paymentMethod || 'transfer');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentMethod) {
      setError('Por favor selecciona un método de pago');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Registrar el pago
      await registerPayment({
        subscriptionId: subscription.id,
        gymId: subscription.gymId,
        gymName: subscription.gymName,
        amount: subscription.price,
        date: new Date(),
        method: paymentMethod as any,
        status: 'completed',
        reference: reference || undefined,
        notes: notes || undefined
      });
      
      onPaymentProcessed();
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Procesar Pago
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <h3 className="text-md font-medium mb-2 text-gray-700">Detalles de la Suscripción</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Gimnasio:</span>
              <span className="font-medium">{subscription.gymName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Plan:</span>
              <span className="font-medium">{subscription.planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Período:</span>
              <span className="font-medium">
                {formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monto:</span>
              <span className="font-medium text-green-600">{formatCurrency(subscription.price)}</span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
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
                {subscriptionTypes.paymentMethods.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Referencia */}
            <div>
              <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
                Referencia / Comprobante
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Número de transferencia, comprobante, etc."
                />
              </div>
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
                placeholder="Información adicional sobre el pago..."
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
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <CreditCard size={18} className="mr-2" />
              )}
              {loading ? 'Procesando...' : 'Procesar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;