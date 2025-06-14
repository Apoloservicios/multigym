// src/pages/dashboard/DashboardImproved.tsx - CORREGIDO CÁLCULO "POR COBRAR" - COMPLETO

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Plus,
  Undo,
  X,
  User,
  Calendar,
  Download,
  Info
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useFinancial from '../../hooks/useFinancial';
import { formatCurrency } from '../../utils/formatting.utils';
import { 
  getCurrentDateInArgentina,
  getCurrentTimeInArgentina,
  isTodayInArgentina,
  getTodayStartInArgentina,
  getTodayEndInArgentina,
  getThisMonthStartInArgentina,
  formatDateForDisplay,
  timestampToArgentinianDate,
  formatArgentinianDateTime
} from '../../utils/timezone.utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { exportTransactionsToExcel } from '../../utils/excel.utils';

// Interfaces
interface EnhancedDashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersWithDebt: number;
  todayIncome: number;
  todayExpenses: number;
  todayNet: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  pendingPayments: number;
  pendingAmount: number;
  overduePayments: number;
  overdueAmount: number;
  refundsToday: number;
}

interface PendingPayment {
  id: string;
  memberName: string;
  activityName: string;
  cost: number;
  startDate: any;
  endDate: any;
  overdue: boolean;
  daysOverdue?: number;
}

const DashboardImproved: React.FC = () => {
  const { gymData } = useAuth();
  const { 
    transactions, 
    dailySummary, 
    loading: financialLoading, 
    error: financialError,
    refreshData: refreshFinancialData 
  } = useFinancial();


  
  // Estados principales
  const [metrics, setMetrics] = useState<EnhancedDashboardMetrics>({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    membersWithDebt: 0,
    todayIncome: 0,
    todayExpenses: 0,
    todayNet: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyNet: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    overduePayments: 0,
    overdueAmount: 0,
    refundsToday: 0
  });
  
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'transactions'>('overview');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'overdue'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // 🔧 FUNCIÓN PARA EVITAR BUCLES - COOLDOWN DE 3 SEGUNDOS
  const shouldLoad = useCallback(() => {
    const now = Date.now();
    return now - lastLoadTime > 3000;
  }, [lastLoadTime]);

  // 🔧 RANGOS DE FECHAS USANDO TIMEZONE ARGENTINA - MEMOIZADO ESTÁTICO
  const dateRanges = React.useMemo(() => {
    return {
      todayStart: getTodayStartInArgentina(),
      todayEnd: getTodayEndInArgentina(),
      thisMonthStart: getThisMonthStartInArgentina(),
      nextWeek: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      todayString: getCurrentDateInArgentina()
    };
  }, []);

  // Función para detectar tipo de transacción - MEMOIZADA
          const getTransactionDisplayInfo = useCallback((transaction: any) => {
      // 🔍 DEBUG: Log para transacciones de reintegro
      if (transaction.type === 'refund' || transaction.category === 'refund' || 
          transaction.description?.toLowerCase().includes('reintegro')) {
        console.log('🔍 DETECTANDO TRANSACCIÓN DE REINTEGRO:', {
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          amount: transaction.amount,
          description: transaction.description?.substring(0, 50) + '...',
          createdAt: transaction.createdAt,
          date: transaction.date
        });
      }

      // 🆕 LÓGICA CORREGIDA: Priorizar tipo 'refund' para reintegros
      const isRefund = transaction.type === 'refund' || 
                      transaction.category === 'refund' || 
                      transaction.description?.toLowerCase().includes('reintegro');
      
      // Solo si NO es reintegro, verificar si es gasto
      const isExpense = !isRefund && (
        transaction.type === 'expense' || 
        transaction.category === 'expense' ||
        transaction.category === 'withdrawal' ||
        transaction.amount < 0
      );
                      
      // Solo si NO es reintegro NI gasto, es ingreso
      const isIncome = !isRefund && !isExpense && (
        transaction.type === 'income' ||
        transaction.category === 'membership' ||
        transaction.category === 'extra' ||
        transaction.category === 'penalty' ||
        transaction.category === 'product' ||
        transaction.category === 'service' ||
        transaction.amount > 0
      );
      
      // 🔍 DEBUG: Log resultado de la clasificación para reintegros
      if (transaction.type === 'refund' || transaction.category === 'refund' || 
          transaction.description?.toLowerCase().includes('reintegro')) {
        console.log('🔍 RESULTADO CLASIFICACIÓN REINTEGRO:', {
          isRefund,
          isExpense,
          isIncome,
          displayAmount: Math.abs(transaction.amount),
          originalAmount: transaction.amount
        });
      }
      
      return {
        isRefund,
        isIncome,
        isExpense,
        displayAmount: Math.abs(transaction.amount),
        type: isRefund ? 'refund' : isExpense ? 'expense' : 'payment'
      };
    }, []);


    // ***************************************************


// 🆕 FUNCIÓN PARA EXPORTAR TRANSACCIONES RECIENTES A EXCEL
const handleExportRecentTransactions = async () => {
  if (!transactions.length) {
    setExportError('No hay transacciones para exportar');
    setTimeout(() => setExportError(''), 3000);
    return;
  }

  setIsExporting(true);
  setExportError('');

  try {
    // Filtrar las últimas 50 transacciones
    const recentTransactions = transactions.slice(0, 50);
    
    // Generar nombre de archivo con fecha
    const today = getCurrentDateInArgentina();
    const fileName = `dashboard-transacciones-${today.replace(/-/g, '')}.xlsx`;
    
    console.log('📊 Exportando transacciones del dashboard:', {
      count: recentTransactions.length,
      fileName
    });
    
    // Exportar usando la utilidad existente
    exportTransactionsToExcel(
      recentTransactions, 
      gymData?.name || 'Dashboard Financiero', 
      fileName
    );

    console.log('✅ Transacciones exportadas exitosamente');
    
    // Mostrar mensaje de éxito
    setSuccess('Transacciones exportadas exitosamente');
    setTimeout(() => setSuccess(''), 3000);
    
  } catch (err: any) {
    console.error('❌ Error exportando transacciones:', err);
    setExportError(err.message || 'Error al exportar transacciones');
    setTimeout(() => setExportError(''), 5000);
  } finally {
    setIsExporting(false);
  }
};

const handleExportPendingPayments = async () => {
  if (!pendingPayments.length) {
    setExportError('No hay pagos pendientes para exportar');
    setTimeout(() => setExportError(''), 3000);
    return;
  }

  setIsExporting(true);
  setExportError('');

  try {
    // Preparar datos para Excel usando SheetJS directamente
    const XLSX = await import('xlsx');
    
    const excelData = pendingPayments.map((payment, index) => ({
      '#': index + 1,
      'Socio': payment.memberName,
      'Actividad/Membresía': payment.activityName,
      'Monto Adeudado': payment.cost,
      'Fecha de Inicio': formatSafeDate(payment.startDate),
      'Fecha de Vencimiento': formatSafeDate(payment.endDate),
      'Estado': payment.overdue ? 'Vencido' : 'Pendiente',
      'Días de Atraso': payment.daysOverdue || 0,
      'Observaciones': payment.overdue ? `Vencido hace ${payment.daysOverdue} días` : 'Al día'
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 5 },  // #
      { wch: 25 }, // Socio
      { wch: 20 }, // Actividad
      { wch: 15 }, // Monto
      { wch: 15 }, // Fecha Inicio
      { wch: 15 }, // Fecha Venc
      { wch: 12 }, // Estado
      { wch: 12 }, // Días Atraso
      { wch: 30 }  // Observaciones
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos Pendientes');
    
    // Agregar hoja de resumen
    const totalAmount = pendingPayments.reduce((sum, p) => sum + p.cost, 0);
    const overdueCount = pendingPayments.filter(p => p.overdue).length;
    
    const summaryData = [
      { 'Concepto': 'RESUMEN DE PAGOS PENDIENTES', 'Valor': '' },
      { 'Concepto': 'Gimnasio', 'Valor': gymData?.name || 'Sin nombre' },
      { 'Concepto': 'Fecha del reporte', 'Valor': formatDateForDisplay(getCurrentDateInArgentina()) },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'Total de socios con deuda', 'Valor': pendingPayments.length },
      { 'Concepto': 'Socios con pagos vencidos', 'Valor': overdueCount },
      { 'Concepto': 'Socios con pagos al día', 'Valor': pendingPayments.length - overdueCount },
      { 'Concepto': 'Monto total adeudado', 'Valor': `$${totalAmount.toLocaleString('es-AR')}` }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    const today = getCurrentDateInArgentina().replace(/-/g, '');
    const fileName = `pagos-pendientes-${today}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    console.log('✅ Pagos pendientes exportados:', fileName);
    setSuccess('Pagos pendientes exportados exitosamente');
    setTimeout(() => setSuccess(''), 3000);
    
  } catch (err: any) {
    console.error('❌ Error exportando pagos pendientes:', err);
    setExportError(err.message || 'Error al exportar pagos pendientes');
    setTimeout(() => setExportError(''), 5000);
  } finally {
    setIsExporting(false);
  }
};


     // ***************************************************

  // Función para formatear nombres de métodos de pago - MEMOIZADA
  const formatPaymentMethodName = useCallback((method: string): string => {
    switch (method?.toLowerCase()) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      case 'other': return 'Otro';
      default: return method || 'No especificado';
    }
  }, []);

  // 🔧 GENERAR ACTIVIDADES RECIENTES CON FECHAS ARGENTINA - MEMOIZADO
  const recentActivities = React.useMemo(() => {
  if (!transactions.length) return [];

  // 🔍 DEBUG: Verificar transacciones de reintegro
  const refundTransactions = transactions.filter(t => 
    t.type === 'refund' || t.category === 'refund' || 
    t.description?.toLowerCase().includes('reintegro')
  );
  
  if (refundTransactions.length > 0) {
    console.log('🔍 TRANSACCIONES DE REINTEGRO ENCONTRADAS:', {
      total: refundTransactions.length,
      transactions: refundTransactions.map(t => ({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        description: t.description?.substring(0, 30) + '...'
      }))
    });
  }

  return transactions.slice(0, 10).map(transaction => {
    const displayInfo = getTransactionDisplayInfo(transaction);
    
    let memberDisplayName = 'Usuario del sistema';
    let transactionDescription = 'Transacción';
    
    if (transaction.memberName && transaction.memberName !== transaction.userName) {
      memberDisplayName = transaction.memberName;
    } else if (transaction.description) {
      const desc = transaction.description.toLowerCase();
      if (desc.includes('pago membresía') || desc.includes('pago de membresía')) {
        const match = transaction.description.match(/pago de? membresías? de (.+?)(\s|$)/i);
        if (match && match[1]) {
          memberDisplayName = match[1].trim();
        }
      }
    }
    
    if (transaction.category === 'membership') {
      transactionDescription = 'Pago de membresía';
    } else if (transaction.category === 'extra') {
      transactionDescription = 'Ingreso extra';
    } else if (transaction.category === 'refund') {
      transactionDescription = 'Devolución';
    } else if (transaction.category === 'withdrawal') {
      transactionDescription = 'Retiro de caja';
    } else if (transaction.category === 'expense') {
      transactionDescription = 'Gasto operativo';
    } else if (transaction.description && !transaction.description.toLowerCase().includes(memberDisplayName.toLowerCase())) {
      transactionDescription = transaction.description;
    }
    
    return {
      id: transaction.id || '',
      type: displayInfo.type as 'payment' | 'refund' | 'expense',
      memberName: memberDisplayName,
      description: transactionDescription,
      amount: displayInfo.displayAmount,
      method: formatPaymentMethodName(transaction.paymentMethod || 'cash'),
      timestamp: transaction.createdAt,
      status: transaction.status || 'completed',
      color: displayInfo.isIncome ? 'text-green-600' : 'text-red-600',
      symbol: displayInfo.isIncome ? '+' : '-',
      processedBy: transaction.userName || 'Sistema'
    };
  });
}, [transactions, getTransactionDisplayInfo, formatPaymentMethodName]);

  // 🔧 CARGAR MÉTRICAS CON FECHAS ARGENTINA - CORREGIDO PARA EVITAR DUPLICACIÓN
  const loadEnhancedMetrics = useCallback(async () => {

    if (!gymData?.id || !shouldLoad()) return;

     if (transactions.length === 0) {
        console.log('⏳ Esperando a que las transacciones se carguen...', {
          transactionCount: transactions.length,
          financialLoading,
          dailySummary: !!dailySummary
        });
        return; // No calcular métricas si no hay transacciones aún
      }
      console.log('🚀 INICIANDO CÁLCULO DE MÉTRICAS CON TRANSACCIONES:', transactions.length);
    
    try {
      setLastLoadTime(Date.now());
    
      // Cargar métricas de socios (resto del código igual hasta las métricas financieras)
      const [
        totalMembersSnap,
        activeMembersSnap,
        inactiveMembersSnap,
        membersWithDebtSnap
      ] = await Promise.all([
        getDocs(collection(db, `gyms/${gymData.id}/members`)),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'active')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('status', '==', 'inactive')
        )),
        getDocs(query(
          collection(db, `gyms/${gymData.id}/members`),
          where('totalDebt', '>', 0)
        ))
      ]);

      // 🔧 CARGAR PAGOS PENDIENTES - CORREGIDO PARA EVITAR DUPLICACIÓN
      let pendingPayments = 0;
      let pendingAmount = 0;
      let overduePayments = 0;
      let overdueAmount = 0;

      const payments: PendingPayment[] = [];
      const processedMembers = new Set<string>(); // 🔧 NUEVO: Evitar duplicación

      try {
        // CONSULTA LIMITADA - Solo membresías pendientes
        const pendingAssignmentsSnap = await getDocs(query(
          collection(db, `gyms/${gymData.id}/membershipAssignments`),
          where('paymentStatus', '==', 'pending'),
          where('status', '==', 'active'),
          limit(30)
        ));

        // 🔧 USAR FECHA ARGENTINA PARA COMPARAR VENCIMIENTOS
        const nowInArgentina = timestampToArgentinianDate(Timestamp.now()) || new Date();

        pendingAssignmentsSnap.forEach(doc => {
          const data = doc.data();
          const endDate = timestampToArgentinianDate(data.endDate);
          const overdue = endDate ? endDate < nowInArgentina : false;
          const cost = data.cost || 0;
          const memberId = data.memberId;

          // Marcar miembro como procesado
          processedMembers.add(memberId);

          pendingAmount += cost;
          pendingPayments++;

          if (overdue) {
            overduePayments++;
            overdueAmount += cost;
          }

          const daysOverdue = overdue && endDate ? 
            Math.floor((nowInArgentina.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)) : 
            undefined;

          payments.push({
            id: doc.id,
            memberName: data.memberName || data.firstName + ' ' + data.lastName || 'Sin nombre',
            activityName: data.activityName || 'Sin actividad',
            cost,
            startDate: data.startDate,
            endDate: data.endDate,
            overdue,
            daysOverdue
          });
        });

        // 🔧 AGREGAR SOCIOS CON DEUDA QUE NO TENGAN MEMBRESÍAS PENDIENTES
        if (membersWithDebtSnap.size > 0 && payments.length < 20) {
          let debtCount = 0;
          membersWithDebtSnap.forEach(doc => {
            if (debtCount >= 10) return;
            
            const data = doc.data();
            const debt = data.totalDebt || 0;
            const memberId = doc.id;
            
            // 🔧 SOLO AGREGAR SI NO FUE PROCESADO EN MEMBRESÍAS PENDIENTES
            if (debt > 0 && !processedMembers.has(memberId)) {
              const memberFullName = (data.firstName + ' ' + data.lastName).trim();
              
              if (memberFullName !== ' ') {
                pendingAmount += debt;
                pendingPayments++;
                overduePayments++;
                overdueAmount += debt;

                const memberCreatedDate = timestampToArgentinianDate(data.createdAt) || nowInArgentina;
                const daysSinceCreated = Math.floor((nowInArgentina.getTime() - memberCreatedDate.getTime()) / (1000 * 60 * 60 * 24));

                payments.push({
                  id: doc.id + '_debt',
                  memberName: memberFullName,
                  activityName: 'Deuda acumulada',
                  cost: debt,
                  startDate: data.createdAt || Timestamp.now(),
                  endDate: data.createdAt || Timestamp.now(),
                  overdue: true,
                  daysOverdue: daysSinceCreated
                });
                
                debtCount++;
                processedMembers.add(memberId);
              }
            }
          });
        }

        setPendingPayments(payments);

        // 🔧 AGREGAR LOGGING PARA DEBUG
        console.log('💰 Resumen de Por Cobrar:', {
          pendingPayments,
          pendingAmount,
          overduePayments, 
          overdueAmount,
          totalProcessedMembers: processedMembers.size,
          breakdown: {
            fromMembershipAssignments: pendingAssignmentsSnap.size,
            fromMemberDebt: payments.filter(p => p.id.includes('_debt')).length
          }
        });

      } catch (membershipError) {
        console.error('Error loading payments:', membershipError);
        setPendingPayments([]);
      }

      // 🔧 CALCULAR MÉTRICAS FINANCIERAS CON FECHAS ARGENTINA
      let todayIncome = 0;
      let todayExpenses = 0;
      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      let refundsToday = 0;

      if (dailySummary) {
        todayIncome = dailySummary.totalIncome;
        todayExpenses = dailySummary.totalExpenses;
        refundsToday = dailySummary.refunds;
      }

      // 🔧 CALCULAR TOTALES MENSUALES CON FECHAS ARGENTINA
      const monthlyTransactions = transactions.filter(t => {
        const transactionDateArg = timestampToArgentinianDate(t.createdAt);
        const thisMonthStartArg = timestampToArgentinianDate(dateRanges.thisMonthStart);
        
        return transactionDateArg && thisMonthStartArg && transactionDateArg >= thisMonthStartArg;
      });


              // 🔍 AGREGAR ESTOS LOGS PARA DEBUG
        console.log('🔍 DEBUG MÉTRICAS MENSUALES:', {
          totalTransactions: transactions.length,
          thisMonthStart: dateRanges.thisMonthStart,
          thisMonthStartConverted: timestampToArgentinianDate(dateRanges.thisMonthStart),
          monthlyTransactionsFound: monthlyTransactions.length,
          sampleTransaction: transactions[0] ? {
            id: transactions[0].id,
            createdAt: transactions[0].createdAt,
            convertedDate: timestampToArgentinianDate(transactions[0].createdAt),
            amount: transactions[0].amount,
            type: transactions[0].type
          } : 'No transactions'
        });

        if (monthlyTransactions.length > 0) {
          console.log('🔍 TRANSACCIONES MENSUALES ENCONTRADAS:', 
            monthlyTransactions.map(t => ({
              id: t.id,
              amount: t.amount,
              type: t.type,
              category: t.category,
              date: timestampToArgentinianDate(t.createdAt)
            }))
          );
        }

        monthlyTransactions.forEach(transaction => {
          const displayInfo = getTransactionDisplayInfo(transaction);
          
          console.log('🔍 PROCESANDO TRANSACCIÓN MENSUAL:', {
            id: transaction.id,
            amount: transaction.amount,
            displayAmount: displayInfo.displayAmount,
            isIncome: displayInfo.isIncome,
            isRefund: displayInfo.isRefund,
            isExpense: displayInfo.isExpense,
            status: transaction.status
          });
          
          if (transaction.status === 'completed') {
            if (displayInfo.isIncome) {
              monthlyIncome += displayInfo.displayAmount;
              console.log('✅ SUMANDO A INGRESOS MENSUALES:', displayInfo.displayAmount, 'Total:', monthlyIncome);
            } else if (displayInfo.isRefund || displayInfo.isExpense) {
              monthlyExpenses += displayInfo.displayAmount;
              console.log('❌ SUMANDO A EGRESOS MENSUALES:', displayInfo.displayAmount, 'Total:', monthlyExpenses);
            }
          }
        });

        console.log('📊 RESULTADO FINAL MÉTRICAS MENSUALES:', {
          monthlyIncome,
          monthlyExpenses,
          monthlyNet: monthlyIncome - monthlyExpenses
        });




      monthlyTransactions.forEach(transaction => {
        const displayInfo = getTransactionDisplayInfo(transaction);
        
        if (transaction.status === 'completed') {
          if (displayInfo.isIncome) {
            monthlyIncome += displayInfo.displayAmount;
          } else if (displayInfo.isRefund || displayInfo.isExpense) {
            monthlyExpenses += displayInfo.displayAmount;
          }
        }
      });

      // Actualizar métricas
      setMetrics({
        totalMembers: totalMembersSnap.size,
        activeMembers: activeMembersSnap.size,
        inactiveMembers: inactiveMembersSnap.size,
        membersWithDebt: membersWithDebtSnap.size,
        todayIncome,
        todayExpenses,
        todayNet: todayIncome - todayExpenses,
        monthlyIncome,
        monthlyExpenses,
        monthlyNet: monthlyIncome - monthlyExpenses,
        pendingPayments,
        pendingAmount, // 🔧 AHORA SIN DUPLICACIÓN
        overduePayments,
        overdueAmount,
        refundsToday
      });

    } catch (err: any) {
      console.error('Error loading enhanced metrics:', err);
      setError('Error al cargar las métricas del dashboard');
    }
  }, [gymData?.id, shouldLoad, transactions, dateRanges.thisMonthStart, dailySummary, getTransactionDisplayInfo]);

  // Cargar todos los datos - CON CONTROL DE BUCLES
  const loadDashboardData = useCallback(async () => {
    if (!gymData?.id || !shouldLoad()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadEnhancedMetrics(),
        refreshFinancialData()
      ]);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [gymData?.id, shouldLoad, loadEnhancedMetrics, refreshFinancialData]);

  // Refrescar datos
  const handleRefresh = async () => {
    if (refreshing || !shouldLoad()) return;
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // 🔧 EFECTO PARA SINCRONIZAR CON DATOS DEL HOOK useFinancial
useEffect(() => {
  if (dailySummary && !financialLoading) {
    console.log('🔄 Sincronizando métricas con dailySummary:', dailySummary);
    
    // 🔍 DEBUG: Verificar si hay reintegros en el dailySummary
    if (dailySummary.refunds > 0) {
      console.log('🔄 REINTEGROS DETECTADOS EN DAILY SUMMARY:', {
        refunds: dailySummary.refunds,
        totalExpenses: dailySummary.totalExpenses
      });
    }
    
    setMetrics(prev => ({
      ...prev,
      todayIncome: dailySummary.totalIncome,
      todayExpenses: dailySummary.totalExpenses,
      todayNet: dailySummary.totalIncome - dailySummary.totalExpenses,
      refundsToday: dailySummary.refunds
    }));
  }
}, [dailySummary, financialLoading]);

      useEffect(() => {
      if (gymData?.id && transactions.length > 0) { // 🔧 AGREGAR CONDICIÓN DE TRANSACCIONES
        console.log('🔄 INICIANDO CARGA DE DASHBOARD CON TRANSACCIONES:', transactions.length);
        loadDashboardData();
      } else if (gymData?.id && transactions.length === 0) {
        console.log('⏳ Esperando transacciones para cargar dashboard...');
      }
    }, [gymData?.id, transactions.length]);

          // 🔧 NUEVO useEffect para manejar la carga inicial
      useEffect(() => {
        // Cargar datos cuando las transacciones estén disponibles por primera vez
        if (gymData?.id && transactions.length > 0 && Object.values(metrics).every(v => v === 0)) {
          console.log('🎯 PRIMERA CARGA DE MÉTRICAS CON TRANSACCIONES DISPONIBLES');
          loadEnhancedMetrics();
        }
      }, [gymData?.id, transactions.length, metrics, loadEnhancedMetrics]);

  // Auto-refresh cada 15 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      if (shouldLoad()) {
        loadDashboardData();
      }
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadDashboardData, shouldLoad]);

  // Filtrar pagos pendientes
  const filteredPendingPayments = pendingPayments.filter(payment => {
    if (paymentFilter === 'pending') return !payment.overdue;
    if (paymentFilter === 'overdue') return payment.overdue;
    return true;
  });

  // 🔧 FORMATEAR FECHA USANDO TIMEZONE ARGENTINA
  const formatSafeDate = (date: any): string => {
    const argDate = timestampToArgentinianDate(date);
    if (!argDate) return 'Sin fecha';
    
    return argDate.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Obtener color para el indicador de red amount
  const getNetAmountColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Obtener icono para método de pago
  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash':
      case 'efectivo':
        return <Wallet size={16} className="text-green-600" />;
      case 'card':
      case 'tarjeta':
        return <CreditCard size={16} className="text-blue-600" />;
      case 'transfer':
      case 'transferencia':
        return <ArrowUpRight size={16} className="text-purple-600" />;
      default: 
        return <DollarSign size={16} className="text-gray-600" />;
    }
  };

    if (loading && Object.values(metrics).every(v => v === 0) && !dailySummary) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando dashboard financiero...</p>
            <p className="text-sm text-gray-500 mt-2">
              {transactions.length === 0 
                ? 'Cargando transacciones...' 
                : `Procesando ${transactions.length} transacciones...`
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Fecha: {formatDateForDisplay(getCurrentDateInArgentina())}
            </p>
          </div>
        </div>
      );
    }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header con info de timezone */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Financiero</h1>
          <p className="text-gray-600 mt-1">
            Gestión integral de {gymData?.name || 'tu gimnasio'}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            📍 {formatDateForDisplay(getCurrentDateInArgentina())} - {getCurrentTimeInArgentina()} (Argentina)
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin mr-2' : 'mr-2'} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Error state */}
      {(error || financialError) && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-red-600 mr-2" />
            <span className="text-red-700">{error || financialError}</span>
            <button
              onClick={handleRefresh}
              className="ml-auto px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

        {exportError && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle size={20} className="text-yellow-600 mr-2" />
              <span className="text-yellow-700">{exportError}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
            <div className="flex items-center">
              <CheckCircle size={20} className="text-green-600 mr-2" />
              <span className="text-green-700">{success}</span>
            </div>
          </div>
        )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Ingresos Hoy */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Hoy</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.todayIncome)}
              </p>
              <div className="flex items-center mt-2">
                <span className={`text-sm ${getNetAmountColor(metrics.todayNet)}`}>
                  Neto: {formatCurrency(metrics.todayNet)}
                </span>
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <ArrowUpRight size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Pagos Pendientes */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(metrics.pendingAmount)}
              </p>
              <div className="flex items-center mt-2">
                <Info size={14} className="text-gray-400 mr-1" />
                <span className="text-sm text-gray-500">
                  {metrics.pendingPayments} pendientes • {metrics.overduePayments} vencidos
                </span>
              </div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg">
              <Clock size={24} className="text-amber-600" />
            </div>
          </div>
        </div>

        {/* Ingresos Mensuales */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Mensuales</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(metrics.monthlyIncome)}
              </p>
              <div className="flex items-center mt-2">
                <span className={`text-sm ${getNetAmountColor(metrics.monthlyNet)}`}>
                  Neto: {formatCurrency(metrics.monthlyNet)}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Socios */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Socios Activos</p>
              <p className="text-2xl font-bold text-purple-600">{metrics.activeMembers}</p>
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-500">
                  {metrics.membersWithDebt} con deuda
                </span>
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <Users size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vista General
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Información de Pagos ({metrics.pendingPayments})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transacciones Recientes
            </button>
          </nav>
        </div>

        {/* Contenido de las tabs */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Alertas financieras */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas Financieras</h3>
                <div className="space-y-3">
                  {metrics.overduePayments > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-sm text-red-700">Pagos vencidos</span>
                      <span className="text-sm font-bold text-red-700">{metrics.overduePayments}</span>
                    </div>
                  )}
                  {metrics.pendingPayments > 0 && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm text-yellow-700">Pagos pendientes</span>
                      <span className="text-sm font-bold text-yellow-700">{metrics.pendingPayments}</span>
                    </div>
                  )}
                  {metrics.refundsToday > 0 && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm text-purple-700">Devoluciones hoy</span>
                      <span className="text-sm font-bold text-purple-700">{metrics.refundsToday}</span>
                    </div>
                  )}
                  {metrics.overduePayments === 0 && metrics.pendingPayments === 0 && metrics.refundsToday === 0 && metrics.membersWithDebt === 0 && (
                    <div className="flex items-center justify-center p-3 bg-green-50 rounded-lg">
                      <CheckCircle size={16} className="text-green-600 mr-2" />
                      <span className="text-sm text-green-700">Todo al día</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Métodos de pago hoy */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Métodos de Pago Hoy</h3>
                <div className="space-y-3">
                  {dailySummary && dailySummary.paymentBreakdown && dailySummary.paymentBreakdown.length > 0 ? (
                    dailySummary.paymentBreakdown.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          {getPaymentMethodIcon(payment.paymentMethod)}
                          <span className="text-sm text-gray-700 ml-2">
                            {formatPaymentMethodName(payment.paymentMethod)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(payment.totalAmount)}</div>
                          <div className="text-xs text-gray-500">
                            {dailySummary && dailySummary.totalIncome > 0 ? 
                              ((payment.totalAmount / dailySummary.totalIncome) * 100).toFixed(1) : 0}%
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center">Sin pagos registrados</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {/* Filtros de pagos */}
              <div className="flex space-x-2 mb-6">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-4 py-2 rounded-lg ${
                    paymentFilter === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Todos ({metrics.pendingPayments})
                </button>
                <button
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-4 py-2 rounded-lg ${
                    paymentFilter === 'pending' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Pendientes ({metrics.pendingPayments - metrics.overduePayments})
                </button>
                <button
                  onClick={() => setPaymentFilter('overdue')}
                  className={`px-4 py-2 rounded-lg ${
                    paymentFilter === 'overdue' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Vencidos ({metrics.overduePayments})
                </button>
              </div>

              {/* Lista de pagos pendientes */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Información de Pagos Pendientes</h3>
                <button
                  onClick={handleExportPendingPayments}
                  disabled={isExporting || filteredPendingPayments.length === 0}
                  className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Exportar pagos pendientes a Excel"
                >
                  <Download size={14} className={isExporting ? 'animate-pulse mr-1' : 'mr-1'} />
                  {isExporting ? 'Exportando...' : 'Exportar Excel'}
                </button>
              </div>

              {filteredPendingPayments.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto text-green-300 mb-3" />
                  <p className="text-gray-500">
                    {paymentFilter === 'all' 
                      ? 'No hay pagos pendientes' 
                      : paymentFilter === 'pending'
                      ? 'No hay pagos pendientes sin vencer'
                      : 'No hay pagos vencidos'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPendingPayments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className={`p-4 rounded-lg border-2 ${
                        payment.overdue 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <User size={16} className="text-gray-600 mr-2" />
                            <span className="font-medium text-gray-900">{payment.memberName}</span>
                            {payment.overdue && (
                              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                Vencido hace {payment.daysOverdue} días
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar size={14} className="mr-1" />
                            <span>{payment.activityName}</span>
                            <span className="mx-2">•</span>
                            <span>Vence: {formatSafeDate(payment.endDate)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {formatCurrency(payment.cost)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {payment.overdue ? 'Vencido' : 'Pendiente'}
                            </div>
                          </div>
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Info size={20} className="text-gray-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div>
              <div className="flex space-x-2">
                <button
                  onClick={handleExportRecentTransactions}
                  disabled={isExporting || recentActivities.length === 0}
                  className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Exportar transacciones recientes a Excel"
                >
                  <Download size={14} className={isExporting ? 'animate-pulse mr-1' : 'mr-1'} />
                  {isExporting ? 'Exportando...' : 'Transacciones'}
                </button>
              </div>
              
              {recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No hay transacciones recientes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio/Concepto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procesado por</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentActivities.map((activity, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`p-2 rounded-full mr-3 ${
                                activity.type === 'payment' ? 'bg-green-100' : 
                                activity.type === 'refund' ? 'bg-orange-100' : 'bg-red-100'
                              }`}>
                                {activity.type === 'payment' ? (
                                  <ArrowUpRight size={16} className="text-green-600" />
                                ) : activity.type === 'refund' ? (
                                  <ArrowDownLeft size={16} className="text-orange-600" />
                                ) : (
                                  <ArrowDownLeft size={16} className="text-red-600" />
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {activity.type === 'payment' ? 'Pago' : 
                                 activity.type === 'refund' ? 'Devolución' : 'Gasto'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{activity.memberName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{activity.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`text-sm font-medium ${activity.color}`}>
                              {activity.symbol}{formatCurrency(activity.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getPaymentMethodIcon(activity.method)}
                              <span className="text-sm text-gray-700 ml-2">{activity.method}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">
                              {formatArgentinianDateTime(activity.timestamp)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">{activity.processedBy}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumen financiero del mes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.monthlyIncome)}</div>
            <div className="text-sm text-gray-500">Ingresos totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{formatCurrency(metrics.monthlyExpenses)}</div>
            <div className="text-sm text-gray-500">Egresos totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(metrics.pendingAmount)}
            </div>
            <div className="text-sm text-gray-500">Por cobrar</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getNetAmountColor(metrics.monthlyNet)}`}>
              {formatCurrency(metrics.monthlyNet)}
            </div>
            <div className="text-sm text-gray-500">Balance neto</div>
          </div>
        </div>
      </div>

      {/* Footer del dashboard */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Dashboard financiero con zona horaria Argentina (UTC-3). Actualización automática cada 15 minutos.
          <br />
          Última actualización: {formatArgentinianDateTime(Timestamp.now())}
        </p>
      </div>
    </div>
  );
};

export default DashboardImproved;
                    