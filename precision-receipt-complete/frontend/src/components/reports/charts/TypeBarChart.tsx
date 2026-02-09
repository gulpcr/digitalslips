/**
 * Type Bar Chart Component
 * Shows transactions grouped by type
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TypeBreakdown } from '../../../types/report';

interface TypeBarChartProps {
  data: Record<string, TypeBreakdown>;
  loading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  CASH_DEPOSIT: 'Cash Deposit',
  CHEQUE_DEPOSIT: 'Cheque Deposit',
  PAY_ORDER: 'Pay Order',
  BILL_PAYMENT: 'Bill Payment',
  FUND_TRANSFER: 'Fund Transfer',
};

const TYPE_COLORS: Record<string, string> = {
  CASH_DEPOSIT: '#00A7FF',
  CHEQUE_DEPOSIT: '#0B1F3B',
  PAY_ORDER: '#16A34A',
  BILL_PAYMENT: '#F59E0B',
  FUND_TRANSFER: '#8B5CF6',
};

const TypeBarChart: React.FC<TypeBarChartProps> = ({ data, loading = false }) => {
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
        <p className="text-text-secondary">No type data available</p>
      </div>
    );
  }

  const chartData = Object.entries(data).map(([type, breakdown]) => ({
    type: TYPE_LABELS[type] || type,
    count: breakdown.count,
    amount: breakdown.amount,
    fill: TYPE_COLORS[type] || '#6B7280',
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 11, fill: '#475569' }}
            tickLine={{ stroke: '#E5E7EB' }}
            angle={-15}
            textAnchor="end"
            height={60}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#475569' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#475569' }}
            tickLine={{ stroke: '#E5E7EB' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
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
          <Bar
            yAxisId="left"
            dataKey="count"
            name="Count"
            fill="#00A7FF"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="amount"
            name="Amount"
            fill="#0B1F3B"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TypeBarChart;
