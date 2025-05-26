// src/components/payments/PaymentManagement.tsx - Gestión completa de pagos

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, 
  Wallet, 
  ArrowUpRight, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  RefreshCw,
  Plus,
  Undo,
  Filter,
  Download,
  X,
  User,
  Calendar,
  Minus
} from 'lucide-react';
import { useFinancial } from '../../hooks/useFinancial'; // 🔧 CORRECCIÓN: import nombrado
import useAuth from '../../hooks/useAuth';
import { formatCurrency, formatDateTime } from '../../utils/formatting.utils';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  membershipAssignment: any;
  onSuccess: () => void;
}

interface PendingPayment {
  id: string;
  memberName: string;
  activityName: string;
  cost: number;
  startDate: string;
  endDate: string;
  overdue: boolean;
  daysOverdue?: number;
}

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onSuccess: () => void;
}

// Modal de Pago
const PaymentModal: React.FC<PaymentModalProps> = ({ 
  isOpen, 
  onClose, 
  membershipAssignment, 
  onSuccess 
}) => {
  const { processMembershipPayment, processing } = useFinancial();
  const [formData, setFormData] = useState({
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'card' | 'transfer' | 'other',
    notes: ''
  });

  useEffect(() => {
    if (membershipAssignment && isOpen) {
      setFormData(prev => ({
        ...prev,
        amount: membershipAssignment.cost || 0
      }));
    }
  }, [membershipAssignment, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!membershipAssignment?.id) return;

    const result = await processMembershipPayment(membershipAssignment.id, formData);
    
    if (result.success) {
      onSuccess();
      onClose();
      setFormData({ amount: 0, paymentMethod: 'cash', notes: '' });
    } else {
      alert('Error al procesar el pago: ' + result.error);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      other: 'Otro'
    };
    return labels[method as keyof typeof labels] || method;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Procesar Pago</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-2">
            <User size={16} className="text-gray-600 mr-2" />
            <span className="font-medium">{membershipAssignment?.memberName}</span>
          </div>
          <div className="flex items-center">
            <Calendar size={16} className="text-gray-600 mr-2" />
            <span className="text-sm text-gray-600">{membershipAssignment?.activityName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a Cobrar
            </label>
            <div className="relative">
              <DollarSign size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="cash">💵 Efectivo</option>
              <option value="card">💳 Tarjeta</option>
              <option value="transfer">🔄 Transferencia</option>
              <option value="other">📄 Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Observaciones sobre el pago..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              disabled={processing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing || formData.amount <= 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {processing ? (
                <RefreshCw size={16} className="animate-spin mr-2" />
              ) : (
                <CheckCircle size={16} className="mr-2" />
              )}
              {processing ? 'Procesando...' : `Cobrar ${formatCurrency(formData.amount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal de Devolución
const RefundModal: React.FC<RefundModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction, 
  onSuccess 
}) => {
  const { processRefund, processing } = useFinancial();
  const [formData, setFormData] = useState({
    amount: 0,
    reason: '',
    notes: ''
  });

  useEffect(() => {
    if (transaction && isOpen) {
      setFormData(prev => ({
        ...prev,
        amount: Math.abs(transaction.amount) || 0
      }));
    }
  }, [transaction, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction?.id) return;

    const result = await processRefund(transaction.id, formData);
    
    if (result.success) {
      onSuccess();
      onClose();
      setFormData({ amount: 0, reason: '', notes: '' });
    } else {
      alert('Error al procesar la devolución: ' + result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-red-600">Procesar Devolución</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center mb-2">
            <AlertTriangle size={16} className="text-red-600 mr-2" />
            <span className="font-medium text-red-800">Transacción Original</span>
          </div>
          <div className="text-sm text-red-700">
            <p>{transaction?.memberName}</p>
            <p>{formatCurrency(Math.abs(transaction?.amount || 0))}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a Devolver
            </label>
            <div className="relative">
              <DollarSign size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                min="0"
                step="0.01"
                max={Math.abs(transaction?.amount || 0)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de la Devolución *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Selecciona un motivo</option>
              <option value="Cancelación de membresía">Cancelación de membresía</option>
              <option value="Error en el cobro">Error en el cobro</option>
              <option value="Solicitud del cliente">Solicitud del cliente</option>
              <option value="Problema médico">Problema médico</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Detalles adicionales sobre la devolución..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              disabled={processing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing || formData.amount <= 0 || !formData.reason}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {processing ? (
                <RefreshCw size={16} className="animate-spin mr-2" />
              ) : (
                <Undo size={16} className="mr-2" />
              )}
              {processing ? 'Procesando...' : 'Devolver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente Principal de Gestión de Pagos
const PaymentManagement: React.FC = () => {
  const { gymData } = useAuth();
  const { 
    transactions, 
    dailySummary, 
    loading, 
    error, 
    refreshData 
  } = useFinancial();

  // Estados locales
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue'>('all');
  const [recentActivities, setRecentActivities] = useState<any[]>([]); // 🔧 SIMPLIFICADO

  // Cargar pagos pendientes
  const loadPendingPayments = async () => {
    if (!gymData?.id) return;

    setLoadingPending(true);
    try {
      const pendingRef = collection(db, `gyms/${gymData.id}/membershipAssignments`);
      const q = query(
        pendingRef,
        where('paymentStatus', '==', 'pending'),
        orderBy('endDate', 'asc')
      );

      const snapshot = await getDocs(q);
      const payments: PendingPayment[] = [];
      const today = new Date();

      snapshot.forEach(doc => {
        const data = doc.data();
        const endDate = new Date(data.endDate);
        const overdue = endDate < today;
        const daysOverdue = overdue ? Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;

        payments.push({
          id: doc.id,
          memberName: data.memberName || 'Sin nombre',
          activityName: data.activityName || 'Sin actividad',
          cost: data.cost || 0,
          startDate: data.startDate,
          endDate: data.endDate,
          overdue,
          daysOverdue
        });
      });

      setPendingPayments(payments);
    } catch (err) {
      console.error('Error loading pending payments:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadPendingPayments();
  }, [gymData?.id]);

  // Filtrar pagos pendientes
  const filteredPendingPayments = pendingPayments.filter(payment => {
    if (filter === 'pending') return !payment.overdue;
    if (filter === 'overdue') return payment.overdue;
    return true;
  });

  // Manejar éxito de pago
  const handlePaymentSuccess = () => {
    loadPendingPayments();
    refreshData();
  };

  // Obtener estadísticas rápidas
  const stats = {
    totalPending: pendingPayments.length,
    overdueCount: pendingPayments.filter(p => p.overdue).length,
    totalPendingAmount: pendingPayments.reduce((sum, p) => sum + p.cost, 0),
    overdueAmount: pendingPayments.filter(p => p.overdue).reduce((sum, p) => sum + p.cost, 0)
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Pagos</h1>
          <p className="text-gray-600">Control de cobros, devoluciones y caja diaria</p>
        </div>
        <button
          onClick={() => {
            loadPendingPayments();
            refreshData();
          }}
          disabled={loading || loadingPending}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={`mr-2 ${(loading || loadingPending) ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.totalPending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pagos Vencidos</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Monto Pendiente</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPendingAmount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Ingresos Hoy</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(dailySummary?.totalIncome || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todos ({stats.totalPending})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'pending' 
              ? 'bg-yellow-600 text-white' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Pendientes ({stats.totalPending - stats.overdueCount})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'overdue' 
              ? 'bg-red-600 text-white' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Vencidos ({stats.overdueCount})
        </button>
      </div>

      {/* Lista de pagos pendientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Pagos Pendientes</h2>
        </div>
        <div className="p-6">
          {loadingPending ? (
            <div className="flex justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-gray-400" />
            </div>
          ) : filteredPendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
              <p className="text-gray-500">
                {filter === 'all' 
                  ? 'No hay pagos pendientes' 
                  : filter === 'pending'
                  ? 'No hay pagos pendientes sin vencer'
                  : 'No hay pagos vencidos'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPendingPayments.map((payment) => (
                <div 
                  key={payment.id} 
                  className={`p-4 rounded-lg border-2 ${
                    payment.overdue 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <User size={16} className="text-gray-600 mr-2" />
                        <span className="font-medium text-gray-900">{payment.memberName}</span>
                        {payment.overdue && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            Vencido hace {payment.daysOverdue} días
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar size={14} className="mr-1" />
                        <span>{payment.activityName}</span>
                        <span className="mx-2">•</span>
                        <span>Vence: {new Date(payment.endDate).toLocaleDateString('es-AR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(payment.cost)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowPaymentModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      >
                        <Plus size={16} className="mr-2" />
                        Cobrar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transacciones recientes - MEJORADAS */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Transacciones Recientes</h2>
            <button className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              <Download size={14} className="mr-1" />
              Exportar
            </button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-gray-400" />
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay transacciones recientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity: any) => ( // 🔧 SIMPLIFICADO
                <div key={activity.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${
                      activity.type === 'payment' ? 'bg-green-100' : 
                      activity.type === 'refund' ? 'bg-red-100' : 'bg-orange-100'
                    }`}>
                      {activity.type === 'payment' ? (
                        <ArrowUpRight size={16} className="text-green-600" />
                      ) : activity.type === 'refund' ? (
                        <Undo size={16} className="text-red-600" />
                      ) : (
                        <Minus size={16} className="text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.memberName}</p>
                      <p className="text-sm text-gray-600">
                        {activity.type === 'payment' ? 'Pago' : 
                         activity.type === 'refund' ? 'Devolución' : 'Egreso'} • {activity.method}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className={`font-medium ${activity.color}`}>
                        {activity.symbol}{formatCurrency(activity.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(activity.timestamp)}
                      </p>
                    </div>
                    {activity.type === 'payment' && activity.status === 'completed' && (
                      <button
                        onClick={() => {
                          setSelectedTransaction(activity);
                          setShowRefundModal(true);
                        }}
                        className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        <Undo size={14} className="mr-1 inline" />
                        Devolver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        membershipAssignment={selectedPayment}
        onSuccess={handlePaymentSuccess}
      />

      <RefundModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        transaction={selectedTransaction}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default PaymentManagement;