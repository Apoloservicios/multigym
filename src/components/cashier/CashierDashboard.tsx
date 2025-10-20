// src/components/cashier/CashierDashboard.tsx - FECHAS CORREGIDAS PARA ARGENTINA

import React, { useState, useEffect } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, TrendingDown, PlusCircle, MinusCircle, 
  RefreshCw, AlertCircle, XCircle, CheckCircle, FileText , AlertTriangle,FileSpreadsheet,Package  
} from 'lucide-react';

import DailyCashService, {
  getDailyCashByDate, 
  getTransactionsByDate 
} from '../../services/dailyCash.service';

import { 
  formatCurrency, 
  formatTime,
  toJavaScriptDate,
  formatDate 
} from '../../utils/formatting.utils';
import { 
  normalizeDailyCashForLegacy,
  calculateCashBalance 
} from '../../utils/compatibility.utils';

import { 
  getCurrentDateInArgentina,
  getCurrentTimeInArgentina,
  formatDateForDisplay,
  isTodayInArgentina,
  formatArgentinianDateTime,
  formatArgentinianTime
} from '../../utils/timezone.utils';
import { exportTransactionsToExcel } from '../../utils/excel.utils';

import { DailyCash, Transaction } from '../../types/gym.types';
import useAuth from '../../hooks/useAuth';
import TransactionList from './TransactionList';
import CashierSummary from './CashierSummary';
import IncomeForm from './IncomeForm';
import ExpenseForm from './ExpenseForm';
import CloseBoxForm from './CloseBoxForm';
import OpenBoxForm from './OpenBoxForm';
import ProductSaleForm from './ProductSaleForm';




const getCashProperty = (cashData: any, primaryProp: string, fallbackProp?: string) => {
  if (!cashData) return 0;
  return cashData[primaryProp] || (fallbackProp ? cashData[fallbackProp] : 0);
};

// Cambiar la línea del tipo ViewType (busca donde dice type ViewType)
type ViewType = 'summary' | 'open' | 'close' | 'income' | 'expense' | 'transactions' | 'productSale';



const CashierDashboard: React.FC = () => {
  const { gymData, userData } = useAuth();
  
  const [view, setView] = useState<ViewType>('summary');
  const [dailyCash, setDailyCash] = useState<DailyCash | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>('');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
  // 🔧 FUNCIÓN PARA OBTENER FECHA ARGENTINA CORRECTA
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires"
  }));
  
  const year = argentinaTime.getFullYear();
  const month = String(argentinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(argentinaTime.getDate()).padStart(2, '0');
  
  const todayArgentina = `${year}-${month}-${day}`;
  console.log('🇦🇷 Fecha inicial Argentina:', todayArgentina);
  
  return todayArgentina;
});

  // 🔧 FUNCIÓN PARA VERIFICAR SI LA FECHA SELECCIONADA ES HOY
const isToday = (): boolean => {
  return isTodayInArgentina(selectedDate);
};

  // 🔧 FUNCIÓN HELPER PARA FORMATEAR TIEMPO SEGURO
const safeFormatTime = (timestamp: any): string => {
  if (!timestamp) return 'Sin hora';
  
  try {
    return formatArgentinianTime(timestamp);
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Error en hora';
  }
};

// Reemplaza tu función handleSuccess por esta:
const handleSuccess = () => {
  loadDailyCashData(); // ← ESTE ES EL NOMBRE CORRECTO
  setView('summary');
};




useEffect(() => {
  // 🔧 FORZAR ACTUALIZACIÓN DE FECHA ARGENTINA
  const updateArgentinaDate = () => {
    const now = new Date();
    const argentinaTime = new Date(now.toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires"
    }));
    
    const year = argentinaTime.getFullYear();
    const month = String(argentinaTime.getMonth() + 1).padStart(2, '0');
    const day = String(argentinaTime.getDate()).padStart(2, '0');
    
    const todayArgentina = `${year}-${month}-${day}`;
    
    console.log('🔄 Actualizando fecha argentina:', {
      utc: now.toISOString(),
      argentina: argentinaTime.toLocaleString(),
      formatted: todayArgentina
    });
    
    setSelectedDate(todayArgentina);
  };
  
  updateArgentinaDate();
  
  // 🔧 ACTUALIZAR CADA MINUTO PARA DETECTAR CAMBIO DE DÍA
  const interval = setInterval(updateArgentinaDate, 60000);
  
  return () => clearInterval(interval);
}, []);





const formatDisplayDateArgentina = (dateString: string): string => {
  try {
    if (!dateString) return 'Sin fecha';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};



  // 🔧 CARGAR DATOS CUANDO CAMBIE LA FECHA SELECCIONADA
  useEffect(() => {
    if (selectedDate && gymData?.id) {
      console.log('📅 Fecha seleccionada cambió, cargando datos para:', selectedDate);
      loadDailyCashData();
    }
  }, [gymData?.id, selectedDate]);



        // 🆕 4. FUNCIÓN PARA EXPORTAR TRANSACCIONES A EXCEL
      const handleExportDailyTransactions = async () => {
        if (!transactions.length) {
          setExportError('No hay transacciones para exportar en esta fecha');
          setTimeout(() => setExportError(''), 3000);
          return;
        }

        setIsExporting(true);
        setExportError('');

        try {
          // Generar nombre de archivo con fecha
          const dateForFileName = selectedDate.replace(/-/g, '');
          const displayDate = formatDateForDisplay(selectedDate);
          const fileName = `caja-diaria-${dateForFileName}.xlsx`;
          
          console.log('📊 Exportando transacciones de caja diaria:', {
            date: selectedDate,
            count: transactions.length,
            fileName
          });
          
          // Exportar usando la utilidad existente
          exportTransactionsToExcel(
            transactions, 
            `Caja Diaria ${displayDate}`, 
            fileName
          );

          setSuccess(`✅ Transacciones del ${displayDate} exportadas exitosamente`);
          setTimeout(() => setSuccess(''), 3000);
          
        } catch (err: any) {
          console.error('❌ Error exportando transacciones de caja:', err);
          setExportError(err.message || 'Error al exportar transacciones');
          setTimeout(() => setExportError(''), 5000);
        } finally {
          setIsExporting(false);
        }
      };

  // 🔧 FUNCIÓN MEJORADA PARA CARGAR DATOS DE CAJA DIARIA
  const loadDailyCashData = async () => {
    if (!gymData?.id || !selectedDate) {
      console.warn('⚠️ No se puede cargar datos: gymData o selectedDate faltante');
      setLoading(false);
      return;
    }

    console.log('🔄 Cargando datos de caja para:', { gymId: gymData.id, date: selectedDate });
    setLoading(true);
    setError('');

    try {
      // Intentar obtener la caja diaria para la fecha seleccionada
      let cashData = null;
      try {
        cashData = await getDailyCashByDate(gymData.id, selectedDate);
        console.log('💰 Datos de caja obtenidos:', cashData);
      } catch (error) {
        console.log('ℹ️ No hay caja para esta fecha:', selectedDate);
      }

      setDailyCash(cashData ? normalizeDailyCashForLegacy(cashData) : null);

      // Cargar transacciones del día (incluso si no hay caja abierta)
      try {
        const dayTransactions = await getTransactionsByDate(gymData.id, selectedDate);
        console.log('📊 Transacciones del día cargadas:', dayTransactions.length);
        setTransactions(dayTransactions);
      } catch (transactionError) {
        console.warn('⚠️ Error cargando transacciones:', transactionError);
        setTransactions([]);
      }

    } catch (err: any) {
      console.error('❌ Error loading daily cash data:', err);
      setError(err.message || 'Error al cargar los datos de caja diaria');
    } finally {
      setLoading(false);
    }
  };

  // Refrescar datos manualmente
  const handleRefresh = async () => {
    console.log('🔄 Refrescando datos manualmente...');
    setRefreshing(true);
    await loadDailyCashData();
    setRefreshing(false);
  };

  // 🔧 MANEJAR CAMBIO DE FECHA CON VALIDACIÓN
    const handleDateChange = (newDate: string) => {
      console.log('📅 Cambiando fecha de', selectedDate, 'a', newDate);
      setSelectedDate(newDate);
      setError(''); // Limpiar errores previos
      setSuccess(''); // Limpiar mensajes de éxito previos
      setExportError(''); // Limpiar errores de exportación
    };

  // Manejar apertura de caja
const handleOpenBox = async (openingAmount: number, notes: string) => {
  if (!gymData?.id || !userData?.id) {
    setError('No se puede abrir la caja. Datos incompletos.');
    return;
  }

  console.log('🔓 Abriendo caja:', { date: selectedDate, amount: openingAmount });
  setLoading(true);
  setError('');

  try {
    const result = await DailyCashService.openDailyCash(gymData.id, {
      openingAmount,
      notes,
      userId: userData.id,
      userName: userData.name || userData.email || 'Usuario',
      date: selectedDate
    });

    if (result.success) {
      setSuccess('Caja abierta correctamente');
      await loadDailyCashData();
      setView('summary');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } else {
      throw new Error(result.error || 'Error al abrir la caja');
    }
  } catch (err: any) {
    console.error('❌ Error opening daily cash:', err);
    setError(err.message || 'Error al abrir la caja');
  } finally {
    setLoading(false);
  }
};

  // Manejar cierre de caja
const handleCloseBox = async (closingAmount: number, notes: string) => {
  if (!gymData?.id || !userData?.id || !dailyCash) {
    setError('No se puede cerrar la caja. Datos incompletos.');
    return;
  }

  console.log('🔒 Cerrando caja:', { date: selectedDate, amount: closingAmount });
  setLoading(true);
  setError('');

  try {
    const result = await DailyCashService.closeDailyCash(gymData.id, selectedDate, {
      closingAmount,
      notes,
      userId: userData.id,
      userName: userData.name || userData.email || 'Usuario'
    });

    if (result.success) {
      setSuccess('Caja cerrada correctamente');
      await loadDailyCashData();
      setView('summary');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } else {
      throw new Error(result.error || 'Error al cerrar la caja');
    }
  } catch (err: any) {
    console.error('❌ Error closing daily cash:', err);
    setError(err.message || 'Error al cerrar la caja');
  } finally {
    setLoading(false);
  }
};

  

  // 🔧 FUNCIÓN MEJORADA PARA CALCULAR BALANCE
  const calculateCurrentBalance = (): number => {
    if (!dailyCash) return 0;
    return calculateCashBalance(dailyCash);
  };

  // Renderizar la vista actual según el estado
  const renderCurrentView = () => {
    if (loading && view !== 'open') {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Cargando datos de caja...</span>
        </div>
      );
    }

    // 🔧 MOSTRAR FORMULARIO DE APERTURA SI NO HAY CAJA Y ES HOY
    if (view === 'open' || (!dailyCash && isTodayInArgentina(selectedDate))) {
      return (
        <OpenBoxForm
          selectedDate={selectedDate}
          isReopening={dailyCash?.status === 'closed'}
          onOpen={handleOpenBox}
          onCancel={() => setView('summary')}
        />
      );
    }



    if (!dailyCash) {
      return (
        <div className="p-6 text-center">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              No hay caja abierta para {formatDateForDisplay(selectedDate)}
            </h3>
            <p className="mt-2 text-gray-500">
              No se ha abierto caja para el día seleccionado
            </p>
          </div>
          
          {isTodayInArgentina(selectedDate) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm font-medium">
                📍 Fecha actual en Argentina: {formatDateForDisplay(getCurrentDateInArgentina())}
              </p>
              <p className="text-blue-600 text-sm mt-1">
                Hora: {getCurrentTimeInArgentina()}
              </p>
            </div>
          )}
          
          {isTodayInArgentina(selectedDate) && (
            <button
              onClick={() => setView('open')}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center mx-auto"
            >
              <DollarSign size={20} className="mr-2" />
              Abrir Caja
            </button>
          )}
          
          {!isTodayInArgentina(selectedDate) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Solo se puede abrir la caja para el día actual
              </p>
            </div>
          )}
        </div>
      );
    }

      switch (view) {
        case 'income':
          return (
            <IncomeForm 
              selectedDate={selectedDate}
              onSuccess={() => {
                setSuccess('Ingreso registrado correctamente');
                loadDailyCashData();
                setView('summary');
                setTimeout(() => setSuccess(''), 3000);
              }}
              onCancel={() => setView('summary')}
            />
          );
          
        case 'expense':
          return (
            <ExpenseForm
              selectedDate={selectedDate}
              onSuccess={() => {
                setSuccess('Gasto registrado correctamente');
                loadDailyCashData();
                setView('summary');
                setTimeout(() => setSuccess(''), 3000);
              }}
              onCancel={() => setView('summary')}
            />
          );
          
        case 'transactions':
          return (
            <TransactionList 
              transactions={transactions} 
              selectedDate={selectedDate}
              isLoading={loading}
            />
          );
          
        case 'close':
          return (
            <CloseBoxForm
              dailyCash={dailyCash}
              currentBalance={calculateCurrentBalance()}
              onClose={handleCloseBox}
              onCancel={() => setView('summary')}
            />
          );
          
        // ✅ AGREGAR ESTE CASO:
        case 'productSale':
          return (
            <ProductSaleForm
              selectedDate={selectedDate}
              onSuccess={handleSuccess}
              onCancel={() => setView('summary')}
            />
          );
          
        case 'summary':
        default:
          return (
            <CashierSummary
              dailyCash={dailyCash}
              transactions={transactions}
              currentBalance={calculateCurrentBalance()}
              isLoading={loading}
              onViewTransactions={() => setView('transactions')}
              selectedDate={selectedDate}
            />
          );
      }
  };

  // Determinar si se puede cerrar la caja
  const canCloseBox = (): boolean => {
    if (!dailyCash) return false;
    if (dailyCash.status !== 'open') return false;
    return isTodayInArgentina(dailyCash.date);
  };

  // Determinar si se puede abrir/reabrir la caja
  const canOpenBox = (): boolean => {
    if (!dailyCash) {
      return isTodayInArgentina(selectedDate);
    }
    
    if (dailyCash.status === 'closed') {
      return isTodayInArgentina(selectedDate);
    }
    
    return false;
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        


        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Gestiona ingresos, gastos y cierre de caja
          </h1>
       {/*    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-blue-50 p-4 rounded-lg">
            <div>
              <p className="text-blue-800 font-medium">
                📍 Fecha actual en Argentina: {formatDateForDisplay(getCurrentDateInArgentina())}
              </p>
              <p className="text-blue-600 text-sm">
                🕐 Hora actual: {getCurrentTimeInArgentina()} (UTC-3)
              </p>
            </div>
            <div className="mt-3 sm:mt-0">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div> */}
        </div>
        
        {/* 🔧 SELECTOR DE FECHA CON MÁXIMO EN FECHA ARGENTINA */}
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={18} className="text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={getCurrentDateInArgentina()} // 🔧 USAR FECHA ARGENTINA COMO MÁXIMO
              className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin text-blue-500' : 'text-gray-500'} />
          </button>
        </div>
      </div>
      
      {/* Mensajes de error y éxito */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
          <button 
            onClick={() => setError('')}
            className="ml-auto"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {exportError && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-yellow-600 mr-2" />
            <span className="text-yellow-700">{exportError}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
          <CheckCircle size={18} className="mr-2" />
          {success}
          <button 
            onClick={() => setSuccess('')}
            className="ml-auto"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}
      
      {/* 🔧 ESTADO DE LA CAJA MEJORADO CON INDICADORES */}
      {dailyCash && dailyCash.id && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold text-gray-900">
  Estado de Caja - {formatDateForDisplay(selectedDate)} {isToday() ? '(HOY)' : ''}
              </h2>
              <div className="mt-2 flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  dailyCash.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {dailyCash.status === 'open' ? 'Abierta' : 'Cerrada'}
                </span>
                {dailyCash.status === 'open' ? (
                  <span className="ml-2 text-xs text-gray-500">
                    Abierta desde: safeFormatTime(dailyCash.openingTime || dailyCash.openedAt)
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-gray-500">
                    Cerrada a las: safeFormatTime(dailyCash.closingTime || dailyCash.closedAt)
                  </span>
                )}
              </div>
            </div>
            
            <div>
              <div className="text-gray-600">Balance Actual:</div>
              <div className="text-2xl font-bold">
                {formatCurrency(calculateCurrentBalance())}
              </div>
            </div>
          </div>
          
          {/* Resumen con campos compatibles */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Saldo Inicial</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(getCashProperty(dailyCash, 'openingAmount', 'openingBalance'))}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Ingresos</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(dailyCash.totalIncome || 0)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Egresos</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(getCashProperty(dailyCash, 'totalExpense', 'totalExpenses'))}

                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" />
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Membresías</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(dailyCash.membershipIncome || 0)}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>
          
          {/* Acciones */}
          <div className="flex flex-wrap mt-6 gap-3">
            {canOpenBox() && (
              <button
                onClick={() => setView('open')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <DollarSign size={18} className="mr-2" />
                {dailyCash.status === 'closed' ? 'Reabrir Caja' : 'Abrir Caja'}
              </button>
            )}

            <button
              onClick={() => setView('productSale')}
              disabled={dailyCash.status === 'closed'}
              className={`px-4 py-2 rounded-md flex items-center ${
                dailyCash.status === 'closed'
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <Package size={18} className="mr-2" />
              Vender Productos
            </button>
            
            <button
              onClick={() => setView('income')}
              disabled={dailyCash.status === 'closed'}
              className={`px-4 py-2 rounded-md flex items-center ${
                dailyCash.status === 'closed'
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <PlusCircle size={18} className="mr-2" />
              Registrar Ingreso
            </button>
            
            <button
              onClick={() => setView('expense')}
              disabled={dailyCash.status === 'closed'}
              className={`px-4 py-2 rounded-md flex items-center ${
                dailyCash.status === 'closed' 
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <MinusCircle size={18} className="mr-2" />
              Registrar Egreso
            </button>
            
            <button
              onClick={() => setView('transactions')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <FileText size={18} className="mr-2" />
              Ver Movimientos
            </button>
            
            {canCloseBox() && (
              <button
                onClick={() => setView('close')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
              >
                <CheckCircle size={18} className="mr-2" />
                Cerrar Caja
              </button>
            )}

            <button
              onClick={handleExportDailyTransactions}
              disabled={isExporting || transactions.length === 0 || loading}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              title="Exportar transacciones a Excel"
            >
              <FileSpreadsheet size={16} className={isExporting ? 'animate-pulse mr-2' : 'mr-2'} />
              {isExporting ? 'Exportando...' : 'Excel'}
            </button>
          </div>
        </div>
      )}
      
      {/* Contenido principal según la vista actual */}
      <div className="bg-white rounded-lg shadow-md">
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default CashierDashboard;