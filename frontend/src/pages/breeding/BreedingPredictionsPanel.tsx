/**
 * BreedingPredictionsPanel Component
 *
 * Main panel for displaying breeding predictions including trait inheritance,
 * ultra-rare trait potential, and breeding insights.
 *
 * Story 6-5: Breeding Predictions (P1)
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import TraitPredictionCard from '@/components/breeding/TraitPredictionCard';
import UltraRareTraitPanel from '@/components/breeding/UltraRareTraitPanel';
import BreedingInsightsCard from '@/components/breeding/BreedingInsightsCard';
import type {
  Horse,
  TraitPrediction,
  UltraRareTraitPotential,
  BreedingInsights,
} from '@/types/breeding';
import {
  calculateTraitProbability,
  getTraitSource,
  calculateLineageQuality,
  getPredictionConfidence,
} from '@/types/breeding';

export interface BreedingPredictionsPanelProps {
  sireId: number;
  damId: number;
}

/**
 * Mock API - Replace with actual API calls
 */
const mockApi = {
  getHorse: async (horseId: number): Promise<Horse> => {
    // Mock data - replace with actual API call
    return {
      id: horseId,
      name: horseId === 1 ? 'Thunder' : 'Lightning',
      age: 5,
      sex: horseId === 1 ? 'Male' : 'Female',
      healthStatus: 'Healthy',
      level: 10,
      dateOfBirth: '2021-01-01',
      stats: {
        speed: 85,
        stamina: 80,
        agility: 90,
        strength: 75,
        intelligence: 88,
        health: 95,
      },
      traits: ['peopleOriented', 'confident', 'athletic', 'resilient', 'explorative'],
      canBreed: true,
    };
  },
};

/**
 * Generate client-side predictions
 */
function generatePredictions(sire: Horse, dam: Horse) {
  const sireTraits = Array.isArray(sire.traits)
    ? sire.traits.map((t) => (typeof t === 'string' ? t : t.name))
    : [];
  const damTraits = Array.isArray(dam.traits)
    ? dam.traits.map((t) => (typeof t === 'string' ? t : t.name))
    : [];

  // Combine all unique traits
  const allTraits = Array.from(new Set([...sireTraits, ...damTraits]));

  // Generate trait predictions
  const traitPredictions: TraitPrediction[] = allTraits.map((traitName) => ({
    traitId: traitName,
    traitName,
    probability: calculateTraitProbability(traitName, sireTraits, damTraits),
    source: getTraitSource(traitName, sireTraits, damTraits),
    isPositive: true, // Simplified - in reality would come from trait definitions
    category: 'Behavioral',
  }));

  // Sort by probability (highest first)
  traitPredictions.sort((a, b) => b.probability - a.probability);

  // Generate ultra-rare trait potential (mock data)
  const ultraRareTraits: UltraRareTraitPotential[] = [];

  // Phoenix-Born potential (conditional on care pattern)
  if (traitPredictions.some((t) => t.traitName === 'resilient')) {
    ultraRareTraits.push({
      traitId: 'phoenix-born',
      traitName: 'Phoenix-Born',
      tier: 'ultra-rare',
      baseProbability: 45,
      requirements: [
        '3+ stress events during development',
        '2+ successful recoveries',
        'No skipped milestones',
      ],
      isAchievable: false,
      groomInfluence: {
        groomType: 'Mindful Handler',
        bonusPercentage: 15,
      },
      description:
        'Exceptional resilience trait that allows horse to perform under extreme pressure',
    });
  }

  // Iron-Willed potential (achievable with perfect care)
  if (traitPredictions.some((t) => t.traitName === 'confident')) {
    ultraRareTraits.push({
      traitId: 'iron-willed',
      traitName: 'Iron-Willed',
      tier: 'exotic',
      baseProbability: 25,
      requirements: [
        'Perfect milestone completion (all 5 milestones)',
        'No negative traits',
        '80%+ lineage quality score',
      ],
      isAchievable: true,
      description:
        'Unshakeable determination that prevents performance drops from stress or fatigue',
    });
  }

  // Generate breeding insights
  const lineageQuality = calculateLineageQuality(sire, dam);
  const confidence = getPredictionConfidence(sireTraits.length, damTraits.length);

  const insights: BreedingInsights = {
    strengths: [],
    recommendations: [],
    considerations: [],
    warnings: [],
    optimalCareStrategies: [],
    lineageQualityScore: lineageQuality,
  };

  // Add strengths based on trait synergies
  const athleticProbability = traitPredictions.find((t) => t.traitName === 'athletic')?.probability;
  if (athleticProbability && athleticProbability >= 90) {
    insights.strengths.push(
      `Excellent athletic trait synergy (${athleticProbability}% chance of athletic foal)`
    );
  }

  // Add recommendations
  if (ultraRareTraits.some((t) => t.traitId === 'phoenix-born')) {
    insights.recommendations.push(
      'Assign Mindful Handler groom to increase Phoenix-Born trait potential'
    );
  }

  if (ultraRareTraits.some((t) => t.traitId === 'iron-willed')) {
    insights.recommendations.push(
      'Maintain perfect milestone schedule to achieve Iron-Willed trait'
    );
  }

  insights.recommendations.push('Focus on trust-building enrichment activities during first week');

  // Add care strategies
  insights.optimalCareStrategies.push('Complete all 5 enrichment activities daily');
  insights.optimalCareStrategies.push('Maintain consistent groom interactions (once per day minimum)');
  insights.optimalCareStrategies.push('Focus on socialization milestone for best trait development');

  // Add considerations
  const explorativeProbability = traitPredictions.find(
    (t) => t.traitName === 'explorative'
  )?.probability;
  if (explorativeProbability && explorativeProbability >= 50) {
    insights.considerations.push(
      `${explorativeProbability}% chance of explorative trait (requires extra attention and enrichment)`
    );
  }

  insights.considerations.push('Monitor stress levels daily for optimal trait development');

  // Add warnings if lineage quality is low
  if (lineageQuality < 50) {
    insights.warnings = ['Below-average lineage quality may result in fewer positive traits'];
  }

  return {
    traitPredictions,
    ultraRareTraits,
    insights,
    confidence,
  };
}

/**
 * BreedingPredictionsPanel Component
 */
const BreedingPredictionsPanel: React.FC<BreedingPredictionsPanelProps> = ({ sireId, damId }) => {
  // Fetch sire data
  const {
    data: sire,
    isLoading: sireLoading,
    error: sireError,
    refetch: refetchSire,
  } = useQuery({
    queryKey: ['horse', sireId],
    queryFn: () => mockApi.getHorse(sireId),
    enabled: !!sireId,
  });

  // Fetch dam data
  const {
    data: dam,
    isLoading: damLoading,
    error: damError,
    refetch: refetchDam,
  } = useQuery({
    queryKey: ['horse', damId],
    queryFn: () => mockApi.getHorse(damId),
    enabled: !!damId,
  });

  // Generate predictions when both horses are loaded
  const predictions = useMemo(() => {
    if (!sire || !dam) return null;
    return generatePredictions(sire, dam);
  }, [sire, dam]);

  const isLoading = sireLoading || damLoading;
  const error = sireError || damError;

  const handleRefresh = () => {
    refetchSire();
    refetchDam();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error loading predictions</p>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!predictions || !sire || !dam) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">Breeding Predictions</h2>
            </div>
            <p className="text-slate-700 font-medium">
              {sire.name} (Sire) × {dam.name} (Dam)
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Prediction Confidence: {predictions.confidence.level.charAt(0).toUpperCase() +
                predictions.confidence.level.slice(1)}{' '}
              ({predictions.confidence.percentage}%)
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            aria-label="Refresh predictions"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Trait Inheritance Predictions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Trait Inheritance Predictions</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {predictions.traitPredictions.map((prediction) => (
            <TraitPredictionCard key={prediction.traitId} prediction={prediction} />
          ))}
        </div>
      </div>

      {/* Ultra-Rare Trait Potential */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ultra-Rare Trait Potential</h3>
        <UltraRareTraitPanel traits={predictions.ultraRareTraits} />
      </div>

      {/* Breeding Insights */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Breeding Insights</h3>
        <BreedingInsightsCard insights={predictions.insights} />
      </div>
    </div>
  );
};

export default BreedingPredictionsPanel;
