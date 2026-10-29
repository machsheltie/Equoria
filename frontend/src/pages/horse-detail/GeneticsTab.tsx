/**
 * GeneticsTab — lazy sub-panel for HorseDetailPage (Equoria-r22q)
 *
 * Owner ruling 2026-10-26 (q72): the Genetics tab shows the horse's revealed
 * traits plus its color genetics, and nothing else. Color genetics stay
 * hidden until the player pays for the Veterinarian's Genetic Testing, and the
 * server withholds the genotype until then (Equoria-8tz7p).
 *
 * Old contract, removed by that ruling: Genetic Potential, Average Trait
 * Strength, Breeding Value and the "prime breeding candidate" label; per-trait
 * strength and rarity; the trait filters; the Behavioral Flags panel (it
 * repeated the trait list and showed "Unknown flag"); and the interactions,
 * timeline and lineage sections built on the same invented values
 * (Equoria-q4uem.14, Equoria-8v2y9).
 *
 * Owner rulings q174 / q213 (2026-10-28): Trait Discovery is one chip per
 * trait the horse carries: "Hidden" for each hidden trait, gold for a revealed
 * one, greyed "Inactive" for a switched-off one (TraitDiscovery). Old
 * contract, replaced by that ruling: a separate "Traits (n)" list with
 * helps/hinders lines, and a discovery panel with a progress bar, a hint and
 * "All Traits Discovered!".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import LiveTraitDetailModal from '../../components/traits/LiveTraitDetailModal';
import { useHorseTraits, useMarkTraitsSeen, type HorseTrait } from '../../hooks/useHorseTraits';
import type { Horse } from './HorseDetailPageTypes';
import { userMessageFor } from '../../lib/http/userMessage';
import TraitDiscovery from './genetics/TraitDiscovery';
import ColorGeneticsSection from './genetics/ColorGeneticsSection';
import { visitTraitDiscovery } from './genetics/visitTraitDiscovery';
import { useHorseVisitData } from './horseVisitContext';
import type { HorseVisit } from '@/lib/api/studs';

/** Normalize a trait name/key to a comparable token. */
function normalizeTraitToken(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

const OwnerGeneticsTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Revealed traits only: the backend names no unrevealed trait (Equoria-6dace).
  const { data: classification, isLoading, error } = useHorseTraits(horse.id);

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
      {classification && (
        <TraitDiscovery
          revealed={traits}
          dormant={classification.dormant}
          hiddenCount={classification.hiddenCount}
          hidden={classification.hidden}
          glowTokens={glowTokens}
          normalize={normalizeTraitToken}
          onSelect={setSelectedTrait}
        />
      )}

      <ColorGeneticsSection horseId={horse.id} />

      <LiveTraitDetailModal
        isOpen={selectedTrait !== null}
        onClose={() => setSelectedTrait(null)}
        trait={selectedTrait}
      />
    </div>
  );
};

const noGlow: ReadonlySet<string> = new Set();
const sameToken = (value: string) => value;

/**
 * A visitor's Genetics tab (q205): the same Trait Discovery chips, read from
 * the visit — revealed and dormant traits by name, hidden ones as a count. The
 * colour genetics are the genotype, which no visitor is shown.
 */
const VisitorGeneticsTab: React.FC<{ visit: HorseVisit }> = ({ visit }) => {
  const discovery = visitTraitDiscovery(visit);
  const [selectedTrait, setSelectedTrait] = useState<HorseTrait | null>(null);
  return (
    <div className="space-y-8">
      <TraitDiscovery
        revealed={discovery.revealed}
        dormant={discovery.dormant}
        hiddenCount={discovery.hiddenCount}
        hidden={discovery.hidden}
        glowTokens={noGlow}
        normalize={sameToken}
        onSelect={setSelectedTrait}
      />
      <LiveTraitDetailModal
        isOpen={selectedTrait !== null}
        onClose={() => setSelectedTrait(null)}
        trait={selectedTrait}
      />
    </div>
  );
};

const GeneticsTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const visit = useHorseVisitData();
  return visit ? <VisitorGeneticsTab visit={visit} /> : <OwnerGeneticsTab horse={horse} />;
};

export default GeneticsTab;
