/**
 * GeneticOverviewCard — four-card summary (Genetic Potential, Avg Trait
 * Strength, Breeding Value, Optimal Combos) plus the prime-breeding-
 * candidate recommendation banner.
 * Equoria-kdduk: extracted from GeneticsTab.tsx. Equoria-e1ccb context
 * preserved: Trait Strength replaces the always-zero Trait Stability
 * metric; the metric is the average of trait.strength (the backend's
 * dominance score), not a synthetic genetic-vs-total ratio.
 *
 * Palette migration (design exception `palette-classes` retired): the raw
 * emerald/blue/slate tier gradients are now semantic tokens, and each tier
 * carries its band as a visible text label beside the figures it explains,
 * so the band survives for a reader who cannot separate the fill colours. The
 * bars themselves are now marked decorative — every value and band they encode
 * is real text. Band thresholds are unchanged.
 */

import React from 'react';
import { Award, Shield, Sparkles, TrendingUp } from 'lucide-react';
import type { EpigeneticTrait, TraitInteraction } from '../../../hooks/useHorseGenetics';

interface GeneticOverviewCardProps {
  allTraits: EpigeneticTrait[];
  interactions: TraitInteraction[] | undefined;
}

/**
 * A metric band. `label` is the non-colour carrier: the band boundaries are
 * invisible, so without it the tier is legible only to a reader who can tell
 * the fill colours apart. Band vocabulary follows the existing ladders in
 * `components/breeding/BreedingInsightsCard.tsx` (Exceptional / Excellent /
 * Good / Average / Below Average) and `components/trainer/
 * TrainerDiscoveryPanel.tsx` (Strong / Moderate / Mild) — no new vocabulary.
 */
interface Tier {
  label: string;
  barClass: string;
}

const GeneticOverviewCard: React.FC<GeneticOverviewCardProps> = ({ allTraits, interactions }) => {
  if (allTraits.length === 0) return null;

  // Genetic Potential — average of rarity scores.
  const rarityScores = allTraits.map((t) =>
    t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
  );
  const avgScore = Math.round(rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length);
  const potentialTier: Tier =
    avgScore >= 80
      ? { label: 'Exceptional', barClass: 'bg-[var(--status-success)]' }
      : avgScore >= 60
        ? { label: 'Excellent', barClass: 'bg-[var(--status-info)]' }
        : avgScore >= 40
          ? { label: 'Good', barClass: 'bg-[var(--gold-primary)]' }
          : { label: 'Average', barClass: 'bg-[var(--role-neutral-text)]' };

  // Avg Trait Strength — Equoria-e1ccb honest replacement for the
  // always-zero "Trait Stability" metric.
  const totalCount = allTraits.length;
  const avgStrength =
    totalCount > 0 ? Math.round(allTraits.reduce((sum, t) => sum + t.strength, 0) / totalCount) : 0;
  const strengthTier: Tier =
    avgStrength >= 75
      ? { label: 'Strong', barClass: 'bg-[var(--status-success)]' }
      : avgStrength >= 50
        ? { label: 'Moderate', barClass: 'bg-[var(--status-info)]' }
        : { label: 'Mild', barClass: 'bg-[var(--gold-primary)]' };
  const dominantCount = allTraits.filter((t) => t.strength >= 60).length;

  // Breeding Value — weighted by rarity.
  const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
  const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
  const breedingValue = Math.min(100, legendaryCount * 30 + rareCount * 10 + allTraits.length * 2);
  const breedingTier: Tier =
    breedingValue >= 70
      ? { label: 'Exceptional', barClass: 'bg-[var(--gold-primary)]' }
      : breedingValue >= 40
        ? { label: 'Good', barClass: 'bg-[var(--status-info)]' }
        : { label: 'Below Average', barClass: 'bg-[var(--role-neutral-text)]' };
  const rarePlusCount = allTraits.filter((t) => t.rarity !== 'common').length;

  // Optimal trait synergies.
  const optimalCount = interactions?.filter((i) => i.strength >= 75).length ?? 0;
  const goodCount = interactions?.filter((i) => i.strength >= 50 && i.strength < 75).length ?? 0;

  return (
    <div className="glass-panel p-6 rounded-lg border border-[var(--alpha-gold-primary-30)]">
      <h3 className="type-section-heading text-2xl mb-6 flex items-center">
        <Sparkles className="w-6 h-6 mr-2 text-[var(--gold-primary)]" />
        Genetic Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Genetic Potential */}
        <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
          <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
            <TrendingUp className="w-4 h-4 mr-1" />
            Genetic Potential
          </div>
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{avgScore}/100</div>
          <div
            className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div className={`h-full ${potentialTier.barClass}`} style={{ width: `${avgScore}%` }} />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">
            <span className="font-semibold text-[rgb(220,235,255)]">{potentialTier.label}</span> ·
            based on {allTraits.length} trait{allTraits.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Avg Trait Strength */}
        <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
          <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
            <Shield className="w-4 h-4 mr-1" />
            Avg Trait Strength
          </div>
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{avgStrength}%</div>
          <div
            className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className={`h-full ${strengthTier.barClass}`}
              style={{ width: `${avgStrength}%` }}
            />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">
            <span className="font-semibold text-[rgb(220,235,255)]">{strengthTier.label}</span> ·{' '}
            {dominantCount} dominant / {allTraits.length} total
          </p>
        </div>

        {/* Breeding Value */}
        <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
          <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
            <Award className="w-4 h-4 mr-1" />
            Breeding Value
          </div>
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{breedingValue}/100</div>
          <div
            className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className={`h-full ${breedingTier.barClass}`}
              style={{ width: `${breedingValue}%` }}
            />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">
            <span className="font-semibold text-[rgb(220,235,255)]">{breedingTier.label}</span> ·{' '}
            {rarePlusCount} rare+ traits
          </p>
        </div>

        {/* Optimal Combinations */}
        <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
          <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
            <Sparkles className="w-4 h-4 mr-1" />
            Optimal Combos
          </div>
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{optimalCount}</div>
          <div className="text-sm text-[rgb(160,175,200)] mb-2">{goodCount} good</div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">High-value trait synergies</p>
        </div>
      </div>

      {/* Breeding Recommendations */}
      {optimalCount > 0 && (
        <div className="mt-4 p-4 bg-[var(--role-success-bg)] rounded-lg border border-[var(--role-success-border)]">
          <p className="text-sm text-[var(--role-success-text)] flex items-center">
            <Award className="w-4 h-4 mr-2" />
            <strong>Prime Breeding Candidate:</strong>&nbsp;This horse has {optimalCount} optimal
            trait combination
            {optimalCount !== 1 ? 's' : ''} making them highly valuable for breeding programs.
          </p>
        </div>
      )}
    </div>
  );
};

export default GeneticOverviewCard;
