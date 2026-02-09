/**
 * Trend Line Chart Component
 * Shows transaction volume trends over time
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendDataPoint } from '../../../types/report';

interface TrendLineChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
}

const TrendLineChart: React.FC<TrendLineChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-text-secondary">No trend data available</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
          <XAxis
            dataKey="period_label"
            tick={{ fontSize: 12, fill: '#6B6B6B' }}
            tickLine={{ stroke: '#E0E0E0' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#6B6B6B' }}
            tickLine={{ stroke: '#E0E0E0' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6B6B6B' }}
            tickLine={{ stroke: '#E0E0E0' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'Amount') {
                return [`PKR ${value.toLocaleString()}`, name];
              }
              return [value.toLocaleString(), name];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="transaction_count"
            name="Transactions"
            stroke="#5F2585"
            strokeWidth={2}
            dot={{ fill: '#5F2585', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total_amount"
            name="Amount"
            stroke="#2A7A5F"
            strokeWidth={2}
            dot={{ fill: '#2A7A5F', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="completed_count"
            name="Completed"
            stroke="#16A34A"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="failed_count"
            name="Failed"
            stroke="#DC2626"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendLineChart;
