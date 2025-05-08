// src/components/settings/UserManagement.tsx

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash, Search, Mail, User, Phone, Shield, Check, X, AlertCircle, 
  ToggleLeft, ToggleRight, Key, RefreshCw
} from 'lucide-react';
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteGymUser, 
  toggleUserActive, 
  sendPasswordReset, 
  User as UserType
} from '../../services/user.service';
import useAuth from '../../hooks/useAuth';

interface UserFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  phone?: string;
  role?: string;
  form?: string;
}

const UserManagement: React.FC = () => {
  const { gymData, currentUser } = useAuth();
  
  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState<boolean>(false);
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'user',
    isActive: true
  });
  
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, [gymData?.id]);
  
  // Aplicar filtros cuando cambian
  useEffect(() => {
    if (!users.length) {
      setFilteredUsers([]);
      return;
    }
    
    let result = users;
    
    // Filtrar por término de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(user => 
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        (user.phone && user.phone.includes(search))
      );
    }
    
    // Filtrar por rol
    if (roleFilter !== 'all') {
      result = result.filter(user => user.role === roleFilter);
    }
    
    // Filtrar por estado
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      result = result.filter(user => user.isActive === isActive);
    }
    
    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter, statusFilter]);
  
  const fetchUsers = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const usersData = await getUsers(gymData.id);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error al cargar usuarios. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Limpiar mensajes
    setError('');
    setSuccess('');
  };
  
  const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };
  
  const validateForm = (): boolean => {
    // Validación para crear un nuevo usuario
    if (!isEditing) {
      if (!formData.email) {
        setError('El correo electrónico es obligatorio.');
        return false;
      }
      
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        setError('El correo electrónico no es válido.');
        return false;
      }
      
      if (!formData.password) {
        setError('La contraseña es obligatoria.');
        return false;
      }
      
      if (formData.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return false;
      }
    }
    
    if (!formData.name) {
      setError('El nombre es obligatorio.');
      return false;
    }
    
    return true;
  };
  
  const handleNewUser = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: '',
      role: 'user',
      isActive: true
    });
    setIsEditing(false);
    setSelectedUser(null);
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };
  
  const handleEditUser = (user: UserType) => {
    setFormData({
      email: user.email,
      password: '',
      confirmPassword: '',
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive
    });
    setSelectedUser(user);
    setIsEditing(true);
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };
  
  const handleDeleteClick = (user: UserType) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };
  
  const handleResetPasswordClick = (user: UserType) => {
    setSelectedUser(user);
    setIsResetPasswordModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio.');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (isEditing && selectedUser) {
        // Actualizar usuario existente
        await updateUser(gymData.id, selectedUser.id, {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          isActive: formData.isActive
        });
        
        // Actualizar en la lista local
        setUsers(prev => 
          prev.map(u => u.id === selectedUser.id ? {
            ...u,
            name: formData.name,
            phone: formData.phone,
            role: formData.role,
            isActive: formData.isActive
          } : u)
        );
        
        setSuccess('Usuario actualizado correctamente.');
      } else {
        // Crear nuevo usuario
        const newUser = await createUser(gymData.id, {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          phone: formData.phone
        });
        
        // Añadir a la lista local
        setUsers(prev => [...prev, newUser]);
        
        setSuccess('Usuario creado correctamente. Se ha enviado un correo de verificación.');
      }
      
      // Cerrar modal después de un breve retraso
      setTimeout(() => {
        if (isEditing) {
          setIsModalOpen(false);
        } else {
          // Para nuevo usuario, limpiar formulario pero mantener modal abierto
          setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            name: '',
            phone: '',
            role: 'user',
            isActive: true
          });
        }
      }, 1500);
    } catch (err: any) {
      console.error('Error saving user:', err);
      
      // Manejar errores específicos de Firebase
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está registrado.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del correo electrónico es inválido.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil.');
      } else {
        setError(err.message || 'Error al guardar usuario.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const confirmDelete = async () => {
    if (!gymData?.id || !selectedUser) {
      return;
    }
    
    setLoading(true);
    
    try {
      // No permitir eliminar al usuario actual
      if (currentUser?.uid === selectedUser.id) {
        throw new Error('No puedes eliminar tu propia cuenta.');
      }
      
      await deleteGymUser(gymData.id, selectedUser.id);
      
      // Eliminar de la lista local
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Error al eliminar usuario.');
    } finally {
      setLoading(false);
    }
  };
  
  const confirmResetPassword = async () => {
    if (!selectedUser) {
      return;
    }
    
    setLoading(true);
    
    try {
      await sendPasswordReset(selectedUser.email);
      setSuccess('Se ha enviado un correo para restablecer la contraseña.');
      setIsResetPasswordModalOpen(false);
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Error al enviar correo de restablecimiento.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleUserActive = async (user: UserType) => {
    if (!gymData?.id) return;
    
    try {
      const newActiveState = !user.isActive;
      
      // No permitir desactivar al usuario actual
      if (currentUser?.uid === user.id && !newActiveState) {
        setError('No puedes desactivar tu propia cuenta.');
        return;
      }
      
      await toggleUserActive(gymData.id, user.id, newActiveState);
      
      // Actualizar en la lista local
      setUsers(prev => 
        prev.map(u => u.id === user.id ? { ...u, isActive: newActiveState } : u)
      );
    } catch (error) {
      console.error('Error toggling user active status:', error);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
          <p className="text-gray-600 mt-1">Administra los usuarios que tienen acceso al sistema</p>
        </div>
        
        <button 
          onClick={handleNewUser}
          className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Nuevo Usuario
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
          <Check size={18} className="mr-2" />
          {success}
        </div>
      )}
      
      {/* Filtros */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono"
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuarios</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>
      
      {/* Lista de usuarios */}
      {loading && users.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-500">Cargando usuarios...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          {users.length === 0 ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <User size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No hay usuarios registrados</h3>
              <p className="text-gray-500 mb-4">Agrega usuarios para que puedan acceder al sistema</p>
              <button 
                onClick={handleNewUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Agregar Usuario
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No se encontraron resultados</h3>
              <p className="text-gray-500 mb-4">Prueba con diferentes filtros o términos de búsqueda</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo Electrónico</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    {currentUser?.uid === user.id && (
                      <span className="text-xs text-blue-600">(Tú)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => handleToggleUserActive(user)}
                      disabled={currentUser?.uid === user.id && user.isActive}
                      className="flex items-center text-sm focus:outline-none"
                      title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                    >
                      {user.isActive ? (
                        <>
                          <ToggleRight className="text-green-500 mr-1" size={20} />
                          <span className="text-green-600">Activo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-gray-400 mr-1" size={20} />
                          <span className="text-gray-500">Inactivo</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar usuario"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleResetPasswordClick(user)}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="Restablecer contraseña"
                      >
                        <Key size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="text-red-600 hover:text-red-800 p-1"
                        disabled={currentUser?.uid === user.id}
                        title={currentUser?.uid === user.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                      >
                        <Trash size={18} className={currentUser?.uid === user.id ? 'opacity-50 cursor-not-allowed' : ''} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal para crear/editar usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
                <AlertCircle size={18} className="mr-2" />
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
                <Check size={18} className="mr-2" />
                {success}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Email - solo editable en creación */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ejemplo@correo.com"
                      required
                      disabled={isEditing}
                    />
                  </div>
                  {isEditing && (
                    <p className="mt-1 text-sm text-gray-500">El correo electrónico no se puede cambiar.</p>
                  )}
                </div>
                
                {/* Contraseña - solo en creación */}
                {!isEditing && (
                  <>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña *
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar Contraseña *
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Repite la contraseña"
                        required
                      />
                    </div>
                  </>
                )}
                
                {/* Nombre */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre y apellido"
                      required
                    />
                  </div>
                </div>
                
                {/* Teléfono */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número de contacto"
                    />
                  </div>
                </div>
                
                {/* Rol */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Rol *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield size={18} className="text-gray-400" />
                    </div>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isEditing && currentUser?.uid === selectedUser?.id}
                    >
                      <option value="admin">Administrador</option>
                      <option value="user">Usuario</option>
                    </select>
                  </div>
                  {isEditing && currentUser?.uid === selectedUser?.id && (
                    <p className="mt-1 text-sm text-gray-500">No puedes cambiar tu propio rol.</p>
                  )}
                </div>
                
                {/* Estado (activo/inactivo) */}
                {isEditing && (
                  <div>
                    <div className="flex items-center">
                      <button 
                        type="button"
                        onClick={handleToggleActive}
                        className="flex items-center focus:outline-none"
                        disabled={currentUser?.uid === selectedUser?.id}
                      >
                        {formData.isActive ? (
                          <>
                            <ToggleRight className="text-green-500 mr-2" size={24} />
                            <span className="font-medium">Usuario Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="text-gray-400 mr-2" size={24} />
                            <span className="font-medium">Usuario Inactivo</span>
                          </>
                        )}
                      </button>
                    </div>
                    {currentUser?.uid === selectedUser?.id && (
                      <p className="mt-1 text-sm text-gray-500">No puedes desactivar tu propia cuenta.</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                >
                  <X size={18} className="mr-2" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  ) : (
                    <Check size={18} className="mr-2" />
                  )}
                  {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de confirmación de eliminación */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Eliminar Usuario</h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro que deseas eliminar al usuario <strong>{selectedUser.name}</strong>? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  ) : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de restablecimiento de contraseña */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <Key size={24} className="text-yellow-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Restablecer Contraseña</h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro que deseas enviar un correo de restablecimiento de contraseña a <strong>{selectedUser.email}</strong>?
              </p>
              
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmResetPassword}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors flex items-center"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  ) : (
                    <RefreshCw size={18} className="mr-2" />
                  )}
                  {loading ? 'Enviando...' : 'Enviar Correo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;