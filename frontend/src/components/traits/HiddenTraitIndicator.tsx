/**
 * HiddenTraitIndicator Component
 *
 * Displays indicator for undiscovered traits with discovery hints
 * and progress tracking. Provides clues to help users discover hidden traits.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React from 'react';
import { HelpCircle, Lock, Sparkles } from 'lucide-react';
import type { TraitDiscoveryStatus } from '@/types/traits';
import { calculateDiscoveryProgress } from '@/types/traits';

export interface HiddenTraitIndicatorProps {
  discoveryStatus: TraitDiscoveryStatus;
  showProgress?: boolean;
  showHint?: boolean;
}

/**
 * HiddenTraitIndicator Component
 */
const HiddenTraitIndicator: React.FC<HiddenTraitIndicatorProps> = ({
  discoveryStatus,
  showProgress = true,
  showHint = true,
}) => {
  const progress = calculateDiscoveryProgress(discoveryStatus);
  const hasHiddenTraits = discoveryStatus.hiddenTraits > 0;

  if (!hasHiddenTraits) {
    return (
      <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 text-center">
        <Sparkles className="h-12 w-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-green-900 mb-2">All Traits Discovered!</h3>
        <p className="text-sm text-green-700">
          You have discovered all traits for this horse. Congratulations!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-200">
          <Lock className="h-6 w-6 text-slate-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">Hidden Traits</h3>
          <p className="text-sm text-slate-600">
            {discoveryStatus.hiddenTraits} trait{discoveryStatus.hiddenTraits !== 1 ? 's' : ''} yet to be discovered
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Discovery Progress</span>
            <span className="text-sm font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-slate-600">
            <span>{discoveryStatus.discoveredTraits} discovered</span>
            {discoveryStatus.partiallyDiscoveredTraits > 0 && (
              <span>{discoveryStatus.partiallyDiscoveredTraits} partial</span>
            )}
            <span>{discoveryStatus.hiddenTraits} hidden</span>
          </div>
        </div>
      )}

      {/* Discovery Hint */}
      {showHint && discoveryStatus.nextDiscoveryHint && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">Discovery Hint</p>
              <p className="text-sm text-blue-700">{discoveryStatus.nextDiscoveryHint}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generic Encouragement */}
      {showHint && !discoveryStatus.nextDiscoveryHint && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900 mb-1">How to Discover Traits</p>
              <ul className="text-sm text-purple-700 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <span>Complete developmental milestones</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <span>Engage in enrichment activities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <span>Maintain consistent care quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <span>Compete in various disciplines</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mystery Trait Cards */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {Array.from({ length: Math.min(discoveryStatus.hiddenTraits, 6) }).map((_, index) => (
          <div
            key={index}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center"
          >
            <span className="text-2xl text-slate-400">?</span>
          </div>
        ))}
        {discoveryStatus.hiddenTraits > 6 && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center">
            <span className="text-xs text-slate-500 font-semibold">
              +{discoveryStatus.hiddenTraits - 6}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HiddenTraitIndicator;
