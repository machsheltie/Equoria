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
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Dna, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { breedingApi, horsesApi, breedingPredictionApi } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';
import HorseSelector from '@/components/breeding/HorseSelector';
import CompatibilityDisplay from '@/components/breeding/CompatibilityDisplay';
import BreedingPredictionsPanel from './BreedingPredictionsPanel';
import BreedingConfirmationModal from '@/components/breeding/BreedingConfirmationModal';
import {
  CompatibilityPreview,
  type CompatibilityData,
} from '@/components/breeding/CompatibilityPreview';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import type { Horse, CompatibilityAnalysis, BreedingResponse } from '@/types/breeding';

// ── Constants ──────────────────────────────────────────────────────────────────

const FLAT_BREEDING_FEE = 200; // fixed game breeding fee (separate from stud fee)

// ── Helpers ────────────────────────────────────────────────────────────────────

function calculateStudFee(sire: Horse): number {
  const basePrice = 500;
  const levelMultiplier = sire.level || 1;
  return Math.round(basePrice * levelMultiplier);
}

/** Derive CompatibilityData from horse pair + basic compatibility scores */
function buildCompatibilityData(
  sire: Horse,
  dam: Horse,
  compatibility: CompatibilityAnalysis | null
): CompatibilityData | null {
  if (!sire.stats || !dam.stats) return null;

  const STAT_KEYS = ['speed', 'stamina', 'agility', 'intelligence', 'strength', 'health'] as const;
  const statRanges: Record<string, { min: number; avg: number; max: number }> = {};

  for (const stat of STAT_KEYS) {
    const sireVal = (sire.stats as Record<string, number>)[stat] ?? 50;
    const damVal = (dam.stats as Record<string, number>)[stat] ?? 50;
    const avg = Math.round((sireVal + damVal) / 2);
    const spread = Math.abs(sireVal - damVal);
    statRanges[stat] = {
      min: Math.max(0, Math.round(avg - spread * 0.3 - 5)),
      avg,
      max: Math.min(100, Math.round(avg + spread * 0.3 + 5)),
    };
  }

  const sireTraits = (Array.isArray(sire.traits) ? sire.traits : []).map((t) =>
    typeof t === 'string' ? t : t.name
  );
  const damTraits = (Array.isArray(dam.traits) ? dam.traits : []).map((t) =>
    typeof t === 'string' ? t : t.name
  );
  const allTraits = Array.from(new Set([...sireTraits, ...damTraits]));

  const traits = allTraits.map((name) => {
    const inSire = sireTraits.includes(name);
    const inDam = damTraits.includes(name);
    return {
      name,
      probability: inSire && inDam ? 0.95 : 0.7,
      source: (inSire && inDam ? 'both' : inSire ? 'sire' : 'dam') as
        | 'dam'
        | 'sire'
        | 'both'
        | 'recessive',
    };
  });

  // Derive inbreeding coefficient from genetic diversity (inverted, scaled)
  const inbreedingCoefficient = compatibility
    ? Math.max(0, Math.round(((100 - compatibility.geneticDiversity) / 100) * 25) / 100)
    : 0.02;

  // Pedigree overlap from shared parentIds
  const pedigreeOverlap: Array<{ ancestorName: string; generations: number }> = [];
  if (sire.parentIds && dam.parentIds) {
    if (sire.parentIds.sireId && sire.parentIds.sireId === dam.parentIds.sireId) {
      pedigreeOverlap.push({ ancestorName: 'Shared Paternal Grandsire', generations: 1 });
    }
    if (sire.parentIds.damId && sire.parentIds.damId === dam.parentIds.damId) {
      pedigreeOverlap.push({ ancestorName: 'Shared Maternal Granddam', generations: 1 });
    }
  }

  return { statRanges, traits, inbreedingCoefficient, pedigreeOverlap };
}

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
      return response.map((horse) => ({
        id: horse.id,
        name: horse.name,
        age: horse.ageYears || horse.age,
        sex: horse.sex || (horse.gender === 'male' ? 'Male' : 'Female'),
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

  // Derive CompatibilityPreview data from horse stats + compatibility scores
  const previewData: CompatibilityData | null =
    selectedSire && selectedDam
      ? buildCompatibilityData(selectedSire, selectedDam, compatibilityData ?? null)
      : null;

  // Determine if this is the user's first-ever breed (milestone check)
  const userRecord = user as unknown as Record<string, unknown> | undefined;
  const settingsRecord = userRecord?.settings as Record<string, unknown> | undefined;
  const milestonesRecord = settingsRecord?.milestones as Record<string, unknown> | undefined;
  const isFirstBreed = !milestonesRecord?.firstBreed;

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
      queryClient.invalidateQueries({ queryKey: ['horses', userId] });
      queryClient.invalidateQueries({ queryKey: ['foals'] });

      setSuccessMessage(data.message);
      setShowConfirmation(false);

      if (isFirstBreed) {
        // Lifetime first: full cinematic (Epic 28-2 / 28-3)
        setShowFoalCinematic(true);
      }

      setTimeout(
        () => {
          navigate(`/foals/${data.foal.id}`);
        },
        isFirstBreed ? 3500 : 2000
      );
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
        <div className="glass-panel rounded-2xl border border-[rgba(16,185,129,0.25)] px-5 py-4">
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
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.2)] px-5 py-3">
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
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.12)] p-4">
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
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.12)] p-4">
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

      {/* 4-tab CompatibilityPreview — shown when both selected */}
      {selectedSire && selectedDam && (
        <CompatibilityPreview
          mareName={selectedDam.name}
          stallionName={selectedSire.name}
          data={previewData}
          isLoading={loadingCompatibility}
        />
      )}

      {/* Legacy compatibility display (fallback for numeric scores) */}
      {compatibilityData && (
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.1)] p-4">
          <CompatibilityDisplay
            compatibility={compatibilityData}
            isLoading={loadingCompatibility}
          />
        </div>
      )}

      {/* Breeding Predictions — collapsible */}
      {selectedSire && selectedDam && (
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.1)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPredictions((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[rgba(201,162,39,0.04)] transition-colors"
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
            <div className="px-4 pb-4 border-t border-[rgba(201,162,39,0.1)]">
              <BreedingPredictionsPanel sireId={selectedSire.id} damId={selectedDam.id} />
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown + action row */}
      <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.15)] px-5 py-4">
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
                  ${studFee.toLocaleString()}
                </p>
              </div>
              <span className="text-[var(--text-muted)] text-sm">+</span>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
                  Breeding Fee
                </p>
                <p className="text-lg font-bold text-[var(--cream)] font-[var(--font-heading)] tabular-nums">
                  ${FLAT_BREEDING_FEE.toLocaleString()}
                </p>
              </div>
              <span className="text-[var(--text-muted)] text-sm">=</span>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
                  Total
                </p>
                <p className="text-xl font-bold text-[var(--gold-400)] font-[var(--font-heading)] tabular-nums">
                  ${totalCost.toLocaleString()}
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
              'hover:brightness-110 hover:shadow-[0_0_20px_rgba(201,162,39,0.35)]',
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

      {/* Cinematic foal birth — lifetime-first only (Epic 28-2/28-3) */}
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
