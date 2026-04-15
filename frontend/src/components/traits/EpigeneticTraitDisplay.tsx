/**
 * EpigeneticTraitDisplay Component
 *
 * Displays epigenetic traits for a horse using real API data from
 * the horse genetics hooks.
 *
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Uses useHorseEpigeneticInsights with live empty/error states.
 */

import React from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useHorseEpigeneticInsights } from '@/hooks/useHorseGenetics';

export interface EpigeneticTraitDisplayProps {
  horseId: number;
}

/**
 * Rarity badge color helper
 */
function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'text-amber-400';
    case 'rare':
      return 'text-violet-400';
    default:
      return 'text-mystic-silver';
  }
}

/**
 * EpigeneticTraitDisplay Component
 */
const EpigeneticTraitDisplay: React.FC<EpigeneticTraitDisplayProps> = ({ horseId }) => {
  // Use real epigenetic insights hook
  const { data: insightsData, isLoading, error } = useHorseEpigeneticInsights(horseId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="epigenetic-loading">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="mt-3 text-sm text-mystic-silver">Loading traits...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-6"
        data-testid="epigenetic-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Error loading traits</p>
            <p className="text-sm text-red-400 mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const traits = insightsData?.traits ?? [];

  return (
    <div className="space-y-6" data-testid="epigenetic-trait-display">
      {/* Header */}
      <div className="rounded-lg border border-forest-green/30 bg-saddle-leather/40 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-blue-400" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-midnight-ink">Epigenetic Traits</h2>
            <p className="text-sm text-mystic-silver mt-1">
              {traits.length} trait{traits.length !== 1 ? 's' : ''} on record
            </p>
          </div>
        </div>
      </div>

      {/* Traits list from real API */}
      {traits.length > 0 ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="epigenetic-traits-list"
        >
          {traits.map((trait) => (
            <div
              key={trait.name}
              className="rounded-lg border border-forest-green/20 bg-saddle-leather/40 p-4"
              data-testid="epigenetic-trait-card"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-midnight-ink">{trait.name}</p>
                <span className={`text-xs font-medium capitalize ${rarityColor(trait.rarity)}`}>
                  {trait.rarity}
                </span>
              </div>
              {trait.description && (
                <p className="text-xs text-mystic-silver mt-1">{trait.description}</p>
              )}
              <p className="text-xs text-mystic-silver mt-2 capitalize">Type: {trait.type}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8" data-testid="epigenetic-traits-empty">
          <p className="text-mystic-silver text-sm">No traits discovered yet.</p>
        </div>
      )}
    </div>
  );
};

export default EpigeneticTraitDisplay;
