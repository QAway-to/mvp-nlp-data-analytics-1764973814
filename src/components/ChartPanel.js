import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  Line,
  Bar,
  Pie,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4'];

const CHART_TYPES = [
  { id: 'bar', label: '📊 Столбчатая', icon: '📊' },
  { id: 'line', label: '📈 Линейная', icon: '📈' },
  { id: 'pie', label: '🥧 Круговая', icon: '🥧' },
  { id: 'scatter', label: '🔵 Точечная', icon: '🔵' }
];

export default function ChartPanel({ data, onChartTypeChange }) {
  const [activeChartType, setActiveChartType] = useState(data?.type || 'bar');

  if (!data || !data.data || data.data.length === 0) {
    return <p style={{ color: '#94a3b8' }}>Нет данных для графика</p>;
  }

  const handleChartTypeChange = (type) => {
    setActiveChartType(type);
    if (onChartTypeChange) {
      onChartTypeChange(type);
    }
  };

  const chartType = activeChartType;

  // Определяем доступные типы графиков на основе данных
  const availableTypes = CHART_TYPES.filter(type => {
    if (type.id === 'scatter') {
      // Scatter требует числовые данные для обеих осей
      return data.xKey && data.yKey && data.data.every(d => 
        !isNaN(parseFloat(d[data.xKey])) && !isNaN(parseFloat(d[data.yKey]))
      );
    }
    if (type.id === 'pie') {
      // Pie требует категориальные данные
      return data.data.length > 0 && data.yKey;
    }
    return true; // bar и line доступны всегда
  });

  // Если выбранный тип недоступен, выбираем первый доступный
  const finalChartType = availableTypes.some(t => t.id === chartType) 
    ? chartType 
    : (availableTypes[0]?.id || 'bar');

  // Табы для переключения типов графиков
  const renderTabs = () => (
    <div style={{
      display: 'flex',
      gap: 8,
      marginBottom: 16,
      borderBottom: '1px solid #334155',
      paddingBottom: 8
    }}>
      {availableTypes.map(type => (
        <button
          key={type.id}
          onClick={() => handleChartTypeChange(type.id)}
          style={{
            padding: '8px 16px',
            background: finalChartType === type.id 
              ? 'rgba(99, 102, 241, 0.2)' 
              : 'transparent',
            border: finalChartType === type.id 
              ? '1px solid #6366f1' 
              : '1px solid transparent',
            borderRadius: 8,
            color: finalChartType === type.id ? '#f8fafc' : '#94a3b8',
            fontSize: 13,
            fontWeight: finalChartType === type.id ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onMouseEnter={(e) => {
            if (finalChartType !== type.id) {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (finalChartType !== type.id) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span>{type.icon}</span>
          <span>{type.label.replace(/^[^\s]+\s/, '')}</span>
        </button>
      ))}
    </div>
  );

  // Pie chart
  if (finalChartType === 'pie') {
    return (
      <div style={{ width: '100%' }}>
        {renderTabs()}
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data.data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey={data.yKey || 'value'}
            >
              {data.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#f8fafc'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Scatter chart
  if (finalChartType === 'scatter') {
    return (
      <div style={{ width: '100%' }}>
        {renderTabs()}
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
          <ScatterChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              type="number"
              dataKey={data.xKey || 'x'} 
              stroke="#94a3b8"
              style={{ fontSize: 12 }}
            />
            <YAxis 
              type="number"
              dataKey={data.yKey || 'y'}
              stroke="#94a3b8"
              style={{ fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#f8fafc'
              }}
            />
            <Scatter 
              dataKey={data.yKey || 'y'} 
              fill="#6366f1"
              fillOpacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Line and Bar charts
  const ChartComponent = finalChartType === 'line' ? LineChart : BarChart;
  const DataComponent = finalChartType === 'line' ? Line : Bar;

  return (
    <div style={{ width: '100%' }}>
      {renderTabs()}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
        <ChartComponent data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey={data.xKey || 'date'} 
            stroke="#94a3b8"
            style={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="#94a3b8"
            style={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f8fafc'
            }}
          />
          <Legend />
          <DataComponent
            type="monotone"
            dataKey={data.yKey || 'value'}
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.6}
          />
        </ChartComponent>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

