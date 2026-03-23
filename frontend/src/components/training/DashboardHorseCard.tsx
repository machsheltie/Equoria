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
      bgColor: 'bg-[rgba(16,185,129,0.1)]',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
    },
    cooldown: {
      text: 'Cooldown',
      bgColor: 'bg-[rgba(212,168,67,0.1)]',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/30',
    },
    ineligible: {
      text: 'Ineligible',
      bgColor: 'bg-[rgba(15,35,70,0.5)]',
      textColor: 'text-[rgb(148,163,184)]',
      borderColor: 'border-[rgba(37,99,235,0.2)]',
    },
  };

  const config = statusConfig[trainingStatus];

  return (
    <div
      className={`glass-panel rounded-lg border border-[rgba(37,99,235,0.2)] hover:border-[rgba(37,99,235,0.4)] transition-shadow p-4 ${className}`}
      data-testid="horse-card"
    >
      {/* Header: Name and Status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">{name}</h3>
          <p className="text-sm text-[rgb(148,163,184)]">
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
          <p className="text-sm text-[rgb(148,163,184)]">
            {ineligibilityReason || 'Not eligible for training'}
          </p>
        )}
      </div>

      {/* Action: Train button (only for ready horses) */}
      {trainingStatus === 'ready' && (
        <button
          onClick={() => onTrain(id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-[var(--text-primary)] rounded-lg hover:bg-[var(--gold-dim)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
