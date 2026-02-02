/**
 * PerformanceBreakdown Component
 *
 * Displays detailed score breakdown for a horse's competition performance.
 * Features:
 * - Header with horse/competition info, placement badge, and score
 * - Visual score breakdown chart
 * - Detailed breakdown list with all components
 * - Comparison section (vs average, vs winner, percentile)
 * - Insights and improvement suggestions
 *
 * Story 5-2: Competition Results Display - Performance Breakdown
 */

import React, { memo, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Zap,
  Award,
  Info,
  Lightbulb,
  Heart,
  Dumbbell,
  Target,
  Briefcase,
  User,
  Sparkles,
} from 'lucide-react';
import ScoreBreakdownChart from './ScoreBreakdownChart';

/**
 * Individual trait bonus in the score breakdown
 */
export interface TraitBonus {
  trait: string;
  bonus: number;
}

/**
 * Score breakdown data structure
 * Contains all components that contribute to the final competition score
 */
export interface ScoreBreakdown {
  /** Base stats contribution (speed/stamina/agility with 50/30/20 weighting) */
  baseScore: {
    speed: number;
    stamina: number;
    agility: number;
    total: number;
  };
  /** Training bonus points */
  trainingBonus: number;
  /** List of trait bonuses (can be positive or negative) */
  traitBonuses: TraitBonus[];
  /** Equipment bonus breakdown */
  equipmentBonuses: {
    saddle: number;
    bridle: number;
    total: number;
  };
  /** Rider effect (can be positive bonus or negative penalty) */
  riderEffect: number;
  /** Health modifier (percentage adjustment based on rating) */
  healthModifier: number;
  /** Random luck factor (plus or minus 9%) */
  randomLuck: number;
  /** Total final score */
  total: number;
}

/**
 * Comparison data for context
 */
export interface ComparisonData {
  averageScore: number;
  winnerScore: number;
  winnerName: string;
}

/**
 * Props for PerformanceBreakdown component
 */
export interface PerformanceBreakdownProps {
  horseId: number;
  horseName: string;
  competitionId: number;
  competitionName: string;
  discipline: string;
  rank: number;
  totalParticipants: number;
  finalScore: number;
  prizeWon: number;
  xpGained: number;
  scoreBreakdown: ScoreBreakdown;
  comparisonData?: ComparisonData;
  className?: string;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format number with sign
 */
const formatWithSign = (value: number, decimals: number = 1): string => {
  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
};

/**
 * Get ordinal suffix for a number
 */
const getOrdinalSuffix = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-yellow-400 text-yellow-900'; // Gold
    case 2:
      return 'bg-gray-300 text-gray-900'; // Silver
    case 3:
      return 'bg-orange-400 text-orange-900'; // Bronze
    default:
      return 'bg-gray-200 text-gray-700'; // Other
  }
};

/**
 * Get placement icon based on rank
 */
const PlacementIcon = memo(({ rank }: { rank: number }) => {
  if (rank === 1) return <Trophy className="h-4 w-4" aria-hidden="true" />;
  if (rank <= 3) return <Medal className="h-4 w-4" aria-hidden="true" />;
  return <Star className="h-4 w-4" aria-hidden="true" />;
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * Placement badge component
 */
const PlacementBadge = memo(({ rank }: { rank: number }) => {
  const badgeClasses = getPlacementBadgeClasses(rank);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${badgeClasses}`}
      data-testid="placement-badge"
    >
      <PlacementIcon rank={rank} />
      {getOrdinalSuffix(rank)}
    </span>
  );
});

PlacementBadge.displayName = 'PlacementBadge';

/**
 * Value display component with color coding
 */
const ValueDisplay = memo(({
  value,
  testId,
  showSign = true,
  decimals = 0,
}: {
  value: number;
  testId?: string;
  showSign?: boolean;
  decimals?: number;
}) => {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-600';

  const displayValue = showSign
    ? formatWithSign(value, decimals)
    : value.toFixed(decimals);

  return (
    <span className={`font-semibold ${colorClass}`} data-testid={testId}>
      {displayValue}
    </span>
  );
});

ValueDisplay.displayName = 'ValueDisplay';

/**
 * Difference indicator with arrow
 */
const DiffIndicator = memo(({
  diff,
  testId,
}: {
  diff: number;
  testId: string;
}) => {
  const isPositive = diff > 0;
  const isNegative = diff < 0;

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-500'
      }`}
      data-testid={testId}
    >
      {isPositive && <TrendingUp className="h-4 w-4" aria-hidden="true" />}
      {isNegative && <TrendingDown className="h-4 w-4" aria-hidden="true" />}
      {diff === 0 && <Minus className="h-4 w-4" aria-hidden="true" />}
      <span className="font-medium">
        {formatWithSign(diff, 1)}
      </span>
    </span>
  );
});

DiffIndicator.displayName = 'DiffIndicator';

/**
 * Breakdown row component
 */
const BreakdownRow = memo(({
  icon: Icon,
  label,
  value,
  sublabel,
  testId,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  sublabel?: string;
  testId?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0">
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
      </div>
    </div>
    <div className="text-right">
      {value !== undefined && <ValueDisplay value={value} testId={testId} showSign decimals={1} />}
      {children}
    </div>
  </div>
));

BreakdownRow.displayName = 'BreakdownRow';

/**
 * PerformanceBreakdown Component
 *
 * Displays a comprehensive breakdown of a horse's competition performance
 * with visual chart, detailed components, comparisons, and insights.
 */
const PerformanceBreakdown: React.FC<PerformanceBreakdownProps> = ({
  horseId,
  horseName,
  competitionId,
  competitionName,
  discipline,
  rank,
  totalParticipants,
  finalScore,
  prizeWon,
  xpGained,
  scoreBreakdown,
  comparisonData,
  className = '',
}) => {
  // Calculate percentile ranking
  const percentile = useMemo(() => {
    return ((totalParticipants - rank + 1) / totalParticipants) * 100;
  }, [rank, totalParticipants]);

  // Calculate comparison differences
  const avgDiff = useMemo(() => {
    if (!comparisonData) return 0;
    return finalScore - comparisonData.averageScore;
  }, [finalScore, comparisonData]);

  const winnerDiff = useMemo(() => {
    if (!comparisonData) return 0;
    return finalScore - comparisonData.winnerScore;
  }, [finalScore, comparisonData]);

  // Generate insights based on performance
  const insights = useMemo(() => {
    const suggestions: string[] = [];
    const { baseScore, trainingBonus, equipmentBonuses, riderEffect, healthModifier } = scoreBreakdown;

    // Check for low base stats
    const lowestStat = [
      { name: 'Speed', value: baseScore.speed },
      { name: 'Stamina', value: baseScore.stamina },
      { name: 'Agility', value: baseScore.agility },
    ].sort((a, b) => a.value - b.value)[0];

    if (lowestStat.value < 60) {
      suggestions.push(`Focus training on ${lowestStat.name} (currently ${lowestStat.value}) to improve base stats.`);
    }

    // Check for low training bonus
    if (trainingBonus < 10) {
      suggestions.push('Increase discipline-specific training to gain more training bonuses.');
    }

    // Check for missing equipment
    if (equipmentBonuses.total === 0) {
      suggestions.push('Consider upgrading equipment - saddle and bridle can provide significant bonuses.');
    } else if (equipmentBonuses.saddle === 0 || equipmentBonuses.bridle === 0) {
      suggestions.push('Upgrade missing equipment to maximize your equipment bonuses.');
    }

    // Check rider effect
    if (riderEffect < 0) {
      suggestions.push('Work on rider skills to convert the penalty into a bonus.');
    }

    // Check health
    if (healthModifier < -5) {
      suggestions.push('Improve horse health before the next competition to avoid performance penalties.');
    }

    return suggestions;
  }, [scoreBreakdown]);

  // Calculate total trait bonus
  const totalTraitBonus = useMemo(() => {
    return scoreBreakdown.traitBonuses.reduce((sum, tb) => sum + tb.bonus, 0);
  }, [scoreBreakdown.traitBonuses]);

  return (
    <div
      className={`bg-white rounded-lg shadow-lg ${className}`}
      data-testid="performance-breakdown"
      role="region"
      aria-label="Performance breakdown"
    >
      {/* Header Section */}
      <div
        className="border-b border-slate-200 p-6"
        data-testid="header-section"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Horse and Competition Info */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{horseName}</h2>
            <p className="text-sm text-slate-600">{competitionName}</p>
          </div>

          {/* Score and Placement */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Final Score</p>
              <p className="text-3xl font-bold text-slate-900">{finalScore.toFixed(1)}</p>
            </div>
            <PlacementBadge rank={rank} />
          </div>
        </div>

        {/* Prize and XP Row */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" aria-hidden="true" />
            <span className="text-lg font-semibold text-slate-800">{formatCurrency(prizeWon)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" aria-hidden="true" />
            <span className="text-lg font-semibold text-slate-800">{xpGained} XP</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Chart */}
        <div data-testid="breakdown-section">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-500" aria-hidden="true" />
            Score Breakdown Chart
          </h3>
          <ScoreBreakdownChart
            breakdown={scoreBreakdown}
            height={280}
            showLegend={false}
            interactive={true}
          />
        </div>

        {/* Right Column: Detailed List */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" aria-hidden="true" />
            Detailed Breakdown
          </h3>

          {/* Base Stats */}
          <div className="bg-slate-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" aria-hidden="true" />
              Base Stats
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Speed <span className="text-xs text-slate-400">(50%)</span></span>
                <span className="font-medium text-slate-800">{scoreBreakdown.baseScore.speed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Stamina <span className="text-xs text-slate-400">(30%)</span></span>
                <span className="font-medium text-slate-800">{scoreBreakdown.baseScore.stamina}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Agility <span className="text-xs text-slate-400">(20%)</span></span>
                <span className="font-medium text-slate-800">{scoreBreakdown.baseScore.agility}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-medium text-slate-700">Weighted Total</span>
                <span className="font-bold text-blue-600">{scoreBreakdown.baseScore.total.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Other Modifiers */}
          <div className="space-y-0">
            <BreakdownRow
              icon={Dumbbell}
              label="Training Bonus"
              value={scoreBreakdown.trainingBonus}
              sublabel="Discipline training"
            />

            {/* Trait Bonuses */}
            <div className="py-2 border-b border-slate-100">
              <div className="flex items-start gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-slate-400 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium text-slate-700">Trait Bonuses</p>
                    <ValueDisplay value={totalTraitBonus} showSign decimals={0} />
                  </div>
                  {scoreBreakdown.traitBonuses.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {scoreBreakdown.traitBonuses.map((tb, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-500">
                          <span>{tb.trait}</span>
                          <ValueDisplay value={tb.bonus} showSign decimals={0} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Equipment */}
            <div className="py-2 border-b border-slate-100">
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 text-slate-400 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium text-slate-700">Equipment</p>
                    <ValueDisplay value={scoreBreakdown.equipmentBonuses.total} showSign decimals={0} />
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Saddle</span>
                      <ValueDisplay value={scoreBreakdown.equipmentBonuses.saddle} showSign decimals={0} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Bridle</span>
                      <ValueDisplay value={scoreBreakdown.equipmentBonuses.bridle} showSign decimals={0} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <BreakdownRow
              icon={User}
              label="Rider Effect"
              value={scoreBreakdown.riderEffect}
              testId="rider-value"
              sublabel={scoreBreakdown.riderEffect >= 0 ? 'Bonus' : 'Penalty'}
            />

            <BreakdownRow
              icon={Heart}
              label="Health Modifier"
              value={scoreBreakdown.healthModifier}
              testId="health-value"
              sublabel="Based on health rating"
            />

            <BreakdownRow
              icon={Sparkles}
              label="Random Luck"
              value={scoreBreakdown.randomLuck}
              sublabel="Variance factor (max 9%)"
            />
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-slate-200">
            <span className="text-lg font-bold text-slate-900">Total Score</span>
            <span className="text-2xl font-bold text-blue-600">{scoreBreakdown.total.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      {comparisonData && (
        <div
          className="border-t border-slate-200 p-6"
          data-testid="comparison-section"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" aria-hidden="true" />
            Performance Comparison
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* vs Average */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">vs Competition Average</p>
              <p className="text-lg font-medium text-slate-700">{comparisonData.averageScore.toFixed(1)}</p>
              <DiffIndicator diff={avgDiff} testId="average-diff" />
            </div>

            {/* vs Winner */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">vs Winner ({comparisonData.winnerName})</p>
              <p className="text-lg font-medium text-slate-700">{comparisonData.winnerScore.toFixed(1)}</p>
              <DiffIndicator diff={winnerDiff} testId="winner-diff" />
            </div>

            {/* Percentile */}
            <div className="bg-slate-50 rounded-lg p-4" data-testid="percentile-ranking">
              <p className="text-sm text-slate-500 mb-1">Ranking</p>
              <p className="text-lg font-bold text-blue-600">
                Top {Math.ceil(100 - percentile + 1)}%
              </p>
              <p className="text-xs text-slate-500">of {totalParticipants} participants</p>
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <div
          className="border-t border-slate-200 p-6 bg-amber-50"
          data-testid="insights-section"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Improvement Suggestions
          </h3>

          <ul className="space-y-2">
            {insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-500 mt-0.5">&#8226;</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default memo(PerformanceBreakdown);
