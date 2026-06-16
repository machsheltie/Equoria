/**
 * BreedingPairSelection (Epic 28-2 — Celestial Night restyle)
 *
 * Main page for selecting breeding pairs and initiating breeding.
 * - Celestial Night glass panels throughout
 * - CompatibilityPreview integration (4-tab: Stats/Traits/Inbreeding/Pedigree)
 * - Cost breakdown: stud fee + flat breeding fee
 * - CinematicMoment on foal birth — lifetime-first only (milestones.firstBreed)
 *   Subsequent breedings show a success banner instead.
 *
 * Story 6-1: Breeding Pair Selection - Main Component
 * Story 6-5: Breeding Predictions - Integration
 * Epic 28-2: Celestial Night restyle + CompatibilityPreview
 */

import React, { useState, useEffect } from 'react';
import { formatDate } from '@/lib/formatDate';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Dna, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Currency from '@/components/ui/Currency';
import { breedingApi, horsesApi, breedingPredictionApi } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';
import HorseSelector from '@/components/breeding/HorseSelector';
import CompatibilityDisplay from '@/components/breeding/CompatibilityDisplay';
import BreedingPredictionsPanel from './BreedingPredictionsPanel';
import LethalWhiteWarning from '@/components/breeding/LethalWhiteWarning';
import BreedingConfirmationModal from '@/components/breeding/BreedingConfirmationModal';
import {
  CompatibilityPreview,
  type CompatibilityData,
} from '@/components/breeding/CompatibilityPreview';
import { mapPredictionToCompatibilityData } from '@/components/breeding/compatibilityFromPrediction';
import { mapLineageToPedigreeTree } from '@/components/breeding/pedigreeTreeFromLineage';
import {
  useGeneticProbability,
  useInbreedingAnalysis,
  useLineageAnalysis,
} from '@/hooks/api/useBreedingPrediction';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import { useRewardToast } from '@/components/feedback';
import type { Horse, CompatibilityAnalysis } from '@/types/breeding';

// ── Constants ──────────────────────────────────────────────────────────────────

const FLAT_BREEDING_FEE = 200; // fixed game breeding fee (separate from stud fee)

// ── Helpers ────────────────────────────────────────────────────────────────────

function calculateStudFee(sire: Horse): number {
  const basePrice = 500;
  const levelMultiplier = sire.level || 1;
  return Math.round(basePrice * levelMultiplier);
}

// CompatibilityPreview data is no longer derived client-side. The previous
// buildCompatibilityData() used hardcoded math (stat = (s+d)/2 ± spread*0.3±5,
// trait probabilities 0.95/0.7, inbreeding fallback 0.02, synthetic
// "Shared Grandsire" pedigree) — none of which were the game's real genetics
// (Equoria-to87r, a 21R "no fake product values" defect). It now comes from
// the real backend genetic-probability + inbreeding-analysis endpoints via
// useGeneticProbability / useInbreedingAnalysis, mapped by
// mapPredictionToCompatibilityData. When prediction is unavailable the
// preview shows an honest loading/empty state instead of fabricated numbers.

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BreedingPairSelectionProps {
  userId?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

const BreedingPairSelection: React.FC<BreedingPairSelectionProps> = ({ userId: propUserId }) => {
  const { user } = useAuth();
  const userId = propUserId || user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useRewardToast();

  // State
  const [selectedSire, setSelectedSire] = useState<Horse | null>(null);
  const [selectedDam, setSelectedDam] = useState<Horse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFoalCinematic, setShowFoalCinematic] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);

  // Fetch user's horses
  const {
    data: horses,
    isLoading: loadingHorses,
    error: horsesError,
  } = useQuery<Horse[]>({
    queryKey: ['horses', userId],
    queryFn: async () => {
      const response = await horsesApi.list();
      const MALE_SEX = ['Stallion', 'Colt', 'Rig'] as const;
      return response.map((horse) => ({
        id: horse.id,
        name: horse.name,
        age: horse.ageYears || horse.age,
        sex: (MALE_SEX as readonly string[]).includes(horse.sex ?? '') ? 'Male' : 'Female',
        breedName: getBreedName(horse.breed),
        healthStatus: horse.healthStatus,
        level: horse.level,
        dateOfBirth: horse.dateOfBirth,
        imageUrl: horse.imageUrl,
        stats: horse.stats,
        disciplineScores: horse.disciplineScores,
        traits: horse.traits,
        parentIds: horse.parentIds,
      })) as unknown as Horse[];
    },
    enabled: Boolean(userId),
    staleTime: 30000,
  });

  // Fetch compatibility when both horses are selected
  const {
    data: compatibilityData,
    isLoading: loadingCompatibility,
    error: compatibilityError,
  } = useQuery<CompatibilityAnalysis>({
    queryKey: ['breeding-compatibility', selectedSire?.id, selectedDam?.id],
    queryFn: async () => {
      if (!selectedSire || !selectedDam) throw new Error('Both horses must be selected');

      const response = await breedingPredictionApi.getBreedingCompatibility({
        stallionId: selectedSire.id,
        mareId: selectedDam.id,
      });

      const resp = response as unknown as Record<string, unknown>;
      return {
        overall: (resp.overallScore as number) || 75,
        temperamentMatch: (resp.temperamentCompatibility as number) || 80,
        traitSynergy: (resp.traitSynergy as number) || 70,
        geneticDiversity: (resp.geneticDiversity as number) || 75,
        recommendations: (resp.recommendations as string[]) || [
          'Compatible temperaments for stable offspring',
          'Good genetic diversity reduces inbreeding risk',
          'Strong trait synergy for athletic abilities',
        ],
      };
    },
    enabled: Boolean(selectedSire && selectedDam),
    staleTime: 60000,
  });

  // Real backend breeding-genetics prediction (the game's actual inheritance
  // model) — replaces the removed client-side hardcoded buildCompatibilityData.
  const sireId = selectedSire?.id ?? 0;
  const damId = selectedDam?.id ?? 0;
  const {
    data: geneticProbability,
    isLoading: loadingGenetic,
    error: geneticError,
  } = useGeneticProbability(sireId, damId);
  const { data: inbreedingAnalysis, isLoading: loadingInbreeding } = useInbreedingAnalysis(
    sireId,
    damId
  );
  // Real 3-generation ancestor tree (Equoria-55bo.2) — replaces the flat
  // common-ancestor overlap in the Pedigree tab with the game's actual
  // recursive sire/dam lineage from the backend lineage-analysis endpoint.
  const { data: lineageAnalysis, isLoading: loadingLineage } = useLineageAnalysis(sireId, damId);

  // Map the real responses; null when prediction is unavailable so the
  // preview renders an honest loading/empty state (no fabricated numbers).
  const previewData: CompatibilityData | null =
    selectedSire && selectedDam
      ? (() => {
          const base = mapPredictionToCompatibilityData(
            geneticProbability as unknown as Parameters<typeof mapPredictionToCompatibilityData>[0],
            inbreedingAnalysis as unknown as Parameters<typeof mapPredictionToCompatibilityData>[1]
          );
          if (!base) return null;
          return {
            ...base,
            pedigreeTree: mapLineageToPedigreeTree(
              lineageAnalysis as unknown as Parameters<typeof mapLineageToPedigreeTree>[0]
            ),
          };
        })()
      : null;
  const loadingPreview = Boolean(
    selectedSire && selectedDam && (loadingGenetic || loadingInbreeding || loadingLineage)
  );

  // Determine if this is the user's first-ever breed (milestone check)
  const userRecord = user as unknown as Record<string, unknown> | undefined;
  const settingsRecord = userRecord?.settings as Record<string, unknown> | undefined;
  const milestonesRecord = settingsRecord?.milestones as Record<string, unknown> | undefined;
  const isFirstBreed = !milestonesRecord?.firstBreed;

  // Breeding mutation
  //
  // Equoria-q7no: backend POST /horses/foals returns a pregnancy initiation
  // payload — { pregnancyStarted, damId, sireId, foalDueDate } — NOT a foal.
  // The foal is created 7 days later by the foaling job. We track both response
  // shapes here so older deployments that return `foal` still work.
  type BreedingMutationResult =
    | { kind: 'pregnancy'; message: string; foalDueDate?: string }
    | { kind: 'foal'; message: string; foalId: number };

  const breedingMutation = useMutation<BreedingMutationResult, Error, void>({
    mutationFn: async () => {
      if (!selectedSire || !selectedDam || !userId) {
        throw new Error('Missing required data for breeding');
      }
      const response = await breedingApi.breedFoal({
        sireId: selectedSire.id,
        damId: selectedDam.id,
        userId: userId != null ? String(userId) : undefined,
      });

      // Pregnancy-flow response (current contract): backend started an in-foal
      // pregnancy on the dam. No foal exists yet.
      if (response.pregnancyStarted) {
        return {
          kind: 'pregnancy',
          message: response.message || 'Breeding successful! Your mare is now in foal.',
          foalDueDate: response.foalDueDate,
        };
      }

      // Legacy / future direct-foal response.
      if (response.foal?.id || response.foalId) {
        return {
          kind: 'foal',
          message: response.message || 'Breeding successful!',
          foalId: response.foal?.id ?? response.foalId!,
        };
      }

      throw new Error(
        response.message ||
          'Breeding response did not include pregnancy or foal data. Please try again.'
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['horses', userId] });
      queryClient.invalidateQueries({ queryKey: ['foals'] });

      // Build the success message — include foal due date when available.
      let message = data.message;
      if (data.kind === 'pregnancy' && data.foalDueDate) {
        const due = new Date(data.foalDueDate);
        if (!Number.isNaN(due.getTime())) {
          message = `${data.message} Foal due ${formatDate(due)}.`;
        }
      }
      setSuccessMessage(message);
      setShowConfirmation(false);

      // Reward toast on breeding/foal-birth milestone (Equoria-55bo.1,
      // Spec 11.3.10). Sourced from the real breeding mutation result —
      // a pregnancy start or a direct foal birth is a meaningful
      // milestone. Fired once per successful breed.
      notify({
        type: 'foal-born',
        title:
          data.kind === 'foal'
            ? 'A foal is born!'
            : isFirstBreed
              ? 'First breeding successful!'
              : 'Breeding successful!',
        message:
          data.kind === 'pregnancy'
            ? `${selectedDam?.name ?? 'Your mare'} is now in foal.`
            : `${selectedDam?.name ?? 'Your mare'} and ${selectedSire?.name ?? 'sire'} have a new foal.`,
        meaningful: true,
      });

      if (isFirstBreed) {
        // Lifetime first: full cinematic (Epic 28-2 / 28-3)
        setShowFoalCinematic(true);
      }

      // Only navigate to /foals/:id when we actually have a foal (legacy
      // direct-foal response). Pregnancy responses stay on this page so the
      // user can see the success banner; the foal will appear in their stable
      // after the foaling job runs.
      if (data.kind === 'foal') {
        setTimeout(
          () => {
            navigate(`/foals/${data.foalId}`);
          },
          isFirstBreed ? 3500 : 2000
        );
      }
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to initiate breeding. Please try again.');
      setShowConfirmation(false);
    },
  });

  const handleConfirmBreeding = () => {
    setErrorMessage(null);
    breedingMutation.mutate();
  };

  useEffect(() => {
    setErrorMessage(null);
  }, [selectedSire, selectedDam]);

  const studFee = selectedSire ? calculateStudFee(selectedSire) : 0;
  const totalCost = studFee + FLAT_BREEDING_FEE;

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loadingHorses) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--gold-400)] border-r-transparent" />
          <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            Loading horses…
          </p>
        </div>
      </div>
    );
  }

  if (horsesError) {
    return (
      <div className="glass-panel rounded-2xl border border-red-500/30 p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
            Failed to load horses. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Success banner (repeat breeders — no cinematic) */}
      {successMessage && !showFoalCinematic && (
        <div className="glass-panel rounded-2xl border border-[var(--role-success-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="glass-panel rounded-2xl border border-red-500/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Compatibility API warning */}
      {compatibilityError && selectedSire && selectedDam && (
        <div className="glass-panel rounded-2xl border border-[var(--dialog-header-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[var(--gold-400)]" />
            <p className="text-xs text-[var(--gold-400)] font-[var(--font-body)]">
              Compatibility analysis unavailable — you may still proceed with breeding.
            </p>
          </div>
        </div>
      )}

      {/* Horse selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-panel rounded-2xl border border-[var(--btn-glass-border)] p-4">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-3">
            Sire (Stallion)
          </p>
          <HorseSelector
            horses={horses || []}
            selectedHorse={selectedSire}
            onSelect={setSelectedSire}
            filter="male"
            title="Select Sire"
          />
        </div>
        <div className="glass-panel rounded-2xl border border-[var(--btn-glass-border)] p-4">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-3">
            Dam (Mare)
          </p>
          <HorseSelector
            horses={horses || []}
            selectedHorse={selectedDam}
            onSelect={setSelectedDam}
            filter="female"
            title="Select Dam"
          />
        </div>
      </div>

      {/* 4-tab CompatibilityPreview — real backend genetics (Equoria-to87r) */}
      {selectedSire && selectedDam && (
        <>
          {geneticError && !loadingPreview && (
            <div
              role="alert"
              className="glass-panel rounded-2xl border border-red-500/40 p-4 mb-3 flex items-start gap-2 text-sm text-red-300 font-[var(--font-body)]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Breeding genetics prediction is unavailable right now. Compatibility figures are
                intentionally hidden rather than estimated — try again shortly.
              </span>
            </div>
          )}
          <CompatibilityPreview
            mareName={selectedDam.name}
            stallionName={selectedSire.name}
            data={previewData}
            isLoading={loadingPreview}
          />
        </>
      )}

      {/* Legacy compatibility display (fallback for numeric scores) */}
      {compatibilityData && (
        <div className="glass-panel rounded-2xl border border-[var(--btn-glass-border)] p-4">
          <CompatibilityDisplay
            compatibility={compatibilityData}
            isLoading={loadingCompatibility}
          />
        </div>
      )}

      {/* Equoria-wodz — lethal-foal warning. Renders above the predictions
          panel so the player sees the risk BEFORE expanding the chart. */}
      {selectedSire && selectedDam && (
        <LethalWhiteWarning sireId={selectedSire.id} damId={selectedDam.id} />
      )}

      {/* Breeding Predictions — collapsible */}
      {selectedSire && selectedDam && (
        <div className="glass-panel rounded-2xl border border-[var(--btn-glass-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPredictions((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--dialog-close-hover-bg)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-[var(--gold-400)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--cream)] font-[var(--font-body)]">
                Trait Predictions
              </span>
            </div>
            {showPredictions ? (
              <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
            )}
          </button>
          {showPredictions && (
            <div className="px-4 pb-4 border-t border-[var(--btn-glass-border)]">
              <BreedingPredictionsPanel sireId={selectedSire.id} damId={selectedDam.id} />
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown + action row */}
      <div className="glass-panel rounded-2xl border border-[var(--glass-border)] px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Cost breakdown */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
              Cost Breakdown
            </p>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
                  Stud Fee
                </p>
                <p className="text-lg font-bold text-[var(--cream)] font-[var(--font-heading)] tabular-nums">
                  <Currency amount={studFee} />
                </p>
              </div>
              <span className="text-[var(--text-muted)] text-sm">+</span>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
                  Breeding Fee
                </p>
                <p className="text-lg font-bold text-[var(--cream)] font-[var(--font-heading)] tabular-nums">
                  <Currency amount={FLAT_BREEDING_FEE} />
                </p>
              </div>
              <span className="text-[var(--text-muted)] text-sm">=</span>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
                  Total
                </p>
                <p className="text-xl font-bold text-[var(--gold-400)] font-[var(--font-heading)] tabular-nums">
                  <Currency amount={totalCost} />
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => setShowConfirmation(true)}
            disabled={!selectedSire || !selectedDam || breedingMutation.isPending}
            className={[
              'flex-shrink-0 rounded-full px-8 py-3 text-sm font-bold transition-all',
              'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)]',
              'hover:brightness-110 hover:shadow-[var(--glow-gold-strong)]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:shadow-none',
              'font-[var(--font-heading)]',
            ].join(' ')}
          >
            {breedingMutation.isPending ? 'Processing…' : 'Initiate Breeding'}
          </button>
        </div>
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

      {/* Cinematic foal birth — lifetime-first only (Epic 28-2/28-3).
          Backend now returns a pregnancy-started payload (no foal yet), so the
          subtitle is anchored to the dam name instead of a foal name. */}
      {showFoalCinematic && (
        <CinematicMoment
          variant="foal-birth"
          title={
            breedingMutation.data?.kind === 'pregnancy'
              ? 'Your Mare is in Foal!'
              : 'A Foal is Born!'
          }
          subtitle={selectedDam?.name ? `Dam: ${selectedDam.name}` : undefined}
          onDismiss={() => setShowFoalCinematic(false)}
        />
      )}
    </div>
  );
};

export default BreedingPairSelection;
