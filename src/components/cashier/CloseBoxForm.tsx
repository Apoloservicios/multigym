// src/components/cashier/CloseBoxForm.tsx
import React, { useState } from 'react';
import { DollarSign, AlignLeft, CheckCircle, X, AlertCircle, Info, Calculator } from 'lucide-react';
import { DailyCash } from '../../types/gym.types';
import { formatCurrency } from '../../utils/formatting.utils';

interface CloseBoxFormProps {
  dailyCash: DailyCash;
  currentBalance: number;
  onClose: (closingAmount: number, notes: string) => void;
  onCancel: () => void;
}

const CloseBoxForm: React.FC<CloseBoxFormProps> = ({ 
  dailyCash, 
  currentBalance, 
  onClose, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    closingAmount: currentBalance.toString(),
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);

  // Calcular diferencia entre balance calculado y cierre ingresado
  const calculateDifference = (): number => {
    const closingAmount = parseFloat(formData.closingAmount) || 0;
    return closingAmount - currentBalance;
  };

  // Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Mostrar advertencia de discrepancia si el monto de cierre es diferente al balance calculado
    if (name === 'closingAmount') {
      const closingAmount = parseFloat(value) || 0;
      setShowDiscrepancy(closingAmount !== currentBalance);
    }
  };

  // Validar el formulario
  const validateForm = () => {
    if (!formData.closingAmount || parseFloat(formData.closingAmount) < 0) {
      setError('El monto de cierre no puede ser negativo');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Llamar a la función onClose del componente padre
      onClose(parseFloat(formData.closingAmount), formData.notes);
    } catch (err: any) {
      console.error('Error closing daily cash:', err);
      setError(err.message || 'Error al cerrar la caja');
      setLoading(false);
    }
  };

  // Calcular el estado de la diferencia (positiva, negativa o cero)
  const getDifferenceStatus = () => {
    const difference = calculateDifference();
    if (difference > 0) return 'positive';
    if (difference < 0) return 'negative';
    return 'zero';
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Cerrar Caja Diaria</h2>
      <p className="text-gray-600 mb-6">
        Fecha: {new Date(dailyCash.date).toLocaleDateString('es-AR')}
      </p>
      
      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {/* Resumen antes de cerrar */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
        <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
          <Info size={16} className="mr-2" />
          Resumen de la Caja
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Apertura:</span>
              <span>{formatCurrency(dailyCash.openingAmount || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">+ Total ingresos:</span>
              <span className="text-green-600">{formatCurrency(dailyCash.totalIncome || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">- Total egresos:</span>
              <span className="text-red-600">{formatCurrency(dailyCash.totalExpense || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center font-medium pt-2 mt-2 border-t border-blue-200">
              <span>Balance calculado:</span>
              <span>{formatCurrency(currentBalance)}</span>
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="text-sm">
              <div className="font-medium mb-1">Detalle de ingresos:</div>
              <div className="flex justify-between">
                <span>Membresías:</span>
                <span>{formatCurrency(dailyCash.membershipIncome || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Otros ingresos:</span>
                <span>{formatCurrency(dailyCash.otherIncome || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Monto de cierre */}
          <div>
            <label htmlFor="closingAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Monto de Cierre *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign size={18} className="text-gray-400" />
              </div>
              <input
                type="number"
                id="closingAmount"
                name="closingAmount"
                value={formData.closingAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 flex items-center">
              <Calculator size={12} className="mr-1" />
              Este es el monto real con el que cierras la caja
            </p>
          </div>
          
          {/* Mostrar diferencia si existe */}
          {showDiscrepancy && (
            <div className={`p-3 rounded-lg ${
              getDifferenceStatus() === 'positive' ? 'bg-green-50 border border-green-100' :
              getDifferenceStatus() === 'negative' ? 'bg-red-50 border border-red-100' :
              'bg-blue-50 border border-blue-100'
            }`}>
              <div className="flex items-center">
                <div className={`mr-2 ${
                  getDifferenceStatus() === 'positive' ? 'text-green-500' :
                  getDifferenceStatus() === 'negative' ? 'text-red-500' :
                  'text-blue-500'
                }`}>
                  {getDifferenceStatus() === 'positive' ? 
                    <CheckCircle size={18} /> : 
                    getDifferenceStatus() === 'negative' ? 
                    <AlertCircle size={18} /> :
                    <Info size={18} />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {getDifferenceStatus() === 'positive' ? 
                      'Hay un sobrante en la caja' : 
                      getDifferenceStatus() === 'negative' ? 
                      'Hay un faltante en la caja' :
                      'El monto de cierre coincide con el balance calculado'
                    }
                  </p>
                  {getDifferenceStatus() !== 'zero' && (
                    <div className="flex justify-between mt-1">
                      <span className="text-sm">Diferencia:</span>
                      <span className={`text-sm font-medium ${
                        getDifferenceStatus() === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {getDifferenceStatus() === 'positive' ? '+' : ''}{formatCurrency(calculateDifference())}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Notas */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <AlignLeft size={18} className="text-gray-400" />
              </div>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observaciones adicionales sobre el cierre de caja"
              />
            </div>
          </div>
        </div>
        
        {/* Advertencia */}
        <div className="mt-6 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <div className="flex">
            <AlertCircle size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-700 font-medium">Importante</p>
              <p className="text-sm text-yellow-600 mt-1">
                Una vez cerrada la caja, no se podrán registrar más movimientos para este día.
                Asegúrate de haber registrado todos los ingresos y egresos antes de cerrar.
              </p>
            </div>
          </div>
        </div>
        
        {/* Botones de acción */}
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center"
            disabled={loading}
          >
            <X size={18} className="mr-2" />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            ) : (
              <CheckCircle size={18} className="mr-2" />
            )}
            {loading ? 'Procesando...' : 'Cerrar Caja'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CloseBoxForm;