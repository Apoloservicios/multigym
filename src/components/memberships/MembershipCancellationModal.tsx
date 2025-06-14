// src/components/memberships/MembershipCancellationModal.tsx
// 🆕 MODAL MEJORADO PARA CANCELACIÓN CON GESTIÓN DE DEUDA Y REINTEGRO

import React, { useState } from 'react';
import { AlertTriangle, DollarSign, CreditCard, XCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { MembershipAssignment } from '../../types/member.types';

interface MembershipCancellationModalProps {
  isOpen: boolean;
  membership: MembershipAssignment;
  memberName: string;
  onConfirm: (debtAction: 'keep' | 'cancel', reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const MembershipCancellationModal: React.FC<MembershipCancellationModalProps> = ({
  isOpen,
  membership,
  memberName,
  onConfirm,
  onCancel,
  loading = false
}) => {
  const [debtAction, setDebtAction] = useState<'keep' | 'cancel'>('keep');
  const [reason, setReason] = useState<string>('');
  const [showReasonInput, setShowReasonInput] = useState<boolean>(false);

  if (!isOpen) return null;

  // Determinar el tipo de situación financiera
  const isPaid = membership.paymentStatus === 'paid';
  const hasPendingDebt = membership.paymentStatus === 'pending' && membership.cost > 0;
  const amount = membership.cost || 0;

  // Generar razón automática si no se especifica
  const getDefaultReason = (): string => {
    if (isPaid && debtAction === 'cancel') {
      return `Cancelación con reintegro de $${amount.toLocaleString('es-AR')}`;
    } else if (hasPendingDebt && debtAction === 'cancel') {
      return `Cancelación con anulación de deuda pendiente de $${amount.toLocaleString('es-AR')}`;
    } else if (hasPendingDebt && debtAction === 'keep') {
      return `Cancelación manteniendo deuda pendiente de $${amount.toLocaleString('es-AR')}`;
    } else {
      return 'Cancelación de membresía';
    }
  };

  const handleConfirm = () => {
    const finalReason = reason.trim() || getDefaultReason();
    console.log('🔍 MODAL CANCELACIÓN: Enviando confirmación:', {
      debtAction,
      reason: finalReason,
      membershipId: membership.id,
      paymentStatus: membership.paymentStatus,
      cost: membership.cost
    });
    
    onConfirm(debtAction, finalReason);
  };

  const getModalIcon = () => {
    if (isPaid) {
      return <DollarSign className="h-8 w-8 text-green-600" />;
    } else if (hasPendingDebt) {
      return <CreditCard className="h-8 w-8 text-red-600" />;
    } else {
      return <AlertTriangle className="h-8 w-8 text-orange-600" />;
    }
  };

  const getModalTitle = () => {
    if (isPaid) {
      return 'Cancelar Membresía Pagada';
    } else if (hasPendingDebt) {
      return 'Cancelar Membresía con Deuda';
    } else {
      return 'Cancelar Membresía';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="rounded-full bg-gray-100 p-2 mr-3">
            {getModalIcon()}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {getModalTitle()}
            </h3>
            <p className="text-sm text-gray-500">
              {memberName} • {membership.activityName}
            </p>
          </div>
        </div>

        {/* Información de la membresía */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Costo:</span>
              <span className="ml-2 font-medium">${amount.toLocaleString('es-AR')}</span>
            </div>
            <div>
              <span className="text-gray-500">Estado:</span>
              <span className={`ml-2 font-medium ${
                isPaid ? 'text-green-600' : 'text-red-600'
              }`}>
                {isPaid ? 'Pagada' : 'Pendiente'}
              </span>
            </div>
          </div>
        </div>

        {/* Opciones según el estado de pago */}
        {isPaid && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              Esta membresía está <strong>pagada</strong>. ¿Desea procesar un reintegro?
            </p>
            
            <div className="space-y-2">
              <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="reintegro"
                  value="cancel"
                  checked={debtAction === 'cancel'}
                  onChange={(e) => setDebtAction('cancel')}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    <span className="font-medium text-green-900">Sí, realizar reintegro</span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    Se descontarán ${amount.toLocaleString('es-AR')} de la caja diaria como reintegro
                  </p>
                </div>
              </label>

              <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="reintegro"
                  value="keep"
                  checked={debtAction === 'keep'}
                  onChange={(e) => setDebtAction('keep')}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <XCircle size={16} className="text-gray-600 mr-2" />
                    <span className="font-medium text-gray-900">No, solo cancelar</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    La membresía se cancelará sin afectar la caja diaria
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {hasPendingDebt && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              Esta membresía tiene una <strong>deuda pendiente</strong> de ${amount.toLocaleString('es-AR')}. ¿Qué desea hacer?
            </p>
            
            <div className="space-y-2">
              <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="deuda"
                  value="cancel"
                  checked={debtAction === 'cancel'}
                  onChange={(e) => setDebtAction('cancel')}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <XCircle size={16} className="text-red-600 mr-2" />
                    <span className="font-medium text-red-900">Anular la deuda</span>
                  </div>
                  <p className="text-xs text-red-700 mt-1">
                    La deuda de ${amount.toLocaleString('es-AR')} se eliminará del total del socio
                  </p>
                </div>
              </label>

              <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="deuda"
                  value="keep"
                  checked={debtAction === 'keep'}
                  onChange={(e) => setDebtAction('keep')}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <AlertCircle size={16} className="text-orange-600 mr-2" />
                    <span className="font-medium text-orange-900">Mantener la deuda</span>
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    La deuda permanecerá en la cuenta del socio para futuros pagos
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {!isPaid && !hasPendingDebt && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="text-blue-600 mr-2" size={16} />
              <span className="text-sm text-blue-800">
                Esta membresía se cancelará sin impacto financiero
              </span>
            </div>
          </div>
        )}

        {/* Campo de razón opcional */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowReasonInput(!showReasonInput)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showReasonInput ? '- Ocultar' : '+ Agregar'} motivo personalizado
          </button>
          
          {showReasonInput && (
            <div className="mt-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo de la cancelación (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Resumen de la acción */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-medium text-yellow-800 mb-1">Resumen de la acción:</h4>
          <p className="text-xs text-yellow-700">
            {getDefaultReason()}
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Procesando...
              </>
            ) : (
              'Confirmar Cancelación'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MembershipCancellationModal;