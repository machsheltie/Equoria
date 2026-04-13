/**
 * BreedingPredictionsPanel Component
 *
 * Displays basic breeding pair information using real horse data from the API.
 * Advanced trait inheritance predictions are not available in this beta —
 * a beta-readonly notice is shown in place of fabricated prediction data.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * (Replaces mockApi with horsesApi.get; advanced predictions deferred to post-beta)
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, AlertCircle } from 'lucide-react';
import { horsesApi } from '@/lib/api-client';
import BetaExcludedNotice from '@/components/beta/BetaExcludedNotice';

export interface BreedingPredictionsPanelProps {
  sireId: number;
  damId: number;
}

/**
 * BreedingPredictionsPanel Component
 *
 * Uses real horse data for the breeding pair header.
 * Trait-level prediction details are beta-readonly pending backend support.
 */
const BreedingPredictionsPanel: React.FC<BreedingPredictionsPanelProps> = ({ sireId, damId }) => {
  // Fetch sire using real API
  const {
    data: sire,
    isLoading: sireLoading,
    error: sireError,
  } = useQuery({
    queryKey: ['horse', sireId],
    queryFn: () => horsesApi.get(sireId),
    enabled: !!sireId,
  });

  // Fetch dam using real API
  const {
    data: dam,
    isLoading: damLoading,
    error: damError,
  } = useQuery({
    queryKey: ['horse', damId],
    queryFn: () => horsesApi.get(damId),
    enabled: !!damId,
  });

  const isLoading = sireLoading || damLoading;
  const error = sireError || damError;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        data-testid="breeding-predictions-loading"
      >
        <div className="h-8 w-8 border-4 border-[var(--gold-light)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6"
        data-testid="breeding-predictions-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[rgb(220,235,255)]">Error loading horse data</p>
            <p className="text-sm text-red-400 mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!sire || !dam) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="breeding-predictions-panel">
      {/* Header — uses real horse names from API */}
      <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-2xl font-bold text-[rgb(220,235,255)]">Breeding Predictions</h2>
            <p className="text-[rgb(220,235,255)] font-medium mt-1">
              {sire.name} (Sire) × {dam.name} (Dam)
            </p>
          </div>
        </div>
      </div>

      {/* Trait predictions — beta-readonly (advanced API not available in this beta) */}
      <BetaExcludedNotice
        testId="breeding-predictions-beta-notice"
        message="Advanced trait inheritance predictions, ultra-rare trait potential, and breeding insights are not available in this beta."
      />
    </div>
  );
};

export default BreedingPredictionsPanel;
