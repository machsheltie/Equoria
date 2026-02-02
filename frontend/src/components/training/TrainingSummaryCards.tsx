/**
 * Training Summary Cards Component
 *
 * Displays summary statistics for training dashboard:
 * - Ready to train count
 * - In cooldown count
 * - Ineligible count
 * - Percentage breakdowns
 *
 * Story 4.5: Training Dashboard - Task 2
 */

import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export interface TrainingSummary {
  readyCount: number;
  cooldownCount: number;
  ineligibleCount: number;
  totalHorses: number;
}

export interface TrainingSummaryCardsProps {
  summary: TrainingSummary;
  className?: string;
}

const TrainingSummaryCards = ({ summary, className = '' }: TrainingSummaryCardsProps) => {
  const { readyCount, cooldownCount, ineligibleCount, totalHorses } = summary;

  const readyPercentage = totalHorses > 0 ? Math.round((readyCount / totalHorses) * 100) : 0;
  const cooldownPercentage = totalHorses > 0 ? Math.round((cooldownCount / totalHorses) * 100) : 0;
  const ineligiblePercentage =
    totalHorses > 0 ? Math.round((ineligibleCount / totalHorses) * 100) : 0;

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}
      data-testid="summary-cards"
    >
      {/* Ready Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Ready to Train</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{readyCount}</p>
            <p className="text-sm text-slate-500 mt-1">{readyPercentage}% of total</p>
          </div>
          <CheckCircle2 className="h-12 w-12 text-green-500 opacity-20" aria-hidden="true" />
        </div>
      </div>

      {/* Cooldown Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">In Cooldown</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{cooldownCount}</p>
            <p className="text-sm text-slate-500 mt-1">{cooldownPercentage}% of total</p>
          </div>
          <Clock className="h-12 w-12 text-yellow-500 opacity-20" aria-hidden="true" />
        </div>
      </div>

      {/* Ineligible Card */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Ineligible</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{ineligibleCount}</p>
            <p className="text-sm text-slate-500 mt-1">{ineligiblePercentage}% of total</p>
          </div>
          <XCircle className="h-12 w-12 text-red-500 opacity-20" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

export default TrainingSummaryCards;
