/**
 * Summary Cards Component
 * Displays key metrics from transaction summary
 */

import React from 'react';
import { FiFileText, FiDollarSign, FiCheckCircle, FiXCircle, FiClock, FiTrendingUp } from 'react-icons/fi';
import Card from '../ui/Card';
import { TransactionSummary } from '../../types/report';

interface SummaryCardsProps {
  summary: TransactionSummary | null;
  loading?: boolean;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, loading = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} shadow="md">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const cards = [
    {
      title: 'Total Transactions',
      value: summary.total_count.toLocaleString(),
      icon: FiFileText,
      color: 'accent',
      bgColor: 'bg-accent-50',
    },
    {
      title: 'Total Amount',
      value: `PKR ${summary.total_amount.toLocaleString()}`,
      icon: FiDollarSign,
      color: 'primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Completed',
      value: summary.completed_count.toLocaleString(),
      subValue: `PKR ${summary.completed_amount.toLocaleString()}`,
      icon: FiCheckCircle,
      color: 'success',
      bgColor: 'bg-success-50',
    },
    {
      title: 'Pending',
      value: summary.pending_count.toLocaleString(),
      subValue: `PKR ${summary.pending_amount.toLocaleString()}`,
      icon: FiClock,
      color: 'warning',
      bgColor: 'bg-warning-50',
    },
    {
      title: 'Failed',
      value: summary.failed_count.toLocaleString(),
      subValue: `PKR ${summary.failed_amount.toLocaleString()}`,
      icon: FiXCircle,
      color: 'error',
      bgColor: 'bg-error-50',
    },
    {
      title: 'Avg. Amount',
      value: `PKR ${Math.round(summary.average_amount).toLocaleString()}`,
      icon: FiTrendingUp,
      color: 'accent',
      bgColor: 'bg-accent-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} hover shadow="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wide">
                {card.title}
              </p>
              <h3 className={`text-xl font-bold mt-1 text-${card.color}`}>
                {card.value}
              </h3>
              {card.subValue && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {card.subValue}
                </p>
              )}
            </div>
            <div className={`p-2 ${card.bgColor} rounded-lg`}>
              <card.icon className={`w-5 h-5 text-${card.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default SummaryCards;
