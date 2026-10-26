/**
 * GeneticsTab — lazy sub-panel for HorseDetailPage (Equoria-r22q)
 *
 * Owner ruling 2026-10-26 (q72): the Genetics tab shows the horse's revealed
 * traits plus its colour genetics, and nothing else. Colour genetics stay
 * hidden until the player pays for the Veterinarian's Genetic Testing, and the
 * server withholds the genotype until then (Equoria-8tz7p).
 *
 * Old contract, removed by that ruling: Genetic Potential, Average Trait
 * Strength, Breeding Value and the "prime breeding candidate" label; per-trait
 * strength and rarity; the trait filters; the Behavioral Flags panel (it
 * repeated the trait list and showed "Unknown flag"); and the interactions,
 * timeline and lineage sections built on the same invented values
 * (Equoria-q4uem.14, Equoria-8v2y9).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import HiddenTraitIndicator from '../../components/traits/HiddenTraitIndicator';
import LiveTraitDetailModal from '../../components/traits/LiveTraitDetailModal';
import {
  useHorseTraits,
  useHorseTraitDiscoveryStatus,
  useMarkTraitsSeen,
  type HorseTrait,
} from '../../hooks/useHorseTraits';
import type { Horse } from './HorseDetailPageTypes';
import { userMessageFor } from '../../lib/http/userMessage';
import TraitList from './genetics/TraitList';
import ColourGeneticsSection from './genetics/ColourGeneticsSection';

/** Normalize a trait name/key to a comparable token. */
function normalizeTraitToken(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

const GeneticsTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Revealed traits only: the backend names no unrevealed trait (Equoria-6dace).
  const { data: classification, isLoading, error } = useHorseTraits(horse.id);

  // Hidden-trait discovery status — Equoria-hriey. Read-only: players never
  // reveal traits (Equoria-gu8jk; owner ruling 2026-10-20).
  const { data: discoveryStatus } = useHorseTraitDiscoveryStatus(horse.id);

  // First-view glow (Equoria-lylhb): a revealed trait glows once, the first time
  // its owner views it. The new ones are captured the first time the trait list
  // arrives and held for as long as this tab stays mounted; the server is told
  // they have been seen so the next visit finds them quiet.
  const markSeen = useMarkTraitsSeen(horse.id);
  const capturedGlow = useRef(false);
  const [glowTokens, setGlowTokens] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!classification || capturedGlow.current) return;
    capturedGlow.current = true;
    const fresh = [...classification.positive, ...classification.negative].filter((t) => t.isNew);
    if (fresh.length === 0) return;
    setGlowTokens(new Set(fresh.map((t) => normalizeTraitToken(t.key))));
    markSeen.mutate();
  }, [classification, markSeen]);

  // Detail modal state — Equoria-vpgmc.
  const [selectedTrait, setSelectedTrait] = useState<HorseTrait | null>(null);

  const traits = useMemo(
    () =>
      classification
        ? [...classification.positive, ...classification.negative].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        : [],
    [classification]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--gold-primary)]" />
        <span className="ml-3 text-[rgb(160,175,200)]">Loading genetics data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 border border-[var(--role-danger-border)] rounded-lg">
        <div className="flex items-center text-[var(--status-danger)] mb-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <h4 className="font-semibold">Error Loading Genetics Data</h4>
        </div>
        <p className="text-[var(--status-danger)] text-sm">{userMessageFor(error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {traits.length > 0 && (
        <section>
          <h3 className="type-section-heading mb-2">Traits ({traits.length})</h3>
          <TraitList
            traits={traits}
            glowTokens={glowTokens}
            normalize={normalizeTraitToken}
            onSelect={setSelectedTrait}
          />
        </section>
      )}

      {/* Hidden Traits & Discovery Section (Equoria-hriey) */}
      {discoveryStatus && (
        <div data-testid="hidden-traits-section">
          <h3 className="type-enchanted-accent text-[var(--text-primary)] mb-4">Trait Discovery</h3>
          <HiddenTraitIndicator discoveryStatus={discoveryStatus} />
        </div>
      )}

      <ColourGeneticsSection horseId={horse.id} />

      <LiveTraitDetailModal
        isOpen={selectedTrait !== null}
        onClose={() => setSelectedTrait(null)}
        trait={selectedTrait}
      />
    </div>
  );
};

export default GeneticsTab;
