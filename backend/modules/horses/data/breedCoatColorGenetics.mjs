/**
 * breedCoatColorGenetics.mjs
 *
 * Breed-specific coat color genetics for all 12 canonical Equoria breeds.
 * Defines allele_weights, allowed_alleles, shade_bias, and marking_bias
 * that are merged into BREED_GENETIC_PROFILES by breedGeneticProfiles.mjs.
 *
 * These values drive:
 *   - genotypeGenerationService.mjs (allele_weights, allowed_alleles)
 *   - phenotypeCalculationService.mjs (shade_bias)
 *   - markingGenerationService.mjs (marking_bias, advanced_markings_bias)
 *
 * Sources: PRD coat color documentation, Equine Genetics literature.
 * Story: Equoria-4ovo — Populate breed-specific coat color genetics
 *
 * DATA VERSION: 1 (2026-05-14)
 */

/**
 * Coat color genetics keyed by breed ID (1–12).
 * Each entry has:
 *   allele_weights         — { locus: { "allele/pair": probability } } summing to 1.0
 *   allowed_alleles        — { locus: ["valid/pair", ...] } (first = most common fallback)
 *   shade_bias             — { "ColorName": { shade: weight } } controlling shade selection
 *   marking_bias           — face/leg marking probabilities for newly-generated horses
 *   advanced_markings_bias — multipliers for rare advanced markings
 */
export const BREED_COAT_COLOR_GENETICS = {
  // ──────────────────────────────────────────────────────────────────────────
  // 1: Thoroughbred — Bay/chestnut dominant, rarely gray, no pinto/appaloosa
  // ──────────────────────────────────────────────────────────────────────────
  1: {
    allele_weights: {
      E_Extension: { 'E/E': 0.35, 'E/e': 0.4, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.45, 'A/a': 0.4, 'a/a': 0.15 },
      Cr_Cream: { 'n/n': 0.99, 'Cr/n': 0.01 },
      D_Dun: { 'nd2/nd2': 0.98, 'D/nd2': 0.02 },
      G_Gray: { 'g/g': 0.97, 'G/g': 0.03 },
      Rn_Roan: { 'rn/rn': 0.99, 'Rn/rn': 0.01 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      Cr_Cream: ['n/n'],
      D_Dun: ['nd2/nd2'],
      G_Gray: ['g/g'],
      Rn_Roan: ['rn/rn'],
      LP_LeopardComplex: ['lp/lp'],
      TO_Tobiano: ['to/to'],
      O_FrameOvero: ['n/n'],
    },
    shade_bias: {
      Bay: { dark: 0.25, standard: 0.5, light: 0.25 },
      Chestnut: { dark: 0.2, standard: 0.5, light: 0.3 },
      Black: { standard: 0.7, light: 0.3 },
    },
    marking_bias: {
      face: { none: 0.35, star: 0.25, strip: 0.18, blaze: 0.15, snip: 0.07 },
      legs_general_probability: 0.3,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.01, frost: 0.01 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2: Arabian — Bay/chestnut/black + gray very common, no dilutes/pinto/appaloosa
  // ──────────────────────────────────────────────────────────────────────────
  2: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.45, 'a/a': 0.15 },
      Cr_Cream: { 'n/n': 1.0 },
      D_Dun: { 'nd2/nd2': 1.0 },
      G_Gray: { 'G/G': 0.1, 'G/g': 0.3, 'g/g': 0.6 },
      Rn_Roan: { 'rn/rn': 1.0 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      G_Gray: ['g/g', 'G/g', 'G/G'],
      Cr_Cream: ['n/n'],
      LP_LeopardComplex: ['lp/lp'],
      TO_Tobiano: ['to/to'],
    },
    shade_bias: {
      Bay: { dark: 0.2, standard: 0.55, light: 0.25 },
      Chestnut: { dark: 0.15, standard: 0.5, light: 0.35 },
      Black: { standard: 0.8, light: 0.2 },
    },
    marking_bias: {
      face: { none: 0.2, star: 0.2, strip: 0.25, blaze: 0.25, snip: 0.1 },
      legs_general_probability: 0.45,
      leg_specific_probabilities: { coronet: 0.3, pastern: 0.25, sock: 0.25, stocking: 0.2 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3: American Saddlebred — All colors, some gray and roan, showy markings
  // ──────────────────────────────────────────────────────────────────────────
  3: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.4, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.97, 'Cr/n': 0.03 },
      D_Dun: { 'nd2/nd2': 1.0 },
      G_Gray: { 'g/g': 0.85, 'G/g': 0.14, 'G/G': 0.01 },
      Rn_Roan: { 'rn/rn': 0.92, 'Rn/rn': 0.08 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 0.97, 'TO/to': 0.03 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      G_Gray: ['g/g', 'G/g'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
      LP_LeopardComplex: ['lp/lp'],
    },
    shade_bias: {
      Bay: { dark: 0.22, standard: 0.55, light: 0.23 },
      Chestnut: { dark: 0.2, standard: 0.5, light: 0.3 },
      Black: { standard: 0.75, light: 0.25 },
    },
    marking_bias: {
      face: { none: 0.22, star: 0.22, strip: 0.22, blaze: 0.25, snip: 0.09 },
      legs_general_probability: 0.4,
      leg_specific_probabilities: { coronet: 0.3, pastern: 0.25, sock: 0.25, stocking: 0.2 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4: National Show Horse — Arabian-Saddlebred cross; gray possible, no dilutes/pinto
  // ──────────────────────────────────────────────────────────────────────────
  4: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.45, 'a/a': 0.15 },
      Cr_Cream: { 'n/n': 0.99, 'Cr/n': 0.01 },
      D_Dun: { 'nd2/nd2': 1.0 },
      G_Gray: { 'G/G': 0.05, 'G/g': 0.2, 'g/g': 0.75 },
      Rn_Roan: { 'rn/rn': 0.97, 'Rn/rn': 0.03 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      G_Gray: ['g/g', 'G/g', 'G/G'],
      LP_LeopardComplex: ['lp/lp'],
      TO_Tobiano: ['to/to'],
    },
    shade_bias: {
      Bay: { dark: 0.2, standard: 0.55, light: 0.25 },
      Chestnut: { dark: 0.15, standard: 0.52, light: 0.33 },
      Black: { standard: 0.78, light: 0.22 },
    },
    marking_bias: {
      face: { none: 0.22, star: 0.22, strip: 0.23, blaze: 0.24, snip: 0.09 },
      legs_general_probability: 0.4,
      leg_specific_probabilities: { coronet: 0.3, pastern: 0.25, sock: 0.25, stocking: 0.2 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5: Pony Of The Americas — Appaloosa patterning required for registration
  // ──────────────────────────────────────────────────────────────────────────
  5: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.35, 'A/a': 0.45, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.97, 'Cr/n': 0.03 },
      D_Dun: { 'nd2/nd2': 0.98, 'D/nd2': 0.02 },
      G_Gray: { 'g/g': 0.92, 'G/g': 0.08 },
      Rn_Roan: { 'rn/rn': 0.9, 'Rn/rn': 0.1 },
      LP_LeopardComplex: { 'LP/lp': 0.5, 'LP/LP': 0.25, 'lp/lp': 0.25 },
      PATN1_Pattern1: { 'PATN1/patn1': 0.4, 'patn1/patn1': 0.45, 'PATN1/PATN1': 0.15 },
      TO_Tobiano: { 'to/to': 0.97, 'TO/to': 0.03 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      LP_LeopardComplex: ['LP/lp', 'LP/LP', 'lp/lp'],
      PATN1_Pattern1: ['PATN1/patn1', 'patn1/patn1', 'PATN1/PATN1'],
    },
    shade_bias: {
      Bay: { dark: 0.25, standard: 0.5, light: 0.25 },
      Chestnut: { dark: 0.2, standard: 0.5, light: 0.3 },
      Black: { standard: 0.7, light: 0.3 },
    },
    marking_bias: {
      face: { none: 0.3, star: 0.25, strip: 0.22, blaze: 0.18, snip: 0.05 },
      legs_general_probability: 0.3,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.02, snowflake: 0.03, frost: 0.03 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6: Appaloosa — LP gene required; blanket/leopard/few-spot patterns
  // ──────────────────────────────────────────────────────────────────────────
  6: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.35, 'A/a': 0.45, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.96, 'Cr/n': 0.04 },
      D_Dun: { 'nd2/nd2': 0.97, 'D/nd2': 0.03 },
      G_Gray: { 'g/g': 0.92, 'G/g': 0.08 },
      Rn_Roan: { 'rn/rn': 0.88, 'Rn/rn': 0.12 },
      LP_LeopardComplex: { 'LP/lp': 0.45, 'LP/LP': 0.2, 'lp/lp': 0.35 },
      PATN1_Pattern1: { 'PATN1/patn1': 0.45, 'patn1/patn1': 0.4, 'PATN1/PATN1': 0.15 },
      TO_Tobiano: { 'to/to': 0.98, 'TO/to': 0.02 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      LP_LeopardComplex: ['LP/lp', 'LP/LP', 'lp/lp'],
      PATN1_Pattern1: ['PATN1/patn1', 'patn1/patn1', 'PATN1/PATN1'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
    },
    shade_bias: {
      Bay: { dark: 0.25, standard: 0.52, light: 0.23 },
      Chestnut: { dark: 0.22, standard: 0.5, light: 0.28 },
      Black: { standard: 0.72, light: 0.28 },
    },
    marking_bias: {
      face: { none: 0.3, star: 0.25, strip: 0.22, blaze: 0.18, snip: 0.05 },
      legs_general_probability: 0.3,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.02, snowflake: 0.05, frost: 0.04 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7: Tennessee Walking Horse — All colors incl. roan and pinto; some cream dilutes
  // ──────────────────────────────────────────────────────────────────────────
  7: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.35, 'A/a': 0.45, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.92, 'Cr/n': 0.08 },
      D_Dun: { 'nd2/nd2': 0.97, 'D/nd2': 0.03 },
      G_Gray: { 'g/g': 0.92, 'G/g': 0.08 },
      Rn_Roan: { 'rn/rn': 0.88, 'Rn/rn': 0.12 },
      LP_LeopardComplex: { 'lp/lp': 0.98, 'LP/lp': 0.02 },
      TO_Tobiano: { 'to/to': 0.83, 'TO/to': 0.15, 'TO/TO': 0.02 },
      O_FrameOvero: { 'n/n': 0.93, 'O/n': 0.07 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
      TO_Tobiano: ['to/to', 'TO/to', 'TO/TO'],
      LP_LeopardComplex: ['lp/lp'],
    },
    shade_bias: {
      Bay: { dark: 0.25, standard: 0.5, light: 0.25 },
      Chestnut: { dark: 0.2, standard: 0.5, light: 0.3 },
      Black: { standard: 0.7, light: 0.3 },
      Palomino: { dark: 0.15, standard: 0.55, light: 0.3 },
      Buckskin: { dark: 0.2, standard: 0.55, light: 0.25 },
    },
    marking_bias: {
      face: { none: 0.3, star: 0.25, strip: 0.2, blaze: 0.2, snip: 0.05 },
      legs_general_probability: 0.3,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8: Andalusian — Gray very dominant; bay/black; no dilutes/pinto/appaloosa
  //               — Minimal white markings (Iberian tradition)
  // ──────────────────────────────────────────────────────────────────────────
  8: {
    allele_weights: {
      E_Extension: { 'E/E': 0.35, 'E/e': 0.4, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.4, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 1.0 },
      D_Dun: { 'nd2/nd2': 1.0 },
      G_Gray: { 'G/G': 0.08, 'G/g': 0.32, 'g/g': 0.6 },
      Rn_Roan: { 'rn/rn': 1.0 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      G_Gray: ['g/g', 'G/g', 'G/G'],
      Cr_Cream: ['n/n'],
      LP_LeopardComplex: ['lp/lp'],
      TO_Tobiano: ['to/to'],
    },
    shade_bias: {
      Bay: { dark: 0.3, standard: 0.5, light: 0.2 },
      Chestnut: { dark: 0.25, standard: 0.5, light: 0.25 },
      Black: { standard: 0.8, light: 0.2 },
    },
    marking_bias: {
      face: { none: 0.5, star: 0.25, strip: 0.15, blaze: 0.08, snip: 0.02 },
      legs_general_probability: 0.2,
      leg_specific_probabilities: { coronet: 0.5, pastern: 0.3, sock: 0.15, stocking: 0.05 },
      max_legs_marked: 2,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.01, frost: 0.01 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9: American Quarter Horse — All colors; cream dilute and dun fairly common
  // ──────────────────────────────────────────────────────────────────────────
  9: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.4, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.87, 'Cr/n': 0.12, 'Cr/Cr': 0.01 },
      D_Dun: { 'nd2/nd2': 0.93, 'D/nd2': 0.07 },
      G_Gray: { 'g/g': 0.95, 'G/g': 0.05 },
      Rn_Roan: { 'rn/rn': 0.93, 'Rn/rn': 0.07 },
      LP_LeopardComplex: { 'lp/lp': 0.99, 'LP/lp': 0.01 },
      TO_Tobiano: { 'to/to': 0.97, 'TO/to': 0.03 },
      O_FrameOvero: { 'n/n': 0.97, 'O/n': 0.03 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      Cr_Cream: ['n/n', 'Cr/n'],
      D_Dun: ['nd2/nd2', 'D/nd2'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
      LP_LeopardComplex: ['lp/lp'],
    },
    shade_bias: {
      Bay: { dark: 0.22, standard: 0.53, light: 0.25 },
      // Equoria-er4n: 'liver' is a shade-bias entry on Chestnut (darkest chestnut form);
      // colorName remains 'Chestnut' to keep the locus deterministic. See docs in
      // phenotypeCalculationService.mjs for the canonical naming style guide.
      Chestnut: { liver: 0.1, dark: 0.18, standard: 0.42, light: 0.3 },
      Black: { standard: 0.7, light: 0.3 },
      Palomino: { dark: 0.15, standard: 0.55, light: 0.3 },
      Buckskin: { dark: 0.2, standard: 0.55, light: 0.25 },
      // Equoria-ek5c: shade_bias coverage for producible dilute/pattern colors
      'Smoky Black': { standard: 0.7, light: 0.3 },
      Cremello: { standard: 0.6, light: 0.4 },
      Perlino: { standard: 0.6, light: 0.4 },
      'Smoky Cream': { standard: 0.7, light: 0.3 },
      'Red Dun': { dark: 0.2, standard: 0.55, light: 0.25 },
      'Bay Dun': { dark: 0.25, standard: 0.55, light: 0.2 },
      Grulla: { standard: 0.7, dark: 0.2, light: 0.1 },
      Dunalino: { standard: 0.55, light: 0.3, dark: 0.15 },
      Dunskin: { standard: 0.55, light: 0.3, dark: 0.15 },
      'Smoky Grulla': { standard: 0.7, dark: 0.3 },
      'Red Roan': { dark: 0.2, standard: 0.55, light: 0.25 },
      'Bay Roan': { dark: 0.25, standard: 0.55, light: 0.2 },
      'Blue Roan': { standard: 0.7, light: 0.3 },
      Gray: { standard: 0.6, dark: 0.2, light: 0.2 },
      'Steel Gray': { standard: 0.6, dark: 0.2, light: 0.2 },
      'Rose Gray': { standard: 0.6, dark: 0.2, light: 0.2 },
    },
    marking_bias: {
      face: { none: 0.35, star: 0.25, strip: 0.2, blaze: 0.15, snip: 0.05 },
      legs_general_probability: 0.3,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10: Walkaloosa — TWH x Appaloosa cross; appaloosa patterns + roan/pinto
  // ──────────────────────────────────────────────────────────────────────────
  10: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.35, 'A/a': 0.45, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.93, 'Cr/n': 0.07 },
      D_Dun: { 'nd2/nd2': 0.97, 'D/nd2': 0.03 },
      G_Gray: { 'g/g': 0.93, 'G/g': 0.07 },
      Rn_Roan: { 'rn/rn': 0.85, 'Rn/rn': 0.15 },
      LP_LeopardComplex: { 'LP/lp': 0.4, 'lp/lp': 0.45, 'LP/LP': 0.15 },
      PATN1_Pattern1: { 'PATN1/patn1': 0.4, 'patn1/patn1': 0.48, 'PATN1/PATN1': 0.12 },
      TO_Tobiano: { 'to/to': 0.8, 'TO/to': 0.18, 'TO/TO': 0.02 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      LP_LeopardComplex: ['LP/lp', 'lp/lp', 'LP/LP'],
      PATN1_Pattern1: ['PATN1/patn1', 'patn1/patn1', 'PATN1/PATN1'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
      TO_Tobiano: ['to/to', 'TO/to'],
    },
    shade_bias: {
      Bay: { dark: 0.25, standard: 0.5, light: 0.25 },
      Chestnut: { dark: 0.2, standard: 0.5, light: 0.3 },
      Black: { standard: 0.7, light: 0.3 },
    },
    marking_bias: {
      face: { none: 0.3, star: 0.25, strip: 0.22, blaze: 0.18, snip: 0.05 },
      legs_general_probability: 0.32,
      leg_specific_probabilities: { coronet: 0.35, pastern: 0.3, sock: 0.25, stocking: 0.1 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.02, snowflake: 0.04, frost: 0.04 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 11: Lusitano — Iberian breed; gray common, bay/black; minimal markings
  // ──────────────────────────────────────────────────────────────────────────
  11: {
    allele_weights: {
      E_Extension: { 'E/E': 0.35, 'E/e': 0.4, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.4, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 1.0 },
      D_Dun: { 'nd2/nd2': 1.0 },
      G_Gray: { 'G/G': 0.06, 'G/g': 0.29, 'g/g': 0.65 },
      Rn_Roan: { 'rn/rn': 1.0 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 1.0 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      G_Gray: ['g/g', 'G/g', 'G/G'],
      Cr_Cream: ['n/n'],
      LP_LeopardComplex: ['lp/lp'],
      TO_Tobiano: ['to/to'],
    },
    shade_bias: {
      Bay: { dark: 0.3, standard: 0.5, light: 0.2 },
      Chestnut: { dark: 0.25, standard: 0.5, light: 0.25 },
      Black: { standard: 0.8, light: 0.2 },
    },
    marking_bias: {
      face: { none: 0.52, star: 0.22, strip: 0.15, blaze: 0.09, snip: 0.02 },
      legs_general_probability: 0.18,
      leg_specific_probabilities: { coronet: 0.5, pastern: 0.3, sock: 0.15, stocking: 0.05 },
      max_legs_marked: 2,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.01, frost: 0.01 },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 12: Paint Horse — Tobiano and/or overo required; all base colors with pinto
  // ──────────────────────────────────────────────────────────────────────────
  12: {
    allele_weights: {
      E_Extension: { 'E/E': 0.3, 'E/e': 0.45, 'e/e': 0.25 },
      A_Agouti: { 'A/A': 0.4, 'A/a': 0.4, 'a/a': 0.2 },
      Cr_Cream: { 'n/n': 0.9, 'Cr/n': 0.1 },
      D_Dun: { 'nd2/nd2': 0.98, 'D/nd2': 0.02 },
      G_Gray: { 'g/g': 0.95, 'G/g': 0.05 },
      Rn_Roan: { 'rn/rn': 0.95, 'Rn/rn': 0.05 },
      LP_LeopardComplex: { 'lp/lp': 1.0 },
      TO_Tobiano: { 'TO/to': 0.55, 'to/to': 0.3, 'TO/TO': 0.15 },
      O_FrameOvero: { 'n/n': 0.8, 'O/n': 0.2 },
      SB1_Sabino1: { 'n/n': 0.8, 'SB1/n': 0.18, 'SB1/SB1': 0.02 },
      SW_SplashWhite: { 'n/n': 0.88, 'SW/n': 0.12 },
    },
    allowed_alleles: {
      E_Extension: ['E/e', 'E/E', 'e/e'],
      A_Agouti: ['A/a', 'A/A', 'a/a'],
      TO_Tobiano: ['TO/to', 'TO/TO', 'to/to'],
      O_FrameOvero: ['n/n', 'O/n'],
      SB1_Sabino1: ['n/n', 'SB1/n'],
      SW_SplashWhite: ['n/n', 'SW/n'],
      LP_LeopardComplex: ['lp/lp'],
    },
    shade_bias: {
      Bay: { dark: 0.22, standard: 0.53, light: 0.25 },
      Chestnut: { dark: 0.18, standard: 0.48, light: 0.34 },
      Black: { standard: 0.72, light: 0.28 },
    },
    marking_bias: {
      face: { none: 0.15, star: 0.2, strip: 0.22, blaze: 0.3, snip: 0.13 },
      legs_general_probability: 0.5,
      leg_specific_probabilities: { coronet: 0.25, pastern: 0.25, sock: 0.25, stocking: 0.25 },
      max_legs_marked: 4,
    },
    advanced_markings_bias: { bloody_shoulder: 0.01, snowflake: 0.02, frost: 0.02 },
  },
};
