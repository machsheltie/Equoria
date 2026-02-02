/**
 * ConformationTab Component
 *
 * Main component for displaying horse conformation scores:
 * - 8 region score cards (Head, Neck, Shoulder, Back, Hindquarters, Legs, Hooves, Overall)
 * - Breed comparison toggle
 * - Responsive grid layout
 * - Loading and error states
 *
 * Story 3-5: Conformation Scoring UI - Task 5
 */

import { useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import ConformationScoreCard from './ConformationScoreCard';
import { useHorseConformation, useBreedAverages } from '@/hooks/api/useConformation';

export interface ConformationTabProps {
  horseId: number;
  breedId?: number;
}

const ConformationTab = ({ horseId, breedId }: ConformationTabProps) => {
  const [showComparison, setShowComparison] = useState(true);

  const {
    data: conformation,
    isLoading: conformationLoading,
    error: conformationError,
    refetch: refetchConformation,
  } = useHorseConformation(horseId);

  const {
    data: breedData,
    isLoading: breedLoading,
    error: breedError,
  } = useBreedAverages(breedId || 0);

  // Loading state
  if (conformationLoading || (showComparison && breedId && breedLoading)) {
    return (
      <div
        className="w-full flex items-center justify-center py-12"
        data-testid="conformation-loading"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-sm text-slate-600">Loading conformation scores...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (conformationError) {
    return (
      <div
        className="w-full rounded-lg border border-rose-200 bg-rose-50 p-6"
        data-testid="conformation-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">Error Loading Conformation Data</p>
            <p className="text-sm text-rose-700 mt-1">
              {conformationError.message || 'Failed to fetch conformation scores'}
            </p>
            <button
              onClick={() => refetchConformation()}
              className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!conformation) {
    return (
      <div
        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-6 text-center"
        data-testid="conformation-no-data"
      >
        <p className="text-sm text-slate-600">No conformation data available for this horse.</p>
      </div>
    );
  }

  const regions = [
    { key: 'head', label: 'Head', score: conformation.head },
    { key: 'neck', label: 'Neck', score: conformation.neck },
    { key: 'shoulder', label: 'Shoulder', score: conformation.shoulder },
    { key: 'back', label: 'Back', score: conformation.back },
    { key: 'hindquarters', label: 'Hindquarters', score: conformation.hindquarters },
    { key: 'legs', label: 'Legs', score: conformation.legs },
    { key: 'hooves', label: 'Hooves', score: conformation.hooves },
    { key: 'overall', label: 'Overall', score: conformation.overall },
  ];

  const canShowComparison = showComparison && breedId && breedData && !breedError;

  return (
    <div className="w-full space-y-6" data-testid="conformation-tab">
      {/* Header with Comparison Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Conformation Scores</h3>
          <p className="text-sm text-slate-600 mt-1">Physical assessment across 8 body regions</p>
        </div>

        {breedId && (
          <div className="flex items-center gap-2">
            <label htmlFor="breed-comparison-toggle" className="text-sm text-slate-700">
              Show breed comparison
            </label>
            <button
              id="breed-comparison-toggle"
              onClick={() => setShowComparison(!showComparison)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showComparison ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={showComparison}
              aria-label="Toggle breed comparison"
              data-testid="breed-comparison-toggle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showComparison ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Breed Comparison Info Banner */}
      {canShowComparison && (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4"
          data-testid="breed-info-banner"
        >
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">
                Comparing to {breedData.breedName} Breed Average
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Scores are compared to typical {breedData.breedName} horses to show relative
                strengths and weaknesses.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {regions.map((region) => {
          const breedAverage = canShowComparison
            ? breedData.averages[region.key as keyof typeof breedData.averages]
            : undefined;

          return (
            <ConformationScoreCard
              key={region.key}
              region={region.key}
              score={region.score}
              breedAverage={breedAverage}
              showComparison={canShowComparison}
            />
          );
        })}
      </div>

      {/* Educational Footer */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700 mb-2">About Conformation Scoring:</p>
        <ul className="space-y-1 text-xs text-slate-600">
          <li>
            • Conformation scores assess physical structure and balance across 8 key body regions
          </li>
          <li>• Scores range from 0-100, with higher scores indicating better conformation</li>
          <li>
            • The Overall score is calculated as the average of all 7 body regions (excluding
            itself)
          </li>
          <li>• Good conformation contributes to better movement quality and longevity</li>
          {canShowComparison && (
            <li>
              • Breed comparisons help identify strengths relative to breed standards and show
              prospects
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ConformationTab;
