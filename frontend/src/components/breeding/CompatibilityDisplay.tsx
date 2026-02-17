/**
 * CompatibilityDisplay Component
 *
 * Displays breeding compatibility analysis between selected sire and dam.
 * Shows 4 key compatibility metrics with progress bars and recommendations.
 *
 * Story 6-1: Breeding Pair Selection - Subcomponent
 */

import React from 'react';
import { Lightbulb, TrendingUp, Users, Dna, Target } from 'lucide-react';
import type { CompatibilityAnalysis } from '@/types/breeding';

export interface CompatibilityDisplayProps {
  compatibility: CompatibilityAnalysis | null;
  isLoading: boolean;
}

/**
 * Get color classes based on score
 * >80: green (excellent)
 * 60-80: yellow (good)
 * <60: red (poor)
 */
function getScoreColor(score: number): {
  text: string;
  bg: string;
  bar: string;
  label: string;
} {
  if (score >= 80) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-50',
      bar: 'bg-green-500',
      label: 'Excellent',
    };
  } else if (score >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      bar: 'bg-yellow-500',
      label: 'Good',
    };
  } else {
    return {
      text: 'text-red-700',
      bg: 'bg-red-50',
      bar: 'bg-red-500',
      label: 'Poor',
    };
  }
}

/**
 * Progress Bar Component
 */
interface ProgressBarProps {
  value: number;
  label: string;
  icon: React.ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, icon }) => {
  const colors = getScoreColor(value);

  return (
    <div className="space-y-2">
      {/* Label and Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`${colors.text}`}>{icon}</div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${colors.text}`}>{value}/100</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {colors.label}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${value} out of 100`}
        />
      </div>
    </div>
  );
};

/**
 * CompatibilityDisplay Component
 */
const CompatibilityDisplay: React.FC<CompatibilityDisplayProps> = ({
  compatibility,
  isLoading,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
            <p className="mt-3 text-sm text-slate-600">Analyzing compatibility...</p>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder state (no pair selected)
  if (!compatibility) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Target className="h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Select Both Parents</h3>
          <p className="text-sm text-slate-600 max-w-md">
            Choose a sire and dam from the lists above to view their breeding compatibility analysis
            and recommendations.
          </p>
        </div>
      </div>
    );
  }

  const overallColors = getScoreColor(compatibility.overall);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header with Overall Score */}
      <div className={`${overallColors.bg} border-b border-slate-200 p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Compatibility Analysis</h3>
            <p className="text-sm text-slate-600 mt-1">Breeding pair compatibility assessment</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${overallColors.text}`}>
              {compatibility.overall}
            </div>
            <div className={`text-sm font-medium ${overallColors.text}`}>
              {overallColors.label} Match
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${overallColors.bar} transition-all duration-500`}
              style={{ width: `${compatibility.overall}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="p-6 space-y-4">
        <ProgressBar
          value={compatibility.temperamentMatch}
          label="Temperament Match"
          icon={<Users className="h-4 w-4" />}
        />

        <ProgressBar
          value={compatibility.traitSynergy}
          label="Trait Synergy"
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <ProgressBar
          value={compatibility.geneticDiversity}
          label="Genetic Diversity"
          icon={<Dna className="h-4 w-4" />}
        />
      </div>

      {/* Recommendations */}
      {compatibility.recommendations && compatibility.recommendations.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 p-6">
          <div className="flex items-start gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <h4 className="text-sm font-semibold text-slate-900">Breeding Recommendations</h4>
          </div>
          <ul className="space-y-2 ml-7">
            {compatibility.recommendations.map((recommendation, index) => (
              <li key={index} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-emerald-500 font-bold flex-shrink-0">•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompatibilityDisplay;
