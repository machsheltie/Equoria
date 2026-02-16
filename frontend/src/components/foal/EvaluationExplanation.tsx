/**
 * EvaluationExplanation Component
 *
 * Provides context-specific explanations about milestone evaluation results,
 * trait impacts, and guidance for future care with positive, encouraging tone.
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React from 'react';
import { Info, Lightbulb, TrendingUp } from 'lucide-react';
import type { MilestoneType } from '@/types/foal';
import {
  getEvaluationCategory,
  getEvaluationExplanation,
  getFutureCareGuidance,
} from '@/types/foal';

export interface EvaluationExplanationProps {
  score: number;
  milestone: MilestoneType;
  traits: string[];
}

/**
 * Get icon for explanation section
 */
function getExplanationIcon(score: number) {
  if (score >= 3) return TrendingUp;
  if (score >= 0) return Info;
  return Lightbulb;
}

/**
 * Get explanation container color
 */
function getExplanationColor(score: number): string {
  if (score >= 3) return 'border-green-200 bg-green-50';
  if (score >= 0) return 'border-blue-200 bg-blue-50';
  return 'border-amber-200 bg-amber-50';
}

/**
 * Get icon color
 */
function getIconColor(score: number): string {
  if (score >= 3) return 'text-green-600';
  if (score >= 0) return 'text-blue-600';
  return 'text-amber-600';
}

/**
 * EvaluationExplanation Component
 */
const EvaluationExplanation: React.FC<EvaluationExplanationProps> = ({
  score,
  milestone,
  traits,
}) => {
  const category = getEvaluationCategory(score);
  const explanation = getEvaluationExplanation(score, milestone, traits);
  const guidance = getFutureCareGuidance(score);
  const containerColor = getExplanationColor(score);
  const iconColor = getIconColor(score);
  const ExplanationIcon = getExplanationIcon(score);

  return (
    <div className={`rounded-lg border p-4 ${containerColor}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ExplanationIcon className={`h-5 w-5 ${iconColor}`} />
        <h4 className={`text-sm font-bold ${iconColor}`}>What This Means</h4>
      </div>

      {/* Main Explanation */}
      <div className="space-y-3 text-sm text-slate-700">
        <p className="leading-relaxed">{explanation}</p>

        {/* Trait Impact Section */}
        {traits && traits.length > 0 && (
          <div className="pt-3 border-t border-current/10">
            <p className="font-medium mb-2">
              {score >= 3
                ? '✨ Positive Traits Confirmed:'
                : score >= 0
                ? '📊 Traits Confirmed:'
                : '⚠️ Traits to Be Aware Of:'}
            </p>
            <div className="space-y-2">
              {traits.map((trait, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mt-1.5 flex-shrink-0" />
                  <p className="flex-1">
                    <span className="font-medium">{trait}</span> will influence your horse's behavior
                    and performance throughout their life.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Future Guidance */}
        <div className="pt-3 border-t border-current/10">
          <div className="flex items-start gap-2">
            <Lightbulb className={`h-4 w-4 ${iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className="font-medium mb-1">Moving Forward:</p>
              <p className="leading-relaxed">{guidance}</p>
            </div>
          </div>
        </div>

        {/* Additional Context Based on Score */}
        {score >= 5 && (
          <div className={`rounded-lg border border-green-300 bg-green-100 p-3 ${iconColor}`}>
            <p className="text-xs font-semibold mb-1">🌟 Exceptional Achievement!</p>
            <p className="text-xs leading-relaxed">
              You've achieved an outstanding evaluation. This level of care sets your foal up for
              exceptional success in training, competition, and breeding. Your dedication shows!
            </p>
          </div>
        )}

        {score >= 3 && score < 5 && (
          <div className={`rounded-lg border border-green-300 bg-green-100 p-3 ${iconColor}`}>
            <p className="text-xs font-semibold mb-1">✨ Great Job!</p>
            <p className="text-xs leading-relaxed">
              Your consistent care has paid off with positive trait development. Keep up this level
              of attention for continued success.
            </p>
          </div>
        )}

        {score >= 0 && score < 3 && (
          <div className={`rounded-lg border border-blue-300 bg-blue-100 p-3 ${iconColor}`}>
            <p className="text-xs font-semibold mb-1">📊 Room for Improvement</p>
            <p className="text-xs leading-relaxed">
              Your foal is developing normally, but there's potential for better outcomes. Focus on
              increasing enrichment activities and maintaining daily care routines.
            </p>
          </div>
        )}

        {score < 0 && score >= -3 && (
          <div className={`rounded-lg border border-amber-300 bg-amber-100 p-3 ${iconColor}`}>
            <p className="text-xs font-semibold mb-1">⚠️ Needs Attention</p>
            <p className="text-xs leading-relaxed">
              Your foal's development is below optimal. Increase your care frequency, complete more
              enrichment activities, and ensure consistent daily interaction to improve future
              evaluations.
            </p>
          </div>
        )}

        {score < -3 && (
          <div className={`rounded-lg border border-red-300 bg-red-100 p-3 text-red-700`}>
            <p className="text-xs font-semibold mb-1">❌ Critical Care Required</p>
            <p className="text-xs leading-relaxed">
              Your foal has developed significant behavioral challenges. This requires immediate
              attention and dramatically increased care. Focus on rebuilding trust through gentle,
              consistent interaction and complete all recommended enrichment activities daily.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationExplanation;
