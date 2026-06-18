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
  onTrain: (_horseId: number) => void;
  className?: string;
}

const DashboardHorseCard = ({ horse, onTrain, className = '' }: DashboardHorseCardProps) => {
  const { id, name, age, trainingStatus, trainingCooldown, ineligibilityReason } = horse;

  // Status badge configuration
  const statusConfig = {
    ready: {
      text: 'Ready',
      bgColor: 'bg-[var(--role-success-bg)]',
      textColor: 'text-[var(--role-success-text)]',
      borderColor: 'border-[var(--role-success-border)]',
    },
    cooldown: {
      text: 'Cooldown',
      bgColor: 'bg-[var(--role-warning-bg)]',
      textColor: 'text-[var(--role-warning-text)]',
      borderColor: 'border-[var(--role-warning-border)]',
    },
    ineligible: {
      text: 'Ineligible',
      bgColor: 'bg-[var(--role-neutral-bg)]',
      textColor: 'text-role-secondary',
      borderColor: 'border-[var(--glass-border)]',
    },
  };

  const config = statusConfig[trainingStatus];

  return (
    <div
      className={`glass-panel rounded-lg border border-[var(--glass-border)] hover:border-[var(--glass-hover)] transition-shadow p-4 ${className}`}
      data-testid="horse-card"
    >
      {/* Header: Name and Status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{name}</h3>
          <p className="text-sm text-role-secondary">
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
          <p className="text-sm text-role-secondary">
            {ineligibilityReason || 'Not eligible for training'}
          </p>
        )}
      </div>

      {/* Action: Train button (only for ready horses) */}
      {trainingStatus === 'ready' && (
        <button
          onClick={() => onTrain(id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--electric-blue-700)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--gold-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--celestial-primary)] focus:ring-offset-2 transition-colors"
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
