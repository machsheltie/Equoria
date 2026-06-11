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
      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-6 shadow-sm">
        <p className="text-role-secondary">Loading breeding data...</p>
      </div>
    );
  }

  // Error state
  if (stallionError || mareError) {
    return (
      <div className="rounded-lg border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] p-6 shadow-sm">
        <p className="text-[var(--role-danger-text)]">
          {(stallionError as unknown as Error)?.message ||
            (mareError as unknown as Error)?.message ||
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
    <div className="space-y-6 rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-6 shadow-sm">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Breeding Pair Analysis</h2>
        <p className="mt-1 text-sm text-role-secondary">
          Compare stallion and mare compatibility, view offspring predictions, and assess genetic
          risks.
        </p>
      </div>

      {/* Inbreeding Warning */}
      {showInbreedingWarning && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] p-4"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Inbreeding Warning</h3>
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-[var(--role-warning-text)]">
              Coefficient: {Math.round(inbreedingAnalysis.inbreedingCoefficient * 100)}%
            </p>
            {inbreedingAnalysis.warnings.map((warning, index) => (
              <p key={index} className="text-sm text-[var(--role-warning-text)]">
                {warning}
              </p>
            ))}
            {inbreedingAnalysis.recommendations.map((recommendation, index) => (
              <p key={index} className="text-sm font-medium text-[var(--role-warning-text)]">
                • {recommendation}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side horse comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stallion */}
        <div className="rounded-lg border border-[var(--role-info-border)] bg-[var(--role-info-bg)] p-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {stallionData.horseName}
          </h3>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--role-info-text)]">
            Stallion
          </p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-role-secondary">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-[var(--text-primary)]">
                {stallionData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-role-secondary">Traits</p>
              <p className="text-base font-medium text-[var(--text-primary)]">
                {stallionData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-role-secondary">Temperament</p>
              <p className="text-base font-medium capitalize text-[var(--text-primary)]">
                {/* Equoria-1k4n — legacy horses have null temperament;
                    'not recorded' per the Equoria-iwy3 convention. */}
                {stallionData.temperamentInfluence?.temperament || 'not recorded'}
              </p>
            </div>
          </div>
        </div>

        {/* Mare */}
        <div className="rounded-lg border border-[var(--badge-rare-bg)] bg-[var(--badge-rare-bg)] p-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{mareData.horseName}</h3>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--status-rare)]">
            Mare
          </p>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-role-secondary">Breeding Quality</p>
              <p className="text-base font-medium capitalize text-[var(--text-primary)]">
                {mareData.breedingQuality}
              </p>
            </div>

            <div>
              <p className="text-sm text-role-secondary">Traits</p>
              <p className="text-base font-medium text-[var(--text-primary)]">
                {mareData.traitSummary.totalTraits} traits
              </p>
            </div>

            <div>
              <p className="text-sm text-role-secondary">Temperament</p>
              <p className="text-base font-medium capitalize text-[var(--text-primary)]">
                {/* Equoria-1k4n — legacy horses have null temperament;
                    'not recorded' per the Equoria-iwy3 convention. */}
                {mareData.temperamentInfluence?.temperament || 'not recorded'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Temperament Compatibility */}
      {isTemperamentCompatible && (
        <div className="rounded-lg border border-[var(--role-success-border)] bg-[var(--role-success-bg)] p-3">
          <p className="text-sm font-medium text-[var(--role-success-text)]">
            ✓ Compatible temperaments
          </p>
        </div>
      )}

      {/* Offspring Predictions */}
      {predictions && (
        <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Offspring Predictions
          </h3>

          <div className="mt-4 space-y-4">
            {/* Predicted trait count */}
            <div>
              <p className="text-sm text-role-secondary">Predicted Traits</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {predictions.estimatedTraitCount.expected}
              </p>
              <p className="text-xs text-role-secondary">
                Range: {predictions.estimatedTraitCount.min} - {predictions.estimatedTraitCount.max}
              </p>
            </div>

            {/* Confidence level */}
            <div>
              <p className="text-sm text-role-secondary">Confidence</p>
              <p className="text-base font-medium capitalize text-[var(--text-primary)]">
                {predictions.confidenceLevel} confidence
              </p>
            </div>

            {/* Category probabilities */}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                Category Probabilities
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(predictions.categoryProbabilities).map(
                  ([category, probability]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize text-role-secondary">{category}</span>
                      <span className="font-medium text-[var(--text-primary)]">
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
