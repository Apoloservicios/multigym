// src/pages/birthdays/Birthdays.tsx
import React, { useState, useEffect } from 'react';
import { Cake, MessageCircle, Calendar, Users, RefreshCw } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';

interface MemberBirthday {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone?: string;
  age: number;
  daysUntil: number;
}

const Birthdays: React.FC = () => {
  const { gymData } = useAuth();
  const [birthdays, setBirthdays] = useState<MemberBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'month'>('today');

  useEffect(() => {
    if (gymData?.id) {
      loadBirthdays();
    }
  }, [gymData?.id, filter]);

const loadBirthdays = async () => {
  if (!gymData?.id) return;

  setLoading(true);
  try {
    const membersRef = collection(db, `gyms/${gymData.id}/members`);
    const snapshot = await getDocs(query(membersRef, where('status', '==', 'active')));

    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    const birthdaysList: MemberBirthday[] = [];

    snapshot.forEach((doc) => {
      const member = doc.data();
      if (!member.birthDate) return;

      // ✅ PARSEAR LA FECHA CORRECTAMENTE SIN CONVERSIÓN DE ZONA HORARIA
  // Si la fecha viene como string "YYYY-MM-DD", parseamos manualmente
  let birthDate: Date;
  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  if (typeof member.birthDate === 'string') {
    // Parsear manualmente para evitar problemas de zona horaria
    const parts = member.birthDate.split('-');
    birthYear = parseInt(parts[0], 10);
    birthMonth = parseInt(parts[1], 10) - 1; // Mes en JS es 0-11
    birthDay = parseInt(parts[2], 10);
    birthDate = new Date(birthYear, birthMonth, birthDay);
  } else {
    // Si viene como Timestamp de Firebase
    birthDate = member.birthDate.toDate ? member.birthDate.toDate() : new Date(member.birthDate);
    birthYear = birthDate.getFullYear();
    birthMonth = birthDate.getMonth();
    birthDay = birthDate.getDate();
  }

 
      // Calcular edad actual
      let age = currentYear - birthDate.getFullYear();
      
      // Si el cumpleaños aún no llegó este año, restar 1 a la edad
      if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
        age--;
      }

      // Calcular el próximo cumpleaños (puede ser hoy, en el futuro de este año, o el año siguiente)
      let nextBirthday = new Date(currentYear, birthMonth, birthDay);
      
      // Si el cumpleaños ya pasó este año, calcular para el año siguiente
      if (nextBirthday < today) {
        // Verificar si es hoy (mismo día)
        const isToday = currentMonth === birthMonth && currentDay === birthDay;
        
        if (!isToday) {
          nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
        }
      }

      // Calcular días hasta el cumpleaños
      let daysUntil: number;
      
      if (currentMonth === birthMonth && currentDay === birthDay) {
        // Es hoy
        daysUntil = 0;
      } else {
        // Calcular diferencia en milisegundos y convertir a días
        const diffTime = nextBirthday.getTime() - today.getTime();
        daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Aplicar filtros
      let shouldInclude = false;

      if (filter === 'today') {
        // Solo incluir si es hoy (mismo mes y mismo día)
        shouldInclude = (birthMonth === currentMonth && birthDay === currentDay);
      } else {
        // Mes actual - incluir todos los cumpleaños del mes actual
        shouldInclude = (birthMonth === currentMonth);
      }

      if (shouldInclude) {
        birthdaysList.push({
          id: doc.id,
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          birthDate: member.birthDate,
          phone: member.phone,
          age,
          daysUntil
        });
      }
      // Después de calcular daysUntil, agrega esto temporalmente:
        console.log('Debug cumpleaños:', {
        nombre: `${member.firstName} ${member.lastName}`,
        fechaNacimiento: member.birthDate,
        mesNacimiento: birthMonth,
        diaNacimiento: birthDay,
        mesActual: currentMonth,
        diaActual: currentDay,
        esHoy: (birthMonth === currentMonth && birthDay === currentDay),
        diasHasta: daysUntil
        });
    });

    // Ordenar por días hasta cumpleaños (los de hoy primero, luego los más cercanos)
    birthdaysList.sort((a, b) => a.daysUntil - b.daysUntil);

    setBirthdays(birthdaysList);
  } catch (error) {
    console.error('Error cargando cumpleaños:', error);
  } finally {
    setLoading(false);
  }
};

  const sendBirthdayMessage = (member: MemberBirthday) => {
    if (!member.phone) {
      alert('Este socio no tiene teléfono registrado');
      return;
    }

    let cleanPhone = member.phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('54')) {
      cleanPhone = '54' + cleanPhone;
    }

    const message = `🎉 ¡Feliz Cumpleaños ${member.firstName}! 🎂

Desde ${gymData?.name || 'el gimnasio'} te deseamos un día increíble

¡Que cumplas muchos más! 💪🎈`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Cake className="w-8 h-8 text-pink-600" />
          <h1 className="text-3xl font-bold text-gray-900">Cumpleaños</h1>
        </div>

        <button
          onClick={loadBirthdays}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('today')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'today'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Hoy ({birthdays.filter(b => b.daysUntil === 0).length})
        </button>

        <button
          onClick={() => setFilter('month')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'month'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Este mes ({birthdays.length})
        </button>
      </div>

      {/* Lista de cumpleaños */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Cargando cumpleaños...</p>
        </div>
      ) : birthdays.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Cake className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">
            {filter === 'today'
              ? 'No hay cumpleaños hoy'
              : 'No hay cumpleaños este mes'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {birthdays.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {member.daysUntil === 0
                      ? '🎉 ¡Hoy cumple años!'
                      : `En ${member.daysUntil} día${member.daysUntil > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {member.age} años
                  </p>
                </div>
                {member.daysUntil === 0 && (
                  <Cake className="w-8 h-8 text-pink-500" />
                )}
              </div>

              <button
                onClick={() => sendBirthdayMessage(member)}
                disabled={!member.phone}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  member.phone
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                {member.phone ? 'Felicitar por WhatsApp' : 'Sin teléfono'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Birthdays;