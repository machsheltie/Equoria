/**
 * Barrel re-export for frontend domain types.
 *
 * Allows callers to write `import { Horse } from '@/types'` instead of
 * `import { Horse } from '@/types/horse'`. The architecture spec at
 * docs/architecture.md (2025-12-02) prescribed a types/index.ts barrel;
 * this file fulfills that requirement per Equoria-bh78 option (c).
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
 * NOTE: `api.ts`, `auth.ts`, and `training.ts` are also listed in the spec
 * but do not yet exist as standalone files — domain types for those areas
 * are currently colocated with their hooks / components. Re-introducing
 * them as separate files would be a wider refactor (option (a)) and is
 * out of scope for this barrel-only change.
 */

// Canonical owner of `Horse`, `HorseStats`, `HorseRef`.
export * from './horse';

// `Foal` (extends Horse), foal development surfaces. We must NOT re-export
// foal.ts's local `EpigeneticTrait` — that's the conflict resolved below.
export type {
  Foal,
  FoalDevelopmentStatus,
  FoalEnrichmentStatus,
} from './foal';

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
