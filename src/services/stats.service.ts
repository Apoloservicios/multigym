// src/services/stats.service.ts
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Member } from '../types/member.types';
import { Transaction } from '../types/gym.types';
import { toJsDate } from '../utils/date.utils';

// Interfaz para estadísticas del dashboard
interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisMonth: number;
  totalRevenue: number;
  membershipRevenue: number;
  otherRevenue: number;
  membersByStatus: Record<string, number>;
  revenueByPeriod: Record<string, number>;
}

// Obtener estadísticas para el dashboard
export const getDashboardStats = async (gymId: string): Promise<DashboardStats> => {
  try {
    // Inicializar estadísticas
    const stats: DashboardStats = {
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      newMembersThisMonth: 0,
      totalRevenue: 0,
      membershipRevenue: 0,
      otherRevenue: 0,
      membersByStatus: {},
      revenueByPeriod: {}
    };
    
    // Obtener miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    // Contar miembros por estado
    stats.totalMembers = membersSnapshot.size;
    
    // Establecer fecha del primer día del mes actual
    const today = new Date();
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    membersSnapshot.forEach(doc => {
      const member = doc.data() as Member;
      
      // Contar por estado
      if (member.status === 'active') {
        stats.activeMembers++;
      } else {
        stats.inactiveMembers++;
      }
      
      stats.membersByStatus[member.status] = (stats.membersByStatus[member.status] || 0) + 1;
      
      // Comprobar si es nuevo este mes - usar nuestra función segura
      const createdAtDate = member.createdAt ? toJsDate(member.createdAt) : null;
      
      if (createdAtDate && createdAtDate >= firstDayOfCurrentMonth) {
        stats.newMembersThisMonth++;
      }
    });
    
    // Obtener ingresos
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const monthTransactionsQuery = query(
      transactionsRef,
      where('date', '>=', Timestamp.fromDate(firstDayOfMonth)),
      where('date', '<=', Timestamp.fromDate(lastDayOfMonth))
    );
    
    const monthTransactionsSnapshot = await getDocs(monthTransactionsQuery);
    
    // Procesar transacciones
    monthTransactionsSnapshot.forEach(doc => {
      const transaction = doc.data() as Transaction;
      
      if (transaction.type === 'income') {
        stats.totalRevenue += transaction.amount;
        
        // Separar ingresos por membresía y otros
        if (transaction.category === 'membership') {
          stats.membershipRevenue += transaction.amount;
        } else {
          stats.otherRevenue += transaction.amount;
        }
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
};

// Obtener datos para gráfico de miembros según periodo
export const getMemberChartData = async (
  gymId: string,
  period: 'month' | '3months' | 'year'
): Promise<{ dates: string[], counts: number[] }> => {
  try {
    const now = new Date();
    let startDate: Date;
    
    // Determinar fecha de inicio según periodo
    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    // Preparar datos para gráfico
    const datePoints: string[] = [];
    const countPoints: number[] = [];
    
    // Determinar intervalo según periodo
    const interval = period === 'year' ? 
      { unit: 'month', count: 12 } : 
      period === '3months' ? 
        { unit: 'week', count: 12 } : 
        { unit: 'day', count: 30 };
    
    // Generar puntos de fecha e inicializar contadores
    for (let i = 0; i < interval.count; i++) {
      const date = new Date(now);
      
      if (interval.unit === 'day') {
        date.setDate(date.getDate() - (interval.count - i - 1));
        datePoints.push(date.toISOString().split('T')[0]);
      } else if (interval.unit === 'week') {
        date.setDate(date.getDate() - (interval.count - i - 1) * 7);
        datePoints.push(`Sem ${i + 1}`);
      } else {
        date.setMonth(date.getMonth() - (interval.count - i - 1));
        datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
      }
      countPoints.push(0);
    }
    
    // Contar miembros por fecha de registro
    membersSnapshot.forEach(doc => {
      const member = doc.data() as Member;
      
      if (member.createdAt) {
        // Usar nuestra función segura para convertir a Date
        const createdAt = toJsDate(member.createdAt);
        
        if (createdAt && createdAt >= startDate && createdAt <= now) {
          // Determinar a qué punto corresponde esta fecha
          if (interval.unit === 'day') {
            const dayDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const index = interval.count - dayDiff - 1;
            if (index >= 0 && index < interval.count) {
              // Incrementar acumulativamente
              for (let i = index; i < interval.count; i++) {
                countPoints[i]++;
              }
            }
          } else if (interval.unit === 'week') {
            const weekDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7));
            const index = interval.count - weekDiff - 1;
            if (index >= 0 && index < interval.count) {
              // Incrementar acumulativamente
              for (let i = index; i < interval.count; i++) {
                countPoints[i]++;
              }
            }
          } else {
            const monthDiff = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
            const index = interval.count - monthDiff - 1;
            if (index >= 0 && index < interval.count) {
              // Incrementar acumulativamente
              for (let i = index; i < interval.count; i++) {
                countPoints[i]++;
              }
            }
          }
        }
      }
    });
    
    return { dates: datePoints, counts: countPoints };
  } catch (error) {
    console.error('Error getting member chart data:', error);
    throw error;
  }
};

// Obtener datos para gráfico de ingresos según periodo
export const getSalesChartData = async (
  gymId: string,
  period: 'month' | '3months' | 'year'
): Promise<{ dates: string[], values: { memberships: number[], other: number[] } }> => {
  try {
    const now = new Date();
    let startDate: Date;
    
    // Determinar fecha de inicio según periodo
    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }
    
    // Obtener transacciones
    const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
    const transactionsQuery = query(
      transactionsRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(now)),
      where('type', '==', 'income'),
      orderBy('date', 'asc')
    );
    
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    // Preparar datos para gráfico
    const datePoints: string[] = [];
    const membershipValues: number[] = [];
    const otherValues: number[] = [];
    
    // Determinar intervalo según periodo
    const interval = period === 'year' ? 
      { unit: 'month', count: 12 } : 
      period === '3months' ? 
        { unit: 'week', count: 12 } : 
        { unit: 'day', count: 30 };
    
    // Generar puntos de fecha e inicializar valores
    for (let i = 0; i < interval.count; i++) {
      const date = new Date(now);
      
      if (interval.unit === 'day') {
        date.setDate(date.getDate() - (interval.count - i - 1));
        datePoints.push(date.toISOString().split('T')[0]);
      } else if (interval.unit === 'week') {
        date.setDate(date.getDate() - (interval.count - i - 1) * 7);
        datePoints.push(`Sem ${i + 1}`);
      } else {
        date.setMonth(date.getMonth() - (interval.count - i - 1));
        datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
      }
      membershipValues.push(0);
      otherValues.push(0);
    }
    
    // Procesar transacciones
    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data() as Transaction;
      
      if (transaction.date) {
        // Usar nuestra función segura para convertir a Date
        const txDate = toJsDate(transaction.date);
        
        if (txDate && txDate >= startDate && txDate <= now) {
          // Determinar a qué punto corresponde esta transacción
          let index = -1;
          
          if (interval.unit === 'day') {
            const dayDiff = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
            index = interval.count - dayDiff - 1;
          } else if (interval.unit === 'week') {
            const weekDiff = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            index = interval.count - weekDiff - 1;
          } else {
            const monthDiff = (now.getFullYear() - txDate.getFullYear()) * 12 + (now.getMonth() - txDate.getMonth());
            index = interval.count - monthDiff - 1;
          }
          
          if (index >= 0 && index < interval.count) {
            // Incrementar según categoría
            if (transaction.category === 'membership') {
              membershipValues[index] += transaction.amount;
            } else {
              otherValues[index] += transaction.amount;
            }
          }
        }
      }
    });
    
    return { 
      dates: datePoints, 
      values: { 
        memberships: membershipValues, 
        other: otherValues 
      } 
    };
  } catch (error) {
    console.error('Error getting sales chart data:', error);
    throw error;
  }
};