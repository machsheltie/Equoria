/**
 * phenotypeCalculationService.mjs
 *
 * Pure-function service for calculating horse coat color phenotype from genotype.
 * Deterministic: same genotype always produces same phenotype output.
 *
 * Used by: horseRoutes.mjs (POST /horses)
 * Story: 31E-1b — Phenotype Calculation Engine
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * djb2 hash for deterministic shade selection derived from genotype.
 * Returns a non-negative 32-bit integer.
 *
 * @param {string} str
 * @returns {number}
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & 0xffffffff; // keep 32-bit
  }
  return Math.abs(hash);
}

/**
 * Expand a shade_bias weight map into a flat array of shade strings for index-based selection.
 * Weights are scaled to 10 slots (0.1 precision).
 * E.g. { dark: 0.3, light: 0.3, standard: 0.4 } → 3×'dark', 3×'light', 4×'standard'
 *
 * @param {Object} shadeObj - { shadeName: probability }
 * @returns {string[]}
 */
function expandShadesToArray(shadeObj) {
  const arr = [];
  for (const [shade, weight] of Object.entries(shadeObj)) {
    const slots = Math.max(1, Math.round(weight * 10));
    for (let i = 0; i < slots; i++) {
      arr.push(shade);
    }
  }
  return arr;
}

/**
 * Returns true if the allele string indicates dun is active.
 * Active dun: at least one 'D' allele (D/nd2, D/nd1, D/D).
 * nd1/nd2 is also dun-dilute (pseudo-dun).
 * nd2/nd2 and nd1/nd1 = non-dun.
 *
 * @param {string} dunAllele
 * @returns {boolean}
 */
function isDunActive(dunAllele) {
  if (!dunAllele) {
    return false;
  }
  const parts = dunAllele.split('/');
  // D allele present → dun active
  if (parts.includes('D')) {
    return true;
  }
  // nd1/nd2 compound → weakly dun (treat as dun for color purposes)
  if (parts.includes('nd1') && parts.includes('nd2')) {
    return true;
  }
  return false;
}

/**
 * Returns true if Cream is single-dilute (Cr/n).
 * @param {string} crAllele
 * @returns {boolean}
 */
function isCreamSingle(crAllele) {
  return crAllele === 'Cr/n' || crAllele === 'n/Cr';
}

/**
 * Returns true if Cream is double-dilute (Cr/Cr).
 * @param {string} crAllele
 * @returns {boolean}
 */
function isCreamDouble(crAllele) {
  return crAllele === 'Cr/Cr';
}

/**
 * Returns true if Silver (Z_Silver) is active.
 * @param {string} zAllele
 * @returns {boolean}
 */
function isSilverActive(zAllele) {
  return zAllele === 'Z/n' || zAllele === 'Z/Z';
}

/**
 * Returns true if Champagne (Ch_Champagne) is active.
 * @param {string} chAllele
 * @returns {boolean}
 */
function isChampagneActive(chAllele) {
  return chAllele === 'Ch/n' || chAllele === 'Ch/Ch';
}

/**
 * Returns true if Pearl is homozygous (prl/prl).
 * @param {string} prlAllele
 * @returns {boolean}
 */
function isPearlHomozygous(prlAllele) {
  return prlAllele === 'prl/prl';
}

/**
 * Returns true if Pearl + Cream pseudo-double-dilute is active.
 * This is the case when Prl_Pearl = prl/n AND Cr_Cream = Cr/n.
 * @param {string} prlAllele
 * @param {string} crAllele
 * @returns {boolean}
 */
function isPseudoDoubleDilute(prlAllele, crAllele) {
  return (prlAllele === 'prl/n' || prlAllele === 'n/prl') && isCreamSingle(crAllele);
}

/**
 * Returns true if Mushroom (MFSD12_Mushroom) is active.
 * @param {string} mushAllele
 * @returns {boolean}
 */
function isMushroomActive(mushAllele) {
  return mushAllele === 'M/N' || mushAllele === 'M/M';
}

/**
 * Returns true if EDXW (Extended Dominant White extension modifier) is active.
 * Equoria-1set: EDXW acts as a functional Extension allele — when any non-'n/n'
 * variant is present, the phenotype gains black-pigment capability regardless
 * of underlying e/e Extension. EDXW = 'n/n' is no-op (most common state).
 *
 * @param {string} edxwAllele
 * @returns {boolean}
 */
function isEdxwActive(edxwAllele) {
  return typeof edxwAllele === 'string' && edxwAllele !== 'n/n' && edxwAllele.length > 0;
}

/**
 * Classify the Agouti allele pair into a category.
 * Equoria-4lgb: Agouti dominance hierarchy is A > At > a.
 *
 * @param {string} agAllele
 * @returns {'A'|'At'|'a'}
 */
function classifyAgouti(agAllele) {
  if (typeof agAllele !== 'string' || agAllele.length === 0) {
    return 'A';
  }
  const parts = agAllele.split('/');
  if (parts.includes('A')) {
    return 'A';
  }
  if (parts.includes('At')) {
    return 'At';
  }
  return 'a';
}

// ---------------------------------------------------------------------------
// Base color determination
// ---------------------------------------------------------------------------

/**
 * Determine base color from Extension + Agouti.
 *
 * Equoria-1set: EDXW != 'n/n' forces functional Extension (black-pigment
 * expression) even if E_Extension = e/e. EDXW n/n is no-op.
 * Equoria-4lgb: Adds 'seal_brown' base for the At Agouti allele.
 *
 * @param {Object} genotype
 * @returns {'chestnut'|'bay'|'seal_brown'|'black'}
 */
function getBaseColor(genotype) {
  const ext = genotype.E_Extension ?? 'E/e';
  const ag = genotype.A_Agouti ?? 'A/a';
  const edxw = genotype.EDXW ?? 'n/n';

  const hasFunctionalE = ext !== 'e/e' || isEdxwActive(edxw);

  // e/e and no EDXW override → chestnut (recessive red — no black pigment)
  if (!hasFunctionalE) {
    return 'chestnut';
  }

  // Agouti hierarchy: A > At > a
  const agCategory = classifyAgouti(ag);
  if (agCategory === 'A') {
    return 'bay';
  }
  if (agCategory === 'At') {
    return 'seal_brown';
  }
  return 'black';
}

// ---------------------------------------------------------------------------
// Dilution engine
// ---------------------------------------------------------------------------

/**
 * Apply all dilution loci to the base color.
 * Returns the resolved color name string.
 *
 * Canonical modifier order (Equoria-er4n naming style guide):
 *   Silver -> Cream -> Dun -> Champagne base
 * Champagne always wins naming because it renames the whole base color.
 *
 * Equoria-4lgb: Seal brown produces bay-equivalent compounds for most dilutes
 * (Smoky Seal Brown, Seal Brown Dun, etc.); Champagne+Seal Brown = 'Sable Champagne'.
 *
 * @param {'chestnut'|'bay'|'seal_brown'|'black'} baseColor
 * @param {Object} genotype
 * @returns {string} color name
 */
function applyDilutions(baseColor, genotype) {
  const cr = genotype.Cr_Cream ?? 'n/n';
  const dun = genotype.D_Dun ?? 'nd2/nd2';
  const z = genotype.Z_Silver ?? 'n/n';
  const ch = genotype.Ch_Champagne ?? 'n/n';
  const prl = genotype.Prl_Pearl ?? 'n/n';
  const mush = genotype.MFSD12_Mushroom ?? 'N/N';

  const hasCreamSingle = isCreamSingle(cr);
  const hasCreamDouble = isCreamDouble(cr);
  const hasDun = isDunActive(dun);
  const hasSilver = isSilverActive(z);
  const hasChampagne = isChampagneActive(ch);
  const hasPearlHomo = isPearlHomozygous(prl);
  const hasPseudoDilute = isPseudoDoubleDilute(prl, cr);
  const hasMushroom = isMushroomActive(mush);

  // Treat pseudo-double-dilute (pearl + cream) like double cream for color name
  const effectiveCreamDouble = hasCreamDouble || hasPseudoDilute;

  // --- Champagne path (takes priority over cream for naming) ---
  if (hasChampagne) {
    return resolveChampagneColor(
      baseColor,
      hasCreamSingle,
      effectiveCreamDouble,
      hasDun,
      hasSilver,
    );
  }

  // --- Pearl homozygous (no champagne, no cream) ---
  // Equoria-rh15: 'Apricot' = chestnut + prl/prl. 'Pearl Black' = black + prl/prl
  // (canonical inverted form per dev notes — replaces previous 'Black Pearl').
  if (hasPearlHomo && !hasCreamSingle && !effectiveCreamDouble) {
    switch (baseColor) {
      case 'chestnut':
        return 'Apricot';
      case 'bay':
        return 'Bay Pearl';
      case 'seal_brown':
        return 'Seal Brown Pearl';
      case 'black':
        return 'Pearl Black';
    }
  }

  // --- Double cream (or pseudo-double-dilute) ---
  if (effectiveCreamDouble) {
    // Pearl pseudo-dilute names. Equoria-rh15: chestnut variant = 'Pale Gold'.
    if (hasPseudoDilute && !hasCreamDouble) {
      switch (baseColor) {
        case 'chestnut':
          return 'Pale Gold';
        case 'bay':
          return 'Buckskin Pearl';
        case 'seal_brown':
          return 'Seal Brown Pearl Cream';
        case 'black':
          return 'Smoky Black Pearl';
      }
    }
    switch (baseColor) {
      case 'chestnut':
        return 'Cremello';
      case 'bay':
        return 'Perlino';
      case 'seal_brown':
        return 'Sable Cream';
      case 'black':
        return 'Smoky Cream';
    }
  }

  // --- Single cream ---
  if (hasCreamSingle) {
    if (hasDun) {
      // Cream + dun stack. Equoria-egh7: explicit compound names.
      switch (baseColor) {
        case 'chestnut':
          return 'Dunalino';
        case 'bay':
          return 'Dunskin';
        case 'seal_brown':
          return 'Seal Brown Dunskin';
        case 'black':
          return hasSilver ? 'Silver Dapple Grulla' : 'Smoky Grulla';
      }
    }
    if (hasSilver && baseColor === 'black') {
      return 'Silver Dapple'; // Equoria-egh7: alt canonical name for silver+smoky black
    }
    switch (baseColor) {
      case 'chestnut':
        return 'Palomino';
      case 'bay':
        return 'Buckskin';
      case 'seal_brown':
        return 'Smoky Seal Brown';
      case 'black':
        return 'Smoky Black';
    }
  }

  // --- Silver (no cream, no champagne) ---
  if (hasSilver) {
    if (hasDun) {
      switch (baseColor) {
        case 'black':
          return 'Silver Grulla';
        case 'bay':
          return 'Silver Bay Dun';
        case 'seal_brown':
          return 'Silver Seal Brown Dun';
        case 'chestnut':
          break; // silver has no effect on chestnut — fall through to dun
      }
    }
    switch (baseColor) {
      case 'black':
        return 'Silver Dapple'; // Equoria-egh7: canonical name (replaces 'Silver Black')
      case 'bay':
        return 'Silver Bay';
      case 'seal_brown':
        return 'Silver Seal Brown';
      case 'chestnut':
        break; // no visible silver effect on chestnut — fall through
    }
  }

  // --- Dun (no cream, no silver, no champagne) ---
  if (hasDun) {
    switch (baseColor) {
      case 'chestnut':
        return 'Red Dun';
      case 'bay':
        return 'Bay Dun';
      case 'seal_brown':
        return 'Seal Brown Dun';
      case 'black':
        return 'Grulla';
    }
  }

  // --- Mushroom (chestnut only, no other dilutes) ---
  if (hasMushroom && baseColor === 'chestnut') {
    return 'Mushroom Chestnut';
  }

  // --- No dilutions ---
  switch (baseColor) {
    case 'chestnut':
      return 'Chestnut';
    case 'bay':
      return 'Bay';
    case 'seal_brown':
      return 'Seal Brown';
    case 'black':
      return 'Black';
  }

  return 'Unknown';
}

/**
 * Resolve champagne-modified color names.
 * Champagne takes naming priority over cream and dun.
 *
 * Equoria-rh15: Double-cream + Champagne (any base) collapses to 'Ivory Champagne'.
 * Equoria-4lgb: Seal Brown + Champagne = 'Sable Champagne' (base noun = 'Sable').
 *
 * @param {'chestnut'|'bay'|'seal_brown'|'black'} baseColor
 * @param {boolean} hasCreamSingle
 * @param {boolean} hasCreamDouble - true for actual Cr/Cr OR pearl pseudo-double-dilute
 * @param {boolean} hasDun
 * @param {boolean} hasSilver
 * @returns {string}
 */
function resolveChampagneColor(baseColor, hasCreamSingle, hasCreamDouble, hasDun, hasSilver) {
  // Equoria-rh15: Double-cream + Champagne → Ivory Champagne (canonical 'palest possible')
  if (hasCreamDouble) {
    if (hasSilver && baseColor !== 'chestnut' && hasDun) {
      return 'Silver Ivory Dun Champagne';
    }
    if (hasSilver && baseColor !== 'chestnut') {
      return 'Silver Ivory Champagne';
    }
    if (hasDun) {
      return 'Ivory Dun Champagne';
    }
    return 'Ivory Champagne';
  }

  const base =
    {
      chestnut: 'Gold',
      bay: 'Amber',
      seal_brown: 'Sable',
      black: 'Classic',
    }[baseColor] ?? 'Gold';

  // Most specific: Silver + Dun + Champagne (must check before separate Silver or Dun branches)
  if (hasSilver && baseColor !== 'chestnut' && hasDun) {
    return hasCreamSingle ? `Silver ${base} Cream Dun Champagne` : `Silver ${base} Dun Champagne`;
  }

  // Silver + Champagne (no dun)
  if (hasSilver && baseColor !== 'chestnut') {
    return hasCreamSingle ? `Silver ${base} Cream Champagne` : `Silver ${base} Champagne`;
  }

  // Dun + Champagne (no silver)
  if (hasDun) {
    return hasCreamSingle ? `${base} Cream Dun Champagne` : `${base} Dun Champagne`;
  }

  // Base Champagne (no silver, no dun)
  const parts = [base];
  if (hasCreamSingle) {
    parts.push('Cream');
  }
  parts.push('Champagne');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Pattern overlays
// ---------------------------------------------------------------------------

/**
 * Apply pattern overlays to the phenotype.
 * Patterns add boolean flags and may override colorName (gray, roan, appaloosa, dominant white).
 *
 * @param {Object} genotype
 * @param {string} colorName - base color after dilutions
 * @param {number} genotypeHash - deterministic hash for subtype selection
 * @returns {Object} { colorName, isGray, isRoan, isAppaloosa, isWhite, hasTobiano, hasFrameOvero, hasSabino, hasSplash, isBrindle }
 */
function applyPatterns(genotype, colorName, genotypeHash) {
  const result = {
    colorName,
    isGray: false,
    isRoan: false,
    isAppaloosa: false,
    isWhite: false,
    hasTobiano: false,
    hasFrameOvero: false,
    hasSabino: false,
    hasSplash: false,
    isBrindle: false,
    isFemaleOnly: false, // Equoria-er4n: split out of colorName parenthetical
  };

  // --- Dominant White (highest priority) ---
  const w = genotype.W_DominantWhite ?? 'w/w';
  if (w !== 'w/w') {
    result.colorName = 'Dominant White';
    result.isWhite = true;
    return result; // White overrides all other patterns
  }

  // --- Appaloosa (LP_LeopardComplex) ---
  const lp = genotype.LP_LeopardComplex ?? 'lp/lp';
  const patn1 = genotype.PATN1_Pattern1 ?? 'patn1/patn1';
  const hasLP = lp === 'LP/lp' || lp === 'LP/LP';
  const hasPATN1 = patn1 === 'PATN1/patn1' || patn1 === 'PATN1/PATN1';

  if (hasLP) {
    result.isAppaloosa = true;
    if (hasPATN1) {
      // Full pattern: Blanket, Leopard, or Snowflake subtypes
      const lpPatterns = [
        'Blanket',
        'Leopard',
        'Heavy Snowflake Leopard',
        'Light Snowflake Leopard',
        'Moderate Snowflake Leopard',
        'Heavy Frost Roan Varnish',
        'Light Frost Roan Varnish',
        'Moderate Frost Roan Varnish',
      ];
      result.colorName = lpPatterns[genotypeHash % lpPatterns.length];
    } else {
      // Minimal pattern: Varnish Roan, Fewspot, Snowcap
      const lpMinimal = ['Varnish Roan', 'Fewspot Leopard', 'Snowcap'];
      result.colorName = lpMinimal[genotypeHash % lpMinimal.length];
    }
  }

  // --- Gray ---
  // Equoria-erfm: 'Gray' included as the early-stage canonical name (e.g.
  // young grays before progression). Equal-weighted with subtypes via hash.
  const g = genotype.G_Gray ?? 'g/g';
  if (g === 'G/g' || g === 'G/G') {
    result.isGray = true;
    const grayOptions = [
      'Gray', // Equoria-erfm: plain 'Gray' early-stage default
      'Steel Gray',
      'Rose Gray',
      'White Gray',
      'Fleabitten Gray',
      'Steel Dark Dapple Gray',
      'Steel Light Dapple Gray',
      'Rose Dark Dapple Gray',
      'Rose Light Dapple Gray',
    ];
    result.colorName = grayOptions[genotypeHash % grayOptions.length];
  }

  // --- Roan (applied after gray since gray overrides roan in display name) ---
  // Equoria-erfm: Modern registry naming convention (AQHA/APHA):
  //   Chestnut base → 'Red Roan'   (or 'Strawberry Roan' synonym — Red Roan is canonical)
  //   Bay base      → 'Bay Roan'
  //   Black base    → 'Blue Roan'
  // Both 'Red Roan' and 'Bay Roan' are now produced as distinct names.
  const rn = genotype.Rn_Roan ?? 'rn/rn';
  if ((rn === 'Rn/rn' || rn === 'Rn/Rn') && !result.isGray && !result.isAppaloosa) {
    result.isRoan = true;
    switch (colorName) {
      case 'Chestnut':
      case 'Palomino':
      case 'Red Dun':
      case 'Dunalino':
        result.colorName = 'Red Roan';
        break;
      case 'Bay':
      case 'Buckskin':
      case 'Bay Dun':
      case 'Dunskin':
        result.colorName = 'Bay Roan';
        break;
      case 'Seal Brown':
      case 'Smoky Seal Brown':
      case 'Seal Brown Dun':
        result.colorName = 'Seal Brown Roan';
        break;
      case 'Black':
      case 'Smoky Black':
      case 'Grulla':
      case 'Smoky Grulla':
        result.colorName = 'Blue Roan';
        break;
      case 'Silver Dapple':
      case 'Silver Bay':
        // Equoria-er4n: namespace silver-base roan to avoid collision with the
        // LP minimal pattern named 'Varnish Roan'.
        result.colorName = colorName === 'Silver Bay' ? 'Silver Bay Roan' : 'Silver Roan';
        break;
      default:
        // Other colors (champagne, pearl, etc.) keep colorName + set isRoan flag
        break;
    }
  }

  // --- Tobiano ---
  const to = genotype.TO_Tobiano ?? 'to/to';
  if (to === 'TO/to' || to === 'TO/TO') {
    result.hasTobiano = true;
  }

  // --- Frame Overo ---
  const o = genotype.O_FrameOvero ?? 'n/n';
  if (o === 'O/n' || o === 'O/O') {
    result.hasFrameOvero = true;
  }

  // --- Sabino1 ---
  const sb1 = genotype.SB1_Sabino1 ?? 'n/n';
  if (sb1 === 'SB1/n' || sb1 === 'SB1/SB1') {
    result.hasSabino = true;
  }

  // --- Splash White ---
  const sw = genotype.SW_SplashWhite ?? 'n/n';
  if (sw !== 'n/n') {
    result.hasSplash = true;
  }

  // --- Brindle ---
  // Equoria-er4n: '(Female)' parenthetical metadata moved out of colorName
  // into the isFemaleOnly flag — colorName is now just 'Brindle'.
  const br1 = genotype.BR1_Brindle1 ?? 'n/n';
  if (br1 !== 'n/n' && !result.isWhite) {
    result.isBrindle = true;
    result.isFemaleOnly = true;
    result.colorName = 'Brindle';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shade selection
// ---------------------------------------------------------------------------

/**
 * Select shade deterministically from breed shade_bias for the given colorName.
 * Uses genotypeHash for index-based deterministic selection.
 *
 * @param {string} colorName
 * @param {Object|null} shadeBias - breed's shade_bias map
 * @param {number} genotypeHash
 * @returns {string} shade string
 */
function selectShade(colorName, shadeBias, genotypeHash) {
  if (!shadeBias || typeof shadeBias !== 'object') {
    return 'standard';
  }

  const shadeObj = shadeBias[colorName];
  if (!shadeObj || typeof shadeObj !== 'object') {
    return 'standard';
  }

  const shadeArray = expandShadesToArray(shadeObj);
  if (shadeArray.length === 0) {
    return 'standard';
  }

  return shadeArray[genotypeHash % shadeArray.length];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate the full coat color phenotype from a horse's color genotype.
 * Deterministic: same genotype + same shadeBias always returns identical output.
 *
 * @param {Object} genotype - colorGenotype from genotypeGenerationService
 * @param {Object|null} shadeBias - breed's shade_bias map (from breedGeneticProfile.shade_bias)
 * @returns {Object} phenotype
 */
export function calculatePhenotype(genotype, shadeBias = null) {
  // Equoria-liy7c: full four-part JSONB guard. Adding the !Array.isArray check
  // (typeof [] === 'object') ensures an array-shaped colorGenotype on a legacy
  // row resolves to the safe 'Unknown' phenotype rather than silently reading
  // undefined locus keys off the array.
  if (
    !genotype ||
    typeof genotype !== 'object' ||
    Array.isArray(genotype) ||
    Object.keys(genotype).length === 0
  ) {
    return {
      colorName: 'Unknown',
      shade: 'standard',
      isGray: false,
      isRoan: false,
      isAppaloosa: false,
      isWhite: false,
      hasTobiano: false,
      hasFrameOvero: false,
      hasSabino: false,
      hasSplash: false,
      isBrindle: false,
      isFemaleOnly: false,
    };
  }

  // Deterministic hash from sorted genotype for subtype selection
  const sortedKeys = Object.keys(genotype).sort();
  const sortedGenotype = {};
  for (const k of sortedKeys) {
    sortedGenotype[k] = genotype[k];
  }
  const genotypeHash = djb2Hash(JSON.stringify(sortedGenotype));

  // 1. Determine base color
  const baseColor = getBaseColor(genotype);

  // 2. Apply dilutions
  const colorAfterDilutions = applyDilutions(baseColor, genotype);

  // 3. Apply pattern overlays
  const patterns = applyPatterns(genotype, colorAfterDilutions, genotypeHash);

  // 4. Select shade
  const shade = selectShade(patterns.colorName, shadeBias, genotypeHash);

  return {
    colorName: patterns.colorName,
    shade,
    isGray: patterns.isGray,
    isRoan: patterns.isRoan,
    isAppaloosa: patterns.isAppaloosa,
    isWhite: patterns.isWhite,
    hasTobiano: patterns.hasTobiano,
    hasFrameOvero: patterns.hasFrameOvero,
    hasSabino: patterns.hasSabino,
    hasSplash: patterns.hasSplash,
    isBrindle: patterns.isBrindle,
    isFemaleOnly: patterns.isFemaleOnly,
  };
}
