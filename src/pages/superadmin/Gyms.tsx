// src/pages/superadmin/Gyms.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, Building2, CheckCircle, Clock, XCircle, CreditCard } from 'lucide-react';
import GymsList from '../../components/superadmin/GymsList';
import GymFormModal from '../../components/superadmin/GymFormModal';
import AssignSubscriptionModal from '../../components/superadmin/AssignSubscriptionModal';
import { Gym } from '../../types/superadmin.types';
import superadminService from '../../services/superadmin.service';
import { useNavigate } from 'react-router-dom';

const GymsManager: React.FC = () => {
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [filteredGyms, setFilteredGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [selectedGymForSubscription, setSelectedGymForSubscription] = useState<Gym | null>(null);
  
  // Estadísticas de los gimnasios
  const [stats, setStats] = useState({
    totalGyms: 0,
    activeGyms: 0,
    trialGyms: 0,
    suspendedGyms: 0
  });
  
  useEffect(() => {
    loadGyms();
  }, []);
  
  useEffect(() => {
    // Aplicar filtros
    let result = gyms;
    
    // Filtrar por búsqueda
    if (searchTerm) {
      result = result.filter(gym => 
        gym.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gym.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gym.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrar por estado
    if (statusFilter !== 'all') {
      result = result.filter(gym => gym.status === statusFilter);
    }
    
    setFilteredGyms(result);
    
    // Actualizar estadísticas
    const newStats = {
      totalGyms: gyms.length,
      activeGyms: gyms.filter(g => g.status === 'active').length,
      trialGyms: gyms.filter(g => g.status === 'trial').length,
      suspendedGyms: gyms.filter(g => g.status === 'suspended').length
    };
    setStats(newStats);
  }, [gyms, searchTerm, statusFilter]);
  
  const loadGyms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const gymsList = await superadminService.getGyms();
      setGyms(gymsList);
    } catch (err: any) {
      console.error('Error loading gyms:', err);
      setError('Error al cargar los gimnasios');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (gym: Gym) => {
    setSelectedGym(gym);
    setShowModal(true);
  };
  
  const handleSave = async (gym: Gym) => {
    try {
      if (selectedGym) {
        // Actualizar gimnasio existente
        await superadminService.updateGym(selectedGym.id, gym);
      } else {
        // Crear nuevo gimnasio
        await superadminService.createGym(gym);
      }
      
      // Recargar la lista
      await loadGyms();
      setShowModal(false);
      setSelectedGym(null);
    } catch (err: any) {
      console.error('Error saving gym:', err);
      setError(err.message || 'Error al guardar el gimnasio');
    }
  };
  
  const handleGymUpdated = (updatedGym: Gym) => {
    setGyms(prev => prev.map(gym => gym.id === updatedGym.id ? updatedGym : gym));
  };
  
  const handleViewAccount = (gym: Gym) => {
    navigate(`/superadmin/gym-account?gymId=${gym.id}`);
  };
  
  const handleAssignSubscription = (gym: Gym) => {
    setSelectedGymForSubscription(gym);
    setShowSubscriptionModal(true);
  };
  
  const handleSubscriptionAssigned = async () => {
    await loadGyms();
    setShowSubscriptionModal(false);
    setSelectedGymForSubscription(null);
  };
  
  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };
  
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Gimnasios</h1>
          <p className="text-gray-600">Administra los gimnasios registrados en el sistema</p>
        </div>
        
        <button 
          onClick={() => {
            setSelectedGym(null);
            setShowModal(true);
          }}
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nuevo Gimnasio
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Gimnasios</p>
              <p className="text-2xl font-bold">{stats.totalGyms}</p>
            </div>
            <Building2 className="h-8 w-8 text-gray-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Activos</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeGyms}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Prueba</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trialGyms}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Suspendidos</p>
              <p className="text-2xl font-bold text-red-600">{stats.suspendedGyms}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>
      
      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, propietario o email..."
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="trial">En Prueba</option>
              <option value="suspended">Suspendidos</option>
            </select>
            
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
            >
              <RefreshCw size={18} className="mr-2" />
              Limpiar
            </button>
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
          onEdit={handleEdit} 
          showActions={true}
          onGymUpdated={handleGymUpdated}
          onViewAccount={handleViewAccount}
          onAssignSubscription={handleAssignSubscription}
        />
      )}
      
      {/* Modal de formulario */}
      {showModal && (
        <GymFormModal
          gym={selectedGym}
          onClose={() => {
            setShowModal(false);
            setSelectedGym(null);
          }}
          onSave={handleSave}
        />
      )}
      
      {/* Modal de asignación de suscripción */}
      {showSubscriptionModal && selectedGymForSubscription && (
        <AssignSubscriptionModal
          gym={selectedGymForSubscription}
          onClose={() => {
            setShowSubscriptionModal(false);
            setSelectedGymForSubscription(null);
          }}
          onAssigned={handleSubscriptionAssigned}
        />
      )}
    </div>
  );
};

export default GymsManager;