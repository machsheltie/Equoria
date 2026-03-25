# Equoria - Epic Breakdown: Horse Physical Systems & Genetics

**Author:** Claude (BMAD Workflow)
**Date:** 2026-03-25
**Project Level:** Brownfield (Epics 1-21 complete, backend 100%, frontend functional)
**Target Scale:** Backend model + service + API additions for physical attributes and genetics
**Source PRDs:** PRD-02 §3.1-3.3 (v1.2.0), PRD-03 §3.6/§7 (v2.2.0), PRD-10 §3 (v2.1.0)

---

## Overview

This document provides the complete epic and story breakdown for implementing 6 unimplemented features across horse physical attributes, genetics, temperament, and conformation shows. All features add new backend services, Prisma migrations, and API endpoints — no frontend changes in this phase.

**Follow-up Required:** UX spec sections need updating to reflect conformation display, gait display, temperament badges, color/marking display, and conformation show UI. Tracked separately from these backend epics.

---

## Requirements Inventory

### Functional Requirements

| ID    | Requirement                                                                                            | Source      |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------- | ----------- |
| FR-01 | Populate `breed_genetic_profile` JSONB with `rating_profiles` (conformation + gaits) for all 12 breeds | PRD-02 §3.1 |
| FR-02 | Populate `breed_genetic_profile` JSONB with `temperament_weights` for all 12 breeds                    | PRD-03 §7.3 |
| FR-03 | Populate `breed_genetic_profile` JSONB with `is_gaited_breed` flag and gaited gait registry            | PRD-02 §3.2 |
| FR-04 | Generate 8 conformation region scores (0-100) at horse creation via normal distribution                | PRD-02 §3.1 |
| FR-05 | Store conformation scores in `Horse.conformationScores` JSONB                                          | PRD-02 §3.1 |
| FR-06 | Conformation scores are permanent/immutable — no mutation endpoints                                    | PRD-02 §3.1 |
| FR-07 | Breeding inheritance: foal conformation = 60% parent avg + 40% breed mean + variance                   | PRD-02 §3.1 |
| FR-08 | `GET /api/v1/horses/:id/conformation` — region breakdown + overall score                               | PRD-02 §3.1 |
| FR-09 | `GET /api/v1/horses/:id/conformation/analysis` — breed percentile comparison                           | PRD-02 §3.1 |
| FR-10 | Generate 4 standard gait scores (walk, trot, canter, gallop) at horse creation                         | PRD-02 §3.2 |
| FR-11 | Generate breed-specific named gaited gaits for gaited breeds only                                      | PRD-02 §3.2 |
| FR-12 | Gait scores influenced by conformation (±5 modifier from relevant regions)                             | PRD-02 §3.2 |
| FR-13 | Store gait scores in `Horse.gaitScores` JSONB with gaiting as `{ name, score }[]                       | null`       | PRD-02 §3.2 |
| FR-14 | Gait scores are permanent/immutable — no mutation endpoints                                            | PRD-02 §3.2 |
| FR-15 | Breeding inheritance for gaits: 60% parent avg + 40% breed mean + conformation bonus                   | PRD-02 §3.2 |
| FR-16 | Cross-breed breeding: gaited gait availability based on foal's breed only                              | PRD-02 §3.2 |
| FR-17 | `GET /api/v1/horses/:id/gaits` — standard + breed-specific gaited gaits                                | PRD-02 §3.2 |
| FR-18 | Assign one of 11 temperaments at birth via weighted random from breed profile                          | PRD-03 §7.2 |
| FR-19 | Temperament is permanent — no mutation endpoints                                                       | PRD-03 §7   |
| FR-20 | Training modifiers: XP and score gains modified by temperament                                         | PRD-03 §7.4 |
| FR-21 | Competition modifiers: final score percentage modifier by temperament (ridden + conformation)          | PRD-03 §7.5 |
| FR-22 | Groom synergy: bonding speed modified by temperament-personality pairing                               | PRD-03 §7.6 |
| FR-23 | `GET /api/v1/horses/temperament-definitions` — all 11 types with effects                               | PRD-03 §7.8 |
| FR-24 | Temperament included in existing horse detail response                                                 | PRD-03 §7.8 |
| FR-25 | Prisma migration: add `temperament` String? field to Horse model                                       | PRD-03 §7.8 |
| FR-26 | 17+ locus Mendelian genotype stored in `Horse.colorGenotype` JSONB                                     | PRD-02 §3.3 |
| FR-27 | Phenotype calculated deterministically from genotype                                                   | PRD-02 §3.3 |
| FR-28 | Breed allele restrictions enforced (allowed_alleles, disallowed_combinations)                          | PRD-02 §3.3 |
| FR-29 | Lethal combination filtering at breeding (reroll up to 100 times)                                      | PRD-02 §3.3 |
| FR-30 | Mendelian inheritance: one random allele per parent per locus                                          | PRD-02 §3.3 |
| FR-31 | Face and leg marking system with breed-specific probability biases                                     | PRD-02 §3.3 |
| FR-32 | Boolean modifiers (sooty, flaxen, pangare, rabicano) with breed prevalence                             | PRD-02 §3.3 |
| FR-33 | `GET /api/v1/horses/:id/genetics` — full genotype + phenotype                                          | PRD-02 §3.3 |
| FR-34 | `GET /api/v1/horses/:id/color` — display color, shade, markings                                        | PRD-02 §3.3 |
| FR-35 | `POST /api/v1/breeding/color-prediction/:sireId/:damId` — offspring color probability                  | PRD-02 §3.3 |
| FR-36 | Conformation show scoring: 65% conformation + 20% handler + 8% bond + 7% temperament synergy           | PRD-03 §3.6 |
| FR-37 | Conformation show entry at age 1+ with automatic age class assignment                                  | PRD-03 §3.6 |
| FR-38 | Groom required as show handler for entry                                                               | PRD-03 §3.6 |
| FR-39 | Rewards: ribbons + title points + breeding value boost (no prize money)                                | PRD-03 §3.6 |
| FR-40 | Title progression: Noteworthy (25), Distinguished (50), Champion (100), Grand Champion (200)           | PRD-03 §3.6 |
| FR-41 | Breeding value boost: +5%/+3%/+1% per placement, capped at +15%                                        | PRD-03 §3.6 |
| FR-42 | `POST /api/v1/competition/conformation/enter` — enter conformation show                                | PRD-03 §3.6 |
| FR-43 | `POST /api/v1/competition/conformation/execute` — run the show                                         | PRD-03 §3.6 |
| FR-44 | `GET /api/v1/competition/conformation/eligibility/:id` — check eligibility                             | PRD-03 §3.6 |
| FR-45 | `GET /api/v1/competition/conformation/titles/:horseId` — title points and current title                | PRD-03 §3.6 |

### Non-Functional Requirements

| ID     | Requirement                                                                                                       | Source              |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| NFR-01 | Conformation/gait score generation follows normal distribution (verifiable via statistical test on 1000+ samples) | PRD-02 §3.1/3.2     |
| NFR-02 | All API responses in <200ms (conformation, gaits) or <300ms (genetics)                                            | PRD-02 §3.1/3.2/3.3 |
| NFR-03 | Mendelian ratios hold across large samples (chi-squared, p > 0.05)                                                | PRD-02 §3.3         |
| NFR-04 | Temperament distribution matches breed weights within statistical tolerance                                       | PRD-03 §7           |
| NFR-05 | Conformation influence produces measurable correlation (r > 0.3) with gait scores                                 | PRD-02 §3.2         |
| NFR-06 | Backward compatible — existing horses without new fields return null                                              | PRD-03 §7.8         |
| NFR-07 | All scores clamped to 0-100 integer range                                                                         | PRD-02 §3.1/3.2     |
| NFR-08 | Breeding value boost capped at +15%                                                                               | PRD-03 §3.6         |

### Architectural Requirements

| ID    | Requirement                                                                                                    | Source    |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------- |
| AR-01 | New services follow `backend/modules/` domain module pattern                                                   | ARCH-01   |
| AR-02 | ES modules only — import/export, .mjs extensions                                                               | CLAUDE.md |
| AR-03 | Prisma migrations for new Horse fields (conformationScores, gaitScores, temperament, colorGenotype, phenotype) | PRD-02/03 |
| AR-04 | All endpoints under `/api/v1/` prefix                                                                          | ARCH-01   |
| AR-05 | Tests follow balanced mocking strategy (external deps only)                                                    | CLAUDE.md |

### UX Design Requirements

UX spec updates deferred to a follow-up phase. Sections to update:

- Conformation display (radar chart per horse)
- Gait scores display (bar chart with breed-specific gait names)
- Temperament badge on horse cards and detail page
- Color/marking visual display with genotype viewer for breeders
- Conformation show entry flow, results, and title display

---

### FR Coverage Map

| FR                                | Epic | Story |
| --------------------------------- | ---- | ----- |
| FR-01, FR-02, FR-03               | 31A  | 31A-1 |
| FR-04, FR-05, FR-06               | 31B  | 31B-1 |
| FR-07                             | 31B  | 31B-2 |
| FR-08, FR-09                      | 31B  | 31B-3 |
| FR-10, FR-11, FR-12, FR-13, FR-14 | 31C  | 31C-1 |
| FR-15, FR-16                      | 31C  | 31C-2 |
| FR-17                             | 31C  | 31C-3 |
| FR-18, FR-19, FR-24, FR-25        | 31D  | 31D-1 |
| FR-20                             | 31D  | 31D-2 |
| FR-21                             | 31D  | 31D-3 |
| FR-22                             | 31D  | 31D-4 |
| FR-23                             | 31D  | 31D-5 |
| FR-26, FR-27, FR-28               | 31E  | 31E-1 |
| FR-29, FR-30                      | 31E  | 31E-2 |
| FR-31, FR-32                      | 31E  | 31E-3 |
| FR-33, FR-34                      | 31E  | 31E-4 |
| FR-35                             | 31E  | 31E-5 |
| FR-36, FR-37, FR-38               | 31F  | 31F-1 |
| FR-39, FR-40, FR-41               | 31F  | 31F-2 |
| FR-42, FR-43, FR-44, FR-45        | 31F  | 31F-3 |

---

## Epic List

| Epic | Title                            | Dependencies | Stories |
| ---- | -------------------------------- | ------------ | ------- |
| 31A  | Breed Genetic Profile Population | None         | 1       |
| 31B  | Conformation Scoring System      | 31A          | 3       |
| 31C  | Gait Quality System              | 31A, 31B     | 3       |
| 31D  | Breed Temperament System         | 31A          | 5       |
| 31E  | Coat Color Genetics              | 31A          | 5       |
| 31F  | Conformation Show Handling       | 31B, 31D     | 3       |

**Dependency Graph:**

```
31A (Breed Profile Data)
├── 31B (Conformation) ──┐
│   └── 31C (Gaits)      ├── 31F (Conformation Shows)
├── 31D (Temperament) ───┘
└── 31E (Coat Color Genetics) [independent after 31A]
```

Epics 31B, 31D, and 31E can be developed in parallel after 31A. Epic 31C requires 31B. Epic 31F requires both 31B and 31D.

---

## Epic 31A: Breed Genetic Profile Population

**Goal:** Populate the `breed_genetic_profile` JSONB field on all 12 Breed records with rating profiles (conformation + gaits), temperament weights, gaited breed flags, and gaited gait registry. This is the data foundation for all subsequent epics.

### Story 31A-1: Populate Breed Genetic Profile Data

As a developer,
I want breed genetic profiles populated with conformation ratings, gait ratings, temperament weights, and gaited breed configuration,
So that all downstream systems (conformation, gaits, temperament, color) have the data they need to generate horse attributes.

**Acceptance Criteria:**

**Given** the Prisma `Breed` model has a `breedGeneticProfile` JSONB field
**When** the seed/migration script runs
**Then** all 12 breeds (IDs 1-12) have `breed_genetic_profile` populated with:

- `rating_profiles.conformation`: `{ head, neck, shoulders, back, hindquarters, legs, hooves, topline }` each with `{ mean, std_dev }` (std_dev = 8)
- `rating_profiles.gaits`: `{ walk, trot, canter, gallop, gaiting }` each with `{ mean, std_dev }` (std_dev = 9, gaiting = null for non-gaited)
- `rating_profiles.is_gaited_breed`: `true` for IDs 3, 4, 7, 10; `false` for all others
- `rating_profiles.gaited_gait_registry`: breed-specific named gaits (Saddlebred/NSH: ["Slow Gait", "Rack"], TWH: ["Flat Walk", "Running Walk"], Walkaloosa: ["Indian Shuffle"])
- `temperament_weights`: all 11 temperament types with integer weights summing to 100

**And** the script is idempotent (can run multiple times without error or duplicate data)
**And** conformation data matches PRD-02 §3.1 breed rating table
**And** gait data matches PRD-02 §3.2 breed gait rating table
**And** temperament data matches PRD-03 §7.3 breed temperament weight table
**And** Lusitano (ID 11) has temperament weights but conformation/gait ratings marked as TBD placeholders

---

## Epic 31B: Conformation Scoring System

**Goal:** Generate permanent, immutable conformation scores (8 body regions) for each horse at creation/birth, based on breed genetics. Provide API endpoints for viewing scores and breed-comparative analysis.

### Story 31B-1: Conformation Score Generation Service

As a developer,
I want a service that generates 8 conformation region scores for a horse using its breed's rating profile,
So that every horse has permanent physical structure attributes generated at birth.

**Acceptance Criteria:**

**Given** a horse is being created (new horse or foal birth)
**When** the conformation generation service runs
**Then** 8 scores are generated: `{ head, neck, shoulders, back, hindquarters, legs, hooves, topline }`, each 0-100
**And** each score is generated via `normalRandom(breedMean, breedStdDev)` then clamped to [0, 100] and rounded to integer
**And** scores are stored in `Horse.conformationScores` JSONB field
**And** a Prisma migration adds `conformationScores` JSONB field to the Horse model (nullable for existing horses)
**And** `overallConformation` is calculated as the arithmetic mean of all 8 regions
**And** over 1000+ generated horses of the same breed, scores follow normal distribution within breed parameters (mean ± 2 std_dev for 95%)
**And** no endpoint exists to modify conformation scores after creation

### Story 31B-2: Conformation Breeding Inheritance

As a developer,
I want foal conformation scores to blend parent scores with breed mean,
So that selective breeding has meaningful impact while regressing toward breed averages.

**Acceptance Criteria:**

**Given** a foal is being born with known sire and dam
**When** the conformation generation service runs for the foal
**Then** each region score is generated using:

- `baseValue = (sire.region * 0.5 + dam.region * 0.5) * 0.6 + breedMean * 0.4`
- `foalScore = clamp(normalRandom(baseValue, breedStdDev), 0, 100)`
  **And** parent contribution is 60% and breed mean regression is 40%
  **And** foals of high-scoring parents average higher than breed mean (verifiable over 1000+ samples)
  **And** foals still exhibit natural variance from the breed std_dev

### Story 31B-3: Conformation API Endpoints

As a player,
I want to view my horse's conformation scores and see how it compares to its breed,
So that I can evaluate my horse's physical quality and make informed breeding decisions.

**Acceptance Criteria:**

**Given** a horse exists with conformation scores
**When** `GET /api/v1/horses/:id/conformation` is called
**Then** the response includes all 8 region scores + overall conformation average
**And** response time is <200ms

**Given** a horse exists with conformation scores
**When** `GET /api/v1/horses/:id/conformation/analysis` is called
**Then** the response includes percentile rankings per region compared to the horse's breed
**And** percentile is calculated against all horses of the same breed in the database
**And** response time is <200ms

**Given** a horse exists without conformation scores (legacy horse)
**When** either endpoint is called
**Then** the response returns `null` or empty conformation data with 200 status (not an error)

---

## Epic 31C: Gait Quality System

**Goal:** Generate permanent, immutable gait quality scores for each horse at creation/birth. Standard gaits for all breeds, plus breed-specific named gaited gaits for gaited breeds. Gait scores are influenced by conformation.

### Story 31C-1: Gait Score Generation Service

As a developer,
I want a service that generates gait quality scores for a horse based on breed genetics and conformation influence,
So that every horse has permanent movement quality attributes.

**Acceptance Criteria:**

**Given** a horse is being created with conformation scores already generated
**When** the gait generation service runs
**Then** 4 standard gait scores are generated: `{ walk, trot, canter, gallop }`, each 0-100
**And** each score = `clamp(normalRandom(breedGaitMean, breedGaitStdDev) + conformationBonus, 0, 100)`
**And** conformation bonus = `(avg of relevant conformation regions - 70) * 0.15`
**And** conformation-to-gait mapping:

- Walk: Shoulders + Back
- Trot: Shoulders + Hindquarters
- Canter: Back + Hindquarters
- Gallop: Legs + Hindquarters
- Gaited gaits: Legs + Back + Hindquarters

**Given** the horse's breed has `is_gaited_breed: true`
**When** the gait generation service runs
**Then** additional gaited gait entries are generated with breed-specific names from `gaited_gait_registry`
**And** gaiting score = `clamp(normalRandom(breedGaitingMean, breedGaitingStdDev) + conformationBonus, 0, 100)`
**And** the same gaiting score applies to all named gaits for that breed
**And** stored as `gaiting: [{ name: "Slow Gait", score: 85 }, { name: "Rack", score: 85 }]`

**Given** the horse's breed has `is_gaited_breed: false`
**When** the gait generation service runs
**Then** `gaiting` is stored as `null`

**And** a Prisma migration adds `gaitScores` JSONB field to the Horse model (nullable for existing horses)
**And** no endpoint exists to modify gait scores after creation

### Story 31C-2: Gait Breeding Inheritance

As a developer,
I want foal gait scores to blend parent gait quality with breed mean and conformation influence,
So that breeding for movement quality is meaningful.

**Acceptance Criteria:**

**Given** a foal is being born with known sire and dam, both having gait scores
**When** the gait generation service runs for the foal
**Then** each standard gait score = `clamp(normalRandom((parentAvg * 0.6 + breedMean * 0.4), breedStdDev) + conformationBonus, 0, 100)`

**Given** one parent is gaited breed and the other is not
**When** a foal is born
**Then** gaited gait availability depends on the foal's assigned breed only
**And** if foal breed is gaited: receives gaited gait scores using breed gait registry
**And** if foal breed is non-gaited: `gaiting: null` regardless of parents

### Story 31C-3: Gait API Endpoint

As a player,
I want to view my horse's gait quality scores including any breed-specific gaited gaits,
So that I can understand my horse's movement abilities.

**Acceptance Criteria:**

**Given** a horse exists with gait scores
**When** `GET /api/v1/horses/:id/gaits` is called
**Then** the response includes walk, trot, canter, gallop scores (0-100)
**And** for gaited breeds: response includes `gaiting` array with `{ name, score }` entries (e.g., `[{ name: "Slow Gait", score: 85 }, { name: "Rack", score: 85 }]`)
**And** for non-gaited breeds: `gaiting: null`
**And** response time is <200ms

**Given** a horse exists without gait scores (legacy horse)
**When** the endpoint is called
**Then** the response returns `null` or empty gait data with 200 status

---

## Epic 31D: Breed Temperament System

**Goal:** Assign a permanent temperament to each horse at birth based on breed-weighted probabilities. Integrate temperament modifiers into training, competition, and groom systems.

### Story 31D-1: Temperament Assignment Service + Migration

As a developer,
I want each horse to receive a temperament at birth from a weighted random selection based on breed profile,
So that horses have distinct personality traits that affect gameplay.

**Acceptance Criteria:**

**Given** a Prisma migration adds `temperament` String? field to the Horse model
**When** a horse is created (new or foal birth)
**Then** one of 11 temperaments is assigned: Spirited, Nervous, Calm, Bold, Steady, Independent, Reactive, Stubborn, Playful, Lazy, Aggressive
**And** selection uses `weightedRandomSelect(breed.temperament_weights)` from the breed's genetic profile
**And** temperament is permanent — no mutation endpoint exists
**And** existing horses without temperament return `null` in API responses
**And** temperament appears in the existing `GET /api/v1/horses/:id` response
**And** over 1000+ horses of the same breed, temperament distribution matches breed weights within statistical tolerance (chi-squared test, p > 0.05)

### Story 31D-2: Training Temperament Modifiers

As a developer,
I want temperament to modify training XP and discipline score gains,
So that horse personality meaningfully impacts training progression.

**Acceptance Criteria:**

**Given** a horse with temperament "Stubborn" trains
**When** the training session completes
**Then** XP gained is reduced by 15% and discipline score gain is reduced by 10%

**Given** a horse with temperament "Calm" trains
**When** the training session completes
**Then** XP gained is increased by 5% and discipline score gain is increased by 10%

**And** all 11 temperament modifiers are applied per PRD-03 §7.4 table:

- Spirited: +10% XP, +5% score
- Nervous: -10% XP, -5% score
- Calm: +5% XP, +10% score
- Bold: +5% XP, +5% score
- Steady: +5% XP, +10% score
- Independent: -5% XP, 0% score
- Reactive: 0% XP, -5% score
- Stubborn: -15% XP, -10% score
- Playful: +5% XP, -5% score
- Lazy: -20% XP, -15% score
- Aggressive: -10% XP, -5% score

**And** horses without temperament (null) receive no modifier (backward compatible)
**And** modifiers are applied as multipliers after base calculation (not flat additions)

### Story 31D-3: Competition Temperament Modifiers

As a developer,
I want temperament to modify competition final scores,
So that horse personality affects performance in the ring.

**Acceptance Criteria:**

**Given** a horse with temperament "Bold" enters a ridden competition
**When** the competition score is calculated
**Then** the final score is increased by 5%

**Given** a horse with temperament "Nervous" enters any competition
**When** the competition score is calculated
**Then** the final score is decreased by 5%

**And** all 11 temperament modifiers are applied per PRD-03 §7.5 table, distinguishing between ridden and conformation competitions
**And** modifiers are applied as percentage adjustment to the pre-luck final score
**And** horses without temperament (null) receive no modifier

### Story 31D-4: Groom Temperament Synergy

As a developer,
I want temperament-personality pairings to modify groom bonding speed,
So that matching the right groom to a horse's temperament matters.

**Acceptance Criteria:**

**Given** a horse with temperament "Nervous" is assigned a groom with personality "Patient"
**When** bonding interactions occur
**Then** bonding speed is increased by 25%

**Given** a horse with temperament "Nervous" is assigned a groom with personality "Firm"
**When** bonding interactions occur
**Then** bonding speed is decreased by 10-20%

**And** all temperament-personality synergy modifiers are applied per PRD-03 §7.6 table
**And** synergy modifiers affect bonding speed calculation in the existing groom interaction system
**And** horses without temperament (null) receive no synergy modifier

### Story 31D-5: Temperament Definitions Endpoint

As a player,
I want to see all temperament types with their descriptions and game effects,
So that I understand how temperament affects my horse's performance.

**Acceptance Criteria:**

**Given** the system has 11 temperament types defined
**When** `GET /api/v1/horses/temperament-definitions` is called
**Then** the response includes all 11 types, each with:

- Name, description, prevalence note
- Training modifiers (XP%, score%)
- Competition modifiers (ridden%, conformation%)
- Best groom personality matches
  **And** response time is <200ms

---

## Epic 31E: Coat Color Genetics

**Goal:** Implement full Mendelian color genetics with 17+ loci, breed restrictions, lethal filtering, phenotype calculation, marking system, and breeding color prediction.

### Story 31E-1: Genotype Generation + Phenotype Calculation Service

As a developer,
I want a service that generates a complete genotype across 17+ loci for a horse and deterministically calculates phenotype,
So that every horse has genetically accurate coat color.

**Acceptance Criteria:**

**Given** a horse is being created (new or foal birth, not via breeding)
**When** the color genetics service runs
**Then** allele pairs are generated for all 17+ loci using the breed's `allele_weights` probability distribution
**And** the genotype is stored in `Horse.colorGenotype` JSONB: `{ E_Extension: "E/e", A_Agouti: "A/A", ... }`
**And** breed allele restrictions are enforced — no alleles outside `allowed_alleles`

**Given** a complete genotype exists
**When** the phenotype calculation runs
**Then** base color is determined from Extension + Agouti interaction (Bay, Black, Chestnut)
**And** dilutions applied in order: Cream → Dun → Silver → Champagne → Pearl → Mushroom
**And** pattern overlays applied: Gray, Roan, Tobiano, Frame Overo, Sabino, Splash White, Leopard Complex + PATN1, Dominant White, Brindle
**And** a display color name is assigned from 40+ possibilities
**And** a shade variant is selected from breed-specific `shade_bias` probabilities
**And** phenotype is stored in `Horse.phenotype` JSONB

**And** a Prisma migration adds `colorGenotype` JSONB and `phenotype` JSONB fields to the Horse model
**And** same genotype always produces same phenotype (deterministic)

### Story 31E-2: Mendelian Breeding Inheritance + Lethal Filtering

As a developer,
I want foal genotypes to follow standard Mendelian inheritance with lethal combination prevention,
So that breeding produces genetically accurate offspring.

**Acceptance Criteria:**

**Given** two horses are breeding
**When** the foal's genotype is generated
**Then** for each locus: one random allele from sire + one random allele from dam
**And** the resulting genotype is checked against `disallowed_combinations`
**And** if lethal: reroll that locus (up to 100 attempts, then fallback to heterozygous)
**And** breed restrictions from the foal's breed are enforced (default to most common allele if restricted)

**Given** 1000+ Ee × Ee breedings
**When** offspring genotypes are tallied
**Then** approximately 25% EE, 50% Ee, 25% ee (Mendelian ratio, chi-squared p > 0.05)

**Given** two Frame Overo carriers (O/n × O/n) breed
**When** foal genotype is generated
**Then** O/O (lethal white) never appears — always rerolled

### Story 31E-3: Marking System

As a developer,
I want face markings, leg markings, and advanced markings generated per breed bias,
So that horses have visually distinct marking patterns.

**Acceptance Criteria:**

**Given** a horse is being created
**When** the marking generation runs
**Then** one face marking is selected: none, star, strip, blaze, or snip (from breed `marking_bias.face`)
**And** each of 4 legs independently receives: none, coronet, pastern, sock, or stocking (from `marking_bias.legs_general_probability` and `leg_specific_probabilities`)
**And** advanced markings (bloody shoulder, snowflake, frost) are generated for eligible horses using breed probability multipliers

**Given** a horse is born via breeding
**When** markings are generated
**Then** 50% chance of inheriting each parent's marking type + 20% chance of random reroll from breed bias

**And** boolean modifiers are applied: sooty (30%), flaxen (10%, chestnuts only), pangare (10%), rabicano (5%) — adjusted by breed-specific prevalence
**And** all marking data stored in `Horse.phenotype` JSONB alongside color data

### Story 31E-4: Color Genetics API Endpoints

As a player,
I want to view my horse's genetics, coat color, and markings,
So that I can understand my horse's color and plan breeding.

**Acceptance Criteria:**

**Given** a horse exists with genotype and phenotype
**When** `GET /api/v1/horses/:id/genetics` is called
**Then** response includes full genotype (allele pairs per locus) + calculated phenotype
**And** response time is <300ms

**Given** a horse exists with phenotype
**When** `GET /api/v1/horses/:id/color` is called
**Then** response includes display color name, shade variant, face marking, leg markings, advanced markings, boolean modifiers
**And** this is the player-facing summary (no genotype details)
**And** response time is <200ms

**Given** a horse exists without genotype (legacy horse)
**When** either endpoint is called
**Then** response returns `null` or empty genetics data with 200 status

### Story 31E-5: Breeding Color Prediction

As a player,
I want to see a probability chart of possible offspring colors before breeding,
So that I can make informed breeding decisions based on genetics.

**Acceptance Criteria:**

**Given** two horses with known genotypes
**When** `POST /api/v1/breeding/color-prediction/:sireId/:damId` is called
**Then** the response includes a probability chart listing all possible offspring phenotypes with percentage likelihood
**And** probabilities are calculated from Mendelian inheritance across all loci
**And** lethal combinations are excluded from the output
**And** breed restrictions of the predicted foal breed are applied
**And** response time is <500ms (computationally intensive)

---

## Epic 31F: Conformation Show Handling

**Goal:** Implement a new competition type where horses are evaluated on physical appearance. Groom acts as handler, scoring combines conformation + handler skill + bond + temperament synergy. Rewards are prestige-based (no prize money).

### Story 31F-1: Conformation Show Scoring Engine

As a developer,
I want a scoring engine that calculates conformation show results using the 65/20/8/7 formula,
So that conformation shows produce fair, multi-factor results.

**Acceptance Criteria:**

**Given** a horse enters a conformation show with assigned groom handler
**When** the show is executed
**Then** the score is calculated as:

- `conformationScore = average(horse.conformationScores[all 8 regions])` (weight: 65%)
- `handlerScore = groom.showHandlingSkill` (weight: 20%)
- `bondScore = groomHorseBond.level` (weight: 8%)
- `temperamentSynergy = calculateSynergy(horse.temperament, groom.personality)` (weight: 7%)
- `finalScore = (conformation * 0.65) + (handler * 0.20) + (bond * 0.08) + (synergy * 0.07)`

**And** temperament synergy scores match PRD-03 §3.6 synergy table
**And** entry rejected if horse has no groom assigned as handler
**And** entry rejected if horse health is not "healthy"
**And** no training prerequisite — conformation is innate

**Given** a horse is age 1+
**When** entering a conformation show
**Then** the age class is automatically assigned: Weanling (0-1), Yearling (1-2), Youngstock (2-3), Junior (3-5), Senior (6+)

### Story 31F-2: Rewards, Titles, and Breeding Value Boost

As a developer,
I want conformation shows to award ribbons, title points, and breeding value boosts instead of prize money,
So that conformation shows provide prestige-based progression separate from ridden competitions.

**Acceptance Criteria:**

**Given** a conformation show completes with ranked results
**When** rewards are distributed
**Then** 1st place receives: Blue ribbon + 10 title points + 5% breeding value boost
**And** 2nd place receives: Red ribbon + 7 title points + 3% breeding value boost
**And** 3rd place receives: Yellow ribbon + 5 title points + 1% breeding value boost
**And** 4th+ place receives: White ribbon + 2 title points + no breeding value boost
**And** NO prize money is awarded (differentiates from ridden competitions)

**Given** a horse accumulates title points
**When** thresholds are crossed
**Then** titles are assigned: Noteworthy (25), Distinguished (50), Champion (100), Grand Champion (200)
**And** titles are permanent (never removed)

**Given** a horse has accumulated breeding value boosts
**When** it breeds
**Then** offspring conformation generation includes the accumulated boost percentage
**And** total breeding value boost is capped at +15%

### Story 31F-3: Conformation Show API Endpoints

As a player,
I want API endpoints to enter conformation shows, run shows, check eligibility, and view titles,
So that conformation shows are fully accessible through the game interface.

**Acceptance Criteria:**

**Given** a horse with conformation scores, temperament, and assigned groom
**When** `POST /api/v1/competition/conformation/enter` is called with horseId and showId
**Then** the entry is validated (age 1+, groom assigned, healthy) and registered
**And** rejected with descriptive error if any requirement is unmet

**Given** a conformation show has entries
**When** `POST /api/v1/competition/conformation/execute` is called
**Then** all entries are scored, ranked, and rewards distributed
**And** results are stored in competition history alongside ridden results

**Given** a horse exists
**When** `GET /api/v1/competition/conformation/eligibility/:id` is called
**Then** response indicates whether the horse can enter, with reasons for any ineligibility

**Given** a horse has participated in conformation shows
**When** `GET /api/v1/competition/conformation/titles/:horseId` is called
**Then** response includes total title points, current title, and show history summary
