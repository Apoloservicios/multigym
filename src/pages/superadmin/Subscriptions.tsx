// src/pages/superadmin/Subscriptions.tsx
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, RefreshCw, Check, X, AlertCircle, CreditCard, CheckCircle 
} from 'lucide-react';
import { 
  getSubscriptionPlans, 
  createSubscriptionPlan, 
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getGymSubscriptions 
} from '../../services/superadmin.service';
import { 
  SubscriptionPlan, 
  GymSubscription 
} from '../../types/superadmin.types';
import SubscriptionPlansTable from '../../components/superadmin/SubscriptionPlansTable';
import SubscriptionPlanModal from '../../components/superadmin/SubscriptionPlanModal';
import SubscriptionsList from '../../components/superadmin/SubscriptionsList';
import PaymentModal from '../../components/superadmin/PaymentModal';
import { formatCurrency } from '../../utils/formatting.utils';

const SubscriptionsManager: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<GymSubscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<GymSubscription[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<GymSubscription | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Aplicar filtros cuando cambian
  useEffect(() => {
    if (!subscriptions.length) {
      setFilteredSubscriptions([]);
      return;
    }

    let result = subscriptions;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(subscription =>
        subscription.planName.toLowerCase().includes(search) ||
        subscription.gymName.toLowerCase().includes(search)
      );
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      result = result.filter(subscription => subscription.status === statusFilter);
    }

    setFilteredSubscriptions(result);
  }, [subscriptions, searchTerm, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Cargar planes de suscripción
      const plansData = await getSubscriptionPlans();
      setPlans(plansData);

      // Cargar suscripciones activas
      const subscriptionsData = await getGymSubscriptions();
      setSubscriptions(subscriptionsData);
      setFilteredSubscriptions(subscriptionsData);
    } catch (err: any) {
      console.error('Error loading subscription data:', err);
      setError('Error al cargar los datos de suscripciones. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenPlanModal = (plan: SubscriptionPlan | null = null) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleOpenPaymentModal = (subscription: GymSubscription) => {
    setSelectedSubscription(subscription);
    setIsPaymentModalOpen(true);
  };

  const handlePlanSaved = async (plan: SubscriptionPlan) => {
    try {
      if (plan.id) {
        // Actualizar plan existente
        await updateSubscriptionPlan(plan.id, plan);
        
        // Actualizar lista local
        setPlans(prevPlans => 
          prevPlans.map(p => p.id === plan.id ? plan : p)
        );
      } else {
        // Crear nuevo plan
        const newPlan = await createSubscriptionPlan(plan);
        
        // Agregar a lista local
        setPlans(prevPlans => [...prevPlans, newPlan]);
      }
      
      setIsModalOpen(false);
      setSuccess(`Plan "${plan.name}" guardado correctamente`);
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving subscription plan:', err);
      setError('Error al guardar el plan de suscripción. Por favor, intente de nuevo.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deleteSubscriptionPlan(planId);
      
      // Eliminar de lista local
      setPlans(prevPlans => prevPlans.filter(p => p.id !== planId));
      
      setSuccess('Plan eliminado correctamente');
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error deleting subscription plan:', err);
      setError('Error al eliminar el plan de suscripción. Por favor, intente de nuevo.');
    }
  };

  const handlePaymentProcessed = () => {
    // Volver a cargar las suscripciones después de procesar un pago
    loadData();
    setIsPaymentModalOpen(false);
    setSuccess('Pago procesado correctamente');
    
    // Ocultar mensaje después de 3 segundos
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Suscripciones</h1>
          <p className="text-gray-600">Administra los planes y suscripciones de gimnasios</p>
        </div>

        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 border rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {activeTab === 'plans' && (
            <button
              onClick={() => handleOpenPlanModal()}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} className="mr-2" />
              Nuevo Plan
            </button>
          )}
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="mb-6 border-b">
        <div className="flex">
          <button
            className={`py-3 px-6 ${
              activeTab === 'plans'
                ? 'border-b-2 border-blue-600 font-semibold text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('plans')}
          >
            Planes de Suscripción
          </button>
          <button
            className={`py-3 px-6 ${
              activeTab === 'subscriptions'
                ? 'border-b-2 border-blue-600 font-semibold text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Suscripciones Activas
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

      {/* Filtros para suscripciones */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por gimnasio o plan"
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
                <option value="pending">Pendientes</option>
                <option value="expired">Expirados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Mostrar tabla de planes o lista de suscripciones según tab activo */}
          {activeTab === 'plans' ? (
            <SubscriptionPlansTable 
              plans={plans} 
              onEdit={handleOpenPlanModal}
              onDelete={handleDeletePlan}
            />
          ) : (
            <SubscriptionsList 
              subscriptions={filteredSubscriptions}
              onProcessPayment={handleOpenPaymentModal}
              onRefresh={handleRefresh}
            />
          )}
        </>
      )}

      {/* Modal para crear/editar plan */}
      {isModalOpen && (
        <SubscriptionPlanModal
          plan={selectedPlan}
          onClose={() => setIsModalOpen(false)}
          onSave={handlePlanSaved}
        />
      )}

      {/* Modal para procesar pagos */}
      {isPaymentModalOpen && selectedSubscription && (
        <PaymentModal
          subscription={selectedSubscription}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentProcessed={handlePaymentProcessed}
        />
      )}
    </div>
  );
};

export default SubscriptionsManager;