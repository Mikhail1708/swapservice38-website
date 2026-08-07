'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
}

export function StatsCard({ title, value, icon, trend, subtitle }: StatsCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
        {trend !== undefined && (
          <div
            className={`
                flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
                ${isPositive ? 'text-green-700 bg-green-50' : ''}
                ${isNegative ? 'text-red-700 bg-red-50' : ''}
                ${trend === 0 ? 'text-gray-500 bg-gray-100' : ''}
              `}
          >
            {isPositive && <TrendingUp size={14} />}
            {isNegative && <TrendingDown size={14} />}
            {trend > 0 && `+${trend}%`}
            {trend < 0 && `${trend}%`}
            {trend === 0 && '0%'}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}