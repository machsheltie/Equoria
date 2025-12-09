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
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
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
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center text-sm text-slate-600">Loading age data...</div>
      </div>
    );
  }

  // Error state
  if (isError || !ageData) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="text-sm text-rose-800">
          {error?.message || 'Failed to fetch age data'}
        </div>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
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
        className="w-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">Age-Up Counter</h3>

        {/* Current Age */}
        <div className="mt-4">
          <p className="text-sm text-slate-600">Current Age</p>
          <p className="text-2xl font-bold text-slate-900">
            {ageData.currentAge.years} years, {ageData.currentAge.months} months
          </p>
        </div>

        {/* No milestone message */}
        <div className="mt-6 rounded-md bg-slate-100 p-4 text-center">
          <p className="text-sm text-slate-700">
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
      className="w-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* Header */}
      <h3 className="text-lg font-semibold text-slate-900">Age-Up Counter</h3>

      {/* Current Age */}
      <div className="mt-4 relative">
        <p className="text-sm text-slate-600">Current Age</p>
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowAgeTooltip(true)}
          onMouseLeave={() => setShowAgeTooltip(false)}
        >
          <p className="text-2xl font-bold text-slate-900">
            {ageData.currentAge.years} years, {ageData.currentAge.months} months
          </p>
          {showAgeTooltip && (
            <div className="absolute z-10 mt-1 rounded-md bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
              Current age in game
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">({ageData.ageInDays} days old)</p>
      </div>

      {/* Next Milestone */}
      <div className="mt-6">
        <p className="text-sm text-slate-600">Next Milestone</p>
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowMilestoneTooltip(true)}
          onMouseLeave={() => setShowMilestoneTooltip(false)}
        >
          <p data-testid="milestone-name" className="text-xl font-semibold text-emerald-600">
            {nextMilestone.name} ({nextMilestone.ageYears} years)
          </p>
          {showMilestoneTooltip && (
            <div className="absolute z-10 mt-1 rounded-md bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
              Next age milestone
            </div>
          )}
        </div>

        {/* Countdown */}
        <div
          className={`mt-2 rounded-md p-3 ${
            isNearMilestone ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
          }`}
        >
          <p
            data-testid="time-remaining"
            className={`text-lg font-semibold ${
              isNearMilestone ? 'text-amber-700' : 'text-slate-700'
            }`}
          >
            {formatCountdown(nextMilestone.monthsRemaining, nextMilestone.daysRemaining)}
          </p>
          <p data-testid="days-remaining" className="text-xs text-slate-500">
            ({nextMilestone.daysRemaining} days)
          </p>

          {isNearMilestone && (
            <p className="mt-2 text-xs text-amber-700">
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
            <p className="text-sm text-slate-600">Expected Stat Changes</p>
            {showStatTooltip && (
              <div className="absolute z-10 mt-1 rounded-md bg-slate-800 px-3 py-2 text-xs text-white shadow-lg whitespace-nowrap">
                Stats will change when horse ages up
              </div>
            )}
          </div>
          <button
            onClick={() => setShowStatDetails(!showStatDetails)}
            className="text-sm text-blue-600 hover:text-blue-700"
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
                ? 'text-emerald-600'
                : isLoss
                  ? 'text-rose-600'
                  : 'text-slate-600';

              return (
                <div key={stat} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-700">
                    {stat}
                  </span>
                  <span className={`font-semibold ${colorClass}`}>
                    {value > 0 ? '+' : ''}{value}
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
              ? 'bg-blue-50 border-blue-200'
              : trainingWindow.windowName === 'Too Young'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <Info
              className={`h-5 w-5 mt-0.5 ${
                trainingWindow.isPrimeWindow
                  ? 'text-blue-600'
                  : trainingWindow.windowName === 'Too Young'
                    ? 'text-amber-600'
                    : 'text-slate-600'
              }`}
              aria-hidden="true"
            />
            <div>
              <p
                className={`text-sm font-semibold ${
                  trainingWindow.isPrimeWindow
                    ? 'text-blue-900'
                    : trainingWindow.windowName === 'Too Young'
                      ? 'text-amber-900'
                      : 'text-slate-900'
                }`}
              >
                {trainingWindow.windowName}
              </p>
              {trainingWindow.isPrimeWindow && trainingWindow.endsInDays !== null && (
                <p className="text-xs text-blue-700 mt-1">
                  Prime training window ends in {trainingWindow.endsInDays} days
                </p>
              )}
              {trainingWindow.windowName === 'Too Young' && trainingWindow.endsInDays !== null && (
                <p className="text-xs text-amber-700 mt-1">
                  Horse is too young to train effectively. Wait {trainingWindow.endsInDays} days.
                </p>
              )}
              {!trainingWindow.isPrimeWindow && trainingWindow.windowName !== 'Too Young' && (
                <p className="text-xs text-slate-700 mt-1">
                  Focus on maintaining current fitness and skills.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Educational Tooltip */}
      <div className="mt-6 rounded-md bg-slate-50 p-4 border border-slate-200">
        <div className="flex items-start gap-2">
          <Info
            className="h-4 w-4 text-slate-600 mt-0.5"
            aria-label="Age mechanics information"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-700">Age Mechanics:</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
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
