// src/components/memberships/AssignMembershipModal.tsx
// 🎯 MODAL PARA ASIGNAR MEMBRESÍAS (NUEVO SISTEMA)

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { assignMembershipToMember } from '../../services/membershipAssignment.service';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Activity {
  id: string;
  name: string;
  cost: number;
  description: string;
  isActive: boolean;
}

interface AssignMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    firstName: string;
    lastName: string;
  };
  onSuccess?: () => void;
}

const AssignMembershipModal: React.FC<AssignMembershipModalProps> = ({
  isOpen,
  onClose,
  member,
  onSuccess
}) => {
  const { gymData } = useAuth();

  // Estados
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Cargar actividades al abrir
  useEffect(() => {
    if (isOpen && gymData?.id) {
      loadActivities();
      // Fecha de hoy por defecto
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, gymData?.id]);

  /**
   * 📋 Cargar actividades disponibles
   */
  const loadActivities = async () => {
    if (!gymData?.id) return;

    setLoadingActivities(true);
    try {
      const activitiesRef = collection(db, `gyms/${gymData.id}/activities`);
      const snapshot = await getDocs(activitiesRef);

      const activitiesList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Activity))
        .filter(activity => activity.isActive); // Solo activas

      setActivities(activitiesList);
    } catch (error) {
      console.error('Error cargando actividades:', error);
      setError('Error al cargar actividades');
    } finally {
      setLoadingActivities(false);
    }
  };

  /**
   * ✅ Asignar membresía
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id || !selectedActivityId) {
      setError('Selecciona una actividad');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Buscar datos de la actividad seleccionada
      const activity = activities.find(a => a.id === selectedActivityId);
      if (!activity) {
        throw new Error('Actividad no encontrada');
      }

      // Asignar la membresía
      const result = await assignMembershipToMember({
        gymId: gymData.id,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        activityId: activity.id,
        activityName: activity.name,
        activityCost: activity.cost,
        startDate
      });

      if (result.success) {
        setSuccess(true);
        
        // Mostrar mensaje informativo sobre el pago
        const startDay = new Date(startDate).getDate();
        const paymentMonth = startDay > 15 ? 'el mes siguiente' : 'este mes';
        
        setTimeout(() => {
          alert(
            `✅ Membresía asignada correctamente!\n\n` +
            `🎯 Actividad: ${activity.name}\n` +
            `💰 Costo mensual: $${activity.cost}\n` +
            `📅 Primer pago: ${paymentMonth}\n` +
            `📆 Vencimiento: Día 15 de cada mes`
          );
          
          onSuccess?.();
          onClose();
        }, 500);
      } else {
        setError(result.error || 'Error al asignar membresía');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Error al asignar membresía');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🧹 Limpiar al cerrar
   */
  const handleClose = () => {
    setSelectedActivityId('');
    setStartDate('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Asignar Membresía
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {member.firstName} {member.lastName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seleccionar actividad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actividad *
            </label>
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">
                No hay actividades disponibles
              </div>
            ) : (
              <select
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar actividad...</option>
                {activities.map(activity => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name} - ${activity.cost}/mes
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha de inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {startDate && (
              <p className="text-xs text-gray-500 mt-1">
                {new Date(startDate).getDate() > 15 ? (
                  <>
                    ⚠️ Inicia después del día 15: <strong>pagará desde el mes siguiente</strong>
                  </>
                ) : (
                  <>
                    ✅ Inicia antes del día 15: <strong>pagará este mes</strong>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Info importante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Información importante:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Vencimiento: <strong>Día 15</strong> de cada mes</li>
                  <li>El pago se generará automáticamente</li>
                  <li>Precio puede variar mes a mes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mensajes */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">¡Membresía asignada correctamente!</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedActivityId || !startDate}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                'Asignar Membresía'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignMembershipModal;