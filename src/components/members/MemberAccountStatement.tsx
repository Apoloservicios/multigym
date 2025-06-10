// src/components/members/MemberAccountStatement.tsx - CORREGIDO PROPS

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, RefreshCw, Download, Receipt, Share, 
  Calendar, Filter, FileSpreadsheet 
} from 'lucide-react';
import { Transaction } from '../../types/gym.types';
import { MembershipAssignment } from '../../types/member.types';
import { getMemberPaymentHistory, getPendingMemberships } from '../../services/payment.service';
import { formatDisplayDate } from '../../utils/date.utils';
import { formatCurrency } from '../../utils/formatting.utils';
import { exportTransactionsToExcel } from '../../utils/excel.utils';
import { generateReceiptPDF, generateWhatsAppLink } from '../../utils/receipt.utils';
import PaymentReceipt from '../payments/PaymentReceipt';
import useAuth from '../../hooks/useAuth';

// ✅ PROPS CORREGIDAS - SIN onRegisterPayment
interface MemberAccountStatementProps {
  memberId: string;
  memberName: string;
  totalDebt: number;
}

const MemberAccountStatement: React.FC<MemberAccountStatementProps> = ({
  memberId,
  memberName,
  totalDebt
}) => {
  const { gymData } = useAuth();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<MembershipAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  
  // Estados para comprobante
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedMemberships, setSelectedMemberships] = useState<MembershipAssignment[]>([]);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [memberId]);

  const loadData = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const [historyData, pendingData] = await Promise.all([
        getMemberPaymentHistory(gymData.id, memberId),
        getPendingMemberships(gymData.id, memberId)
      ]);
      
      setTransactions(historyData);
      setPendingMemberships(pendingData);
    } catch (err: any) {
      console.error('Error loading account data:', err);
      setError(err.message || 'Error al cargar el estado de cuenta');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transacciones por período
  const filteredTransactions = () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    return transactions.filter(tx => {
      const txDate = tx.date && typeof tx.date === 'object' && 'toDate' in tx.date 
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

  // Formatear fecha
  const formatDate = (date: any) => {
    return formatDisplayDate(date);
  };

  // Obtener el nombre del método de pago
  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      default: return method;
    }
  };

  // Obtener el estilo según el estado de la transacción
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
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

  // Mostrar comprobante de pago
  const showPaymentReceipt = async (transaction: Transaction) => {
    try {
      // Buscar membresías relacionadas con esta transacción
      const relatedMemberships: MembershipAssignment[] = [];
      
      if (transaction.membershipId) {
        // Si hay IDs de membresías en la transacción
        const membershipIds = transaction.membershipId.split(', ');
        
        for (const membershipId of membershipIds) {
          const foundMembership = pendingMemberships.find(m => m.id === membershipId);
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Estado de Cuenta</h2>
      <p className="text-gray-600 mb-6">Socio: {memberName}</p>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-gray-600">Saldo Actual</h3>
          <p className={`text-2xl font-bold ${totalDebt <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalDebt)}
          </p>
        </div>
        
        <div className="flex space-x-3">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los períodos</option>
            <option value="current">Mes actual</option>
            <option value="previous">Mes anterior</option>
            <option value="year">Año actual</option>
          </select>
          
          <button 
            onClick={refreshData}
            disabled={refreshing}
            className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700"
            title="Actualizar"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={exportToExcel}
            disabled={isExporting || transactions.length === 0}
            className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700 flex items-center"
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={18} className={isExporting ? 'animate-pulse' : ''} />
            {!isExporting && <span className="ml-1 hidden sm:inline">Excel</span>}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500">Cargando transacciones...</p>
        </div>
      ) : filteredTransactions().length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No hay transacciones en este período</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Concepto</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 border-b">Importe</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Método</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions().map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 border-b border-gray-100">
                  <td className="px-4 py-3 text-sm">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 text-sm">{tx.description}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    tx.type === 'income' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {tx.type === 'income' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm">{getPaymentMethodName(tx.paymentMethod || '')}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(tx.status)}`}>
                      {tx.status === 'completed' ? 'Completado' : 
                       tx.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {tx.status === 'completed' && tx.type === 'income' && (
                      <button
                        onClick={() => showPaymentReceipt(tx)}
                        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                        title="Ver comprobante"
                      >
                        <Receipt size={14} className="mr-1" />
                        Comprobante
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de comprobante */}
      {showReceipt && selectedTransaction && (
        <PaymentReceipt
          transaction={selectedTransaction}
          memberName={memberName}
          memberships={selectedMemberships}
          onClose={() => {
            setShowReceipt(false);
            setSelectedTransaction(null);
            setSelectedMemberships([]);
          }}
          onDownloadPDF={handleDownloadPDF}
          onShareWhatsApp={handleShareWhatsApp}
        />
      )}
    </div>
  );
};

export default MemberAccountStatement;