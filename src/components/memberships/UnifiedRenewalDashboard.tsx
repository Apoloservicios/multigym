// src/components/memberships/UnifiedRenewalDashboard.tsx
// VERSIÓN REAL - Conectada a Firebase con todas las funcionalidades

import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
  Filter,
  Search,
  Download,
  Settings,
  ChevronDown,
  CreditCard,Edit2, Save, X, ToggleLeft, ToggleRight
} from 'lucide-react';



import useAuth from '../../hooks/useAuth';
import MembershipService, { renewExpiredMembership } from '../../services/membershipService';
import { registerRenewalPayment, getPendingRenewalPayments } from '../../services/payment.service';
import { MembershipAssignment } from '../../types/gym.types';
import IndividualMembershipManagement from './IndividualMembershipManagement';
import { MonthlyReportGenerator } from './MonthlyReportGenerator';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  limit,
  updateDoc, 
  addDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';



interface MembershipStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  withAutoRenewal: number;
  pendingPayments: number;
  totalDebt: number;
}
interface MembershipManagementProps {
  memberships: ManageMembership[];
  searchTerm: string;
  onRenew: (id: string, months: number) => Promise<void>;
  onPayment: (id: string) => Promise<void>;
  renewalInProgress: string[];
  paymentInProgress: string[];
  gymId: string;
}

interface ExpiredMembershipWithDetails extends MembershipAssignment {
  daysExpired: number;
  totalDebt: number;
}

interface ManageMembership extends MembershipAssignment {
  memberEmail?: string;
  memberPhone?: string;
  daysUntilExpiration?: number;
}

const UnifiedRenewalDashboard: React.FC = () => {
  const { gymData, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'expired' | 'manage' | 'reports'>('overview');
  
  // Estados para estadísticas
  const [stats, setStats] = useState<MembershipStats>({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0,
    withAutoRenewal: 0,
    pendingPayments: 0,
    totalDebt: 0
  });
  
  // Estados para membresías vencidas
  const [expiredMemberships, setExpiredMemberships] = useState<ExpiredMembershipWithDetails[]>([]);
  const [loadingExpired, setLoadingExpired] = useState<boolean>(false);
  const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);
  const [expandedMembership, setExpandedMembership] = useState<string | null>(null);
  
  // Estados para gestionar
  const [allMemberships, setAllMemberships] = useState<ManageMembership[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'pending'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  
  // Estados de UI
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [renewalInProgress, setRenewalInProgress] = useState<string[]>([]);
  const [paymentInProgress, setPaymentInProgress] = useState<string[]>([]);

 // CORRECCIONES PARA UnifiedRenewalDashboard.tsx
// Reemplaza las funciones loadStats, loadExpiredMemberships y loadAllMemberships

  // 🔄 Cargar estadísticas principales ESTRUCTURA CORRECTA
  const loadStats = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      
      // Obtener todos los miembros
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const today = new Date();
      let totalCount = 0;
      let activeCount = 0;
      let expiredCount = 0;
      let expiringSoonCount = 0;
      let withAutoRenewalCount = 0;
      let pendingPaymentsCount = 0;
      let totalDebtAmount = 0;
      
      // Por cada miembro, obtener sus membresías
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const memberName = `${memberData.firstName} ${memberData.lastName}`;
        
        // Obtener las membresías del miembro
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        membershipsSnapshot.forEach((membershipDoc) => {
          const data = membershipDoc.data() as MembershipAssignment;
          totalCount++;
          
          // Verificar estado
          const endDate = new Date(data.endDate);
          const daysUntilExpiration = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (data.status === 'active' && daysUntilExpiration >= 0) {
            activeCount++;
            if (daysUntilExpiration <= 7) {
              expiringSoonCount++;
            }
          } else if (data.status === 'expired' || daysUntilExpiration < 0) {
            expiredCount++;
          }
          
          // Verificar auto-renovación
          if (data.autoRenewal === true) {
            withAutoRenewalCount++;
          }
          
          // Verificar pagos pendientes
          if (data.paymentStatus === 'pending') {
            pendingPaymentsCount++;
            totalDebtAmount += data.cost || 0;
          }
        });
      }
      
      setStats({
        total: totalCount,
        active: activeCount,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
        withAutoRenewal: withAutoRenewalCount,
        pendingPayments: pendingPaymentsCount,
        totalDebt: totalDebtAmount
      });
      
      console.log('✅ Estadísticas cargadas:', {
        total: totalCount,
        active: activeCount,
        expired: expiredCount
      });
      
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
      setError('Error al cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Cargar membresías vencidas ESTRUCTURA CORRECTA
  const loadExpiredMemberships = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoadingExpired(true);
      
      // Obtener todos los miembros
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const today = new Date();
      const expiredList: ExpiredMembershipWithDetails[] = [];
      
      // Por cada miembro, obtener sus membresías
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const memberName = `${memberData.firstName} ${memberData.lastName}`;
        const memberId = memberDoc.id;
        
        // Obtener las membresías del miembro
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        membershipsSnapshot.forEach((membershipDoc) => {
          const data = membershipDoc.data() as MembershipAssignment;
          const endDate = new Date(data.endDate);
          const daysExpired = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Solo incluir si está realmente vencida
          if (daysExpired > 0 && data.status !== 'cancelled') {
            expiredList.push({
              ...data,
              id: membershipDoc.id,
              memberId: memberId, // Asegurar que tenga el memberId
              memberName: memberName, // Usar el nombre del miembro
              daysExpired,
              totalDebt: data.paymentStatus === 'pending' ? (data.cost || 0) : 0
            });
          }
        });
      }
      
      // Ordenar por días vencidos (más tiempo primero)
      expiredList.sort((a, b) => b.daysExpired - a.daysExpired);
      
      setExpiredMemberships(expiredList);
      console.log(`✅ Cargadas ${expiredList.length} membresías vencidas`);
      
    } catch (err) {
      console.error('Error cargando membresías vencidas:', err);
      setError('Error al cargar las membresías vencidas');
    } finally {
      setLoadingExpired(false);
    }
  };

  // 🔄 Cargar todas las membresías para gestionar ESTRUCTURA CORRECTA
  const loadAllMemberships = async () => {
    if (!gymData?.id) return;
    
    try {
      setLoading(true);
      
      // Obtener todos los miembros
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnapshot = await getDocs(membersRef);
      
      const membershipsList: ManageMembership[] = [];
      const today = new Date();
      
      // Por cada miembro, obtener sus membresías
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const memberName = `${memberData.firstName} ${memberData.lastName}`;
        const memberId = memberDoc.id;
        const memberEmail = memberData.email || '';
        const memberPhone = memberData.phone || '';
        
        // Obtener las membresías del miembro
        const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
        const membershipsSnapshot = await getDocs(membershipsRef);
        
        membershipsSnapshot.forEach((membershipDoc) => {
          const data = membershipDoc.data() as MembershipAssignment;
          const endDate = new Date(data.endDate);
          const daysUntilExpiration = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Solo incluir membresías activas o vencidas (no canceladas)
          if (data.status !== 'cancelled') {
            membershipsList.push({
              ...data,
              id: membershipDoc.id,
              memberId: memberId,
              memberName: memberName,
              memberEmail: memberEmail,
              memberPhone: memberPhone,
              daysUntilExpiration
            });
          }
        });
      }
      
      // Ordenar por fecha de vencimiento
      membershipsList.sort((a, b) => {
        const dateA = new Date(a.endDate).getTime();
        const dateB = new Date(b.endDate).getTime();
        return dateA - dateB;
      });
      
      setAllMemberships(membershipsList);
      console.log(`✅ Cargadas ${membershipsList.length} membresías totales`);
      
    } catch (err) {
      console.error('Error cargando membresías:', err);
      setError('Error al cargar las membresías');
    } finally {
      setLoading(false);
    }
  };

  // 🔄 CORREGIR: Renovar membresía - necesita el memberId
  const handleRenewMembership = async (membershipId: string, months: number = 1) => {
    if (!gymData?.id) return;
    
    setRenewalInProgress(prev => [...prev, membershipId]);
    setError('');
    setSuccess('');
    
    try {
      // Encontrar la membresía en la lista para obtener el memberId
      const membership = [...expiredMemberships, ...allMemberships].find(m => m.id === membershipId);
      
      if (!membership || !membership.memberId) {
        throw new Error('No se pudo encontrar la información del miembro');
      }
      
      // Usar la función correcta con la estructura de Firebase
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships/${membershipId}`);
      const membershipSnap = await getDoc(membershipRef);
      
      if (!membershipSnap.exists()) {
        throw new Error('Membresía no encontrada');
      }
      
      const membershipData = membershipSnap.data();
      
      // Obtener precio actual si es posible
      let currentPrice = membershipData.cost;
      
      // Calcular fechas
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + months);
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Crear nueva membresía con deuda pendiente
      const newMembershipData = {
        ...membershipData,
        startDate: startDate,
        endDate: endDateStr,
        cost: currentPrice,
        status: 'active',
        paymentStatus: 'pending', // SIEMPRE pendiente
        renewedAt: new Date().toISOString(),
        renewedManually: true,
        previousMembershipId: membershipId
      };
      
      // Agregar la nueva membresía
      const newMembershipRef = await addDoc(
        collection(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships`),
        newMembershipData
      );
      
      // Marcar la anterior como renovada
      await updateDoc(membershipRef, {
        status: 'renewed',
        renewedToId: newMembershipRef.id,
        renewedAt: new Date().toISOString()
      });
      
      setSuccess(`Membresía renovada por ${months} ${months === 1 ? 'mes' : 'meses'}. Se generó una deuda pendiente de pago.`);
      
      // Recargar datos
      await Promise.all([loadStats(), loadExpiredMemberships()]);
      
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('Error renovando membresía:', err);
      setError(err.message || 'Error al renovar la membresía');
    } finally {
      setRenewalInProgress(prev => prev.filter(id => id !== membershipId));
    }
  };

  // 💰 CORREGIR: Registrar pago - necesita el memberId
  const handleRegisterPayment = async (membershipId: string) => {
    if (!gymData?.id || !userData?.id) return;
    
    setPaymentInProgress(prev => [...prev, membershipId]);
    setError('');
    setSuccess('');
    
    try {
      // Encontrar la membresía en la lista para obtener el memberId
      const membership = allMemberships.find(m => m.id === membershipId);
      
      if (!membership || !membership.memberId) {
        throw new Error('No se pudo encontrar la información del miembro');
      }
      
      // Usar la estructura correcta de Firebase
      const membershipRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships/${membershipId}`);
      
      // Actualizar el estado de pago
      await updateDoc(membershipRef, {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
        paidBy: userData.id
      });
      
      // Actualizar deuda del miembro
      const memberRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}`);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        const memberData = memberSnap.data();
        const currentDebt = memberData.totalDebt || 0;
        const newDebt = Math.max(0, currentDebt - membership.cost);
        
        await updateDoc(memberRef, {
          totalDebt: newDebt,
          lastPaymentDate: new Date().toISOString()
        });
      }
      
      // Registrar en caja diaria
      const today = new Date().toISOString().split('T')[0];
      const transactionData = {
        type: 'income',
        category: 'membership',
        amount: membership.cost,
        description: `Pago de membresía: ${membership.activityName} - ${membership.memberName}`,
        memberId: membership.memberId,
        memberName: membership.memberName,
        membershipId: membershipId,
        date: new Date().toISOString(),
        userId: userData.id,
        userName: userData.name || userData.email || 'Usuario',
        paymentMethod: 'cash',
        status: 'completed',
        notes: 'Pago registrado desde dashboard de renovaciones',
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, `gyms/${gymData.id}/transactions`), transactionData);
      
      setSuccess('Pago registrado exitosamente. Movimiento agregado a caja diaria.');
      
      // Recargar datos
      await Promise.all([
        loadStats(),
        activeTab === 'manage' && loadAllMemberships()
      ]);
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('Error registrando pago:', err);
      setError(err.message || 'Error al registrar el pago');
    } finally {
      setPaymentInProgress(prev => prev.filter(id => id !== membershipId));
    }
  };

  // 🔄 Renovación masiva
  const handleMassiveRenewal = async () => {
    if (!gymData?.id || selectedMemberships.length === 0) return;
    
    setError('');
    setSuccess('');
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const membershipId of selectedMemberships) {
        try {
          const result = await renewExpiredMembership(
            gymData.id,
            membershipId,
            1 // Siempre 1 mes en renovación masiva
          );
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          
        } catch (err) {
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        setSuccess(`${successCount} membresías renovadas por 1 mes con deuda pendiente.`);
      }
      if (errorCount > 0) {
        setError(`${errorCount} membresías no pudieron renovarse`);
      }
      
      setSelectedMemberships([]);
      await Promise.all([loadStats(), loadExpiredMemberships()]);
      
    } catch (err) {
      console.error('Error en renovación masiva:', err);
      setError('Error en la renovación masiva');
    }
  };

  // Filtrar membresías en gestionar
  const getFilteredMemberships = () => {
    let filtered = [...allMemberships];
    
    // Filtro de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.memberName.toLowerCase().includes(term) ||
        m.activityName.toLowerCase().includes(term) ||
        m.memberEmail?.toLowerCase().includes(term)
      );
    }
    
    // Filtro de estado
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        filtered = filtered.filter(m => m.paymentStatus === 'pending');
      } else if (statusFilter === 'expired') {
        filtered = filtered.filter(m => (m.daysUntilExpiration || 0) < 0);
      } else if (statusFilter === 'active') {
        filtered = filtered.filter(m => m.status === 'active' && (m.daysUntilExpiration || 0) >= 0);
      }
    }
    
    // Filtro de pago
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(m => m.paymentStatus === paymentFilter);
    }
    
    return filtered;
  };

  // Efectos
  useEffect(() => {
    if (gymData?.id) {
      loadStats();
    }
  }, [gymData?.id]);

  useEffect(() => {
    if (gymData?.id && activeTab === 'expired') {
      loadExpiredMemberships();
    } else if (gymData?.id && activeTab === 'manage') {
      loadAllMemberships();
    }
  }, [gymData?.id, activeTab]);

  // Funciones auxiliares
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  const getDaysExpiredColor = (days: number) => {
    if (days <= 7) return 'text-yellow-600 bg-yellow-50';
    if (days <= 30) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getDaysUntilExpirationColor = (days: number) => {
    if (days < 0) return 'bg-red-100 text-red-800';
    if (days <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  if (loading && activeTab === 'overview') {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span>Cargando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Renovaciones</h1>
          <p className="text-gray-600">Dashboard unificado para el control de membresías</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadStats();
              if (activeTab === 'expired') loadExpiredMemberships();
              if (activeTab === 'manage') loadAllMemberships();
            }}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw size={16} className="mr-1" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <AlertTriangle size={16} className="mr-2" />
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <CheckCircle size={16} className="mr-2" />
            {success}
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Resumen', icon: TrendingUp },
            { key: 'expired', label: 'Vencidas', icon: AlertTriangle, badge: stats.expired },
            { key: 'manage', label: 'Gestionar', icon: Users },
            { key: 'reports', label: 'Reportes', icon: Download }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} className="mr-2" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* PESTAÑA RESUMEN */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Estadísticas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Users className="text-blue-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Activas</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <AlertTriangle className="text-red-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Vencidas</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.expired}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Clock className="text-yellow-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Por Vencer</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.expiringSoon}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <RefreshCw className="text-purple-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Auto-Renov.</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.withAutoRenewal}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <DollarSign className="text-orange-600 mr-3" size={24} />
                <div>
                  <p className="text-sm font-medium text-gray-600">Deuda Total</p>
                  <p className="text-xl font-semibold text-gray-900">{formatCurrency(stats.totalDebt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas rápidas */}
          {stats.expired > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="text-red-600 mr-3" size={20} />
                  <div>
                    <h3 className="text-lg font-medium text-red-800">
                      {stats.expired} membresías vencidas requieren atención
                    </h3>
                    <p className="text-red-600">
                      Haz clic en la pestaña "Vencidas" para gestionarlas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('expired')}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Ver Vencidas
                </button>
              </div>
            </div>
          )}

          {stats.pendingPayments > 0 && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DollarSign className="text-orange-600 mr-3" size={20} />
                  <div>
                    <h3 className="text-lg font-medium text-orange-800">
                      {stats.pendingPayments} pagos pendientes
                    </h3>
                    <p className="text-orange-600">
                      Deuda total acumulada: {formatCurrency(stats.totalDebt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('manage');
                    setPaymentFilter('pending');
                  }}
                  className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                >
                  Ver Pendientes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA VENCIDAS */}
      {activeTab === 'expired' && (
        <div className="space-y-6">
          {/* Header con controles */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Membresías Vencidas ({expiredMemberships.length})
              </h2>
              <p className="text-gray-600">Renovaciones pendientes</p>
            </div>
            
            {selectedMemberships.length > 0 && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {selectedMemberships.length} seleccionadas
                </span>
                <button
                  onClick={handleMassiveRenewal}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Renovar por 1 Mes
                </button>
              </div>
            )}
          </div>

          {/* Buscador */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre o actividad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {expiredMemberships.length > 0 && (
              <button
                onClick={() => {
                  if (selectedMemberships.length === expiredMemberships.length) {
                    setSelectedMemberships([]);
                  } else {
                    setSelectedMemberships(expiredMemberships.map(m => m.id));
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {selectedMemberships.length === expiredMemberships.length ? 'Deseleccionar' : 'Seleccionar'} todas
              </button>
            )}
          </div>

          {/* Lista de vencidas */}
          {loadingExpired ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span>Cargando membresías vencidas...</span>
            </div>
          ) : expiredMemberships.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-lg shadow">
              <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ¡Excelente! No hay membresías vencidas
              </h3>
              <p className="text-gray-600">Todas las membresías están al día</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
              {expiredMemberships
                .filter(m => 
                  m.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.activityName.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((membership) => (
                  <div key={membership.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedMemberships.includes(membership.id)}
                          onChange={() => {
                            if (selectedMemberships.includes(membership.id)) {
                              setSelectedMemberships(selectedMemberships.filter(id => id !== membership.id));
                            } else {
                              setSelectedMemberships([...selectedMemberships, membership.id]);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              {membership.memberName}
                            </h4>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-600">
                              {membership.activityName}
                            </span>
                          </div>
                          
                          <div className="mt-1 flex items-center space-x-4 text-sm">
                            <span className="text-gray-500">
                              Venció: {formatDate(membership.endDate)}
                            </span>
                            <span className={`px-2 py-1 rounded-full ${getDaysExpiredColor(membership.daysExpired)}`}>
                              {membership.daysExpired} días vencida
                            </span>
                            <span className="text-gray-600">
                              Costo: {formatCurrency(membership.cost)}
                            </span>
                            {membership.paymentStatus === 'pending' && (
                              <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                                Pago pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRenewMembership(membership.id, 1)}
                        disabled={renewalInProgress.includes(membership.id)}
                        className="bg-green-600 text-white px-4 py-2 text-sm rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                      >
                        {renewalInProgress.includes(membership.id) ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <>
                            <RefreshCw size={14} className="mr-1" />
                            Renovar 1 Mes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA GESTIONAR */}
      {/* PESTAÑA GESTIONAR - MEJORADA */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Buscador de miembros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar miembro por nombre, email o actividad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={loadAllMemberships}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span>Cargando membresías...</span>
            </div>
          ) : (
            <MembershipManagementList 
              memberships={allMemberships}
              searchTerm={searchTerm}
              onRenew={handleRenewMembership}
              onPayment={handleRegisterPayment}
              renewalInProgress={renewalInProgress}
              paymentInProgress={paymentInProgress}
              gymId={gymData?.id || ''}
            />
          )}
        </div>
      )}

      {/* PESTAÑA REPORTES */}
      {activeTab === 'reports' && (
        <MonthlyReportGenerator />
      )}
    </div>
  );
};

const MembershipManagementList: React.FC<MembershipManagementProps> = ({
  memberships,
  searchTerm,
  onRenew,
  onPayment,
  renewalInProgress,
  paymentInProgress,
  gymId
}) => {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingMembership, setEditingMembership] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingChanges, setSavingChanges] = useState<string[]>([]);

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  // Agrupar membresías por miembro
  const membershipsByMember = memberships.reduce((acc, membership) => {
    const key = membership.memberId || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        memberName: membership.memberName,
        memberEmail: membership.memberEmail,
        memberPhone: membership.memberPhone,
        memberId: membership.memberId,
        memberships: []
      };
    }
    acc[key].memberships.push(membership);
    return acc;
  }, {} as Record<string, any>);

  // Filtrar miembros según búsqueda
  const filteredMembers = Object.entries(membershipsByMember).filter(([_, memberData]) => {
    const term = searchTerm.toLowerCase();
    return memberData.memberName.toLowerCase().includes(term) ||
           memberData.memberEmail?.toLowerCase().includes(term) ||
           memberData.memberships.some((m: any) => m.activityName.toLowerCase().includes(term));
  });

  // Guardar cambios en membresía
  const handleSaveChanges = async (membershipId: string, memberId: string) => {
    setSavingChanges(prev => [...prev, membershipId]);
    
    try {
      const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships/${membershipId}`);
      
      await updateDoc(membershipRef, {
        autoRenewal: editForm.autoRenewal,
        notes: editForm.notes || '',
        updatedAt: new Date().toISOString()
      });

      // Si se cambió el estado de pago
      if (editForm.paymentStatus !== undefined) {
        await updateDoc(membershipRef, {
          paymentStatus: editForm.paymentStatus
        });
      }

      setEditingMembership(null);
      setEditForm({});
      
      // Recargar datos (llamar a la función padre si es necesario)
      window.location.reload(); // Temporal - idealmente deberías llamar a una función de recarga
      
    } catch (error) {
      console.error('Error guardando cambios:', error);
    } finally {
      setSavingChanges(prev => prev.filter(id => id !== membershipId));
    }
  };

  // Cancelar membresía
  const handleCancelMembership = async (membershipId: string, memberId: string) => {
    if (!window.confirm('¿Estás seguro de cancelar esta membresía?')) return;
    
    try {
      const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships/${membershipId}`);
      
      await updateDoc(membershipRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      window.location.reload(); // Temporal
      
    } catch (error) {
      console.error('Error cancelando membresía:', error);
    }
  };

  const getDaysUntilExpirationColor = (days: number) => {
    if (days < 0) return 'bg-red-100 text-red-800';
    if (days <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-4">
      {filteredMembers.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <Users className="mx-auto text-gray-400" size={48} />
          <p className="text-gray-500 mt-2">No se encontraron miembros</p>
        </div>
      ) : (
        filteredMembers.map(([memberId, memberData]) => (
          <div key={memberId} className="bg-white rounded-lg shadow">
            {/* Header del miembro */}
            <div 
              className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedMember(expandedMember === memberId ? null : memberId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {memberData.memberName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{memberData.memberName}</h3>
                    <p className="text-sm text-gray-500">{memberData.memberEmail}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {memberData.memberships.length} membresía{memberData.memberships.length !== 1 ? 's' : ''}
                  </span>
                  <ChevronDown 
                    className={`transform transition-transform ${
                      expandedMember === memberId ? 'rotate-180' : ''
                    }`}
                    size={20}
                  />
                </div>
              </div>
            </div>

            {/* Membresías expandidas */}
            {expandedMember === memberId && (
              <div className="p-4 space-y-4">
                {memberData.memberships.map((membership: ManageMembership) => (
                  <div key={membership.id} className="border border-gray-200 rounded-lg p-4">
                    {editingMembership === membership.id ? (
                      // Modo edición
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{membership.activityName}</h4>
                            <p className="text-sm text-gray-500">
                              {formatDate(membership.startDate)} - {formatDate(membership.endDate)}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveChanges(membership.id, membership.memberId)}
                              disabled={savingChanges.includes(membership.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              {savingChanges.includes(membership.id) ? 
                                <RefreshCw className="animate-spin" size={18} /> :
                                <Save size={18} />
                              }
                            </button>
                            <button
                              onClick={() => {
                                setEditingMembership(null);
                                setEditForm({});
                              }}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Auto-renovación
                            </label>
                            <button
                              onClick={() => setEditForm({...editForm, autoRenewal: !editForm.autoRenewal})}
                              className={`flex items-center space-x-2 px-3 py-2 rounded-md ${
                                editForm.autoRenewal 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {editForm.autoRenewal ? 
                                <ToggleRight size={20} /> : 
                                <ToggleLeft size={20} />
                              }
                              <span>{editForm.autoRenewal ? 'Activada' : 'Desactivada'}</span>
                            </button>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Estado de pago
                            </label>
                            <select
                              value={editForm.paymentStatus}
                              onChange={(e) => setEditForm({...editForm, paymentStatus: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="paid">Pagado</option>
                              <option value="pending">Pendiente</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas
                          </label>
                          <textarea
                            value={editForm.notes || ''}
                            onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            rows={2}
                          />
                        </div>
                      </div>
                    ) : (
                      // Modo vista
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{membership.activityName}</h4>
                            <p className="text-sm text-gray-500">
                              {formatDate(membership.startDate)} - {formatDate(membership.endDate)}
                            </p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                getDaysUntilExpirationColor(membership.daysUntilExpiration || 0)
                              }`}>
                                {(membership.daysUntilExpiration || 0) < 0 
                                  ? `Vencida hace ${Math.abs(membership.daysUntilExpiration || 0)} días`
                                  : (membership.daysUntilExpiration || 0) === 0
                                  ? 'Vence hoy'
                                  : `Vence en ${membership.daysUntilExpiration} días`
                                }
                              </span>
                              
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                membership.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {membership.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                              </span>
                              
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                membership.autoRenewal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                Auto-renovación: {membership.autoRenewal ? 'Sí' : 'No'}
                              </span>
                            </div>

                            <div className="mt-2 text-sm text-gray-600">
                              Costo: {formatCurrency(membership.cost)}/mes
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditingMembership(membership.id);
                                setEditForm({
                                  autoRenewal: membership.autoRenewal,
                                  paymentStatus: membership.paymentStatus,
                                  notes: ''
                                });
                              }}
                              className="text-gray-600 hover:text-gray-900"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>

                            {(membership.daysUntilExpiration || 0) < 0 && (
                              <button
                                onClick={() => onRenew(membership.id, 1)}
                                disabled={renewalInProgress.includes(membership.id)}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50"
                                title="Renovar 1 mes"
                              >
                                {renewalInProgress.includes(membership.id) ? (
                                  <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                  <RefreshCw size={18} />
                                )}
                              </button>
                            )}

                            {membership.paymentStatus === 'pending' && (
                              <button
                                onClick={() => onPayment(membership.id)}
                                disabled={paymentInProgress.includes(membership.id)}
                                className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                title="Registrar pago"
                              >
                                {paymentInProgress.includes(membership.id) ? (
                                  <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                  <CreditCard size={18} />
                                )}
                              </button>
                            )}

                            {membership.status === 'active' && (
                              <button
                                onClick={() => handleCancelMembership(membership.id, membership.memberId)}
                                className="text-red-600 hover:text-red-700"
                                title="Cancelar membresía"
                              >
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default UnifiedRenewalDashboard;