// src/components/members/MemberAccountStatement.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Download, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
// Usar la importación correcta para Transaction
import { Transaction } from '../../types/gym.types';
import { formatCurrency } from '../../utils/formatting.utils';
import { getMemberPaymentHistory } from '../../services/payment.service';
import useAuth from '../../hooks/useAuth';

interface MemberAccountStatementProps {
  memberId: string;
  memberName: string;
  totalDebt: number;
  onRegisterPayment: () => void;
}

const MemberAccountStatement: React.FC<MemberAccountStatementProps> = ({ 
  memberId, 
  memberName,
  totalDebt,
  onRegisterPayment
}) => {
  const { gymData } = useAuth();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<string>('all');
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Cargar historial de pagos
  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!gymData?.id || !memberId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        const history = await getMemberPaymentHistory(gymData.id, memberId);
        setTransactions(history);
      } catch (err: any) {
        console.error('Error loading payment history:', err);
        setError(err.message || 'Error al cargar el historial de pagos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPaymentHistory();
  }, [gymData?.id, memberId]);
  
  // Filtrar transacciones por período
  const filteredTransactions = () => {
    if (period === 'all') {
      return transactions;
    }
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const firstDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    
    return transactions.filter(tx => {
      // Manejar timestamp de Firestore correctamente
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
  
  // Calcular saldo (solo para visualización)
  const calcBalance = () => {
    return transactions
      .filter(tx => tx.status === 'completed')
      .reduce((acc, tx) => acc + (tx.type === 'income' ? -tx.amount : tx.amount), 0);
  };
  
  // Formatear fecha
  const formatDate = (date: any) => {
    const d = date && typeof date === 'object' && 'toDate' in date 
      ? date.toDate() 
      : new Date(date);
    return d.toLocaleDateString('es-AR');
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
    setLoading(true);
    try {
      const history = await getMemberPaymentHistory(gymData?.id || '', memberId);
      setTransactions(history);
      setError('');
    } catch (err: any) {
      console.error('Error refreshing payment history:', err);
      setError(err.message || 'Error al actualizar el historial de pagos');
    } finally {
      setLoading(false);
    }
  };
  
  // Exportar a CSV
  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      // Obtener las transacciones filtradas
      const dataToExport = filteredTransactions();
      
      // Crear contenido CSV
      let csvContent = 'Fecha,Concepto,Monto,Método de Pago,Estado\n';
      
      dataToExport.forEach(tx => {
        const date = formatDate(tx.date);
        const description = tx.description.replace(/,/g, '');
        const amount = tx.type === 'income' ? -tx.amount : tx.amount;
        const method = getPaymentMethodName(tx.paymentMethod || '');
        const status = tx.status === 'completed' ? 'Completado' : 
                      tx.status === 'pending' ? 'Pendiente' : 'Cancelado';
        
        csvContent += `${date},"${description}",${amount},${method},${status}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `estado-cuenta-${memberName.replace(/\s+/g, '-')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
    } finally {
      setIsExporting(false);
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
            disabled={loading}
            className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={exportToCSV}
            disabled={isExporting || transactions.length === 0}
            className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700"
            title="Exportar a CSV"
          >
            <Download size={18} className={isExporting ? 'animate-pulse' : ''} />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-6 flex justify-end">
        <button 
          onClick={onRegisterPayment}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <DollarSign size={18} className="mr-2" />
          Registrar Pago
        </button>
      </div>
    </div>
  );
};

export default MemberAccountStatement;