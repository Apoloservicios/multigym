// src/components/payments/PaymentReceipt.tsx - COMPROBANTE DE PAGO

import React from 'react';
import { Receipt, Download, Share, Printer } from 'lucide-react';
import { Transaction } from '../../types/gym.types';
import { MembershipAssignment } from '../../types/member.types';
import { formatDisplayDate, formatDisplayDateTime } from '../../utils/date.utils';
import useAuth from '../../hooks/useAuth';

interface PaymentReceiptProps {
  transaction: Transaction;
  memberName: string;
  memberships?: MembershipAssignment[];
  onClose: () => void;
  onDownloadPDF: () => void;
  onShareWhatsApp: () => void;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  transaction,
  memberName,
  memberships = [],
  onClose,
  onDownloadPDF,
  onShareWhatsApp
}) => {
  const { gymData } = useAuth();

  // Formatear método de pago
  const formatPaymentMethod = (method: string): string => {
    switch (method?.toLowerCase()) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia Bancaria';
      case 'card': return 'Tarjeta de Débito/Crédito';
      default: return method || 'No especificado';
    }
  };

  // Calcular total de ítems
  const calculateItemsTotal = (): number => {
    return memberships.reduce((total, membership) => total + (membership.cost || 0), 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Receipt className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Comprobante de Pago</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div id="receipt-content" className="p-6">
          {/* Gym Info */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-bold text-gray-900">{gymData?.name || 'MultiGym'}</h1>
            <p className="text-sm text-gray-600">Sistema de Gestión de Gimnasios</p>
          </div>

          {/* Transaction Info */}
          <div className="mb-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                <Receipt className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Pago Registrado</h3>
              <p className="text-sm text-gray-600">Transacción #{transaction.id?.slice(-8) || 'N/A'}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Fecha:</span>
              <span className="text-sm font-medium">{formatDisplayDateTime(transaction.date)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Socio:</span>
              <span className="text-sm font-medium">{memberName}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Método de Pago:</span>
              <span className="text-sm font-medium">{formatPaymentMethod(transaction.paymentMethod || '')}</span>
            </div>
          </div>

          {/* Items Detail */}
          {memberships.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Detalle de Servicios:</h4>
              <div className="space-y-2">
                {memberships.map((membership, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{membership.activityName}</span>
                    <span className="font-medium">${membership.cost?.toLocaleString('es-AR') || '0'}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 mt-3 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${calculateItemsTotal().toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Total Amount */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Pagado:</span>
              <span className="text-2xl font-bold text-green-600">
                ${transaction.amount.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              Pago Completado
            </div>
          </div>

          {/* Additional Info */}
          {transaction.notes && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Observaciones:</h4>
              <p className="text-sm text-gray-600">{transaction.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-500">
            <p>Este comprobante es válido como constancia de pago</p>
            <p>Generado automáticamente por MultiGym</p>
            <p className="mt-2">{formatDisplayDateTime(new Date())}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={onDownloadPDF}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center text-sm font-medium"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </button>
            
            <button
              onClick={onShareWhatsApp}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center text-sm font-medium"
            >
              <Share className="w-4 h-4 mr-2" />
              Enviar WhatsApp
            </button>
            
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;