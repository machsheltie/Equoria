/**
 * EpigeneticTraitDisplay Component
 *
 * Main integration component for displaying all traits for a horse.
 * Groups traits by tier, shows discovery status, and integrates all
 * trait-related subcomponents with React Query for data management.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, AlertCircle } from 'lucide-react';
import TraitCard from './TraitCard';
import TraitDetailModal from './TraitDetailModal';
import HiddenTraitIndicator from './HiddenTraitIndicator';
import type {
  EpigeneticTrait,
  TraitDiscoveryStatus,
  TraitHistory,
  TraitTier,
} from '@/types/traits';
import { groupTraitsByTier, getTierDisplayName } from '@/types/traits';

export interface EpigeneticTraitDisplayProps {
  horseId: number;
}

/**
 * Mock API - Replace with actual API calls
 */
const mockApi = {
  getTraits: async (horseId: number): Promise<EpigeneticTrait[]> => {
    // Mock trait data
    return [
      {
        id: 'athletic-prowess',
        name: 'Athletic Prowess',
        tier: 'ultra-rare',
        category: 'Physical',
        description:
          'Exceptional natural athleticism that enhances performance across multiple disciplines',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['genetic-only', 'milestone-triggered'],
        competitionImpact: {
          dressage: 3,
          show_jumping: 5,
          cross_country: 4,
          endurance: 3,
          racing: 4,
          western: 2,
        },
        discoveredAt: new Date('2026-01-15'),
        discoverySource: 'milestone_confidence_reactivity',
        isPositive: true,
      },
      {
        id: 'calm-temperament',
        name: 'Calm Temperament',
        tier: 'common',
        category: 'Behavioral',
        description:
          'Even-tempered disposition that remains composed under pressure and unfamiliar situations',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['care-influenced', 'genetic-only'],
        competitionImpact: {
          dressage: 2,
          show_jumping: 1,
          cross_country: 1,
          endurance: 2,
          racing: 0,
          western: 2,
        },
        discoveredAt: new Date('2026-01-10'),
        discoverySource: 'enrichment_trust',
        isPositive: true,
      },
      {
        id: 'resilient-spirit',
        name: 'Resilient Spirit',
        tier: 'rare',
        category: 'Mental',
        description:
          'Remarkable ability to bounce back from setbacks and perform under stress',
        discoveryStatus: 'discovered',
        epigeneticFlags: ['stress-induced', 'milestone-triggered'],
        competitionImpact: {
          dressage: 1,
          show_jumping: 3,
          cross_country: 4,
          endurance: 4,
          racing: 2,
          western: 2,
        },
        discoveredAt: new Date('2026-01-20'),
        discoverySource: 'stress_recovery',
        isPositive: true,
      },
      {
        id: 'phoenix-born',
        name: 'Phoenix-Born',
        tier: 'exotic',
        category: 'Mental',
        description:
          'Legendary trait allowing exceptional performance under extreme pressure. Horse seems to thrive in high-stakes situations.',
        discoveryStatus: 'partially_discovered',
        epigeneticFlags: ['stress-induced', 'care-influenced', 'milestone-triggered'],
        competitionImpact: {
          dressage: 7,
          show_jumping: 8,
          cross_country: 9,
          endurance: 7,
          racing: 8,
          western: 6,
          synergyBonuses: [
            {
              requiredTraitIds: ['resilient-spirit', 'athletic-prowess'],
              bonusDisciplines: ['show_jumping', 'cross_country'],
              bonusAmount: 3,
              description:
                'Perfect Storm: Combines resilience and athleticism for unstoppable performance',
            },
          ],
        },
        isPositive: true,
      },
    ];
  },

  getDiscoveryStatus: async (horseId: number): Promise<TraitDiscoveryStatus> => {
    return {
      horseId,
      totalTraits: 10,
      discoveredTraits: 3,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 6,
      nextDiscoveryHint:
        'Complete the Trust Handling milestone to unlock a new behavioral trait',
      discoveryProgress: 35,
    };
  },

  getTraitHistory: async (horseId: number, traitId: string): Promise<TraitHistory> => {
    return {
      horseId,
      events: [
        {
          id: '1',
          traitId: traitId,
          traitName: 'Athletic Prowess',
          tier: 'ultra-rare',
          timestamp: new Date('2026-01-15T10:30:00'),
          eventType: 'discovery',
          trigger: 'Milestone: Confidence & Reactivity',
          description:
            'Trait discovered during confidence milestone evaluation with exceptional performance',
        },
        {
          id: '2',
          traitId: traitId,
          traitName: 'Athletic Prowess',
          tier: 'ultra-rare',
          timestamp: new Date('2026-01-16T14:20:00'),
          eventType: 'activation',
          trigger: 'First Competition Participation',
          description: 'Trait activated and provided significant performance boost in debut competition',
        },
      ],
    };
  },
};

/**
 * EpigeneticTraitDisplay Component
 */
const EpigeneticTraitDisplay: React.FC<EpigeneticTraitDisplayProps> = ({ horseId }) => {
  const [selectedTrait, setSelectedTrait] = useState<EpigeneticTrait | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch traits
  const {
    data: traits,
    isLoading: traitsLoading,
    error: traitsError,
  } = useQuery({
    queryKey: ['horseTraits', horseId],
    queryFn: () => mockApi.getTraits(horseId),
    staleTime: 60000, // 1 minute
  });

  // Fetch discovery status
  const {
    data: discoveryStatus,
    isLoading: discoveryLoading,
  } = useQuery({
    queryKey: ['traitDiscoveryStatus', horseId],
    queryFn: () => mockApi.getDiscoveryStatus(horseId),
    staleTime: 60000, // 1 minute
  });

  // Fetch trait history for selected trait
  const {
    data: traitHistory,
  } = useQuery({
    queryKey: ['traitHistory', horseId, selectedTrait?.id],
    queryFn: () => mockApi.getTraitHistory(horseId, selectedTrait!.id),
    enabled: modalOpen && !!selectedTrait,
    staleTime: 300000, // 5 minutes
  });

  const handleTraitClick = (trait: EpigeneticTrait) => {
    setSelectedTrait(trait);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    // Delay clearing selected trait to allow modal animation to complete
    setTimeout(() => setSelectedTrait(null), 300);
  };

  // Loading state
  if (traitsLoading || discoveryLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
          <p className="mt-3 text-sm text-slate-600">Loading traits...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (traitsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error loading traits</p>
            <p className="text-sm text-red-700 mt-1">
              {traitsError instanceof Error ? traitsError.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!traits || !discoveryStatus) {
    return null;
  }

  // Group traits by tier
  const groupedTraits = groupTraitsByTier(traits);
  const tierOrder: TraitTier[] = ['exotic', 'ultra-rare', 'rare', 'uncommon', 'common'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">Epigenetic Traits</h2>
            <p className="text-sm text-slate-700 mt-1">
              {discoveryStatus.discoveredTraits} of {discoveryStatus.totalTraits} traits discovered
              ({discoveryStatus.discoveryProgress}%)
            </p>
          </div>
        </div>
      </div>

      {/* Discovered Traits by Tier */}
      {tierOrder.map((tier) => {
        const tierTraits = groupedTraits.get(tier);
        if (!tierTraits || tierTraits.length === 0) return null;

        return (
          <div key={tier} className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">
              {getTierDisplayName(tier)} Traits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tierTraits.map((trait) => (
                <TraitCard
                  key={trait.id}
                  trait={trait}
                  onClick={handleTraitClick}
                  showCompetitionImpact={true}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Hidden Traits Indicator */}
      {discoveryStatus.hiddenTraits > 0 && (
        <HiddenTraitIndicator
          discoveryStatus={discoveryStatus}
          showProgress={true}
          showHint={true}
        />
      )}

      {/* Trait Detail Modal */}
      {selectedTrait && (
        <TraitDetailModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          trait={selectedTrait}
          traitHistory={traitHistory}
        />
      )}
    </div>
  );
};

export default EpigeneticTraitDisplay;
