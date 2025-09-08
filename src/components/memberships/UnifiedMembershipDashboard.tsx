import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  Clock,
  RefreshCw,
  CheckCircle,
  CreditCard,
  Settings,
  TrendingUp,
  Zap,
  Play,
  User,
  Activity,
  ToggleLeft,
  ToggleRight,
  Timer,
  X,
  Pause,
  Ban,
  RotateCcw,
  Search,
  Filter,
  History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Importar servicios existentes
import MonthlyPaymentsService from '../../services/monthlyPayments.service';
import AutoRenewalService from '../../services/autoRenewal.service';
import { formatCurrency } from '../../utils/formatting.utils';

interface UnifiedDashboardProps {
  currentMonth: string;
}

interface DashboardMetrics {
  totalToCollect: number;
  totalCollected: number;
  pendingPayments: number;
  collectionPercentage: number;
  autoRenewalMemberships: number;
  upcomingRenewals: number;
  expiredRenewals: number;
  totalActiveMembers: number;
}

interface MembershipItem {
  id: string;
  memberId: string;
  memberName: string;
  activityName: string;
  cost: number;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled';
  autoRenewal: boolean;
  isExpired: boolean;
  daysUntilExpiry: number;
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  maxAttendances?: number;
  currentAttendances?: number;
}

interface MemberWithMemberships {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  totalDebt: number;
  memberships: MembershipItem[];
}

interface ProcessProgress {
  current: number;
  total: number;
  stage: 'preparing' | 'processing' | 'completing' | 'done';
  currentItem: string;
  estimatedTimeRemaining: number;
}

// Componente de barra de progreso mejorada
const ProgressBar: React.FC<{
  progress: ProcessProgress;
  onCancel: () => void;
  showCancel: boolean;
}> = ({ progress, onCancel, showCancel }) => {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'preparing': return 'Preparando proceso...';
      case 'processing': return 'Procesando renovaciones...';
      case 'completing': return 'Finalizando...';
      case 'done': return 'Proceso completado';
      default: return 'Procesando...';
    }
  };

  return (
    <div className="bg-white border-l-4 border-blue-500 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-3">
            <Zap size={20} className="text-blue-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Proceso de Renovación en Curso
            </h3>
            <p className="text-sm text-gray-600">
              {getStageText(progress.stage)}
            </p>
          </div>
        </div>
        
        {showCancel && (
          <button
            onClick={onCancel}
            className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            <X size={16} className="mr-1" />
            Cancelar
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progreso: {progress.current} de {progress.total}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(percentage)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 transform -skew-x-12 animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center">
          <Activity size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Procesando:</span>
            <p className="font-medium text-gray-900 truncate">
              {progress.currentItem || 'Preparando...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Timer size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Tiempo estimado:</span>
            <p className="font-medium text-gray-900">
              {formatTime(progress.estimatedTimeRemaining)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Clock size={16} className="text-gray-400 mr-2" />
          <div>
            <span className="text-gray-500">Estado:</span>
            <p className="font-medium text-blue-600">
              {getStageText(progress.stage)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const UnifiedMembershipDashboard: React.FC<UnifiedDashboardProps> = ({ currentMonth }) => {
  const { gymData, userRole } = useAuth();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'renewals' | 'controls'>('dashboard');
  const [renewalSubTab, setRenewalSubTab] = useState<'upcoming' | 'expired' | 'history'>('upcoming');
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  
  // Estados de datos
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalToCollect: 0,
    totalCollected: 0,
    pendingPayments: 0,
    collectionPercentage: 0,
    autoRenewalMemberships: 0,
    upcomingRenewals: 0,
    expiredRenewals: 0,
    totalActiveMembers: 0
  });
  
  const [pendingPayments, setPendingPayments] = useState<MembershipItem[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<MembershipItem[]>([]);
  const [expiredRenewals, setExpiredRenewals] = useState<MembershipItem[]>([]);
  const [renewalHistory, setRenewalHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para control de socios y membresías
  const [members, setMembers] = useState<MemberWithMemberships[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithMemberships[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'with_active' | 'with_auto' | 'expired'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [processingIndividual, setProcessingIndividual] = useState<string | null>(null);

  // Estados para progreso con cancelación
  const [processProgress, setProcessProgress] = useState<ProcessProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState<boolean>(false);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [processStartTime, setProcessStartTime] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cargar datos al montar componente
  useEffect(() => {
    if (gymData?.id) {
      loadDashboardData();
      if (activeTab === 'controls') {
        loadMembersWithMemberships();
      }
    }
  }, [gymData?.id, currentMonth, activeTab]);

  // Aplicar filtros a miembros
  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter, membershipFilter]);

  // Limpiar mensajes después de un tiempo
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * 📊 Cargar datos del dashboard
   */
  const loadDashboardData = async () => {
    if (!gymData?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 Cargando datos del dashboard...');
      
      // Simular datos para demo (reemplazar con servicios reales)
      const mockMetrics = {
        totalToCollect: 150000,
        totalCollected: 120000,
        pendingPayments: 8,
        collectionPercentage: 80,
        autoRenewalMemberships: 45,
        upcomingRenewals: 12,
        expiredRenewals: 4,
        totalActiveMembers: 67
      };

      const mockUpcomingRenewals: MembershipItem[] = [
        {
          id: '1',
          memberId: 'member1',
          memberName: 'Juan Pérez',
          activityName: 'Musculación',
          cost: 25000,
          endDate: '2024-09-10',
          status: 'active',
          autoRenewal: true,
          isExpired: false,
          daysUntilExpiry: 3,
          maxAttendances: 20,
          currentAttendances: 15
        },
        {
          id: '2',
          memberId: 'member2',
          memberName: 'María García',
          activityName: 'Yoga',
          cost: 18000,
          endDate: '2024-09-12',
          status: 'active',
          autoRenewal: true,
          isExpired: false,
          daysUntilExpiry: 5,
          maxAttendances: 12,
          currentAttendances: 8
        }
      ];

      const mockExpiredRenewals: MembershipItem[] = [
        {
          id: '3',
          memberId: 'member3',
          memberName: 'Carlos López',
          activityName: 'CrossFit',
          cost: 35000,
          endDate: '2024-09-05',
          status: 'active',
          autoRenewal: true,
          isExpired: true,
          daysUntilExpiry: -2,
          maxAttendances: 16,
          currentAttendances: 16
        },
        {
          id: '4',
          memberId: 'member4',
          memberName: 'Ana Martínez',
          activityName: 'Pilates',
          cost: 22000,
          endDate: '2024-09-03',
          status: 'active',
          autoRenewal: true,
          isExpired: true,
          daysUntilExpiry: -4,
          maxAttendances: 12,
          currentAttendances: 10
        }
      ];

      const mockPendingPayments: MembershipItem[] = [
        {
          id: '5',
          memberId: 'member5',
          memberName: 'Roberto Silva',
          activityName: 'Natación',
          cost: 28000,
          endDate: '2024-09-15',
          status: 'active',
          autoRenewal: false,
          isExpired: false,
          daysUntilExpiry: 8,
          paymentStatus: 'pending'
        }
      ];
      
      setMetrics(mockMetrics);
      setUpcomingRenewals(mockUpcomingRenewals);
      setExpiredRenewals(mockExpiredRenewals);
      setPendingPayments(mockPendingPayments);
      
    } catch (err: any) {
      console.error('❌ Error cargando datos del dashboard:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📋 Cargar todos los socios con sus membresías (para pestaña controles)
   */
  const loadMembersWithMemberships = async () => {
    if (!gymData?.id) return;
    
    try {
      console.log('🔄 Cargando socios con membresías...');
      
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const membersSnap = await getDocs(membersRef);
      
      const membersData: MemberWithMemberships[] = [];
      
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        
        // Cargar membresías del socio
        const membershipRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
        const membershipSnap = await getDocs(membershipRef);
        
        const memberships: MembershipItem[] = membershipSnap.docs.map(membershipDoc => ({
          id: membershipDoc.id,
          memberId: memberDoc.id,
          memberName: `${memberData.firstName} ${memberData.lastName}`,
          activityName: membershipDoc.data().activityName || 'Actividad',
          cost: membershipDoc.data().cost || 0,
          endDate: membershipDoc.data().endDate || '',
          status: membershipDoc.data().status || 'active',
          autoRenewal: membershipDoc.data().autoRenewal || false,
          isExpired: false,
          daysUntilExpiry: 0,
          maxAttendances: membershipDoc.data().maxAttendances || 0,
          currentAttendances: membershipDoc.data().currentAttendances || 0
        }));
        
        membersData.push({
          id: memberDoc.id,
          firstName: memberData.firstName || 'Sin nombre',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          status: memberData.status || 'active',
          totalDebt: memberData.totalDebt || 0,
          memberships
        });
      }
      
      // Ordenar por nombre
      membersData.sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
      
      setMembers(membersData);
      
    } catch (err: any) {
      console.error('❌ Error cargando socios:', err);
      setError('Error al cargar los datos de socios');
    }
  };

  /**
   * 🔍 Filtrar miembros según criterios
   */
  const filterMembers = () => {
    let filtered = [...members];
    
    // Filtro por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.memberships.some(m => m.activityName.toLowerCase().includes(term))
      );
    }
    
    // Filtro por estado del socio
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }
    
    // Filtro por membresías
    if (membershipFilter === 'with_active') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.status === 'active')
      );
    } else if (membershipFilter === 'with_auto') {
      filtered = filtered.filter(member => 
        member.memberships.some(m => m.autoRenewal && m.status === 'active')
      );
    } else if (membershipFilter === 'expired') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(member => 
        member.memberships.some(m => {
          const endDate = new Date(m.endDate);
          return endDate <= today && m.status === 'active';
        })
      );
    }
    
    setFilteredMembers(filtered);
  };

  /**
   * 🔄 Procesar renovaciones con progreso
   */
  const processAllRenewalsWithProgress = async () => {
    if (!gymData?.id || expiredRenewals.length === 0) return;
    
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      setShowProgress(true);
      setProcessStartTime(new Date());
      setCancelRequested(false);
      
      abortControllerRef.current = new AbortController();
      
      const totalItems = expiredRenewals.length;
      let processedCount = 0;
      const renewedMemberships: MembershipItem[] = [];
      const errors: string[] = [];
      
      // Función para actualizar progreso
      const updateProgress = (current: number, total: number, currentItem: string, stage: 'preparing' | 'processing' | 'completing' | 'done') => {
        if (cancelRequested) return;
        
        const elapsed = (Date.now() - (processStartTime?.getTime() || Date.now())) / 1000;
        const itemsPerSecond = current / Math.max(elapsed, 1);
        const remainingItems = Math.max(0, total - current);
        const estimatedTimeRemaining = remainingItems / Math.max(itemsPerSecond, 0.1);
        
        setProcessProgress({
          current,
          total,
          stage,
          currentItem,
          estimatedTimeRemaining
        });
      };
      
      // Fase 1: Preparación
      updateProgress(0, totalItems, 'Inicializando proceso...', 'preparing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (cancelRequested) throw new Error('Proceso cancelado');
      
      // Fase 2: Procesar cada membresía
      for (const membership of expiredRenewals) {
        if (cancelRequested) throw new Error('Proceso cancelado');
        
        try {
          processedCount++;
          updateProgress(
            processedCount, 
            totalItems, 
            `${membership.memberName} - ${membership.activityName}`, 
            'processing'
          );
          
          // Simular renovación (aquí iría la lógica real)
          await new Promise(resolve => setTimeout(resolve, 800));
          renewedMemberships.push(membership);
          
        } catch (err: any) {
          console.error(`❌ Error renovando ${membership.memberName}:`, err);
          errors.push(`${membership.memberName}: ${err.message}`);
        }
      }
      
      if (cancelRequested) throw new Error('Proceso cancelado');
      
      // Fase 3: Finalizando
      updateProgress(totalItems, totalItems, 'Finalizando proceso...', 'completing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fase 4: Completado
      updateProgress(totalItems, totalItems, 'Proceso completado', 'done');
      
      const renewedCount = renewedMemberships.length;
      setSuccess(`Proceso completado exitosamente:
• ${renewedCount} membresías renovadas automáticamente
${errors.length > 0 ? `• ${errors.length} errores encontrados` : ''}`);
      
      // Recargar datos
      await loadDashboardData();
      
      // Ocultar progreso después de 2 segundos
      setTimeout(() => {
        setShowProgress(false);
        setProcessProgress(null);
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ Error procesando renovaciones:', err);
      if (err.message === 'Proceso cancelado') {
        setError('Proceso cancelado por el usuario');
      } else {
        setError(err.message || 'Error procesando renovaciones');
      }
      setShowProgress(false);
      setProcessProgress(null);
    } finally {
      setProcessing(false);
      setCancelRequested(false);
    }
  };

  /**
   * 🔄 Cancelar proceso
   */
  const cancelProcess = () => {
    setCancelRequested(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setProcessing(false);
    setShowProgress(false);
    setProcessProgress(null);
    setError('Proceso cancelado por el usuario');
  };

  /**
   * 🔄 Cambiar estado del socio
   */
  const updateMemberStatus = async (memberId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    setUpdating(memberId);
    setError(null);
    
    try {
      const memberRef = doc(db, `gyms/${gymData!.id}/members/${memberId}`);
      await updateDoc(memberRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, status: newStatus }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      setSuccess(`Estado de ${member?.firstName} ${member?.lastName} cambiado a ${newStatus}`);
      
    } catch (err: any) {
      console.error('❌ Error actualizando estado del socio:', err);
      setError('Error al actualizar el estado del socio');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Cambiar estado de membresía específica
   */
  const updateMembershipStatus = async (memberId: string, membershipId: string, newStatus: 'active' | 'paused' | 'cancelled') => {
    setUpdating(`${memberId}-${membershipId}`);
    setError(null);
    
    try {
      const membershipRef = doc(db, `gyms/${gymData!.id}/members/${memberId}/memberships/${membershipId}`);
      await updateDoc(membershipRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId
            ? {
                ...member,
                memberships: member.memberships.map(membership =>
                  membership.id === membershipId
                    ? { ...membership, status: newStatus }
                    : membership
                )
              }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      setSuccess(`Membresía ${membership?.activityName} de ${member?.firstName} actualizada a: ${newStatus}`);
      
    } catch (err: any) {
      console.error('❌ Error actualizando membresía:', err);
      setError('Error al actualizar la membresía');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Cambiar auto-renovación de membresía
   */
  const toggleAutoRenewal = async (memberId: string, membershipId: string, currentAutoRenewal: boolean) => {
    setUpdating(`${memberId}-${membershipId}-auto`);
    setError(null);
    
    try {
      const membershipRef = doc(db, `gyms/${gymData!.id}/members/${memberId}/memberships/${membershipId}`);
      await updateDoc(membershipRef, {
        autoRenewal: !currentAutoRenewal,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? {
                ...member,
                memberships: member.memberships.map(membership =>
                  membership.id === membershipId
                    ? { ...membership, autoRenewal: !currentAutoRenewal }
                    : membership
                )
              }
            : member
        )
      );
      
      const member = members.find(m => m.id === memberId);
      const membership = member?.memberships.find(m => m.id === membershipId);
      setSuccess(`Auto-renovación de ${membership?.activityName} ${!currentAutoRenewal ? 'activada' : 'desactivada'}`);
      
    } catch (err: any) {
      console.error('❌ Error cambiando auto-renovación:', err);
      setError('Error al cambiar la auto-renovación');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * 🔄 Renovar membresía individual
   */
  const renewIndividualMembership = async (membership: MembershipItem) => {
    if (!gymData?.id || !membership.id || !membership.memberId) return;
    
    try {
      setProcessingIndividual(membership.id);
      setError(null);
      
      // Simular renovación individual
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSuccess(`Membresía ${membership.activityName} renovada exitosamente`);
      
      // Recargar datos
      await loadDashboardData();
      
    } catch (err: any) {
      console.error('Error renovando membresía individual:', err);
      setError(`Error renovando ${membership.activityName}: ${err.message}`);
    } finally {
      setProcessingIndividual(null);
    }
  };

  /**
   * 🎨 Obtener estilo para estado del socio
   */
  const getMemberStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 🎨 Obtener estilo para estado de membresía
   */
  const getMembershipStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

   /**
   * 🎨 Obtener estilo para estado de renovación
   */
  const getRenewalStatus = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const membershipEndDate = new Date(endDate);
    const diffTime = membershipEndDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'vencida', color: 'bg-red-100 text-red-800', days: Math.abs(diffDays) };
    } else if (diffDays === 0) {
      return { status: 'hoy', color: 'bg-orange-100 text-orange-800', days: 0 };
    } else if (diffDays <= 3) {
      return { status: 'pronto', color: 'bg-yellow-100 text-yellow-800', days: diffDays };
    } else {
      return { status: 'normal', color: 'bg-green-100 text-green-800', days: diffDays };
    }
  };

  /**
   * 📅 Formatear fecha
   */
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR');
    } catch {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin mr-3" size={24} />
        <span className="text-gray-600">Cargando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="text-red-600 mr-3" size={20} />
            <span className="text-red-800 whitespace-pre-line">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-3" size={20} />
            <span className="text-green-800 whitespace-pre-line">{success}</span>
          </div>
        </div>
      )}

      {/* Barra de progreso para renovaciones */}
      {showProgress && processProgress && (
        <ProgressBar
          progress={processProgress}
          onCancel={cancelProcess}
          showCancel={processing && !cancelRequested}
        />
      )}

      {/* Navegación por pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
            { id: 'payments', label: 'Pagos Pendientes', icon: DollarSign },
            { id: 'renewals', label: 'Renovaciones', icon: RefreshCw },
            { id: 'controls', label: 'Controles', icon: Settings }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="mr-2" size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido de las pestañas */}
      <div>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total a Cobrar
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(metrics.totalToCollect)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Cobrado
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(metrics.totalCollected)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Socios Activos
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.totalActiveMembers}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <RefreshCw className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Auto-renovaciones
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.autoRenewalMemberships}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {/* Implementar lógica */}}
                  disabled={processing}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="animate-spin mr-2" size={16} />
                  ) : (
                    <DollarSign className="mr-2" size={16} />
                  )}
                  Procesar Cobros Automáticos
                </button>

                <button
                  onClick={processAllRenewalsWithProgress}
                  disabled={processing || expiredRenewals.length === 0}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="animate-spin mr-2" size={16} />
                  ) : (
                    <RefreshCw className="mr-2" size={16} />
                  )}
                  {processing ? 'Procesando...' : `Procesar ${expiredRenewals.length} Renovaciones`}
                </button>
              </div>
            </div>

            {/* Resumen ejecutivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Sistema Inteligente de Precios</h4>
                <p className="text-sm text-blue-700">
                  Las renovaciones automáticas ahora consultan el precio actual de cada actividad.
                  Esto significa que los aumentos de precios se aplican automáticamente sin intervención manual.
                  Progreso actual: {metrics.collectionPercentage.toFixed(1)}%
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Renovaciones Automáticas</h4>
                <p className="text-sm text-green-700">
                  {metrics.autoRenewalMemberships} membresías tienen auto-renovación habilitada con actualización automática de precios. 
                  {metrics.expiredRenewals > 0 
                    ? ` ${metrics.expiredRenewals} requieren procesamiento inmediato.`
                    : ' Todas están al día.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">
              Pagos Pendientes - {currentMonth}
            </h3>
            
            {pendingPayments.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay pagos pendientes
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Todos los cobros del mes están al día
                </p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {pendingPayments.map((payment) => (
                    <li key={payment.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <User className="h-10 w-10 text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {payment.memberName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {payment.activityName} - {formatCurrency(payment.cost)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pendiente
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'renewals' && (
          <div className="space-y-6">
            {/* Sub-navegación para renovaciones */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'upcoming', label: 'Próximas', count: upcomingRenewals.length },
                  { id: 'expired', label: 'Vencidas', count: expiredRenewals.length },
                  { id: 'history', label: 'Historial', count: renewalHistory.length }
                ].map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setRenewalSubTab(id as any)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      renewalSubTab === id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        id === 'expired' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {renewalSubTab === 'upcoming' && (
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">
                  Renovaciones Próximas (7 días)
                </h4>
                {upcomingRenewals.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No hay renovaciones próximas
                    </h3>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membresía</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {upcomingRenewals.map((renewal) => {
                          const renewalStatus = getRenewalStatus(renewal.endDate);
                          
                          return (
                            <tr key={renewal.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <User className="text-gray-400 mr-2" size={16} />
                                  <div className="text-sm font-medium text-gray-900">
                                    {renewal.memberName}
                                  </div>
                                </div>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{renewal.activityName}</div>
                                <div className="text-sm text-gray-500">
                                  {renewal.maxAttendances && renewal.maxAttendances > 0 
                                    ? `${renewal.currentAttendances}/${renewal.maxAttendances} asistencias`
                                    : 'Ilimitado'
                                  }
                                </div>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{formatDate(renewal.endDate)}</div>
                                <div className="text-xs text-gray-500">
                                  {renewalStatus.days === 0 
                                    ? 'Vence hoy' 
                                    : renewalStatus.days > 0 
                                      ? `${renewalStatus.days} días restantes` 
                                      : `Vencida hace ${renewalStatus.days} días`
                                  }
                                </div>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${renewalStatus.color}`}>
                                  <RefreshCw size={12} className="mr-1" />
                                  {renewalStatus.status === 'vencida' ? 'Vencida' :
                                   renewalStatus.status === 'hoy' ? 'Vence hoy' :
                                   renewalStatus.status === 'pronto' ? 'Vence pronto' : 'Programada'}
                                </span>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center text-sm text-gray-900">
                                  <DollarSign size={14} className="mr-1" />
                                  {formatCurrency(renewal.cost)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {renewalSubTab === 'expired' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">
                    Membresías Vencidas con Renovación Automática
                  </h4>
                  {expiredRenewals.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-gray-500">
                        {expiredRenewals.length} membresías pendientes
                      </div>
                      <button
                        onClick={processAllRenewalsWithProgress}
                        disabled={processing}
                        className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        {processing ? (
                          <RefreshCw size={16} className="animate-spin mr-2" />
                        ) : (
                          <Zap size={16} className="mr-2" />
                        )}
                        {processing ? 'Procesando...' : `Renovar Todas (${expiredRenewals.length})`}
                      </button>
                    </div>
                  )}
                </div>
                
                {expiredRenewals.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Todas las renovaciones al día</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No hay membresías vencidas pendientes de renovación automática.
                    </p>
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700">
                        Excelente! Todas las membresías con renovación automática están al día.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertTriangle className="text-red-600 mr-2" size={20} />
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            Atención requerida
                          </p>
                          <p className="text-sm text-red-600">
                            Estas membresías están vencidas y requieren renovación automática
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membresía</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {expiredRenewals.map((renewal) => (
                            <tr key={renewal.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {renewal.memberName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {renewal.activityName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(renewal.endDate)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  Vencida
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(renewal.cost)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => renewIndividualMembership(renewal)}
                                  disabled={processingIndividual === renewal.id}
                                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                                >
                                  {processingIndividual === renewal.id ? (
                                    <RefreshCw size={12} className="animate-spin mr-1" />
                                  ) : (
                                    <RotateCcw size={12} className="mr-1" />
                                  )}
                                  {processingIndividual === renewal.id ? 'Renovando...' : 'Renovar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {renewalSubTab === 'history' && (
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">
                  Historial de Procesos de Renovación
                </h4>
                <div className="text-center py-8">
                  <History className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin historial</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se han ejecutado procesos de renovación aún.
                  </p>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      El historial aparecerá aquí después de ejecutar el primer proceso de renovación.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertTriangle className="text-blue-600 mt-1" size={16} />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">
                    Importante: Lógica de Automatización
                  </h4>
                  <div className="text-sm text-blue-800 mt-1 space-y-1">
                    <p>• <strong>Socio Inactivo:</strong> NO genera ninguna cuota automática</p>
                    <p>• <strong>Membresía Pausada:</strong> NO genera cuota para esa actividad</p>
                    <p>• <strong>Membresía Cancelada:</strong> NO genera cuota nunca más</p>
                    <p>• <strong>Auto-renovación OFF:</strong> NO genera cuota aunque esté activa</p>
                    <p>• <strong>Precio actualizado:</strong> Siempre usa el precio actual de la actividad</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros y búsqueda */}
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar socio o actividad..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                    <option value="suspended">Suspendidos</option>
                  </select>
                  
                  <select
                    value={membershipFilter}
                    onChange={(e) => setMembershipFilter(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todas las membresías</option>
                    <option value="with_active">Con membresías activas</option>
                    <option value="with_auto">Con auto-renovación</option>
                    <option value="expired">Membresías vencidas</option>
                  </select>
                  
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setMembershipFilter('all');
                    }}
                    className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <X size={16} className="mr-1" />
                    Limpiar
                  </button>
                  
                  <button
                    onClick={loadMembersWithMemberships}
                    disabled={loading}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de socios con controles */}
            <div className="space-y-4">
              {filteredMembers.map((member) => (
                <div key={member.id} className="bg-white rounded-lg shadow border">
                  {/* Header del socio */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <User size={24} className="text-gray-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          {member.totalDebt > 0 && (
                            <p className="text-sm text-red-600">
                              Deuda: {formatCurrency(member.totalDebt)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Control de estado del socio */}
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">Estado:</span>
                        <select
                          value={member.status}
                          onChange={(e) => updateMemberStatus(member.id, e.target.value as any)}
                          disabled={updating === member.id}
                          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                          <option value="suspended">Suspendido</option>
                        </select>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMemberStatusStyle(member.status)}`}>
                          {member.status === 'active' ? 'Activo' : 
                           member.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Membresías del socio */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Membresías ({member.memberships.length})
                    </h4>
                    
                    {member.memberships.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Sin membresías activas</p>
                    ) : (
                      <div className="space-y-2">
                        {member.memberships.map((membership) => (
                          <div key={membership.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            {/* Info de la membresía */}
                            <div className="flex items-center space-x-4">
                              <Activity size={16} className="text-gray-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {membership.activityName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(membership.cost)} • Vence: {formatDate(membership.endDate)}
                                </p>
                              </div>
                            </div>

                            {/* Controles de la membresía */}
                            <div className="flex items-center space-x-4">
                              {/* Estado */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-600">Estado:</span>
                                <select
                                  value={membership.status}
                                  onChange={(e) => updateMembershipStatus(member.id, membership.id, e.target.value as any)}
                                  disabled={updating === `${member.id}-${membership.id}`}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="active">Activa</option>
                                  <option value="paused">Pausada</option>
                                  <option value="cancelled">Cancelada</option>
                                </select>
                              </div>

                              {/* Auto-renovación */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-600">Auto-reno:</span>
                                <button
                                  onClick={() => toggleAutoRenewal(member.id, membership.id, membership.autoRenewal)}
                                  disabled={updating === `${member.id}-${membership.id}-auto`}
                                  className={`p-1 rounded transition-colors ${membership.autoRenewal ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}`}
                                  title={`Auto-renovación: ${membership.autoRenewal ? 'Activada' : 'Desactivada'}`}
                                >
                                  {updating === `${member.id}-${membership.id}-auto` ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                  ) : membership.autoRenewal ? (
                                    <ToggleRight size={20} />
                                  ) : (
                                    <ToggleLeft size={20} />
                                  )}
                                </button>
                              </div>

                              {/* Badge de estado */}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMembershipStatusStyle(membership.status)}`}>
                                {membership.status === 'active' ? 'Activa' : 
                                 membership.status === 'paused' ? 'Pausada' : 'Cancelada'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen final */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen de Estados</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Socios Activos:</p>
                  <p className="font-semibold text-green-600">{filteredMembers.filter(m => m.status === 'active').length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Socios Inactivos:</p>
                  <p className="font-semibold text-gray-600">{filteredMembers.filter(m => m.status === 'inactive').length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Membresías Activas:</p>
                  <p className="font-semibold text-blue-600">
                    {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.status === 'active').length, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Con Auto-renovación:</p>
                  <p className="font-semibold text-purple-600">
                    {filteredMembers.reduce((sum, m) => sum + m.memberships.filter(mb => mb.autoRenewal && mb.status === 'active').length, 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-full mr-4">
                  <Settings className="text-blue-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Consejos para Control de Estados
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Estados de Socios</h4>
                      <p>Usa "Inactivo" para socios que temporalmente no asisten. "Suspendido" para casos disciplinarios.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Auto-renovación</h4>
                      <p>Activa la auto-renovación para membresías regulares. Desactiva para casos especiales.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Filtros útiles</h4>
                      <p>Usa "Con auto-renovación" para revisar qué membresías se renovarán automáticamente.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Monitoreo</h4>
                      <p>Revisa regularmente las membresías vencidas para mantener el sistema actualizado.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedMembershipDashboard;