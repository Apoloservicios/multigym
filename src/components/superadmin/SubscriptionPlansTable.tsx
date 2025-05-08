// src/components/superadmin/SubscriptionPlansTable.tsx
import React, { useState } from 'react';
import { Edit, Trash, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { SubscriptionPlan } from '../../types/superadmin.types';
import { formatCurrency } from '../../utils/formatting.utils';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';

interface SubscriptionPlansTableProps {
  plans: SubscriptionPlan[];
  onEdit: (plan: SubscriptionPlan) => void;
  onDelete: (planId: string) => void;
}

const SubscriptionPlansTable: React.FC<SubscriptionPlansTableProps> = ({ plans, onEdit, onDelete }) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleDeleteClick = (planId: string) => {
    setSelectedPlanId(planId);
    setShowDeleteConfirmation(true);
  };
  
  const confirmDelete = () => {
    if (selectedPlanId) {
      onDelete(selectedPlanId);
      setShowDeleteConfirmation(false);
      setSelectedPlanId(null);
    }
  };
  
  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
    setSelectedPlanId(null);
  };
  
  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-500">No hay planes de suscripción disponibles</div>
      </div>
    );
  }
  
  const selectedPlan = plans.find(plan => plan.id === selectedPlanId);
  
  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {error && (
          <div className="bg-red-100 border-b border-red-300 text-red-700 px-4 py-3 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map(plan => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{plan.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 line-clamp-2">{plan.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {plan.duration} días
                      {plan.duration === 30 && ' (1 mes)'}
                      {plan.duration === 90 && ' (3 meses)'}
                      {plan.duration === 180 && ' (6 meses)'}
                      {plan.duration === 365 && ' (1 año)'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(plan.price)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {plan.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle size={12} className="mr-1" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircle size={12} className="mr-1" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onEdit(plan)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Editar plan"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(plan.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar plan"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirmation && selectedPlan && (
        <DeleteConfirmationModal
          title="Eliminar Plan de Suscripción"
          message={`¿Estás seguro de que deseas eliminar el plan "${selectedPlan.name}"? Esta acción no se puede deshacer.`}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
};

export default SubscriptionPlansTable;