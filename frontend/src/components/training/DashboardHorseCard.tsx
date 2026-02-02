/**
 * Dashboard Horse Card Component
 *
 * Displays individual horse information in the training dashboard
 * Shows status, age, and actions based on training eligibility
 *
 * Story 4.5: Training Dashboard - Task 3
 */

import { Dumbbell } from 'lucide-react';
import CooldownCountdown from './CooldownCountdown';

export interface DashboardHorse {
  id: number;
  name: string;
  age: number;
  trainingStatus: 'ready' | 'cooldown' | 'ineligible';
  trainingCooldown?: string;
  ineligibilityReason?: string;
}

export interface DashboardHorseCardProps {
  horse: DashboardHorse;
  onTrain: (horseId: number) => void;
  className?: string;
}

const DashboardHorseCard = ({ horse, onTrain, className = '' }: DashboardHorseCardProps) => {
  const { id, name, age, trainingStatus, trainingCooldown, ineligibilityReason } = horse;

  // Status badge configuration
  const statusConfig = {
    ready: {
      text: 'Ready',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-500',
    },
    cooldown: {
      text: 'Cooldown',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-800',
      borderColor: 'border-amber-500',
    },
    ineligible: {
      text: 'Ineligible',
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-700',
      borderColor: 'border-slate-400',
    },
  };

  const config = statusConfig[trainingStatus];

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 ${className}`}
      data-testid="horse-card"
    >
      {/* Header: Name and Status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-600">
            {age} {age === 1 ? 'year' : 'years'} old
          </p>
        </div>

        {/* Status Badge */}
        <div
          className={`px-2 py-1 rounded text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
          data-testid="status-badge"
          role="status"
        >
          {config.text}
        </div>
      </div>

      {/* Status-specific content */}
      <div className="mb-3">
        {/* Cooldown: Show countdown */}
        {trainingStatus === 'cooldown' && trainingCooldown && (
          <CooldownCountdown endsAt={trainingCooldown} />
        )}

        {/* Ineligible: Show reason */}
        {trainingStatus === 'ineligible' && (
          <p className="text-sm text-slate-600">
            {ineligibilityReason || 'Not eligible for training'}
          </p>
        )}
      </div>

      {/* Action: Train button (only for ready horses) */}
      {trainingStatus === 'ready' && (
        <button
          onClick={() => onTrain(id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          data-testid="train-button"
          aria-label={`Train ${name}`}
        >
          <Dumbbell className="h-4 w-4" aria-hidden="true" />
          <span>Train</span>
        </button>
      )}
    </div>
  );
};

export default DashboardHorseCard;
