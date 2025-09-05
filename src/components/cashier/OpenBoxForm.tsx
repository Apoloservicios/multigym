// src/components/cashier/OpenBoxForm.tsx - CORREGIDO PARA FECHAS ARGENTINA

import React, { useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { formatDateForDisplay } from '../../utils/timezone.utils';
import useAuth from '../../hooks/useAuth';

interface OpenBoxFormProps {
  selectedDate: string;
  isReopening: boolean;
  onOpen: (openingAmount: number, notes: string) => void;
  onCancel: () => void;
}

const OpenBoxForm: React.FC<OpenBoxFormProps> = ({
  selectedDate,
  isReopening,
  onOpen,
  onCancel
}) => {
  const [openingAmount, setOpeningAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  console.log('🔓 OpenBoxForm - Datos recibidos:', {
    selectedDate,
    isReopening,
    formattedDate: formatDateForDisplay(selectedDate)
  });

const { gymData, userData } = useAuth();
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onOpen(openingAmount, notes);
};

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">
        {isReopening ? 'Reabrir Caja' : 'Abrir Caja'} - {formatDateForDisplay(selectedDate)}
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="openingAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Monto Inicial *
            </label>
            <input
              type="number"
              id="openingAmount"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Ingrese el monto con el que inicia la caja
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Agregar notas o comentarios sobre la apertura de caja"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <X size={18} className="inline mr-1" />
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <CheckCircle size={18} className="inline mr-1" />
            {isReopening ? 'Reabrir Caja' : 'Abrir Caja'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OpenBoxForm;