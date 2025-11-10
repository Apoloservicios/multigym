// src/components/payments/MonthlyPaymentsOptimized.tsx
// 💰 COMPONENTE OPTIMIZADO PARA PAGOS MENSUALES
// ✅ MEJORAS: Paginación, búsqueda, generación manual

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, DollarSign, AlertTriangle, Search, ChevronLeft, 
  ChevronRight, RefreshCw, Plus, Calendar 
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting.utils';
import { getPendingPaymentsList, generateMonthlyPayments } from '../../services/monthlyPayments.service';
import { doc, getDoc, collection, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';

interface MonthlyPaymentListItem {
  memberId: string;
  memberName: string;
  memberPhone?: string;
  memberEmail?: string;
  totalPending: number;
  activitiesPendingCount: number;
  isOverdue: boolean;
  daysOverdue: number;
  pendingActivities: Array<{
    paymentId: string;
    membershipId: string;
    activityName: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'overdue';
  }>;
}

const MonthlyPaymentsOptimized: React.FC = () => {
  const { gymData, currentUser } = useAuth();
  
  // Estados principales
  const [payments, setPayments] = useState<MonthlyPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // 25 socios por página
  
  // Estados para generación manual
  const [generatingManual, setGeneratingManual] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Cargar pagos al montar
  useEffect(() => {
    if (gymData?.id) {
      loadPayments();
    }
  }, [gymData?.id]);

  /**
   * 📥 Cargar lista de pagos pendientes
   */
  const loadPayments = async () => {
    if (!gymData?.id) return;

    try {
      setLoading(true);
      setError('');
      
      const pendingList = await getPendingPaymentsList(gymData.id);
      setPayments(pendingList);
      
    } catch (err: any) {
      console.error('Error cargando pagos:', err);
      setError('Error al cargar los pagos pendientes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Filtrar pagos por búsqueda (nombre o DNI)
   */
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;

    const searchLower = searchTerm.toLowerCase();
    return payments.filter(payment => 
      payment.memberName.toLowerCase().includes(searchLower) ||
      payment.memberPhone?.includes(searchTerm) ||
      payment.memberEmail?.toLowerCase().includes(searchLower)
    );
  }, [payments, searchTerm]);

  /**
   * 📄 Calcular paginación
   */
  const { paginatedPayments, totalPages, stats } = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredPayments.slice(startIndex, endIndex);

    // Calcular estadísticas
    const totalPending = filteredPayments.reduce((sum, p) => sum + p.totalPending, 0);
    const overdueCount = filteredPayments.filter(p => p.isOverdue).length;

    return {
      paginatedPayments: paginated,
      totalPages: Math.ceil(filteredPayments.length / itemsPerPage),
      stats: {
        total: filteredPayments.length,
        totalPending,
        overdueCount,
        upToDateCount: filteredPayments.length - overdueCount
      }
    };
  }, [filteredPayments, currentPage, itemsPerPage]);

  /**
   * ➕ Generar pago manual para un socio específico
   */
  const handleGenerateManualPayment = async (memberId: string, memberName: string) => {
    if (!gymData?.id) return;

    const confirmed = window.confirm(
      `¿Generar los pagos del mes actual para ${memberName}?\n\n` +
      'Esto creará pagos para todas sus membresías activas que no tengan pago este mes.'
    );

    if (!confirmed) return;

    try {
      setGeneratingManual(true);
      setSelectedMember(memberId);
      setError('');
      setSuccess('');

      // Obtener membresías activas del socio
      const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const membershipsSnap = await getDocs(membershipsRef);

      let paymentsGenerated = 0;

      for (const membershipDoc of membershipsSnap.docs) {
        const membership = membershipDoc.data();

        // Solo procesar membresías activas con auto-generación habilitada
        if (membership.status !== 'active' || !membership.autoGeneratePayments) {
          continue;
        }

        // Verificar si ya existe el pago de este mes
        const currentMonth = new Date().toISOString().substring(0, 7); // "2025-11"
        const paymentId = `${currentMonth}-${memberId}-${membershipDoc.id}`;
        const paymentRef = doc(db, `gyms/${gymData.id}/monthlyPayments`, paymentId);
        const paymentSnap = await getDoc(paymentRef);

        if (paymentSnap.exists()) {
          console.log(`Pago ya existe para ${membership.activityName}`);
          continue;
        }

        // Obtener precio actual de la actividad
        const activityRef = doc(db, `gyms/${gymData.id}/activities`, membership.activityId);
        const activitySnap = await getDoc(activityRef);
        
        if (!activitySnap.exists()) {
          console.log(`Actividad no encontrada: ${membership.activityId}`);
          continue;
        }

        const activityData = activitySnap.data();
        const currentPrice = activityData.cost || 0;

        // Crear el pago
        const dueDate = `${currentMonth}-15`; // Siempre vence el 15
        const payment = {
          memberId,
          memberName,
          membershipId: membershipDoc.id,
          activityId: membership.activityId,
          activityName: membership.activityName,
          month: currentMonth,
          dueDate,
          amount: currentPrice,
          status: 'pending' as const,
          autoGenerated: false, // ← Manual
          createdBy: currentUser?.uid || 'system',
          generatedAt: Timestamp.now()
        };

        await setDoc(paymentRef, payment);

        // Actualizar deuda del socio
        const memberRef = doc(db, `gyms/${gymData.id}/members`, memberId);
        const memberSnap = await getDoc(memberRef);
        
        if (memberSnap.exists()) {
          const memberData = memberSnap.data();
          const currentDebt = memberData.totalDebt || 0;
          
          await updateDoc(memberRef, {
            totalDebt: currentDebt + currentPrice,
            updatedAt: Timestamp.now()
          });
        }

        paymentsGenerated++;
      }

      if (paymentsGenerated > 0) {
        setSuccess(`✅ Se generaron ${paymentsGenerated} pago(s) para ${memberName}`);
        // Recargar la lista
        await loadPayments();
      } else {
        setError(`⚠️ No se generaron pagos. ${memberName} ya tiene todos sus pagos del mes actual.`);
      }

    } catch (err: any) {
      console.error('Error generando pagos manuales:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setGeneratingManual(false);
      setSelectedMember(null);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
    }
  };

  /**
   * 🔄 Generar pagos automáticos para todo el gimnasio
   */
  const handleGenerateAllPayments = async () => {
    if (!gymData?.id) return;

    const confirmed = window.confirm(
      '¿Generar pagos del mes actual para TODOS los socios del gimnasio?\n\n' +
      'Esto puede tardar varios segundos si tienes muchos socios.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const result = await generateMonthlyPayments(gymData.id);

      if (result.success) {
        setSuccess(
          `✅ Pagos generados exitosamente\n` +
          `• ${result.paymentsGenerated} pagos creados\n` +
          `• ${result.summary.totalMembers} socios procesados\n` +
          `• Total: ${formatCurrency(result.summary.totalAmount)}`
        );
        
        // Recargar la lista
        await loadPayments();
      } else {
        setError('⚠️ Algunos pagos no se pudieron generar. Revisa la consola.');
      }

    } catch (err: any) {
      console.error('Error generando pagos:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 10000);
    }
  };

  // 🔄 Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Cargando pagos pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pendiente</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(stats.totalPending)}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Vencidos</p>
              <p className="text-3xl font-bold text-red-600">{stats.overdueCount}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Al Día</p>
              <p className="text-3xl font-bold text-green-600">{stats.upToDateCount}</p>
            </div>
            <Calendar className="h-10 w-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <p className="text-green-800 whitespace-pre-line">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Barra de búsqueda y acciones */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Búsqueda */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Resetear a página 1 al buscar
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAllPayments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              <Plus size={20} />
              Generar Todos
            </button>

            <button
              onClick={loadPayments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:bg-gray-400"
            >
              <RefreshCw size={20} />
              Recargar
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="mt-3 text-sm text-gray-600">
          Mostrando {paginatedPayments.length} de {filteredPayments.length} resultados
          {searchTerm && ` (filtrado de ${payments.length} total)`}
        </div>
      </div>

      {/* Tabla de pagos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actividades Pendientes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Pendiente
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
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm 
                      ? `No se encontraron resultados para "${searchTerm}"`
                      : '✅ No hay pagos pendientes'
                    }
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment) => (
                  <tr key={payment.memberId} className="hover:bg-gray-50">
                    {/* Nombre del socio */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.memberName}
                        </div>
                        {payment.memberPhone && (
                          <div className="text-xs text-gray-500">
                            Tel: {payment.memberPhone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actividades pendientes */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {payment.pendingActivities.map((activity) => (
                          <div key={activity.paymentId} className="text-sm">
                            <span className="text-gray-700">{activity.activityName}</span>
                            <span className="text-gray-500 ml-2">
                              ({formatCurrency(activity.amount)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Total pendiente */}
                    <td className="px-6 py-4">
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(payment.totalPending)}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-4">
                      {payment.isOverdue ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Vencido
                          </span>
                          <span className="text-xs text-red-600 mt-1">
                            {payment.daysOverdue} día(s)
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleGenerateManualPayment(payment.memberId, payment.memberName)}
                        disabled={generatingManual && selectedMember === payment.memberId}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition disabled:bg-gray-200 disabled:text-gray-500"
                      >
                        {generatingManual && selectedMember === payment.memberId ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Generar Pago
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyPaymentsOptimized;