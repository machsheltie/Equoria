/**
 * Trait Discovery from the visitor read (q174 / q213 / q205): revealed and
 * dormant traits by their authored names, hidden traits as a count only. An
 * older reply that sends revealed keys only still reads.
 */

import { humanizeTraitKey, type HorseTrait } from '@/hooks/useHorseTraits';
import type { HorseVisit, VisitTrait } from '@/lib/api/studs';

/** A server-named trait as the Trait Discovery chips read it. */
function chipTrait(trait: VisitTrait, valence: 'positive' | 'negative'): HorseTrait {
  return {
    key: trait.key,
    name: trait.label ?? humanizeTraitKey(trait.key),
    valence,
    description: trait.description ?? '',
  };
}

export function visitTraitDiscovery(horse: HorseVisit): {
  revealed: HorseTrait[];
  dormant: HorseTrait[];
  hiddenCount: number;
} {
  const found = horse.traitDiscovery;
  if (found) {
    return {
      revealed: [
        ...found.positive.map((t) => chipTrait(t, 'positive')),
        ...found.negative.map((t) => chipTrait(t, 'negative')),
      ],
      dormant: found.dormant.map((t) =>
        chipTrait(t, t.type === 'negative' ? 'negative' : 'positive')
      ),
      hiddenCount: found.hiddenCount,
    };
  }
  const named = (key: string, valence: 'positive' | 'negative'): HorseTrait => ({
    key,
    name: humanizeTraitKey(key),
    valence,
    description: '',
  });
  return {
    revealed: [
      ...horse.revealedTraits.positive.map((key) => named(key, 'positive')),
      ...horse.revealedTraits.negative.map((key) => named(key, 'negative')),
    ],
    dormant: [],
    hiddenCount: 0,
  };
}
