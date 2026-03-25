// Canonical breed genetic profile data for all 12 Equoria breeds.
// Contains rating_profiles (conformation, gaits, gaited config) and temperament_weights.
// Source: PRD-02 §3.1/§3.2, PRD-03 §7.3, samples/populate_breed_ratings.sql, samples/populate_breed_temperaments.sql

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
    name: 'Pony of the Americas',
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
    name: 'Pura Raza Espanola',
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

// Helper to build a conformation region object
const conf = mean => ({ mean, std_dev: 8 });

// Helper to build a gait score object
const gait = mean => ({ mean, std_dev: 9 });

/**
 * Complete breed genetic profiles keyed by breed ID.
 * Each entry contains:
 *   - rating_profiles.conformation: 8 body regions with { mean, std_dev }
 *   - rating_profiles.gaits: 5 gait scores (gaiting null for non-gaited)
 *   - rating_profiles.is_gaited_breed: boolean
 *   - rating_profiles.gaited_gait_registry: string[] | null
 *   - temperament_weights: 11 types summing to 100
 */
export const BREED_GENETIC_PROFILES = {
  // Thoroughbred (ID 1) — High-energy racing breed
  1: {
    rating_profiles: {
      conformation: {
        head: conf(78),
        neck: conf(75),
        shoulders: conf(72),
        back: conf(70),
        hindquarters: conf(76),
        legs: conf(74),
        hooves: conf(70),
        topline: conf(73),
      },
      gaits: {
        walk: gait(65),
        trot: gait(75),
        canter: gait(80),
        gallop: gait(90),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
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
  2: {
    rating_profiles: {
      conformation: {
        head: conf(85),
        neck: conf(82),
        shoulders: conf(70),
        back: conf(68),
        hindquarters: conf(72),
        legs: conf(70),
        hooves: conf(75),
        topline: conf(72),
      },
      gaits: {
        walk: gait(70),
        trot: gait(78),
        canter: gait(75),
        gallop: gait(80),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 20,
      Nervous: 10,
      Calm: 5,
      Bold: 25,
      Steady: 5,
      Independent: 10,
      Reactive: 5,
      Stubborn: 10,
      Playful: 8,
      Lazy: 1,
      Aggressive: 1,
    },
  },

  // American Saddlebred (ID 3) — Gaited show horse
  3: {
    rating_profiles: {
      conformation: {
        head: conf(80),
        neck: conf(78),
        shoulders: conf(72),
        back: conf(70),
        hindquarters: conf(74),
        legs: conf(72),
        hooves: conf(70),
        topline: conf(74),
      },
      gaits: {
        walk: gait(70),
        trot: gait(75),
        canter: gait(70),
        gallop: gait(65),
        gaiting: gait(85),
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Slow Gait', 'Rack'],
    },
    temperament_weights: {
      Spirited: 30,
      Nervous: 2,
      Calm: 10,
      Bold: 20,
      Steady: 10,
      Independent: 5,
      Reactive: 3,
      Stubborn: 3,
      Playful: 15,
      Lazy: 1,
      Aggressive: 1,
    },
  },

  // National Show Horse (ID 4) — Gaited Arabian-Saddlebred cross
  // NOTE: PRD-03 §7.3 NSH weights sum to 95. Playful increased 12→15, Calm 8→10 to normalize to 100.
  4: {
    rating_profiles: {
      conformation: {
        head: conf(82),
        neck: conf(80),
        shoulders: conf(71),
        back: conf(69),
        hindquarters: conf(73),
        legs: conf(71),
        hooves: conf(72),
        topline: conf(74),
      },
      gaits: {
        walk: gait(70),
        trot: gait(76),
        canter: gait(72),
        gallop: gait(70),
        gaiting: gait(82),
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Slow Gait', 'Rack'],
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

  // Pony of the Americas (ID 5) — Gentle youth breed
  5: {
    rating_profiles: {
      conformation: {
        head: conf(75),
        neck: conf(70),
        shoulders: conf(68),
        back: conf(65),
        hindquarters: conf(70),
        legs: conf(68),
        hooves: conf(68),
        topline: conf(67),
      },
      gaits: {
        walk: gait(65),
        trot: gait(70),
        canter: gait(68),
        gallop: gait(72),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
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
  6: {
    rating_profiles: {
      conformation: {
        head: conf(72),
        neck: conf(70),
        shoulders: conf(70),
        back: conf(68),
        hindquarters: conf(75),
        legs: conf(70),
        hooves: conf(70),
        topline: conf(70),
      },
      gaits: {
        walk: gait(65),
        trot: gait(70),
        canter: gait(72),
        gallop: gait(75),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 10,
      Nervous: 2,
      Calm: 25,
      Bold: 15,
      Steady: 25,
      Independent: 5,
      Reactive: 2,
      Stubborn: 5,
      Playful: 5,
      Lazy: 5,
      Aggressive: 1,
    },
  },

  // Tennessee Walking Horse (ID 7) — Gaited trail breed
  // NOTE: PRD-03 §7.3 TWH weights sum to 99. Calm increased 40→41 to normalize to 100.
  7: {
    rating_profiles: {
      conformation: {
        head: conf(75),
        neck: conf(74),
        shoulders: conf(72),
        back: conf(70),
        hindquarters: conf(78),
        legs: conf(72),
        hooves: conf(70),
        topline: conf(72),
      },
      gaits: {
        walk: gait(72),
        trot: gait(65),
        canter: gait(70),
        gallop: gait(65),
        gaiting: gait(85),
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Flat Walk', 'Running Walk'],
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

  // Pura Raza Espanola (ID 8) — Classical Iberian breed
  // NOTE: PRD-03 §7.3 PRE weights sum to 95. Playful increased 8→10, Calm 10→13 to normalize to 100.
  8: {
    rating_profiles: {
      conformation: {
        head: conf(80),
        neck: conf(78),
        shoulders: conf(72),
        back: conf(70),
        hindquarters: conf(76),
        legs: conf(72),
        hooves: conf(70),
        topline: conf(75),
      },
      gaits: {
        walk: gait(70),
        trot: gait(78),
        canter: gait(76),
        gallop: gait(70),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 20,
      Nervous: 5,
      Calm: 13,
      Bold: 25,
      Steady: 10,
      Independent: 5,
      Reactive: 5,
      Stubborn: 5,
      Playful: 10,
      Lazy: 1,
      Aggressive: 1,
    },
  },

  // American Quarter Horse (ID 9) — Western ranch breed
  9: {
    rating_profiles: {
      conformation: {
        head: conf(75),
        neck: conf(72),
        shoulders: conf(74),
        back: conf(70),
        hindquarters: conf(78),
        legs: conf(74),
        hooves: conf(72),
        topline: conf(72),
      },
      gaits: {
        walk: gait(65),
        trot: gait(70),
        canter: gait(74),
        gallop: gait(80),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 10,
      Nervous: 2,
      Calm: 30,
      Bold: 10,
      Steady: 25,
      Independent: 5,
      Reactive: 2,
      Stubborn: 5,
      Playful: 5,
      Lazy: 5,
      Aggressive: 1,
    },
  },

  // Walkaloosa (ID 10) — Gaited spotted breed
  // NOTE: PRD-03 §7.3 Walkaloosa weights sum to 99. Calm increased 35→36 to normalize to 100.
  10: {
    rating_profiles: {
      conformation: {
        head: conf(74),
        neck: conf(72),
        shoulders: conf(70),
        back: conf(68),
        hindquarters: conf(75),
        legs: conf(70),
        hooves: conf(70),
        topline: conf(70),
      },
      gaits: {
        walk: gait(70),
        trot: gait(68),
        canter: gait(70),
        gallop: gait(72),
        gaiting: gait(85),
      },
      is_gaited_breed: true,
      gaited_gait_registry: ['Indian Shuffle'],
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

  // Lusitano (ID 11) — Iberian dressage breed (conformation/gait ratings TBD placeholders)
  // NOTE: PRD-03 §7.3 Lusitano weights sum to 110 (source data error). Calm reduced 20→10 to normalize to 100.
  11: {
    rating_profiles: {
      conformation: {
        head: conf(78),
        neck: conf(76),
        shoulders: conf(72),
        back: conf(70),
        hindquarters: conf(74),
        legs: conf(72),
        hooves: conf(70),
        topline: conf(74),
      },
      gaits: {
        walk: gait(70),
        trot: gait(76),
        canter: gait(74),
        gallop: gait(72),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 20,
      Nervous: 5,
      Calm: 10,
      Bold: 25,
      Steady: 15,
      Independent: 5,
      Reactive: 3,
      Stubborn: 3,
      Playful: 10,
      Lazy: 2,
      Aggressive: 2,
    },
  },

  // Paint Horse (ID 12) — Colorful western stock horse
  12: {
    rating_profiles: {
      conformation: {
        head: conf(75),
        neck: conf(76),
        shoulders: conf(75),
        back: conf(74),
        hindquarters: conf(78),
        legs: conf(73),
        hooves: conf(73),
        topline: conf(74),
      },
      gaits: {
        walk: gait(72),
        trot: gait(73),
        canter: gait(74),
        gallop: gait(73),
        gaiting: null,
      },
      is_gaited_breed: false,
      gaited_gait_registry: null,
    },
    temperament_weights: {
      Spirited: 15,
      Nervous: 2,
      Calm: 25,
      Bold: 20,
      Steady: 20,
      Independent: 5,
      Reactive: 1,
      Stubborn: 1,
      Playful: 10,
      Lazy: 1,
      Aggressive: 0,
    },
  },
};
