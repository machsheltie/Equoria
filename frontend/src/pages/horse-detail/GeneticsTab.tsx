/**
 * GeneticsTab — lazy sub-panel for HorseDetailPage (Equoria-r22q)
 *
 * Displays epigenetic traits, trait interactions, and development timeline
 * for a horse. Extracted from HorseDetailPage.tsx to enable React.lazy()
 * code-splitting so this ~630-line module only loads when the Genetics tab
 * is first selected.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Filter, Sparkles, TrendingUp, Shield, Award } from 'lucide-react';
import TraitCard from '../../components/TraitCard';
import HiddenTraitIndicator from '../../components/traits/HiddenTraitIndicator';
import LiveTraitDetailModal from '../../components/traits/LiveTraitDetailModal';
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
  // Used to (a) decorate trait cards with a backend-driven valence badge and
  // (b) drive the detail modal's beneficial/detrimental banner.
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
  const [filterType, setFilterType] = useState<'all' | 'epigenetic'>('all');
  const [filterRarity, setFilterRarity] = useState<'all' | 'common' | 'rare' | 'legendary'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'sire' | 'dam' | 'mutation'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'strength' | 'discoveryDate'>('name');

  // Filter and sort functions
  const getFilteredAndSortedTraits = () => {
    if (!epigeneticData?.traits) return [];

    let filtered = [...epigeneticData.traits];

    // Apply filters
    if (filterType !== 'all') {
      filtered = filtered.filter((trait) => trait.type === filterType);
    }
    if (filterRarity !== 'all') {
      filtered = filtered.filter((trait) => trait.rarity === filterRarity);
    }
    if (filterSource !== 'all') {
      filtered = filtered.filter((trait) => trait.source === filterSource);
    }

    // Apply sorting
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
  };

  const filteredTraits = getFilteredAndSortedTraits();

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
      {/* Filters and Sorting */}
      <div className="bg-[rgba(15,35,70,0.4)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-[rgb(160,175,200)] mr-2" />
          <h4 className="font-semibold text-[rgb(220,235,255)]">Filters &amp; Sorting</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'epigenetic')}
              className="celestial-input w-full"
            >
              <option value="all">All Types</option>
              <option value="epigenetic">Epigenetic</option>
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Rarity</label>
            <select
              value={filterRarity}
              onChange={(e) =>
                setFilterRarity(e.target.value as 'all' | 'common' | 'rare' | 'legendary')
              }
              className="celestial-input w-full"
            >
              <option value="all">All Rarities</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Source</label>
            <select
              value={filterSource}
              onChange={(e) =>
                setFilterSource(e.target.value as 'all' | 'sire' | 'dam' | 'mutation')
              }
              className="celestial-input w-full"
            >
              <option value="all">All Sources</option>
              <option value="sire">From Sire</option>
              <option value="dam">From Dam</option>
              <option value="mutation">Mutation</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'name' | 'rarity' | 'strength' | 'discoveryDate')
              }
              className="celestial-input w-full"
            >
              <option value="name">Name (A-Z)</option>
              <option value="rarity">Rarity (High to Low)</option>
              <option value="strength">Strength (High to Low)</option>
              <option value="discoveryDate">Discovery Date (Recent First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Genetic Overview Section */}
      {allTraits.length > 0 && (
        <div className="glass-panel p-6 rounded-lg border border-burnished-gold/30">
          <h3 className="fantasy-title text-2xl text-[rgb(220,235,255)] mb-6 flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-burnished-gold" />
            Genetic Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Genetic Potential */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Genetic Potential
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {(() => {
                  const rarityScores = allTraits.map((t) =>
                    t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                  );
                  const avgScore = Math.round(
                    rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                  );
                  return avgScore;
                })()}
                /100
              </div>
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const rarityScores = allTraits.map((t) =>
                      t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                    );
                    const avgScore = Math.round(
                      rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                    );
                    return avgScore >= 80
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : avgScore >= 60
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : avgScore >= 40
                          ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
                          : 'bg-gradient-to-r from-slate-400/60 to-slate-400/40';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const rarityScores = allTraits.map((t) =>
                        t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                      );
                      return Math.round(
                        rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                      );
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                Based on {allTraits.length} trait{allTraits.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Trait Strength — Equoria-e1ccb: the former "Trait Stability"
                metric divided genetic-count / total, which was ALWAYS 0% since
                the live data has no genetic traits. Replaced with an honest
                metric derived from real per-trait strength (the dominance score
                the backend supplies via traitAnalysis.dominantTraits). */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-1" />
                Avg Trait Strength
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {(() => {
                  const totalCount = allTraits.length;
                  const avgStrength =
                    totalCount > 0
                      ? Math.round(allTraits.reduce((sum, t) => sum + t.strength, 0) / totalCount)
                      : 0;
                  return avgStrength;
                })()}
                %
              </div>
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const totalCount = allTraits.length;
                    const avgStrength =
                      totalCount > 0
                        ? Math.round(allTraits.reduce((sum, t) => sum + t.strength, 0) / totalCount)
                        : 0;
                    return avgStrength >= 75
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : avgStrength >= 50
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-burnished-gold to-aged-bronze';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const totalCount = allTraits.length;
                      return totalCount > 0
                        ? Math.round(allTraits.reduce((sum, t) => sum + t.strength, 0) / totalCount)
                        : 0;
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                {allTraits.filter((t) => t.strength >= 60).length} dominant / {allTraits.length}{' '}
                total
              </p>
            </div>

            {/* Breeding Value */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Award className="w-4 h-4 mr-1" />
                Breeding Value
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {(() => {
                  const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
                  const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                  const value = Math.min(
                    100,
                    legendaryCount * 30 + rareCount * 10 + allTraits.length * 2
                  );
                  return value;
                })()}
                /100
              </div>
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
                    const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                    const value = Math.min(
                      100,
                      legendaryCount * 30 + rareCount * 10 + allTraits.length * 2
                    );
                    return value >= 70
                      ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
                      : value >= 40
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-slate-400/60 to-slate-400/40';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const legendaryCount = allTraits.filter(
                        (t) => t.rarity === 'legendary'
                      ).length;
                      const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                      return Math.min(
                        100,
                        legendaryCount * 30 + rareCount * 10 + allTraits.length * 2
                      );
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                {allTraits.filter((t) => t.rarity !== 'common').length} rare+ traits
              </p>
            </div>

            {/* Optimal Combinations */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                Optimal Combos
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 75).length || 0}
              </div>
              <div className="text-sm text-[rgb(160,175,200)] mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 50 && i.strength < 75)
                  .length || 0}{' '}
                good
              </div>
              <p className="text-xs text-[rgb(160,175,200)] mt-2">High-value trait synergies</p>
            </div>
          </div>

          {/* Breeding Recommendations */}
          {interactionsData?.interactions &&
            interactionsData.interactions.some((i) => i.strength >= 75) && (
              <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                <p className="text-sm text-emerald-400 flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  <strong>Prime Breeding Candidate:</strong>&nbsp;This horse has{' '}
                  {interactionsData.interactions.filter((i) => i.strength >= 75).length} optimal
                  trait combination
                  {interactionsData.interactions.filter((i) => i.strength >= 75).length !== 1
                    ? 's'
                    : ''}{' '}
                  making them highly valuable for breeding programs.
                </p>
              </div>
            )}
        </div>
      )}

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

      {/* Trait Interactions Section */}
      {interactionsData?.interactions && interactionsData.interactions.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Trait Interactions ({interactionsData.interactions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interactionsData.interactions.map((interaction, index) => (
              <div
                key={index}
                className="p-4 bg-[rgba(37,99,235,0.08)] rounded-lg border border-purple-500/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-purple-400">
                    {interaction.trait1} + {interaction.trait2}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      interaction.strength >= 75
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : interaction.strength >= 50
                          ? 'bg-burnished-gold/20 text-burnished-gold'
                          : 'bg-[rgba(37,99,235,0.15)] text-slate-400'
                    }`}
                  >
                    Strength: {interaction.strength}
                  </span>
                </div>
                <p className="text-sm text-[rgb(220,235,255)]">{interaction.effect}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trait Timeline Section */}
      {timelineData?.timeline && timelineData.timeline.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Trait Development Timeline ({timelineData.timeline.length})
          </h3>
          <div className="space-y-3">
            {timelineData.timeline.map((entry) => {
              // Equoria-yzar3: eventType is a humanized label derived from the
              // real backend `type` discriminator (e.g. 'Trait Discovery',
              // 'Significant Interaction'). It is GUARANTEED defined by the
              // hook mapper, but we still guard the .charAt access so a future
              // shape regression can never crash the whole Genetics tab.
              const eventLabel = entry.eventType ?? 'Event';
              const eventTypeKey = eventLabel.toLowerCase();
              const badgeClass = eventTypeKey.includes('discover')
                ? 'bg-purple-500/20 text-purple-400'
                : eventTypeKey.includes('interaction')
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : eventTypeKey.includes('mutat')
                    ? 'bg-burnished-gold/20 text-burnished-gold'
                    : 'bg-blue-500/20 text-blue-400';
              return (
                <div
                  key={entry.id}
                  className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border-l-4 border-[rgba(37,99,235,0.5)]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-semibold ${badgeClass}`}
                      >
                        {eventLabel}
                      </span>
                      <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                        {entry.traitName}
                      </span>
                    </div>
                    <span className="text-xs text-[rgb(160,175,200)]">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-sm text-[rgb(220,235,255)] mb-2">{entry.description}</p>
                  )}
                  {entry.source && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[rgb(160,175,200)]">
                        Source: <span className="capitalize font-semibold">{entry.source}</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Traits Message */}
      {filteredTraits.length === 0 && (
        <div className="text-center py-8 text-[rgb(160,175,200)]">
          <p>No traits match the current filters.</p>
        </div>
      )}

      {/* Lineage Section with Genetic Contribution */}
      {horse.parentIds && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Lineage &amp; Genetic Contribution
          </h3>

          {/* Genetic Contribution Visualization */}
          {allTraits.length > 0 && (
            <div className="mb-6 p-4 glass-panel rounded-lg border border-[rgba(37,99,235,0.2)]">
              <h4 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3">
                Genetic Contribution
              </h4>

              {(() => {
                const sireTraits = allTraits.filter((t) => t.source === 'sire').length;
                const damTraits = allTraits.filter((t) => t.source === 'dam').length;
                const mutationTraits = allTraits.filter((t) => t.source === 'mutation').length;
                const inheritedTotal = sireTraits + damTraits;

                const sirePercentage =
                  inheritedTotal > 0 ? Math.round((sireTraits / inheritedTotal) * 100) : 0;
                const damPercentage =
                  inheritedTotal > 0 ? Math.round((damTraits / inheritedTotal) * 100) : 0;

                return (
                  <>
                    {/* Contribution Bar */}
                    <div className="flex h-8 rounded-lg overflow-hidden border border-[rgba(37,99,235,0.3)] mb-3">
                      {sireTraits > 0 && (
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${sirePercentage}%` }}
                        >
                          {sirePercentage}%
                        </div>
                      )}
                      {damTraits > 0 && (
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${damPercentage}%` }}
                        >
                          {damPercentage}%
                        </div>
                      )}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-600"></div>
                        <span className="text-[rgb(220,235,255)]">
                          Sire: <strong>{sireTraits}</strong> ({sirePercentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-purple-600"></div>
                        <span className="text-[rgb(220,235,255)]">
                          Dam: <strong>{damTraits}</strong> ({damPercentage}%)
                        </span>
                      </div>
                      {mutationTraits > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-gradient-to-r from-burnished-gold to-aged-bronze"></div>
                          <span className="text-[rgb(220,235,255)]">
                            Mutations: <strong>{mutationTraits}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Analysis */}
                    {inheritedTotal > 0 && (
                      <div className="mt-3 pt-3 border-t border-[rgba(37,99,235,0.2)]">
                        <p className="text-xs text-[rgb(160,175,200)]">
                          {sirePercentage > damPercentage + 10 ? (
                            <>
                              <strong>Sire-Dominant:</strong> This horse inherited significantly
                              more traits from the sire lineage.
                            </>
                          ) : damPercentage > sirePercentage + 10 ? (
                            <>
                              <strong>Dam-Dominant:</strong> This horse inherited significantly more
                              traits from the dam lineage.
                            </>
                          ) : (
                            <>
                              <strong>Balanced Inheritance:</strong> This horse has a well-balanced
                              genetic contribution from both parents.
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Parent Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {horse.parentIds.sireId && (
              <button
                onClick={() => (window.location.href = `/horses/${horse.parentIds!.sireId}`)}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-burnished-gold/50 transition-colors text-left"
              >
                <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Sire</p>
                <p className="fantasy-body text-[rgb(220,235,255)]">View Sire Details &rarr;</p>
              </button>
            )}
            {horse.parentIds.damId && (
              <button
                onClick={() => (window.location.href = `/horses/${horse.parentIds!.damId}`)}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-burnished-gold/50 transition-colors text-left"
              >
                <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Dam</p>
                <p className="fantasy-body text-[rgb(220,235,255)]">View Dam Details &rarr;</p>
              </button>
            )}
          </div>
        </div>
      )}

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
