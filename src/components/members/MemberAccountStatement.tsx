// src/components/members/MemberAccountStatement.tsx
// ACTUALIZADO PARA SISTEMA DE PAGOS MENSUALES

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  RefreshCw, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  CreditCard,
  Receipt,
  Plus,
  Eye
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';
import { collection, query, doc, where, getDocs, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { registerPayment } from '../../services/monthlyPayments.service';
import PaymentReceipt from './PaymentReceipt';

import { Member } from '../../types/member.types'; // ✅ AGREGAR ESTE IMPORT


interface MonthlyPayment {
  id: string;
  membershipId: string;
  activityName: string;
  month: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: any;
  paidDate?: string;
}

interface MemberAccountStatementProps {
  memberId: string;
  memberName: string;
  totalDebt: number;
  onPaymentClick: () => void;
  onRefresh?: () => void;
   member?: Member; // ✅ AGREGAR ESTA LÍNEA
}

const MemberAccountStatement: React.FC<MemberAccountStatementProps> = ({
  memberId,
  memberName,
  totalDebt,
  onPaymentClick,
  onRefresh,
  member  
}) => {
  const { gymData } = useAuth();
  
  const [pendingPayments, setPendingPayments] = useState<MonthlyPayment[]>([]);
  const [paidPayments, setPaidPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'pending' | 'history'>('summary');

  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);


  // Cargar pagos mensuales
  const loadPayments = async () => {
    if (!gymData?.id || !memberId) {
      setLoading(false);
      return;
    }

    try {
      const paymentsRef = collection(db, `gyms/${gymData.id}/monthlyPayments`);
      const q = query(
        paymentsRef,
        where('memberId', '==', memberId),
        orderBy('dueDate', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const pending: MonthlyPayment[] = [];
      const paid: MonthlyPayment[] = [];
      
      snapshot.forEach(doc => {
        const payment = { id: doc.id, ...doc.data() } as MonthlyPayment;
        
        // Verificar si está vencido
        if (payment.status === 'pending') {
          const today = new Date();
          const dueDate = new Date(payment.dueDate);
          if (today > dueDate) {
            payment.status = 'overdue';
          }
        }

        
        if (payment.status === 'paid') {
          paid.push(payment);
        } else {
          pending.push(payment);
        }
      });
      
      setPendingPayments(pending);
      setPaidPayments(paid);
      
      console.log('📊 Pagos cargados:', {
        pendientes: pending.length,
        pagados: paid.length
      });
      
    } catch (err) {
      console.error('Error cargando pagos:', err);
      setError('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [gymData?.id, memberId]);

  // Refrescar datos
const refreshData = async () => {
  setRefreshing(true);
  try {
    await loadPayments();
    if (onRefresh) {
      await onRefresh();
    }
  } finally {
    setRefreshing(false);
  }
};



    const handleShowReceipt = async (payment: MonthlyPayment) => {
      if (!gymData?.id || !memberId) return;
      
      try {
        const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships`, payment.membershipId);
        const membershipSnap = await getDoc(membershipRef);
        
        let membershipData = {
          startDate: payment.dueDate,
          endDate: payment.dueDate,
          activityName: payment.activityName
        };
        
        if (membershipSnap.exists()) {
          const data = membershipSnap.data();
          membershipData = {
            startDate: data.startDate || payment.dueDate,
            endDate: data.endDate || payment.dueDate,
            activityName: data.activityName || payment.activityName
          };
        }
        
        setReceiptData({
          memberName: memberName,
          memberPhone: member?.phone || '', // ✅ CAMBIAR: usar phone en lugar de email
          memberDNI: member?.dni || '',
          memberNumber: member?.memberNumber || 0,
          activityName: membershipData.activityName,
          amount: payment.amount,
          paymentDate: payment.paidDate || payment.dueDate,
          paymentMethod: 'cash',
          membershipStartDate: membershipData.startDate,
          membershipEndDate: membershipData.endDate,
          gymName: gymData?.name || 'Gimnasio',
          transactionId: payment.id
        });
        
        setShowReceipt(true);
      } catch (error) {
        console.error('Error preparando comprobante:', error);
        alert('Error al cargar el comprobante');
      }
    };


  // Pagar un pago específico
const handlePaySingle = async (paymentId: string, amount: number) => {
  if (!gymData?.id) return;

  const confirmed = window.confirm(
    `¿Confirmar pago de ${formatCurrency(amount)}?`
  );

  if (!confirmed) return;

  try {
    const result = await registerPayment(gymData.id, paymentId, 'cash');
    
    if (result.success) {
      alert('Pago registrado correctamente');
      
      // ✅ FIX: Refrescar AMBOS - pagos Y datos del socio
      await refreshData(); // Refresca la lista de pagos
      
      // ✅ AGREGAR ESTO: También refrescar el member completo
      if (onRefresh) {
        await onRefresh(); // Esto actualiza la deuda en el header
      }
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Error al pagar:', error);
    alert('Error al registrar el pago');
  }
};



  // Formatear fecha
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR');
    } catch {
      return dateStr;
    }
  };

  // Calcular días de atraso
  const getDaysOverdue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diff = today.getTime() - due.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  // Calcular total pendiente
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Cargando estado de cuenta...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Estado de Cuenta</h2>
          <p className="text-gray-600">Socio: {memberName}</p>
        </div>
        
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin mr-2' : 'mr-2'} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {/* Resumen de saldo */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-gray-600 text-sm font-medium">Saldo Pendiente</h3>
            <p className={`text-3xl font-bold ${totalPending <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPending)}
            </p>
            <p className="text-sm text-gray-500">
              {totalPending <= 0 
                ? 'Sin pagos pendientes' 
                : `${pendingPayments.length} pago(s) pendiente(s)`
              }
            </p>
          </div>
          
          {totalPending > 0 && (
            <button
              onClick={onPaymentClick}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Registrar Pago
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pendientes ({pendingPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Historial ({paidPayments.length})
          </button>
        </nav>
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pendientes */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-600">Pendientes</p>
                  <p className="text-xl font-bold text-yellow-900">{pendingPayments.length}</p>
                  <p className="text-xs text-yellow-700">{formatCurrency(totalPending)}</p>
                </div>
              </div>
            </div>
            
            {/* Pagados */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Pagados</p>
                  <p className="text-xl font-bold text-green-900">{paidPayments.length}</p>
                  <p className="text-xs text-green-700">{formatCurrency(totalPaid)}</p>
                </div>
              </div>
            </div>
            
            {/* Vencidos */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-600">Vencidos</p>
                  <p className="text-xl font-bold text-red-900">
                    {pendingPayments.filter(p => p.status === 'overdue').length}
                  </p>
                  <p className="text-xs text-red-700">Requieren atención</p>
                </div>
              </div>
            </div>
          </div>

          {/* Últimos pagos */}
          {paidPayments.length > 0 && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">Últimos Pagos</h4>
              <div className="space-y-3">
                {paidPayments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {payment.activityName} - {payment.month}
                        </p>
                        <p className="text-xs text-gray-500">
                          Pagado: {payment.paidDate ? formatDate(payment.paidDate) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-600">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pendientes */}
      {activeTab === 'pending' && (
        <div>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto text-green-300 mb-3" />
              <p className="text-gray-500">No hay pagos pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPayments.map((payment) => {
                const isOverdue = payment.status === 'overdue';
                const daysOverdue = isOverdue ? getDaysOverdue(payment.dueDate) : 0;
                
                return (
                  <div 
                    key={payment.id}
                    className={`p-4 rounded-lg border-2 ${
                      isOverdue 
                        ? 'border-red-200 bg-red-50' 
                        : 'border-yellow-200 bg-yellow-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            isOverdue ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></div>
                          <h5 className="font-medium text-gray-900">
                            {payment.activityName}
                          </h5>
                          {isOverdue && (
                            <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                              Vencido hace {daysOverdue} días
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <p>Mes: <strong>{payment.month}</strong></p>
                          <p>Vence: <strong>{formatDate(payment.dueDate)}</strong></p>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                  
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Historial */}
      {activeTab === 'history' && (
      <div className="space-y-4">
        {paidPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th>Actividad</th>
                  <th>Mes</th>
                  <th>Fecha de Pago</th>
                  <th>Monto</th>
                  <th>Acciones</th> {/* ✅ AGREGAR ESTA COLUMNA */}
                </tr>
              </thead>
              <tbody>
                {paidPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.activityName}</td>
                    <td>{payment.month}</td>
                    <td>{payment.paidDate ? formatDate(payment.paidDate) : '-'}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>
                      {/* ✅ AGREGAR ESTE BOTÓN */}
                      <button
                        onClick={() => handleShowReceipt(payment)}
                        className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Receipt className="h-4 w-4 mr-1" />
                        Ver Comprobante
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay pagos registrados</p>
        )}
      </div>
    )}

    
      {/* ✅ AGREGAR ESTE MODAL AQUÍ, ANTES DEL CIERRE FINAL */}
    {showReceipt && receiptData && (
      <PaymentReceipt
        {...receiptData}
        onClose={() => setShowReceipt(false)}
      />
    )}
    </div>
    
  );
};

export default MemberAccountStatement;