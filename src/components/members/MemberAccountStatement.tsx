// src/components/members/MemberAccountStatement.tsx - MEJORADO para comprobantes con detalles

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, RefreshCw, Download, Receipt, Share, 
  Calendar, Filter, FileSpreadsheet, DollarSign 
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

interface MemberAccountStatementProps {
  memberId: string;
  memberName: string;
  totalDebt: number;
  onPaymentClick?: () => void;
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

    return transactions.filter(tx => {
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

  // 🔧 CORREGIR: Formatear fecha correctamente
  const formatDate = (date: any) => {
    if (!date) return 'Sin fecha';
    
    let actualDate: Date;
    
    // Manejar diferentes tipos de fecha
    if (date && typeof date === 'object' && 'toDate' in date) {
      // Firebase Timestamp
      actualDate = date.toDate();
    } else if (date instanceof Date) {
      // Objeto Date nativo
      actualDate = date;
    } else {
      // String o cualquier otro formato
      actualDate = new Date(date);
    }
    
    // 🔧 LOGGING para debug
    console.log('🔍 Formateo de fecha:', {
      originalDate: date,
      convertedDate: actualDate,
      formatted: actualDate.toLocaleDateString('es-AR')
    });
    
    return actualDate.toLocaleDateString('es-AR');
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

  // 🔧 MEJORADA: Mostrar comprobante de pago con mejor manejo de membresías
  const showPaymentReceipt = async (transaction: Transaction) => {
    try {
      // Primero intentar buscar membresías relacionadas con esta transacción
      let relatedMemberships: MembershipAssignment[] = [];
      
      if (transaction.membershipId) {
        // Si hay IDs de membresías en la transacción, buscar en pendientes Y en historial
        const membershipIds = transaction.membershipId.split(', ');
        
        for (const membershipId of membershipIds) {
          // Buscar en membresías pendientes primero
          let foundMembership = pendingMemberships.find(m => m.id === membershipId);
          
          // Si no está en pendientes, crear un objeto de membresía a partir de la descripción
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

  // 🔧 CORREGIDA: Crear objeto de membresía a partir de la descripción
  const createMembershipFromDescription = (description: string, membershipId: string): MembershipAssignment | null => {
    console.log('🔍 Creating membership from description:', {
      description,
      membershipId
    });
    
    // Extraer información de la descripción para crear un objeto MembershipAssignment
    if (description.includes('Pago membresías:')) {
      // Para múltiples membresías
      const detailMatch = description.match(/Pago membresías: (.+?) \| Total:/);
      if (detailMatch) {
        const details = detailMatch[1];
        const membershipMatches = details.split(', ');
        
        // Por simplicidad, tomar la primera membresía (idealmente deberíamos mapear por ID)
        const firstMembership = membershipMatches[0];
        // 🔧 CORREGIR REGEX: Permitir espacios opcionales después del $
        const match = firstMembership.match(/(.+?) - \$\s*([\d,.]+)/);
        
        if (match) {
          const name = match[1].trim();
          // 🔧 CORREGIR: Manejar formato argentino correctamente
          const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
          const amount = parseFloat(cleanAmount);
          
          console.log('🔍 Parsed amount (multiple):', {
            originalMatch: match[2],
            cleanAmount,
            finalAmount: amount
          });
          
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
      // Para una sola membresía
      // 🔧 CORREGIR REGEX: Permitir espacios opcionales después del $
      const match = description.match(/Pago membresía (.+?) - \$\s*([\d,.]+)/);
      if (match) {
        const name = match[1].trim();
        // 🔧 CORREGIR: Manejar formato argentino correctamente
        const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
        const amount = parseFloat(cleanAmount);
        
        console.log('🔍 Parsed amount (single):', {
          originalMatch: match[2],
          cleanAmount,
          finalAmount: amount
        });
        
        return {
          id: membershipId,
          activityName: name,
          cost: amount,
          paymentStatus: 'paid',
          status: 'active'
        } as MembershipAssignment;
      }
    }
    
    console.log('🔍 No match found for description:', description);
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
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Receipt size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No hay transacciones registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions().map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {tx.description || 'Pago de membresía'}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
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

      {/* Botones de acción al final */}
      <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <Calendar size={16} className="mr-2" />
          Imprimir Estado
        </button>
        
        {onPaymentClick && totalDebt > 0 && (
          <button
            onClick={onPaymentClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center"
          >
            <DollarSign size={16} className="mr-2" />
            Registrar Pago
          </button>
        )}
      </div>

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