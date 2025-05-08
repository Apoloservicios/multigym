// src/components/Layout/Sidebar.tsx (actualizado con opciones de ejercicios y rutinas)
import React, { useState } from 'react';
import { 
  Home, Users, CreditCard, Calendar, Settings, 
  ChevronDown, ChevronUp, LogOut, Menu, X, BarChart2, Dumbbell
} from 'lucide-react';
import { auth } from '../../config/firebase';


interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  userRole: 'superadmin' | 'admin' | 'user';
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, userRole }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [trainingOpen, setTrainingOpen] = useState<boolean>(false);
  
  // Lista completa de items del menú
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, roles: ['superadmin', 'admin', 'user'] },
    { id: 'members', label: 'Socios', icon: <Users size={20} />, roles: ['superadmin', 'admin', 'user'] },
    { id: 'attendance', label: 'Asistencias', icon: <Calendar size={20} />, roles: ['superadmin', 'admin', 'user'] },
    { id: 'cashier', label: 'Caja Diaria', icon: <CreditCard size={20} />, roles: ['superadmin', 'admin'] },
    { id: 'reports', label: 'Informes', icon: <BarChart2 size={20} />, roles: ['superadmin', 'admin'] },
    { id: 'training', label: 'Entrenamiento', icon: <Dumbbell size={20} />, roles: ['superadmin', 'admin', 'user'] }
  ];
  
  // Lista de items del submenú de entrenamiento
  const allTrainingItems = [
    { id: 'exercises', label: 'Ejercicios', roles: ['superadmin', 'admin', 'user'] },
    { id: 'routines', label: 'Rutinas', roles: ['superadmin', 'admin', 'user'] },
    { id: 'member-routines', label: 'Rutinas asignadas', roles: ['superadmin', 'admin', 'user'] }
  ];
  
  // Lista completa de items de configuración
  const allSettingsItems = [
    { id: 'business', label: 'Perfil de Negocio', roles: ['superadmin', 'admin'] },
    { id: 'memberships', label: 'Membresías', roles: ['superadmin', 'admin'] },
    { id: 'activities', label: 'Actividades', roles: ['superadmin', 'admin'] },
    { id: 'users', label: 'Usuarios', roles: ['superadmin', 'admin'] }
  ];
  
  // Filtrar menú según el rol del usuario
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));
  const trainingItems = allTrainingItems.filter(item => item.roles.includes(userRole));
  const settingsItems = allSettingsItems.filter(item => item.roles.includes(userRole));
  
  const handleClick = (pageId: string) => {
    onNavigate(pageId);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await auth.signOut();
      // La redirección ocurrirá automáticamente gracias al listener en App.tsx
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  
  // Obtener el nombre del rol para mostrar
  const getRoleName = () => {
    switch (userRole) {
      case 'superadmin': return 'Administrador';
      case 'admin': return 'Dueño';
      case 'user': return 'Empleado';
      default: return '';
    }
  };
  
  return (
    <>
      {/* Botón de hamburguesa móvil */}
      <div className="block md:hidden fixed z-20 top-4 left-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-blue-600 text-white"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      {/* Fondo oscuro para móvil */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white shadow-lg z-20 transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        w-64
      `}>
        <div className="flex flex-col h-full">
          {/* Logo y nombre del gimnasio */}
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold text-blue-700">Mi Gimnasio</h2>
            <p className="text-sm text-gray-500 mt-1">
              Rol: {getRoleName()}
            </p>
          </div>
          
          {/* Navegación principal */}
          <nav className="flex-1 overflow-y-auto">
            <ul className="py-4">
              {menuItems.map(item => (
                item.id === 'training' ? (
                  <li key={item.id}>
                    <button
                      onClick={() => setTrainingOpen(!trainingOpen)}
                      className={`w-full flex items-center justify-between py-3 px-4 hover:bg-gray-100 ${
                        trainingItems.some(subItem => activePage === subItem.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="mr-3">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <span>
                        {trainingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>
                    
                    {trainingOpen && (
                      <ul className="bg-gray-50 py-2">
                        {trainingItems.map(subItem => (
                          <li key={subItem.id}>
                            <button
                              onClick={() => handleClick(subItem.id)}
                              className={`w-full flex items-center py-2 px-12 hover:bg-gray-100 ${
                                activePage === subItem.id ? 'text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              {subItem.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ) : (
                  <li key={item.id}>
                    <button
                      onClick={() => handleClick(item.id)}
                      className={`w-full flex items-center py-3 px-4 hover:bg-gray-100 ${
                        activePage === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              ))}
              
              {/* Configuración con submenú - solo mostrar si hay elementos */}
              {settingsItems.length > 0 && (
                <li>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`w-full flex items-center justify-between py-3 px-4 hover:bg-gray-100 ${
                      settingsItems.some(item => activePage === item.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="mr-3"><Settings size={20} /></span>
                      <span>Configuración</span>
                    </div>
                    <span>
                      {settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                  
                  {settingsOpen && (
                    <ul className="bg-gray-50 py-2">
                      {settingsItems.map(item => (
                        <li key={item.id}>
                          <button
                            onClick={() => handleClick(item.id)}
                            className={`w-full flex items-center py-2 px-12 hover:bg-gray-100 ${
                              activePage === item.id ? 'text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          </nav>
          
          {/* Footer con cerrar sesión */}
          <div className="border-t p-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center py-2 px-4 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <LogOut size={20} className="mr-3" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;