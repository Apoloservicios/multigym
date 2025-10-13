// src/pages/admin/PendingRegistrations.tsx
// 🔐 PANEL DE APROBACIÓN - VERSIÓN CORREGIDA Y SIMPLIFICADA

import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, XCircle, Clock, Search, 
  AlertCircle, Mail, Phone, Loader, Eye, Trash2, 
  ChevronLeft, ChevronRight, RefreshCw
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

interface PendingRegistration {
  id: string;
  gymId: string;
  gymName: string;
  
  // Para nuevos registros
  firstName?: string;
  lastName?: string;
  dni?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  
  // ✅ NUEVOS CAMPOS - FOTO
  photoURL?: string;
  
  // ✅ NUEVOS CAMPOS - CONTACTO DE EMERGENCIA
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // ✅ NUEVOS CAMPOS - CUESTIONARIO DE SALUD Y FITNESS
  hasExercisedBefore?: 'yes' | 'no';
  fitnessGoal?: string[]; // ✅ Array para múltiples objetivos
  fitnessGoalOther?: string;
  medicalConditions?: string;
  injuries?: string;
  allergies?: string;
  hasMedicalCertificate?: 'yes' | 'no';
  
  // Para actualizaciones
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

const PendingRegistrations: React.FC = () => {
  const { gymData, userData } = useAuth();
  
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Cargar registros
  useEffect(() => {
    loadRegistrations();
  }, [gymData?.id]);

  // Filtrar y paginar
  useEffect(() => {
    filterRegistrations();
  }, [registrations, searchTerm, statusFilter, currentPage]);

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

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Filtrar por búsqueda
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

  // Calcular datos paginados
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredRegistrations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);

  // Aprobar
// ✅ FUNCIÓN ACTUALIZADA: handleApprove con soporte para TODOS los campos nuevos
// ✅ FUNCIÓN ACTUALIZADA: handleApprove con soporte para TODOS los campos nuevos
const handleApprove = async (registration: PendingRegistration) => {
  if (!gymData?.id || !userData?.name) return;

  const isUpdate = registration.isUpdate;
  const memberName = isUpdate 
    ? `${registration.newData?.firstName} ${registration.newData?.lastName}`
    : `${registration.firstName} ${registration.lastName}`;
  
  const confirmMessage = isUpdate
    ? `¿Aprobar la actualización de ${memberName}?`
    : `¿Aprobar el registro de ${memberName}?`;

  if (!window.confirm(confirmMessage)) return;

  setProcessing(registration.id);

  try {
    if (isUpdate && registration.memberId) {
      // ✅ ACTUALIZAR SOCIO EXISTENTE CON TODOS LOS CAMPOS NUEVOS
      const updateData: any = {
        firstName: registration.newData.firstName,
        lastName: registration.newData.lastName,
        email: registration.newData.email,
        phone: registration.newData.phone,
        birthDate: registration.newData.birthDate,
        address: registration.newData.address,
        updatedAt: serverTimestamp()
      };

      // ✅ Agregar foto si existe
      if (registration.newData.photoURL) {
        updateData.photo = registration.newData.photoURL;
      }

      // ✅ Agregar contacto de emergencia si existe
      if (registration.newData.emergencyContactName) {
        updateData.emergencyContactName = registration.newData.emergencyContactName;
      }
      if (registration.newData.emergencyContactPhone) {
        updateData.emergencyContactPhone = registration.newData.emergencyContactPhone;
      }

      // ✅ Agregar cuestionario de salud si existe
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
      // ✅ CREAR NUEVO SOCIO CON TODOS LOS CAMPOS NUEVOS
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
        
        // ✅ NUEVOS CAMPOS - CONTACTO DE EMERGENCIA
        emergencyContactName: registration.emergencyContactName || null,
        emergencyContactPhone: registration.emergencyContactPhone || null,
        
        // ✅ NUEVOS CAMPOS - CUESTIONARIO DE SALUD Y FITNESS
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

      await addDoc(collection(db, `gyms/${gymData.id}/members`), newMember);
      alert(`✅ ${registration.firstName} ha sido registrado como socio.`);
    }

    // Marcar como aprobado
    await updateDoc(doc(db, 'pendingRegistrations', registration.id), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: userData.name
    });

    await loadRegistrations();

  } catch (error) {
    console.error('Error approving:', error);
    alert('Error al aprobar. Intenta nuevamente.');
  } finally {
    setProcessing(null);
    setSelectedRegistration(null);
  }
};

  // Rechazar
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

  // Eliminar
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

  // Formatear fecha
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

  // Estadísticas
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
              <p className="text-sm text-yellow-600 font-medium">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Aprobados</p>
              <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Rechazados</p>
              <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total</p>
              <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, DNI o email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de registros */}
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No hay registros para mostrar</p>
          <p className="text-gray-400 text-sm">
            {searchTerm || statusFilter !== 'pending' 
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Los nuevos registros aparecerán aquí'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Socio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((registration) => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900 flex items-center">
                          {registration.isUpdate ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 text-purple-500" />
                              {registration.previousData?.firstName} {registration.previousData?.lastName}
                            </>
                          ) : (
                            <>
                              {registration.firstName} {registration.lastName}
                            </>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.isUpdate ? (
                            'Actualización de datos'
                          ) : (
                            registration.dni ? `DNI: ${registration.dni}` : 'Sin DNI'
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                  Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
                  <span className="font-medium">{Math.min(endIndex, filteredRegistrations.length)}</span> de{' '}
                  <span className="font-medium">{filteredRegistrations.length}</span> registros
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
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
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de detalles */}
      {selectedRegistration && (
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

              <div className="space-y-6">
                {selectedRegistration.isUpdate ? (
                  // Vista de actualización
                  <>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-800 flex items-center">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        <strong>Actualización de {selectedRegistration.previousData?.firstName} {selectedRegistration.previousData?.lastName}</strong>
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-700 mb-3">Cambios Solicitados</h3>
                      
                      <div className="space-y-3">
                        {selectedRegistration.previousData && selectedRegistration.newData && 
                          Object.keys(selectedRegistration.newData).map(key => {
                            const oldValue = selectedRegistration.previousData[key];
                            const newValue = selectedRegistration.newData[key];
                            
                            if (oldValue === newValue) return null;

                            const labels: any = {
                              firstName: 'Nombre',
                              lastName: 'Apellido',
                              email: 'Email',
                              phone: 'Teléfono',
                              birthDate: 'Fecha de Nacimiento',
                              address: 'Dirección'
                            };

                            return (
                              <div key={key} className="bg-gray-50 p-4 rounded">
                                <p className="text-sm text-gray-500 mb-2">{labels[key] || key}</p>
                                <div className="flex items-center gap-4">
                                  <div className="flex-1">
                                    <p className="text-xs text-gray-400">Anterior:</p>
                                    <p className="text-sm text-red-600 line-through">{oldValue || 'N/A'}</p>
                                  </div>
                                  <div className="text-gray-400">→</div>
                                  <div className="flex-1">
                                    <p className="text-xs text-gray-400">Nuevo:</p>
                                    <p className="text-sm font-medium text-green-600">{newValue}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  </>
                ) : (
                  // Vista de nuevo registro
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <h3 className="font-semibold text-gray-700 mb-3">Datos Personales</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Nombre completo</p>
                          <p className="font-medium">{selectedRegistration.firstName} {selectedRegistration.lastName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">DNI</p>
                          <p className="font-medium">{selectedRegistration.dni}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Fecha de Nacimiento</p>
                          <p className="font-medium">{selectedRegistration.birthDate}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded">
                      <h3 className="font-semibold text-gray-700 mb-3">Contacto</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium">{selectedRegistration.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Teléfono</p>
                          <p className="font-medium">{selectedRegistration.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Dirección</p>
                          <p className="font-medium">{selectedRegistration.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Acciones */}
                {selectedRegistration.status === 'pending' && (
                  <div className="flex gap-4 pt-4 border-t">
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
                          {selectedRegistration.isUpdate ? 'Aprobar Cambios' : 'Aprobar y Crear Socio'}
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
        </div>
      )}
    </div>
  );
};

export default PendingRegistrations;