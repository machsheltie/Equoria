/**
 * BreedingInsightsCard Component
 *
 * Displays breeding insights including strengths, recommendations,
 * warnings, optimal care strategies, and lineage quality score.
 *
 * Story 6-5: Breeding Predictions
 */

import React from 'react';
import { Lightbulb, CheckCircle, AlertTriangle, Info, TrendingUp, Award } from 'lucide-react';
import type { BreedingInsights } from '@/types/breeding';

export interface BreedingInsightsCardProps {
  insights: BreedingInsights;
}

/**
 * Get lineage quality color and label
 */
function getLineageQualityDisplay(score: number): {
  color: string;
  label: string;
  barColor: string;
} {
  if (score >= 85)
    return {
      color: 'text-[var(--status-rare)]',
      label: 'Exceptional',
      barColor: 'bg-[var(--status-rare)]',
    };
  if (score >= 70)
    return {
      color: 'text-[var(--role-success-text)]',
      label: 'Excellent',
      barColor: 'bg-[var(--status-success)]',
    };
  if (score >= 55)
    return {
      color: 'text-[var(--role-info-text)]',
      label: 'Good',
      barColor: 'bg-[var(--status-info)]',
    };
  if (score >= 40)
    return {
      color: 'text-[var(--role-warning-text)]',
      label: 'Average',
      barColor: 'bg-[var(--status-warning)]',
    };
  return {
    color: 'text-[var(--role-warning-text)]',
    label: 'Below Average',
    barColor: 'bg-[var(--status-warning)]',
  };
}

/**
 * BreedingInsightsCard Component
 */
const BreedingInsightsCard: React.FC<BreedingInsightsCardProps> = ({ insights }) => {
  const {
    strengths,
    recommendations,
    considerations,
    warnings,
    optimalCareStrategies,
    lineageQualityScore,
  } = insights;

  const qualityDisplay = getLineageQualityDisplay(lineageQualityScore);

  return (
    <div className="space-y-4">
      {/* Lineage Quality Score */}
      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className={`h-6 w-6 ${qualityDisplay.color}`} />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Lineage Quality Score</h3>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="w-full bg-[var(--role-neutral-bg)] rounded-full h-4 overflow-hidden">
              <div
                className={`h-full ${qualityDisplay.barColor} transition-all duration-700 ease-out`}
                style={{ width: `${lineageQualityScore}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${qualityDisplay.color}`}>
              {lineageQualityScore}
            </div>
            <div className={`text-sm font-medium ${qualityDisplay.color}`}>
              {qualityDisplay.label}
            </div>
          </div>
        </div>

        <p className="text-xs text-role-secondary">
          Based on parent stats, traits, level, and genetic diversity
        </p>
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="rounded-lg border border-[var(--role-success-border)] bg-[var(--role-success-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-[var(--role-success-text)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
              Strong Combination Detected
            </h4>
          </div>
          <ul className="space-y-2">
            {strengths.map((strength, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-[var(--role-success-text)]"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-success)] mt-1.5 flex-shrink-0" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-lg border border-[var(--role-info-border)] bg-[var(--role-info-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-[var(--role-info-text)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
              ✅ Recommendations
            </h4>
          </div>
          <ul className="space-y-2">
            {recommendations.map((recommendation, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-[var(--role-info-text)]"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] mt-1.5 flex-shrink-0" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optimal Care Strategies */}
      {optimalCareStrategies.length > 0 && (
        <div className="rounded-lg border border-[var(--role-success-border)] bg-[var(--role-success-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-[var(--role-success-text)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
              💡 Optimal Care Strategies
            </h4>
          </div>
          <ul className="space-y-2">
            {optimalCareStrategies.map((strategy, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-[var(--role-success-text)]"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-success)] mt-1.5 flex-shrink-0" />
                <span>{strategy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Considerations */}
      {considerations.length > 0 && (
        <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-5 w-5 text-role-secondary" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
              📋 Considerations
            </h4>
          </div>
          <ul className="space-y-2">
            {considerations.map((consideration, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] mt-1.5 flex-shrink-0" />
                <span>{consideration}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-[var(--role-warning-text)]" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
              ⚠️ Important Warnings
            </h4>
          </div>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-[var(--role-warning-text)]"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] mt-1.5 flex-shrink-0" />
                <span className="font-medium">{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BreedingInsightsCard;
