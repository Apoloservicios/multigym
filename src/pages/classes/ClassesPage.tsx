// src/pages/ClassesPage.tsx
import React, { useState, useEffect } from 'react';
import { CreateClassModal } from '../../components/classes/CreateClassModal';
import { ClassEnrollmentsModal } from '../../components/classes/ClassEnrollmentsModal';
import { useAuth } from '../../contexts/AuthContext';

import { ClassSchedule } from '../../types/class.types';

import { 
  getScheduledClasses, 
  openClassEnrollment, 
  closeClassEnrollment,
  autoOpenClasses ,
    deleteClass,    // ⭐ AGREGAR
  cancelClass 
} from '../../services/classService';

export const ClassesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const gymId = currentUser?.uid;
  
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSchedule | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'all'>('week');
  
  useEffect(() => {
    loadClasses();
  }, [viewMode]);
  
  const loadClasses = async () => {
    if (!gymId) return;
    
    setLoading(true);
    try {
      const today = new Date();
      let startDate: Date;
      let endDate: Date;
      
      if (viewMode === 'week') {
        // Esta semana
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay()); // Domingo
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Próximas 4 semanas
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(today);
        endDate.setDate(today.getDate() + 28);
        endDate.setHours(23, 59, 59, 999);
      }
      
      const scheduledClasses = await getScheduledClasses(gymId, startDate, endDate);
      setClasses(scheduledClasses);
      
    } catch (error) {
      console.error('Error cargando clases:', error);
    } finally {
      setLoading(false);
    }
  };
  
const formatDate = (timestamp: any) => {
  // ⭐ Obtener fecha en hora local sin conversión UTC
  const date = timestamp.toDate();
  
  // Extraer componentes en hora local
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Crear nueva fecha en hora local
  const localDate = new Date(year, month, day);
  
  console.log('📅 Format date:', {
    original: date.toISOString(),
    local: localDate.toLocaleDateString('es-AR'),
    day: localDate.getDate(),
    weekday: localDate.toLocaleDateString('es-AR', { weekday: 'long' })
  });
  
  return localDate.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
};

const formatTime = (timestamp: any) => {
  const date = timestamp.toDate();
  
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false  // ⭐ Forzar formato 24h
  });
};

  const handleToggleEnrollment = async (classItem: ClassSchedule) => {
    if (!gymId || !classItem.id) return;
    
    try {
      if (classItem.isOpenForEnrollment) {
        await closeClassEnrollment(gymId, classItem.id);
        alert('Inscripciones cerradas');
      } else {
        await openClassEnrollment(gymId, classItem.id);
        alert('Inscripciones abiertas');
      }
      loadClasses();
    } catch (error) {
      alert('Error al cambiar estado de inscripciones');
    }
  };

const handleAutoOpen = async () => {
  if (!gymId) return;
  
  try {
    const count = await autoOpenClasses(gymId);
    alert(`${count} clases abiertas automáticamente`);
    loadClasses();
  } catch (error) {
    alert('Error en apertura automática');
  }
};

const handleDeleteClass = async (classItem: ClassSchedule) => {
  if (!gymId || !classItem.id) return;
  
  // Verificar si tiene inscritos
  const hasEnrollments = classItem.enrolled > 0 || classItem.waitlist > 0;
  
  const confirmMessage = hasEnrollments
    ? `⚠️ ATENCIÓN: Esta clase tiene ${classItem.enrolled} inscrito(s) y ${classItem.waitlist} en lista de espera.\n\n¿Estás seguro de eliminarla? Esta acción no se puede deshacer.`
    : '¿Estás seguro de eliminar esta clase? Esta acción no se puede deshacer.';
  
  if (!window.confirm(confirmMessage)) return;
  
  try {
    await deleteClass(gymId, classItem.id);
    alert('✅ Clase eliminada correctamente');
    loadClasses();
  } catch (error) {
    console.error('Error eliminando clase:', error);
    alert('❌ Error al eliminar la clase');
  }
};

const handleCancelClass = async (classItem: ClassSchedule) => {
  if (!gymId || !classItem.id) return;
  
  const reason = window.prompt(
    `Cancelar clase: ${classItem.activityName}\nFecha: ${new Date(classItem.date).toLocaleDateString('es-AR')}\n\nMotivo de cancelación (opcional):`
  );
  
  // Si presiona Cancelar, no hacer nada
  if (reason === null) return;
  
  try {
    await cancelClass(gymId, classItem.id, reason);
    alert('✅ Clase cancelada. Los inscritos serán notificados.');
    loadClasses();
  } catch (error) {
    console.error('Error cancelando clase:', error);
    alert('❌ Error al cancelar la clase');
  }
};

  
  const getStatusColor = (schedule: ClassSchedule) => {
    switch (schedule.status) {
      case 'scheduled':
        return schedule.available > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
      case 'full':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusText = (schedule: ClassSchedule) => {
    switch (schedule.status) {
      case 'scheduled':
        return schedule.available > 0 ? 'Abierta' : 'Por llenar';
      case 'full':
        return 'Completa';
      case 'cancelled':
        return 'Cancelada';
      case 'completed':
        return 'Finalizada';
      default:
        return schedule.status;
    }
  };
  
  // Agrupar clases por fecha
// Agrupar clases por fecha
const classesByDate = classes.reduce((acc, classItem) => {
  // ⭐ Usar el campo date (string "YYYY-MM-DD") como clave
  const dateKey = classItem.date;
  
  if (!acc[dateKey]) {
    acc[dateKey] = [];
  }
  acc[dateKey].push(classItem);
  return acc;
}, {} as Record<string, ClassSchedule[]>);

console.log('📊 Clases agrupadas por fecha:', classesByDate);
  
  const sortedDates = Object.keys(classesByDate).sort();
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Clases</h1>
            <p className="text-gray-600">Administra las clases programadas</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Clase
          </button>
          <button
            onClick={handleAutoOpen}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Abrir Automáticamente
          </button>
        </div>
        
        {/* Tabs de vista */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Próximas 4 Semanas
          </button>
        </div>
      </div>
      
      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Total Clases</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{classes.length}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Clases Abiertas</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {classes.filter(c => c.status === 'scheduled' && c.available > 0).length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Clases Completas</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {classes.filter(c => c.status === 'full').length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Total Inscritos</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {classes.reduce((sum, c) => sum + c.enrolled, 0)}
          </div>
        </div>
      </div>
      
      {/* Lista de clases */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay clases programadas</h3>
          <p className="text-gray-600 mb-4">Crea tu primera clase para comenzar</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Crear Clase
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              {/* Encabezado de fecha */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  {(() => {
                    // ⭐ Parsear fecha correctamente desde string "YYYY-MM-DD"
                    const [year, month, day] = date.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);
                    
                    return localDate.toLocaleDateString('es-AR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                  })()}
                </h3>
              </div>
              
              {/* Clases del día */}
              <div className="divide-y divide-gray-200">
                {classesByDate[date].map(classItem => (
                  <div
                    key={classItem.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {classItem.activityName}
                          </h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(classItem)}`}>
                            {getStatusText(classItem)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(classItem.startDateTime)} - {formatTime(classItem.endDateTime)}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Prof. {classItem.instructor}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {classItem.enrolled}/{classItem.capacity} inscritos
                            {classItem.waitlist > 0 && (
                              <span className="text-yellow-600 ml-1">
                                (+{classItem.waitlist} en espera)
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Barra de progreso */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Ocupación</span>
                            <span>{Math.round((classItem.enrolled / classItem.capacity) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                classItem.enrolled >= classItem.capacity
                                  ? 'bg-red-600'
                                  : classItem.enrolled >= classItem.capacity * 0.8
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min((classItem.enrolled / classItem.capacity) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      
                     {/* Acciones */}
                      <div className="ml-4 flex gap-2">
                        {/* Ver Inscritos */}
                        <button
                          onClick={() => setSelectedClass(classItem)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Ver Inscritos
                        </button>
                        
                        {/* Toggle Abrir/Cerrar */}
                        {classItem.status === 'scheduled' && (
                          <button
                            onClick={() => handleToggleEnrollment(classItem)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                              classItem.isOpenForEnrollment
                                ? 'bg-red-50 hover:bg-red-100 text-red-700'
                                : 'bg-green-50 hover:bg-green-100 text-green-700'
                            }`}
                          >
                            {classItem.isOpenForEnrollment ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Cerrar
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                                Abrir
                              </>
                            )}
                          </button>
                        )}
                        
                        {/* Cancelar Clase */}
                        {classItem.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelClass(classItem)}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            title="Cancelar clase (mantiene el registro)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Cancelar
                          </button>
                        )}
                        
                        {/* Eliminar Clase */}
                        <button
                          onClick={() => handleDeleteClass(classItem)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          title="Eliminar clase permanentemente"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal Crear Clase */}
      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadClasses}
      />
      
      {/* Modal Ver Inscritos */}
      {selectedClass && (
        <ClassEnrollmentsModal
          isOpen={true}
          onClose={() => setSelectedClass(null)}
          classSchedule={selectedClass}
        />
      )}
    </div>
  );
};