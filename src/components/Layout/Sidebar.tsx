// src/components/Layout/Sidebar.tsx - ACTUALIZADA
import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, ClipboardList, Settings, ChevronDown, ShoppingBag, 
  Menu, X, Building2, CreditCard, DollarSign, UserCog, FileText, Dumbbell,
  Activity, LogOut, Calendar, Receipt, Cog, FolderCog, User, TrendingUp,
  Wallet, ArrowUpRight, CheckCircle
} from 'lucide-react';
import { logoutUser } from '../../services/auth.service';
import { navigateTo } from '../../services/navigation.service';
import useAuth from '../../hooks/useAuth';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  userRole: 'superadmin' | 'admin' | 'user';
}

interface NavItemProps {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  onClick: () => void;
  badge?: string | number;
  isNew?: boolean; // Para marcar opciones nuevas
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
      <div
        className={`pl-10 mt-1 overflow-hidden transition-all ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, userRole }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { gymData } = useAuth();
  // The logo URL is coming from Firebase but might have a different property name 
  // in the GymData type. Access it safely to avoid TypeScript errors
  const logoUrl = gymData ? (gymData.logo || (gymData as any).logoUrl || '') : '';

  const isActive = (page: string): boolean => {
    return activePage === page;
  };

  const isSettingsActive = (): boolean => {
    return ['business', 'memberships', 'activities', 'users'].includes(activePage);
  };

  const isExercisesActive = (): boolean => {
    return ['exercises', 'routines', 'member-routines'].includes(activePage);
  };

  // NUEVA FUNCIÓN: Verificar si está en sección financiera (SIN dashboard-financial)
  const isFinancialActive = (): boolean => {
    return ['payments', 'cashier'].includes(activePage); // 🔧 SIN dashboard-financial
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigateTo('/');
      window.location.reload(); // Forzar recarga para reiniciar el estado
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-white shadow-md text-gray-600 hover:text-gray-800"
        >
          <Menu size={24} />
        </button>
      </div>

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex justify-between items-center md:hidden px-4 pt-4">
          <h2 className="text-xl font-bold">GymSystem</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-800"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="px-4 py-6 flex-shrink-0">
          <div className="mb-8 flex flex-col items-center">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={gymData?.name || "Gym Logo"} 
                className="h-22 w-22 object-contain rounded-md " 
              />
            ) : (
              <>
                <div className="h-16 w-16 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                  <Building2 size={32} className="text-blue-600" />
                </div>
                <h1 className="text-xl font-bold text-center mt-2">
                  {gymData?.name || "GymSystem"}
                </h1>
              </>
            )}
          </div>
        </div>
        
        {/* Área scrollable para el menú de navegación */}
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
                    active={activePage === 'superadmin-dashboard'}
                    onClick={() => onNavigate('superadmin-dashboard')}
                  />
                  
                  <NavItem
                    icon={<Building2 size={20} />}
                    text="Gimnasios"
                    active={activePage === 'superadmin-gyms'}
                    onClick={() => onNavigate('superadmin-gyms')}
                  />
                  
                  <NavItem
                    icon={<CreditCard size={20} />}
                    text="Suscripciones"
                    active={activePage === 'superadmin-subscriptions'}
                    onClick={() => onNavigate('superadmin-subscriptions')}
                  />
                  
                  <NavItem
                    icon={<DollarSign size={20} />}
                    text="Ingresos"
                    active={activePage === 'superadmin-revenue'}
                    onClick={() => onNavigate('superadmin-revenue')}
                  />
                  <NavItem
                    icon={<Dumbbell size={20} />}
                    text="Ejercicios Globales"
                    active={activePage === 'superadmin-exercises'}
                    onClick={() => onNavigate('superadmin-exercises')}
                  />
                </div>
                
                <div className="border-t border-gray-200 my-2"></div>
              </>
            )}
            
            {/* Admin y User Navigation */}
            {(userRole === 'admin' || userRole === 'user') && (
              <>
                {/* Dashboard Original */}
                <NavItem
                  icon={<LayoutDashboard size={20} />}
                  text="Dashboard"
                  active={isActive('dashboard')}
                  onClick={() => onNavigate('dashboard')}
                />
                
                {/* Socios */}
                <NavItem
                  icon={<Users size={20} />}
                  text="Socios"
                  active={isActive('members')}
                  onClick={() => onNavigate('members')}
                />
                
                {/* Asistencias */}
                <NavItem
                  icon={<Calendar size={20} />}
                  text="Asistencias"
                  active={isActive('attendance')}
                  onClick={() => onNavigate('attendance')}
                />
                
                {/* 🔧 REPORTES FUERA DE FINANZAS */}
                <NavItem
                  icon={<Receipt size={20} />}
                  text="Reportes"
                  active={isActive('reports')}
                  onClick={() => onNavigate('reports')}
                />
                
                {/* NUEVA SECCIÓN: Finanzas - Solo para admins */}
                {userRole === 'admin' && (
                  <DropdownNav
                    icon={<Wallet size={20} />}
                    text="Finanzas"
                    active={isFinancialActive()}
                    isNew={true}
                  >
                    <div className="space-y-1 py-2">
                      <NavItem
                        icon={<TrendingUp size={16} />}
                        text="Dashboard Financiero"
                        active={isActive('dashboard-financial')}
                        onClick={() => onNavigate('dashboard-financial')}
                        isNew={true}
                      />
                      <NavItem
                        icon={<CheckCircle size={16} />}
                        text="Gestión de Pagos"
                        active={isActive('payments')}
                        onClick={() => onNavigate('payments')}
                        isNew={true}
                      />
                      <NavItem
                        icon={<ShoppingBag size={16} />}
                        text="Caja Diaria"
                        active={isActive('cashier')}
                        onClick={() => onNavigate('cashier')}
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
                      onClick={() => onNavigate('exercises')}
                    />
                    <NavItem
                      icon={<ClipboardList size={16} />}
                      text="Rutinas"
                      active={isActive('routines')}
                      onClick={() => onNavigate('routines')}
                    />
                    <NavItem
                      icon={<Users size={16} />}
                      text="Rutinas de Socios"
                      active={isActive('member-routines')}
                      onClick={() => onNavigate('member-routines')}
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
                        active={isActive('business')}
                        onClick={() => onNavigate('business')}
                      />
                      <NavItem
                        icon={<CreditCard size={16} />}
                        text="Membresías"
                        active={isActive('memberships')}
                        onClick={() => onNavigate('memberships')}
                      />
                      <NavItem
                        icon={<Activity size={16} />}
                        text="Actividades"
                        active={isActive('activities')}
                        onClick={() => onNavigate('activities')}
                      />
                      <NavItem
                        icon={<User size={16} />}
                        text="Usuarios"
                        active={isActive('users')}
                        onClick={() => onNavigate('users')}
                      />
                    </div>
                  </DropdownNav>
                )}
              </>
            )}
          </nav>
        </div>
        
        {/* NUEVA SECCIÓN: Info del sistema financiero */}
        {userRole === 'admin' && (
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center">
                <CheckCircle size={16} className="text-green-600 mr-2" />
                <span className="text-xs font-medium text-green-800">Sistema Financiero Mejorado</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                Gestión integral de pagos y caja diaria
              </p>
            </div>
          </div>
        )}
        
        {/* Botón de Cerrar Sesión (siempre visible al final) */}
        <div className="border-t border-gray-200 px-4 py-4 mt-auto">
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