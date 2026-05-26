# Epigenetics At-Birth Redesign — Canonical Design Spec (Equoria-9o3n7.1)

**Status:** DRAFT — all 6 decisions locked (§A inheritance, §B roster, §C casing+backfill, §D visibility, §E rare-traits, §F discipline_affinity). Awaiting user review before → implementation plan.
**Date:** 2026-05-26
**Gates:** 9o3n7.2 (inheritance), 9o3n7.3 (roster), 9o3n7.4 (pregnancy bonus), 9o3n7.5 (discipline_affinity), 9o3n7.6 (casing+backfill); coordinates e2flk, 6s4p5, hw8cr, pe6rb.

## Context (verified against live code, 2026-05-26)

- Live birth path `backend/utils/applyEpigeneticTraitsAtBirth.mjs` rolls on mare stress/feed/inbreeding/lineage-discipline and returns `{ positive, negative }` — it never sees sire/dam traits and never produces `hidden`.
- Orphaned `backend/utils/epigeneticTraits.mjs#calculateEpigeneticTraits(damTraits, sireTraits, …, seed)` implements seedable parent→offspring inheritance + `determineTraitVisibility`, but is only called by examples/tests.
- Impl B (`atBirthTraits.mjs`) + the horseModel fallback are ALREADY removed (Equoria-313oc). One live implementation remains.
- Schema `epigeneticModifiers` default `{ positive:[], negative:[], hidden:[] }`; `foalingService.createFoalFromPregnancy` currently discards `hidden`.
- The "ghost" names spooky/self_assured/timid/friendly/withdrawn/hardy/adaptable/sensitive/dependent/steady/delicate are **GROOM personalities** (groomPersonalityTraits/horseTemperamentAnalysis), NOT horse epigenetic traits → excluded from the horse roster (not "resurrected").

## §A — Inheritance model **[LOCKED: integrate as a first stage]**

Extend `applyEpigeneticTraitsAtBirth` into one ordered pipeline. New signature accepts `sireTraits` + `damTraits` (their `epigeneticModifiers.positive ∪ negative ∪ hidden`) and an optional `seed` (deterministic tests):

- **Stage 0 — Inheritance (NEW):** for each distinct sire/dam epigenetic trait, inherit with a per-trait probability (port `calculateEpigeneticTraits`'s model).
- **Stage 1–4 — Environmental (existing, additive on top):** mare stress+feed (resilient/peopleTrusting), inbreeding (fragile/reactive/lowImmunity), lineage discipline_affinity (+legacyTalent), high-stress (nervous) / poor-feed (lowImmunity).
- **Dedupe**, then **resolve visibility** (§D) → `{ positive, negative, hidden }`.
- `foalingService.createFoalFromPregnancy` passes sire+dam `epigeneticModifiers` and persists all three arrays (incl. `hidden[]`). Adjacent: `horseModel.createHorse` already defaults the 3-array shape — confirm it persists a provided `hidden`.

## §D — Hidden-trait visibility **[LOCKED: documented probabilities]**

`determineTraitVisibility`: rare traits **70%** born hidden, legendary **90%**, and ANY trait **30%** hidden when born under poor conditions (high mare stress / low feed). Hidden traits persist to `epigeneticModifiers.hidden[]` and are revealable later via the existing `traitDiscovery.revealTraits` + `POST /api/foals/:foalId/reveal-traits`. Deterministic (seeded) sentinel: a rare/legendary trait under poor conditions lands in `hidden[]`; a different seed proves it can be visible.

## §B — Canonical trait roster **[LOCKED: reconcile the two real catalogs; ghosts are groom-side]**

Canonical horse-trait roster = union of `traitEffects.mjs` (~24) and `epigeneticTraits.mjs` TRAIT_DEFINITIONS (~25), reconciled to one camelCase key each (§C), **minus the four §E-dropped names** (weatherImmunity/nightVision/fireResistance/waterPhobia). Every at-birth-emittable trait MUST have a `traitEffects.mjs` entry — enforced by the already-landed `atBirthTraitEffectsCoverage` sentinel (Equoria-2mgor). Groom-personality names are NOT added to the horse roster.

## §C — Canonical casing + DB backfill **[LOCKED: camelCase]**

ONE convention: **camelCase**, everywhere (TRAIT*DEFINITIONS, traitEffects, the competition-score map, all emitters, traitCompetitionImpact). Convert snake keys: `trainability_boost→trainabilityBoost`, `eager_learner→eagerLearner`, `low_immunity→lowImmunity`, `legendary_bloodline→legendaryBloodline`, `discipline_affinity*_→disciplineAffinity_`(§F),`specialized_lineage→specializedLineage`, `legacy_talent→legacyTalent`. **DB backfill:** a forward-only migration maps every known snake key→camel inside existing `horse.epigeneticModifiers` `{positive,negative,hidden}` arrays (scoped UPDATE, no unscoped writes); ship the key-map alongside so reads tolerate legacy rows until backfilled.

## §F — discipline_affinity coverage **[LOCKED: all 23 disciplines, full rich effects]**

Every canonical discipline in `constants/schema.mjs DISCIPLINES` (23) gets a `disciplineAffinity<Discipline>` trait with (a) the +5 discipline-match bonus AND (b) bespoke rich multi-stat effects. **Rich-effect principle (so 9o3n7.5 doesn't re-litigate):** each affinity grants the +5 match bonus plus a modest bonus to the 2–3 stats that discipline emphasizes (mapped from each discipline's existing stat-weighting in the competition scorer), keeping magnitudes in line with the current racing/jumping/dressage affinities — not arbitrary new numbers. Canonical key derivation is camelCase off the discipline name (e.g. "Show Jumping"→`disciplineAffinityShowJumping`); the birth-code key generator is fixed to emit exactly these keys (resolves the `jumping`/`show_jumping` silent-miss bug). This is the largest impl child (9o3n7.5).

## §E — Rare-trait roster **[LOCKED: drop the 4 non-game traits; keep legendaryBloodline]**

Per user (2026-05-26): **weatherImmunity, nightVision, fireResistance, waterPhobia DO NOT exist in the game.** Remove every reference to all four from ALL code maps (`epigeneticTraits.mjs` TRAIT_DEFINITIONS, `traitEffects.mjs`, `traitCompetitionImpact.mjs`) and from the docs (`epigeneticTraits.md`). No new fantasy/environmental traits are invented.
The ONLY surviving "rare" trait is **`legendaryBloodline`** (a real bloodline trait already defined in all three maps): keep it, unify its casing (`legendary_bloodline`→`legendaryBloodline`) across defs+effects+impact. Its at-birth emission path is §A inheritance (inheritable from a parent that carries it) combined with §D visibility (as a _legendary_ trait it is born hidden 90% of the time, then discoverable) — so it requires no bespoke emitter beyond the §A/§D pipeline.
This fully resolves Equoria-6s4p5: drop the 4 ghosts everywhere + canonicalize the single `legendaryBloodline` key. Grep sentinel: zero references to the 4 dropped names; `legendaryBloodline` resolves identically in all three maps; zero snake_case rare-trait keys remain.

## Out of scope (unchanged)

Ultra-rare/exotic traits (`ultraRareTraits.mjs`: phoenix-born/iron-willed/empathic-mirror/born-leader/stormtouched + exotics) remain post-birth trigger-earned, not at-birth.

## Child issue mapping

9o3n7.2←§A · 9o3n7.3←§B · 9o3n7.4←pregnancy-bonus repoint at §B-approved traits · 9o3n7.5←§F · 9o3n7.6←§C. e2flk←§D, 6s4p5←§E, hw8cr/pe6rb←doc reconciliation post-spec.
