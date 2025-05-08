// src/components/dashboard/SalesChart.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesChartData } from '../../services/stats.service';
import { formatCurrency } from '../../utils/formatting.utils';
import useAuth from '../../hooks/useAuth';

interface SalesChartProps {
  period: 'month' | '3months' | 'year';
}

const SalesChart: React.FC<SalesChartProps> = ({ period }) => {
  const { gymData } = useAuth();
  
  const [chartData, setChartData] = useState<Array<{ name: string; memberships: number; other: number; total: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadChartData();
  }, [gymData?.id, period]);
  
  const loadChartData = async () => {
    if (!gymData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Cargar datos del gráfico según el periodo seleccionado
      const data = await getSalesChartData(gymData.id, period);
      
      // Formatear datos para el gráfico
      const formattedData = data.dates.map((date, index) => ({
        name: date,
        memberships: data.values.memberships[index],
        other: data.values.other[index],
        total: data.values.memberships[index] + data.values.other[index]
      }));
      
      setChartData(formattedData);
    } catch (err: any) {
      console.error('Error loading sales chart data:', err);
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
        <p>{error}</p>
      </div>
    );
  }
  
  if (chartData.length === 0) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        <p>No hay datos disponibles para este periodo</p>
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
        <XAxis 
          dataKey="name" 
          fontSize={12} 
          tickMargin={10}
          tick={{ fill: '#6B7280' }}
        />
        <YAxis 
          fontSize={12}
          tickMargin={10}
          tick={{ fill: '#6B7280' }}
          tickFormatter={(value) => formatCurrency(value).replace('$', '')}
        />
        <Tooltip 
          formatter={(value: number) => [formatCurrency(value), '']}
          labelFormatter={(label) => `Fecha: ${label}`}
        />
        <Legend wrapperStyle={{ paddingTop: 10 }} />
        <Bar 
          name="Membresías" 
          dataKey="memberships" 
          fill="#8B5CF6" 
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          name="Otros" 
          dataKey="other" 
          fill="#10B981" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SalesChart;