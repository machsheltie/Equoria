/**
 * Barrel re-export for frontend domain types.
 *
 * Allows callers to write `import { Horse } from '@/types'` instead of
 * `import { Horse } from '@/types/horse'`. This barrel is self-owned by its
 * current consumers and TypeScript checks; the retired 2025 architecture plan
 * no longer grants or constrains it.
 *
 * COLLISIONS:
 * `Horse`, `Foal`, and `EpigeneticTrait` are intentionally re-exported
 * only from their canonical files (horse.ts / foal.ts / traits.ts). The
 * breeding.ts module also declares local `Horse` and `Foal` interfaces
 * used internally by breeding analysis types, but they are NOT exported
 * through this barrel to avoid TS2308 ambiguity. Callers wanting the
 * breeding-specific shape should import directly from `@/types/breeding`.
 * Likewise, `foal.ts` declares its own narrower `EpigeneticTrait` —
 * the canonical one is in `traits.ts` and is the one re-exported here.
 *
 * Domain types not exported here remain colocated with their current owners.
 * Do not create new type modules merely to reproduce an archived file tree.
 */

// Canonical owner of `Horse`, `HorseStats`, `HorseRef`.
export * from './horse';

// `Foal` (extends Horse), foal development surfaces. We must NOT re-export
// foal.ts's local `EpigeneticTrait` — that's the conflict resolved below.
export type { Foal, FoalDevelopmentStatus, FoalEnrichmentStatus } from './foal';

// Canonical owner of `EpigeneticTrait` and trait helpers.
export * from './traits';

// Breeding analysis types. We must NOT re-export breeding.ts's local
// `Horse` and `Foal` — they shadow the canonical ones above.
export type {
  HorseBreedingData,
  InbreedingAnalysis,
  OffspringPredictions,
  BreedingCompatibility,
  BreedingPairAnalysis,
  CompatibilityAnalysis,
  BreedingPair,
  BreedingRequest,
  BreedingResponse,
  TraitPrediction,
  UltraRareTraitPotential,
  BreedingInsights,
  BreedingPredictions,
} from './breeding';

// Groom and rider domain types — no known cross-file collisions.
export * from './groomBonusTrait';
export * from './groomCareer';
export * from './groomLegacy';
export * from './groomPersonality';
export * from './groomShowHandler';
export * from './groomTalent';
export * from './groomTasks';
export * from './riderCareer';
export * from './riderDiscovery';
export * from './riderPersonality';
