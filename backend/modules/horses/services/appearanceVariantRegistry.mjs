/**
 * appearanceVariantRegistry.mjs
 *
 * The evidence-aware molecular variant registry (genetics master spec §3-§4,
 * Equoria-8xxnf slice 1). Each entry is one real sequence or structural change,
 * keyed by a stable variantId that is never a display label or a coordinate.
 * A horse stores calls to these ids on phased chromosome copies
 * (appearanceGenome.mjs); familiar shorthand such as `Cr/Prl` is derived.
 *
 * Scope of slice 1: the variants the game already uses, the real records they
 * map to, the sentinels that keep vague legacy values honest, and the KIT
 * records needed for the known cis haplotypes. Nothing here changes what
 * players see, how foals are bred, or how colors are named.
 *
 * Coordinates are transcribed from the master spec. They carry
 * verificationStatus 'UNVERIFIED' unless the spec records a stronger status;
 * Equoria has not re-verified them against the assemblies.
 *
 * Rules the shape enforces:
 *   - Gene membership never implies incompatibility. Two calls conflict on one
 *     chromosome copy only when their sites overlap (cisIncompatibilityReason)
 *     or the registry declares them alternative states (incompatibleWith).
 *   - Health effects live in appearanceHealthRules.mjs, linked by healthRuleIds.
 *   - Absent homozygotes are 'UNOBSERVED' or 'UNKNOWN', never lethal.
 */

import { mapping, sentinel, variant } from './appearanceVariantBuilders.mjs';
import { whitePatternVariants } from './appearanceWhitePatternVariants.mjs';

const stx17Segment = { start: 6625295, end: 6629872 };

const entries = [
  // §4.1 base pigment
  variant('MC1R_e', 'MC1R', 'ECA3', {
    specAccession: true,
    start: 36979560,
    ref: 'C',
    alt: 'T',
    publishedHgvs: 'c.248C>T',
    evidence: 'A',
    citation: 'Marklund 1996, PMID 8995760',
    hom: 'observedViable',
    scope: 'BROAD',
    range: 'Chestnut base when biallelic with e or eA',
  }),
  variant('MC1R_eA', 'MC1R', 'ECA3', {
    specAccession: true,
    start: 36979562,
    ref: 'G',
    alt: 'A',
    publishedHgvs: 'c.250G>A',
    evidence: 'A',
    citation: 'PMID 11086549',
    hom: 'UNKNOWN',
    families: ['Belgian Draft'],
    range: 'Compound red with e',
  }),
  variant('ASIP_a', 'ASIP', 'ECA22', {
    specAccession: true,
    callKind: 'INDEL',
    start: 26067463,
    end: 26067473,
    currentHgvs: 'NM_001164017.1:c.187_197del',
    publishedHgvs: 'c.191_201del',
    evidence: 'A',
    citation: 'Rieder 2001, PMID 11353392; mapping OMIA/Mura 2022',
    hom: 'observedViable',
    scope: 'BROAD',
    range: 'On E/_, biallelic deletion permits body-wide black',
  }),

  // §4.2 dilutions
  variant('SLC45A2_Cr', 'SLC45A2', 'ECA21', {
    start: 31690653,
    ref: 'G',
    alt: 'A',
    currentHgvs: 'c.601G>A',
    evidence: 'A',
    citation: 'Mariat 2003, PMID 12605854',
    hom: 'observedViable',
    scope: 'BROAD',
    range: 'One-copy cream; two-copy double-cream',
  }),
  variant('SLC45A2_Prl', 'SLC45A2', 'ECA21', {
    start: 31709690,
    ref: 'G',
    alt: 'A',
    currentHgvs: 'c.1129G>A',
    evidence: 'A',
    citation: 'Sevane 2019, PMID 30968968; Holl 2019, PMID 31006892',
    hom: 'observedViable',
    range: 'Expresses in Prl/Prl and trans Cr/Prl',
  }),
  variant('SLC45A2_Sun', 'SLC45A2', 'ECA21', {
    start: 31705404,
    ref: 'G',
    alt: 'A',
    currentHgvs: 'c.712G>A',
    evidence: 'D',
    citation: 'Durward-Akhurst 2024, PMID 38600096',
    hom: 'UNKNOWN',
    generation: 'researchOnly',
    model: 'slc45a2Sunshine',
    range: 'Proposed dilution; causality disputed',
  }),
  variant('SLC45A2_Sno', 'SLC45A2', 'ECA21', {
    specAccession: true,
    start: 31688649,
    ref: 'G',
    alt: 'A',
    currentHgvs: 'XM_001498110.4:c.449G>A',
    publishedHgvs: 'c.305G>A (EquCab2 transcript)',
    evidence: 'B/C',
    citation: 'Bisbee 2020, PMID 31961951; mapping OMIA',
    hom: 'observedViable',
    generation: 'lineageBound',
    model: 'slc45a2Snowdrop',
    scope: 'LINEAGE',
    families: ['Gypsy/Vanner family'],
    range: 'Rare lineage-limited dilution',
  }),
  variant('SLC36A1_Ch', 'SLC36A1', 'ECA14', {
    start: 26012449,
    ref: 'G',
    alt: 'C',
    publishedHgvs: 'c.188C>G',
    evidence: 'A',
    citation: 'Cook 2008, PMID 18802473',
    hom: 'observedViable',
    range: 'Dilutes red and black; freckled skin; eyes mature to amber',
  }),
  variant('TBX3_D', 'TBX3', 'ECA8', {
    callKind: 'INSERTION',
    start: 20665796,
    end: 20665808,
    publishedHgvs: 'g.[20665796_20665797insCCTTCTGGC;20665807_20665808ins[1609]]',
    evidence: 'A',
    citation: 'Imsland 2016, PMID 26691985',
    hom: 'observedViable',
    site: 'tbx3DunRegulatory',
    incompatibleWith: ['TBX3_nd1'],
    range: 'Body dilution plus primitive markings',
  }),
  variant('TBX3_nd1', 'TBX3', 'ECA8', {
    callKind: 'INSERTION',
    preferred: null,
    mappings: [mapping('UNMAPPED', { publishedHgvs: '8-bp insertion plus downstream ins[1610]' })],
    evidence: 'A',
    citation: 'Imsland 2016, PMID 26691985',
    hom: 'observedViable',
    site: 'tbx3DunRegulatory',
    incompatibleWith: ['TBX3_D'],
    range: 'No dilution; primitive markings may remain',
  }),
  variant('PMEL_Z', 'PMEL', 'ECA6', {
    start: 74569773,
    ref: 'G',
    alt: 'A',
    publishedHgvs: 'c.1849C>T',
    evidence: 'A',
    citation: 'Brunberg 2006; Andersson 2013',
    hom: 'observedViable',
    health: ['pmelZMcoa', 'pmelZHomozygousMcoa'],
    healthClass: 'riskAssociated',
    range: 'Dilutes eumelanin; cryptic on chestnut',
  }),
  variant('MFSD12_Mu', 'MFSD12', 'ECA7', {
    callKind: 'INSERTION',
    start: 2544518,
    publishedHgvs: 'c.600dup',
    evidence: 'A',
    citation: 'Tanaka 2019, PMID 31635058',
    hom: 'observedViable',
    scope: 'breedLimited',
    families: ['Shetland', 'Miniature'],
    range: 'Recessive red-pigment dilution',
  }),

  // §4.3 gray: copy number of one STX17 segment
  variant('STX17_G2', 'STX17', 'ECA25', {
    callKind: 'CNV',
    ...stx17Segment,
    evidence: 'A',
    citation: 'Rubin 2024, PMID 39209879',
    hom: 'UNKNOWN',
    copyNumber: 2,
    site: 'stx17CnvSegment',
    health: ['stx17G2MelanomaLower'],
    healthClass: 'riskAssociated',
    incompatibleWith: ['stx17GrayUnknownCopyNumber'],
    range: 'Slow graying; lower melanoma incidence than G3',
  }),
  variant('STX17_G3', 'STX17', 'ECA25', {
    callKind: 'CNV',
    ...stx17Segment,
    evidence: 'A',
    citation: 'Rubin 2024, PMID 39209879',
    hom: 'observedViable',
    copyNumber: 3,
    site: 'stx17CnvSegment',
    health: ['stx17G3MelanomaHigher'],
    healthClass: 'riskAssociated',
    incompatibleWith: ['stx17GrayUnknownCopyNumber'],
    range: 'Faster average graying; higher melanoma risk',
  }),
  // The STX17 duplication is causal (Rubin 2024), but this legacy state is not a
  // molecular call: the copy number was never recorded, so it is gameplay-only.
  sentinel('stx17GrayUnknownCopyNumber', 'ECA25', {
    gene: 'STX17',
    region: 'eca25Stx17',
    evidence: 'LEGACY',
    citation: 'Rubin 2024, PMID 39209879; legacy G allele, copy number never recorded',
    hom: 'observedViable',
    model: 'stx17Gray',
    site: 'stx17CnvSegment',
    health: ['stx17GrayUnknownMelanoma'],
    healthClass: 'riskAssociated',
    incompatibleWith: ['STX17_G2', 'STX17_G3'],
    range: 'Gray; speed and melanoma risk unknown until copy number is known',
  }),

  ...whitePatternVariants,

  // §4.7 X-linked brindle
  variant('MBTPS2_BR1', 'MBTPS2', 'ECAX', {
    specAccession: true,
    start: 17286855,
    ref: 'T',
    alt: 'C',
    currentHgvs: 'c.1340+4T>C',
    evidence: 'A',
    citation: 'Murgiano 2016, PMID 27449517',
    hom: 'UNKNOWN',
    range: 'X-linked incomplete dominant vertical hair-texture/pigment striping',
  }),
];

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Haplotypes reported with several variants on one chromosome copy (spec §4.4).
 * foundationGeneration says whether a founder may be generated carrying the
 * whole haplotype; component variants marked haplotypeOnly or carrying a
 * generationHaplotypeId are generated only through their haplotype.
 */
const HAPLOTYPES = {
  KIT_W17: {
    chromosome: 'ECA3',
    variantIds: ['KIT_W17_E667D', 'KIT_W17_L674P'],
    note: 'W17 is one two-missense haplotype',
    foundationGeneration: 'lineageBound',
  },
  KIT_W20_W22: {
    chromosome: 'ECA3',
    variantIds: ['KIT_W20', 'KIT_W22'],
    note: 'W22 documented with W20 in cis',
    foundationGeneration: 'ALLOWED',
  },
  KIT_W32_W35: {
    chromosome: 'ECA3',
    variantIds: ['KIT_W32', 'KIT_W35'],
    note: 'W35 may be cis with W32',
    foundationGeneration: 'ALLOWED',
  },
  KIT_W35_W37: {
    chromosome: 'ECA3',
    variantIds: ['KIT_W35', 'KIT_W37'],
    note: 'Reported W35+W37 founder chromosome',
    foundationGeneration: 'lineageBound',
  },
};

const byId = Object.fromEntries(entries.map(e => [e.variantId, e]));
for (const hap of Object.values(HAPLOTYPES)) {
  for (const a of hap.variantIds) {
    for (const b of hap.variantIds) {
      if (a !== b && !byId[a].knownCisWith.includes(b)) {
        byId[a].knownCisWith.push(b);
      }
    }
  }
}

export const variantRegistry = deepFreeze(byId);
export const knownCisHaplotypes = deepFreeze(HAPLOTYPES);

/**
 * The units a founder generator may draw: single variants that are not tied to
 * a haplotype, plus whole haplotypes. W17 components and W37 never appear alone.
 * Research-only variants (Sunshine) join only in research mode (spec §4.2).
 * Every unit carries its founder populations, so a lineageBound unit is never
 * drawn without knowing which population owns it.
 *
 * @param {{ includeResearchOnly?: boolean }} [options]
 * @returns {Array<{ unitId: string, variantIds: string[], foundationGeneration: string, breedsOrFamilies: string[] }>}
 */
export function listFoundationGenerationUnits({ includeResearchOnly = false } = {}) {
  const generatable = new Set(['ALLOWED', 'lineageBound']);
  if (includeResearchOnly) {
    generatable.add('researchOnly');
  }
  const singles = Object.values(variantRegistry)
    .filter(
      e =>
        !e.isSentinel &&
        e.generationHaplotypeId === null &&
        generatable.has(e.foundationGeneration),
    )
    .map(e => ({
      unitId: e.variantId,
      variantIds: [e.variantId],
      foundationGeneration: e.foundationGeneration,
      breedsOrFamilies: [...e.breedsOrFamilies],
    }));
  const haplotypes = Object.entries(knownCisHaplotypes)
    .filter(([, hap]) => generatable.has(hap.foundationGeneration))
    .map(([unitId, hap]) => ({
      unitId,
      variantIds: [...hap.variantIds],
      foundationGeneration: hap.foundationGeneration,
      breedsOrFamilies: [
        ...new Set(hap.variantIds.flatMap(id => variantRegistry[id].breedsOrFamilies)),
      ],
    }));
  return [...singles, ...haplotypes];
}

/**
 * @param {string} variantId
 * @returns {object|null} the frozen registry entry, or null when unknown
 */
export function getVariant(variantId) {
  return Object.hasOwn(variantRegistry, variantId) ? variantRegistry[variantId] : null;
}

function preferredInterval(entry) {
  if (entry.preferredMappingAssembly === null) {
    return null;
  }
  const m = entry.mappings.find(x => x.assembly === entry.preferredMappingAssembly);
  return m && m.startBp !== null ? m : null;
}

/**
 * Why two calls cannot sit on the same chromosome copy, or null when they can.
 * Same gene is never a reason. An inversion does not conflict with the variants
 * it spans.
 *
 * @param {string} a - variantId
 * @param {string} b - variantId
 * @returns {'declaredIncompatible'|'overlappingSite'|null}
 */
export function cisIncompatibilityReason(a, b) {
  const ea = getVariant(a);
  const eb = getVariant(b);
  for (const [id, e] of [
    [a, ea],
    [b, eb],
  ]) {
    if (!e) {
      throw new Error(`Unknown variantId: ${id}`);
    }
  }
  if (ea.incompatibleWith.includes(b)) {
    return 'declaredIncompatible';
  }
  if (ea.chromosome === null || ea.chromosome !== eb.chromosome) {
    return null;
  }
  if (ea.callKind === 'INVERSION' || eb.callKind === 'INVERSION') {
    return null;
  }
  const ia = preferredInterval(ea);
  const ib = preferredInterval(eb);
  if (!ia || !ib) {
    return null;
  }
  return ia.startBp <= ib.endBp && ib.startBp <= ia.endBp ? 'overlappingSite' : null;
}
