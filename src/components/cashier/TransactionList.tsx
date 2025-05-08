// src/components/cashier/TransactionList.tsx

import React, { useState } from 'react';
import { Search, Filter, Download, Check, X, User, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction, TransactionCategory } from '../../types/gym.types';
import { formatCurrency } from '../../utils/formatting.utils';

interface TransactionListProps {
  transactions: Transaction[];
  selectedDate: string;
  isLoading: boolean;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  selectedDate,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filtrar transacciones
  const filteredTransactions = transactions.filter(tx => {
    // Filtrar por término de búsqueda
    const matchesSearch = 
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtrar por tipo
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    
    // Filtrar por categoría
    const matchesCategory = categoryFilter === 'all' || tx.category === categoryFilter;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  // Obtener categorías únicas para el filtro
  const uniqueCategories: string[] = Array.from(
    new Set(transactions.map(tx => tx.category || 'other'))
  );

  // Exportar a CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      // Crear contenido CSV
      let csvContent = 'Fecha,Hora,Tipo,Categoría,Descripción,Monto,Método de Pago,Usuario,Notas\n';
      
      filteredTransactions.forEach(tx => {
        const date = tx.date && tx.date.toDate ? 
          tx.date.toDate().toLocaleDateString('es-AR') : 
          new Date(tx.date).toLocaleDateString('es-AR');
        
        const time = tx.date && tx.date.toDate ? 
          tx.date.toDate().toLocaleTimeString('es-AR') : 
          new Date(tx.date).toLocaleTimeString('es-AR');
        
        const description = tx.description.replace(/,/g, ' ');
        const notes = (tx.notes || '').replace(/,/g, ' ');
        
        csvContent += `${date},${time},${tx.type},${tx.category || ''},${description},${tx.amount},${tx.paymentMethod || ''},${tx.userName || ''},${notes}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transacciones_${selectedDate}.csv`);
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

  // Formatear hora
  const formatTime = (date: any): string => {
    if (!date) return '';
    
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  // Obtener el nombre del método de pago
  const getPaymentMethodName = (method: string = ''): string => {
    switch (method.toLowerCase()) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      default: return method;
    }
  };

  // Obtener el nombre de la categoría
  const getCategoryName = (category: string = ''): string => {
    switch (category.toLowerCase()) {
      case 'membership': return 'Membresía';
      case 'extra': return 'Ingreso Extra';
      case 'product': return 'Producto';
      case 'service': return 'Servicio';
      case 'withdrawal': return 'Retiro';
      case 'supplier': return 'Proveedor';
      case 'services': return 'Servicios';
      case 'maintenance': return 'Mantenimiento';
      case 'salary': return 'Sueldos';
      case 'other': return 'Otro';
      default: return category;
    }
  };

  // Calcular totales
  const calculateTotals = () => {
    const totals = {
      income: 0,
      expense: 0
    };
    
    filteredTransactions.forEach(tx => {
      if (tx.type === 'income') {
        totals.income += tx.amount;
      } else if (tx.type === 'expense') {
        totals.expense += tx.amount;
      }
    });
    
    return totals;
  };

  const totals = calculateTotals();

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-lg font-semibold mb-4 md:mb-0">
          Movimientos del {new Date(selectedDate).toLocaleDateString('es-AR')}
        </h2>
        
        <button
          onClick={handleExportCSV}
          disabled={isExporting || filteredTransactions.length === 0}
          className={`px-4 py-2 rounded-md flex items-center ${
            isExporting || filteredTransactions.length === 0
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Download size={18} className="mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar a CSV'}
        </button>
      </div>
      
      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por descripción, notas o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los tipos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Egresos</option>
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las categorías</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>
                {getCategoryName(category)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Resumen de filtrado */}
      <div className="flex flex-col md:flex-row justify-between mb-6">
        <div className="text-sm text-gray-600 mb-4 md:mb-0">
          Mostrando {filteredTransactions.length} de {transactions.length} movimientos
        </div>
        
        <div className="flex space-x-4">
          <div className="flex items-center">
            <TrendingUp size={16} className="text-green-500 mr-2" />
            <span className="text-sm">Ingresos: </span>
            <span className="font-medium ml-1 text-green-600">{formatCurrency(totals.income)}</span>
          </div>
          
          <div className="flex items-center">
            <TrendingDown size={16} className="text-red-500 mr-2" />
            <span className="text-sm">Egresos: </span>
            <span className="font-medium ml-1 text-red-600">{formatCurrency(totals.expense)}</span>
          </div>
          
          <div className="flex items-center">
            <span className="text-sm">Balance: </span>
            <span className={`font-medium ml-1 ${
              totals.income - totals.expense >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(totals.income - totals.expense)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Lista de transacciones */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando transacciones...</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Filter size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay movimientos para mostrar</h3>
          <p className="text-gray-500">
            {transactions.length === 0
              ? 'No hay movimientos registrados para este día'
              : 'Intenta con otros filtros o términos de búsqueda'
            }
          </p>
          {transactions.length > 0 && searchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setCategoryFilter('all');
              }}
              className="mt-4 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{formatTime(tx.date)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{getCategoryName(tx.category)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{tx.description}</div>
                    {tx.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        Nota: {tx.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-medium ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{getPaymentMethodName(tx.paymentMethod)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User size={16} className="text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{tx.userName || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {tx.status === 'completed' ? 
                        <Check size={12} className="mr-1" /> : 
                        <X size={12} className="mr-1" />}
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
    </div>
  );
};

export default TransactionList;