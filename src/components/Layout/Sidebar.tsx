// src/components/Layout/Sidebar.tsx - VERSIÓN FINAL SIN PROPS REQUERIDAS
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, ClipboardList, Settings, ChevronDown, ShoppingBag, 
  Menu, X, Building2, CreditCard, DollarSign, UserCog, FileText, Dumbbell,
  Activity, LogOut, Calendar, Receipt, Cog, FolderCog, User, TrendingUp,
  Wallet, ArrowUpRight, CheckCircle, RefreshCw
} from 'lucide-react';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface NavItemProps {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  onClick: () => void;
  badge?: string | number;
  isNew?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, text, active, onClick, badge, isNew }) => (
  <button
    className={`flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors relative ${
      active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center">
      <div className="mr-3">{icon}</div>
      <span className={`text-sm font-medium ${active ? 'font-semibold' : ''}`}>{text}</span>
      {isNew && (
        <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-green-500 text-white rounded-full">
          NEW
        </span>
      )}
    </div>
    {badge && (
      <span className="px-2 py-0.5 ml-auto text-xs font-medium rounded-full bg-blue-100 text-blue-600">
        {badge}
      </span>
    )}
  </button>
);

interface DropdownNavProps {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  children: React.ReactNode;
  isNew?: boolean;
}

const DropdownNav: React.FC<DropdownNavProps> = ({ icon, text, active, children, isNew }) => {
  const [isOpen, setIsOpen] = useState(active);

  React.useEffect(() => {
    if (active) setIsOpen(true);
  }, [active]);

  return (
    <div>
      <button
        className={`flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors relative ${
          active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <div className="mr-3">{icon}</div>
          <span className={`text-sm font-medium ${active ? 'font-semibold' : ''}`}>{text}</span>
          {isNew && (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-green-500 text-white rounded-full">
              NEW
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="ml-6 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, gymData, userRole } = useAuth();

  // Función para determinar si una ruta está activa
  const isActive = (path: string): boolean => {
    return location.pathname === `/${path}` || location.pathname.startsWith(`/${path}/`);
  };

  // Función para navegar
  const handleNavigate = (path: string) => {
    navigate(`/${path}`);
    setIsOpen(false); // Cerrar sidebar en móvil
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Funciones auxiliares para determinar estados activos de grupos
  const isMembershipManagementActive = (): boolean => {
    return isActive('settings/memberships') || isActive('auto-renewals');
  };

  const isFinancialActive = (): boolean => {
    return isActive('dashboard-financial') || isActive('cashier');
  };

  const isExercisesActive = (): boolean => {
    return isActive('exercises') || isActive('routines') || isActive('member-routines');
  };

  const isSettingsActive = (): boolean => {
    return isActive('settings/business') || isActive('settings/activities') || isActive('settings/users');
  };

  const isSuperadminActive = (page: string): boolean => {
    return location.pathname.includes(`/superadmin/${page}`);
  };

  return (
    <>
      {/* Botón de menú móvil */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border"
      >
        <Menu size={24} />
      </button>

      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        
        {/* Header móvil */}
        <div className="flex justify-between items-center md:hidden px-4 pt-4">
          <h2 className="text-xl font-bold">GymSystem</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-800"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Logo/Título */}
        <div className="px-4 py-6 flex-shrink-0">
          <div className="mb-8 flex flex-col items-center">
            {gymData?.logo ? (
              <img 
                src={gymData.logo} 
                alt={gymData?.name || "Gym Logo"} 
                className="h-22 w-22 object-contain rounded-md" 
              />
            ) : (
              <>
                <div className="h-16 w-16 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                  <Building2 size={32} className="text-blue-600" />
                </div>
                <h1 className="text-xl font-bold text-center mt-2">
                  {userRole === 'superadmin' ? 'MultiGym Admin' : (gymData?.name || "GymSystem")}
                </h1>
              </>
            )}
          </div>
        </div>
        
        {/* Navegación */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <nav className="space-y-1">
            {/* Panel de Superadmin */}
            {userRole === 'superadmin' && (
              <>
                <div className="py-2">
                  <h3 className="text-xs uppercase font-semibold text-gray-500 tracking-wider px-3 mb-2">
                    Panel de Administración
                  </h3>
                  
                  <NavItem
                    icon={<LayoutDashboard size={20} />}
                    text="Dashboard"
                    active={isSuperadminActive('dashboard')}
                    onClick={() => handleNavigate('superadmin/dashboard')}
                  />
                  
                  <NavItem
                    icon={<Building2 size={20} />}
                    text="Gimnasios"
                    active={isSuperadminActive('gyms')}
                    onClick={() => handleNavigate('superadmin/gyms')}
                  />
                  
                  <NavItem
                    icon={<CreditCard size={20} />}
                    text="Suscripciones"
                    active={isSuperadminActive('subscriptions')}
                    onClick={() => handleNavigate('superadmin/subscriptions')}
                  />
                  
                  <NavItem
                    icon={<DollarSign size={20} />}
                    text="Ingresos"
                    active={isSuperadminActive('revenue')}
                    onClick={() => handleNavigate('superadmin/revenue')}
                  />
                  
                  <NavItem
                    icon={<Dumbbell size={20} />}
                    text="Ejercicios Globales"
                    active={isSuperadminActive('exercises')}
                    onClick={() => handleNavigate('superadmin/exercises')}
                  />
                </div>
                
                <div className="border-t border-gray-200 my-2"></div>
              </>
            )}
            
            {/* Navegación para Admin y User */}
            {(userRole === 'admin' || userRole === 'user') && (
              <>
                <NavItem
                  icon={<LayoutDashboard size={20} />}
                  text="Dashboard"
                  active={isActive('dashboard')}
                  onClick={() => handleNavigate('dashboard')}
                />
                
                <NavItem
                  icon={<Users size={20} />}
                  text="Socios"
                  active={isActive('members')}
                  onClick={() => handleNavigate('members')}
                />
                
                <NavItem
                  icon={<Calendar size={20} />}
                  text="Asistencias"
                  active={isActive('attendance')}
                  onClick={() => handleNavigate('attendance')}
                />

                   {/* 🆕 AGREGAR ESTA NUEVA SECCIÓN AQUÍ */}
                <NavItem
                  icon={<DollarSign size={20} />}
                  text="Cobros"
                  active={isActive('payments')}
                  onClick={() => handleNavigate('payments')}
                  isNew={true}
                />
                
                <NavItem
                  icon={<Receipt size={20} />}
                  text="Reportes"
                  active={isActive('reports')}
                  onClick={() => handleNavigate('reports')}
                />
                
                {/* Gestión de Membresías - Solo para admins */}
                {userRole === 'admin' && (
                  <DropdownNav
                    icon={<CreditCard size={20} />}
                    text="Membresías"
                    active={isMembershipManagementActive()}
                    isNew={true}
                  >
                    <div className="space-y-1 py-2">
                      <NavItem
                        icon={<Settings size={16} />}
                        text="Configurar Membresías"
                        active={isActive('settings/memberships')}
                        onClick={() => handleNavigate('settings/memberships')}
                      />
                      <NavItem
                        icon={<RefreshCw size={16} />}
                        text="Renovaciones Automáticas"
                        active={isActive('auto-renewals')}
                        onClick={() => handleNavigate('auto-renewals')}
                        isNew={true}
                      />
                    </div>
                  </DropdownNav>
                )}
                
                {/* Finanzas - Solo para admins */}
                {userRole === 'admin' && (
                  <DropdownNav
                    icon={<Wallet size={20} />}
                    text="Finanzas"
                    active={isFinancialActive()}
                  >
                    <div className="space-y-1 py-2">
                      <NavItem
                        icon={<TrendingUp size={16} />}
                        text="Dashboard Financiero"
                        active={isActive('dashboard-financial')}
                        onClick={() => handleNavigate('dashboard-financial')}
                      />
                   
                      <NavItem
                        icon={<ShoppingBag size={16} />}
                        text="Caja Diaria"
                        active={isActive('cashier')}
                        onClick={() => handleNavigate('cashier')}
                      />
                    </div>
                  </DropdownNav>
                )}
                
                {/* Ejercicios y Rutinas */}
                <DropdownNav
                  icon={<Dumbbell size={20} />}
                  text="Ejercicios"
                  active={isExercisesActive()}
                >
                  <div className="space-y-1 py-2">
                    <NavItem
                      icon={<Activity size={16} />}
                      text="Ejercicios"
                      active={isActive('exercises')}
                      onClick={() => handleNavigate('exercises')}
                    />
                    <NavItem
                      icon={<ClipboardList size={16} />}
                      text="Rutinas"
                      active={isActive('routines')}
                      onClick={() => handleNavigate('routines')}
                    />
                    <NavItem
                      icon={<Users size={16} />}
                      text="Rutinas de Socios"
                      active={isActive('member-routines')}
                      onClick={() => handleNavigate('member-routines')}
                    />
                  </div>
                </DropdownNav>
                
                {/* Configuración - Solo para admins */}
                {userRole === 'admin' && (
                  <DropdownNav
                    icon={<Cog size={20} />}
                    text="Configuración"
                    active={isSettingsActive()}
                  >
                    <div className="space-y-1 py-2">
                      <NavItem
                        icon={<Building2 size={16} />}
                        text="Perfil del Negocio"
                        active={isActive('settings/business')}
                        onClick={() => handleNavigate('settings/business')}
                      />
                      <NavItem
                        icon={<Activity size={16} />}
                        text="Actividades"
                        active={isActive('settings/activities')}
                        onClick={() => handleNavigate('settings/activities')}
                      />
                      <NavItem
                        icon={<User size={16} />}
                        text="Usuarios"
                        active={isActive('settings/users')}
                        onClick={() => handleNavigate('settings/users')}
                      />
                    </div>
                  </DropdownNav>
                )}
              </>
            )}
          </nav>
        </div>
        
        {/* Footer con logout */}
        <div className="border-t border-gray-200 px-4 py-4 mt-auto">
          <div className="mb-3 text-xs text-gray-500">
            {userData?.name && (
              <div>Conectado como: <span className="font-medium">{userData.name}</span></div>
            )}
            {userData?.role && (
              <div>Rol: <span className="font-medium capitalize">{userData.role}</span></div>
            )}
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-2 w-full text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;