/**
 * Status Pie Chart Component
 * Shows transaction status distribution
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatusBreakdown } from '../../../types/report';

interface StatusPieChartProps {
  data: Record<string, StatusBreakdown>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#16A34A',
  PENDING: '#F59E0B',
  PROCESSING: '#3B82F6',
  FAILED: '#DC2626',
  CANCELLED: '#6B7280',
  INITIATED: '#8B5CF6',
  REVERSED: '#EC4899',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  INITIATED: 'Initiated',
  REVERSED: 'Reversed',
};

const StatusPieChart: React.FC<StatusPieChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-text-secondary">No status data available</p>
      </div>
    );
  }

  const chartData = Object.entries(data)
    .filter(([, breakdown]) => breakdown.count > 0)
    .map(([status, breakdown]) => ({
      name: STATUS_LABELS[status] || status,
      value: breakdown.count,
      amount: breakdown.amount,
      color: STATUS_COLORS[status] || '#6B7280',
    }));

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show label for very small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value: number, name: string, props: { payload: { amount: number } }) => {
              return [
                <span key="value">
                  {value.toLocaleString()} transactions
                  <br />
                  <span className="text-text-secondary">
                    PKR {props.payload.amount.toLocaleString()}
                  </span>
                </span>,
                name,
              ];
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-sm text-text-primary">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatusPieChart;
