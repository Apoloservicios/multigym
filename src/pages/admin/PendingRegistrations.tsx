// src/pages/admin/PendingRegistrations.tsx
// ✅ MEJORA: Ahora permite asignar membresía antes de aprobar un nuevo registro

import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, XCircle, Clock, Search, 
  AlertCircle, Mail, Phone, Loader, Eye, Trash2, 
  ChevronLeft, ChevronRight, RefreshCw, CreditCard
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { getNextMemberNumber } from '../../services/member.service';

interface PendingRegistration {
  id: string;
  gymId: string;
  gymName: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  photoURL?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hasExercisedBefore?: 'yes' | 'no' | null;
  fitnessGoal?: string[] | null;
  fitnessGoalOther?: string | null;
  medicalConditions?: string | null;
  injuries?: string | null;
  allergies?: string | null;
  hasMedicalCertificate?: 'yes' | 'no' | null;
  isUpdate?: boolean;
  memberId?: string;
  previousData?: any;
  newData?: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
}

// ✅ CORREGIDO: Interface para Membresías (no actividades)
interface Membership {
  id: string;
  activityId: string;
  activityName: string;
  name: string;
  cost: number;
  duration: number;
  maxAttendances: number;
  description?: string;
}

const PendingRegistrations: React.FC = () => {
  const { gymData, userData } = useAuth();
  
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // ✅ CORREGIDO: Estados para asignación de membresía
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadRegistrations();
    loadMemberships();
  }, [gymData?.id]);

  useEffect(() => {
    filterRegistrations();
  }, [registrations, searchTerm, statusFilter, currentPage]);

  // ✅ CORREGIDO: Cargar membresías disponibles (no actividades)
  const loadMemberships = async () => {
    if (!gymData?.id) return;
    
    setLoadingMemberships(true);
    try {
      const membershipsRef = collection(db, `gyms/${gymData.id}/memberships`);
      const snapshot = await getDocs(membershipsRef);
      
      const membershipsList: Membership[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Solo mostrar membresías activas
        if (data.isActive !== false) {
          membershipsList.push({
            id: doc.id,
            activityId: data.activityId || '',
            activityName: data.activityName || data.name,
            name: data.name || '',
            cost: data.cost || 0,
            duration: data.duration || 30,
            maxAttendances: data.maxAttendances || 0,
            description: data.description || ''
          });
        }
      });
      
      setMemberships(membershipsList);
    } catch (error) {
      console.error('Error cargando membresías:', error);
    } finally {
      setLoadingMemberships(false);
    }
  };

  const loadRegistrations = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      const registrationsRef = collection(db, 'pendingRegistrations');
      const q = query(
        registrationsRef,
        where('gymId', '==', gymData.id),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PendingRegistration[];

      setRegistrations(data);
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRegistrations = () => {
    let filtered = registrations;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        if (r.isUpdate) {
          return (
            r.newData?.firstName?.toLowerCase().includes(term) ||
            r.newData?.lastName?.toLowerCase().includes(term) ||
            r.newData?.email?.toLowerCase().includes(term)
          );
        } else {
          return (
            r.firstName?.toLowerCase().includes(term) ||
            r.lastName?.toLowerCase().includes(term) ||
            r.dni?.includes(term) ||
            r.email?.toLowerCase().includes(term)
          );
        }
      });
    }

    setFilteredRegistrations(filtered);
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredRegistrations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);

  // ✅ MEJORADO: Función de aprobación con asignación de membresía
  const handleApprove = async (registration: PendingRegistration, membershipId?: string) => {
    if (!gymData?.id || !userData?.name) return;

    const isUpdate = registration.isUpdate;
    const memberName = isUpdate 
      ? `${registration.newData?.firstName} ${registration.newData?.lastName}`
      : `${registration.firstName} ${registration.lastName}`;
    
    const confirmMessage = isUpdate
      ? `¿Aprobar la actualización de ${memberName}?`
      : membershipId 
        ? `¿Aprobar el registro de ${memberName} y asignar la membresía seleccionada?`
        : `¿Aprobar el registro de ${memberName}?`;

    if (!window.confirm(confirmMessage)) return;

    setProcessing(registration.id);

    try {
      if (isUpdate && registration.memberId) {
        // ... código de actualización existente ...
        const updateData: any = {
          firstName: registration.newData.firstName,
          lastName: registration.newData.lastName,
          email: registration.newData.email,
          phone: registration.newData.phone,
          birthDate: registration.newData.birthDate,
          address: registration.newData.address,
          updatedAt: serverTimestamp()
        };

        if (registration.newData.photoURL) {
          updateData.photo = registration.newData.photoURL;
        }
        if (registration.newData.emergencyContactName) {
          updateData.emergencyContactName = registration.newData.emergencyContactName;
        }
        if (registration.newData.emergencyContactPhone) {
          updateData.emergencyContactPhone = registration.newData.emergencyContactPhone;
        }
        if (registration.newData.hasExercisedBefore) {
          updateData.hasExercisedBefore = registration.newData.hasExercisedBefore;
        }
        if (registration.newData.fitnessGoal && registration.newData.fitnessGoal.length > 0) {
          updateData.fitnessGoal = registration.newData.fitnessGoal;
          if (registration.newData.fitnessGoalOther) {
            updateData.fitnessGoalOther = registration.newData.fitnessGoalOther;
          }
        }
        if (registration.newData.medicalConditions) {
          updateData.medicalConditions = registration.newData.medicalConditions;
        }
        if (registration.newData.injuries) {
          updateData.injuries = registration.newData.injuries;
        }
        if (registration.newData.allergies) {
          updateData.allergies = registration.newData.allergies;
        }
        if (registration.newData.hasMedicalCertificate) {
          updateData.hasMedicalCertificate = registration.newData.hasMedicalCertificate;
        }

        await updateDoc(doc(db, `gyms/${gymData.id}/members`, registration.memberId), updateData);
        alert(`✅ Datos actualizados para ${memberName}.`);

      } else {
        // CREAR NUEVO SOCIO
        let memberNumber = 0;
        try {
          memberNumber = await getNextMemberNumber(gymData.id);
        } catch (error) {
          console.error('⚠️ Error obteniendo número de socio:', error);
          memberNumber = Date.now();
        }
        
        const newMember: any = {
          gymId: gymData.id,
          firstName: registration.firstName!,
          lastName: registration.lastName!,
          dni: registration.dni || '',
          email: registration.email!,
          phone: registration.phone!,
          address: registration.address!,
          birthDate: registration.birthDate!,
          photo: registration.photoURL || null,
          status: 'active',
          totalDebt: 0,
          hasDebt: false,
          activeMemberships: 0,
          memberNumber: memberNumber,
          emergencyContactName: registration.emergencyContactName || null,
          emergencyContactPhone: registration.emergencyContactPhone || null,
          hasExercisedBefore: registration.hasExercisedBefore || null,
          fitnessGoal: (registration.fitnessGoal && registration.fitnessGoal.length > 0) 
            ? registration.fitnessGoal 
            : null,
          fitnessGoalOther: registration.fitnessGoalOther || null,
          medicalConditions: registration.medicalConditions || null,
          injuries: registration.injuries || null,
          allergies: registration.allergies || null,
          hasMedicalCertificate: registration.hasMedicalCertificate || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const memberDocRef = await addDoc(collection(db, `gyms/${gymData.id}/members`), newMember);
        const newMemberId = memberDocRef.id;

        // ✅ CORREGIDO: Si se seleccionó una membresía, asignarla
        if (membershipId) {
          const membership = memberships.find(m => m.id === membershipId);
          if (membership) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const dayOfMonth = today.getDate();

            // Calcular fecha de primer pago
            let firstPaymentMonth = new Date(today);
            if (dayOfMonth > 15) {
              firstPaymentMonth.setMonth(firstPaymentMonth.getMonth() + 1);
            }

            // Calcular fecha de finalización (según duración de la membresía)
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + membership.duration);
            const endDateStr = endDate.toISOString().split('T')[0];

            const membershipData = {
              gymId: gymData.id,
              memberId: newMemberId,
              memberName: `${registration.firstName} ${registration.lastName}`,
              membershipId: membership.id,
              membershipName: membership.name,
              activityId: membership.activityId,
              activityName: membership.activityName,
              cost: membership.cost,
              startDate: todayStr,
              endDate: endDateStr,
              duration: membership.duration,
              maxAttendances: membership.maxAttendances,
              status: 'active',
              autoRenewal: true,
              paymentFrequency: 'monthly',
              description: membership.description || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            // Guardar la membresía
            await addDoc(
              collection(db, `gyms/${gymData.id}/members/${newMemberId}/memberships`),
              membershipData
            );

            // Generar el pago pendiente
            const paymentData = {
              gymId: gymData.id,
              memberId: newMemberId,
              memberName: `${registration.firstName} ${registration.lastName}`,
              type: 'membership_payment',
              category: 'membership',
              amount: membership.cost,
              status: 'pending',
              description: `${membership.name} - Mes ${firstPaymentMonth.getMonth() + 1}/${firstPaymentMonth.getFullYear()}`,
              dueDate: new Date(firstPaymentMonth.getFullYear(), firstPaymentMonth.getMonth(), 15).toISOString().split('T')[0],
              createdAt: serverTimestamp()
            };

            await addDoc(
              collection(db, `gyms/${gymData.id}/members/${newMemberId}/payments`),
              paymentData
            );

            // Actualizar la deuda del socio
            await updateDoc(doc(db, `gyms/${gymData.id}/members`, newMemberId), {
              totalDebt: membership.cost,
              hasDebt: true,
              activeMemberships: 1
            });

            alert(
              `✅ ${registration.firstName} ha sido registrado como socio #${memberNumber}\n\n` +
              `🎯 Membresía asignada: ${membership.name}\n` +
              `💰 Costo mensual: ${membership.cost}\n` +
              `📅 Vence el: ${endDateStr}\n` +
              `💳 Primer pago pendiente para: 15/${firstPaymentMonth.getMonth() + 1}/${firstPaymentMonth.getFullYear()}`
            );
          }
        } else {
          alert(`✅ ${registration.firstName} ha sido registrado como socio #${memberNumber}.`);
        }
      }

      // Marcar como aprobado
      await updateDoc(doc(db, 'pendingRegistrations', registration.id), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: userData.name
      });

      await loadRegistrations();
      setShowMembershipModal(false);
      setSelectedRegistration(null);
      setSelectedMembershipId('');

    } catch (error) {
      console.error('Error approving:', error);
      alert('Error al aprobar. Intenta nuevamente.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (registration: PendingRegistration) => {
    if (!userData?.name) return;

    const reason = window.prompt('¿Por qué rechazar esta solicitud?');
    if (!reason) return;

    setProcessing(registration.id);

    try {
      await updateDoc(doc(db, 'pendingRegistrations', registration.id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: userData.name,
        rejectionReason: reason
      });

      await loadRegistrations();
      alert('❌ Solicitud rechazada.');
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error al rechazar. Intenta nuevamente.');
    } finally {
      setProcessing(null);
      setSelectedRegistration(null);
    }
  };

  const handleDelete = async (registrationId: string) => {
    if (!window.confirm('¿Eliminar este registro permanentemente?')) return;

    setProcessing(registrationId);

    try {
      await deleteDoc(doc(db, 'pendingRegistrations', registrationId));
      await loadRegistrations();
      setSelectedRegistration(null);
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar.');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ✅ NUEVO: Abrir modal para asignar membresía
  const openMembershipModal = (registration: PendingRegistration) => {
    setSelectedRegistration(registration);
    setShowMembershipModal(true);
    setSelectedMembershipId(''); // Resetear selección
  };

  const stats = {
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
    total: registrations.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <Users className="h-8 w-8 mr-3 text-blue-600" />
          Registros Pendientes
        </h1>
        <p className="text-gray-600">
          Revisa y aprueba las solicitudes de nuevos socios y actualizaciones
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Aprobados</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rechazados</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>

            <button
              onClick={loadRegistrations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No hay registros para mostrar</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Solicitante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
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
                {paginatedData.map((registration) => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {registration.isUpdate 
                            ? `${registration.newData?.firstName} ${registration.newData?.lastName}`
                            : `${registration.firstName} ${registration.lastName}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.isUpdate 
                            ? 'Actualización de datos'
                            : (registration.dni ? `DNI: ${registration.dni}` : 'Sin DNI')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="flex items-center text-gray-900">
                          <Mail className="h-4 w-4 mr-1 text-gray-400" />
                          {registration.isUpdate 
                            ? registration.newData?.email 
                            : registration.email}
                        </div>
                        <div className="flex items-center text-gray-500 mt-1">
                          <Phone className="h-4 w-4 mr-1 text-gray-400" />
                          {registration.isUpdate 
                            ? registration.newData?.phone 
                            : registration.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(registration.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {registration.status === 'pending' && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                      {registration.status === 'approved' && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Aprobado
                        </span>
                      )}
                      {registration.status === 'rejected' && (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedRegistration(registration)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                          title="Ver detalles"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        
                        {registration.status === 'pending' && (
                          <>
                            {/* ✅ NUEVO: Botón para asignar membresía (solo para nuevos registros) */}
                            {!registration.isUpdate && (
                              <button
                                onClick={() => openMembershipModal(registration)}
                                disabled={processing === registration.id}
                                className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 disabled:opacity-50"
                                title="Asignar membresía y aprobar"
                              >
                                <CreditCard className="h-5 w-5" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleApprove(registration)}
                              disabled={processing === registration.id}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 disabled:opacity-50"
                              title="Aprobar"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleReject(registration)}
                              disabled={processing === registration.id}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                              title="Rechazar"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        
                        {registration.status !== 'pending' && (
                          <button
                            onClick={() => handleDelete(registration.id)}
                            disabled={processing === registration.id}
                            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50 disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ NUEVO: Modal para asignar membresía */}
      {showMembershipModal && selectedRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Asignar Membresía
                </h2>
                <button
                  onClick={() => {
                    setShowMembershipModal(false);
                    setSelectedMembershipId('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Selecciona una membresía para asignar a{' '}
                  <span className="font-semibold">
                    {selectedRegistration.firstName} {selectedRegistration.lastName}
                  </span>
                </p>

                {loadingMemberships ? (
                  <div className="text-center py-4">
                    <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </div>
                ) : memberships.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No hay membresías disponibles. Por favor, crea una membresía primero en Configuración → Membresías.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {memberships.map(membership => (
                      <button
                        key={membership.id}
                        onClick={() => setSelectedMembershipId(membership.id)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition ${
                          selectedMembershipId === membership.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{membership.name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {membership.activityName}
                            </p>
                            {membership.description && (
                              <p className="text-xs text-gray-500 mt-1">{membership.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>⏱️ {membership.duration} días</span>
                              {membership.maxAttendances > 0 && (
                                <span>🎫 {membership.maxAttendances} asistencias</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-blue-600 text-lg">${membership.cost}</p>
                            <p className="text-xs text-gray-500">por mes</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Importante:</strong> Al asignar la membresía:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-5 list-disc">
                  <li>Se creará el socio automáticamente</li>
                  <li>Se asignará la membresía seleccionada</li>
                  <li>Se generará el primer pago pendiente</li>
                  <li>La deuda quedará registrada</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMembershipModal(false);
                    setSelectedMembershipId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                
                <button
                  onClick={() => handleApprove(selectedRegistration, selectedMembershipId || undefined)}
                  disabled={!selectedMembershipId || processing === selectedRegistration.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing === selectedRegistration.id ? (
                    <>
                      <Loader className="animate-spin h-4 w-4" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Aprobar con Membresía
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles (mantiene funcionalidad original) */}
      {selectedRegistration && !showMembershipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedRegistration.isUpdate 
                    ? 'Actualización de Datos' 
                    : 'Nuevo Registro'}
                </h2>
                <button
                  onClick={() => setSelectedRegistration(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* Contenido del modal de detalles - mantén tu implementación original aquí */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3">Información Personal</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Nombre</p>
                      <p className="font-medium">
                        {selectedRegistration.isUpdate
                          ? `${selectedRegistration.newData?.firstName} ${selectedRegistration.newData?.lastName}`
                          : `${selectedRegistration.firstName} ${selectedRegistration.lastName}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">DNI</p>
                      <p className="font-medium">
                        {selectedRegistration.isUpdate
                          ? selectedRegistration.newData?.dni
                          : selectedRegistration.dni || 'Sin DNI'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3">Contacto</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">
                        {selectedRegistration.isUpdate
                          ? selectedRegistration.newData?.email
                          : selectedRegistration.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Teléfono</p>
                      <p className="font-medium">
                        {selectedRegistration.isUpdate
                          ? selectedRegistration.newData?.phone
                          : selectedRegistration.phone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              {selectedRegistration.status === 'pending' && (
                <div className="flex gap-4 pt-4 border-t mt-6">
                  {!selectedRegistration.isUpdate && (
                    <button
                      onClick={() => {
                        setShowMembershipModal(true);
                      }}
                      disabled={processing === selectedRegistration.id}
                      className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      Asignar Membresía
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleApprove(selectedRegistration)}
                    disabled={processing === selectedRegistration.id}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {processing === selectedRegistration.id ? (
                      <Loader className="animate-spin h-5 w-5" />
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" />
                        {selectedRegistration.isUpdate ? 'Aprobar Cambios' : 'Aprobar'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRegistration)}
                    disabled={processing === selectedRegistration.id}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRegistrations;