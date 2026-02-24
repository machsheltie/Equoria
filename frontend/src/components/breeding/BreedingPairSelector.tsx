import React from 'react';
import {
  useHorseBreedingData,
  useInbreedingAnalysis,
  useGeneticProbability,
} from '@/hooks/api/useBreedingPrediction';

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
      <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
        <p className="text-[rgb(148,163,184)]">Loading breeding data...</p>
      </div>
    );
  }

  // Error state
  if (stallionError || mareError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6 shadow-sm">
        <p className="text-red-400">
          {(stallionError as Error)?.message ||
            (mareError as Error)?.message ||
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
    <div className="space-y-6 rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[rgb(220,235,255)]">Breeding Pair Analysis</h2>
        <p className="mt-1 text-sm text-[rgb(148,163,184)]">
          Compare stallion and mare compatibility, view offspring predictions, and assess genetic
          risks.
        </p>
      </div>

      {/* Inbreeding Warning */}
      {showInbreedingWarning && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/30 bg-[rgba(212,168,67,0.1)] p-4"
        >
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Inbreeding Warning</h3>
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-amber-400">
              Coefficient: {Math.round(inbreedingAnalysis.inbreedingCoefficient * 100)}%
            </p>
            {inbreedingAnalysis.warnings.map((warning, index) => (
              <p key={index} className="text-sm text-amber-400">
                {warning}
              </p>
            ))}
            {inbreedingAnalysis.recommendations.map((recommendation, index) => (
              <p key={index} className="text-sm font-medium text-amber-400">
                • {recommendation}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side horse comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stallion */}
        <div className="rounded-lg border border-blue-500/30 bg-[rgba(37,99,235,0.1)] p-4">
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">
            {stallionData.horseName}
          </h3>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-400">Stallion</p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-[rgb(220,235,255)]">
                {stallionData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Traits</p>
              <p className="text-base font-medium text-[rgb(220,235,255)]">
                {stallionData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Temperament</p>
              <p className="text-base font-medium capitalize text-[rgb(220,235,255)]">
                {stallionData.temperamentInfluence?.temperament || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Mare */}
        <div className="rounded-lg border border-purple-500/30 bg-[rgba(147,51,234,0.1)] p-4">
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">{mareData.horseName}</h3>
          <p className="text-sm font-medium uppercase tracking-wide text-purple-400">Mare</p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-[rgb(220,235,255)]">
                {mareData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Traits</p>
              <p className="text-base font-medium text-[rgb(220,235,255)]">
                {mareData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Temperament</p>
              <p className="text-base font-medium capitalize text-[rgb(220,235,255)]">
                {mareData.temperamentInfluence?.temperament || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Temperament Compatibility */}
      {isTemperamentCompatible && (
        <div className="rounded-lg border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] p-3">
          <p className="text-sm font-medium text-emerald-400">✓ Compatible temperaments</p>
        </div>
      )}

      {/* Offspring Predictions */}
      {predictions && (
        <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
          <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Offspring Predictions</h3>

          <div className="mt-4 space-y-4">
            {/* Predicted trait count */}
            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Predicted Traits</p>
              <p className="text-2xl font-bold text-[rgb(220,235,255)]">
                {predictions.estimatedTraitCount.expected}
              </p>
              <p className="text-xs text-[rgb(148,163,184)]">
                Range: {predictions.estimatedTraitCount.min} - {predictions.estimatedTraitCount.max}
              </p>
            </div>

            {/* Confidence level */}
            <div>
              <p className="text-sm text-[rgb(148,163,184)]">Confidence</p>
              <p className="text-base font-medium capitalize text-[rgb(220,235,255)]">
                {predictions.confidenceLevel} confidence
              </p>
            </div>

            {/* Category probabilities */}
            <div>
              <p className="text-sm font-medium text-[rgb(220,235,255)] mb-2">
                Category Probabilities
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(predictions.categoryProbabilities).map(
                  ([category, probability]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize text-[rgb(148,163,184)]">{category}</span>
                      <span className="font-medium text-[rgb(220,235,255)]">
                        {probability as number}%
                      </span>
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
