# PRD-02: Core Features - User & Horse Management

**Version:** 1.2.0
**Last Updated:** 2026-03-25
**Status:** Backend ✅ Implemented | Frontend ✅ Complete

---

## 1. User Management System

### 1.1 Authentication & Account Management (P0)

**Status:** ✅ Fully Implemented (Backend)

**Requirements:**

- User registration with email/password
- Secure JWT-based authentication with refresh tokens
- Password reset and email verification
- Role-based access control (User, Moderator, Admin)
- Profile management (avatar, display name, bio)
- Account settings and preferences

**Technical Specifications:**

- bcrypt password hashing with 10+ salt rounds
- JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry)
- PostgreSQL users table with UUID primary keys
- JSONB settings field for flexible preferences
- Rate limiting on authentication endpoints (5 attempts per 15 minutes)

**Acceptance Criteria:**

- Users can register and log in securely
- Password requirements enforced (8+ characters, complexity)
- JWT tokens properly validated on protected endpoints
- User sessions persist across app restarts
- Account recovery flow functional

**Implementation Files:**

- Backend: [/backend/controllers/authController.mjs](../../backend/controllers/authController.mjs)
- Routes: [/backend/routes/authRoutes.mjs](../../backend/routes/authRoutes.mjs)
- Tests: 100% coverage for auth flows

---

### 1.2 User Progression System (P0)

**Status:** ✅ Backend Implemented | ✅ Frontend Complete

**Requirements:**

- User level system (starting at level 1)
- Experience points (XP) system with level progression
- In-game currency (money) management
- Progress tracking with percentage calculations
- XP event logging for transparency
- Dashboard with comprehensive user statistics

**Game Mechanics:**

- **Level 1:** 0-199 XP required
- **Level 2+:** 100 XP per level (Level 2 = 100-199 XP, Level 3 = 200-299 XP, etc.)
- **Starting Money:** $1,000 default
- **XP Sources:** Training (+5 XP), Competition wins (+10-20 XP), Breeding activities (+15 XP)

**Level Formula:**

```
Current Level = Math.floor(totalXP / 100) + 1
XP for Next Level = (currentLevel * 100)
Progress % = ((totalXP % 100) / 100) * 100
```

**Technical Specifications:**

- Real-time progress API with level thresholds
- XP events table for complete audit trail
- Money transaction validation (no negative balances)
- Dashboard API aggregating horses, shows, recent activity

**API Endpoints:**

- `GET /api/users/:id/progress` - Get user level/XP progress
- `GET /api/users/dashboard` - Comprehensive user dashboard
- `POST /api/users/:id/award-xp` - Award XP for activities
- `GET /api/users/:id/xp-history` - Get XP history log

**Acceptance Criteria:**

- XP properly awarded for all activities
- Level-up notifications triggered correctly
- Progress bars accurate and performant
- Money transactions validated and logged
- Dashboard loads in <500ms with all user data

---

## 2. Horse Management System

### 2.1 Horse CRUD Operations (P0)

**Status:** ✅ Backend Implemented | ✅ Frontend Complete

**Requirements:**

- Create new horses with full attribute definition
- View horse details with complete statistics
- Update horse information and attributes
- Delete horses with cascade relationship cleanup
- List horses with filtering and pagination
- Horse search by name, breed, attributes

**Horse Attributes:**

- **Basic Info:** Name (2-50 characters), age (0-30 years), gender (Mare/Stallion/Gelding)
- **Breed Information:** Breed assignment with characteristics
- **Core Stats (0-100 scale):**
  - Speed, Stamina, Agility, Balance, Precision
  - Intelligence, Boldness, Flexibility, Obedience, Focus
- **Discipline Scores (0-100+ scale):** 23 disciplines with individual progress tracking
- **Genetic Data:** JSONB epigenetic modifiers (positive/negative/hidden traits)
- **Status:** Health status, training cooldown, burnout state
- **Financial:** Total earnings, sale price, stud fee (for stallions)
- **Relationships:** Owner (user), stable assignment, parent tracking (sire/dam)

**Technical Specifications:**

- PostgreSQL horses table with JSONB for flexible data
- Comprehensive validation at API and database layers
- Indexed queries for performance (owner_id, breed_id, training_cooldown)
- Cascade deletes for competition results and training logs
- Support for both UUID users and legacy integer user IDs

**API Endpoints:**

- `POST /api/horses` - Create new horse
- `GET /api/horses/:id` - Get horse details
- `PUT /api/horses/:id` - Update horse
- `DELETE /api/horses/:id` - Delete horse
- `GET /api/horses/user/:userId` - List user's horses
- `GET /api/horses/search` - Search horses

**Acceptance Criteria:**

- CRUD operations functional with proper validation
- Horse lists paginated (20 per page default)
- Filtering by age, breed, gender, owner functional
- Search returns results in <200ms for 10,000+ horses
- All relationships properly maintained on updates/deletes

---

### 2.2 Horse XP & Stat Progression System (P0)

**Status:** ✅ Backend Implemented | ✅ Frontend Complete

**Requirements:**

- Horses earn XP from competition participation
- XP converts to stat points for strategic allocation
- Complete XP history tracking with audit trail
- Player-controlled stat point distribution
- Independent from user XP system

**Game Mechanics:**

- **XP to Stat Conversion:** 100 Horse XP = 1 allocable stat point
- **Competition XP Awards:**
  - 1st Place: 30 XP (20 base + 10 placement bonus)
  - 2nd Place: 27 XP (20 base + 7 placement bonus)
  - 3rd Place: 25 XP (20 base + 5 placement bonus)
  - 4th+: 20 XP (no placement bonus)
- **Stat Allocation:** Player chooses which stat to increase (Speed, Stamina, Agility, etc.)
- **Allocation Limit:** 1 point per allocation request
- **Strategic Purpose:** Allows specialization of horses for specific disciplines

**XP Calculation Formula:**

```javascript
baseXP = 20;
placementBonus = placement === 1 ? 10 : placement === 2 ? 7 : placement === 3 ? 5 : 0;
totalHorseXP = baseXP + placementBonus;
availableStatPoints = Math.floor(horse.totalXP / 100);
```

**Technical Specifications:**

- Horse XP stored in horses table
- HorseXPEvent table for complete history
- Stat allocation validation (prevents over-allocation)
- API endpoints for XP status, allocation, and history
- Integration with competition result processing

**API Endpoints:**

- `GET /api/horses/:id/xp` - Get horse XP status and available stat points
- `POST /api/horses/:id/allocate-stat` - Allocate stat points to horse stats
- `GET /api/horses/:id/xp-history` - Get paginated horse XP history
- `POST /api/horses/:id/award-xp` - Award XP to horses (admin/system)

**Acceptance Criteria:**

- XP properly awarded based on competition placement
- Stat points correctly calculated (total XP ÷ 100)
- Stat allocation immediately reflected in horse stats
- XP history provides complete audit trail
- System prevents negative XP or invalid allocations

---

## 3. Horse Conformation and Physical Attributes

### 3.1 Conformation Scoring System (P1)

**Status:** ✅ Implemented (Epic 31B-1, 31B-2, 31B-3)

**Requirements:**

- 8 body region scores (0-100 per region), generated once at horse creation/birth
- Scores are **permanent and immutable** — no training, grooming, or gameplay changes them
- Generated via normal distribution using breed-specific `rating_profiles.conformation` (mean + std_dev per region)
- Breeding inheritance: foal conformation = weighted blend of parent scores + breed mean + random variance
- Conformation show integration (see PRD-03 §3.6)
- Breed percentile analysis for comparative evaluation

**Conformation Regions:**

Each breed's `breed_genetic_profile.rating_profiles.conformation` defines `{ mean, std_dev }` per region.

1. **Head:** Structure, refinement, expression (0-100)
2. **Neck:** Length, shape, carriage quality (0-100)
3. **Shoulders:** Angle, slope, muscling (0-100)
4. **Back:** Strength, length, coupling (0-100)
5. **Hindquarters:** Power, structure, engagement (0-100)
6. **Legs:** Structure, correctness, soundness (0-100)
7. **Hooves:** Size, shape, quality (0-100)
8. **Topline:** Muscle definition, overall condition (0-100)

**Score Generation (At Birth/Creation):**

```
For each region:
  rawScore = normalRandom(breedMean, breedStdDev)
  finalScore = clamp(Math.round(rawScore), 0, 100)

overallConformation = average of all 8 region scores
```

Standard deviations: most breeds use std_dev = 8 per region; Lusitano has per-region values (5–7) based on BreedData source file. This produces a bell curve where ~68% of horses score within ±1 std_dev of the breed mean and ~95% within ±2 std_dev.

**Breeding Inheritance:**

```
For each region:
  parentAvg = (sire.region + dam.region) / 2
  breedMean = breed.rating_profiles.conformation.region.mean
  foalScore = clamp(
    normalRandom(
      (parentAvg * 0.6) + (breedMean * 0.4),
      breed.rating_profiles.conformation.region.std_dev
    ),
    0, 100
  )
```

Parent contribution: 60%. Breed mean regression: 40%. Random variance from breed std_dev.

**Breed Rating Profile Data (12 breeds):**

| Breed                   | Head | Neck | Shoulders | Back | Hindquarters | Legs | Hooves | Topline |
| ----------------------- | ---- | ---- | --------- | ---- | ------------ | ---- | ------ | ------- |
| Thoroughbred            | 78   | 75   | 72        | 70   | 76           | 74   | 70     | 73      |
| Arabian                 | 85   | 82   | 70        | 68   | 72           | 70   | 75     | 72      |
| American Saddlebred     | 80   | 78   | 72        | 70   | 74           | 72   | 70     | 74      |
| National Show Horse     | 82   | 80   | 71        | 69   | 73           | 71   | 72     | 74      |
| Pony Of The Americas    | 75   | 70   | 68        | 65   | 70           | 68   | 68     | 67      |
| Appaloosa               | 72   | 70   | 70        | 68   | 75           | 70   | 70     | 70      |
| Tennessee Walking Horse | 75   | 74   | 72        | 70   | 78           | 72   | 70     | 72      |
| Andalusian              | 80   | 78   | 72        | 70   | 76           | 72   | 70     | 75      |
| American Quarter Horse  | 75   | 72   | 74        | 70   | 78           | 74   | 72     | 72      |
| Walkaloosa              | 74   | 72   | 70        | 68   | 75           | 70   | 70     | 70      |
| Lusitano                | 84   | 90   | 82        | 84   | 88           | 82   | 80     | 83      |
| Paint Horse             | 75   | 76   | 75        | 74   | 78           | 73   | 73     | 74      |

_All 12 breeds fully populated in `breedGeneticProfiles.mjs`. Lusitano has per-region std_dev values (5–7); all other breeds use std_dev = 8._

**Technical Specifications:**

- `Horse.conformationScores` JSONB: `{ head, neck, shoulders, back, hindquarters, legs, hooves, topline }` each 0-100
- Generated at horse creation (new horse) and foal birth (breeding)
- Read-only after generation — no mutation endpoints
- `Breed.breedGeneticProfile.rating_profiles.conformation` provides generation parameters
- Overall conformation = arithmetic mean of all 8 region scores

**API Endpoints:**

- `GET /api/v1/horses/:id/conformation` — Region breakdown + overall score
- `GET /api/v1/horses/:id/conformation/analysis` — Breed comparison with percentile rankings per region

**Acceptance Criteria:**

- Conformation scores generated for every new horse and foal
- Scores follow normal distribution within breed parameters (verifiable via statistical test on 1000+ samples)
- No endpoint exists to modify conformation after creation
- Breeding produces foal scores that regress toward breed mean (60/40 parent/breed split)
- All scores clamped to 0-100 integer range
- API returns region breakdown and overall score in <200ms

---

### 3.2 Gait Quality System (P1)

**Status:** ❌ Not Implemented — Full Specification Ready

**Requirements:**

- Gait quality scores generated once at horse creation/birth — **permanent and immutable**
- No training, leveling, or gameplay modifies gait scores — a horse either moves well or it doesn't
- Scores derived from breed genetics (`rating_profiles.gaits`) + conformation influence
- Non-gaited breeds: 4 standard gaits (walk, trot, canter, gallop)
- Gaited breeds: 4 standard gaits + breed-specific named gaits (not a generic "gaiting" field)
- Competition integration: gaited disciplines require breed-specific gait scores; standard disciplines use relevant gait scores as bonus modifiers

**Standard Gaits (All Breeds):**

1. **Walk:** Rhythm, stride length, quality (0-100)
2. **Trot:** Extension, suspension, balance (0-100)
3. **Canter:** Collection, balance, rhythm (0-100)
4. **Gallop:** Speed, efficiency, stamina (0-100)

**Breed-Specific Gaited Gaits:**

Gaited breeds have additional named gaits unique to their breed. The system checks the breed's gaited gait registry to determine which extra gaits a horse receives.

| Breed                          | Gaited | Breed-Specific Gaits    |
| ------------------------------ | ------ | ----------------------- |
| American Saddlebred (ID 3)     | Yes    | Slow Gait, Rack         |
| National Show Horse (ID 4)     | Yes    | Slow Gait, Rack         |
| Tennessee Walking Horse (ID 7) | Yes    | Flat Walk, Running Walk |
| Walkaloosa (ID 10)             | Yes    | Indian Shuffle          |
| Thoroughbred (ID 1)            | No     | —                       |
| Arabian (ID 2)                 | No     | —                       |
| Pony Of The Americas (ID 5)    | No     | —                       |
| Appaloosa (ID 6)               | No     | —                       |
| Andalusian (ID 8)              | No     | —                       |
| American Quarter Horse (ID 9)  | No     | —                       |
| Lusitano (ID 11)               | No     | —                       |
| Paint Horse (ID 12)            | No     | —                       |

Non-gaited breeds store `null` for gaited gait fields. Gaited breed gait scores use the breed's `rating_profiles.gaits.gaiting` mean/std_dev for generation.

**Score Generation (At Birth/Creation):**

```
For each standard gait (walk, trot, canter, gallop):
  baseScore = normalRandom(breedGaitMean, breedGaitStdDev)

  // Conformation influence (±5 modifier based on relevant regions)
  conformationBonus = calculateConformationInfluence(horse.conformationScores, gaitType)

  finalScore = clamp(Math.round(baseScore + conformationBonus), 0, 100)

For breed-specific gaited gaits (if is_gaited_breed):
  gaitingScore = normalRandom(breedGaitingMean, breedGaitingStdDev)
  conformationBonus = calculateConformationInfluence(horse.conformationScores, 'gaiting')
  finalScore = clamp(Math.round(gaitingScore + conformationBonus), 0, 100)
  // Score applies to ALL of the breed's named gaits (same base quality)
```

**Conformation-to-Gait Influence Mapping:**

| Gait         | Primary Conformation Regions | Influence                     |
| ------------ | ---------------------------- | ----------------------------- |
| Walk         | Shoulders, Back              | (avg of regions - 70) \* 0.15 |
| Trot         | Shoulders, Hindquarters      | (avg of regions - 70) \* 0.15 |
| Canter       | Back, Hindquarters           | (avg of regions - 70) \* 0.15 |
| Gallop       | Legs, Hindquarters           | (avg of regions - 70) \* 0.15 |
| Gaited gaits | Legs, Back, Hindquarters     | (avg of regions - 70) \* 0.15 |

Conformation influence range: approximately -10 to +5 modifier (most horses near 0).

**Breed Gait Rating Data (12 breeds, standard gaits):**

| Breed                   | Walk | Trot | Canter | Gallop | Gaiting |
| ----------------------- | ---- | ---- | ------ | ------ | ------- |
| Thoroughbred            | 65   | 75   | 80     | 90     | null    |
| Arabian                 | 70   | 78   | 75     | 80     | null    |
| American Saddlebred     | 70   | 75   | 70     | 65     | 85      |
| National Show Horse     | 70   | 76   | 72     | 70     | 82      |
| Pony Of The Americas    | 65   | 70   | 68     | 72     | null    |
| Appaloosa               | 65   | 70   | 72     | 75     | null    |
| Tennessee Walking Horse | 72   | 65   | 70     | 65     | 85      |
| Andalusian              | 70   | 78   | 76     | 70     | null    |
| American Quarter Horse  | 65   | 70   | 74     | 80     | null    |
| Walkaloosa              | 70   | 68   | 70     | 72     | 85      |
| Lusitano                | —    | —    | —      | —      | null    |
| Paint Horse             | 72   | 73   | 74     | 73     | null    |

_All breeds use std_dev = 9. Lusitano gait ratings TBD._

**Breeding Inheritance:**

```
For each gait:
  parentAvg = (sire.gait + dam.gait) / 2
  breedMean = breed.rating_profiles.gaits.gaitType.mean
  foalScore = clamp(
    normalRandom(
      (parentAvg * 0.6) + (breedMean * 0.4),
      breed.rating_profiles.gaits.gaitType.std_dev
    ) + conformationBonus,
    0, 100
  )
```

Cross-breed breeding: if one parent is gaited and the other is not, the foal's gaited gait availability depends on the foal's assigned breed. Only foals of gaited breeds receive gaited gait scores.

**Technical Specifications:**

- `Horse.gaitScores` JSONB: `{ walk, trot, canter, gallop, gaiting: { name: string, score: number }[] | null }`
- Gaited gait entries store both the breed-specific gait name and the score
- Generated after conformation scores (depends on conformation for influence calculation)
- Read-only after generation — no mutation endpoints
- `Breed.breedGeneticProfile.rating_profiles.gaits` provides generation parameters
- `Breed.breedGeneticProfile.rating_profiles.is_gaited_breed` gates gaited gait generation

**API Endpoints:**

- `GET /api/v1/horses/:id/gaits` — Standard gait scores + breed-specific gaited gaits (with names)

**Acceptance Criteria:**

- Gait scores generated for every new horse and foal, after conformation scores
- Non-gaited breeds have `gaiting: null` — no exceptions
- Gaited breeds receive correctly named breed-specific gaits (e.g., Saddlebred gets "Slow Gait" and "Rack", not generic "gaiting")
- No endpoint exists to modify gait scores after creation
- Conformation influence produces measurable correlation (r > 0.3) between relevant conformation regions and gait scores across 1000+ samples
- Breeding inheritance regresses toward breed mean (60/40 split)
- All scores clamped to 0-100 integer range

---

### 3.3 Coat Color Genetics System (P1)

**Status:** ❌ Not Implemented — Full Specification Ready

**Requirements:**

- Full Mendelian genetics with 17+ loci controlling coat color, dilution, pattern, and white markings
- Each horse stores a complete genotype (allele pairs per locus) in JSONB
- Phenotype (display color, shade, markings) calculated deterministically from genotype
- Breed-specific allele restrictions and probability weights
- Lethal combination prevention (homozygous lethal genotypes filtered at breeding)
- Standard Mendelian inheritance: each parent contributes one random allele per locus
- Face and leg marking system with breed-specific probability biases
- Breeding color prediction (offspring probability chart)

**Allele Loci (17+ Loci):**

| Locus           | Code   | Controls                        | Alleles                                      |
| --------------- | ------ | ------------------------------- | -------------------------------------------- |
| Extension       | E      | Red/black pigment               | e/e, E/e, E/E                                |
| Agouti          | A      | Black distribution              | a/a, A/a, A/A                                |
| Cream           | Cr     | Cream dilution                  | n/n, n/Cr, Cr/Cr                             |
| Dun             | D      | Dun dilution + dorsal stripe    | D/D, D/nd1, D/nd2, nd1/nd1, nd1/nd2, nd2/nd2 |
| Silver          | Z      | Silver dilution (black pigment) | n/n, Z/n, Z/Z                                |
| Champagne       | Ch     | Champagne dilution              | n/n, Ch/n, Ch/Ch                             |
| Gray            | G      | Progressive graying             | g/g, G/g, G/G                                |
| Roan            | Rn     | Roan pattern                    | rn/rn, Rn/rn, Rn/Rn                          |
| Dominant White  | W      | White spotting/full white       | w/w, W1/w through W39/w                      |
| Tobiano         | TO     | Tobiano pattern                 | to/to, TO/to, TO/TO                          |
| Frame Overo     | O      | Frame overo pattern             | n/n, O/n                                     |
| Sabino 1        | SB1    | Sabino white pattern            | n/n, SB1/n                                   |
| Splash White    | SW     | Splash white pattern            | n/n, SW1/n through SW10/n                    |
| Leopard Complex | LP     | Appaloosa base pattern          | lp/lp, LP/lp, LP/LP                          |
| Pattern 1       | PATN1  | Appaloosa pattern extent        | patn1/patn1, PATN1/patn1, PATN1/PATN1        |
| Mushroom        | MFSD12 | Mushroom dilution               | N/N, Mu/N, Mu/Mu                             |
| Pearl           | Prl    | Pearl dilution                  | N/N, N/Prl, Prl/Prl, Cr/Prl                  |
| Brindle         | BR1    | Brindle striping                | N/N, N/BR1, BR1/BR1, BR1/Y                   |
| EDXW            | EDXW   | Extended dominant white         | n/n, EDXW1/n, EDXW2/n, EDXW3/n               |

**Lethal Combinations (Filtered at Breeding):**

These genotypes are embryonic lethal — the breeding system rerolls if a foal would receive one:

| Locus          | Lethal Genotype                                                                 | Reason                      |
| -------------- | ------------------------------------------------------------------------------- | --------------------------- |
| Frame Overo    | O/O                                                                             | Lethal White Overo Syndrome |
| Dominant White | W5/W5, W10/W10, W13/W13, W15/W15, W19/W19, W20/W20, W22/W22, W36-W39 homozygous | Embryonic lethal            |
| Splash White   | SW3-SW10 homozygous                                                             | Embryonic lethal            |
| EDXW           | EDXW1-EDXW3 homozygous                                                          | Embryonic lethal            |

**Breed Allele Restrictions:**

Each breed's `breed_genetic_profile` defines:

- `allowed_alleles` — which allele combinations the breed can carry (breed registry restrictions)
- `disallowed_combinations` — combinations impossible within the breed
- `allele_weights` — probability distribution for random generation (initial horse creation, not breeding)

Example: Thoroughbreds cannot carry Tobiano (TO) or Leopard Complex (LP). Paint Horses have elevated Tobiano/Overo weights.

**Phenotype Calculation:**

The genotype-to-phenotype service determines:

1. **Base color** — Extension + Agouti interaction: Bay (E/_ + A/_), Black (E/\_ + a/a), Chestnut (e/e)
2. **Dilutions applied in order** — Cream → Dun → Silver → Champagne → Pearl → Mushroom
3. **Pattern overlays** — Gray, Roan, Tobiano, Frame Overo, Sabino, Splash White, Leopard Complex + PATN1, Dominant White, Brindle
4. **Display color name** — One of 40+ possible color names (e.g., "Buckskin", "Grulla", "Silver Bay", "Gold Champagne")
5. **Shade variant** — Each display color has shade options with breed-specific `shade_bias` probabilities

**Boolean Modifiers:**

Separate from allele loci, applied as visual modifiers with breed-specific prevalence:

| Modifier | Effect                               | Default Prevalence |
| -------- | ------------------------------------ | ------------------ |
| Sooty    | Darkened body color                  | 30%                |
| Flaxen   | Lightened mane/tail (chestnuts only) | 10%                |
| Pangare  | Light belly/muzzle ("mealy")         | 10%                |
| Rabicano | White ticking at flanks/tail         | 5%                 |

**Marking System:**

**Face Markings** — One of: none, star, strip, blaze, snip. Probability per breed's `marking_bias.face`.

**Leg Markings** — Each of 4 legs independently: none, coronet, pastern, sock, stocking. General probability from `marking_bias.legs_general_probability` (default 50% per leg), type from `marking_bias.leg_specific_probabilities`.

**Advanced Markings** — Breed-specific probability multipliers:

- Bloody shoulder (Appaloosa-family, multiplied by `bloody_shoulder_probability_multiplier`)
- Snowflake (LP carriers, multiplied by `snowflake_probability_multiplier`)
- Frost (LP carriers, multiplied by `frost_probability_multiplier`)

**Mendelian Inheritance (Breeding):**

```
For each locus:
  sireAllele = random choice from sire's allele pair
  damAllele = random choice from dam's allele pair
  foalGenotype[locus] = sireAllele + damAllele

  // Check against disallowed_combinations
  if (isLethal(foalGenotype[locus])):
    reroll until non-lethal (max 100 attempts, then fallback to heterozygous)

  // Check against breed's allowed_alleles
  if (!breed.allowed_alleles[locus].includes(foalGenotype[locus])):
    foalGenotype[locus] = breed default (most common allele pair)
```

Markings inherit with 50% chance of each parent's marking type + 20% chance of random reroll from breed bias.

**Shade Variants:**

Each base phenotype color has shade options defined in `breed_genetic_profile.shade_bias`. Examples:

| Base Color | Shade Options                                      |
| ---------- | -------------------------------------------------- |
| Chestnut   | light (30%), medium (40%), dark (30%)              |
| Bay        | light (30%), standard (40%), dark (30%)            |
| Black      | standard (50%), faded (50%)                        |
| Palomino   | pale (30%), golden (40%), copper (30%)             |
| Buckskin   | cream (30%), golden (40%), burnished (30%)         |
| Grulla     | silver gray (30%), standard (40%), burnished (30%) |

Full shade table covers 50+ phenotype colors (see `generichorse.txt` sample data).

**Technical Specifications:**

- `Horse.colorGenotype` JSONB: allele pair per locus (e.g., `{ "E_Extension": "E/e", "A_Agouti": "A/A", ... }`)
- `Horse.phenotype` JSONB: `{ displayColor, shade, booleanModifiers, faceMarking, legMarkings, advancedMarkings }`
- Phenotype calculated from genotype at creation and stored (deterministic, recalculable)
- `Breed.breedGeneticProfile` contains `allowed_alleles`, `disallowed_combinations`, `allele_weights`, `marking_bias`, `shade_bias`, `boolean_modifiers_prevalence`, `advanced_markings_bias`

**API Endpoints:**

- `GET /api/v1/horses/:id/genetics` — Full genotype + calculated phenotype
- `GET /api/v1/horses/:id/color` — Display color name, shade, markings (player-facing summary)
- `POST /api/v1/breeding/color-prediction/:sireId/:damId` — Probability chart of possible offspring colors based on parent genotypes

**Acceptance Criteria:**

- Every new horse and foal receives a complete genotype across all loci
- Phenotype deterministically derived from genotype (same genotype always produces same color name)
- No lethal combinations appear in any horse's genotype
- Breed restrictions enforced — no alleles outside the breed's `allowed_alleles`
- Mendelian ratios hold across large samples (e.g., Ee x Ee produces ~25% ee offspring over 1000 trials)
- Color prediction endpoint returns accurate probability percentages for all possible offspring phenotypes
- Markings (face + legs) generated per breed bias probabilities
- API responses include both genotype (for breeders) and phenotype (for display) in <300ms

---

## Cross-References

- **Previous:** [PRD-01-Overview.md](./PRD-01-Overview.md)
- **Next:** [PRD-03-Gameplay-Systems.md](./PRD-03-Gameplay-Systems.md)
- **Advanced Systems:** [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **Technical Documentation:** [docs/index.md](../index.md)
- **API Contracts:** [api-contracts-backend.md](../api-contracts-backend.md)
- **Data Models:** [data-models.md](../data-models.md)

---

## Document History

| Version | Date       | Changes                                                                                           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2025-11-07 | Initial breakdown - User and Horse Management                                                     |
| 1.0.1   | 2025-12-01 | Updated cross-references to existing documentation                                                |
| 1.2.0   | 2026-03-25 | Full specs for Conformation (3.1), Gait Quality (3.2), Coat Color Genetics (3.3) from sample data |
| 1.1.0   | 2026-03-18 | Frontend marked complete; all subsystem statuses updated                                          |
