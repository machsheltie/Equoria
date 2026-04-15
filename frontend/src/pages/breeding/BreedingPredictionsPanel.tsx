/**
 * BreedingPredictionsPanel Component
 *
 * Displays basic breeding pair information using real horse data from the API.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Uses horsesApi.get with live empty/error states.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, AlertCircle } from 'lucide-react';
import { horsesApi } from '@/lib/api-client';

export interface BreedingPredictionsPanelProps {
  sireId: number;
  damId: number;
}

/**
 * BreedingPredictionsPanel Component
 *
 * Uses real horse data for the breeding pair header.
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
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-6"
        data-testid="breeding-predictions-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-midnight-ink">Error loading horse data</p>
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
      <div className="rounded-lg border border-forest-green/20 bg-saddle-leather/40 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-2xl font-bold text-midnight-ink">Breeding Predictions</h2>
            <p className="text-midnight-ink font-medium mt-1">
              {sire.name} (Sire) × {dam.name} (Dam)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreedingPredictionsPanel;
