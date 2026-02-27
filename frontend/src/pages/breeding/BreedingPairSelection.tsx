/**
 * BreedingPairSelection Page
 *
 * Main page for selecting breeding pairs and initiating breeding.
 * Integrates HorseSelector, CompatibilityDisplay, BreedingPredictionsPanel, and BreedingConfirmationModal.
 *
 * Story 6-1: Breeding Pair Selection - Main Component
 * Story 6-5: Breeding Predictions - Integration
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { breedingApi, horsesApi, breedingPredictionApi } from '@/lib/api-client';
import HorseSelector from '@/components/breeding/HorseSelector';
import CompatibilityDisplay from '@/components/breeding/CompatibilityDisplay';
import BreedingPredictionsPanel from './BreedingPredictionsPanel';
import BreedingConfirmationModal from '@/components/breeding/BreedingConfirmationModal';
import type { Horse, CompatibilityAnalysis, BreedingResponse } from '@/types/breeding';
import { AlertCircle, CheckCircle } from 'lucide-react';
import CinematicMoment from '@/components/feedback/CinematicMoment';

export interface BreedingPairSelectionProps {
  userId?: string;
}

/**
 * Calculate default stud fee based on horse stats and level
 * This is a placeholder - actual fee should come from backend or be configurable
 */
function calculateStudFee(sire: Horse): number {
  const basePrice = 500;
  const levelMultiplier = sire.level || 1;
  return Math.round(basePrice * levelMultiplier);
}

const BreedingPairSelection: React.FC<BreedingPairSelectionProps> = ({ userId: propUserId }) => {
  const { user } = useAuth();
  const userId = propUserId || user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedSire, setSelectedSire] = useState<Horse | null>(null);
  const [selectedDam, setSelectedDam] = useState<Horse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFoalCinematic, setShowFoalCinematic] = useState(false);

  // Fetch user's horses
  const {
    data: horses,
    isLoading: loadingHorses,
    error: horsesError,
  } = useQuery<Horse[]>({
    queryKey: ['horses', userId],
    queryFn: async () => {
      const response = await horsesApi.list();
      // Transform HorseSummary[] to Horse[]
      return response.map((horse) => ({
        id: horse.id,
        name: horse.name,
        age: horse.ageYears || horse.age,
        sex: horse.sex || (horse.gender === 'male' ? 'Male' : 'Female'),
        breedName: horse.breed,
        healthStatus: horse.healthStatus,
        level: horse.level,
        dateOfBirth: horse.dateOfBirth,
        imageUrl: horse.imageUrl,
        stats: horse.stats,
        disciplineScores: horse.disciplineScores,
        traits: horse.traits,
        parentIds: horse.parentIds,
      })) as Horse[];
    },
    enabled: Boolean(userId),
    staleTime: 30000, // 30 seconds
  });

  // Fetch compatibility when both horses are selected
  const {
    data: compatibilityData,
    isLoading: loadingCompatibility,
    error: compatibilityError,
  } = useQuery<CompatibilityAnalysis>({
    queryKey: ['breeding-compatibility', selectedSire?.id, selectedDam?.id],
    queryFn: async () => {
      if (!selectedSire || !selectedDam) {
        throw new Error('Both horses must be selected');
      }

      const response = await breedingPredictionApi.getBreedingCompatibility({
        stallionId: selectedSire.id,
        mareId: selectedDam.id,
      });

      // Transform backend response to CompatibilityAnalysis
      // This is a placeholder - adjust based on actual backend response
      return {
        overall: ((response as Record<string, unknown>).overallScore as number) || 75,
        temperamentMatch:
          ((response as Record<string, unknown>).temperamentCompatibility as number) || 80,
        traitSynergy: ((response as Record<string, unknown>).traitSynergy as number) || 70,
        geneticDiversity: ((response as Record<string, unknown>).geneticDiversity as number) || 75,
        recommendations: ((response as Record<string, unknown>).recommendations as string[]) || [
          'Compatible temperaments for stable offspring',
          'Good genetic diversity reduces inbreeding risk',
          'Strong trait synergy for athletic abilities',
        ],
      };
    },
    enabled: Boolean(selectedSire && selectedDam),
    staleTime: 60000, // 1 minute
  });

  // Breeding mutation
  const breedingMutation = useMutation<BreedingResponse, Error, void>({
    mutationFn: async () => {
      if (!selectedSire || !selectedDam || !userId) {
        throw new Error('Missing required data for breeding');
      }

      const response = await breedingApi.breedFoal({
        sireId: selectedSire.id,
        damId: selectedDam.id,
        userId: userId != null ? String(userId) : undefined,
      });

      return {
        foal: response.foal!,
        message: response.message || 'Breeding successful!',
      } as unknown as BreedingResponse;
    },
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['horses', userId] });
      queryClient.invalidateQueries({ queryKey: ['foals'] });

      // Show success message and cinematic moment (Story 18-4)
      setSuccessMessage(data.message);
      setShowConfirmation(false);
      setShowFoalCinematic(true);

      // Navigate to foal development page after delay
      setTimeout(() => {
        navigate(`/foals/${data.foal.id}`);
      }, 2000);
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to initiate breeding. Please try again.');
      setShowConfirmation(false);
    },
  });

  // Handle breeding confirmation
  const handleConfirmBreeding = () => {
    setErrorMessage(null);
    breedingMutation.mutate();
  };

  // Clear errors when selection changes
  useEffect(() => {
    setErrorMessage(null);
  }, [selectedSire, selectedDam]);

  // Loading state
  if (loadingHorses) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
            <p className="mt-3 text-sm text-[rgb(148,163,184)]">Loading horses...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (horsesError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-[rgb(220,235,255)]">Failed to load horses. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const studFee = selectedSire ? calculateStudFee(selectedSire) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-[rgb(220,235,255)]">Breeding Pair Selection</h1>
        <p className="text-[rgb(148,163,184)] mt-2">
          Select a sire and dam from your horses to initiate breeding. View compatibility analysis
          and recommendations before confirming.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <p className="text-[rgb(220,235,255)]">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-[rgb(220,235,255)]">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Compatibility Error */}
      {compatibilityError && selectedSire && selectedDam && (
        <div className="rounded-lg border border-amber-500/30 bg-[rgba(212,168,67,0.1)] p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <p className="text-amber-400">
              Could not load compatibility analysis. You can still proceed with breeding.
            </p>
          </div>
        </div>
      )}

      {/* Horse Selectors */}
      <div className="grid gap-6 md:grid-cols-2">
        <HorseSelector
          horses={horses || []}
          selectedHorse={selectedSire}
          onSelect={setSelectedSire}
          filter="male"
          title="Select Sire"
        />
        <HorseSelector
          horses={horses || []}
          selectedHorse={selectedDam}
          onSelect={setSelectedDam}
          filter="female"
          title="Select Dam"
        />
      </div>

      {/* Compatibility Display */}
      <CompatibilityDisplay
        compatibility={compatibilityData || null}
        isLoading={loadingCompatibility}
      />

      {/* Breeding Predictions (Story 6-5 - P1) */}
      {selectedSire && selectedDam && (
        <BreedingPredictionsPanel sireId={selectedSire.id} damId={selectedDam.id} />
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-6">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-[rgb(148,163,184)]">Stud Fee</p>
            <p className="text-2xl font-bold text-[rgb(220,235,255)]">
              ${studFee.toLocaleString()}
            </p>
          </div>
          <div className="h-12 w-px bg-[rgba(37,99,235,0.3)]" />
          <div>
            <p className="text-sm text-[rgb(148,163,184)]">Breeding Cooldown</p>
            <p className="text-lg font-semibold text-[rgb(220,235,255)]">30 days</p>
          </div>
        </div>

        <button
          onClick={() => setShowConfirmation(true)}
          disabled={!selectedSire || !selectedDam || breedingMutation.isPending}
          className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Initiate Breeding
        </button>
      </div>

      {/* Breeding Confirmation Modal */}
      {selectedSire && selectedDam && compatibilityData && (
        <BreedingConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          sire={selectedSire}
          dam={selectedDam}
          compatibility={compatibilityData}
          studFee={studFee}
          onConfirm={handleConfirmBreeding}
          isSubmitting={breedingMutation.isPending}
        />
      )}

      {/* Cinematic foal birth moment (Story 18-4) */}
      {showFoalCinematic && (
        <CinematicMoment
          variant="foal-birth"
          title="A Foal is Born!"
          subtitle={
            breedingMutation.data?.foal?.name ? String(breedingMutation.data.foal.name) : undefined
          }
          onDismiss={() => setShowFoalCinematic(false)}
        />
      )}
    </div>
  );
};

export default BreedingPairSelection;
