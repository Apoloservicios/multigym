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
  increment,getCountFromServer  
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
  onToggleActive?: (id: string, memberId: string, currentActive: boolean) => Promise<void>; // Nueva prop
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
  active?: boolean; // Agregar campo active

}

  const UnifiedRenewalDashboard: React.FC = () => {
  const { gymData, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'expired' | 'manage' | 'reports'>('overview');

    // Estados adicionales para filtros y paginación (agregar al inicio del componente)
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10); // 10 items por página
  
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
  
  const [expiredPage, setExpiredPage] = useState<number>(1);
const [expiredItemsPerPage] = useState<number>(20); // 20 items por página
const [expiredSearchTerm, setExpiredSearchTerm] = useState<string>('');

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




  
// Reemplaza las funciones loadStats, loadExpiredMemberships y loadAllMemberships

  // 🔄 Cargar estadísticas principales ESTRUCTURA CORRECTA
    const loadStats = async () => {
  if (!gymData?.id) return;
  
  try {
    setLoading(true);
    
    // Usar agregación para contar sin cargar todos los documentos
    const membersRef = collection(db, `gyms/${gymData.id}/members`);
    const membersCountSnapshot = await getCountFromServer(membersRef);
    const totalMembers = membersCountSnapshot.data().count;
    
    // Para estadísticas detalladas, usar una muestra o implementar contadores en Firestore
    // Esta es una versión optimizada que solo carga una muestra
    const sampleQuery = query(membersRef, limit(100)); // Solo cargar 100 miembros para estadísticas
    const sampleSnapshot = await getDocs(sampleQuery);
    
    // Calcular estadísticas basadas en la muestra y extrapolar
    let sampleStats = {
      active: 0,
      expired: 0,
      expiringSoon: 0,
      withAutoRenewal: 0,
      pendingPayments: 0,
      totalDebt: 0
    };
    
    const today = new Date();
    
    for (const memberDoc of sampleSnapshot.docs) {
      const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      membershipsSnapshot.forEach((membershipDoc) => {
        const data = membershipDoc.data();
        const endDate = new Date(data.endDate);
        const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (data.active !== false && data.status !== 'cancelled') {
          if (daysUntil >= 0) {
            sampleStats.active++;
            if (daysUntil <= 7) sampleStats.expiringSoon++;
          } else {
            sampleStats.expired++;
          }
        }
        
        if (data.autoRenewal) sampleStats.withAutoRenewal++;
        if (data.paymentStatus === 'pending') {
          sampleStats.pendingPayments++;
          sampleStats.totalDebt += data.cost || 0;
        }
      });
    }
    
    // Extrapolar basado en la muestra (si tienes muchos miembros)
    const multiplier = totalMembers > 100 ? totalMembers / 100 : 1;
    
    setStats({
      total: Math.round(sampleStats.active + sampleStats.expired),
      active: Math.round(sampleStats.active * multiplier),
      expired: Math.round(sampleStats.expired * multiplier),
      expiringSoon: Math.round(sampleStats.expiringSoon * multiplier),
      withAutoRenewal: Math.round(sampleStats.withAutoRenewal * multiplier),
      pendingPayments: Math.round(sampleStats.pendingPayments * multiplier),
      totalDebt: Math.round(sampleStats.totalDebt * multiplier)
    });
    
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
    setError('Error al cargar las estadísticas');
  } finally {
    setLoading(false);
  }
};

 // 🔄 CARGAR MEMBRESÍAS VENCIDAS - Solo activas
const loadExpiredMemberships = async (page: number = 1, resetData: boolean = false) => {
  if (!gymData?.id) return;
  
  try {
    setLoadingExpired(true);
    
    const membersRef = collection(db, `gyms/${gymData.id}/members`);
    
    // Si es la primera página o reset, empezar desde cero
    let startAfterDoc = null;
    if (page > 1 && !resetData) {
      // Obtener el último documento de la página anterior
      // (necesitarías almacenar esto en el estado)
    }
    
    // Query con límite para paginación
    const membersQuery = query(
      membersRef
     //  orderBy('createdAt', 'desc')
       //limit(100) Cargar 50 miembros a la vez
    );
    
    const membersSnapshot = await getDocs(membersQuery);
    
    const today = new Date();
    const expiredList: ExpiredMembershipWithDetails[] = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberName = `${memberData.firstName} ${memberData.lastName}`;
      const memberId = memberDoc.id;
      
      const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      membershipsSnapshot.forEach((membershipDoc) => {
        const data = membershipDoc.data() as any;
        const endDate = new Date(data.endDate);
        const daysExpired = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const isActive = data.active !== false;
        const isValidStatus = data.status === 'active' || !data.status;
        
        if (daysExpired > 0 && isActive && isValidStatus) {
          expiredList.push({
            ...data,
            id: membershipDoc.id,
            memberId: memberId,
            memberName: memberName,
            daysExpired,
            totalDebt: data.paymentStatus === 'pending' ? (data.cost || 0) : 0
          });
        }
      });
    }
    
    expiredList.sort((a, b) => b.daysExpired - a.daysExpired);
    
    if (resetData || page === 1) {
      setExpiredMemberships(expiredList);
    } else {
      setExpiredMemberships(prev => [...prev, ...expiredList]);
    }
    
    setExpiredPage(page);
    
  } catch (err) {
    console.error('Error cargando membresías vencidas:', err);
    setError('Error al cargar las membresías vencidas');
  } finally {
    setLoadingExpired(false);
  }
};

const getPaginatedExpiredMemberships = () => {
  let filtered = [...expiredMemberships];
  
  // Aplicar filtro de búsqueda
  if (expiredSearchTerm) {
    const term = expiredSearchTerm.toLowerCase();
    filtered = filtered.filter(m => 
      m.memberName.toLowerCase().includes(term) ||
      m.activityName.toLowerCase().includes(term)
    );
  }
  
  // Calcular paginación
  const totalPages = Math.ceil(filtered.length / expiredItemsPerPage);
  const startIndex = (expiredPage - 1) * expiredItemsPerPage;
  const endIndex = startIndex + expiredItemsPerPage;
  const paginated = filtered.slice(startIndex, endIndex);
  
  return {
    data: paginated,
    totalItems: filtered.length,
    totalPages,
    currentPage: expiredPage,
    startIndex,
    endIndex
  };
};

// 🔄 CARGAR TODAS LAS MEMBRESÍAS - Con opción de incluir inactivas
const loadAllMemberships = async () => {
  if (!gymData?.id) return;
  
  try {
    setLoading(true);
    
    const membersRef = collection(db, `gyms/${gymData.id}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    const membershipsList: ManageMembership[] = [];
    const today = new Date();
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const memberName = `${memberData.firstName} ${memberData.lastName}`;
      const memberId = memberDoc.id;
      const memberEmail = memberData.email || '';
      const memberPhone = memberData.phone || '';
      
      const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberId}/memberships`);
      const membershipsSnapshot = await getDocs(membershipsRef);
      
      membershipsSnapshot.forEach((membershipDoc) => {
        const data = membershipDoc.data() as any;
        const endDate = new Date(data.endDate);
        const daysUntilExpiration = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // 🔧 LÓGICA MEJORADA:
        // Si active no existe o es true = activa
        // Si active es false = inactiva
        const isActive = data.active !== false;
        
        // Aplicar filtro según includeInactive
        if (!includeInactive && !isActive) {
          return; // Saltar membresías inactivas si no se incluyen
        }
        
        // No incluir membresías canceladas o renovadas a menos que se incluyan inactivas
        if (!includeInactive && (data.status === 'cancelled' || data.status === 'renewed')) {
          return;
        }
        
        membershipsList.push({
          ...data,
          id: membershipDoc.id,
          memberId: memberId,
          memberName: memberName,
          memberEmail: memberEmail,
          memberPhone: memberPhone,
          daysUntilExpiration,
          active: isActive // Normalizar el campo active
        });
      });
    }
    
    membershipsList.sort((a, b) => {
      const dateA = new Date(a.endDate).getTime();
      const dateB = new Date(b.endDate).getTime();
      return dateA - dateB;
    });
    
    setAllMemberships(membershipsList);
    setCurrentPage(1);
    
  } catch (err) {
    console.error('Error cargando membresías:', err);
    setError('Error al cargar las membresías');
  } finally {
    setLoading(false);
  }
};



// 🔄 RENOVAR MEMBRESÍA - LÓGICA CORREGIDA
const handleRenewMembership = async (membershipId: string, months: number = 1) => {
  if (!gymData?.id) return;
  
  setRenewalInProgress(prev => [...prev, membershipId]);
  setError('');
  setSuccess('');
  
  try {
    const membership = [...expiredMemberships, ...allMemberships].find(m => m.id === membershipId);
    
    if (!membership || !membership.memberId) {
      throw new Error('No se pudo encontrar la información del miembro');
    }
    
    const membershipRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships/${membershipId}`);
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      throw new Error('Membresía no encontrada');
    }
    
    const membershipData = membershipSnap.data();
    
    // 🔧 OBTENER PRECIO ACTUAL DE LA DEFINICIÓN DE MEMBRESÍA
    let currentPrice = membershipData.cost; // Precio por defecto
    
    // Intentar obtener el precio actualizado desde la configuración de membresías
    try {
  // Opción 1: Si tiene membershipId guardado (referencia directa)
  if (membershipData.membershipId) {
    const membershipDefRef = doc(db, `gyms/${gymData.id}/memberships`, membershipData.membershipId);
    const membershipDefSnap = await getDoc(membershipDefRef);
    
    if (membershipDefSnap.exists()) {
      const defData = membershipDefSnap.data();
      currentPrice = defData.cost;
      console.log('✅ Precio actualizado desde ID:', currentPrice);
    }
  }
  
  // Opción 2: Si no tiene membershipId, buscar por nombre
  if (!membershipData.membershipId || currentPrice === membershipData.cost) {
    const membershipsRef = collection(db, `gyms/${gymData.id}/memberships`);
    const snapshot = await getDocs(membershipsRef);
    
    // Buscar por coincidencia de nombre y actividad
    const found = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.name === membershipData.membershipName && 
             data.activityId === membershipData.activityId;
    });
    
    if (found) {
      currentPrice = found.data().cost;
      console.log('✅ Precio actualizado por búsqueda:', currentPrice);
    }
  }
} catch (error) {
  console.log('⚠️ Error obteniendo precio actualizado:', error);
  console.log('Usando precio anterior:', currentPrice);
}

console.log('💰 Precio final para renovación:', {
  anterior: membershipData.cost,
  actual: currentPrice,
  multiplicador: months,
  total: currentPrice * months
});
    
    // Calcular fechas
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + months);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const totalCost = currentPrice * months;
    
    // Desactivar la membresía anterior
    await updateDoc(membershipRef, {
      status: 'renewed',
      active: false,
      renewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Crear nueva membresía activa
    const newMembershipData: any = {
      ...membershipData,
      startDate: startDate,
      endDate: endDateStr,
      cost: currentPrice, // Precio actualizado
      totalCost: totalCost,
      status: 'active',
      active: true,
      paymentStatus: 'pending',
      renewedAt: new Date().toISOString(),
      renewedManually: true,
      previousMembershipId: membershipId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Limpiar campos que no deben duplicarse
    if ('id' in newMembershipData) delete newMembershipData.id;
    if ('renewedToId' in newMembershipData) delete newMembershipData.renewedToId;
    
    const newMembershipRef = await addDoc(
      collection(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships`),
      newMembershipData
    );
    
    // Actualizar deuda del socio
    const memberRef = doc(db, `gyms/${gymData.id}/members`, membership.memberId);
    await updateDoc(memberRef, {
      totalDebt: increment(totalCost),
      hasDebt: true,
      updatedAt: new Date().toISOString()
    });
    
    // Crear registro de deuda pendiente
    await addDoc(
      collection(db, `gyms/${gymData.id}/pendingPayments`),
      {
        membershipId: newMembershipRef.id,
        memberId: membership.memberId,
        memberName: membership.memberName,
        activityName: membership.activityName,
        amount: totalCost,
        months: months,
        status: 'pending',
        dueDate: startDate,
        createdAt: new Date().toISOString(),
        type: 'membership_renewal'
      }
    );
    
    setSuccess(`Membresía renovada por ${months} ${months === 1 ? 'mes' : 'meses'}. Precio actualizado: ${formatCurrency(currentPrice)}. Deuda generada: ${formatCurrency(totalCost)}`);
    
    await Promise.all([loadStats(), loadExpiredMemberships()]);
    
    setTimeout(() => setSuccess(''), 5000);
    
  } catch (err: any) {
    console.error('Error renovando membresía:', err);
    setError(err.message || 'Error al renovar la membresía');
  } finally {
    setRenewalInProgress(prev => prev.filter(id => id !== membershipId));
  }
};


const runMigration = async () => {
  if (!gymData?.id) return;
  
  const membersRef = collection(db, `gyms/${gymData.id}/members`);
  const membersSnapshot = await getDocs(membersRef);
  
  let migrated = 0;
  setLoading(true);
  
  for (const memberDoc of membersSnapshot.docs) {
    const membershipsRef = collection(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships`);
    const membershipsSnapshot = await getDocs(membershipsRef);
    
    for (const membershipDoc of membershipsSnapshot.docs) {
      const data = membershipDoc.data();
      
      if (!data.membershipId) {
        const configRef = collection(db, `gyms/${gymData.id}/memberships`);
        const configSnapshot = await getDocs(configRef);
        
        const found = configSnapshot.docs.find(doc => {
          const configData = doc.data();
          return configData.name === data.membershipName || 
                 configData.activityId === data.activityId;
        });
        
        if (found) {
          await updateDoc(doc(db, `gyms/${gymData.id}/members/${memberDoc.id}/memberships/${membershipDoc.id}`), {
            membershipId: found.id,
            membershipName: found.data().name
          });
          migrated++;
        }
      }
    }
  }
  
  setLoading(false);
  setSuccess(`Migración completada: ${migrated} membresías actualizadas`);
};

// 💰 REGISTRAR PAGO - Actualizar deuda del socio
const handleRegisterPayment = async (membershipId: string) => {
  if (!gymData?.id || !userData?.id) return;
  
  setPaymentInProgress(prev => [...prev, membershipId]);
  setError('');
  setSuccess('');
  
  try {
    const membership = allMemberships.find(m => m.id === membershipId);
    
    if (!membership || !membership.memberId) {
      throw new Error('No se pudo encontrar la información del miembro');
    }
    
    const membershipRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}/memberships/${membershipId}`);
    
    // Actualizar estado de pago de la membresía
    await updateDoc(membershipRef, {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      paidBy: userData.id
    });
    
    // ACTUALIZAR DEUDA DEL MIEMBRO (decrementar)
    const memberRef = doc(db, `gyms/${gymData.id}/members/${membership.memberId}`);
    const memberSnap = await getDoc(memberRef);
    
    if (memberSnap.exists()) {
      const memberData = memberSnap.data();
      const currentDebt = memberData.totalDebt || 0;
      const newDebt = Math.max(0, currentDebt - membership.cost);
      
      await updateDoc(memberRef, {
        totalDebt: newDebt,
        hasDebt: newDebt > 0,
        lastPaymentDate: new Date().toISOString()
      });
    }
    
    // Actualizar registro de pago pendiente si existe
    const pendingPaymentsRef = collection(db, `gyms/${gymData.id}/pendingPayments`);
    const pendingQuery = query(
      pendingPaymentsRef,
      where('membershipId', '==', membershipId),
      where('status', '==', 'pending')
    );
    const pendingSnap = await getDocs(pendingQuery);
    
    pendingSnap.forEach(async (doc) => {
      await updateDoc(doc.ref, {
        status: 'paid',
        paidAt: new Date().toISOString()
      });
    });
    
    // Registrar transacción en caja diaria
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
    
    setSuccess('Pago registrado exitosamente. Deuda actualizada y movimiento agregado a caja diaria.');
    
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

  // Función para activar/desactivar membresía
const handleToggleMembershipActive = async (membershipId: string, memberId: string, currentActive: boolean) => {
  if (!gymData?.id) return; // Agregar verificación
  
  try {
    const membershipRef = doc(db, `gyms/${gymData.id}/members/${memberId}/memberships/${membershipId}`);
    
    const newStatus = !currentActive ? 'active' : 'cancelled'; // Usar 'cancelled' en lugar de 'inactive'
    
    await updateDoc(membershipRef, {
      active: !currentActive,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    
    // Actualizar lista local
    setAllMemberships(prev => prev.map(m => 
      m.id === membershipId 
        ? {...m, active: !currentActive, status: newStatus} 
        : m
    ));
    
    setSuccess(`Membresía ${!currentActive ? 'activada' : 'desactivada'} correctamente`);
    setTimeout(() => setSuccess(''), 3000);
    
  } catch (error) {
    console.error('Error toggling membership:', error);
    setError('Error al cambiar el estado de la membresía');
  }
};



// Filtrar y paginar membresías
const getPaginatedMemberships = () => {
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
  
  // Calcular paginación
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginated = filtered.slice(startIndex, endIndex);
  
  return {
    data: paginated,
    totalItems: filtered.length,
    totalPages,
    currentPage,
    hasMore: endIndex < filtered.length
  };
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

        {/* migracion membresias */}

        {process.env.NODE_ENV === 'development' && (
            <button
              onClick={runMigration}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Migrar Referencias de Membresías
            </button>
          )}
        
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

            {activeTab === 'expired' && (
        <div className="space-y-6">
          {/* Header con controles */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Membresías Vencidas
              </h2>
              <p className="text-gray-600">
                Mostrando {getPaginatedExpiredMemberships().startIndex + 1} - {
                  Math.min(getPaginatedExpiredMemberships().endIndex, getPaginatedExpiredMemberships().totalItems)
                } de {getPaginatedExpiredMemberships().totalItems} membresías vencidas
              </p>
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
                value={expiredSearchTerm}
                onChange={(e) => {
                  setExpiredSearchTerm(e.target.value);
                  setExpiredPage(1); // Resetear a primera página al buscar
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={() => {
                const currentPageData = getPaginatedExpiredMemberships().data;
                if (selectedMemberships.length === currentPageData.length) {
                  setSelectedMemberships([]);
                } else {
                  setSelectedMemberships(currentPageData.map(m => m.id));
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {selectedMemberships.length === getPaginatedExpiredMemberships().data.length ? 
                'Deseleccionar' : 'Seleccionar'} página
            </button>
          </div>

          {/* Lista de vencidas */}
          {loadingExpired ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span>Cargando membresías vencidas...</span>
            </div>
          ) : getPaginatedExpiredMemberships().totalItems === 0 ? (
            <div className="text-center p-8 bg-white rounded-lg shadow">
              <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ¡Excelente! No hay membresías vencidas
              </h3>
              <p className="text-gray-600">Todas las membresías están al día</p>
            </div>
          ) : (
            <>
              <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
                {getPaginatedExpiredMemberships().data.map((membership) => (
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

              {/* Controles de paginación para Vencidas */}
              {getPaginatedExpiredMemberships().totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-700">
                    Página {expiredPage} de {getPaginatedExpiredMemberships().totalPages}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setExpiredPage(prev => Math.max(1, prev - 1))}
                      disabled={expiredPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    
                    {/* Botones de página numerados */}
                    {(() => {
                      const totalPages = getPaginatedExpiredMemberships().totalPages;
                      const current = expiredPage;
                      let pages = [];
                      
                      if (totalPages <= 7) {
                        pages = Array.from({length: totalPages}, (_, i) => i + 1);
                      } else {
                        if (current <= 3) {
                          pages = [1, 2, 3, 4, 5, '...', totalPages];
                        } else if (current >= totalPages - 2) {
                          pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
                        } else {
                          pages = [1, '...', current - 1, current, current + 1, '...', totalPages];
                        }
                      }
                      
                      return pages.map((page, index) => {
                        if (page === '...') {
                          return <span key={index} className="px-2 py-1">...</span>;
                        }
                        
                        return (
                          <button
                            key={index}
                            onClick={() => setExpiredPage(page as number)}
                            className={`px-3 py-1 border rounded-md ${
                              current === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}
                    
                    <button
                      onClick={() => setExpiredPage(prev => 
                        Math.min(getPaginatedExpiredMemberships().totalPages, prev + 1)
                      )}
                      disabled={expiredPage === getPaginatedExpiredMemberships().totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

{activeTab === 'manage' && (
  <div className="space-y-6">
    {/* Filtros y controles */}
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o actividad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="expired">Vencidas</option>
          <option value="pending">Con deuda</option>
        </select>
        
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">Todos los pagos</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
        </select>
        
        <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              loadAllMemberships(); // Recargar con nuevo filtro
            }}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <span>Incluir desactivadas</span>
        </label>
        
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
      <>
        {/* Lista de membresías con paginación */}
        <MembershipManagementList 
          memberships={getPaginatedMemberships().data}
          searchTerm={searchTerm}
          onRenew={handleRenewMembership}
          onPayment={handleRegisterPayment}
          onToggleActive={handleToggleMembershipActive} // Agregar esta prop
          renewalInProgress={renewalInProgress}
          paymentInProgress={paymentInProgress}
          gymId={gymData?.id || ''}
        />
        
        {/* Controles de paginación */}
        {getPaginatedMemberships().totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-700">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, getPaginatedMemberships().totalItems)} de {getPaginatedMemberships().totalItems} membresías
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              
              {[...Array(Math.min(5, getPaginatedMemberships().totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 border rounded-md ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {getPaginatedMemberships().totalPages > 5 && (
                <span className="px-2 py-1">...</span>
              )}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(getPaginatedMemberships().totalPages, prev + 1))}
                disabled={currentPage === getPaginatedMemberships().totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </>
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
  // Estados locales
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingMembership, setEditingMembership] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingChanges, setSavingChanges] = useState<string[]>([]);
  
  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  // 🔧 FUNCIÓN LOCAL para activar/desactivar membresía
  const handleToggleActive = async (membershipId: string, memberId: string, currentActive: boolean) => {
    if (!gymId) return;
    
    try {
      const membershipRef = doc(db, `gyms/${gymId}/members/${memberId}/memberships/${membershipId}`);
      
      await updateDoc(membershipRef, {
        active: !currentActive,
        updatedAt: new Date().toISOString()
      });
      
      // Recargar la página para mostrar cambios (temporal)
      window.location.reload();
      
    } catch (error) {
      console.error('Error toggling membership:', error);
    }
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

                          {/* Sección de botones de acción - MODO VISTA */}
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

                              <button
                                onClick={() => handleToggleActive(membership.id, membership.memberId, membership.active !== false)}
                                className={`${
                                  membership.active === false 
                                    ? 'text-green-600 hover:text-green-700' 
                                    : 'text-yellow-600 hover:text-yellow-700'
                                }`}
                                title={membership.active === false ? 'Activar membresía' : 'Desactivar membresía'}
                              >
                                {membership.active === false ? (
                                  <ToggleLeft size={18} />
                                ) : (
                                  <ToggleRight size={18} />
                                )}
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