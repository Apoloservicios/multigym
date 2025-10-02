// src/components/members/MemberAccountStatement.tsx - VERSIÓN CORREGIDA Y OPTIMIZADA

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
  Eye,
  ExternalLink
} from 'lucide-react';
import { Transaction } from '../../types/gym.types';
import { MembershipAssignment } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { getMemberPaymentHistory, getPendingMemberships } from '../../services/payment.service';
import { exportTransactionsToExcel } from '../../utils/excel.utils';
import { generateReceiptPDF, generateWhatsAppLink } from '../../utils/receipt.utils';
import useAuth from '../../hooks/useAuth';

interface MemberAccountStatementProps {
  memberId: string;
  memberName: string;
  totalDebt: number;
  onPaymentClick: () => void;
  onRefresh?: () => void | Promise<void>; // 🆕 AGREGAR ESTA LÍNEA (opcional)
}

const MemberAccountStatement: React.FC<MemberAccountStatementProps> = ({
  memberId,
  memberName,
  totalDebt,
  onPaymentClick
}) => {
  const { gymData } = useAuth();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<MembershipAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'pending'>('summary');
  
  // Estados para comprobante
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedMemberships, setSelectedMemberships] = useState<MembershipAssignment[]>([]);

  // Cargar datos
  const loadData = async () => {
    if (!gymData?.id || !memberId) {
      setLoading(false);
      return;
    }

    try {
      const [transactionHistory, pendingMembershipsList] = await Promise.all([
        getMemberPaymentHistory(gymData.id, memberId),
        getPendingMemberships(gymData.id, memberId)
      ]);

      setTransactions(transactionHistory);
      setPendingMemberships(pendingMembershipsList);
      
      console.log('📊 DATOS CARGADOS EN ESTADO DE CUENTA:', {
        transacciones: transactionHistory.length,
        membresiaspendientes: pendingMembershipsList.length,
        totalDeuda: totalDebt
      });
      
    } catch (err) {
      console.error('Error loading account data:', err);
      setError('Error al cargar los datos del estado de cuenta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gymData?.id, memberId]);

  // Filtrar transacciones por período
  const filteredTransactions = () => {
    if (period === 'all') return transactions;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    return transactions.filter((tx: any) => {
      const txDate = tx.date && typeof tx.date.toDate === 'function' 
        ? tx.date.toDate() 
        : new Date(tx.date);
      
      switch (period) {
        case 'current':
          return txDate >= firstDayOfMonth;
        case 'previous':
          return txDate >= firstDayOfPreviousMonth && txDate <= lastDayOfPreviousMonth;
        case 'year':
          return txDate >= firstDayOfYear;
        default:
          return true;
      }
    });
  };

  // Formatear fecha correctamente
  const formatDate = (date: any) => {
    if (!date) return 'Sin fecha';
    
    let actualDate: Date;
    
    if (date && typeof date === 'object' && 'toDate' in date) {
      actualDate = date.toDate();
    } else if (date instanceof Date) {
      actualDate = date;
    } else {
      actualDate = new Date(date);
    }
    
    return actualDate.toLocaleDateString('es-AR');
  };

  // Obtener el nombre del método de pago
  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      default: return method || 'No especificado';
    }
  };

  // Obtener el estilo según el estado
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Función para refrescar los datos
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  // Exportar a Excel
  const exportToExcel = async () => {
    setIsExporting(true);
    
    try {
      const dataToExport = filteredTransactions();
      await exportTransactionsToExcel(dataToExport, memberName);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Error al exportar a Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Determinar si una membresía está vencida
  const isMembershipOverdue = (membership: MembershipAssignment): boolean => {
    if (!membership.endDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return membership.endDate < today;
  };

  // Calcular días de atraso
  const getDaysOverdue = (membership: MembershipAssignment): number => {
    if (!isMembershipOverdue(membership)) return 0;
    const today = new Date();
    const endDate = new Date(membership.endDate);
    return Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Mostrar comprobante de pago
  const showPaymentReceipt = async (transaction: Transaction) => {
    try {
      let relatedMemberships: MembershipAssignment[] = [];
      
      if (transaction.membershipId) {
        const membershipIds = transaction.membershipId.split(', ');
        
        for (const membershipId of membershipIds) {
          let foundMembership = pendingMemberships.find((m: any) => m.id === membershipId);
          
          if (!foundMembership && transaction.description) {
            const createdMembership = createMembershipFromDescription(transaction.description, membershipId);
            if (createdMembership) {
              foundMembership = createdMembership;
            }
          }
          
          if (foundMembership) {
            relatedMemberships.push(foundMembership);
          }
        }
      }
      
      setSelectedTransaction(transaction);
      setSelectedMemberships(relatedMemberships);
      setShowReceipt(true);
    } catch (err) {
      console.error('Error preparing receipt:', err);
    }
  };

  // Crear objeto de membresía a partir de la descripción
  const createMembershipFromDescription = (description: string, membershipId: string): MembershipAssignment | null => {
    if (description.includes('Pago membresías:')) {
      const detailMatch = description.match(/Pago membresías: (.+?) \| Total:/);
      if (detailMatch) {
        const details = detailMatch[1];
        const membershipMatches = details.split(', ');
        const firstMembership = membershipMatches[0];
        const match = firstMembership.match(/(.+?) - \$\s*([\d,.]+)/);
        
        if (match) {
          const name = match[1].trim();
          const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
          const amount = parseFloat(cleanAmount);
          
          return {
            id: membershipId,
            activityName: name,
            cost: amount,
            paymentStatus: 'paid',
            status: 'active'
          } as MembershipAssignment;
        }
      }
    } else if (description.includes('Pago membresía')) {
      const match = description.match(/Pago membresía (.+?) - \$\s*([\d,.]+)/);
      if (match) {
        const name = match[1].trim();
        const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
        const amount = parseFloat(cleanAmount);
        
        return {
          id: membershipId,
          activityName: name,
          cost: amount,
          paymentStatus: 'paid',
          status: 'active'
        } as MembershipAssignment;
      }
    }
    
    return null;
  };

  // Generar PDF del comprobante
  const handleDownloadPDF = async () => {
    if (!selectedTransaction) return;
    
    try {
      await generateReceiptPDF(
        selectedTransaction,
        memberName,
        selectedMemberships,
        gymData?.name || 'MultiGym'
      );
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Error al generar PDF del comprobante');
    }
  };

  // Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    if (!selectedTransaction) return;
    
    try {
      const whatsappLink = generateWhatsAppLink(
        selectedTransaction,
        memberName,
        selectedMemberships,
        gymData?.name || 'MultiGym'
      );
      
      window.open(whatsappLink, '_blank');
    } catch (err) {
      console.error('Error generating WhatsApp link:', err);
      setError('Error al generar enlace de WhatsApp');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Cargando estado de cuenta...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Estado de Cuenta</h2>
          <p className="text-gray-600">Socio: {memberName}</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin mr-2' : 'mr-2'} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          
          <button
            onClick={exportToExcel}
            disabled={isExporting}
            className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            <Download size={16} className={isExporting ? 'animate-pulse mr-2' : 'mr-2'} />
            {isExporting ? 'Exportando...' : 'Excel'}
          </button>
        </div>
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
            <h3 className="text-gray-600 text-sm font-medium">Saldo Actual</h3>
            <p className={`text-3xl font-bold ${totalDebt <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalDebt <= 0 ? '$ 0' : `$ ${totalDebt.toLocaleString('es-AR')}`}
            </p>
            <p className="text-sm text-gray-500">
              {totalDebt <= 0 ? 'Sin deuda pendiente' : `${pendingMemberships.length} membresía(s) pendiente(s)`}
            </p>
          </div>
          
          {totalDebt > 0 && (
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

      {/* Tabs de navegación */}
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
            Deudas Pendientes ({pendingMemberships.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Historial de Pagos ({transactions.length})
          </button>
        </nav>
      </div>

      {/* Contenido de las tabs */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Resumen rápido */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-600">Pendientes</p>
                  <p className="text-xl font-bold text-yellow-900">{pendingMemberships.length}</p>
                  <p className="text-xs text-yellow-700">
                    {formatCurrency(pendingMemberships.reduce((sum, m) => sum + m.cost, 0))}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Pagos</p>
                  <p className="text-xl font-bold text-green-900">{transactions.length}</p>
                  <p className="text-xs text-green-700">Este año</p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-600">Vencidas</p>
                  <p className="text-xl font-bold text-red-900">
                    {pendingMemberships.filter(m => isMembershipOverdue(m)).length}
                  </p>
                  <p className="text-xs text-red-700">Requieren atención</p>
                </div>
              </div>
            </div>
          </div>

          {/* Últimas transacciones */}
          {transactions.length > 0 && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">Últimos Pagos</h4>
              <div className="space-y-3">
                {transactions.slice(0, 3).map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.description || 'Pago de membresía'}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(transaction.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        +{formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getPaymentMethodName(transaction.paymentMethod || '')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div>
          {pendingMemberships.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto text-green-300 mb-3" />
              <p className="text-gray-500">No hay membresías pendientes de pago</p>
              <p className="text-sm text-gray-400">Todas las membresías están al día</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium text-gray-900">
                  Membresías Pendientes ({pendingMemberships.length})
                </h4>
                {pendingMemberships.length > 0 && (
                  <button
                    onClick={onPaymentClick}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <CreditCard size={16} className="mr-2" />
                    Pagar Seleccionadas
                  </button>
                )}
              </div>
              
              {pendingMemberships.map((membership, index) => {
                const isOverdue = isMembershipOverdue(membership);
                const daysOverdue = getDaysOverdue(membership);
                
                return (
                  <div 
                    key={index} 
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
                            {membership.activityName}
                          </h5>
                          {isOverdue && (
                            <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                              Vencida hace {daysOverdue} días
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Período:</span><br />
                            {formatDate(membership.startDate)} - {formatDate(membership.endDate)}
                          </div>
                          <div>
                            <span className="font-medium">Estado:</span><br />
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              getStatusStyle(isOverdue ? 'overdue' : 'pending')
                            }`}>
                              {isOverdue ? 'Vencida' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(membership.cost)}
                        </p>
                        <button
                          onClick={onPaymentClick}
                          className={`mt-2 px-3 py-1 text-sm rounded ${
                            isOverdue 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-yellow-600 text-white hover:bg-yellow-700'
                          }`}
                        >
                          Pagar Ahora
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          {/* Filtros de período */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">Todos los períodos</option>
                <option value="current">Mes actual</option>
                <option value="previous">Mes anterior</option>
                <option value="year">Este año</option>
              </select>
            </div>
            
            <p className="text-sm text-gray-500">
              {filteredTransactions().length} transacción(es)
            </p>
          </div>

          {filteredTransactions().length === 0 ? (
            <div className="text-center py-8">
              <Receipt size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay transacciones en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions().map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.description || 'Pago de membresía'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-green-600">
                        +{formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getPaymentMethodName(transaction.paymentMethod || '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          getStatusStyle(transaction.status || 'completed')
                        }`}>
                          {transaction.status === 'completed' ? 'Completado' : transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => showPaymentReceipt(transaction)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Ver comprobante"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal del comprobante */}
      {showReceipt && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Comprobante de Pago</h3>
              <button
                onClick={() => setShowReceipt(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm text-gray-600">Fecha: {formatDate(selectedTransaction.date)}</p>
                <p className="text-sm text-gray-600">Socio: {memberName}</p>
                <p className="text-lg font-bold">Monto: {formatCurrency(selectedTransaction.amount)}</p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  <Download size={16} className="inline mr-2" />
                  PDF
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  <ExternalLink size={16} className="inline mr-2" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberAccountStatement;