// src/components/memberships/MonthlyReportGenerator.tsx
// 📊 COMPONENTE PARA GENERAR REPORTES MENSUALES - VERSIÓN CORREGIDA
// Permite seleccionar mes y generar diferentes tipos de reportes

import React, { useState, useEffect } from 'react';
import { Calendar, Download, FileSpreadsheet, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { excelReportService } from '../../services/excelReportService';
import useAuth from '../../hooks/useAuth';

interface MonthlyReportGeneratorProps {
  onReportGenerated?: () => void;
}

const MonthlyReportGenerator: React.FC<MonthlyReportGeneratorProps> = ({ 
  onReportGenerated 
}) => {
  const { gymData } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isGenerating, setIsGenerating] = useState<string>('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Auto-limpiar mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * 📊 Generar reporte de membresías
   */
  const generateMembershipReport = async () => {
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio');
      return;
    }
    
    setIsGenerating('membership');
    setError('');
    setSuccess('');
    
    try {
      console.log('📊 Generando reporte de membresías para:', selectedMonth);
      await excelReportService.generateMonthlyMembershipReport(gymData.id, selectedMonth);
      setSuccess('✅ Reporte de membresías generado y descargado exitosamente');
      onReportGenerated?.();
    } catch (err: any) {
      console.error('❌ Error generando reporte:', err);
      setError(`Error generando reporte: ${err.message}`);
    } finally {
      setIsGenerating('');
    }
  };

  /**
   * 🔄 Generar reporte de renovaciones
   */
  const generateRenewalReport = async () => {
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio');
      return;
    }
    
    setIsGenerating('renewal');
    setError('');
    setSuccess('');
    
    try {
      console.log('🔄 Generando reporte de renovaciones para:', selectedMonth);
      await excelReportService.generateRenewalReport(gymData.id, selectedMonth);
      setSuccess('✅ Reporte de renovaciones generado y descargado exitosamente');
      onReportGenerated?.();
    } catch (err: any) {
      console.error('❌ Error generando reporte:', err);
      setError(`Error generando reporte: ${err.message}`);
    } finally {
      setIsGenerating('');
    }
  };

  /**
   * 📈 Generar reporte completo (membresías + renovaciones)
   */
  const generateCompleteReport = async () => {
    if (!gymData?.id) {
      setError('No se encontró información del gimnasio');
      return;
    }
    
    setIsGenerating('complete');
    setError('');
    setSuccess('');
    
    try {
      console.log('📈 Generando reporte completo para:', selectedMonth);
      
      // Generar ambos reportes en secuencia
      await excelReportService.generateMonthlyMembershipReport(gymData.id, selectedMonth);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
      await excelReportService.generateRenewalReport(gymData.id, selectedMonth);
      
      setSuccess('✅ Reportes completos generados y descargados exitosamente (2 archivos)');
      onReportGenerated?.();
    } catch (err: any) {
      console.error('❌ Error generando reportes:', err);
      setError(`Error generando reportes: ${err.message}`);
    } finally {
      setIsGenerating('');
    }
  };

  /**
   * 📅 Obtener nombre del mes seleccionado
   */
  const getSelectedMonthName = (): string => {
    const [year, month] = selectedMonth.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-6">
        <FileSpreadsheet className="h-6 w-6 text-green-600 mr-3" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Generar Reportes Excel
          </h3>
          <p className="text-sm text-gray-500">
            Exporta datos de membresías y renovaciones para control cruzado
          </p>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar mes para el reporte:
        </label>
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <div className="text-sm text-gray-600">
            Mes seleccionado: <span className="font-medium">{getSelectedMonthName()}</span>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="flex justify-between items-start">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccess('')}
              className="text-green-400 hover:text-green-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex justify-between items-start">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Opciones de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reporte de membresías */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
          <div className="flex items-center mb-3">
            <FileSpreadsheet className="h-5 w-5 text-green-500 mr-2" />
            <h4 className="text-md font-medium text-gray-900">
              Reporte de Membresías
            </h4>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Listado completo de socios con sus membresías activas, estado de pagos y configuración de auto-renovación.
          </p>
          
          <div className="mb-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Incluye:</strong><br/>
            • Datos personales de socios<br/>
            • Estado de pagos del mes seleccionado<br/>
            • Configuración de auto-renovación<br/>
            • Asistencias y fechas de vencimiento<br/>
            • Estado actual de cada membresía
          </div>
          
          <button
            onClick={generateMembershipReport}
            disabled={isGenerating !== ''}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating === 'membership' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating === 'membership' ? 'Generando...' : 'Generar Excel'}
          </button>
        </div>

        {/* Reporte de renovaciones */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
          <div className="flex items-center mb-3">
            <RefreshCw className="h-5 w-5 text-blue-500 mr-2" />
            <h4 className="text-md font-medium text-gray-900">
              Reporte de Renovaciones
            </h4>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Detalle de todas las renovaciones automáticas procesadas durante el mes seleccionado.
          </p>
          
          <div className="mb-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Incluye:</strong><br/>
            • Renovaciones exitosas y fallidas<br/>
            • Cambios de precio aplicados<br/>
            • Fecha y tipo de renovación<br/>
            • Observaciones y errores<br/>
            • Historial de procesos automáticos
          </div>
          
          <button
            onClick={generateRenewalReport}
            disabled={isGenerating !== ''}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating === 'renewal' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating === 'renewal' ? 'Generando...' : 'Generar Excel'}
          </button>
        </div>

        {/* Reporte completo */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
          <div className="flex items-center mb-3">
            <FileSpreadsheet className="h-5 w-5 text-purple-500 mr-2" />
            <h4 className="text-md font-medium text-gray-900">
              Reporte Completo
            </h4>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Genera ambos reportes (membresías + renovaciones) para tener una vista completa del mes.
          </p>
          
          <div className="mb-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Descarga 2 archivos:</strong><br/>
            • Reporte completo de membresías<br/>
            • Reporte detallado de renovaciones<br/>
            • Ideal para auditorías mensuales<br/>
            • Control cruzado completo
          </div>
          
          <button
            onClick={generateCompleteReport}
            disabled={isGenerating !== ''}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating === 'complete' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating === 'complete' ? 'Generando Ambos...' : 'Generar Completo'}
          </button>
        </div>
      </div>

      {/* Información adicional */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          💡 Información sobre los reportes
        </h4>
        <div className="text-sm text-blue-700 space-y-2">
          <p>
            <strong>Reporte de Membresías:</strong> Perfecto para hacer el doble control que mencionaste. 
            Incluye todos los socios, sus membresías y si pagaron el mes corriente.
          </p>
          <p>
            <strong>Reporte de Renovaciones:</strong> Muestra específicamente qué renovaciones automáticas 
            se procesaron durante el mes, incluyendo errores y cambios de precios.
          </p>
          <p>
            <strong>Formato:</strong> Los archivos se descargan automáticamente en formato Excel (.xlsx) 
            con el nombre del mes incluido para fácil identificación.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportGenerator;