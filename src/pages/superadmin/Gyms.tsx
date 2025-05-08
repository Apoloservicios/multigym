// src/pages/superadmin/Gyms.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, Check, X, AlertCircle } from 'lucide-react';
import GymsList from '../../components/superadmin/GymsList';
import GymFormModal from '../../components/superadmin/GymFormModal';
import { getGyms } from '../../services/superadmin.service';
import { Gym } from '../../types/superadmin.types';

const GymsManager: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [filteredGyms, setFilteredGyms] = useState<Gym[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadGyms();
  }, []);

  // Aplicar filtros cuando cambian
  useEffect(() => {
    if (!gyms.length) {
      setFilteredGyms([]);
      return;
    }

    let result = gyms;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(gym =>
        gym.name.toLowerCase().includes(search) ||
        gym.owner.toLowerCase().includes(search) ||
        gym.email.toLowerCase().includes(search) ||
        (gym.phone && gym.phone.includes(search))
      );
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      result = result.filter(gym => gym.status === statusFilter);
    }

    setFilteredGyms(result);
  }, [gyms, searchTerm, statusFilter]);

  const loadGyms = async () => {
    setLoading(true);
    setError(null);

    try {
      const gymsData = await getGyms();
      setGyms(gymsData);
      setFilteredGyms(gymsData);
    } catch (err: any) {
      console.error('Error loading gyms:', err);
      setError('Error al cargar los gimnasios. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGyms();
    setRefreshing(false);
  };

  const handleOpenModal = (gym: Gym | null = null) => {
    setSelectedGym(gym);
    setIsModalOpen(true);
  };

  const handleGymSaved = (gym: Gym) => {
    // Actualizar la lista de gimnasios después de guardar
    if (gym.id && gyms.find(g => g.id === gym.id)) {
      // Actualización
      setGyms(prev => prev.map(g => g.id === gym.id ? gym : g));
    } else {
      // Nuevo gimnasio
      setGyms(prev => [...prev, gym]);
    }
    
    setIsModalOpen(false);
    setSuccess(`Gimnasio ${gym.name} guardado correctamente`);
    
    // Ocultar mensaje después de 3 segundos
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Gimnasios</h1>
          <p className="text-gray-600">Administra los gimnasios registrados en el sistema</p>
        </div>

        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 border rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={16} className="mr-2" />
            Nuevo Gimnasio
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex items-center">
          <Check size={20} className="mr-2" />
          {success}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, propietario, email o teléfono"
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center">
            <div className="mr-2">
              <Filter size={18} className="text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="trial">En prueba</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de gimnasios */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <GymsList 
          gyms={filteredGyms} 
          onEdit={handleOpenModal}
          showActions={true}
          onGymUpdated={handleGymSaved}
        />
      )}

      {/* Modal para crear/editar gimnasio */}
      {isModalOpen && (
        <GymFormModal
          gym={selectedGym}
          onClose={() => setIsModalOpen(false)}
          onSave={handleGymSaved}
        />
      )}
    </div>
  );
};

export default GymsManager;