// src/components/superadmin/SubscriptionChart.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSubscriptionChartData } from '../../services/superadmin.service';
import { AlertTriangle } from 'lucide-react';

interface SubscriptionChartProps {
  period: 'month' | '3months' | 'year';
}

const SubscriptionChart: React.FC<SubscriptionChartProps> = ({ period }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadChartData();
  }, [period]);
  
  const loadChartData = async () => {
    setLoading(true);
    
    try {
      const data = await getSubscriptionChartData(period);
      
      // Formatear datos para el gráfico
      const formattedData = data.dates.map((date, index) => ({
        date,
        newSubscriptions: data.values.newSubscriptions[index],
        renewals: data.values.renewals[index],
        total: data.values.total[index]
      }));
      
      setChartData(formattedData);
    } catch (err: any) {
      console.error('Error loading subscription chart data:', err);
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
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        barSize={20}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip 
          formatter={(value: number) => [`${value} suscripciones`, '']}
          labelFormatter={(label) => `Fecha: ${label}`}
        />
        <Legend />
        <Bar 
          name="Nuevas Suscripciones" 
          dataKey="newSubscriptions" 
          fill="#3B82F6" 
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          name="Renovaciones" 
          dataKey="renewals" 
          fill="#10B981" 
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          name="Total" 
          dataKey="total" 
          fill="#8B5CF6" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SubscriptionChart;