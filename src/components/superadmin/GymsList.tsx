import React, { useState, useEffect } from 'react';
import { 
  Edit, Trash, MoreHorizontal, AlertTriangle, CheckCircle, XCircle, 
  Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { Gym } from '../../types/superadmin.types';
import { formatDate } from '../../utils/date.utils';
import superadminService from '../../services/superadmin.service';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import { toJsDate } from '../../utils/date.utils';

interface GymsListProps {
  gyms: Gym[];
  onEdit?: (gym: Gym) => void;
  showActions?: boolean;
  onGymUpdated?: (gym: Gym) => void;
  limit?: number;
  sortBy?: 'recent' | 'name' | 'status';
}

const GymsList: React.FC<GymsListProps> = ({ 
  gyms: externalGyms = [], 
  onEdit, 
  showActions = false,
  onGymUpdated,
  limit,
  sortBy = 'recent'
}) => {
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [gyms, setGyms] = useState<Gym[]>(externalGyms);
  
  // Cargar gimnasios si no se proporcionan externamente
  useEffect(() => {
    if (externalGyms.length === 0) {
      loadGyms();
    } else {
      setGyms(externalGyms);
      setLoading(false);
    }
  }, [externalGyms]);
  
  const loadGyms = async () => {
    setLoading(true);
    try {
      const loadedGyms = await superadminService.getGyms();
      setGyms(loadedGyms);
    } catch (err: any) {
      console.error('Error loading gyms:', err);
      setError('Error al cargar los gimnasios');
    } finally {
      setLoading(false);
    }
  };
  
  // Ordenar y limitar gimnasios si es necesario
  const getSortedGyms = () => {
    let sortedGyms = [...gyms];
    
    if (sortBy === 'recent') {
        sortedGyms.sort((a, b) => {
            const dateA = a.registrationDate ? toJsDate(a.registrationDate) : new Date(0);
            const dateB = b.registrationDate ? toJsDate(b.registrationDate) : new Date(0);
            // Asegurarse de que ambos valores existan antes de usar getTime()
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            return timeB - timeA;
          });
    } else if (sortBy === 'name') {
      sortedGyms.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'status') {
      // Ordenar por estado: active, trial, suspended
      const statusOrder: Record<string, number> = {
        'active': 0,
        'trial': 1,
        'suspended': 2
      };
      sortedGyms.sort((a, b) => {
        const aOrder = statusOrder[a.status] || 99;
        const bOrder = statusOrder[b.status] || 99;
        return aOrder - bOrder;
      });
    }
    
    return limit ? sortedGyms.slice(0, limit) : sortedGyms;
  };
  
  const displayedGyms = getSortedGyms();
  
  const handleStatusChange = async (gym: Gym, newStatus: 'active' | 'trial' | 'suspended') => {
    setLoading(true);
    setError(null);
    
    try {
      await superadminService.updateGymStatus(gym.id, newStatus);
      
      // Actualizar localmente
      const updatedGym = { ...gym, status: newStatus };
      
      if (onGymUpdated) {
        onGymUpdated(updatedGym);
      }
      
      // Cerrar menú de acciones
      setShowActionMenu(null);
    } catch (err: any) {
      console.error('Error updating gym status:', err);
      setError(err.message || 'Error al actualizar el estado del gimnasio');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Activo
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock size={12} className="mr-1" />
            En Prueba
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Suspendido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertCircle size={12} className="mr-1" />
            Desconocido
          </span>
        );
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
        <AlertTriangle className="h-5 w-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }
  
  if (displayedGyms.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-500">No hay gimnasios disponibles</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gimnasio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Propietario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suscripción</th>
              {showActions && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedGyms.map((gym) => (
              <tr key={gym.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{gym.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{gym.owner}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{gym.email}</div>
                  <div className="text-xs text-gray-500">{gym.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(gym.registrationDate)}</div>
                  {gym.status === 'trial' && gym.trialEndsAt && (
                    <div className="text-xs text-gray-500">
                      Prueba hasta: {formatDate(gym.trialEndsAt)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(gym.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {gym.subscriptionData ? (
                    <div>
                      <div className="text-sm text-gray-900">{gym.subscriptionData.plan}</div>
                      <div className="text-xs text-gray-500">
                        Vence: {formatDate(gym.subscriptionData.endDate)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Sin suscripción</span>
                  )}
                </td>
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(gym)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Editar gimnasio"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => setShowActionMenu(showActionMenu === gym.id ? null : gym.id)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Más acciones"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {showActionMenu === gym.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                            {gym.status !== 'active' && (
                              <button
                                onClick={() => handleStatusChange(gym, 'active')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                disabled={loading}
                              >
                                {loading ? (
                                  <RefreshCw size={14} className="inline mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle size={14} className="inline mr-2 text-green-500" />
                                )}
                                Marcar como activo
                              </button>
                            )}
                            {gym.status !== 'trial' && (
                              <button
                                onClick={() => handleStatusChange(gym, 'trial')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                disabled={loading}
                              >
                                {loading ? (
                                  <RefreshCw size={14} className="inline mr-2 animate-spin" />
                                ) : (
                                  <Clock size={14} className="inline mr-2 text-blue-500" />
                                )}
                                Iniciar período de prueba
                              </button>
                            )}
                            {gym.status !== 'suspended' && (
                              <button
                                onClick={() => handleStatusChange(gym, 'suspended')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                disabled={loading}
                              >
                                {loading ? (
                                  <RefreshCw size={14} className="inline mr-2 animate-spin" />
                                ) : (
                                  <XCircle size={14} className="inline mr-2 text-red-500" />
                                )}
                                Suspender gimnasio
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedGym(gym);
                                setShowDeleteConfirmation(true);
                                setShowActionMenu(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            >
                              <Trash size={14} className="inline mr-2" />
                              Eliminar gimnasio
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirmation && selectedGym && (
        <DeleteConfirmationModal
          title="Eliminar Gimnasio"
          message={`¿Estás seguro de que deseas eliminar el gimnasio "${selectedGym.name}"? Esta acción no se puede deshacer.`}
          onCancel={() => {
            setShowDeleteConfirmation(false);
            setSelectedGym(null);
          }}
          onConfirm={() => {
            // Aquí irá la lógica para eliminar el gimnasio
            console.log('Eliminar gimnasio:', selectedGym.id);
            setShowDeleteConfirmation(false);
            setSelectedGym(null);
          }}
        />
      )}
    </div>
  );
};

export default GymsList;