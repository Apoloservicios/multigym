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

          // ⭐ Calcular apertura (2 horas antes del inicio)
          const openingTime = new Date(startDateTime);
          openingTime.setHours(startDateTime.getHours() - 2);

          const schedule: Omit<ClassSchedule, 'id'> = {
            gymId,
            classDefId,
            date: currentDate.toISOString().split('T')[0],
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
            
            // ⭐ NUEVOS CAMPOS
            isOpenForEnrollment: false,  // Cerrada por defecto
            openingTime: Timestamp.fromDate(openingTime),
            openedManually: false,
            
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
    date: string;  // ⭐ STRING "YYYY-MM-DD"
    startTime: string;
    endTime: string;
    cancellationDeadline: number;
    allowWaitlist: boolean;
    maxWaitlist: number;
  }
): Promise<string> => {
  try {
    console.log('📝 Creando clase simple - DATA RECIBIDA:', classData);
    
    const { date, startTime, endTime, ...rest } = classData;
    
    // ⭐ PARSEAR CORRECTAMENTE LA FECHA (sin conversión UTC)
    const [year, month, day] = date.split('-').map(Number);
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    console.log('📅 Parseando fecha:', {
      dateString: date,
      parsed: { year, month, day },
      startTime: { startHours, startMinutes },
      endTime: { endHours, endMinutes }
    });
    
    // ⭐ CREAR FECHAS EN HORA LOCAL (el mes en Date es 0-indexed)
    const startDateTime = new Date(year, month - 1, day, startHours, startMinutes, 0, 0);
    const endDateTime = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);
    
    console.log('✅ Fechas creadas:', {
      startDateTime: startDateTime.toLocaleString('es-AR'),
      endDateTime: endDateTime.toLocaleString('es-AR'),
      dayOfWeek: startDateTime.getDay(),
      date: startDateTime.getDate(),
      month: startDateTime.getMonth() + 1,
      year: startDateTime.getFullYear()
    });
    
    // Calcular deadline de cancelación
    const cancellationDeadlineDate = new Date(startDateTime);
    cancellationDeadlineDate.setMinutes(
      startDateTime.getMinutes() - classData.cancellationDeadline
    );
    
    // Calcular hora de apertura (2 horas antes)
    const openingTime = new Date(startDateTime);
    openingTime.setHours(startDateTime.getHours() - 2);
    
    const schedule: Omit<ClassSchedule, 'id'> = {
      gymId,
      classDefId: '',
      date: date,  // ⭐ Guardar el string original "YYYY-MM-DD"
      startDateTime: Timestamp.fromDate(startDateTime),
      endDateTime: Timestamp.fromDate(endDateTime),
      ...rest,
      enrolled: 0,
      waitlist: 0,
      available: classData.capacity,
      status: 'scheduled',
      cancellationDeadline: Timestamp.fromDate(cancellationDeadlineDate),
      isOpenForEnrollment: false,
      openingTime: Timestamp.fromDate(openingTime),
      openedManually: false,
      createdAt: serverTimestamp() as Timestamp
    };
    
    console.log('💾 Schedule a guardar:', {
      date: schedule.date,
      startDateTime: schedule.startDateTime.toDate().toLocaleString('es-AR'),
      endDateTime: schedule.endDateTime.toDate().toLocaleString('es-AR')
    });
    
    const scheduleRef = await addDoc(
      collection(db, `gyms/${gymId}/classSchedules`),
      schedule
    );
    
    console.log('✅ Clase creada exitosamente:', scheduleRef.id);
    
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
 * Obtener inscritos de una clase
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
      where('status', '!=', 'cancelled'),  // ⭐ MOSTRAR TODOS MENOS CANCELADOS
      orderBy('status', 'asc'),
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
    
    console.log('✅ Enrollments obtenidos:', enrollments.length);
    
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
    console.log('✅ Marcando asistencia:', { enrollmentId, attended });
    
    const enrollmentRef = doc(db, `gyms/${gymId}/classEnrollments`, enrollmentId);
    
    // ⭐ SOLO ACTUALIZAR EL STATUS, NO BORRAR
    await updateDoc(enrollmentRef, {
      status: attended ? 'attended' : 'no-show',
      attendedAt: attended ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Asistencia marcada: ${attended ? 'Presente' : 'Ausente'}`);
    
  } catch (error) {
    console.error('❌ Error marcando asistencia:', error);
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

/**
 * Abrir inscripciones de una clase manualmente
 */
export const openClassEnrollment = async (
  gymId: string,
  scheduleId: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    
    await updateDoc(scheduleRef, {
      isOpenForEnrollment: true,
      openedManually: true,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Inscripciones abiertas manualmente');
    
  } catch (error) {
    console.error('❌ Error abriendo inscripciones:', error);
    throw error;
  }
};

/**
 * Cerrar inscripciones de una clase manualmente
 */
export const closeClassEnrollment = async (
  gymId: string,
  scheduleId: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    
    await updateDoc(scheduleRef, {
      isOpenForEnrollment: false,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Inscripciones cerradas manualmente');
    
  } catch (error) {
    console.error('❌ Error cerrando inscripciones:', error);
    throw error;
  }
};

/**
 * Abrir automáticamente clases que llegaron a su hora de apertura
 */
export const autoOpenClasses = async (gymId: string): Promise<number> => {
  try {
    const now = new Date();
    const schedulesRef = collection(db, `gyms/${gymId}/classSchedules`);
    
    // Buscar clases cerradas que ya pasaron su hora de apertura
    const q = query(
      schedulesRef,
      where('isOpenForEnrollment', '==', false),
      where('openingTime', '<=', Timestamp.fromDate(now)),
      where('status', '==', 'scheduled')
    );
    
    const schedulesSnap = await getDocs(q);
    
    if (schedulesSnap.empty) {
      console.log('No hay clases para abrir automáticamente');
      return 0;
    }
    
    const batch = writeBatch(db);
    let count = 0;
    
    schedulesSnap.forEach(doc => {
      batch.update(doc.ref, {
        isOpenForEnrollment: true,
        updatedAt: serverTimestamp()
      });
      count++;
    });
    
    await batch.commit();
    
    console.log(`✅ ${count} clases abiertas automáticamente`);
    return count;
    
  } catch (error) {
    console.error('❌ Error en apertura automática:', error);
    throw error;
  }
};



/**
 * Eliminar una clase programada
 */
export const deleteClass = async (
  gymId: string,
  scheduleId: string
): Promise<void> => {
  try {
    console.log('🗑️ Eliminando clase:', scheduleId);
    
    // Verificar si tiene inscripciones
    const enrollmentsRef = collection(db, `gyms/${gymId}/classEnrollments`);
    const q = query(enrollmentsRef, where('scheduleId', '==', scheduleId));
    const enrollmentsSnap = await getDocs(q);
    
    if (!enrollmentsSnap.empty) {
      console.log(`⚠️ La clase tiene ${enrollmentsSnap.size} inscripciones`);
      
      // Eliminar inscripciones primero
      const batch = writeBatch(db);
      enrollmentsSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log('✅ Inscripciones eliminadas');
    }
    
    // Eliminar la clase
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    await deleteDoc(scheduleRef);
    
    console.log('✅ Clase eliminada exitosamente');
    
  } catch (error) {
    console.error('❌ Error eliminando clase:', error);
    throw error;
  }
};

/**
 * Cancelar una clase (mantiene el registro pero marca como cancelada)
 */
export const cancelClass = async (
  gymId: string,
  scheduleId: string,
  reason?: string
): Promise<void> => {
  try {
    console.log('🚫 Cancelando clase:', scheduleId);
    
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    
    await updateDoc(scheduleRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancellationReason: reason || 'No especificada',
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Clase cancelada');
    
    // TODO: Aquí se podría enviar notificación a los inscritos
    
  } catch (error) {
    console.error('❌ Error cancelando clase:', error);
    throw error;
  }
};

/**
 * Inscribir usuario en una clase
 */
export const enrollInClass = async (
  gymId: string,
  scheduleId: string,
  memberId: string,
  memberName: string,
  memberEmail: string
): Promise<string> => {
  try {
    console.log('📝 Intentando inscribir:', { scheduleId, memberId, memberName });
    
    // ⭐ VERIFICAR SI YA ESTÁ INSCRITO
    const enrollmentsRef = collection(db, `gyms/${gymId}/classEnrollments`);
    const existingEnrollmentQuery = query(
      enrollmentsRef,
      where('scheduleId', '==', scheduleId),
      where('memberId', '==', memberId),
      where('status', 'in', ['enrolled', 'confirmed', 'waitlist'])
    );
    
    const existingEnrollments = await getDocs(existingEnrollmentQuery);
    
    if (!existingEnrollments.empty) {
      console.log('⚠️ Ya existe inscripción activa');
      throw new Error('Ya estás inscrito en esta clase');
    }
    
    // Obtener datos de la clase
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, scheduleId);
    const scheduleDoc = await getDoc(scheduleRef);
    
    if (!scheduleDoc.exists()) {
      throw new Error('La clase no existe');
    }
    
    const schedule = scheduleDoc.data() as ClassSchedule;
    
    // Verificar si la clase está abierta
    if (!schedule.isOpenForEnrollment) {
      throw new Error('Las inscripciones aún no están abiertas para esta clase');
    }
    
    // Verificar capacidad disponible
    const hasSpace = schedule.available > 0;
    const enrollmentType = hasSpace ? 'confirmed' : 'waitlist';
    
    if (!hasSpace && (!schedule.allowWaitlist || schedule.waitlist >= schedule.maxWaitlist)) {
      throw new Error('La clase está completa y no hay cupos en lista de espera');
    }
    
    // Crear enrollment
    const enrollment = {
      gymId,
      scheduleId,
      memberId,
      memberName,
      memberEmail,
      enrollmentType,
      status: 'enrolled',
      position: hasSpace ? schedule.enrolled + 1 : null,
      waitlistPosition: !hasSpace ? schedule.waitlist + 1 : null,
      enrolledAt: serverTimestamp(),
      canCancelUntil: schedule.cancellationDeadline,
      createdAt: serverTimestamp()
    };
    
    const enrollmentRef = await addDoc(enrollmentsRef, enrollment);
    
    // Actualizar contador de la clase
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    if (hasSpace) {
      updateData.enrolled = schedule.enrolled + 1;
      updateData.available = schedule.available - 1;
      
      if (schedule.enrolled + 1 >= schedule.capacity) {
        updateData.status = 'full';
      }
    } else {
      updateData.waitlist = schedule.waitlist + 1;
    }
    
    await updateDoc(scheduleRef, updateData);
    
    console.log(`✅ Inscripción exitosa: ${enrollmentType}`, enrollmentRef.id);
    
    return enrollmentRef.id;
    
  } catch (error: any) {
    console.error('❌ Error en inscripción:', error);
    throw error;
  }
};

/**
 * Cancelar inscripción a una clase
 */
export const cancelEnrollment = async (
  gymId: string,
  enrollmentId: string
): Promise<void> => {
  try {
    console.log('🚫 Cancelando inscripción:', enrollmentId);
    
    // Obtener enrollment
    const enrollmentRef = doc(db, `gyms/${gymId}/classEnrollments`, enrollmentId);
    const enrollmentDoc = await getDoc(enrollmentRef);
    
    if (!enrollmentDoc.exists()) {
      throw new Error('Inscripción no encontrada');
    }
    
    const enrollment = enrollmentDoc.data();
    
    // Verificar límite de cancelación
      //const now = new Date();
      //const canCancelUntil = enrollment.canCancelUntil.toDate();
    
      //if (now >= canCancelUntil) {
        //throw new Error('Ya no puedes cancelar esta inscripción (muy cerca del inicio)');
      //}
    
    // Actualizar enrollment a cancelado
    await updateDoc(enrollmentRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Actualizar contadores de la clase
    const scheduleRef = doc(db, `gyms/${gymId}/classSchedules`, enrollment.scheduleId);
    const scheduleDoc = await getDoc(scheduleRef);
    
    if (scheduleDoc.exists()) {
      const schedule = scheduleDoc.data() as ClassSchedule;
      const updateData: any = {
        updatedAt: serverTimestamp()
      };
      
      if (enrollment.enrollmentType === 'confirmed') {
        updateData.enrolled = Math.max(0, schedule.enrolled - 1);
        updateData.available = Math.min(schedule.capacity, schedule.available + 1);
        
        if (updateData.available > 0) {
          updateData.status = 'scheduled';
        }
        
        // TODO: Promover a alguien de la lista de espera
        
      } else if (enrollment.enrollmentType === 'waitlist') {
        updateData.waitlist = Math.max(0, schedule.waitlist - 1);
      }
      
      await updateDoc(scheduleRef, updateData);
    }
    
    console.log('✅ Inscripción cancelada');
    
  } catch (error: any) {
    console.error('❌ Error cancelando inscripción:', error);
    throw error;
  }
};