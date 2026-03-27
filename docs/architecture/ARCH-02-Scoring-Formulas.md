# ARCH-02: Scoring & Inheritance Formulas

**Last Updated:** 2026-03-27 (Epic 31B — Conformation & Gait Inheritance)

## Purpose

Document all scoring formulas, inheritance calculations, and genetic systems in Equoria. This is the canonical reference for how horse attributes are generated, inherited, and used in competition.

---

## 1. Conformation Scores

### Overview

Every horse has **8 conformation region scores** representing physical structure quality:
`head`, `neck`, `shoulders`, `back`, `hindquarters`, `legs`, `hooves`, `topline`

Plus an **overallConformation** score (arithmetic mean of all 8 regions).

All scores are **integers in [0, 100]**, generated at birth and permanent.

### 1.1 Store Horse Generation (Breed-Only)

When a horse is created without parents (store purchase), scores are drawn from the breed's genetic profile:

```
For each region:
  rawScore = normalRandom(breedMean, breedStdDev)
  score = clampScore(rawScore)    → rounds to integer, clamps to [0, 100]

overallConformation = round(mean(all 8 region scores))
```

**Source:** `conformationService.mjs → generateConformationScores(breedId)`

**Example (Thoroughbred, head):**

- Breed mean: 78, std_dev: 8
- Generated score will average ~78 with natural variance

### 1.2 Bred Foal Generation (Inheritance)

When a foal is bred from two parents who both have valid conformation scores:

```
For each region:
  parentAvg = (sireScore × 0.5) + (damScore × 0.5)
  baseValue = (parentAvg × 0.6) + (breedMean × 0.4)
  score = clampScore(normalRandom(baseValue, breedStdDev))

overallConformation = round(mean(all 8 region scores))
```

**Source:** `conformationService.mjs → generateInheritedConformationScores(breedId, sireScores, damScores)`

**Formula breakdown:**

- **60% parent contribution:** The average of both parents' scores for that region
- **40% breed regression:** Pulls the score toward the breed's natural mean
- **Variance:** Normal distribution around the baseValue adds natural randomness
- **Sire and dam contribute equally** (50/50 split of the parent portion)

**Example calculation:**

```
Sire head = 90, Dam head = 50
Breed mean (Thoroughbred head) = 78

parentAvg = (90 × 0.5) + (50 × 0.5) = 70
baseValue = (70 × 0.6) + (78 × 0.4) = 42 + 31.2 = 73.2

Final score ≈ normalRandom(73.2, 8)  →  typically 65-81
```

### 1.3 Fallback Rules

| Scenario                                   | Behavior                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Either parent scores are null              | Falls back to breed-only generation                                    |
| Either parent scores are empty `{}`        | Falls back to breed-only generation (via `hasValidConformationScores`) |
| Individual parent region is NaN/non-finite | That region uses breed mean instead of parent value                    |
| Individual parent region is missing        | That region uses breed mean instead of parent value                    |
| Unknown breedId                            | Returns default scores of 50 for all regions                           |
| No breed genetic profile found             | Returns default scores of 50 for all regions                           |

### 1.4 Design Intent — Legacy/Store Horses

Store horses default to conformation scores of **20** across all regions. This is intentionally below breed means (~70-85). The game design consequence:

- **Breeding unimproved store horses** produces foals with scores ~43 (well below breed mean)
- **Players must train and show horses** to improve them before breeding
- **Improved parents (score 90)** produce foals averaging ~85 — reward for investment
- This creates the core gameplay loop: buy → train → show → breed → improve

---

## 2. Gait Scores

### Overview

Every horse has **4 standard gait scores**: `walk`, `trot`, `canter`, `gallop`

Gaited breeds additionally have **breed-specific gaits** (e.g., Tennessee Walking Horse has "running walk").

All scores are **integers in [0, 100]**, generated at birth and permanent.

### 2.1 Conformation Influence on Gaits

Gait scores receive a bonus/penalty based on relevant conformation regions:

```
conformationBonus = (avgOfMappedRegions - 70) × 0.15
```

**Conformation-to-gait mapping:**

| Gait    | Influenced by            |
| ------- | ------------------------ |
| Walk    | shoulders, back          |
| Trot    | shoulders, hindquarters  |
| Canter  | back, hindquarters       |
| Gallop  | legs, hindquarters       |
| Gaiting | legs, back, hindquarters |

**Source:** `gaitService.mjs → calculateConformationBonus(conformationScores, gaitKey)`

### 2.2 Store Horse Generation (Breed-Only)

```
For each gait:
  bonus = conformationBonus(conformationScores, gait)
  rawScore = normalRandom(breedMean, breedStdDev) + bonus
  score = clampScore(rawScore)
```

**Source:** `gaitService.mjs → generateGaitScores(breedId, conformationScores)`

### 2.3 Bred Foal Generation (Inheritance)

```
For each standard gait:
  parentAvg = (sireGaitScore + damGaitScore) / 2
  baseValue = (parentAvg × 0.6) + (breedMean × 0.4)
  bonus = conformationBonus(foalConformationScores, gait)
  score = clampScore(normalRandom(baseValue, breedStdDev) + bonus)

For gaited gaits (breed-specific):
  If both parents have gaiting scores:
    parentAvg = (sireGaitingScore + damGaitingScore) / 2
    baseValue = (parentAvg × 0.6) + (breedMean × 0.4)
  Else:
    baseValue = breedMean
  bonus = conformationBonus(foalConformationScores, 'gaiting')
  score = clampScore(normalRandom(baseValue, breedStdDev) + bonus)
```

**Source:** `gaitService.mjs → generateInheritedGaitScores(breedId, sireGaitScores, damGaitScores, conformationScores)`

**Key:** Gaited gait availability depends on the **foal's breed**, not the parents' breeds.

---

## 3. Competition Scoring

```
FinalScore =
  BaseStatScore (weighted: 50/30/20 across primary/secondary/tertiary stats)
+ TraitBonus (+5 if discipline matches horse trait)
+ TrainingScore (0–100, optional)
+ SaddleBonus (flat number from equipped tack)
+ BridleBonus (flat number from equipped tack)
+ RiderBonus (% of subtotal)
- RiderPenalty (% of subtotal)
+ HealthModifier (% adjustment based on health rating)
+ RandomLuck (±9% for realism)
```

**Source:** `backend/logic/simulateCompetition.mjs`

---

## 4. Breed Genetic Profiles

### Data Structure

Each breed has a genetic profile with per-region means and standard deviations:

```javascript
{
  rating_profiles: {
    conformation: {
      head:         { mean: 78, std_dev: 8 },
      neck:         { mean: 75, std_dev: 8 },
      shoulders:    { mean: 76, std_dev: 8 },
      back:         { mean: 74, std_dev: 8 },
      hindquarters: { mean: 80, std_dev: 8 },
      legs:         { mean: 73, std_dev: 8 },
      hooves:       { mean: 72, std_dev: 8 },
      topline:      { mean: 77, std_dev: 8 },
    },
    gaits: {
      walk:    { mean: 65, std_dev: 9 },
      trot:    { mean: 75, std_dev: 9 },
      canter:  { mean: 80, std_dev: 9 },
      gallop:  { mean: 90, std_dev: 9 },
      gaiting: null,  // Non-gaited breeds
    },
    is_gaited_breed: false,
    gaited_gait_registry: null,
  }
}
```

**Source:** `backend/modules/horses/data/breedGeneticProfiles.mjs`

### Supported Breeds (12)

| ID  | Breed                   | Gaited |
| --- | ----------------------- | ------ |
| 1   | Thoroughbred            | No     |
| 2   | Arabian                 | No     |
| 3   | American Saddlebred     | Yes    |
| 4   | National Show Horse     | Yes    |
| 5   | Pony Of The Americas    | No     |
| 6   | Appaloosa               | No     |
| 7   | Tennessee Walking Horse | Yes    |
| 8   | Andalusian              | No     |
| 9   | American Quarter Horse  | No     |
| 10  | Walkaloosa              | Yes    |
| 11  | Lusitano                | No     |
| 12  | Paint Horse             | No     |

### Crossbreeding Rules

Not all breeds can be crossed. Only specific breed combinations produce recognized crossbreeds:

- **Thoroughbred × Arabian** → Anglo Arabian
- **American Saddlebred × Arabian** → National Show Horse
- **Appaloosa × Tennessee Walking Horse** → Walkaloosa

Crossbreeding validation happens upstream of the scoring system. The foal's assigned `breedId` determines which breed mean is used for regression in the inheritance formula.

---

## 5. Utility Functions

### normalRandom(mean, stdDev)

Box-Muller transform for generating normally distributed values.

```
u1 = random(0, 1), clamped away from 0
u2 = random(0, 1)
z = sqrt(-2 × ln(u1)) × cos(2π × u2)
result = mean + z × |stdDev|
```

### clampScore(value)

Ensures score is a valid integer in [0, 100]:

- NaN/Infinity → returns 50 (safe fallback)
- Negative → returns 0
- Above 100 → returns 100
- Otherwise → rounds to nearest integer

### calculateOverallConformation(scores)

Arithmetic mean of all 8 conformation regions, rounded to integer.

### hasValidConformationScores(scores)

Returns `true` if the scores object has at least one finite numeric region value. Used to distinguish real parent data from empty/corrupted objects.

### validateConformationScores(scores)

Normalizes a scores object for safe database persistence:

- Fills missing regions with 50
- Clamps all values to [0, 100]
- Ensures overallConformation is calculated
- Returns a clean 9-key object

---

## 6. Score Ranges & Defaults

| Context                | Default Score | Notes                                        |
| ---------------------- | ------------- | -------------------------------------------- |
| Store/legacy horse     | 20 per region | Intentionally low — incentivizes improvement |
| Unknown breed fallback | 50 per region | Neutral default for safety                   |
| NaN/corrupt data       | 50 per region | Safe fallback via clampScore                 |
| Breed-generated horse  | ~70-85 avg    | Varies by breed profile                      |
| Well-bred foal         | ~80-90 avg    | Parents with high scores + breed regression  |
| Poorly-bred foal       | ~40-55 avg    | Parents with low scores + breed regression   |

---

## 7. File Reference

| File                                                         | Contents                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `backend/modules/horses/services/conformationService.mjs`    | Conformation score generation + inheritance              |
| `backend/modules/horses/services/gaitService.mjs`            | Gait score generation + inheritance + conformation bonus |
| `backend/modules/horses/data/breedGeneticProfiles.mjs`       | Breed mean/stddev data for all 12 breeds                 |
| `backend/modules/horses/controllers/horseController.mjs`     | createFoal() integration point                           |
| `backend/models/horseModel.mjs`                              | Database persistence with validation                     |
| `backend/logic/simulateCompetition.mjs`                      | Competition scoring formula                              |
| `backend/__tests__/conformationBreedingInheritance.test.mjs` | Inheritance tests (40+ tests)                            |
| `backend/__tests__/conformationScoreGeneration.test.mjs`     | Generation tests                                         |
