// src/components/payments/PendingPaymentsList.tsx
// 📋 LISTA DETALLADA DE SOCIOS CON PAGOS PENDIENTES

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  DollarSign, 
  User, 
  Calendar, 
  AlertCircle,
  Eye,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { MonthlyPaymentsService } from '../../services/monthlyPayments.service';
import { MonthlyPaymentListItem } from '../../types/monthlyPayments.types';
import useAuth from '../../hooks/useAuth';

interface PendingPaymentsListProps {
  year: number;
  month: number;
  onPaymentRegistered?: () => void;
}

const PendingPaymentsList: React.FC<PendingPaymentsListProps> = ({ 
  year, 
  month, 
  onPaymentRegistered 
}) => {
  const { gymData } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MonthlyPaymentListItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cargar datos al inicializar
  useEffect(() => {
    if (gymData?.id) {
      loadPendingPayments();
    }
  }, [gymData?.id, year, month]);

  /**
   * 📋 Cargar lista de pagos pendientes
   */
  const loadPendingPayments = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const payments = await MonthlyPaymentsService.getPendingPaymentsList(gymData.id, year, month);
      setPendingPayments(payments);
      console.log('📋 Pagos pendientes cargados:', payments.length);
    } catch (err: any) {
      console.error('❌ Error cargando pagos pendientes:', err);
      setError('Error al cargar los pagos pendientes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 💰 Registrar pago de una actividad específica
   */
  const registerSingleActivityPayment = async (
    memberId: string, 
    activityId: string, 
    amount: number,
    paymentMethod: 'cash' | 'transfer' | 'card'
  ) => {
    if (!gymData?.id) return;

    try {
      setRegistering(memberId);
      
      await MonthlyPaymentsService.registerActivityPayment(
        gymData.id, 
        year, 
        month, 
        memberId, 
        activityId, 
        amount, 
        paymentMethod
      );
      
      setSuccess(`✅ Pago registrado exitosamente`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Recargar datos
      await loadPendingPayments();
      
      // Notificar al componente padre
      if (onPaymentRegistered) {
        onPaymentRegistered();
      }
      
    } catch (err: any) {
      console.error('❌ Error registrando pago:', err);
      setError(err.message || 'Error al registrar el pago');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRegistering(null);
    }
  };

  /**
   * 💰 Registrar pago completo del socio
   */
  const registerFullMemberPayment = async (
    memberId: string, 
    totalAmount: number,
    paymentMethod: 'cash' | 'transfer' | 'card'
  ) => {
    if (!gymData?.id) return;

    try {
      setRegistering(memberId);
      
      await MonthlyPaymentsService.registerMemberFullPayment(
        gymData.id, 
        year, 
        month, 
        memberId, 
        paymentMethod
      );
      
      setSuccess(`✅ Pago completo registrado exitosamente`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Recargar datos
      await loadPendingPayments();
      
      // Notificar al componente padre
      if (onPaymentRegistered) {
        onPaymentRegistered();
      }
      
    } catch (err: any) {
      console.error('❌ Error registrando pago completo:', err);
      setError(err.message || 'Error al registrar el pago');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRegistering(null);
    }
  };

  /**
   * 📅 Formatear fecha
   */
  const formatMonth = (year: number, month: number): string => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  /**
   * 💰 Formatear moneda
   */
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  /**
   * 🎨 Obtener estilo para días de atraso
   */
  const getOverdueStyle = (daysOverdue: number) => {
    if (daysOverdue <= 0) return 'text-gray-500';
    if (daysOverdue <= 5) return 'text-yellow-600';
    if (daysOverdue <= 15) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        <span className="text-gray-600">Cargando pagos pendientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Pagos Pendientes - {formatMonth(year, month)}
          </h2>
          <p className="text-gray-600">
            {pendingPayments.length} socios con pagos pendientes
          </p>
        </div>
        
        <button
          onClick={loadPendingPayments}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-600 mr-2" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-2" size={20} />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Lista de pagos pendientes */}
      {pendingPayments.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="mx-auto mb-4 text-green-400" size={64} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            ¡Todos los pagos al día!
          </h3>
          <p className="text-gray-600">
            No hay pagos pendientes para {formatMonth(year, month)}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Socio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actividades Pendientes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Debe
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingPayments.map((payment) => (
                  <tr key={payment.memberId} className="hover:bg-gray-50">
                    {/* Información del socio */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <User size={20} className="text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.memberName}
                          </div>
                          {payment.memberEmail && (
                            <div className="text-sm text-gray-500">
                              {payment.memberEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actividades pendientes */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {payment.activities
                          .filter(activity => activity.status === 'pending')
                          .map((activity, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm text-gray-900">
                                {activity.name}
                              </span>
                              <span className="text-sm font-medium text-gray-900 ml-4">
                                {formatCurrency(activity.cost)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </td>

                    {/* Total debe */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(payment.totalPending)}
                      </div>
                      {payment.totalPaid > 0 && (
                        <div className="text-xs text-gray-500">
                          Pagado: {formatCurrency(payment.totalPaid)}
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-sm ${getOverdueStyle(payment.daysOverdue)}`}>
                        {payment.isOverdue ? (
                          <>
                            <AlertCircle size={16} className="inline mr-1" />
                            {payment.daysOverdue} días vencido
                          </>
                        ) : (
                          <>
                            <Calendar size={16} className="inline mr-1" />
                            Al día
                          </>
                        )}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Botón pago completo */}
                        <button
                          onClick={() => {
                            setSelectedMember(payment);
                            setShowPaymentModal(true);
                          }}
                          disabled={registering === payment.memberId}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                        >
                          {registering === payment.memberId ? (
                            <RefreshCw size={14} className="animate-spin mr-1" />
                          ) : (
                            <CreditCard size={14} className="mr-1" />
                          )}
                          {registering === payment.memberId ? 'Procesando...' : 'Cobrar'}
                        </button>

                        {/* Botón ver detalle */}
                        <button
                          onClick={() => {
                            setSelectedMember(payment);
                            // TODO: Abrir modal de detalle
                          }}
                          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de pago (temporal, básico) */}
      {showPaymentModal && selectedMember && (
        <PaymentModal
          member={selectedMember}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedMember(null);
          }}
          onPaymentConfirmed={(paymentMethod) => {
            registerFullMemberPayment(
              selectedMember.memberId,
              selectedMember.totalPending,
              paymentMethod
            );
            setShowPaymentModal(false);
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * 🎯 Modal simple para confirmar pago
 */
interface PaymentModalProps {
  member: MonthlyPaymentListItem;
  onClose: () => void;
  onPaymentConfirmed: (paymentMethod: 'cash' | 'transfer' | 'card') => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ member, onClose, onPaymentConfirmed }) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Confirmar Pago</h3>
        
        <div className="mb-4">
          <p className="text-gray-600">Socio: <strong>{member.memberName}</strong></p>
          <p className="text-gray-600">Total a cobrar: <strong className="text-red-600">{formatCurrency(member.totalPending)}</strong></p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Método de pago:
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onPaymentConfirmed(paymentMethod)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentsList;