// src/components/superadmin/RevenueChart.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { getRevenueChartData } from '../../services/superadmin.service';
import { formatCurrency } from '../../utils/formatting.utils';
import { AlertTriangle } from 'lucide-react';

interface RevenueChartProps {
  period: 'month' | '3months' | 'year';
}

const RevenueChart: React.FC<RevenueChartProps> = ({ period }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadChartData();
  }, [period]);
  
  const loadChartData = async () => {
    setLoading(true);
    
    try {
      const data = await getRevenueChartData(period);
      
      // Formatear datos para el gráfico
      const formattedData = data.dates.map((date, index) => ({
        date,
        amount: data.values.amount[index],
        cumulative: data.values.cumulative[index]
      }));
      
      setChartData(formattedData);
    } catch (err: any) {
      console.error('Error loading revenue chart data:', err);
      setError('Error al cargar los datos del gráfico');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center h-full text-red-500">
        <AlertTriangle className="h-5 w-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip 
          formatter={(value: number) => [formatCurrency(value), '']}
          labelFormatter={(label) => `Fecha: ${label}`}
        />
        <Legend />
        <Bar 
          name="Ingresos" 
          dataKey="amount" 
          barSize={20}
          fill="#10B981" 
          yAxisId="left"
          radius={[4, 4, 0, 0]}
        />
        <Line 
          name="Acumulado" 
          type="monotone" 
          dataKey="cumulative" 
          stroke="#3B82F6"
          strokeWidth={2}
          yAxisId="right"
          dot={{ fill: '#3B82F6', r: 4 }}
          activeDot={{ r: 6, fill: '#1E40AF' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default RevenueChart;