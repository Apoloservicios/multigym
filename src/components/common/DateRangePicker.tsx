// src/components/common/DateRangePicker.tsx
import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: { start: Date | null; end: Date | null }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  
  // Obtener días del mes actual
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Obtener el día de la semana del primer día del mes (0 = domingo, 1 = lunes, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  // Formatear fecha como YYYY-MM-DD
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Ir al mes anterior
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  
  // Ir al mes siguiente
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };
  
  // Manejar la selección de una fecha
  const handleDateClick = (date: Date) => {
    if (selecting === 'start') {
      setTempStartDate(date);
      setTempEndDate(null);
      setSelecting('end');
    } else {
      // Asegurarse de que la fecha de fin no sea anterior a la de inicio
      if (tempStartDate && date < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(date);
      } else {
        setTempEndDate(date);
      }
      
      // Notificar cambio
      onChange({
        start: tempStartDate,
        end: date < tempStartDate! ? tempStartDate : date
      });
      
      // Reiniciar selección
      setSelecting('start');
    }
  };
  
  // Verificar si una fecha está seleccionada o en el rango seleccionado
  const isDateSelected = (date: Date) => {
    if (!tempStartDate) return false;
    
    const dateStr = formatDate(date);
    const startStr = formatDate(tempStartDate);
    
    if (dateStr === startStr) return true;
    
    if (tempEndDate) {
      const endStr = formatDate(tempEndDate);
      return dateStr === endStr || (date > tempStartDate && date < tempEndDate);
    }
    
    return false;
  };
  
  // Verificar si una fecha es el inicio o fin del rango
  const isStartOrEndDate = (date: Date) => {
    if (!tempStartDate) return false;
    
    const dateStr = formatDate(date);
    const startStr = formatDate(tempStartDate);
    
    if (dateStr === startStr) return true;
    
    if (tempEndDate) {
      const endStr = formatDate(tempEndDate);
      return dateStr === endStr;
    }
    
    return false;
  };
  
  // Renderizar el calendario
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
    
    // Nombres de los meses
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Días de la semana
    const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
    
    // Crear matriz de días
    const days = [];
    
    // Agregar celdas vacías para los días anteriores al primer día del mes
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }
    
    // Agregar días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isSelected = isDateSelected(date);
      const isStartOrEnd = isStartOrEndDate(date);
      
      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(date)}
          className={`
            h-8 w-8 rounded-full flex items-center justify-center text-sm
            ${isSelected 
              ? isStartOrEnd 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-100 text-blue-800' 
              : 'hover:bg-gray-100'
            }
          `}
        >
          {day}
        </button>
      );
    }
    
    return (
      <div className="mt-2">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="font-medium">
            {monthNames[currentMonth]} {currentYear}
          </div>
          <button
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div key={day} className="h-8 w-8 flex items-center justify-center text-xs text-gray-500">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };
  
  // Seleccionar rangos predefinidos
  const handleQuickSelect = (range: 'today' | 'week' | 'month' | 'year') => {
    const today = new Date();
    let start: Date;
    let end: Date = today;
    
    switch (range) {
      case 'today':
        start = today;
        break;
      case 'week':
        start = new Date();
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date();
        start.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        start = new Date();
        start.setFullYear(today.getFullYear() - 1);
        break;
    }
    
    setTempStartDate(start);
    setTempEndDate(end);
    
    // Notificar cambio
    onChange({
      start,
      end
    });
    
    // Actualizar vista del calendario al mes de la fecha de inicio
    setCurrentMonth(start.getMonth());
    setCurrentYear(start.getFullYear());
  };
  
  return (
    <div className="w-72 p-2 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">Seleccionar rango</h3>
        <div className="flex text-xs">
          <span className="text-gray-500">
            {selecting === 'start' ? 'Selecciona inicio' : 'Selecciona fin'}
          </span>
        </div>
      </div>
      
      <div className="flex space-x-2 mb-2">
        <button
          type="button"
          onClick={() => handleQuickSelect('today')}
          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect('week')}
          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          Última semana
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect('month')}
          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          Último mes
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect('year')}
          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          Último año
        </button>
      </div>
      
      <div className="flex justify-between text-sm mb-4">
        <div>
          <span className="text-gray-500 block">Inicio:</span>
          <span className="font-medium">
            {tempStartDate ? formatDate(tempStartDate) : '---'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block">Fin:</span>
          <span className="font-medium">
            {tempEndDate ? formatDate(tempEndDate) : '---'}
          </span>
        </div>
      </div>
      
      {renderCalendar()}
    </div>
  );
};

export default DateRangePicker;