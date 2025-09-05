// src/components/cashier/ExpenseForm.tsx
import React, { useState } from 'react';
import { DollarSign, CreditCard, Calendar, AlignLeft, Save, X, AlertCircle } from 'lucide-react';
import { registerExpense } from '../../services/dailyCash.service';
import useAuth from '../../hooks/useAuth';

interface ExpenseFormProps {
  selectedDate: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ selectedDate, onSuccess, onCancel }) => {
  const { gymData, userData } = useAuth();
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    paymentMethod: 'cash',
    category: 'withdrawal',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Validar el formulario
  const validateForm = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return false;
    }

    if (!formData.description.trim()) {
      setError('La descripción es obligatoria');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !gymData?.id || !userData) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await registerExpense(gymData.id, {
        amount: parseFloat(formData.amount),
        description: formData.description,
        paymentMethod: formData.paymentMethod,
        date: selectedDate,
        userId: userData.id,
        userName: userData.name,
        category: (formData.category as any) || 'expense',
        notes: formData.notes
      });
      
      if (result.success) {
        onSuccess();
      } else {
        throw new Error(result.error || 'Error al registrar el egreso');
      }
    } catch (err: any) {
      console.error('Error registering expense:', err);
      setError(err.message || 'Error al registrar el egreso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Registrar Egreso o Retiro</h2>
      
      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Monto */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Monto *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign size={18} className="text-gray-400" />
              </div>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          
          {/* Descripción */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Pago a proveedor, Retiro de efectivo, etc."
              required
            />
          </div>
          
          {/* Categoría */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="withdrawal">Retiro</option>
              <option value="supplier">Pago a Proveedor</option>
              <option value="services">Servicios</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="salary">Sueldos</option>
              <option value="other">Otro</option>
            </select>
          </div>
          
          {/* Método de pago */}
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CreditCard size={18} className="text-gray-400" />
              </div>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta de débito/crédito</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          
          {/* Fecha */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                id="date"
                name="date"
                value={selectedDate}
                disabled
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Los egresos se registran para la fecha seleccionada en la caja diaria
            </p>
          </div>
          
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
                rows={2}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Información adicional sobre este egreso"
              />
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
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {loading ? 'Guardando...' : 'Registrar Egreso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;