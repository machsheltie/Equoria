import React from 'react';
import {
  useHorseBreedingData,
  useInbreedingAnalysis,
  useGeneticProbability,
} from '@/hooks/api/useBreedingPrediction';
import type { TraitCategory } from '@/types/breeding';

interface BreedingPairSelectorProps {
  stallionId: number;
  mareId: number;
}

const BreedingPairSelector: React.FC<BreedingPairSelectorProps> = ({ stallionId, mareId }) => {
  // Fetch breeding data for both horses
  const {
    data: stallionData,
    isLoading: stallionLoading,
    error: stallionError,
  } = useHorseBreedingData(stallionId);

  const { data: mareData, isLoading: mareLoading, error: mareError } = useHorseBreedingData(mareId);

  // Fetch predictions and analysis
  const { data: predictions, isLoading: predictionsLoading } = useGeneticProbability(
    stallionId,
    mareId
  );

  const { data: inbreedingAnalysis, isLoading: inbreedingLoading } = useInbreedingAnalysis(
    stallionId,
    mareId
  );

  // Loading state
  if (stallionLoading || mareLoading || predictionsLoading || inbreedingLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Loading breeding data...</p>
      </div>
    );
  }

  // Error state
  if (stallionError || mareError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-red-600">
          {(stallionError as any)?.message ||
            (mareError as any)?.message ||
            'Failed to fetch breeding data'}
        </p>
      </div>
    );
  }

  // No data state
  if (!stallionData || !mareData) {
    return null;
  }

  // Check if inbreeding risk is high enough to show warning
  const showInbreedingWarning =
    inbreedingAnalysis && ['moderate', 'high', 'extreme'].includes(inbreedingAnalysis.riskLevel);

  // Check temperament compatibility
  const isTemperamentCompatible =
    stallionData.temperamentInfluence?.temperament && mareData.temperamentInfluence?.temperament;

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Breeding Pair Analysis</h2>
        <p className="mt-1 text-sm text-slate-600">
          Compare stallion and mare compatibility, view offspring predictions, and assess genetic
          risks.
        </p>
      </div>

      {/* Inbreeding Warning */}
      {showInbreedingWarning && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-lg font-semibold text-amber-900">Inbreeding Warning</h3>
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-amber-800">
              Coefficient: {Math.round(inbreedingAnalysis.inbreedingCoefficient * 100)}%
            </p>
            {inbreedingAnalysis.warnings.map((warning, index) => (
              <p key={index} className="text-sm text-amber-700">
                {warning}
              </p>
            ))}
            {inbreedingAnalysis.recommendations.map((recommendation, index) => (
              <p key={index} className="text-sm font-medium text-amber-800">
                • {recommendation}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side horse comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stallion */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-lg font-semibold text-slate-900">{stallionData.horseName}</h3>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Stallion</p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-slate-600">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-slate-900">
                {stallionData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-600">Traits</p>
              <p className="text-base font-medium text-slate-900">
                {stallionData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-600">Temperament</p>
              <p className="text-base font-medium capitalize text-slate-900">
                {stallionData.temperamentInfluence?.temperament || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Mare */}
        <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
          <h3 className="text-lg font-semibold text-slate-900">{mareData.horseName}</h3>
          <p className="text-sm font-medium uppercase tracking-wide text-pink-600">Mare</p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-slate-600">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-slate-900">
                {mareData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-600">Traits</p>
              <p className="text-base font-medium text-slate-900">
                {mareData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-600">Temperament</p>
              <p className="text-base font-medium capitalize text-slate-900">
                {mareData.temperamentInfluence?.temperament || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Temperament Compatibility */}
      {isTemperamentCompatible && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">✓ Compatible temperaments</p>
        </div>
      )}

      {/* Offspring Predictions */}
      {predictions && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-lg font-semibold text-slate-900">Offspring Predictions</h3>

          <div className="mt-4 space-y-4">
            {/* Predicted trait count */}
            <div>
              <p className="text-sm text-slate-600">Predicted Traits</p>
              <p className="text-2xl font-bold text-slate-900">
                {predictions.estimatedTraitCount.expected}
              </p>
              <p className="text-xs text-slate-500">
                Range: {predictions.estimatedTraitCount.min} - {predictions.estimatedTraitCount.max}
              </p>
            </div>

            {/* Confidence level */}
            <div>
              <p className="text-sm text-slate-600">Confidence</p>
              <p className="text-base font-medium capitalize text-slate-900">
                {predictions.confidenceLevel} confidence
              </p>
            </div>

            {/* Category probabilities */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Category Probabilities</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(predictions.categoryProbabilities).map(
                  ([category, probability]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-600">{category}</span>
                      <span className="font-medium text-slate-900">{probability as number}%</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreedingPairSelector;
