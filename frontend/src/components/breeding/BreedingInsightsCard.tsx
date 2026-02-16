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
      color: 'text-purple-600',
      label: 'Exceptional',
      barColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
    };
  if (score >= 70)
    return {
      color: 'text-green-600',
      label: 'Excellent',
      barColor: 'bg-gradient-to-r from-green-500 to-emerald-500',
    };
  if (score >= 55)
    return {
      color: 'text-blue-600',
      label: 'Good',
      barColor: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    };
  if (score >= 40)
    return {
      color: 'text-yellow-600',
      label: 'Average',
      barColor: 'bg-gradient-to-r from-yellow-500 to-amber-500',
    };
  return {
    color: 'text-amber-600',
    label: 'Below Average',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
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
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className={`h-6 w-6 ${qualityDisplay.color}`} />
          <h3 className="text-lg font-bold text-slate-900">Lineage Quality Score</h3>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
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

        <p className="text-xs text-slate-600">
          Based on parent stats, traits, level, and genetic diversity
        </p>
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h4 className="text-sm font-bold text-green-900 uppercase tracking-wide">
              Strong Combination Detected
            </h4>
          </div>
          <ul className="space-y-2">
            {strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-green-800">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 mt-1.5 flex-shrink-0" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
              ✅ Recommendations
            </h4>
          </div>
          <ul className="space-y-2">
            {recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optimal Care Strategies */}
      {optimalCareStrategies.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">
              💡 Optimal Care Strategies
            </h4>
          </div>
          <ul className="space-y-2">
            {optimalCareStrategies.map((strategy, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                <span>{strategy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Considerations */}
      {considerations.length > 0 && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-5 w-5 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              📋 Considerations
            </h4>
          </div>
          <ul className="space-y-2">
            {considerations.map((consideration, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                <span>{consideration}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
              ⚠️ Important Warnings
            </h4>
          </div>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
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
