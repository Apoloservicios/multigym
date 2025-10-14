// PaymentReceipt.tsx - VERSIÓN FINAL: WhatsApp + Copiar (SIN EMAIL)
// Crear/Reemplazar: src/components/members/PaymentReceipt.tsx

import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatting.utils';
import { formatDisplayDate } from '../../utils/date.utils';
import { Download, Printer, X, MessageCircle, Copy, Check } from 'lucide-react';

interface PaymentReceiptProps {
  memberName: string;
  memberPhone?: string;
  memberDNI?: string;
  memberNumber?: number;
  activityName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  membershipStartDate: string;
  membershipEndDate: string;
  gymName: string;
  transactionId: string;
  onClose: () => void;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  memberName,
  memberPhone,
  memberDNI,
  memberNumber,
  activityName,
  amount,
  paymentDate,
  paymentMethod,
  membershipStartDate,
  membershipEndDate,
  gymName,
  transactionId,
  onClose
}) => {
  
  const [copied, setCopied] = useState(false);
  
  const handlePrint = () => {
    window.print();
  };
  

  
  // 📋 Función para copiar al portapapeles
  const handleCopyToClipboard = () => {
    const text = `
COMPROBANTE DE PAGO
${gymName}

N° Comprobante: ${transactionId.slice(0, 12).toUpperCase()}
Fecha: ${formatDisplayDate(paymentDate)}

DATOS DEL SOCIO
Nombre: ${memberName}
${memberNumber ? `N° Socio: #${memberNumber}` : ''}
${memberDNI ? `DNI: ${memberDNI}` : ''}

DETALLE DEL PAGO
Actividad: ${activityName}
Periodo: ${formatDisplayDate(membershipStartDate)} - ${formatDisplayDate(membershipEndDate)}
Método de Pago: ${
  paymentMethod === 'cash' ? 'Efectivo' :
  paymentMethod === 'card' ? 'Tarjeta' :
  paymentMethod === 'transfer' ? 'Transferencia' : paymentMethod
}

TOTAL ABONADO: $${amount.toLocaleString('es-AR')}

Este comprobante es válido como constancia de pago.
    `.trim();
    
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        alert('Error al copiar. Intenta nuevamente.');
      });
  };
  
  // 📱 Función para enviar por WhatsApp
  const handleSendWhatsApp = () => {
    if (!memberPhone) {
      alert('El socio no tiene teléfono registrado');
      return;
    }
    
    // Limpiar el teléfono (quitar espacios, guiones, etc.)
    let cleanPhone = memberPhone.replace(/\D/g, '');
    
    // Si no tiene código de país, agregar 54 (Argentina)
    if (!cleanPhone.startsWith('54')) {
      cleanPhone = '54' + cleanPhone;
    }
    
    // Crear el mensaje del comprobante
    const message = `
🧾 *COMPROBANTE DE PAGO*
${gymName}

📝 *N° Comprobante:* ${transactionId.slice(0, 12).toUpperCase()}
📅 *Fecha:* ${formatDisplayDate(paymentDate)}

👤 *DATOS DEL SOCIO*
Nombre: ${memberName}
${memberNumber ? `N° Socio: #${memberNumber}` : ''}
${memberDNI ? `DNI: ${memberDNI}` : ''}

🏋️ *DETALLE DEL PAGO*
Actividad: ${activityName}
Periodo: ${formatDisplayDate(membershipStartDate)} - ${formatDisplayDate(membershipEndDate)}
Método: ${
  paymentMethod === 'cash' ? '💵 Efectivo' :
  paymentMethod === 'card' ? '💳 Tarjeta' :
  paymentMethod === 'transfer' ? '🏦 Transferencia' : paymentMethod
}

💰 *TOTAL ABONADO: $${amount.toLocaleString('es-AR')}*

✅ Este comprobante es válido como constancia de pago.

Gracias por tu pago! 🙌
    `.trim();
    
    // Crear link de WhatsApp
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank');
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header con botones */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
          <h2 className="text-xl font-bold text-gray-900">Comprobante de Pago</h2>
          <div className="flex items-center space-x-2">
            {/* Botón WhatsApp */}
            <button
              onClick={handleSendWhatsApp}
              disabled={!memberPhone}
              className={`p-2 rounded-lg ${
                !memberPhone
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={!memberPhone ? 'El socio no tiene teléfono' : 'Enviar por WhatsApp'}
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            
            {/* Botón Copiar */}
            <button
              onClick={handleCopyToClipboard}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Copiar al portapapeles"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
            
            {/* Botón Imprimir */}
            <button
              onClick={handlePrint}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Imprimir"
            >
              <Printer className="h-5 w-5" />
            </button>
            
           
            
            {/* Botón Cerrar */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Contenido del comprobante */}
        <div className="p-8" id="receipt-content">
          {/* Logo y nombre del gimnasio */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{gymName}</h1>
            <p className="text-sm text-gray-600">Comprobante de Pago</p>
          </div>
          
          {/* Información del comprobante */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">N° Comprobante:</p>
                <p className="font-semibold text-gray-900">{transactionId.slice(0, 12).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600">Fecha de Emisión:</p>
                <p className="font-semibold text-gray-900">{formatDisplayDate(paymentDate)}</p>
              </div>
            </div>
          </div>
          
          {/* Información del socio */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">Datos del Socio</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-semibold text-gray-900">{memberName}</span>
              </div>
              {memberNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">N° Socio:</span>
                  <span className="font-semibold text-gray-900">#{memberNumber}</span>
                </div>
              )}
              {memberDNI && (
                <div className="flex justify-between">
                  <span className="text-gray-600">DNI:</span>
                  <span className="font-semibold text-gray-900">{memberDNI}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Detalles de la membresía */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">Detalle del Pago</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Actividad:</span>
                <span className="font-semibold text-gray-900">{activityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha de Inicio:</span>
                <span className="font-semibold text-gray-900">{formatDisplayDate(membershipStartDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha de Fin:</span>
                <span className="font-semibold text-gray-900">{formatDisplayDate(membershipEndDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método de Pago:</span>
                <span className="font-semibold text-gray-900">
                  {paymentMethod === 'cash' && 'Efectivo'}
                  {paymentMethod === 'card' && 'Tarjeta'}
                  {paymentMethod === 'transfer' && 'Transferencia'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">TOTAL ABONADO:</span>
              <span className="text-3xl font-bold text-green-600">{formatCurrency(amount)}</span>
            </div>
          </div>
          
          {/* Nota al pie */}
          <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200">
            <p>Este comprobante es válido como constancia de pago.</p>
            <p className="mt-1">Conserve este documento para futuras consultas.</p>
          </div>
        </div>
        
        {/* Footer con botón cerrar */}
        <div className="p-4 border-t border-gray-200 print:hidden">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
      
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content, #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PaymentReceipt;