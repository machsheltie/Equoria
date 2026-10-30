/**
 * Coat color names from a color genotype (Equoria-7woyj).
 *
 * Owner list 2026-10-29 with rulings q309-q316 (docs/features/coat-color-names.md
 * maps every name), plus two names added by q317 (2026-10-30). Split out of phenotypeCalculationService.mjs, which still owns
 * the pattern overlays (gray, appaloosa, brindle) and the shade roll.
 *
 * How a name is chosen:
 *   1. The genotype is read into a state: base color, copies of cream, pearl,
 *      snowdrop and sunshine, and whether dun, silver, champagne, mushroom and
 *      roan show.
 *   2. The newest genes only have the names on the owner's list. When a
 *      combination is not on the list the gene is left out of the name (it still
 *      shows on the vet genetics test), in this order: snowdrop/sunshine, then
 *      mushroom, then wild bay (named as bay).
 *   3. Every other combination uses the game's names, renamed to the owner's
 *      wording; a combination her list does not name keeps its game name (q312).
 *   4. Bay, Chestnut, Black, Palomino, Buckskin and Seal Brown are color families:
 *      the breed's shade roll picks the owner's name (e.g. Bay + dark = Mahogany
 *      Bay), see familyShadeName.
 *
 * Sooty, flaxen and pangare stay markings flags and never enter a name (q314,
 * deferred to 2026-11-02).
 */

/** Alleles of one locus pair ('Cr/n' -> ['Cr', 'n']); [] when not a string pair. */
function alleles(pair) {
  return typeof pair === 'string' && pair.length > 0 ? pair.split('/') : [];
}

/** How many copies of `allele` the pair carries (0, 1 or 2). */
function copies(pair, allele) {
  return alleles(pair).filter(part => part === allele).length;
}

/**
 * Dun shows with a D allele, and with the nd1/nd2 compound (pseudo-dun, kept as
 * dun; the odds question is the owner's, see the mapping doc).
 */
function isDunActive(dunPair) {
  const parts = alleles(dunPair);
  return parts.includes('D') || (parts.includes('nd1') && parts.includes('nd2'));
}

/** EDXW other than n/n acts as a working Extension allele (Equoria-1set). */
function isEdxwActive(edxwPair) {
  return typeof edxwPair === 'string' && edxwPair !== 'n/n' && edxwPair.length > 0;
}

/**
 * Base color from Extension + Agouti. Agouti dominance is A+ > A > At > a:
 * A+ is the wild bay allele (owner ruling q315), At is seal brown.
 *
 * @param {Object} genotype
 * @returns {'chestnut'|'wildBay'|'bay'|'sealBrown'|'black'}
 */
export function getBaseColor(genotype) {
  const ext = genotype.E_Extension ?? 'E/e';
  const ag = genotype.A_Agouti ?? 'A/a';
  if (ext === 'e/e' && !isEdxwActive(genotype.EDXW ?? 'n/n')) {
    return 'chestnut';
  }
  const parts = alleles(ag);
  if (parts.includes('A+')) {
    return 'wildBay';
  }
  if (parts.length === 0 || parts.includes('A')) {
    return 'bay';
  }
  return parts.includes('At') ? 'sealBrown' : 'black';
}

/**
 * The genotype as the naming rules read it.
 *
 * @param {Object} genotype
 * @param {boolean} roanShows - roan in the genotype and not hidden by gray/appaloosa
 */
function readState(genotype, roanShows) {
  const base = getBaseColor(genotype);
  return {
    base,
    cream: copies(genotype.Cr_Cream ?? 'n/n', 'Cr'),
    pearl: copies(genotype.Prl_Pearl ?? 'n/n', 'prl'),
    snowdrop: copies(genotype.Sdp_Snowdrop ?? 'n/n', 'sdp'),
    sunshine: copies(genotype.Sun_Sunshine ?? 'n/n', 'sun'),
    dun: isDunActive(genotype.D_Dun ?? 'nd2/nd2'),
    // Silver acts on black pigment only: no effect on a chestnut.
    silver: copies(genotype.Z_Silver ?? 'n/n', 'Z') > 0 && base !== 'chestnut',
    champagne: copies(genotype.Ch_Champagne ?? 'n/n', 'Ch') > 0,
    mushroom: copies(genotype.MFSD12_Mushroom ?? 'N/N', 'M') > 0,
    roan: roanShows,
  };
}

// ---------------------------------------------------------------------------
// The newest genes: only the owner's names
// ---------------------------------------------------------------------------

const plainNouns = {
  chestnut: 'Chestnut',
  bay: 'Bay',
  wildBay: 'Wild Bay',
  sealBrown: 'Seal',
  black: 'Black',
};
const pearlNouns = {
  chestnut: 'Chestnut Pearl',
  bay: 'Bay Pearl',
  wildBay: 'Wild Bay Pearl',
  sealBrown: 'Seal Pearl',
  black: 'Black Pearl',
};
const creamNouns = {
  chestnut: 'Palomino',
  bay: 'Buckskin',
  wildBay: 'Wild Buckskin',
  sealBrown: 'Seal Buckskin',
  black: 'Smoky Black',
};

/**
 * Snowdrop and sunshine (q313): recessive, so two copies show; one copy of each
 * shows as snowdrop sunshine (plain colors only, per the owner's list).
 *
 * @returns {string|null} null when the owner's list does not name the combination
 */
function snowdropSunshineName(s) {
  if (s.dun || s.silver || s.champagne || s.mushroom || s.roan) {
    return null;
  }
  let body = null;
  let plain = false;
  if (s.cream === 0) {
    plain = s.pearl < 2;
    body = plain ? plainNouns[s.base] : pearlNouns[s.base];
  } else if (s.cream === 1 && s.pearl === 0) {
    body = creamNouns[s.base];
  }
  if (!body) {
    return null;
  }
  if (plain && s.snowdrop >= 1 && s.sunshine >= 1) {
    return `Snowdrop Sunshine ${body}`;
  }
  if (s.snowdrop === 2) {
    return `Snowdrop ${body}`;
  }
  return s.sunshine === 2 ? `Sunshine ${body}` : null;
}

/** Mushroom (q315/q316): the owner's mushroom names; on black it looks black but is named. */
function mushroomName(s) {
  if (s.silver || s.champagne) {
    return s.champagne && !s.silver && !s.dun && !s.roan && s.cream === 0 && s.pearl < 2
      ? ({ chestnut: 'Mushroom Gold Champagne', bay: 'Mushroom Amber Champagne' }[s.base] ?? null)
      : null;
  }
  const { base, cream, pearl, dun, roan } = s;
  const plain = cream === 0 && pearl < 2;
  if (base === 'chestnut' || base === 'bay') {
    const noun = base === 'chestnut' ? 'Chestnut' : 'Bay';
    if (plain && dun && !roan) {
      return base === 'chestnut' ? 'Mushroom Red Dun' : 'Mushroom Bay Dun';
    }
    if (dun) {
      return null;
    }
    if (plain && roan) {
      return base === 'chestnut' ? 'Mushroom Red Roan' : 'Mushroom Bay Roan';
    }
    if (roan) {
      return null;
    }
    if (plain) {
      return `Mushroom ${noun}`;
    }
    if (cream === 0 && pearl === 2) {
      return `Mushroom ${noun} Pearl`;
    }
    if (cream === 1 && pearl === 0) {
      return base === 'chestnut' ? 'Mushroom Palomino' : 'Mushroom Buckskin';
    }
    if (cream === 1 && base === 'chestnut') {
      return 'Mushroom Palomino Pearl'; // q317 (owner 2026-10-30)
    }
    if (cream === 2 && pearl >= 1) {
      return base === 'chestnut' ? 'Mushroom Cremello Pearl' : 'Mushroom Perlino Pearl';
    }
    return null;
  }
  if (dun || roan) {
    return null;
  }
  if (plain) {
    return { sealBrown: 'Mushroom Seal Brown', black: 'Mushroom Black' }[base] ?? null;
  }
  return base === 'black' && cream === 1 && pearl === 0 ? 'Mushroom Smoky Black' : null;
}

/** Wild bay (the A+ allele, q315): the owner's wild names. */
function wildBayName(s) {
  if (s.dun || s.silver || s.roan) {
    return null;
  }
  const { cream, pearl } = s;
  if (s.champagne) {
    if (cream === 0) {
      return pearl === 2 ? 'Wild Amber Champagne Pearl' : 'Wild Amber Champagne';
    }
    if (cream !== 1) {
      return null;
    }
    // q317 (owner 2026-10-30): Wild Amber Cream Champagne joins the pearl name.
    return pearl >= 1 ? 'Wild Amber Cream Champagne Pearl' : 'Wild Amber Cream Champagne';
  }
  if (cream === 0) {
    return pearl === 2 ? 'Wild Bay Pearl' : 'Wild Bay';
  }
  const noun = cream === 1 ? 'Wild Buckskin' : 'Wild Perlino';
  return pearl >= 1 ? `${noun} Pearl` : noun;
}

// ---------------------------------------------------------------------------
// Every other combination: the game's names in the owner's wording
// ---------------------------------------------------------------------------

const champagneBases = { chestnut: 'Gold', bay: 'Amber', sealBrown: 'Sable', black: 'Classic' };

function champagneName(s) {
  const b = champagneBases[s.base];
  const pseudo = s.cream === 1 && s.pearl >= 1;
  if (s.cream === 2 || pseudo) {
    // Cream + pearl on champagne: the owner's "cream pearl champagne" names
    // (q309 for gold). Two creams (true ivory) keep the game's Ivory names (q312).
    if (pseudo && !s.silver && !s.dun) {
      return `${b} Cream Pearl Champagne`;
    }
    if (s.silver && s.dun) {
      return 'Silver Ivory Dun Champagne';
    }
    if (s.silver) {
      return 'Silver Ivory Champagne';
    }
    return s.dun ? 'Ivory Dun Champagne' : 'Ivory Champagne';
  }
  const cream = s.cream === 1 ? ' Cream' : '';
  if (s.silver && s.dun) {
    return `Silver ${b}${cream} Dun Champagne`;
  }
  if (s.silver) {
    return `Silver ${b}${cream} Champagne`;
  }
  if (s.dun) {
    return s.cream === 1 ? `${b} Cream Dun Champagne` : `${b} Champagne Dun`;
  }
  if (s.cream === 1) {
    return `${b} Cream Champagne`;
  }
  if (s.pearl === 2) {
    return `${b} Champagne Pearl`;
  }
  return s.roan && s.base === 'black' ? 'Classic Champagne Roan' : `${b} Champagne`;
}

function doubleCreamName(s) {
  const noun = {
    chestnut: 'Cremello',
    bay: 'Perlino',
    sealBrown: 'Seal Perlino',
    black: 'Smoky Cream',
  }[s.base];
  if (s.pearl >= 1) {
    return `${noun} Pearl`; // q316: cream + pearl compounds look like the double cream
  }
  if (s.silver && (s.base === 'bay' || s.base === 'black')) {
    return `Silver ${noun}`;
  }
  if (s.dun && s.base !== 'sealBrown') {
    return `${noun} Dun`;
  }
  return s.roan && s.base === 'bay' ? 'Perlino Roan' : noun;
}

function pearlName(s) {
  const noun = pearlNouns[s.base];
  if (s.silver && (s.base === 'bay' || s.base === 'black')) {
    return `Silver ${noun}`;
  }
  if (s.dun) {
    return `${noun} Dun`;
  }
  return s.roan && (s.base === 'chestnut' || s.base === 'black') ? `${noun} Roan` : noun;
}

function singleCreamName(s) {
  const { base, silver, dun, roan } = s;
  if (dun) {
    if (base === 'chestnut') {
      return roan ? 'Red Roan' : 'Dunalino';
    }
    if (base === 'bay') {
      if (roan) {
        return 'Bay Roan';
      }
      return silver ? 'Silver Dunskin' : 'Dunskin';
    }
    if (base === 'sealBrown') {
      return 'Seal Brown Dunskin';
    }
    if (silver) {
      return 'Silver Dapple Grulla';
    }
    return roan ? 'Blue Roan' : 'Smoky Grulla';
  }
  if (silver && base === 'bay') {
    return roan ? 'Bay Roan' : 'Silver Buckskin';
  }
  if (silver && base === 'black') {
    return roan ? 'Silver Blue Roan' : 'Silver Smoky Black';
  }
  if (roan) {
    return {
      chestnut: 'Palomino Roan',
      bay: 'Buckskin Roan',
      sealBrown: 'Seal Brown Roan',
      black: 'Blue Roan',
    }[base];
  }
  return creamNouns[base];
}

function legacyName(s) {
  const { base, silver, dun, roan } = s;
  if (s.champagne) {
    return champagneName(s);
  }
  if (s.cream === 2) {
    return doubleCreamName(s);
  }
  if (s.cream === 1 && s.pearl >= 1) {
    return {
      chestnut: 'Palomino Pearl',
      bay: 'Buckskin Pearl',
      sealBrown: 'Seal Brown Pearl Cream',
      black: 'Smoky Black Pearl',
    }[base];
  }
  if (s.pearl === 2) {
    return pearlName(s);
  }
  if (s.cream === 1) {
    return singleCreamName(s);
  }
  if (silver) {
    if (dun) {
      return { bay: 'Silver Bay Dun', sealBrown: 'Silver Seal Brown Dun', black: 'Silver Grulla' }[
        base
      ];
    }
    if (roan && base !== 'sealBrown') {
      return base === 'bay' ? 'Silver Bay Roan' : 'Silver Blue Roan';
    }
    return { bay: 'Silver Bay', sealBrown: 'Silver Seal', black: 'Silver Black' }[base];
  }
  if (dun) {
    if (roan) {
      return {
        chestnut: 'Red Dun Roan',
        bay: 'Bay Dun Roan',
        sealBrown: 'Seal Brown Roan',
        black: 'Grulla Roan',
      }[base];
    }
    return { chestnut: 'Red Dun', bay: 'Bay Dun', sealBrown: 'Seal Dun', black: 'Grulla' }[base];
  }
  if (roan) {
    return {
      chestnut: 'Red Roan',
      bay: 'Bay Roan',
      sealBrown: 'Seal Brown Roan',
      black: 'Blue Roan',
    }[base];
  }
  // Color families: the shade roll picks the owner's name (familyShadeName).
  return { chestnut: 'Chestnut', bay: 'Bay', sealBrown: 'Seal Brown', black: 'Black' }[base];
}

function nameFromState(s) {
  if (s.snowdrop > 0 || s.sunshine > 0) {
    return snowdropSunshineName(s) ?? nameFromState({ ...s, snowdrop: 0, sunshine: 0 });
  }
  if (s.mushroom) {
    return (
      mushroomName({ ...s, base: s.base === 'wildBay' ? 'bay' : s.base }) ??
      nameFromState({ ...s, mushroom: false })
    );
  }
  if (s.base === 'wildBay') {
    return wildBayName(s) ?? nameFromState({ ...s, base: 'bay' });
  }
  return legacyName(s);
}

/**
 * The coat color name from base color and dilutions (and roan, which the owner's
 * names fold in: Palomino Roan, Bay Dun Roan...). A color family name is returned
 * as the family ('Bay'); familyShadeName turns it into the owner's name.
 *
 * @param {Object} genotype
 * @param {boolean} roanShows - Rn present and not hidden by gray or appaloosa
 * @returns {string}
 */
export function dilutedColorName(genotype, roanShows) {
  return nameFromState(readState(genotype, roanShows));
}

// ---------------------------------------------------------------------------
// Dominant white (q315)
// ---------------------------------------------------------------------------

/** Dominant-white alleles that, one copy alone, show as a spotted white (owner list). */
export const spottedDominantWhiteAlleles = Object.freeze([
  'W5',
  'W10',
  'W13',
  'W19',
  'W22',
  'W31',
  'W32',
  'W35',
]);

/**
 * The dominant-white name, or null when the horse carries none. Two dominant
 * white alleles (W5/W20, W32/W35...) are compound dominant white; one copy of a
 * spotting allele is dominant white sabino; any other one copy is dominant white.
 * Each of the owner's two long entries offers two names; the first is shown.
 *
 * @param {string|undefined} wPair
 * @returns {string|null}
 */
export function dominantWhiteName(wPair) {
  const whites = alleles(wPair ?? 'w/w').filter(allele => allele !== 'w' && allele !== 'n');
  if (whites.length === 0) {
    return null;
  }
  if (whites.length >= 2) {
    return 'Compound Dominant White';
  }
  return spottedDominantWhiteAlleles.includes(whites[0])
    ? 'Dominant White Sabino'
    : 'Dominant White';
}

// ---------------------------------------------------------------------------
// Color families: shade -> the owner's name
// ---------------------------------------------------------------------------

/**
 * Owner names for each shade of the six color families (portrait match q269 and
 * the owner list). The standard shade, or no shade, is the family's plain name
 * (q311: classic palomino, classic buckskin). Dark chestnut is two owner names
 * (dark chestnut, liver chestnut); the genotype picks one.
 */
export const familyShadeNames = Object.freeze({
  Bay: Object.freeze({
    standard: 'Standard Bay',
    dark: 'Mahogany Bay',
    light: 'Golden Bay',
    blood: 'Blood Bay',
    copper: 'Copper Bay',
    wild: 'Wild Bay',
    honey: 'Honey Bay',
  }),
  Chestnut: Object.freeze({
    standard: 'Standard Chestnut',
    medium: 'Red Chestnut',
    dark: Object.freeze(['Dark Chestnut', 'Liver Chestnut']),
    light: 'Light Yellow Chestnut',
    golden: 'Golden Chestnut',
  }),
  Black: Object.freeze({ standard: 'Nonfading Black', faded: 'Fading Black' }),
  // q321 (owner 2026-10-30): the Saddlebred's shades are light, golden, classic,
  // dark, chocolate. Other breeds still roll pale and copper (same two names).
  Palomino: Object.freeze({
    standard: 'Classic Palomino',
    classic: 'Classic Palomino',
    golden: 'Golden Palomino',
    light: 'Light Palomino',
    pale: 'Light Palomino',
    dark: 'Dark Palomino',
    copper: 'Dark Palomino',
    chocolate: 'Chocolate Palomino',
    isabella: 'Isabella Palomino',
  }),
  Buckskin: Object.freeze({
    standard: 'Classic Buckskin',
    burnished: 'Classic Buckskin',
    golden: 'Golden Buckskin',
    cream: 'Buttermilk Buckskin',
    copper: 'Copper Buckskin',
  }),
  'Seal Brown': Object.freeze({
    standard: 'Standard Seal Brown',
    dark: 'Dark Seal Brown',
    light: 'Light Seal Brown',
    sealskin: 'Sealskin',
  }),
});

/**
 * A color family + its rolled shade as the owner's name. The shade is folded into
 * the name, so the stored shade becomes 'standard'. A shade word the table does
 * not know keeps the family's plain name and the shade. Non-family colors pass
 * through unchanged.
 *
 * @param {string} colorName
 * @param {string} shade
 * @param {number} genotypeHash - picks between two names for one shade
 * @returns {{ colorName: string, shade: string }}
 */
export function familyShadeName(colorName, shade, genotypeHash) {
  const family = Object.hasOwn(familyShadeNames, colorName) ? familyShadeNames[colorName] : null;
  if (!family) {
    return { colorName, shade };
  }
  const named = Object.hasOwn(family, shade) ? family[shade] : null;
  if (named === null) {
    return { colorName: family.standard, shade };
  }
  const name = Array.isArray(named) ? named[(genotypeHash >>> 3) % named.length] : named;
  return { colorName: name, shade: 'standard' };
}
