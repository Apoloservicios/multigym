// src/components/classes/ClassEnrollmentsModal.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassEnrollments, markAttendance } from '../../services/classService';
import { ClassSchedule } from '../../types/class.types';

interface ClassEnrollmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classSchedule: ClassSchedule;
}

export const ClassEnrollmentsModal: React.FC<ClassEnrollmentsModalProps> = ({
  isOpen,
  onClose,
  classSchedule
}) => {
  const { currentUser } = useAuth();
  const gymId = currentUser?.uid;
  
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen && gymId) {
      loadEnrollments();
    }
  }, [isOpen, gymId]);
  
  const loadEnrollments = async () => {
    if (!gymId || !classSchedule.id) return;
    
    setLoading(true);
    try {
      const enrollmentsData = await getClassEnrollments(gymId, classSchedule.id);
      
      // Separar confirmados y en lista de espera
      const confirmed = enrollmentsData.filter(e => e.enrollmentType === 'confirmed');
      const waitlist = enrollmentsData.filter(e => e.enrollmentType === 'waitlist');
      
      setEnrollments([...confirmed, ...waitlist]);
      
    } catch (error) {
      console.error('Error cargando inscritos:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMarkAttendance = async (enrollmentId: string, attended: boolean) => {
    if (!gymId) return;
    
    setMarkingAttendance(enrollmentId);
    try {
      await markAttendance(gymId, enrollmentId, attended);
      await loadEnrollments();
    } catch (error) {
      console.error('Error marcando asistencia:', error);
      alert('Error al marcar asistencia');
    } finally {
      setMarkingAttendance(null);
    }
  };
  
  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const confirmedEnrollments = enrollments.filter(e => e.enrollmentType === 'confirmed');
  const waitlistEnrollments = enrollments.filter(e => e.enrollmentType === 'waitlist');
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">{classSchedule.activityName}</h2>
            <p className="text-blue-100 text-sm">{formatDate(classSchedule.startDateTime)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-lg p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{confirmedEnrollments.length}</div>
            <div className="text-sm text-gray-600">Confirmados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{waitlistEnrollments.length}</div>
            <div className="text-sm text-gray-600">Lista de Espera</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {confirmedEnrollments.filter(e => e.status === 'attended').length}
            </div>
            <div className="text-sm text-gray-600">Asistieron</div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600">No hay inscritos en esta clase</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Confirmados */}
              {confirmedEnrollments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    ✅ Confirmados ({confirmedEnrollments.length})
                  </h3>
                  <div className="space-y-2">
                    {confirmedEnrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {enrollment.position}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{enrollment.memberName}</div>
                            <div className="text-sm text-gray-600">{enrollment.memberEmail}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {enrollment.status === 'attended' ? (
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              ✓ Asistió
                            </span>
                          ) : enrollment.status === 'no-show' ? (
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                              ✗ No asistió
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleMarkAttendance(enrollment.id, true)}
                                disabled={markingAttendance === enrollment.id}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                ✓ Presente
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(enrollment.id, false)}
                                disabled={markingAttendance === enrollment.id}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                ✗ Ausente
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Lista de Espera */}
              {waitlistEnrollments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    ⏳ Lista de Espera ({waitlistEnrollments.length})
                  </h3>
                  <div className="space-y-2">
                    {waitlistEnrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {enrollment.waitlistPosition}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{enrollment.memberName}</div>
                            <div className="text-sm text-gray-600">{enrollment.memberEmail}</div>
                          </div>
                        </div>
                        
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                          En espera
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};