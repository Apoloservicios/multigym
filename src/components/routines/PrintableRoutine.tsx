// src/components/routines/PrintableRoutine.tsx - Versión ultra compacta para una sola hoja
import React, { forwardRef } from 'react';
import { MemberRoutine, Routine } from '../../types/exercise.types';
import { Member } from '../../types/member.types';

// GymInfo con tipos actualizados
interface GymInfo {
  id: string;
  name: string;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string;
}

interface PrintableRoutineProps {
  memberRoutine: MemberRoutine;
  routineDetails: Routine;
  member: Member;
  gymData: GymInfo;
}

const PrintableRoutine = forwardRef<HTMLDivElement, PrintableRoutineProps>(
  ({ memberRoutine, routineDetails, member, gymData }, ref) => {
    
    // Función para formatear fecha
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR');
    };
    
    // Obtener días de la rutina en orden
    const getDaysInOrder = () => {
      const days = Object.keys(routineDetails.exercises).sort((a, b) => {
        const dayNumberA = parseInt(a.replace('day', ''));
        const dayNumberB = parseInt(b.replace('day', ''));
        return dayNumberA - dayNumberB;
      });
      return days;
    };
    
    return (
      <div ref={ref} className="bg-white p-2 text-black font-sans" style={{ fontSize: '9px' }}>
        {/* Encabezado ultra compacto */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {/* Columna 1: Gimnasio con logo pequeño */}
          <div className="flex items-center">
            {gymData.logo ? (
              <img 
                src={gymData.logo} 
                alt={gymData.name} 
                className="h-10 w-10 mr-2"
                style={{ 
                  width: '110px', 
                  height: '110px', 
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center mr-2">
                <span className="text-white font-bold text-sm">G</span>
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold">{gymData.name}</h1>
              <p className="text-xs">Cel: {gymData.phone}</p>
            </div>
          </div>
          
          {/* Columna 2: Socio y rutina */}
          <div className="text-left text-sm">
            <div>
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Socio:</span> {member.firstName} {member.lastName}
            </div>
            <div>
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Objetivo:</span> {routineDetails.goal || 'Mantenimiento'}
            </div>
            <div>
              <span className="font-bold">Rutina:</span> {routineDetails.name} - <span className="font-bold">{routineDetails.daysPerWeek} días/sem</span>
            </div>
          </div>
          
          {/* Columna 3: Fechas */}
          <div className="text-right text-xs">
            <p>
              <span className="font-bold">Fecha:</span> {formatDate(memberRoutine.startDate)}
            </p>
            <p>
              <span className="font-bold">Válido:</span> {formatDate(memberRoutine.endDate)}
            </p>
          </div>
        </div>
        
        {/* Notas del entrenador - más compacto */}
        {memberRoutine.trainerNotes && (
          <div className="mb-2 p-1 bg-gray-100 border rounded text-xs">
            <strong>Notas:</strong> {memberRoutine.trainerNotes}
          </div>
        )}
        
        {/* Rutina por días - Mantener 2 columnas pero más compacto */}
        <div className="grid grid-cols-2 gap-2">
          {getDaysInOrder().map((day, index) => {
            const dayNumber = parseInt(day.replace('day', ''));
            const exercises = routineDetails.exercises[day] || [];
            
            // Asignar colores específicos para cada día
            const colorStyle = (() => {
              switch (index + 1) {
                case 1:
                  return { backgroundColor: '#fbbf24', color: 'black' }; // Amarillo
                case 2:
                  return { backgroundColor: '#22d3ee', color: 'black' }; // Celeste
                case 3:
                  return { backgroundColor: '#fb923c', color: 'black' }; // Naranja
                case 4:
                  return { backgroundColor: '#22c55e', color: 'black' }; // Verde
                case 5:
                  return { backgroundColor: '#c084fc', color: 'black' }; // Púrpura
                case 6:
                  return { backgroundColor: '#f87171', color: 'black' }; // Rojo
                case 7:
                  return { backgroundColor: '#60a5fa', color: 'black' }; // Azul
                default:
                  return { backgroundColor: '#9ca3af', color: 'black' }; // Gris
              }
            })();
            
            return (
              <div key={day} className="border border-black">
                {/* Cabecera del día ultra compacta */}
                <div 
                  className="py-0.5 text-center border-b border-black"
                  style={colorStyle}
                >
                  <h3 className="font-bold text-xs">Día {dayNumber}</h3>
                </div>
                
                <table className="w-full border-collapse" style={{ fontSize: '8px' }}>
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left py-0.5 px-1 font-bold border-r border-black" style={{ width: '55%' }}>Ejercicio</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '9%' }}>S</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '9%' }}>R</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '5%' }}>1</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '5%' }}>2</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '5%' }}>3</th>
                      <th className="text-center py-0.5 px-0.5 font-bold border-r border-black" style={{ width: '5%' }}>4</th>
                      <th className="text-center py-0.5 px-0.5 font-bold" style={{ width: '7%' }}>Des</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercises.map((exercise, exerciseIndex) => (
                      <tr key={exerciseIndex} className="border-b border-gray-200">
                        <td className="py-0.5 px-1 border-r border-gray-200" style={{ fontSize: '8px' }}>
                          {exercise.exerciseName}
                        </td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200" style={{ fontSize: '8px' }}>
                          {exercise.sets}
                        </td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200" style={{ fontSize: '8px' }}>
                          {exercise.reps}
                        </td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200 h-4"></td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200 h-4"></td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200 h-4"></td>
                        <td className="text-center py-0.5 px-0.5 border-r border-gray-200 h-4"></td>
                        <td className="text-center py-0.5 px-0.5 h-4" style={{ fontSize: '7px' }}>{exercise.rest}s</td>
                      </tr>
                    ))}
                    
                    {/* Solo 3-4 filas vacías como máximo */}
                    {exercises.length < 4 && Array(4 - exercises.length).fill(0).map((_, emptyIndex) => (
                      <tr key={`empty-${emptyIndex}`} className="border-b border-gray-200">
                        <td className="py-0.5 px-1 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4 border-r border-gray-200"></td>
                        <td className="text-center py-0.5 px-0.5 h-4"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

PrintableRoutine.displayName = 'PrintableRoutine';

export default PrintableRoutine;