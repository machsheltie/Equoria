// Canonical breed genetic profile data for all 12 Equoria breeds.
// Contains rating_profiles (conformation, gaits, gaited config), starter_stats, and temperament_weights.
// Source: PRD-02 §3.1/§3.2, PRD-03 §7.3, samples/BreedData/*.txt
//
// DATA VERSION: 4 (2026-03-27) — Pre-31D cleanup sprint:
//   - Enriched Arabian, American Saddlebred, Appaloosa, Andalusian,
//     American Quarter Horse, Paint Horse with real BreedData (per-region std_dev)
//   - Added starter_stats (12 stats with mean + std_dev) for ALL 12 breeds
//   - Updated temperament_weights from BreedData where available
//   - Breeds without BreedData files retain existing conformation/gait defaults
//
// This file is the AUTHORITATIVE source of truth for breed genetic profiles.
// The population script copies these values into the database.
// If you need to change breed data, edit THIS file first, then re-run the population script.
//
// TEMPERAMENT NORMALIZATION POLICY:
// Source SQL had weight-sum errors for 5 breeds. Fixes applied per breed:
//   - National Show Horse (ID 4): sum 95→100 — Playful +3, Calm +2
//   - Tennessee Walking Horse (ID 7): sum 99→100 — Calm +1
//   - Walkaloosa (ID 10): sum 99→100 — Calm +1
//   Breeds with BreedData files now use BreedData temperament_weights directly.
//
// STD_DEV POLICY:
// Each conformation region and gait has its own { mean, std_dev } object.
// Breeds with BreedData files have per-region std_dev values from real data.
// Breeds awaiting BreedData files use uniform defaults (conformation: 8, gaits: 9).
//
// STARTER_STATS POLICY:
// Each breed has 12 stat entries with { mean, std_dev } for store-bought horses.
// Breeds with BreedData files use their provided starter_stats.
// Breeds without BreedData files use reasonable defaults based on breed character.

/**
 * The 12 canonical breeds and their IDs.
 * Used for upserting breeds that may not exist in the database yet.
 */
export const CANONICAL_BREEDS = [
  {
    id: 1,
    name: 'Thoroughbred',
    description: 'Athletic and versatile racing breed known for speed and stamina',
  },
  {
    id: 2,
    name: 'Arabian',
    description: 'Ancient breed prized for endurance, intelligence, and refinement',
  },
  {
    id: 3,
    name: 'American Saddlebred',
    description: 'Elegant five-gaited show horse with high-stepping action',
  },
  {
    id: 4,
    name: 'National Show Horse',
    description: 'Arabian-Saddlebred cross combining showiness and sensitivity',
  },
  {
    id: 5,
    name: 'Pony Of The Americas',
    description: 'Gentle, versatile pony breed ideal for youth riders',
  },
  {
    id: 6,
    name: 'Appaloosa',
    description: 'Versatile breed known for distinctive spotted coat patterns',
  },
  {
    id: 7,
    name: 'Tennessee Walking Horse',
    description: 'Smooth-gaited breed famous for comfortable trail riding',
  },
  {
    id: 8,
    name: 'Andalusian',
    description: 'Noble Iberian breed excelling in classical dressage',
  },
  {
    id: 9,
    name: 'American Quarter Horse',
    description: 'Steady, versatile breed dominating western disciplines',
  },
  {
    id: 10,
    name: 'Walkaloosa',
    description: 'Gaited Appaloosa cross combining spotted patterns with smooth gait',
  },
  {
    id: 11,
    name: 'Lusitano',
    description: 'Courageous Iberian breed known for agility and classical movements',
  },
  {
    id: 12,
    name: 'Paint Horse',
    description: 'Colorful stock horse breed excelling in western events',
  },
];

/**
 * 11 temperament types used across all breeds.
 * Weights per breed sum to 100.
 */
export const TEMPERAMENT_TYPES = [
  'Spirited',
  'Nervous',
  'Calm',
  'Bold',
  'Steady',
  'Independent',
  'Reactive',
  'Stubborn',
  'Playful',
  'Lazy',
  'Aggressive',
];

/**
 * Complete breed genetic profiles keyed by breed ID.
 * Each entry contains:
 *   - rating_profiles.conformation: 8 body regions with { mean, std_dev }
 *   - rating_profiles.gaits: 5 gait scores (gaiting null for non-gaited)
 *   - rating_profiles.is_gaited_breed: boolean
 *   - rating_profiles.gaited_gait_registry: string[] | null
 *   - starter_stats: 12 horse stats with { mean, std_dev } for store purchases
 *   - temperament_weights: 11 types summing to 100
 */
export const BREED_GENETIC_PROFILES = {
  // Thoroughbred (ID 1) — High-energy racing breed
  // Conformation/gait std_dev: uniform defaults (no BreedData file)
  // Starter stats: defaults emphasizing speed/stamina
  1: {
    rating_profiles: {
      conformation: {
        head: { mean: 78, std_dev: 8 },
        neck: { mean: 75, std_dev: 8 },
        shoulders: { mean: 72, std_dev: 8 },
        back: { mean: 70, std_dev: 8 },
        hindquarters: { mean: 76, std_dev: 8 },
        legs: { mean: 74, std_dev: 8 },
        hooves: { mean: 70, std_dev: 8 },
        topline: { mean: 73, std_dev: 8 },
      },
      gaits: {
        walk: { mean: 65, std_dev: 9 },
        trot: { mean: 75, std_dev: 9 },
        canter: { mean: 80, std_dev: 9 },
        gallop: { mean: 90, std_dev: 9 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 17, std_dev: 3 },
      balance: { mean: 15, std_dev: 3 },
      boldness: { mean: 16, std_dev: 3 },
      endurance: { mean: 17, std_dev: 3 },
      flexibility: { mean: 14, std_dev: 3 },
      focus: { mean: 16, std_dev: 3 },
      intelligence: { mean: 15, std_dev: 3 },
      obedience: { mean: 14, std_dev: 3 },
      precision: { mean: 14, std_dev: 3 },
      speed: { mean: 20, std_dev: 3 },
      stamina: { mean: 18, std_dev: 3 },
      strength: { mean: 16, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 30,
      Nervous: 15,
      Calm: 3,
      Bold: 15,
      Steady: 5,
      Independent: 5,
      Reactive: 15,
      Stubborn: 3,
      Playful: 5,
      Lazy: 3,
      Aggressive: 1,
    },
  },

  // Arabian (ID 2) — Endurance breed, intelligent and spirited
  // Source: BreedData/Arabian.txt — real data with per-region std_dev values
  2: {
    rating_profiles: {
      conformation: {
        head: { mean: 95, std_dev: 4 },
        neck: { mean: 90, std_dev: 5 },
        shoulders: { mean: 85, std_dev: 6 },
        back: { mean: 88, std_dev: 5 },
        hindquarters: { mean: 84, std_dev: 6 },
        legs: { mean: 88, std_dev: 5 },
        hooves: { mean: 90, std_dev: 5 },
        topline: { mean: 82, std_dev: 6 },
      },
      gaits: {
        walk: { mean: 85, std_dev: 6 },
        trot: { mean: 88, std_dev: 5 },
        canter: { mean: 85, std_dev: 6 },
        gallop: { mean: 92, std_dev: 4 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 17, std_dev: 3 },
      balance: { mean: 15, std_dev: 3 },
      boldness: { mean: 18, std_dev: 3 },
      endurance: { mean: 20, std_dev: 3 },
      flexibility: { mean: 15, std_dev: 3 },
      focus: { mean: 18, std_dev: 3 },
      intelligence: { mean: 17, std_dev: 3 },
      obedience: { mean: 16, std_dev: 3 },
      precision: { mean: 14, std_dev: 3 },
      speed: { mean: 18, std_dev: 3 },
      stamina: { mean: 19, std_dev: 3 },
      strength: { mean: 13, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 40,
      Nervous: 10,
      Calm: 5,
      Bold: 20,
      Steady: 5,
      Independent: 10,
      Reactive: 5,
      Stubborn: 2,
      Playful: 2,
      Lazy: 0,
      Aggressive: 1,
    },
  },

  // American Saddlebred (ID 3) — Gaited show horse
  // Source: BreedData/American Saddlebred.txt — real data with per-region std_dev values
  3: {
    rating_profiles: {
      conformation: {
        head: { mean: 88, std_dev: 5 },
        neck: { mean: 92, std_dev: 4 },
        shoulders: { mean: 85, std_dev: 6 },
        back: { mean: 85, std_dev: 6 },
        hindquarters: { mean: 82, std_dev: 7 },
        legs: { mean: 80, std_dev: 7 },
        hooves: { mean: 82, std_dev: 7 },
        topline: { mean: 84, std_dev: 6 },
      },
      gaits: {
        walk: { mean: 82, std_dev: 7 },
        trot: { mean: 88, std_dev: 5 },
        canter: { mean: 90, std_dev: 5 },
        gallop: { mean: 70, std_dev: 9 },
        gaiting: { mean: 92, std_dev: 4 },
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Slow Gait', 'Rack'],
    },
    starter_stats: {
      agility: { mean: 17, std_dev: 3 },
      balance: { mean: 18, std_dev: 3 },
      boldness: { mean: 16, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 18, std_dev: 3 },
      focus: { mean: 18, std_dev: 3 },
      intelligence: { mean: 17, std_dev: 3 },
      obedience: { mean: 17, std_dev: 3 },
      precision: { mean: 18, std_dev: 3 },
      speed: { mean: 16, std_dev: 3 },
      stamina: { mean: 15, std_dev: 3 },
      strength: { mean: 15, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 35,
      Nervous: 10,
      Calm: 10,
      Bold: 15,
      Steady: 10,
      Independent: 5,
      Reactive: 10,
      Stubborn: 2,
      Playful: 2,
      Lazy: 0,
      Aggressive: 1,
    },
  },

  // National Show Horse (ID 4) — Gaited Arabian-Saddlebred cross
  // Conformation/gait std_dev: uniform defaults (no BreedData file)
  // Starter stats: defaults emphasizing showmanship/flexibility
  4: {
    rating_profiles: {
      conformation: {
        head: { mean: 82, std_dev: 8 },
        neck: { mean: 80, std_dev: 8 },
        shoulders: { mean: 71, std_dev: 8 },
        back: { mean: 69, std_dev: 8 },
        hindquarters: { mean: 73, std_dev: 8 },
        legs: { mean: 71, std_dev: 8 },
        hooves: { mean: 72, std_dev: 8 },
        topline: { mean: 74, std_dev: 8 },
      },
      gaits: {
        walk: { mean: 70, std_dev: 9 },
        trot: { mean: 76, std_dev: 9 },
        canter: { mean: 72, std_dev: 9 },
        gallop: { mean: 70, std_dev: 9 },
        gaiting: { mean: 82, std_dev: 9 },
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Slow Gait', 'Rack'],
    },
    starter_stats: {
      agility: { mean: 17, std_dev: 3 },
      balance: { mean: 18, std_dev: 3 },
      boldness: { mean: 16, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 18, std_dev: 3 },
      focus: { mean: 17, std_dev: 3 },
      intelligence: { mean: 17, std_dev: 3 },
      obedience: { mean: 16, std_dev: 3 },
      precision: { mean: 17, std_dev: 3 },
      speed: { mean: 16, std_dev: 3 },
      stamina: { mean: 15, std_dev: 3 },
      strength: { mean: 14, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 25,
      Nervous: 5,
      Calm: 10,
      Bold: 20,
      Steady: 8,
      Independent: 5,
      Reactive: 5,
      Stubborn: 5,
      Playful: 15,
      Lazy: 1,
      Aggressive: 1,
    },
  },

  // Pony Of The Americas (ID 5) — Gentle youth breed
  // Conformation/gait std_dev: uniform defaults (no BreedData file)
  // Starter stats: defaults emphasizing obedience/gentleness
  5: {
    rating_profiles: {
      conformation: {
        head: { mean: 75, std_dev: 8 },
        neck: { mean: 70, std_dev: 8 },
        shoulders: { mean: 68, std_dev: 8 },
        back: { mean: 65, std_dev: 8 },
        hindquarters: { mean: 70, std_dev: 8 },
        legs: { mean: 68, std_dev: 8 },
        hooves: { mean: 68, std_dev: 8 },
        topline: { mean: 67, std_dev: 8 },
      },
      gaits: {
        walk: { mean: 65, std_dev: 9 },
        trot: { mean: 70, std_dev: 9 },
        canter: { mean: 68, std_dev: 9 },
        gallop: { mean: 72, std_dev: 9 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 16, std_dev: 3 },
      balance: { mean: 16, std_dev: 3 },
      boldness: { mean: 14, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 15, std_dev: 3 },
      intelligence: { mean: 16, std_dev: 3 },
      obedience: { mean: 18, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 15, std_dev: 3 },
      stamina: { mean: 15, std_dev: 3 },
      strength: { mean: 14, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 5,
      Nervous: 2,
      Calm: 30,
      Bold: 10,
      Steady: 25,
      Independent: 5,
      Reactive: 2,
      Stubborn: 5,
      Playful: 10,
      Lazy: 5,
      Aggressive: 1,
    },
  },

  // Appaloosa (ID 6) — Versatile spotted breed
  // Source: BreedData/Appaloosa.txt — real data with per-region std_dev values
  6: {
    rating_profiles: {
      conformation: {
        head: { mean: 82, std_dev: 6 },
        neck: { mean: 75, std_dev: 7 },
        shoulders: { mean: 80, std_dev: 7 },
        back: { mean: 85, std_dev: 5 },
        hindquarters: { mean: 88, std_dev: 5 },
        legs: { mean: 85, std_dev: 6 },
        hooves: { mean: 82, std_dev: 7 },
        topline: { mean: 84, std_dev: 6 },
      },
      gaits: {
        walk: { mean: 75, std_dev: 8 },
        trot: { mean: 70, std_dev: 9 },
        canter: { mean: 75, std_dev: 8 },
        gallop: { mean: 85, std_dev: 7 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 18, std_dev: 3 },
      balance: { mean: 16, std_dev: 3 },
      boldness: { mean: 17, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 16, std_dev: 3 },
      intelligence: { mean: 16, std_dev: 3 },
      obedience: { mean: 16, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 20, std_dev: 3 },
      stamina: { mean: 16, std_dev: 3 },
      strength: { mean: 18, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 10,
      Nervous: 5,
      Calm: 25,
      Bold: 15,
      Steady: 20,
      Independent: 10,
      Reactive: 5,
      Stubborn: 4,
      Playful: 5,
      Lazy: 0,
      Aggressive: 1,
    },
  },

  // Tennessee Walking Horse (ID 7) — Gaited trail breed
  // Conformation/gait std_dev: uniform defaults (no BreedData file)
  // Starter stats: defaults emphasizing endurance/obedience/balance
  7: {
    rating_profiles: {
      conformation: {
        head: { mean: 75, std_dev: 8 },
        neck: { mean: 74, std_dev: 8 },
        shoulders: { mean: 72, std_dev: 8 },
        back: { mean: 70, std_dev: 8 },
        hindquarters: { mean: 78, std_dev: 8 },
        legs: { mean: 72, std_dev: 8 },
        hooves: { mean: 70, std_dev: 8 },
        topline: { mean: 72, std_dev: 8 },
      },
      gaits: {
        walk: { mean: 72, std_dev: 9 },
        trot: { mean: 65, std_dev: 9 },
        canter: { mean: 70, std_dev: 9 },
        gallop: { mean: 65, std_dev: 9 },
        gaiting: { mean: 85, std_dev: 9 },
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Flat Walk', 'Running Walk'],
    },
    starter_stats: {
      agility: { mean: 15, std_dev: 3 },
      balance: { mean: 17, std_dev: 3 },
      boldness: { mean: 14, std_dev: 3 },
      endurance: { mean: 17, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 16, std_dev: 3 },
      intelligence: { mean: 15, std_dev: 3 },
      obedience: { mean: 18, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 14, std_dev: 3 },
      stamina: { mean: 17, std_dev: 3 },
      strength: { mean: 15, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 5,
      Nervous: 1,
      Calm: 41,
      Bold: 5,
      Steady: 30,
      Independent: 3,
      Reactive: 1,
      Stubborn: 3,
      Playful: 5,
      Lazy: 5,
      Aggressive: 1,
    },
  },

  // Andalusian (ID 8) — Classical Iberian breed
  // Source: BreedData/Andalusian.txt — real data with per-region std_dev values
  8: {
    rating_profiles: {
      conformation: {
        head: { mean: 85, std_dev: 6 },
        neck: { mean: 92, std_dev: 4 },
        shoulders: { mean: 82, std_dev: 7 },
        back: { mean: 88, std_dev: 5 },
        hindquarters: { mean: 85, std_dev: 6 },
        legs: { mean: 82, std_dev: 7 },
        hooves: { mean: 80, std_dev: 7 },
        topline: { mean: 86, std_dev: 6 },
      },
      gaits: {
        walk: { mean: 80, std_dev: 7 },
        trot: { mean: 85, std_dev: 6 },
        canter: { mean: 92, std_dev: 5 },
        gallop: { mean: 70, std_dev: 9 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 19, std_dev: 3 },
      balance: { mean: 19, std_dev: 3 },
      boldness: { mean: 17, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 19, std_dev: 3 },
      focus: { mean: 17, std_dev: 3 },
      intelligence: { mean: 19, std_dev: 3 },
      obedience: { mean: 17, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 14, std_dev: 3 },
      stamina: { mean: 15, std_dev: 3 },
      strength: { mean: 14, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 30,
      Nervous: 5,
      Calm: 15,
      Bold: 15,
      Steady: 20,
      Independent: 5,
      Reactive: 5,
      Stubborn: 2,
      Playful: 2,
      Lazy: 0,
      Aggressive: 1,
    },
  },

  // American Quarter Horse (ID 9) — Western ranch breed
  // Source: BreedData/American Quarter Horse.txt — real data with per-region std_dev values
  9: {
    rating_profiles: {
      conformation: {
        head: { mean: 82, std_dev: 6 },
        neck: { mean: 75, std_dev: 7 },
        shoulders: { mean: 85, std_dev: 6 },
        back: { mean: 82, std_dev: 6 },
        hindquarters: { mean: 92, std_dev: 4 },
        legs: { mean: 84, std_dev: 6 },
        hooves: { mean: 88, std_dev: 5 },
        topline: { mean: 78, std_dev: 7 },
      },
      gaits: {
        walk: { mean: 72, std_dev: 9 },
        trot: { mean: 65, std_dev: 10 },
        canter: { mean: 75, std_dev: 8 },
        gallop: { mean: 95, std_dev: 4 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 18, std_dev: 3 },
      balance: { mean: 16, std_dev: 3 },
      boldness: { mean: 17, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 16, std_dev: 3 },
      intelligence: { mean: 16, std_dev: 3 },
      obedience: { mean: 16, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 20, std_dev: 3 },
      stamina: { mean: 16, std_dev: 3 },
      strength: { mean: 18, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 10,
      Nervous: 2,
      Calm: 35,
      Bold: 10,
      Steady: 30,
      Independent: 5,
      Reactive: 2,
      Stubborn: 2,
      Playful: 2,
      Lazy: 1,
      Aggressive: 1,
    },
  },

  // Walkaloosa (ID 10) — Gaited spotted breed
  // Conformation/gait std_dev: uniform defaults (no BreedData file)
  // Starter stats: defaults emphasizing balanced traits
  10: {
    rating_profiles: {
      conformation: {
        head: { mean: 74, std_dev: 8 },
        neck: { mean: 72, std_dev: 8 },
        shoulders: { mean: 70, std_dev: 8 },
        back: { mean: 68, std_dev: 8 },
        hindquarters: { mean: 75, std_dev: 8 },
        legs: { mean: 70, std_dev: 8 },
        hooves: { mean: 70, std_dev: 8 },
        topline: { mean: 70, std_dev: 8 },
      },
      gaits: {
        walk: { mean: 70, std_dev: 9 },
        trot: { mean: 68, std_dev: 9 },
        canter: { mean: 70, std_dev: 9 },
        gallop: { mean: 72, std_dev: 9 },
        gaiting: { mean: 85, std_dev: 9 },
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Indian Shuffle'],
    },
    starter_stats: {
      agility: { mean: 16, std_dev: 3 },
      balance: { mean: 16, std_dev: 3 },
      boldness: { mean: 15, std_dev: 3 },
      endurance: { mean: 16, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 15, std_dev: 3 },
      intelligence: { mean: 15, std_dev: 3 },
      obedience: { mean: 17, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 15, std_dev: 3 },
      stamina: { mean: 16, std_dev: 3 },
      strength: { mean: 15, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 5,
      Nervous: 1,
      Calm: 36,
      Bold: 10,
      Steady: 30,
      Independent: 3,
      Reactive: 1,
      Stubborn: 3,
      Playful: 5,
      Lazy: 5,
      Aggressive: 1,
    },
  },

  // Lusitano (ID 11) — Iberian dressage breed
  // Source: BreedData/Lusitano.txt — real data with per-region std_dev values
  11: {
    rating_profiles: {
      conformation: {
        head: { mean: 84, std_dev: 6 },
        neck: { mean: 90, std_dev: 5 },
        shoulders: { mean: 82, std_dev: 7 },
        back: { mean: 84, std_dev: 6 },
        hindquarters: { mean: 88, std_dev: 6 },
        legs: { mean: 82, std_dev: 7 },
        hooves: { mean: 80, std_dev: 7 },
        topline: { mean: 83, std_dev: 6 },
      },
      gaits: {
        walk: { mean: 78, std_dev: 7 },
        trot: { mean: 85, std_dev: 6 },
        canter: { mean: 92, std_dev: 5 },
        gallop: { mean: 72, std_dev: 8 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 19, std_dev: 3 },
      balance: { mean: 19, std_dev: 3 },
      boldness: { mean: 17, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 19, std_dev: 3 },
      focus: { mean: 17, std_dev: 3 },
      intelligence: { mean: 19, std_dev: 3 },
      obedience: { mean: 17, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 14, std_dev: 3 },
      stamina: { mean: 15, std_dev: 3 },
      strength: { mean: 14, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 25,
      Nervous: 5,
      Calm: 10,
      Bold: 20,
      Steady: 15,
      Independent: 5,
      Reactive: 10,
      Stubborn: 5,
      Playful: 4,
      Lazy: 0,
      Aggressive: 1,
    },
  },

  // Paint Horse (ID 12) — Colorful western stock horse
  // Source: BreedData/American Paint Horse.txt — real data with per-region std_dev values
  12: {
    rating_profiles: {
      conformation: {
        head: { mean: 80, std_dev: 7 },
        neck: { mean: 78, std_dev: 7 },
        shoulders: { mean: 85, std_dev: 6 },
        back: { mean: 82, std_dev: 6 },
        hindquarters: { mean: 90, std_dev: 5 },
        legs: { mean: 82, std_dev: 6 },
        hooves: { mean: 80, std_dev: 7 },
        topline: { mean: 80, std_dev: 7 },
      },
      gaits: {
        walk: { mean: 75, std_dev: 8 },
        trot: { mean: 70, std_dev: 9 },
        canter: { mean: 75, std_dev: 8 },
        gallop: { mean: 82, std_dev: 7 },
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    starter_stats: {
      agility: { mean: 18, std_dev: 3 },
      balance: { mean: 16, std_dev: 3 },
      boldness: { mean: 17, std_dev: 3 },
      endurance: { mean: 15, std_dev: 3 },
      flexibility: { mean: 16, std_dev: 3 },
      focus: { mean: 16, std_dev: 3 },
      intelligence: { mean: 16, std_dev: 3 },
      obedience: { mean: 16, std_dev: 3 },
      precision: { mean: 15, std_dev: 3 },
      speed: { mean: 20, std_dev: 3 },
      stamina: { mean: 16, std_dev: 3 },
      strength: { mean: 18, std_dev: 3 },
    },
    temperament_weights: {
      Spirited: 15,
      Nervous: 5,
      Calm: 25,
      Bold: 15,
      Steady: 20,
      Independent: 5,
      Reactive: 5,
      Stubborn: 3,
      Playful: 5,
      Lazy: 1,
      Aggressive: 1,
    },
  },
};
