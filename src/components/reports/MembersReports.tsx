// src/components/reports/MembersReports.tsx
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Search, Download, FilterX, Users, CreditCard, 
  AlertCircle, ArrowUp, ArrowDown, UserPlus
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import useAuth from '../../hooks/useAuth';
import { Member } from '../../types/member.types';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Extendemos la interfaz Member para agregarle el campo createdAt
interface MemberWithTimestamp extends Member {
  createdAt?: any;
  updatedAt?: any;
}

const MembersReports: React.FC = () => {
  const { gymData } = useAuth();
  
  // Estado para las fechas del reporte
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Tres meses atrás por defecto
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Estado para los datos del reporte
  const [members, setMembers] = useState<MemberWithTimestamp[]>([]);
  const [newMembers, setNewMembers] = useState<MemberWithTimestamp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Datos procesados para gráficos
  const [statusData, setStatusData] = useState<any[]>([]);
  const [debtData, setDebtData] = useState<any[]>([]);
  const [membersByMonth, setMembersByMonth] = useState<any[]>([]);
  
  // Estadísticas
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [newMembersCount, setNewMembersCount] = useState<number>(0);
  const [activeMembers, setActiveMembers] = useState<number>(0);
  const [totalDebt, setTotalDebt] = useState<number>(0);
  
  // Cargar datos
  useEffect(() => {
    loadMembersData();
  }, [gymData?.id, startDate, endDate]);
  
  // Función para cargar datos de socios
  const loadMembersData = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Convertir fechas para la consulta
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      // Consultar colección de socios
      const membersRef = collection(db, `gyms/${gymData.id}/members`);
      const q = query(
        membersRef,
        orderBy('lastName', 'asc') // Cambiado a lastName ya que createdAt puede no existir
      );
      
      const querySnapshot = await getDocs(q);
      const membersData: MemberWithTimestamp[] = [];
      
      querySnapshot.forEach(doc => {
        membersData.push({
          id: doc.id,
          ...doc.data()
        } as MemberWithTimestamp);
      });
      
      setMembers(membersData);
      
      // Filtrar nuevos socios en el período seleccionado
      const newMembersData = membersData.filter(member => {
        if (!member.createdAt) return false;
        
        const createdDate = member.createdAt.toDate 
          ? member.createdAt.toDate() 
          : new Date(member.createdAt);
          
        return createdDate >= start && createdDate <= end;
      });
      
      setNewMembers(newMembersData);
      
      // Procesar datos para estadísticas y gráficos
      processMembersData(membersData, newMembersData);
    } catch (err: any) {
      console.error('Error loading members data:', err);
      setError(err.message || 'Error al cargar los datos de socios');
    } finally {
      setLoading(false);
    }
  };
  
  // Procesar datos para gráficos y estadísticas
  const processMembersData = (allMembers: MemberWithTimestamp[], newMembers: MemberWithTimestamp[]) => {
    // Estadísticas básicas
    const total = allMembers.length;
    const newTotal = newMembers.length;
    const active = allMembers.filter(m => m.status === 'active').length;
    const debt = allMembers.reduce((sum, m) => sum + (m.totalDebt || 0), 0);
    
    setTotalMembers(total);
    setNewMembersCount(newTotal);
    setActiveMembers(active);
    setTotalDebt(debt);
    
    // Datos para gráfico de estado
    const statusCount = {
      active: allMembers.filter(m => m.status === 'active').length,
      inactive: allMembers.filter(m => m.status === 'inactive').length
    };
    
    const statusGraphData = [
      { name: 'Activos', value: statusCount.active },
      { name: 'Inactivos', value: statusCount.inactive }
    ];
    
    setStatusData(statusGraphData);
    
    // Datos para gráfico de deuda
    const withDebt = allMembers.filter(m => (m.totalDebt || 0) > 0).length;
    const withoutDebt = allMembers.length - withDebt;
    
    const debtGraphData = [
      { name: 'Con deuda', value: withDebt },
      { name: 'Sin deuda', value: withoutDebt }
    ];
    
    setDebtData(debtGraphData);
    
    // Agrupar por mes para ver evolución
    const byMonth: Record<string, number> = {};
    
    // Inicializar últimos 12 meses
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = 0;
    }
    
    // Contar por mes
    newMembers.forEach(member => {
      if (!member.createdAt) return;
      
      const createdDate = member.createdAt.toDate 
        ? member.createdAt.toDate() 
        : new Date(member.createdAt);
      
      const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    });
    
    const monthsData = Object.entries(byMonth).map(([month, count]) => {
      const [year, monthNum] = month.split('-');
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
      return {
        month: `${monthName} ${year}`,
        count
      };
    });
    
    setMembersByMonth(monthsData);
  };
  
  // Exportar a CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      // Crear contenido CSV
      let csvContent = 'ID,Nombre,Apellido,Email,Teléfono,Estado,Deuda,Fecha de Registro\n';
      
      members.forEach(member => {
        const createdAt = member.createdAt && (member.createdAt.toDate 
          ? member.createdAt.toDate().toLocaleDateString('es-AR') 
          : new Date(member.createdAt).toLocaleDateString('es-AR'));
          
        const firstName = member.firstName.replace(/,/g, ' ');
        const lastName = member.lastName.replace(/,/g, ' ');
        const email = (member.email || '').replace(/,/g, ' ');
        
        csvContent += `${member.id},${firstName},${lastName},${email},${member.phone || ''},${member.status},${member.totalDebt || 0},${createdAt || ''}\n`;
      });
      
      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `socios_${startDate}_${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Colores para los gráficos
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Informe de Socios</h2>
      
      {/* Filtros de fecha */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h3 className="text-lg font-semibold mb-4 md:mb-0">Período del Informe</h3>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span>a</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-gray-400" />
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={loadMembersData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Search size={18} className="mr-2" />
              Generar Informe
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={isExporting || members.length === 0}
              className={`px-4 py-2 rounded-md flex items-center ${
                isExporting || members.length === 0
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Download size={18} className="mr-2" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <AlertCircle size={18} className="mr-2" />
            {error}
          </div>
        )}
        
        {/* Selector de fecha rápido */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date();
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              setStartDate(startOfMonth.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Este mes
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
              setStartDate(threeMonthsAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Últimos 3 meses
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const startOfYear = new Date(today.getFullYear(), 0, 1);
              setStartDate(startOfYear.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Este año
          </button>
          
          <button
            onClick={() => {
              const today = new Date();
              const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
              setStartDate(lastYear.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Último año
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-500">Generando informe...</span>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FilterX size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay datos para mostrar</h3>
          <p className="text-gray-500">
            No se encontraron socios registrados en el sistema
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total de Socios</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{totalMembers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <ArrowUp size={16} className="text-green-500 mr-1" />
                <span className="text-sm text-green-600 font-medium">
                  {newMembersCount}
                </span>
                <span className="text-sm text-gray-500 ml-1">nuevos en el período</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Socios Activos</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{activeMembers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <UserPlus className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  {Math.round((activeMembers / totalMembers) * 100)}% del total
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Socios Inactivos</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{totalMembers - activeMembers}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <Users className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  {Math.round(((totalMembers - activeMembers) / totalMembers) * 100)}% del total
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Deuda Total</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">
                    ${totalDebt.toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-gray-500">
                  {members.filter(m => (m.totalDebt || 0) > 0).length} socios con deuda
                </span>
              </div>
            </div>
          </div>
          
          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Socios por Estado</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} socios`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Socios por Deuda</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={debtData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {debtData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} socios`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Nuevos Socios por Mes</h3>
              <div className="overflow-x-auto h-64">
                <div className="h-full" style={{ minWidth: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={membersByMonth}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 45,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ 
                            // @ts-ignore // Ignoramos el error de tipo aquí
                            angle: -45, 
                            textAnchor: "end" 
                        }} 
                        height={50} 
                        />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Nuevos socios" fill="#4F46E5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          
          {/* Tabla de socios nuevos */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Últimos Socios Registrados</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Registro</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {newMembers.slice(0, 10).map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{member.firstName} {member.lastName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.createdAt && (member.createdAt.toDate 
                          ? member.createdAt.toDate().toLocaleDateString('es-AR')
                          : new Date(member.createdAt).toLocaleDateString('es-AR'))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {member.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`${(member.totalDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${(member.totalDebt || 0).toLocaleString('es-AR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {newMembers.length > 10 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Mostrando 10 de {newMembers.length} socios nuevos. Exporta a CSV para ver todos los datos.
                </div>
              )}
              
              {newMembers.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-md">
                  <p className="text-gray-500">No hay socios nuevos en el período seleccionado</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MembersReports;