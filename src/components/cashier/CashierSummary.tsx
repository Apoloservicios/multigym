// src/components/cashier/CashierSummary.tsx - CORREGIDO PARA HORAS Y ORDEN
import React from 'react';
import { DollarSign, FileText, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react';
import { DailyCash, Transaction } from '../../types/gym.types';
import { formatCurrency, toJavaScriptDate, formatTime } from '../../utils/formatting.utils';

interface CashierSummaryProps {
  dailyCash: DailyCash | null;
  transactions: Transaction[];
  currentBalance: number;
  isLoading: boolean;
  onViewTransactions: () => void;
}

const CashierSummary: React.FC<CashierSummaryProps> = ({
  dailyCash,
  transactions,
  currentBalance,
  isLoading,
  onViewTransactions
}) => {
  // 🔧 FUNCIÓN MEJORADA PARA FORMATEAR HORA CORRECTAMENTE
  const formatTransactionTime = (timestamp: any): string => {
    if (!timestamp) return 'No disponible';
    
    try {
      // Primero intentar con toDate() si es un Timestamp de Firebase
      let date: Date;
      
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp && timestamp.seconds) {
        // Si es un timestamp serializado con seconds
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        // Intentar crear Date directamente
        date = new Date(timestamp);
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return 'Hora inválida';
      }
      
      return date.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false // Formato 24 horas
      });
    } catch (error) {
      console.error('Error formatting transaction time:', error, timestamp);
      return 'Error en hora';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-500">Cargando resumen...</span>
      </div>
    );
  }

  if (!dailyCash) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No hay datos disponibles para esta fecha</p>
      </div>
    );
  }

  // Agrupar transacciones por tipo
  const incomeTransactions = transactions.filter(tx => tx.type === 'income');
  const expenseTransactions = transactions.filter(tx => tx.type === 'expense');

  // Agrupar transacciones por categoría
  const categoryGroups: Record<string, Transaction[]> = {};
  transactions.forEach(tx => {
    const category = tx.category || 'other';
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(tx);
  });

  // Calcular totales por categoría
  const categoryTotals: Record<string, number> = {};
  Object.entries(categoryGroups).forEach(([category, txs]) => {
    categoryTotals[category] = txs.reduce((total, tx) => total + tx.amount, 0);
  });

  // Obtener hora de apertura formateada
  const getFormattedOpeningTime = () => {
    if (!dailyCash.openingTime) return 'No disponible';
    return formatTransactionTime(dailyCash.openingTime);
  };

  // Obtener hora de cierre formateada
  const getFormattedClosingTime = () => {
    if (!dailyCash.closingTime) return 'No cerrada';
    return formatTransactionTime(dailyCash.closingTime);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-lg font-semibold">
          Resumen del Día {new Date(dailyCash.date).toLocaleDateString('es-AR')}
        </h2>
        
        <button
          onClick={onViewTransactions}
          className="mt-3 md:mt-0 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <FileText size={18} className="mr-2" />
          Ver todos los movimientos
        </button>
      </div>
      
      {/* Información general */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Información General</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="flex items-center text-gray-600">
                <Calendar size={16} className="mr-2" />
                <span>Fecha:</span>
              </div>
              <span>{new Date(dailyCash.date).toLocaleDateString('es-AR')}</span>
            </div>
            
            <div className="flex justify-between">
              <div className="flex items-center text-gray-600">
                <Clock size={16} className="mr-2" />
                <span>Apertura:</span>
              </div>
              <span>{getFormattedOpeningTime()}</span>
            </div>
            
            <div className="flex justify-between">
              <div className="flex items-center text-gray-600">
                <Clock size={16} className="mr-2" />
                <span>Cierre:</span>
              </div>
              <span>{getFormattedClosingTime()}</span>
            </div>
            
            <div className="flex justify-between">
              <div className="flex items-center text-gray-600">
                <DollarSign size={16} className="mr-2" />
                <span>Saldo Inicial:</span>
              </div>
              <span>{formatCurrency(dailyCash.openingAmount || 0)}</span>
            </div>
            
            {dailyCash.closingAmount !== undefined && (
              <div className="flex justify-between">
                <div className="flex items-center text-gray-600">
                  <DollarSign size={16} className="mr-2" />
                  <span>Saldo Final:</span>
                </div>
                <span>{formatCurrency(dailyCash.closingAmount)}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Balance del Día</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center text-green-600">
                <TrendingUp size={16} className="mr-2" />
                <span>Total Ingresos:</span>
              </div>
              <span className="font-medium">{formatCurrency(dailyCash.totalIncome || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center text-red-600">
                <TrendingDown size={16} className="mr-2" />
                <span>Total Egresos:</span>
              </div>
              <span className="font-medium">{formatCurrency(dailyCash.totalExpense || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center text-purple-600">
                <FileText size={16} className="mr-2" />
                <span>Ingresos Membresías:</span>
              </div>
              <span className="font-medium">{formatCurrency(dailyCash.membershipIncome || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center text-blue-600">
                <FileText size={16} className="mr-2" />
                <span>Otros Ingresos:</span>
              </div>
              <span className="font-medium">{formatCurrency(dailyCash.otherIncome || 0)}</span>
            </div>
            
            <div className="pt-2 mt-2 border-t">
              <div className="flex justify-between items-center">
                <div className="flex items-center font-medium">
                  <DollarSign size={18} className="mr-2" />
                  <span>Balance Final:</span>
                </div>
                <span className="text-xl font-bold">{formatCurrency(currentBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Transacciones recientes */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Últimos Movimientos</h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">No hay movimientos registrados para este día</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* 🔧 MOSTRAR SOLO LOS PRIMEROS 5 MOVIMIENTOS (ya están ordenados por fecha) */}
                {transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTransactionTime(tx.date || tx.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.category === 'membership' ? 'Membresía' : 
                       tx.category === 'extra' ? 'Ingreso Extra' : 
                       tx.category === 'withdrawal' ? 'Retiro' : 
                       tx.category === 'expense' ? 'Gasto' :
                       tx.category === 'refund' ? 'Devolución' :
                       typeof tx.category === 'string' ? tx.category : 'Otro'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {transactions.length > 5 && (
              <div className="px-6 py-3 bg-gray-50 text-center">
                <button 
                  onClick={onViewTransactions}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Ver todos los movimientos ({transactions.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Resumen por categoría */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Resumen por Categoría</h3>
        
        {Object.keys(categoryGroups).length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">No hay datos para mostrar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(categoryGroups).map(([category, txs]) => {
              const isIncome = txs[0]?.type === 'income';
              const total = categoryTotals[category] || 0;
              
              return (
                <div key={category} className={`p-4 rounded-lg ${
                  isIncome ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="capitalize">
                      {category === 'membership' ? 'Membresías' : 
                       category === 'extra' ? 'Ingresos Extras' : 
                       category === 'withdrawal' ? 'Retiros' : 
                       category === 'expense' ? 'Gastos' :
                       category === 'refund' ? 'Devoluciones' :
                       category}
                    </div>
                    <div className={`font-medium ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(total))}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {txs.length} {txs.length === 1 ? 'movimiento' : 'movimientos'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierSummary;