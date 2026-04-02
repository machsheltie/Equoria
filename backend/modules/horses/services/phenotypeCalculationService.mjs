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

// ---------------------------------------------------------------------------
// Base color determination
// ---------------------------------------------------------------------------

/**
 * Determine base color from Extension + Agouti.
 *
 * @param {Object} genotype
 * @returns {'chestnut'|'bay'|'black'}
 */
function getBaseColor(genotype) {
  const ext = genotype.E_Extension ?? 'E/e';
  const ag = genotype.A_Agouti ?? 'A/a';

  // e/e = chestnut (recessive red — no black pigment)
  if (ext === 'e/e') {
    return 'chestnut';
  }

  // EDXW override: acts like extension modifier (treat as black extension)
  // EDXW n/n = no effect; any non-n/n is an extension-modifier allele

  // Black base: E present + a/a agouti
  if (ag === 'a/a') {
    return 'black';
  }

  // Bay: E present + at least one A allele
  return 'bay';
}

// ---------------------------------------------------------------------------
// Dilution engine
// ---------------------------------------------------------------------------

/**
 * Apply all dilution loci to the base color.
 * Returns the resolved color name string.
 *
 * @param {'chestnut'|'bay'|'black'} baseColor
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
  // For pseudo-double-dilute from pearl, shade names differ slightly
  // but we use the same color names as double cream

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
  if (hasPearlHomo && !hasCreamSingle && !effectiveCreamDouble) {
    // Pearl without cream acts like a mild dilute
    switch (baseColor) {
      case 'chestnut':
        return 'Chestnut Pearl';
      case 'bay':
        return 'Bay Pearl';
      case 'black':
        return 'Black Pearl';
    }
  }

  // --- Double cream (or pseudo-double-dilute) ---
  if (effectiveCreamDouble) {
    // Double dilute — no dun/silver modifiers needed for name
    if (hasPseudoDilute && !hasCreamDouble) {
      // Distinguish pearl pseudo-dilute names
      switch (baseColor) {
        case 'chestnut':
          return 'Palomino Pearl';
        case 'bay':
          return 'Buckskin Pearl';
        case 'black':
          return 'Smoky Black Pearl';
      }
    }
    switch (baseColor) {
      case 'chestnut':
        return 'Cremello';
      case 'bay':
        return 'Perlino';
      case 'black':
        return 'Smoky Cream';
    }
  }

  // --- Single cream ---
  if (hasCreamSingle) {
    if (hasDun) {
      // Cream + dun stack
      switch (baseColor) {
        case 'chestnut':
          return 'Palomino'; // Cream takes priority for naming on chestnut+dun
        case 'bay':
          return 'Bay Dun'; // Dunskin: spec AC2 — Buckskin+Dun → 'Bay Dun' with Cream note in shade
        case 'black':
          return hasSilver ? 'Silver Grulla' : 'Grulla'; // smoky grulla = silver grulla
      }
    }
    if (hasSilver && baseColor === 'black') {
      return 'Silver Black'; // Silver takes priority name-wise on smoky black
    }
    switch (baseColor) {
      case 'chestnut':
        return 'Palomino';
      case 'bay':
        return 'Buckskin';
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
          return 'Silver Bay'; // Silver bay dun — use Silver Bay
        case 'chestnut':
          break; // silver has no effect on chestnut — fall through to dun
      }
    }
    switch (baseColor) {
      case 'black':
        return 'Silver Black';
      case 'bay':
        return 'Silver Bay';
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
    case 'black':
      return 'Black';
  }

  return 'Unknown';
}

/**
 * Resolve champagne-modified color names.
 * Champagne takes naming priority over cream and dun.
 *
 * @param {'chestnut'|'bay'|'black'} baseColor
 * @param {boolean} hasCreamSingle
 * @param {boolean} hasCreamDouble
 * @param {boolean} hasDun
 * @param {boolean} hasSilver
 * @returns {string}
 */
function resolveChampagneColor(baseColor, hasCreamSingle, hasCreamDouble, hasDun, hasSilver) {
  const base =
    {
      chestnut: 'Gold',
      bay: 'Amber',
      black: 'Classic',
    }[baseColor] ?? 'Gold';

  const hasAnyCream = hasCreamSingle || hasCreamDouble;

  // Most specific: Silver + Dun + Champagne (must check before separate Silver or Dun branches)
  if (hasSilver && baseColor !== 'chestnut' && hasDun) {
    return hasAnyCream ? `Silver ${base} Cream Dun Champagne` : `Silver ${base} Dun Champagne`;
  }

  // Silver + Champagne (no dun)
  if (hasSilver && baseColor !== 'chestnut') {
    return hasAnyCream ? `Silver ${base} Cream Champagne` : `Silver ${base} Champagne`;
  }

  // Dun + Champagne (no silver)
  if (hasDun) {
    return hasAnyCream ? `${base} Cream Dun Champagne` : `${base} Dun Champagne`;
  }

  // Base Champagne (no silver, no dun)
  const parts = [base];
  if (hasAnyCream) {
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
  const g = genotype.G_Gray ?? 'g/g';
  if (g === 'G/g' || g === 'G/G') {
    result.isGray = true;
    // Select gray stage via hash
    const grayOptions = [
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
  const rn = genotype.Rn_Roan ?? 'rn/rn';
  if ((rn === 'Rn/rn' || rn === 'Rn/Rn') && !result.isGray && !result.isAppaloosa) {
    result.isRoan = true;
    // Roan color name is derived from base color (before appaloosa/gray override)
    switch (colorName) {
      case 'Chestnut':
      case 'Palomino':
      case 'Red Dun':
        result.colorName = 'Strawberry Roan';
        break;
      case 'Bay':
      case 'Buckskin':
      case 'Bay Dun':
        result.colorName = 'Red Roan';
        break;
      case 'Black':
      case 'Smoky Black':
      case 'Grulla':
        result.colorName = 'Blue Roan';
        break;
      case 'Silver Black':
      case 'Silver Bay':
        result.colorName = 'Varnish Roan';
        break;
      default:
        // For other colors (champagne, pearl, etc.) keep colorName + set isRoan flag
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
  const br1 = genotype.BR1_Brindle1 ?? 'n/n';
  if (br1 !== 'n/n' && !result.isWhite) {
    result.isBrindle = true;
    result.colorName = 'Brindle (Female)';
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
  if (!genotype || typeof genotype !== 'object' || Object.keys(genotype).length === 0) {
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
  };
}
