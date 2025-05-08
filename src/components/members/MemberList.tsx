// src/components/members/MemberList.tsx

import React, { useState, useEffect } from 'react';
import { Search, User, Edit, Trash, Eye, CreditCard, BanknoteIcon, RefreshCw, Filter, UserPlus } from 'lucide-react';
import { Member } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';
import useFirestore from '../../hooks/useFirestore';

interface MemberListProps {
  onNewMember: () => void;
  onViewMember: (member: Member) => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
  onGenerateQr: (member: Member) => void;
  onRegisterPayment: (member: Member) => void;
}

const MemberList: React.FC<MemberListProps> = ({ 
  onNewMember, 
  onViewMember, 
  onEditMember, 
  onDeleteMember, 
  onGenerateQr, 
  onRegisterPayment 
}) => {
  const { gymData } = useAuth();
  const membersFirestore = useFirestore<Member>('members');
  
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debtFilter, setDebtFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Cargar datos de Firebase
  useEffect(() => {
    loadMembers();
  }, [gymData?.id]);
  
  // Cargar miembros desde Firebase
  const loadMembers = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const membersData = await membersFirestore.getAll();
      setMembers(membersData);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };
  
  // Filtrar miembros según los criterios
  const filteredMembers = members.filter(member => {
    // Filtrar por término de búsqueda
    const matchesSearch = 
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.phone && member.phone.includes(searchTerm));
    
    // Filtrar por estado
    const matchesStatus = 
      statusFilter === 'all' || 
      member.status === statusFilter;
    
    // Filtrar por deuda
    const matchesDebt = 
      debtFilter === 'all' || 
      (debtFilter === 'with_debt' && member.totalDebt > 0) || 
      (debtFilter === 'no_debt' && member.totalDebt === 0);
    
    return matchesSearch && matchesStatus && matchesDebt;
  });
  
 // Función robusta para formatear fechas en diferentes formatos
const formatDate = (dateString: string | Date | any | null | undefined): string => {
  if (!dateString) return 'No disponible';
  
  try {
    // Si es un objeto Date directamente
    if (typeof dateString.getMonth === 'function') {
      return dateString.toLocaleDateString('es-AR');
    }
    
    // Si es un objeto Timestamp de Firebase con un método toDate()
    if (dateString.toDate && typeof dateString.toDate === 'function') {
      return dateString.toDate().toLocaleDateString('es-AR');
    }
    
    // Si es un string o cualquier otro formato, intentar convertirlo a Date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-AR');
    }
    
    // Si no es convertible a fecha, devolver el string original
    return String(dateString);
  } catch (error) {
    console.error('Error formatting date:', error);
    // En caso de error, devolver la cadena original o un mensaje por defecto
    return dateString ? String(dateString) : 'No disponible';
  }
};
  
  // Confirmar eliminación
  const confirmDelete = (member: Member) => {
    if (window.confirm(`¿Está seguro que desea eliminar a ${member.firstName} ${member.lastName}?`)) {
      onDeleteMember(member.id);
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Lista de Socios</h1>
        <button 
          onClick={onNewMember}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
        >
          <UserPlus className="mr-2" size={20} />
          Nuevo Socio
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Barra de búsqueda y filtros */}
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar socio por nombre, apellido o email..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            </div>
            
            <select 
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            
            <select 
              className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value)}
            >
              <option value="all">Estado de deuda</option>
              <option value="with_debt">Con deuda</option>
              <option value="no_debt">Sin deuda</option>
            </select>
            
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 border rounded-md hover:bg-gray-50 focus:outline-none"
              title="Actualizar lista"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin text-blue-500' : 'text-gray-500'} />
            </button>
          </div>
        </div>
        
        {/* Tabla de socios */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-500">Cargando socios...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 bg-gray-50">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No hay socios registrados</h3>
            <p className="text-gray-500 mb-4">Comienza agregando un nuevo socio a tu gimnasio</p>
            <button 
              onClick={onNewMember}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Agregar Nuevo Socio
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50">
            <Filter size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No se encontraron resultados</h3>
            <p className="text-gray-500 mb-4">Intenta con otros filtros o términos de búsqueda</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDebtFilter('all');
              }}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar Filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apellido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Asistencia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.photo ? (
                        <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} className="h-10 w-10 rounded-full" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.lastName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.firstName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {member.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(member.lastAttendance)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={member.totalDebt > 0 ? 'text-red-600 font-medium' : ''}>
                        {formatCurrency(member.totalDebt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-800" 
                        title="Ver detalles"
                        onClick={() => onViewMember(member)}
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        className="text-green-600 hover:text-green-800" 
                        title="Editar"
                        onClick={() => onEditMember(member)}
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-800" 
                        title="Eliminar"
                        onClick={() => confirmDelete(member)}
                      >
                        <Trash size={18} />
                      </button>
                      <button 
                        className="text-purple-600 hover:text-purple-800" 
                        title="Generar QR"
                        onClick={() => onGenerateQr(member)}
                      >
                        <CreditCard size={18} />
                      </button>
                      <button 
                        className="text-yellow-600 hover:text-yellow-800" 
                        title="Registrar pago"
                        onClick={() => onRegisterPayment(member)}
                      >
                        <BanknoteIcon size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Paginación (para futura implementación) */}
        {filteredMembers.length > 0 && (
          <div className="px-6 py-3 flex items-center justify-between border-t">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{filteredMembers.length}</span> {filteredMembers.length === 1 ? 'socio' : 'socios'}
              </p>
            </div>
            {/* Implementar paginación aquí cuando sea necesario */}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;