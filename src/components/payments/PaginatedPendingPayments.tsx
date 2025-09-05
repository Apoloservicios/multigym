// src/components/payments/PaginatedPendingPayments.tsx
// 📋 LISTA OPTIMIZADA CON PAGINACIÓN Y BÚSQUEDA

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  DollarSign, 
  User, 
  Calendar, 
  AlertCircle,
  Eye,
  CreditCard,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { MonthlyPaymentsService } from '../../services/monthlyPayments.service';
import { MonthlyPaymentListItem } from '../../types/monthlyPayments.types';
import useAuth from '../../hooks/useAuth';

interface PaginatedPendingPaymentsProps {
  year: number;
  month: number;
  onPaymentRegistered?: () => void;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const PaginatedPendingPayments: React.FC<PaginatedPendingPaymentsProps> = ({ 
  year, 
  month, 
  onPaymentRegistered 
}) => {
  const { gymData } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMember, setSelectedMember] = useState<MonthlyPaymentListItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Estados de búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'current'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Información de paginación
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Cargar datos al inicializar
  useEffect(() => {
    if (gymData?.id) {
      loadPendingPayments();
    }
  }, [gymData?.id, year, month]);

  // Filtrar y paginar cuando cambien los criterios
  useEffect(() => {
    filterAndPaginatePayments();
  }, [pendingPayments, searchTerm, statusFilter, currentPage, itemsPerPage]);

  /**
   * 📋 Cargar lista de pagos pendientes (sin paginación en la consulta inicial)
   */
  const loadPendingPayments = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const payments = await MonthlyPaymentsService.getPendingPaymentsList(gymData.id, year, month);
      setPendingPayments(payments);
      console.log('📋 Pagos pendientes cargados:', payments.length);
    } catch (err: any) {
      console.error('❌ Error cargando pagos pendientes:', err);
      setError('Error al cargar los pagos pendientes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Filtrar y paginar datos localmente
   */
  const filterAndPaginatePayments = useCallback(() => {
    let filtered = [...pendingPayments];

    // Aplicar filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.memberName.toLowerCase().includes(searchLower) ||
        payment.memberEmail?.toLowerCase().includes(searchLower) ||
        payment.activities.some(activity => 
          activity.name.toLowerCase().includes(searchLower)
        )
      );
    }

    // Aplicar filtro de estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => {
        if (statusFilter === 'overdue') return payment.isOverdue;
        if (statusFilter === 'current') return !payment.isOverdue;
        return true;
      });
    }

    // Calcular paginación
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // Obtener página actual
    const pageItems = filtered.slice(startIndex, endIndex);
    
    // Actualizar estados
    setFilteredPayments(pageItems);
    setPagination({
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    });
  }, [pendingPayments, searchTerm, statusFilter, currentPage, itemsPerPage]);

  /**
   * 💰 Registrar pago completo del socio
   */
  const registerFullMemberPayment = async (
    memberId: string, 
    totalAmount: number,
    paymentMethod: 'cash' | 'transfer' | 'card'
  ) => {
    if (!gymData?.id) return;

    try {
      setRegistering(memberId);
      
      await MonthlyPaymentsService.registerMemberFullPayment(
        gymData.id, 
        year, 
        month, 
        memberId, 
        paymentMethod
      );
      
      setSuccess('Pago registrado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      
      // Recargar datos
      await loadPendingPayments();
      
      // Notificar al componente padre
      if (onPaymentRegistered) {
        onPaymentRegistered();
      }
      
    } catch (err: any) {
      console.error('❌ Error registrando pago completo:', err);
      setError(err.message || 'Error al registrar el pago');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRegistering(null);
    }
  };

  /**
   * 📄 Cambiar página
   */
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, pagination.totalPages)));
  };

  /**
   * 🔍 Limpiar filtros
   */
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  /**
   * 📅 Formatear mes
   */
  const formatMonth = (year: number, month: number): string => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  /**
   * 💰 Formatear moneda
   */
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  /**
   * 🎨 Obtener estilo para días de atraso
   */
  const getOverdueStyle = (daysOverdue: number) => {
    if (daysOverdue <= 0) return 'text-gray-500';
    if (daysOverdue <= 5) return 'text-yellow-600';
    if (daysOverdue <= 15) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header con búsqueda y filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Pagos Pendientes - {formatMonth(year, month)}
            </h2>
            <p className="text-gray-600">
              {pagination.totalItems} socios encontrados
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar socio, email o actividad..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset a primera página al buscar
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Filtro de estado */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="overdue">Solo vencidos</option>
              <option value="current">Solo al día</option>
            </select>

            {/* Elementos por página */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>

            {/* Limpiar filtros */}
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
              >
                <Filter size={16} className="mr-2" />
                Limpiar
              </button>
            )}

            {/* Actualizar */}
            <button
              onClick={loadPendingPayments}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-600 mr-2" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-2" size={20} />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin mr-2" size={20} />
          <span className="text-gray-600">Cargando pagos pendientes...</span>
        </div>
      )}

      {/* Contenido principal */}
      {!loading && (
        <>
          {/* Lista de pagos o mensaje vacío */}
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              {pagination.totalItems === 0 ? (
                <>
                  <CheckCircle className="mx-auto mb-4 text-green-400" size={64} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    ¡Todos los pagos al día!
                  </h3>
                  <p className="text-gray-600">
                    No hay pagos pendientes para {formatMonth(year, month)}
                  </p>
                </>
              ) : (
                <>
                  <Search className="mx-auto mb-4 text-gray-400" size={64} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No se encontraron resultados
                  </h3>
                  <p className="text-gray-600">
                    Intenta con otros términos de búsqueda o filtros
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Limpiar filtros
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Tabla de pagos pendientes */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Socio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actividades Pendientes
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Debe
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPayments.map((payment) => (
                        <tr key={payment.memberId} className="hover:bg-gray-50">
                          {/* Información del socio */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                  <User size={20} className="text-gray-600" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {payment.memberName}
                                </div>
                                {payment.memberEmail && (
                                  <div className="text-sm text-gray-500">
                                    {payment.memberEmail}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Actividades pendientes */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {payment.activities
                                .filter(activity => activity.status === 'pending')
                                .map((activity, index) => (
                                  <div key={index} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-900">
                                      {activity.name}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 ml-4">
                                      {formatCurrency(activity.cost)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </td>

                          {/* Total debe */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-red-600">
                              {formatCurrency(payment.totalPending)}
                            </div>
                            {payment.totalPaid > 0 && (
                              <div className="text-xs text-gray-500">
                                Pagado: {formatCurrency(payment.totalPaid)}
                              </div>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className={`text-sm ${getOverdueStyle(payment.daysOverdue)}`}>
                              {payment.isOverdue ? (
                                <>
                                  <AlertCircle size={16} className="inline mr-1" />
                                  {payment.daysOverdue} días vencido
                                </>
                              ) : (
                                <>
                                  <Calendar size={16} className="inline mr-1" />
                                  Al día
                                </>
                              )}
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {/* Botón pago completo */}
                              <button
                                onClick={() => {
                                  setSelectedMember(payment);
                                  setShowPaymentModal(true);
                                }}
                                disabled={registering === payment.memberId}
                                className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                              >
                                {registering === payment.memberId ? (
                                  <RefreshCw size={14} className="animate-spin mr-1" />
                                ) : (
                                  <CreditCard size={14} className="mr-1" />
                                )}
                                {registering === payment.memberId ? 'Procesando...' : 'Cobrar'}
                              </button>

                              {/* Botón ver detalle */}
                              <button
                                onClick={() => {
                                  setSelectedMember(payment);
                                  // TODO: Abrir modal de detalle
                                }}
                                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                title="Ver detalle"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginación */}
              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={!pagination.hasPrevPage}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                  
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando{' '}
                        <span className="font-medium">
                          {Math.min((currentPage - 1) * itemsPerPage + 1, pagination.totalItems)}
                        </span>{' '}
                        a{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * itemsPerPage, pagination.totalItems)}
                        </span>{' '}
                        de{' '}
                        <span className="font-medium">{pagination.totalItems}</span> resultados
                      </p>
                    </div>
                    
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={!pagination.hasPrevPage}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        
                        {/* Números de página */}
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          const startPage = Math.max(1, currentPage - 2);
                          const pageNumber = startPage + i;
                          
                          if (pageNumber > pagination.totalPages) return null;
                          
                          return (
                            <button
                              key={pageNumber}
                              onClick={() => goToPage(pageNumber)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNumber === currentPage
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={!pagination.hasNextPage}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal de pago */}
      {showPaymentModal && selectedMember && (
        <PaymentModal
          member={selectedMember}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedMember(null);
          }}
          onPaymentConfirmed={(paymentMethod) => {
            registerFullMemberPayment(
              selectedMember.memberId,
              selectedMember.totalPending,
              paymentMethod
            );
            setShowPaymentModal(false);
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * 🎯 Modal simple para confirmar pago
 */
interface PaymentModalProps {
  member: MonthlyPaymentListItem;
  onClose: () => void;
  onPaymentConfirmed: (paymentMethod: 'cash' | 'transfer' | 'card') => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ member, onClose, onPaymentConfirmed }) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Confirmar Pago</h3>
        
        <div className="mb-4">
          <p className="text-gray-600">Socio: <strong>{member.memberName}</strong></p>
          <p className="text-gray-600">Total a cobrar: <strong className="text-red-600">{formatCurrency(member.totalPending)}</strong></p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Método de pago:
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onPaymentConfirmed(paymentMethod)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginatedPendingPayments;