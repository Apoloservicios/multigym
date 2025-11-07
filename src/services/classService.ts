// src/services/classService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ClassDefinition, ClassSchedule } from '../types/class.types';

/**
 * Crear definición de clase
 */
export const createClassDefinition = async (
  gymId: string,
  classData: Omit<ClassDefinition, 'id' | 'gymId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    console.log('📝 Creando definición de clase:', classData);
    
    const classDefRef = await addDoc(
      collection(db, `gyms/${gymId}/classDefinitions`),
      {
        ...classData,
        gymId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
    
    console.log('✅ Definición creada:', classDefRef.id);
    
    // Si es recurrente, generar schedules automáticamente
    if (classData.isRecurring && classData.recurrence) {
      await generateRecurringSchedules(gymId, classDefRef.id, classData);
    }
    
    return classDefRef.id;
    
  } catch (error) {
    console.error('❌ Error creando clase:', error);
    throw error;
  }
};

/**
 * Generar schedules para clases recurrentes
 * Genera las próximas 4 semanas
 */
export const generateRecurringSchedules = async (
  gymId: string,
  classDefId: string,
  classData: Omit<ClassDefinition, 'id' | 'gymId' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  try {
    if (!classData.recurrence) return;
    
    console.log('📅 Generando schedules recurrentes...');
    
    const schedules: Omit<ClassSchedule, 'id'>[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generar para las próximas 4 semanas (28 días)
    const weeksToGenerate = 4;
    const daysToGenerate = weeksToGenerate * 7;
    
    for (let i = 0; i < daysToGenerate; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      
      const dayOfWeek = currentDate.getDay();
      
      // Si este día está en los días recurrentes
      if (classData.recurrence.days.includes(dayOfWeek)) {
        const [hours, minutes] = classData.recurrence.startTime.split(':').map(Number);
        const [endHours, endMinutes] = classData.recurrence.endTime.split(':').map(Number);
        
        const startDateTime = new Date(currentDate);
        startDateTime.setHours(hours, minutes, 0, 0);
        
        const endDateTime = new Date(currentDate);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
        
        // Calcular deadline (X minutos antes del inicio)
        const cancellationDeadline = new Date(startDateTime);
        cancellationDeadline.setMinutes(
          startDateTime.getMinutes() - classData.cancellationDeadline
        );
        
        const schedule: Omit<ClassSchedule, 'id'> = {
          gymId,
          classDefId,
          date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
          startDateTime: Timestamp.fromDate(startDateTime),
          endDateTime: Timestamp.fromDate(endDateTime),
          activityId: classData.activityId,
          activityName: classData.activityName,
          instructor: classData.instructor,
          capacity: classData.capacity,
          enrolled: 0,
          waitlist: 0,
          available: classData.capacity,
          allowWaitlist: classData.allowWaitlist,
          maxWaitlist: classData.maxWaitlist,
          status: 'scheduled',
          cancellationDeadline: Timestamp.fromDate(cancellationDeadline),
          createdAt: serverTimestamp() as Timestamp
        };
        
        schedules.push(schedule);
      }
    }
    
    // Guardar todos los schedules en lote
    if (schedules.length > 0) {
      const batch = writeBatch(db);
      
      schedules.forEach(schedule => {
        const scheduleRef = doc(collection(db, `gyms/${gymId}/classSchedules`));
        batch.set(scheduleRef, schedule);
      });
      
      await batch.commit();
      
      console.log(`✅ ${schedules.length} schedules generados`);
    }
    
  } catch (error) {
    console.error('❌ Error generando schedules:', error);
    throw error;
  }
};

/**
 * Crear clase simple (no recurrente)
 */
export const createSingleClass = async (
  gymId: string,
  classData: {
    activityId: string;
    activityName: string;
    instructor: string;
    capacity: number;
    date: Date;
    startTime: string;  // "16:00"
    endTime: string;    // "17:00"
    cancellationDeadline: number;
    allowWaitlist: boolean;
    maxWaitlist: number;
  }
): Promise<string> => {
  try {
    console.log('📝 Creando clase simple:', classData);
    
    const { date, startTime, endTime, ...rest } = classData;
    
    // Crear fecha/hora de inicio
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    
    // Crear fecha/hora de fin
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const endDateTime = new Date(date);
    endDateTime.setHours(endHours, endMinutes, 0, 0);
    
    // Calcular deadline
    const cancellationDeadlineDate = new Date(startDateTime);
    cancellationDeadlineDate.setMinutes(
      startDateTime.getMinutes() - classData.cancellationDeadline
    );
    
    const schedule: Omit<ClassSchedule, 'id'> = {
      gymId,
      classDefId: '', // No tiene definición base
      date: date.toISOString().split('T')[0],
      startDateTime: Timestamp.fromDate(startDateTime),
      endDateTime: Timestamp.fromDate(endDateTime),
      ...rest,
      enrolled: 0,
      waitlist: 0,
      available: classData.capacity,
      status: 'scheduled',
      cancellationDeadline: Timestamp.fromDate(cancellationDeadlineDate),
      createdAt: serverTimestamp() as Timestamp
    };
    
    const scheduleRef = await addDoc(
      collection(db, `gyms/${gymId}/classSchedules`),
      schedule
    );
    
    console.log('✅ Clase creada:', scheduleRef.id);
    
    return scheduleRef.id;
    
  } catch (error) {
    console.error('❌ Error creando clase:', error);
    throw error;
  }
};

/**
 * Obtener clases programadas de un rango de fechas
 */
export const getScheduledClasses = async (
  gymId: string,
  startDate: Date,
  endDate: Date
): Promise<ClassSchedule[]> => {
  try {
    const schedulesRef = collection(db, `gyms/${gymId}/classSchedules`);
    
    const q = query(
      schedulesRef,
      where('startDateTime', '>=', Timestamp.fromDate(startDate)),
      where('startDateTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startDateTime', 'asc')
    );
    
    const schedulesSnap = await getDocs(q);
    
    const schedules: ClassSchedule[] = [];
    
    schedulesSnap.forEach(doc => {
      schedules.push({
        id: doc.id,
        ...doc.data()
      } as ClassSchedule);
    });
    
    return schedules;
    
  } catch (error) {
    console.error('❌ Error obteniendo clases:', error);
    throw error;
  }
};

/**
 * Obtener inscripciones de una clase
 */
export const getClassEnrollments = async (
  gymId: string,
  scheduleId: string
): Promise<any[]> => {
  try {
    const enrollmentsRef = collection(db, `gyms/${gymId}/classEnrollments`);
    
    const q = query(
      enrollmentsRef,
      where('scheduleId', '==', scheduleId),
      where('status', '==', 'active'),
      orderBy('enrolledAt', 'asc')
    );
    
    const enrollmentsSnap = await getDocs(q);
    
    const enrollments: any[] = [];
    
    enrollmentsSnap.forEach(doc => {
      enrollments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return enrollments;
    
  } catch (error) {
    console.error('❌ Error obteniendo inscripciones:', error);
    throw error;
  }
};

/**
 * Marcar asistencia de un inscrito
 */
export const markAttendance = async (
  gymId: string,
  enrollmentId: string,
  attended: boolean
): Promise<void> => {
  try {
    const enrollmentRef = doc(db, `gyms/${gymId}/classEnrollments`, enrollmentId);
    
    await updateDoc(enrollmentRef, {
      status: attended ? 'attended' : 'no-show',
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Asistencia marcada');
    
  } catch (error) {
    console.error('❌ Error marcando asistencia:', error);
    throw error;
  }
};

/**
 * Cancelar clase (notifica a todos los inscritos)
 */
export const cancelClass = async (
  gymId: string,
  scheduleId: string
): Promise<void> => {
  try {
    // Actualizar estado de la clase
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    
    await updateDoc(scheduleRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });
    
    // Cancelar todas las inscripciones
    const enrollments = await getClassEnrollments(gymId, scheduleId);
    
    const batch = writeBatch(db);
    
    enrollments.forEach(enrollment => {
      const enrollmentRef = doc(db, `gyms/${gymId}/classEnrollments`, enrollment.id);
      batch.update(enrollmentRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'admin'
      });
    });
    
    await batch.commit();
    
    console.log('✅ Clase cancelada y usuarios notificados');
    
  } catch (error) {
    console.error('❌ Error cancelando clase:', error);
    throw error;
  }
};

/**
 * Obtener actividades disponibles
 */
export const getActivities = async (gymId: string): Promise<any[]> => {
  try {
    const activitiesRef = collection(db, `gyms/${gymId}/activities`);
    const activitiesSnap = await getDocs(activitiesRef);
    
    const activities: any[] = [];
    
    activitiesSnap.forEach(doc => {
      activities.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return activities;
    
  } catch (error) {
    console.error('❌ Error obteniendo actividades:', error);
    return [];
  }
};