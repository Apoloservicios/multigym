import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Transaction, Member } from '../types/gym.types'; // 🔧 AHORA Member EXISTE
import { toJsDate } from '../utils/date.utils';

// Obtener estadísticas del dashboard
export const getDashboardStats = async (gymId: string) => {
  const stats = {
    totalMembers: 0,
    activeMembers: 0,
    newMembersThisMonth: 0,
    totalRevenue: 0,
    membershipRevenue: 0,
    otherRevenue: 0
  };

  try {
    // Obtener miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    stats.totalMembers = membersSnapshot.size;
    
    // Calcular miembros activos y nuevos del mes
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    membersSnapshot.forEach(doc => {
      const member = doc.data() as Member;
      
      // Contar miembros activos
      if (member.status === 'active') {
        stats.activeMembers++;
      }
      
      // Contar nuevos miembros del mes
      const createdAtDate = member.createdAt ? 
        toJsDate(member.createdAt) : null;
      
      if (createdAtDate && createdAtDate >= firstDayOfCurrentMonth) {
        stats.newMembersThisMonth++;
      }
    });
    
    // Obtener ingresos
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

// 🔧 FUNCIÓN ÚNICA - Obtener datos para gráfico de miembros según periodo
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    // Obtener todos los miembros
    const membersRef = collection(db, `gyms/${gymId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    
    // Generar fechas en orden cronológico
    const datePoints: string[] = [];
    const countPoints: number[] = [];
    
    if (period === 'month') {
      // Para el mes actual, mostrar día por día desde el 1 hasta hoy
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        datePoints.push(dateStr);
        countPoints.push(0);
      }
    } else if (period === '3months') {
      for (let i = 0; i < 12; i++) {
        datePoints.push(`Sem ${i + 1}`);
        countPoints.push(0);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
        countPoints.push(0);
      }
    }
    
    // Contar miembros acumulativamente en orden cronológico
    membersSnapshot.forEach(doc => {
      const member = doc.data() as Member;
      
      if (member.createdAt) {
        const createdAt = toJsDate(member.createdAt);
        
        if (createdAt && createdAt >= startDate && createdAt <= now) {
          if (period === 'month') {
            const dayOfMonth = createdAt.getDate();
            const index = dayOfMonth - 1;
            
            if (index >= 0 && index < countPoints.length) {
              // Incrementar desde este día hasta el final (acumulativo)
              for (let i = index; i < countPoints.length; i++) {
                countPoints[i]++;
              }
            }
          } else if (period === '3months') {
            const weekDiff = Math.floor((createdAt.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            
            if (weekDiff >= 0 && weekDiff < countPoints.length) {
              for (let i = weekDiff; i < countPoints.length; i++) {
                countPoints[i]++;
              }
            }
          } else {
            const monthDiff = (createdAt.getFullYear() - startDate.getFullYear()) * 12 + (createdAt.getMonth() - startDate.getMonth());
            
            if (monthDiff >= 0 && monthDiff < countPoints.length) {
              for (let i = monthDiff; i < countPoints.length; i++) {
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
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
    
    // Generar fechas en orden cronológico
    const datePoints: string[] = [];
    const membershipValues: number[] = [];
    const otherValues: number[] = [];
    
    if (period === 'month') {
      // Para el mes actual, mostrar día por día desde el 1 hasta hoy
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        datePoints.push(dateStr);
        membershipValues.push(0);
        otherValues.push(0);
      }
    } else if (period === '3months') {
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (i * 7));
        datePoints.push(`Sem ${i + 1}`);
        membershipValues.push(0);
        otherValues.push(0);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        datePoints.push(`${date.getMonth() + 1}/${date.getFullYear().toString().substr(2)}`);
        membershipValues.push(0);
        otherValues.push(0);
      }
    }
    
    // Procesar transacciones en orden cronológico
    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data() as Transaction;
      
      if (transaction.date) {
        const txDate = toJsDate(transaction.date);
        
        if (txDate && txDate >= startDate && txDate <= now) {
          let index = -1;
          
          if (period === 'month') {
            // Calcular índice basado en el día del mes
            const dayOfMonth = txDate.getDate();
            index = dayOfMonth - 1; // -1 porque el array empieza en 0
          } else if (period === '3months') {
            const weekDiff = Math.floor((txDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            index = weekDiff;
          } else {
            const monthDiff = (txDate.getFullYear() - startDate.getFullYear()) * 12 + (txDate.getMonth() - startDate.getMonth());
            index = monthDiff;
          }
          
          if (index >= 0 && index < datePoints.length) {
            // Acumular según categoría
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