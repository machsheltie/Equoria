/**
 * GeneticsTab — lazy sub-panel for HorseDetailPage (Equoria-r22q)
 *
 * Displays epigenetic traits, trait interactions, and development timeline
 * for a horse. Extracted from HorseDetailPage.tsx to enable React.lazy()
 * code-splitting so this module only loads when the Genetics tab is
 * first selected.
 *
 * Equoria-kdduk (2026-05-29): further split into ./genetics/* sub-
 * components — TraitFilters, GeneticOverviewCard, TraitInteractionsSection,
 * TraitTimelineSection, LineageSection — so this orchestrator stays under
 * the 600-line page cap.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import TraitCard from '../../components/TraitCard';
import HiddenTraitIndicator from '../../components/traits/HiddenTraitIndicator';
import LiveTraitDetailModal from '../../components/traits/LiveTraitDetailModal';
import BehavioralFlagsPanel from '../../components/traits/BehavioralFlagsPanel';
import {
  useHorseEpigeneticInsights,
  useHorseTraitInteractions,
  useHorseTraitTimeline,
} from '../../hooks/useHorseGenetics';
import {
  useHorseTraits,
  useHorseTraitDiscoveryStatus,
  useDiscoverTraits,
  type HorseTrait,
} from '../../hooks/useHorseTraits';
import type { Horse } from './HorseDetailPageTypes';
import TraitFilters, {
  type FilterRarityValue,
  type FilterSourceValue,
  type FilterTypeValue,
  type SortByValue,
} from './genetics/TraitFilters';
import GeneticOverviewCard from './genetics/GeneticOverviewCard';
import TraitInteractionsSection from './genetics/TraitInteractionsSection';
import TraitTimelineSection from './genetics/TraitTimelineSection';
import LineageSection from './genetics/LineageSection';

/** Extract a human-readable message from an unknown thrown error/ApiError. */
function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return 'Trait discovery failed. Please try again.';
}

/** Normalize a trait name/key to a comparable token for valence lookup. */
function normalizeTraitToken(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

const GeneticsTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Fetch genetics data using hooks
  const {
    data: epigeneticData,
    isLoading: epigeneticLoading,
    error: epigeneticError,
  } = useHorseEpigeneticInsights(horse.id);

  const {
    data: interactionsData,
    isLoading: interactionsLoading,
    error: interactionsError,
  } = useHorseTraitInteractions(horse.id);

  const {
    data: timelineData,
    isLoading: timelineLoading,
    error: timelineError,
  } = useHorseTraitTimeline(horse.id);

  // Authoritative trait classification (positive/negative/hidden) — Equoria-6rf97.
  const { data: classification } = useHorseTraits(horse.id);

  // Hidden-trait discovery status — Equoria-hriey.
  const { data: discoveryStatus } = useHorseTraitDiscoveryStatus(horse.id);
  const discoverMutation = useDiscoverTraits(horse.id);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverMessage, setDiscoverMessage] = useState<string | null>(null);

  // Detail modal state — Equoria-vpgmc.
  const [selectedTrait, setSelectedTrait] = useState<HorseTrait | null>(null);

  // name/key → HorseTrait lookup (normalized) for valence + modal payload.
  const traitByToken = useMemo(() => {
    const map = new Map<string, HorseTrait>();
    if (classification) {
      for (const t of [...classification.positive, ...classification.negative]) {
        map.set(normalizeTraitToken(t.key), t);
        map.set(normalizeTraitToken(t.name), t);
      }
    }
    return map;
  }, [classification]);

  const handleDiscover = async () => {
    setDiscoverError(null);
    setDiscoverMessage(null);
    try {
      const result = await discoverMutation.mutateAsync();
      const revealed = result?.summary?.totalTraitsRevealed ?? result?.traitsRevealed?.length ?? 0;
      setDiscoverMessage(
        revealed > 0
          ? `Discovered ${revealed} new trait${revealed !== 1 ? 's' : ''}!`
          : 'No new traits were ready to be discovered yet.'
      );
    } catch (err) {
      // Surface the REAL backend eligibility reason (e.g. age ineligibility).
      setDiscoverError(errorMessage(err));
    }
  };

  // Filter and sort state.
  // Equoria-e1ccb: the epigenetic-insights endpoint (traitAnalysis.traits =
  // horse.epigeneticFlags) exposes ONLY epigenetic traits — the backend draws
  // no genetic-vs-epigenetic distinction here. A "genetic" filter option +
  // "Genetic Traits" section were therefore permanently empty/misleading and
  // have been removed. The type filter is retained (collapsed to all/epigenetic)
  // so the control's contract stays stable for future genetic-trait data.
  const [filterType, setFilterType] = useState<FilterTypeValue>('all');
  const [filterRarity, setFilterRarity] = useState<FilterRarityValue>('all');
  const [filterSource, setFilterSource] = useState<FilterSourceValue>('all');
  const [sortBy, setSortBy] = useState<SortByValue>('name');

  // Filter and sort
  const filteredTraits = useMemo(() => {
    if (!epigeneticData?.traits) return [];

    let filtered = [...epigeneticData.traits];

    if (filterType !== 'all') {
      filtered = filtered.filter((trait) => trait.type === filterType);
    }
    if (filterRarity !== 'all') {
      filtered = filtered.filter((trait) => trait.rarity === filterRarity);
    }
    if (filterSource !== 'all') {
      filtered = filtered.filter((trait) => trait.source === filterSource);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rarity': {
          const rarityOrder = { common: 0, rare: 1, legendary: 2 };
          return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        }
        case 'strength':
          return b.strength - a.strength;
        case 'discoveryDate':
          if (!a.discoveryDate || !b.discoveryDate) return 0;
          return new Date(b.discoveryDate).getTime() - new Date(a.discoveryDate).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [epigeneticData?.traits, filterType, filterRarity, filterSource, sortBy]);

  // Equoria-e1ccb: the live data source produces epigenetic traits only, so
  // there is no separate genetic section. All filtered traits are epigenetic.
  const epigeneticTraits = filteredTraits;
  const allTraits = filteredTraits;

  // Loading state
  if (epigeneticLoading || interactionsLoading || timelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
        <span className="ml-3 text-[rgb(160,175,200)]">Loading genetics data...</span>
      </div>
    );
  }

  // Error state
  if (epigeneticError || interactionsError || timelineError) {
    return (
      <div className="glass-panel p-6 border border-red-500/30 rounded-lg">
        <div className="flex items-center text-red-400 mb-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <h4 className="font-semibold">Error Loading Genetics Data</h4>
        </div>
        <p className="text-red-400 text-sm">
          {epigeneticError?.message || interactionsError?.message || timelineError?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TraitFilters
        filterType={filterType}
        filterRarity={filterRarity}
        filterSource={filterSource}
        sortBy={sortBy}
        onChangeFilterType={setFilterType}
        onChangeFilterRarity={setFilterRarity}
        onChangeFilterSource={setFilterSource}
        onChangeSortBy={setSortBy}
      />

      <GeneticOverviewCard allTraits={allTraits} interactions={interactionsData?.interactions} />

      {/* Epigenetic Traits Section.
          Equoria-e1ccb: the standalone "Genetic Traits" section was removed —
          the epigenetic-insights endpoint never produces genetic-typed traits
          (traitAnalysis.traits = horse.epigeneticFlags), so it was permanently
          empty. All live traits render in this single epigenetic section. */}
      {epigeneticTraits.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Epigenetic Traits ({epigeneticTraits.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {epigeneticTraits.map((trait) => {
              const classified = traitByToken.get(normalizeTraitToken(trait.name));
              return (
                <TraitCard
                  key={`${trait.name}-${trait.type}`}
                  trait={trait}
                  valence={classified?.valence}
                  onSelect={classified ? () => setSelectedTrait(classified) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden Traits & Discovery Section (Equoria-hriey) */}
      {discoveryStatus && (
        <div data-testid="hidden-traits-section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="fantasy-title text-xl text-[rgb(220,235,255)]">Trait Discovery</h3>
            {discoveryStatus.hiddenTraits > 0 &&
              (() => {
                // Equoria-9zmc4: pre-disable when the backend says the horse is
                // not yet eligible (canDiscover === false), surfacing the reason
                // as a tooltip/hint BEFORE the round-trip. The real backend 400
                // path (handleDiscover catch) remains the fallback for races
                // where eligibility changes between fetch and click.
                const ineligible = discoveryStatus.canDiscover === false;
                const reason = discoveryStatus.cannotDiscoverReason;
                const isDisabled = discoverMutation.isPending || ineligible;
                return (
                  <button
                    type="button"
                    data-testid="discover-traits-button"
                    onClick={handleDiscover}
                    disabled={isDisabled}
                    title={ineligible ? reason : undefined}
                    aria-disabled={isDisabled}
                    aria-describedby={ineligible ? 'discover-ineligible-hint' : undefined}
                    className="btn-cobalt text-sm px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {discoverMutation.isPending ? 'Discovering…' : 'Discover Traits'}
                  </button>
                );
              })()}
          </div>

          {/* Pre-eligibility hint (Equoria-9zmc4) — shown when the backend has
              already declared the horse not yet eligible, so the user sees the
              reason without clicking and triggering a 400. */}
          {discoveryStatus.hiddenTraits > 0 &&
            discoveryStatus.canDiscover === false &&
            discoveryStatus.cannotDiscoverReason && (
              <div
                id="discover-ineligible-hint"
                data-testid="discover-ineligible-hint"
                className="mb-3 p-3 rounded-lg border border-burnished-gold/30 bg-burnished-gold/10 text-sm text-[rgb(220,235,255)]"
              >
                {discoveryStatus.cannotDiscoverReason}
              </div>
            )}

          {discoverError && (
            <div
              data-testid="discover-error"
              role="alert"
              className="mb-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400"
            >
              {discoverError}
            </div>
          )}
          {discoverMessage && (
            <div
              data-testid="discover-message"
              role="status"
              className="mb-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-400"
            >
              {discoverMessage}
            </div>
          )}

          <HiddenTraitIndicator discoveryStatus={discoveryStatus} />
        </div>
      )}

      <TraitInteractionsSection interactions={interactionsData?.interactions} />

      <TraitTimelineSection timeline={timelineData?.timeline} />

      {/* No Traits Message */}
      {filteredTraits.length === 0 && (
        <div className="text-center py-8 text-[rgb(160,175,200)]">
          <p>No traits match the current filters.</p>
        </div>
      )}

      <LineageSection horse={horse} allTraits={allTraits} />

      {/* Behavioral Epigenetic Flags (Equoria-yzqhj.8) — the permanent
          brave/fearful/... behavioral flags from /api/v1/flags/*, distinct
          from the genetic traits above. Real API data only; honest
          loading/empty/error states inside the panel. */}
      <BehavioralFlagsPanel horseId={horse.id} />

      {/* Trait Detail Modal (Equoria-vpgmc) — opened by clicking / keyboard-
          activating a trait card. Fed by real /traits/horse/:id data. */}
      <LiveTraitDetailModal
        isOpen={selectedTrait !== null}
        onClose={() => setSelectedTrait(null)}
        trait={selectedTrait}
      />
    </div>
  );
};

export default GeneticsTab;
