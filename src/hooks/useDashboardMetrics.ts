// src/hooks/useDashboardMetrics.ts

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAuth from './useAuth';

interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  totalRevenue: number;
  monthlyRevenue: number;
  todayAttendance: number;
  thisWeekAttendance: number;
  expiringMemberships: number;
  pendingPayments: number;
  loading: boolean;
  error: string | null;
}

const useDashboardMetrics = () => {
  const { gymData } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    membersWithDebt: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    todayAttendance: 0,
    thisWeekAttendance: 0,
    expiringMemberships: 0,
    pendingPayments: 0,
    loading: true,
    error: null
  });

  // Función para obtener rangos de fechas
  const getDateRanges = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
      today: Timestamp.fromDate(today),
      thisMonth: Timestamp.fromDate(thisMonth),
      thisWeek: Timestamp.fromDate(thisWeek),
      nextWeek: Timestamp.fromDate(nextWeek),
      now: Timestamp.fromDate(now)
    };
  }, []);

  // Función optimizada para obtener conteos
  const getCount = useCallback(async (collectionPath: string, conditions: any[] = []) => {
    try {
      let q = query(collection(db, collectionPath));
      
      conditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });
      
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      console.error(`Error getting count for ${collectionPath}:`, error);
      return 0;
    }
  }, []);

  // Cargar métricas
  const loadMetrics = useCallback(async () => {
    if (!gymData?.id) return;
    
    setMetrics(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { today, thisMonth, thisWeek, nextWeek } = getDateRanges();
      const gymPath = `gyms/${gymData.id}`;
      
      // Obtener conteos de miembros
      const [
        totalMembers,
        activeMembers,
        inactiveMembers,
        membersWithDebt
      ] = await Promise.all([
        getCount(`${gymPath}/members`),
        getCount(`${gymPath}/members`, [{ field: 'status', operator: '==', value: 'active' }]),
        getCount(`${gymPath}/members`, [{ field: 'status', operator: '==', value: 'inactive' }]),
        getCount(`${gymPath}/members`, [{ field: 'totalDebt', operator: '>', value: 0 }])
      ]);

      // Obtener conteos de asistencias
      const [todayAttendance, thisWeekAttendance] = await Promise.all([
        getCount(`${gymPath}/attendance`, [
          { field: 'timestamp', operator: '>=', value: today },
          { field: 'status', operator: '==', value: 'success' }
        ]),
        getCount(`${gymPath}/attendance`, [
          { field: 'timestamp', operator: '>=', value: thisWeek },
          { field: 'status', operator: '==', value: 'success' }
        ])
      ]);

      // Obtener conteos de membresías
      const [expiringMemberships, pendingPayments] = await Promise.all([
        getCount(`${gymPath}/membershipAssignments`, [
          { field: 'status', operator: '==', value: 'active' },
          { field: 'endDate', operator: '<=', value: nextWeek }
        ]),
        getCount(`${gymPath}/membershipAssignments`, [
          { field: 'paymentStatus', operator: '==', value: 'pending' }
        ])
      ]);

      // Calcular revenues de manera optimizada
      const [monthlyTransactionsSnap, allTransactionsSnap] = await Promise.all([
        getDocs(query(
          collection(db, `${gymPath}/transactions`),
          where('date', '>=', thisMonth),
          where('type', '==', 'income'),
          where('status', '==', 'completed')
        )),
        getDocs(query(
          collection(db, `${gymPath}/transactions`),
          where('type', '==', 'income'),
          where('status', '==', 'completed')
        ))
      ]);

      // Calcular revenues sumando los montos
      let monthlyRevenue = 0;
      monthlyTransactionsSnap.forEach(doc => {
        const data = doc.data();
        monthlyRevenue += data.amount || 0;
      });

      let totalRevenue = 0;
      allTransactionsSnap.forEach(doc => {
        const data = doc.data();
        totalRevenue += data.amount || 0;
      });

      // Actualizar métricas
      setMetrics({
        totalMembers,
        activeMembers,
        inactiveMembers,
        membersWithDebt,
        totalRevenue,
        monthlyRevenue,
        todayAttendance,
        thisWeekAttendance,
        expiringMemberships,
        pendingPayments,
        loading: false,
        error: null
      });

    } catch (error: any) {
      console.error('Error loading dashboard metrics:', error);
      setMetrics(prev => ({
        ...prev,
        loading: false,
        error: 'Error al cargar las métricas del dashboard'
      }));
    }
  }, [gymData?.id, getDateRanges, getCount]);

  // Auto-refresh de métricas
  useEffect(() => {
    if (gymData?.id) {
      loadMetrics();
      
      // Configurar auto-refresh cada 5 minutos
      const interval = setInterval(loadMetrics, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [gymData?.id, loadMetrics]);

  return {
    ...metrics,
    refresh: loadMetrics
  };
};

export default useDashboardMetrics;