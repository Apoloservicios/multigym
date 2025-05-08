// src/components/superadmin/PaymentsList.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, CreditCard, CheckCircle, XCircle, Clock, RefreshCw, FileText } from 'lucide-react';
import { Payment } from '../../types/superadmin.types';
import { formatDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import { getPayments } from '../../services/superadmin.service';

interface PaymentsListProps {
  limit?: number;
  payments?: Payment[];
  onRefresh?: () => void;
}

const PaymentsList: React.FC<PaymentsListProps> = ({ limit = 5, payments: externalPayments, onRefresh }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (externalPayments) {
      // Si se proporcionan pagos externamente, usarlos
      setPayments(externalPayments.slice(0, limit));
      setLoading(false);
    } else {
      // De lo contrario, cargar pagos del último mes
      loadPayments();
    }
  }, [externalPayments, limit]);
  
  const loadPayments = async () => {
    setLoading(true);
    
    try {
      // Obtener pagos del último mes
      const now = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(now.getMonth() - 1);
      
      const paymentsData = await getPayments(lastMonth, now);
      setPayments(paymentsData.slice(0, limit));
    } catch (err: any) {
      console.error('Error loading payments:', err);
      setError('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      loadPayments();
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-red-500 text-center py-4">
        {error}
      </div>
    );
  }
  
  if (payments.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <CreditCard className="h-12 w-12 mx-auto mb-2 text-gray-400" />
        <p>No hay pagos recientes</p>
      </div>
    );
  }
  
  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return null;
    }
  };
  
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard size={16} className="text-blue-500" />;
      case 'transfer':
        return <FileText size={16} className="text-purple-500" />;
      case 'cash':
        return <CreditCard size={16} className="text-green-500" />;
      default:
        return <CreditCard size={16} className="text-gray-500" />;
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Pagos Recientes</h3>
        <button 
          onClick={handleRefresh}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
        >
          <RefreshCw size={14} className="mr-1" />
          Actualizar
        </button>
      </div>
      
      <div className="space-y-3">
        {payments.map(payment => (
          <div key={payment.id} className="border rounded-lg p-3 hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{payment.gymName}</div>
                <div className="text-sm text-gray-600 flex items-center mt-1">
                  <Calendar size={14} className="text-gray-400 mr-1" />
                  {formatDate(payment.date)}
                </div>
                {payment.reference && (
                  <div className="text-xs text-gray-500 mt-1">
                    Ref: {payment.reference}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end mb-1">
                  {getPaymentStatusIcon(payment.status)}
                  <span className="text-sm ml-1 font-medium">
                    {payment.status === 'completed' && 'Completado'}
                    {payment.status === 'pending' && 'Pendiente'}
                    {payment.status === 'failed' && 'Fallido'}
                  </span>
                </div>
                <div className="font-medium text-lg">
                  {formatCurrency(payment.amount)}
                </div>
                <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                  {getPaymentMethodIcon(payment.method)}
                  <span className="ml-1">
                    {payment.method === 'card' && 'Tarjeta'}
                    {payment.method === 'transfer' && 'Transferencia'}
                    {payment.method === 'cash' && 'Efectivo'}
                    {payment.method === 'other' && 'Otro'}
                  </span>
                </div>
              </div>
            </div>
            
            {payment.notes && (
              <div className="mt-2 pt-2 border-t text-sm text-gray-600">
                <p>{payment.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentsList;