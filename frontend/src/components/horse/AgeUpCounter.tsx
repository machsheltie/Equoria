/**
 * AgeUpCounter Component
 *
 * Displays horse age, milestone prediction, and stat expectations:
 * - Current age with visual indicators
 * - Next milestone countdown
 * - Expected stat gains/losses
 * - Training window status
 * - Educational tooltips
 *
 * Story 3-4: XP & Progression Display - Task 4
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { useHorseAge } from '@/hooks/api/useHorseAge';

interface AgeUpCounterProps {
  horseId: number;
}

const AgeUpCounter = ({ horseId }: AgeUpCounterProps) => {
  const { data: ageData, isLoading, error, isError, refetch } = useHorseAge(horseId);
  const [showStatDetails, setShowStatDetails] = useState(false);
  const [showAgeTooltip, setShowAgeTooltip] = useState(false);
  const [showMilestoneTooltip, setShowMilestoneTooltip] = useState(false);
  const [showStatTooltip, setShowStatTooltip] = useState(false);

  // Helper function to format countdown
  const formatCountdown = (monthsRemaining: number, daysRemaining: number): string => {
    if (monthsRemaining >= 12) {
      const years = Math.floor(monthsRemaining / 12);
      const months = monthsRemaining % 12;
      return months > 0 ? `${years}y ${months}m` : `${years} years`;
    }
    return monthsRemaining > 0 ? `${monthsRemaining} months` : `${daysRemaining} days`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">Loading age data...</div>
      </div>
    );
  }

  // Error state
  if (isError || !ageData) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-6 shadow-sm">
        <div className="text-sm text-rose-400">{error?.message || 'Failed to fetch age data'}</div>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state - no next milestone
  if (!ageData.nextMilestone) {
    return (
      <div
        data-testid="age-up-counter"
        className="w-full flex-col rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Age-Up Counter</h3>

        {/* Current Age */}
        <div className="mt-4">
          <p className="text-sm text-[rgb(148,163,184)]">Current Age</p>
          <p className="text-2xl font-bold text-[rgb(220,235,255)]">
            {ageData.currentAge.years} years, {ageData.currentAge.months} months
          </p>
        </div>

        {/* No milestone message */}
        <div className="mt-6 rounded-md bg-[rgba(15,35,70,0.4)] p-4 text-center">
          <p className="text-sm text-[rgb(148,163,184)]">
            Horse has reached full maturity. No more milestone stat gains expected.
          </p>
        </div>
      </div>
    );
  }

  const { nextMilestone, trainingWindow } = ageData;
  const isNearMilestone = nextMilestone.daysRemaining < 30;

  return (
    <div
      data-testid="age-up-counter"
      className="w-full flex-col rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm"
    >
      {/* Header */}
      <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Age-Up Counter</h3>

      {/* Current Age */}
      <div className="mt-4 relative">
        <p className="text-sm text-[rgb(148,163,184)]">Current Age</p>
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowAgeTooltip(true)}
          onMouseLeave={() => setShowAgeTooltip(false)}
        >
          <p className="text-2xl font-bold text-[rgb(220,235,255)]">
            {ageData.currentAge.years} years, {ageData.currentAge.months} months
          </p>
          {showAgeTooltip && (
            <div className="absolute z-[var(--z-raised)] mt-1 rounded-md bg-[rgba(10,22,40,0.95)] px-3 py-2 text-xs text-[rgb(220,235,255)] shadow-lg border border-[rgba(37,99,235,0.3)]">
              Current age in game
            </div>
          )}
        </div>
        <p className="text-xs text-[rgb(148,163,184)]">({ageData.ageInDays} days old)</p>
      </div>

      {/* Next Milestone */}
      <div className="mt-6">
        <p className="text-sm text-[rgb(148,163,184)]">Next Milestone</p>
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowMilestoneTooltip(true)}
          onMouseLeave={() => setShowMilestoneTooltip(false)}
        >
          <p data-testid="milestone-name" className="text-xl font-semibold text-emerald-400">
            {nextMilestone.name} ({nextMilestone.ageYears} years)
          </p>
          {showMilestoneTooltip && (
            <div className="absolute z-[var(--z-raised)] mt-1 rounded-md bg-[rgba(10,22,40,0.95)] px-3 py-2 text-xs text-[rgb(220,235,255)] shadow-lg border border-[rgba(37,99,235,0.3)]">
              Next age milestone
            </div>
          )}
        </div>

        {/* Countdown */}
        <div
          className={`mt-2 rounded-md p-3 ${
            isNearMilestone
              ? 'bg-[rgba(212,168,67,0.1)] border border-[rgba(212,168,67,0.3)]'
              : 'bg-[rgba(15,35,70,0.4)]'
          }`}
        >
          <p
            data-testid="time-remaining"
            className={`text-lg font-semibold ${
              isNearMilestone ? 'text-amber-400' : 'text-[rgb(220,235,255)]'
            }`}
          >
            {formatCountdown(nextMilestone.monthsRemaining, nextMilestone.daysRemaining)}
          </p>
          <p data-testid="days-remaining" className="text-xs text-[rgb(148,163,184)]">
            ({nextMilestone.daysRemaining} days)
          </p>

          {isNearMilestone && (
            <p className="mt-2 text-xs text-amber-400">
              ⚠️ Milestone approaching soon! Plan training accordingly.
            </p>
          )}
        </div>
      </div>

      {/* Expected Stat Gains */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div
            className="relative inline-block"
            onMouseEnter={() => setShowStatTooltip(true)}
            onMouseLeave={() => setShowStatTooltip(false)}
          >
            <p className="text-sm text-[rgb(148,163,184)]">Expected Stat Changes</p>
            {showStatTooltip && (
              <div className="absolute z-[var(--z-raised)] mt-1 rounded-md bg-[rgba(10,22,40,0.95)] px-3 py-2 text-xs text-[rgb(220,235,255)] shadow-lg border border-[rgba(37,99,235,0.3)] whitespace-nowrap">
                Stats will change when horse ages up
              </div>
            )}
          </div>
          <button
            onClick={() => setShowStatDetails(!showStatDetails)}
            className="text-sm text-blue-400 hover:text-blue-300"
            aria-label={showStatDetails ? 'Hide stat details' : 'Show stat details'}
            aria-expanded={showStatDetails}
          >
            {showStatDetails ? 'Hide Details' : 'View Stat Gains'}
          </button>
        </div>

        {showStatDetails && (
          <div className="mt-3 space-y-2">
            {Object.entries(nextMilestone.expectedStatGains).map(([stat, value]) => {
              const isGain = value > 0;
              const isLoss = value < 0;
              const colorClass = isGain
                ? 'text-emerald-400'
                : isLoss
                  ? 'text-rose-400'
                  : 'text-[rgb(148,163,184)]';

              return (
                <div key={stat} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-[rgb(148,163,184)]">{stat}</span>
                  <span className={`font-semibold ${colorClass}`}>
                    {value > 0 ? '+' : ''}
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Training Window */}
      {trainingWindow && (
        <div
          className={`mt-6 rounded-md p-4 border ${
            trainingWindow.isPrimeWindow
              ? 'bg-[rgba(37,99,235,0.1)] border-blue-500/30'
              : trainingWindow.windowName === 'Too Young'
                ? 'bg-[rgba(212,168,67,0.1)] border-[rgba(212,168,67,0.3)]'
                : 'bg-[rgba(15,35,70,0.4)] border-[rgba(37,99,235,0.3)]'
          }`}
        >
          <div className="flex items-start gap-2">
            <Info
              className={`h-5 w-5 mt-0.5 ${
                trainingWindow.isPrimeWindow
                  ? 'text-blue-400'
                  : trainingWindow.windowName === 'Too Young'
                    ? 'text-amber-400'
                    : 'text-[rgb(148,163,184)]'
              }`}
              aria-hidden="true"
            />
            <div>
              <p
                className={`text-sm font-semibold ${
                  trainingWindow.isPrimeWindow
                    ? 'text-blue-300'
                    : trainingWindow.windowName === 'Too Young'
                      ? 'text-amber-300'
                      : 'text-[rgb(220,235,255)]'
                }`}
              >
                {trainingWindow.windowName}
              </p>
              {trainingWindow.isPrimeWindow && trainingWindow.endsInDays !== null && (
                <p className="text-xs text-blue-400 mt-1">
                  Prime training window ends in {trainingWindow.endsInDays} days
                </p>
              )}
              {trainingWindow.windowName === 'Too Young' && trainingWindow.endsInDays !== null && (
                <p className="text-xs text-amber-400 mt-1">
                  Horse is too young to train effectively. Wait {trainingWindow.endsInDays} days.
                </p>
              )}
              {!trainingWindow.isPrimeWindow && trainingWindow.windowName !== 'Too Young' && (
                <p className="text-xs text-[rgb(148,163,184)] mt-1">
                  Focus on maintaining current fitness and skills.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Educational Tooltip */}
      <div className="mt-6 rounded-md bg-[rgba(15,35,70,0.4)] p-4 border border-[rgba(37,99,235,0.3)]">
        <div className="flex items-start gap-2">
          <Info
            className="h-4 w-4 text-[rgb(148,163,184)] mt-0.5"
            aria-label="Age mechanics information"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[rgb(220,235,255)]">Age Mechanics:</p>
            <ul className="mt-2 space-y-1 text-xs text-[rgb(148,163,184)]">
              <li>• Horses age up at specific milestones (2, 4, 7, 15 years)</li>
              <li>• Each milestone brings permanent stat changes</li>
              <li>• Some stats increase (maturity), others decrease (aging)</li>
              <li>• Training is most effective during prime years (2-7)</li>
              <li>• Horses gain stats rapidly when young and lose them in old age</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeUpCounter;
