// src/pages/superadmin/PendingPayments.tsx
// Panel para que el superadmin gestione solicitudes de renovación

import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, Eye, Search, Filter, 
  Calendar, DollarSign, RefreshCw, AlertCircle, ExternalLink 
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { RenewalRequest } from '../../types/renewal.types';
import useAuth from '../../hooks/useAuth';
import { toJsDate } from '../../utils/date.utils';

const PendingPayments: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [requests, setRequests] = useState<RenewalRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RenewalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de visualización
  const [selectedRequest, setSelectedRequest] = useState<RenewalRequest | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, searchTerm]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const requestsRef = collection(db, 'renewalRequests');
      const q = query(requestsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RenewalRequest));
      
      setRequests(data);
    } catch (err: any) {
      console.error('Error loading requests:', err);
      setError('Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];
    
    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }
    
    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(req => 
        req.gymName.toLowerCase().includes(term) ||
        req.requestedByEmail.toLowerCase().includes(term) ||
        req.planName.toLowerCase().includes(term)
      );
    }
    
    setFilteredRequests(filtered);
  };

  const approveRequest = async (request: RenewalRequest) => {
    if (!currentUser) return;
    
    const confirmed = window.confirm(
      `¿Aprobar la renovación de ${request.gymName}?\n\n` +
      `Plan: ${request.planName}\n` +
      `Precio: $${request.planPrice.toLocaleString('es-AR')}\n` +
      `Duración: ${request.planDuration} días`
    );
    
    if (!confirmed) return;
    
    setProcessing(request.id);
    setError(null);
    
    try {
      // 1. Calcular nuevas fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + request.planDuration);
      
      // 2. Actualizar estado del gimnasio
      const gymRef = doc(db, 'gyms', request.gymId);
      await updateDoc(gymRef, {
        status: 'active',
        subscriptionData: {
          plan: request.planName,
          startDate: startDate,
          endDate: endDate,
          price: request.planPrice,
          paymentMethod: request.paymentMethod,
          lastPayment: request.paymentDate,
          renewalRequested: false
        },
        updatedAt: serverTimestamp()
      });
      
      // 3. Crear registro de suscripción
      await addDoc(collection(db, 'subscriptions'), {
        gymId: request.gymId,
        gymName: request.gymName,
        planId: request.planId,
        planName: request.planName,
        startDate: startDate,
        endDate: endDate,
        price: request.planPrice,
        status: 'active',
        paymentMethod: request.paymentMethod,
        paymentDate: request.paymentDate,
        renewalRequested: false,
        autoRenewal: false,
        createdAt: serverTimestamp()
      });
      
      // 4. Registrar el pago
      await addDoc(collection(db, 'payments'), {
        subscriptionId: '', // Se podría relacionar con el ID de la suscripción creada
        gymId: request.gymId,
        gymName: request.gymName,
        amount: request.planPrice,
        date: request.paymentDate,
        method: request.paymentMethod,
        status: 'completed',
        reference: request.paymentReference,
        description: `Renovación - ${request.planName}`,
        notes: `Aprobado por ${currentUser.email}`,
        createdAt: serverTimestamp()
      });
      
      // 5. Actualizar solicitud a aprobada
      const requestRef = doc(db, 'renewalRequests', request.id);
      await updateDoc(requestRef, {
        status: 'approved',
        reviewedBy: currentUser.uid,
        reviewedByName: currentUser.email,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 6. Actualizar localmente
      setRequests(prev => 
        prev.map(r => 
          r.id === request.id 
            ? { 
                ...r, 
                status: 'approved' as const,
                reviewedBy: currentUser.uid,
                reviewedByName: currentUser.email || undefined,
                reviewedAt: new Date()
              } 
            : r
        )
      );
      
      alert(`✅ Renovación aprobada para ${request.gymName}`);
      
    } catch (err: any) {
      console.error('Error approving request:', err);
      setError('Error al aprobar la solicitud: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const rejectRequest = async (request: RenewalRequest) => {
    if (!currentUser) return;
    
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;
    
    setProcessing(request.id);
    setError(null);
    
    try {
      const requestRef = doc(db, 'renewalRequests', request.id);
      await updateDoc(requestRef, {
        status: 'rejected',
        reviewedBy: currentUser.uid,
        reviewedByName: currentUser.email,
        reviewedAt: serverTimestamp(),
        rejectionReason: reason,
        updatedAt: serverTimestamp()
      });
      
      // Actualizar localmente
      setRequests(prev => 
        prev.map(r => 
          r.id === request.id 
            ? { 
                ...r, 
                status: 'rejected' as const,
                reviewedBy: currentUser.uid,
                reviewedByName: currentUser.email || undefined,
                reviewedAt: new Date(),
                rejectionReason: reason
              } 
            : r
        )
      );
      
      alert(`❌ Solicitud rechazada para ${request.gymName}`);
      
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      setError('Error al rechazar la solicitud: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} className="mr-1" />
            Pendiente
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Aprobada
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Rechazada
          </span>
        );
      default:
        return null;
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Pagos</h1>
          <p className="text-gray-600">Revisar y aprobar solicitudes de renovación</p>
        </div>
        
        <button
          onClick={loadRequests}
          disabled={loading}
          className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Total</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Aprobadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Rechazadas</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por gimnasio, email, plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Requests List */}
      {!loading && filteredRequests.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">No hay solicitudes {statusFilter !== 'all' ? statusFilter + 's' : ''}</p>
        </div>
      )}

      {!loading && filteredRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gimnasio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map(request => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{request.gymName}</div>
                      <div className="text-sm text-gray-500">{request.requestedByEmail}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{request.planName}</div>
                      <div className="text-sm text-gray-500">{request.planDuration} días</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-gray-900 font-medium">
                      <DollarSign size={14} className="mr-1" />
                      {request.planPrice.toLocaleString('es-AR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {toJsDate(request.paymentDate)?.toLocaleDateString('es-AR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowImageModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Ver comprobante"
                      >
                        <Eye size={18} />
                      </button>
                      
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveRequest(request)}
                            disabled={processing === request.id}
                            className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                            title="Aprobar"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => rejectRequest(request)}
                            disabled={processing === request.id}
                            className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                            title="Rechazar"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de visualización de comprobante */}
      {showImageModal && selectedRequest && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedRequest.gymName}</h2>
                <p className="text-gray-600">{selectedRequest.planName} - ${selectedRequest.planPrice.toLocaleString('es-AR')}</p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="mb-4">
              <img
                src={selectedRequest.paymentProofUrl}
                alt="Comprobante de pago"
                className="w-full rounded-lg border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Método de pago:</p>
                <p className="font-medium">{selectedRequest.paymentMethod}</p>
              </div>
              <div>
                <p className="text-gray-500">Referencia:</p>
                <p className="font-medium">{selectedRequest.paymentReference || 'N/A'}</p>
              </div>
              {selectedRequest.notes && (
                <div className="col-span-2">
                  <p className="text-gray-500">Notas:</p>
                  <p className="font-medium">{selectedRequest.notes}</p>
                </div>
              )}
            </div>

            {selectedRequest.status === 'pending' && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImageModal(false);
                    approveRequest(selectedRequest);
                  }}
                  disabled={processing === selectedRequest.id}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={18} className="inline mr-2" />
                  Aprobar
                </button>
                <button
                  onClick={() => {
                    setShowImageModal(false);
                    rejectRequest(selectedRequest);
                  }}
                  disabled={processing === selectedRequest.id}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle size={18} className="inline mr-2" />
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingPayments;