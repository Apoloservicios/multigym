// src/components/members/AccountStatement.tsx
import React, { useState } from 'react';
import { Calendar, DollarSign } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  concept: string;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: string;
  status: 'completed' | 'pending' | 'cancelled';
}

interface AccountStatementProps {
  memberId: string;
  memberName: string;
}

const AccountStatement: React.FC<AccountStatementProps> = ({ memberId, memberName }) => {
  const [period, setPeriod] = useState<string>('all');
  
  // Datos de transacciones (simulados)
  const transactions: Transaction[] = [
    {
      id: 'tr1',
      date: '2025-03-20',
      concept: 'Pago de membresía - Musculación',
      amount: 10000,
      type: 'income',
      paymentMethod: 'Efectivo',
      status: 'completed'
    },
    {
      id: 'tr2',
      date: '2025-02-20',
      concept: 'Pago de membresía - Musculación',
      amount: 10000,
      type: 'income',
      paymentMethod: 'Transferencia',
      status: 'completed'
    },
    {
      id: 'tr3',
      date: '2025-01-20',
      concept: 'Pago de membresía - Musculación',
      amount: 10000,
      type: 'income',
      paymentMethod: 'Tarjeta',
      status: 'pending'
    }
  ];
  
  // Calcular saldos
  const calcBalance = () => {
    return transactions
      .filter(tx => tx.status === 'completed')
      .reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };
  
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-2">Estado de Cuenta</h2>
      <p className="text-gray-600 mb-6">
        Socio: {memberName}
      </p>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-gray-600">Saldo Actual</h3>
          <p className={`text-2xl font-bold ${calcBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatAmount(calcBalance())}
          </p>
        </div>
        
        <div>
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
        </div>
      </div>
      
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
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 border-b border-gray-100">
                <td className="px-4 py-3 text-sm">{formatDate(tx.date)}</td>
                <td className="px-4 py-3 text-sm">{tx.concept}</td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${
                  tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-3 text-sm">{tx.paymentMethod}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tx.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {tx.status === 'completed' ? 'Completado' : 
                     tx.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 flex justify-between items-center">
        <button className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 flex items-center">
          <Calendar size={16} className="mr-2" />
          Ver todos los movimientos
        </button>
        
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center">
          <DollarSign size={16} className="mr-2" />
          Registrar Pago
        </button>
      </div>
    </div>
  );
};

export default AccountStatement;