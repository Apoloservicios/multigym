import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, AlertTriangle, CheckCircle, Users, UserPlus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  memberNumber: number;
  hasMembership: boolean;
  activeMemberships: Array<{
    id: string;
    activityName: string;
    startDate: string;
    status: string;
  }>;
}

interface Activity {
  id: string;
  name: string;
}

const MembershipAssignmentControl = () => {
  const { gymData } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'withMembership' | 'withoutMembership'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    withMembership: 0,
    withoutMembership: 0,
    percentage: 0
  });

  useEffect(() => {
    if (gymData?.id) {
      loadData();
    }
  }, [gymData?.id]);

  const loadData = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    try {
      // 1. Cargar actividades
      const activitiesRef = collection(db, `gyms/${gymData.id}/activities`);
      const activitiesSnapshot = await getDocs(activitiesRef);
      const activitiesData: Activity[] = [];
      
      activitiesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive) {
          activitiesData.push({
            id: doc.id,
            name: data.name
          });
        }
      });
      setActivities(activitiesData);

      // 2. Cargar todos los socios
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersQuery = query(membersRef, orderBy('firstName', 'asc'));
      const membersSnapshot = await getDocs(membersQuery);

      const membersData: Member[] = [];
      let withMembershipCount = 0;

      // 3. Para cada socio, buscar sus membresías activas
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        const activeMemberships: Array<{
          id: string;
          activityName: string;
          startDate: string;
          status: string;
        }> = [];

        membershipsSnapshot.forEach((memDoc) => {
          const memData = memDoc.data();
          if (memData.status === 'active') {
            activeMemberships.push({
              id: memDoc.id,
              activityName: memData.activityName || 'Sin nombre',
              startDate: memData.startDate || '',
              status: memData.status
            });
          }
        });

        const hasMembership = activeMemberships.length > 0;
        if (hasMembership) {
          withMembershipCount++;
        }

        membersData.push({
          id: memberDoc.id,
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          phone: memberData.phone || '',
          memberNumber: memberData.memberNumber || 0,
          hasMembership,
          activeMemberships
        });
      }

      setMembers(membersData);
      setStats({
        total: membersData.length,
        withMembership: withMembershipCount,
        withoutMembership: membersData.length - withMembershipCount,
        percentage: membersData.length > 0 ? Math.round((withMembershipCount / membersData.length) * 100) : 0
      });

    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (member: Member) => {
    setSelectedMember(member);
    setSelectedActivity('');
    setShowAssignModal(true);
  };

  const assignMembership = async () => {
    if (!selectedMember || !selectedActivity || !gymData?.id) {
      alert('Por favor selecciona una actividad');
      return;
    }

    setAssignLoading(true);
    try {
      const activity = activities.find(a => a.id === selectedActivity);
      if (!activity) return;

      const membershipData = {
        memberId: selectedMember.id,
        memberName: `${selectedMember.firstName} ${selectedMember.lastName}`,
        activityId: selectedActivity,
        activityName: activity.name,
        startDate: new Date().toISOString().split('T')[0],
        status: 'active',
        autoGeneratePayments: true,
        createdAt: serverTimestamp()
      };

      await addDoc(
        collection(db, `gyms/${gymData.id}/members/${selectedMember.id}/memberships`),
        membershipData
      );

      alert(`✅ Membresía de ${activity.name} asignada correctamente a ${selectedMember.firstName} ${selectedMember.lastName}`);
      setShowAssignModal(false);
      
      loadData();

    } catch (error) {
      console.error('Error asignando membresía:', error);
      alert('Error al asignar la membresía');
    } finally {
      setAssignLoading(false);
    }
  };

  // Filtrar y buscar
  const filteredMembers = members.filter(member => {
    // Filtro por estado
    if (filter === 'withMembership' && !member.hasMembership) return false;
    if (filter === 'withoutMembership' && member.hasMembership) return false;
    
    // Búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const memberNum = member.memberNumber.toString();
      const email = member.email.toLowerCase();
      const phone = member.phone.toLowerCase();
      
      return fullName.includes(search) || 
             memberNum.includes(search) || 
             email.includes(search) ||
             phone.includes(search);
    }
    
    return true;
  });

  // Paginación
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  // Resetear página al cambiar filtro o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  if (!gymData?.id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          Cargando información del gimnasio...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Control de Membresías
        </h1>
        <p className="text-gray-600">
          Gestiona qué socios tienen membresías asignadas
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Membresía</p>
              <p className="text-3xl font-bold text-green-600">{stats.withMembership}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sin Membresía</p>
              <p className="text-3xl font-bold text-red-600">{stats.withoutMembership}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">% Con Membresía</p>
              <p className="text-3xl font-bold text-purple-600">{stats.percentage}%</p>
            </div>
            <CreditCard className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Barra de búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, N° socio, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilter('withMembership')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'withMembership'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Con Membresía ({stats.withMembership})
            </button>
            <button
              onClick={() => setFilter('withoutMembership')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filter === 'withoutMembership'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Membresía ({stats.withoutMembership})
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="mt-3 text-sm text-gray-600">
          Mostrando {currentMembers.length} de {filteredMembers.length} resultados
        </div>
      </div>

      {/* Tabla de socios */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  N° Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Membresías Activas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{member.memberNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {member.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {member.phone}
                  </td>
                  <td className="px-6 py-4">
                    {member.activeMemberships.length > 0 ? (
                      <div className="space-y-1">
                        {member.activeMemberships.map((membership) => (
                          <div key={membership.id} className="text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {membership.activityName}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Sin membresías</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.hasMembership ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sin membresía
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openAssignModal(member)}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Asignar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay socios para mostrar con este filtro</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            
            {/* Números de página */}
            <div className="flex gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = idx + 1;
                } else if (currentPage <= 3) {
                  pageNum = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + idx;
                } else {
                  pageNum = currentPage - 2 + idx;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de asignación */}
      {showAssignModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Asignar Membresía
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Socio:</p>
              <p className="text-lg font-medium text-gray-800">
                {selectedMember.firstName} {selectedMember.lastName}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Actividad:
              </label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccionar --</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={assignLoading}
              >
                Cancelar
              </button>
              <button
                onClick={assignMembership}
                disabled={!selectedActivity || assignLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {assignLoading ? 'Asignando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipAssignmentControl;