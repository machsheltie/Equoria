/**
 * ConformationScoreCard Component
 *
 * Displays a single conformation region score with:
 * - Region name and description tooltip
 * - Numeric score (XX/100)
 * - Quality rating badge (color-coded: Excellent/Good/Poor)
 * - Progress bar visualization
 * - Breed comparison indicator (optional)
 * - Hover/click interactions
 *
 * Story 3-5: Conformation Scoring UI - Task 2
 */

import { Info } from 'lucide-react';
import {
  getQualityRating,
  formatScore,
  getBreedComparison,
  getRegionDescription,
  getRegionDisplayName,
  getScoreColor,
} from '@/lib/utils/conformation-utils';

export interface ConformationScoreCardProps {
  region: string;
  score: number;
  breedAverage?: number;
  showComparison?: boolean;
  onRegionClick?: (region: string) => void;
  className?: string;
}

const ConformationScoreCard = ({
  region,
  score,
  breedAverage,
  showComparison = false,
  onRegionClick,
  className = '',
}: ConformationScoreCardProps) => {
  const qualityRating = getQualityRating(score);
  const displayName = getRegionDisplayName(region);
  const description = getRegionDescription(region);
  const scoreColor = getScoreColor(score);

  // Only show comparison if enabled and breed average is provided
  const shouldShowComparison = showComparison && breedAverage !== undefined;
  const comparison = shouldShowComparison ? getBreedComparison(score, breedAverage!) : null;

  const handleClick = () => {
    if (onRegionClick) {
      onRegionClick(region);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 bg-white transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        onRegionClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onRegionClick ? 'button' : undefined}
      tabIndex={onRegionClick ? 0 : undefined}
      aria-label={`${displayName} conformation score: ${formatScore(score)}, ${qualityRating.label}`}
      data-testid={`conformation-score-card-${region}`}
    >
      {/* Header: Region Name + Quality Badge */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold text-slate-900">{displayName}</h4>
          <div className="group relative">
            <Info className="h-4 w-4 text-slate-400 hover:text-slate-600" aria-hidden="true" />
            <div className="absolute left-0 top-6 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <p>{description}</p>
              <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 transform rotate-45" />
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded border ${qualityRating.bgColor} ${qualityRating.color}`}
          data-testid={`quality-badge-${region}`}
        >
          {qualityRating.label}
        </span>
      </div>

      {/* Score Display */}
      <div className="flex items-baseline gap-1 mb-3" data-testid={`score-display-${region}`}>
        <span className="text-3xl font-bold text-slate-900">{Math.round(score)}</span>
        <span className="text-lg text-slate-500">/100</span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-500 ${scoreColor}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${displayName} score progress`}
        />
      </div>

      {/* Breed Comparison (Optional) */}
      {shouldShowComparison && comparison && (
        <div
          className={`flex items-center gap-2 text-sm ${
            comparison.label === 'Above Average'
              ? 'text-emerald-700'
              : comparison.label === 'Below Average'
                ? 'text-rose-700'
                : 'text-slate-600'
          }`}
          data-testid={`breed-comparison-${region}`}
        >
          <span className="font-semibold" aria-hidden="true">
            {comparison.icon}
          </span>
          <span>
            {comparison.label}
            {comparison.difference !== 0 && (
              <span className="ml-1 font-medium">
                ({comparison.difference > 0 ? '+' : ''}
                {comparison.difference.toFixed(1)})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Breed Average Display (when not showing comparison) */}
      {!shouldShowComparison && breedAverage !== undefined && (
        <div className="text-xs text-slate-500" data-testid={`breed-average-${region}`}>
          Breed avg: {formatScore(breedAverage)}
        </div>
      )}
    </div>
  );
};

export default ConformationScoreCard;
