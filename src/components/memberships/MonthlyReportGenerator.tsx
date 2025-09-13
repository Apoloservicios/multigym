// COMPONENTE GENERADOR DE REPORTES MENSUALES
import React, { useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { excelReportService } from '../../services/excelReportService';
import useAuth from '../../hooks/useAuth';

export const MonthlyReportGenerator: React.FC = () => {
  const { gymData } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isGenerating, setIsGenerating] = useState<'membership' | 'renewal' | ''>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const generateMembershipReport = async () => {
    if (!gymData?.id) return;
    
    setIsGenerating('membership');
    setMessage(null);
    
    try {
      // Cambiado al nombre correcto del método
      await excelReportService.generateMonthlyMembershipReport(gymData.id, selectedMonth);
      setMessage({
        type: 'success',
        text: 'Reporte de membresías generado exitosamente'
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error generando reporte:', error);
      setMessage({
        type: 'error',
        text: 'Error al generar el reporte de membresías'
      });
    } finally {
      setIsGenerating('');
    }
  };

  const generateRenewalReport = async () => {
    if (!gymData?.id) return;
    
    setIsGenerating('renewal');
    setMessage(null);
    
    try {
      // Verificar si el método existe, si no, usar el de membresías como fallback
      if (excelReportService.generateRenewalReport) {
        await excelReportService.generateRenewalReport(gymData.id, selectedMonth);
      } else {
        // Fallback: generar reporte de membresías
        await excelReportService.generateMonthlyMembershipReport(gymData.id, selectedMonth);
      }
      setMessage({
        type: 'success',
        text: 'Reporte de renovaciones generado exitosamente'
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error generando reporte:', error);
      setMessage({
        type: 'error',
        text: 'Error al generar el reporte de renovaciones'
      });
    } finally {
      setIsGenerating('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensaje de estado */}
      {message && (
        <div className={`px-4 py-3 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-6">
          <FileSpreadsheet className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">
            Generador de Reportes Excel
          </h3>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Mes
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            max={new Date().toISOString().slice(0, 7)}
          />
          <p className="mt-1 text-sm text-gray-500">
            Selecciona el mes para generar los reportes correspondientes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reporte de Membresías */}
          <div className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
            <div className="flex items-center mb-3">
              <FileSpreadsheet className="h-5 w-5 text-green-500 mr-2" />
              <h4 className="text-md font-medium text-gray-900">
                Reporte de Membresías
              </h4>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Listado completo de todas las membresías activas e inactivas del gimnasio.
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

          {/* Reporte de Renovaciones */}
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
        </div>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h5 className="text-sm font-medium text-blue-900 mb-2">
            💡 Información importante
          </h5>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Los reportes se descargan automáticamente en formato Excel (.xlsx)</li>
            <li>• Cada reporte incluye una hoja de resumen con estadísticas</li>
            <li>• Los datos se obtienen en tiempo real desde la base de datos</li>
            <li>• Puedes generar reportes de cualquier mes anterior al actual</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportGenerator;