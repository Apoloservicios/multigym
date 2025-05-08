// src/pages/attendance/Attendance.tsx
import React from 'react';
import AttendanceScanner from '../../components/attendance/AttendanceScanner';

const Attendance = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Control de Asistencias</h1>
      <AttendanceScanner />
    </div>
  );
};

export default Attendance;