// src/components/superadmin/PaymentsTable.tsx
import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, CreditCard, FileText, ExternalLink } from 'lucide-react';
import { Payment } from '../../types/superadmin.types';
import { formatDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import { toJsDate } from '../../utils/date.utils';

interface PaymentsTableProps {
  payments: Payment[];
}

const PaymentsTable: React.FC<PaymentsTableProps> = ({ payments }) => {
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  
  const toggleExpandPayment = (paymentId: string) => {
    if (expandedPayment === paymentId) {
      setExpandedPayment(null);
    } else {
      setExpandedPayment(paymentId);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Completado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} className="mr-1" />
            Pendiente
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Fallido
          </span>
        );
      default:
        return null;
    }
  };
  
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard size={16} className="text-blue-500 mr-1" />;
      case 'transfer':
        return <FileText size={16} className="text-purple-500 mr-1" />;
      case 'cash':
        return <CreditCard size={16} className="text-green-500 mr-1" />;
      default:
        return <CreditCard size={16} className="text-gray-500 mr-1" />;
    }
  };
  
  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-500">No hay pagos disponibles</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gimnasio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map(payment => (
              <React.Fragment key={payment.id}>
                <tr className={`hover:bg-gray-50 ${expandedPayment === payment.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(payment.date)}</div>
                    <div className="text-xs text-gray-500">
                      
                      {payment.date && toJsDate(payment.date)?.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{payment.gymName}</div>
                    <div className="text-xs text-gray-500">ID: {payment.gymId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      {getPaymentMethodIcon(payment.method)}
                      <span>
                        {payment.method === 'card' && 'Tarjeta'}
                        {payment.method === 'transfer' && 'Transferencia'}
                        {payment.method === 'cash' && 'Efectivo'}
                        {payment.method === 'other' && 'Otro'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{payment.reference || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => toggleExpandPayment(payment.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <ExternalLink size={18} />
                    </button>
                  </td>
                </tr>
                
                {expandedPayment === payment.id && (
                  <tr className="bg-blue-50">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Detalles del Pago</h4>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-gray-700 font-medium">ID de Pago:</span>
                              <span className="ml-2">{payment.id}</span>
                            </p>
                            <p>
                              <span className="text-gray-700 font-medium">ID de Suscripción:</span>
                              <span className="ml-2">{payment.subscriptionId}</span>
                            </p>
                            <p>
                              <span className="text-gray-700 font-medium">Fecha de Creación:</span>
                              <span className="ml-2">{payment.createdAt ? formatDate(payment.createdAt) : '-'}</span>
                            </p>
                            <p>
                              <span className="text-gray-700 font-medium">Fecha de Actualización:</span>
                              <span className="ml-2">{payment.updatedAt ? formatDate(payment.updatedAt) : '-'}</span>
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Notas</h4>
                          <div className="bg-white p-2 rounded border border-gray-200 text-sm min-h-16">
                            {payment.notes || 'Sin notas adicionales'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentsTable;