import React, { useState } from 'react';
import { Globe, CheckCircle, XCircle, Info, RefreshCw, BarChart2, Users } from 'lucide-react';

type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'pending';

interface GymData {
  id: number;
  name: string;
  owner: string;
  email: string;
  phone: string;
  registrationDate: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionType: string;
  expirationDate: string;
  activeMembers: number;
}

const SubscriptionBadge: React.FC<{ status: SubscriptionStatus }> = ({ status }) => {
  const statusStyles = {
    active: "bg-green-100 text-green-800",
    trial: "bg-blue-100 text-blue-800",
    expired: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800"
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status] || "bg-gray-100 text-gray-800"}`}>
      {status === 'active' && 'Activa'}
      {status === 'trial' && 'Prueba'}
      {status === 'expired' && 'Expirada'}
      {status === 'pending' && 'Pendiente'}
    </span>
  );
};

const AdminPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedGym, setSelectedGym] = useState<GymData | null>(null);
  
  // Datos de ejemplo
  const gyms: GymData[] = [
    {
      id: 1,
      name: 'Muscle Man',
      owner: 'Juan Pérez',
      email: 'info@musclenegocio.com',
      phone: '2604515854',
      registrationDate: '10/03/2025',
      subscriptionStatus: 'active',
      subscriptionType: 'mensual',
      expirationDate: '10/04/2025',
      activeMembers: 42
    },
    {
      id: 2,
      name: 'Fitness Center',
      owner: 'María González',
      email: 'info@fitnesscenter.com',
      phone: '2604789123',
      registrationDate: '15/03/2025',
      subscriptionStatus: 'trial',
      subscriptionType: '',
      expirationDate: '25/03/2025',
      activeMembers: 15
    },
    {
      id: 3,
      name: 'Power Gym',
      owner: 'Carlos Rodríguez',
      email: 'info@powergym.com',
      phone: '2604321654',
      registrationDate: '01/02/2025',
      subscriptionStatus: 'expired',
      subscriptionType: 'trimestral',
      expirationDate: '01/03/2025',
      activeMembers: 78
    }
  ];
  
  // Planes de suscripción
  const subscriptionPlans = [
    { id: 'mensual', name: 'Mensual', price: 5000, duration: 30 },
    { id: 'trimestral', name: 'Trimestral', price: 13500, duration: 90 },
    { id: 'semestral', name: 'Semestral', price: 25000, duration: 180 },
    { id: 'anual', name: 'Anual', price: 45000, duration: 365 }
  ];
  
  // Filtrar gimnasios según la búsqueda
  const filteredGyms = gyms.filter(gym => 
    gym.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gym.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gym.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleAssignSubscription = (gym: GymData) => {
    setSelectedGym(gym);
    setShowModal(true);
  };
  
  // Función para convertir fechas en formato dd/mm/yyyy a objetos Date para comparación
  const parseDate = (dateString: string): Date => {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
      
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Gimnasios</p>
              <h2 className="text-3xl font-bold mt-2">{gyms.length}</h2>
            </div>
            <div className="text-2xl p-3 rounded-full bg-blue-100 text-blue-600">
              <Globe size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Suscripciones Activas</p>
              <h2 className="text-3xl font-bold mt-2">{gyms.filter(gym => gym.subscriptionStatus === 'active').length}</h2>
            </div>
            <div className="text-2xl p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">En Período de Prueba</p>
              <h2 className="text-3xl font-bold mt-2">{gyms.filter(gym => gym.subscriptionStatus === 'trial').length}</h2>
            </div>
            <div className="text-2xl p-3 rounded-full bg-blue-100 text-blue-600">
              <Info size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Expiradas</p>
              <h2 className="text-3xl font-bold mt-2">{gyms.filter(gym => gym.subscriptionStatus === 'expired').length}</h2>
            </div>
            <div className="text-2xl p-3 rounded-full bg-red-100 text-red-600">
              <XCircle size={20} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Gimnasios con próximo vencimiento */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Próximos Vencimientos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gyms
            .filter(gym => gym.subscriptionStatus === 'active' || gym.subscriptionStatus === 'trial')
            .sort((a, b) => parseDate(a.expirationDate).getTime() - parseDate(b.expirationDate).getTime())
            .slice(0, 3)
            .map(gym => (
              <div key={gym.id} className="border rounded-md p-4 relative">
                <div className="absolute top-4 right-4">
                  <SubscriptionBadge status={gym.subscriptionStatus} />
                </div>
                <h3 className="font-medium">{gym.name}</h3>
                <p className="text-sm text-gray-500">Vence: {gym.expirationDate}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm">{gym.subscriptionType || 'Sin plan'}</span>
                  <button 
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                    onClick={() => handleAssignSubscription(gym)}
                  >
                    <RefreshCw className="inline mr-1" size={16} />
                    Renovar
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
      
      {/* Lista de gimnasios */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar gimnasio por nombre, propietario o email..."
                className="w-full pl-4 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="trial">En prueba</option>
              <option value="expired">Expirados</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gimnasio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Propietario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Registro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Suscripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socios Activos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGyms.map((gym) => (
                <tr key={gym.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{gym.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{gym.owner}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>{gym.email}</div>
                    <div className="text-sm text-gray-500">{gym.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{gym.registrationDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SubscriptionBadge status={gym.subscriptionStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {gym.subscriptionType || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {gym.expirationDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {gym.activeMembers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button 
                        className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                        onClick={() => handleAssignSubscription(gym)}
                      >
                        {gym.subscriptionStatus === 'active' ? 'Renovar' : 'Asignar Plan'}
                      </button>
                      <button className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                        <BarChart2 className="inline mr-1" size={16} />
                        Estadísticas
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal de asignación de suscripción */}
      {showModal && selectedGym && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Asignar Plan de Suscripción</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <div className="mb-4">
              <p className="font-medium">{selectedGym.name}</p>
              <p className="text-sm text-gray-500">Propietario: {selectedGym.owner}</p>
              {selectedGym.subscriptionStatus !== 'trial' && (
                <p className="text-sm text-gray-500">
                  Plan actual: {selectedGym.subscriptionType || 'Sin plan'} - Vence: {selectedGym.expirationDate}
                </p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Plan</label>
              <select className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccione un plan</option>
                {subscriptionPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name} - ${plan.price} - {plan.duration} días</option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
              <input type="date" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <select className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="transfer">Transferencia Bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta de Crédito/Débito</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3}></textarea>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm">
                Cancelar
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;