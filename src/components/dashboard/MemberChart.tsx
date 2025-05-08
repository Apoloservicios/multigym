// src/components/dashboard/MemberChart.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getMemberChartData } from '../../services/stats.service';
import useAuth from '../../hooks/useAuth';

interface MemberChartProps {
  period: 'month' | '3months' | 'year';
}

const MemberChart: React.FC<MemberChartProps> = ({ period }) => {
  const { gymData } = useAuth();
  
  const [chartData, setChartData] = useState<Array<{ name: string; value: number }>>([]);
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
      const data = await getMemberChartData(gymData.id, period);
      
      // Formatear datos para el gráfico
      const formattedData = data.dates.map((date, index) => ({
        name: date,
        value: data.counts[index]
      }));
      
      setChartData(formattedData);
    } catch (err: any) {
      console.error('Error loading member chart data:', err);
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
      <LineChart
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
          allowDecimals={false}
        />
        <Tooltip 
          formatter={(value: number) => [`${value} socios`, 'Total']}
          labelFormatter={(label) => `Fecha: ${label}`}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#2563EB" 
          strokeWidth={2}
          dot={{ fill: '#2563EB', r: 4 }}
          activeDot={{ r: 6, fill: '#1E40AF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MemberChart;