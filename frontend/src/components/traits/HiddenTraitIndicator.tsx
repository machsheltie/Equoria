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
      <div className="rounded-lg border-2 border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] p-6 text-center">
        <Sparkles className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-emerald-400 mb-2">All Traits Discovered!</h3>
        <p className="text-sm text-[rgb(148,163,184)]">
          You have discovered all traits for this horse. Congratulations!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[rgba(15,35,70,0.5)]">
          <Lock className="h-6 w-6 text-[rgb(148,163,184)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[rgb(220,235,255)]">Hidden Traits</h3>
          <p className="text-sm text-[rgb(148,163,184)]">
            {discoveryStatus.hiddenTraits} trait{discoveryStatus.hiddenTraits !== 1 ? 's' : ''} yet
            to be discovered
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[rgb(220,235,255)]">Discovery Progress</span>
            <span className="text-sm font-bold text-[rgb(220,235,255)]">{progress}%</span>
          </div>
          <div className="w-full bg-[rgba(15,35,70,0.5)] rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-[rgb(148,163,184)]">
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
        <div className="rounded-lg border border-blue-500/30 bg-[rgba(37,99,235,0.1)] p-4">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[rgb(220,235,255)] mb-1">Discovery Hint</p>
              <p className="text-sm text-[rgb(148,163,184)]">{discoveryStatus.nextDiscoveryHint}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generic Encouragement */}
      {showHint && !discoveryStatus.nextDiscoveryHint && (
        <div className="rounded-lg border border-purple-500/30 bg-[rgba(15,35,70,0.4)] p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-300 mb-1">How to Discover Traits</p>
              <ul className="text-sm text-[rgb(148,163,184)] space-y-1">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                  <span>Complete developmental milestones</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                  <span>Engage in enrichment activities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                  <span>Maintain consistent care quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
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
            className="aspect-square rounded-lg border-2 border-dashed border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] flex items-center justify-center"
          >
            <span className="text-2xl text-[rgb(148,163,184)]">?</span>
          </div>
        ))}
        {discoveryStatus.hiddenTraits > 6 && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] flex items-center justify-center">
            <span className="text-xs text-[rgb(148,163,184)] font-semibold">
              +{discoveryStatus.hiddenTraits - 6}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HiddenTraitIndicator;
