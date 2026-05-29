/**
 * GeneticOverviewCard — four-card summary (Genetic Potential, Avg Trait
 * Strength, Breeding Value, Optimal Combos) plus the prime-breeding-
 * candidate recommendation banner.
 * Equoria-kdduk: extracted from GeneticsTab.tsx. Equoria-e1ccb context
 * preserved: Trait Strength replaces the always-zero Trait Stability
 * metric; the metric is the average of trait.strength (the backend's
 * dominance score), not a synthetic genetic-vs-total ratio.
 */

import React from 'react';
import { Award, Shield, Sparkles, TrendingUp } from 'lucide-react';
import type { EpigeneticTrait, TraitInteraction } from '../../../hooks/useHorseGenetics';

interface GeneticOverviewCardProps {
  allTraits: EpigeneticTrait[];
  interactions: TraitInteraction[] | undefined;
}

const GeneticOverviewCard: React.FC<GeneticOverviewCardProps> = ({ allTraits, interactions }) => {
  if (allTraits.length === 0) return null;

  // Genetic Potential — average of rarity scores.
  const rarityScores = allTraits.map((t) =>
    t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
  );
  const avgScore = Math.round(rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length);
  const potentialBarClass =
    avgScore >= 80
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
      : avgScore >= 60
        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
        : avgScore >= 40
          ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
          : 'bg-gradient-to-r from-slate-400/60 to-slate-400/40';

  // Avg Trait Strength — Equoria-e1ccb honest replacement for the
  // always-zero "Trait Stability" metric.
  const totalCount = allTraits.length;
  const avgStrength =
    totalCount > 0 ? Math.round(allTraits.reduce((sum, t) => sum + t.strength, 0) / totalCount) : 0;
  const strengthBarClass =
    avgStrength >= 75
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
      : avgStrength >= 50
        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
        : 'bg-gradient-to-r from-burnished-gold to-aged-bronze';
  const dominantCount = allTraits.filter((t) => t.strength >= 60).length;

  // Breeding Value — weighted by rarity.
  const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
  const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
  const breedingValue = Math.min(100, legendaryCount * 30 + rareCount * 10 + allTraits.length * 2);
  const breedingBarClass =
    breedingValue >= 70
      ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
      : breedingValue >= 40
        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
        : 'bg-gradient-to-r from-slate-400/60 to-slate-400/40';
  const rarePlusCount = allTraits.filter((t) => t.rarity !== 'common').length;

  // Optimal trait synergies.
  const optimalCount = interactions?.filter((i) => i.strength >= 75).length ?? 0;
  const goodCount = interactions?.filter((i) => i.strength >= 50 && i.strength < 75).length ?? 0;

  return (
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
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{avgScore}/100</div>
          <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
            <div className={`h-full ${potentialBarClass}`} style={{ width: `${avgScore}%` }} />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">
            Based on {allTraits.length} trait{allTraits.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Avg Trait Strength */}
        <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
          <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
            <Shield className="w-4 h-4 mr-1" />
            Avg Trait Strength
          </div>
          <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">{avgStrength}%</div>
          <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
            <div className={`h-full ${strengthBarClass}`} style={{ width: `${avgStrength}%` }} />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">
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
          <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
            <div className={`h-full ${breedingBarClass}`} style={{ width: `${breedingValue}%` }} />
          </div>
          <p className="text-xs text-[rgb(160,175,200)] mt-2">{rarePlusCount} rare+ traits</p>
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
        <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
          <p className="text-sm text-emerald-400 flex items-center">
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
