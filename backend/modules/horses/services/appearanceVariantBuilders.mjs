/**
 * appearanceVariantBuilders.mjs
 *
 * Record builders shared by the appearance variant registry files
 * (genetics master spec §2, §4 and §18, Equoria-8xxnf slice 1). They only shape
 * data; the registry (appearanceVariantRegistry.mjs) is the one public lookup.
 *
 * Every record carries the §18 VariantRegistryEntry contract: evidence record
 * (tier, detection basis, population scope, sources, review date), founder
 * breeds/families, phenotype model and observed range, study observations,
 * health classification, cis/trans relationships, same-site group, and
 * mappings with the §18 verification-status vocabulary.
 */

export const specSource = 'EQUORIA_GENETICS_MASTER_SPEC (2026-11-17)';

/** The master spec's scientific cutoff; the date these records were last reviewed. */
export const lastReviewedDate = '2026-10-30';

/** EquCab3.0 RefSeq accessions for the chromosomes the spec names them for. */
export const ACCESSION = {
  ECA1: 'NC_009144.3',
  ECA3: 'NC_009146.3',
  ECA17: 'NC_009160.3',
  ECA21: 'NC_009164.3',
  ECA22: 'NC_009165.3',
  ECAX: 'NC_009175.3',
};

/**
 * The spec tables use short evidence labels; §2 defines the closed tiers.
 * Mixed labels take the lower tier, and the original label is kept in notes.
 * The spec's 'D/disputed' for Sunshine means disputed, not developmental.
 */
const tierForLabel = {
  A: 'aValidatedCausal',
  'A/B': 'bStrongAssociation',
  B: 'bStrongAssociation',
  'B/C': 'cCandidate',
  'B/D': 'cCandidate',
  C: 'cCandidate',
  D: 'cCandidate',
  'Q/B': 'qQuantitativeOrUnresolved',
  LEGACY: 'xGameplayOnly',
};

/** Default phenotype model per gene; individual records may override. */
const modelForGene = {
  MC1R: 'mc1rExtension',
  ASIP: 'asipAgouti',
  SLC45A2: 'slc45a2CreamPearl',
  SLC36A1: 'slc36a1Champagne',
  TBX3: 'tbx3Dun',
  PMEL: 'pmelSilver',
  MFSD12: 'mfsd12Mushroom',
  STX17: 'stx17Gray',
  KIT: 'kitWhiteSpotting',
  EDNRB: 'ednrbFrame',
  MITF: 'splashWhite',
  PAX3: 'splashWhite',
  HPS5: 'hps5EdenWhite',
  TRPM1: 'leopardComplex',
  RFWD3: 'leopardComplex',
  MBTPS2: 'brindle1Mbtps2',
};

function evidenceRecord(fields) {
  const tier = tierForLabel[fields.evidence];
  if (!tier) {
    throw new Error(`Unknown evidence label: ${fields.evidence}`);
  }
  return {
    tier,
    detectionBasis: fields.detection ?? 'directVariantAssayPossible',
    populationScope: fields.scope ?? 'UNKNOWN',
    sourceIds: [fields.citation],
    lastReviewed: lastReviewedDate,
    notes: `Master spec evidence label: ${fields.evidence}`,
  };
}

/** Health classification from homozygous status unless the record states one. */
function healthClassification(fields) {
  if (fields.healthClass) {
    return fields.healthClass;
  }
  const byHom = {
    lethalConfirmed: 'lethalConfirmed',
    UNOBSERVED: 'homozygoteUnobserved',
    UNKNOWN: 'UNKNOWN',
  };
  return byHom[fields.hom] ?? 'BENIGN';
}

/**
 * A published effect from one cohort (spec §2 PublishedStudyObservation). It is
 * calibration evidence for that population, never a universal effect size.
 */
export function studyObservation(fields) {
  return {
    sourceId: fields.sourceId,
    population: fields.population,
    ...(fields.sampleSize === undefined ? {} : { sampleSize: fields.sampleSize }),
    phenotypeMetric: fields.phenotypeMetric,
    estimate: fields.estimate,
    ...(fields.uncertainty === undefined ? {} : { uncertainty: fields.uncertainty }),
    ...(fields.units === undefined ? {} : { units: fields.units }),
    transportability: fields.transportability ?? 'studyOnly',
  };
}

export function mapping(assembly, fields = {}) {
  return {
    assembly,
    sourceAccession: fields.accession ?? null,
    publishedHgvs: fields.publishedHgvs ?? null,
    currentHgvs: fields.currentHgvs ?? null,
    startBp: fields.start ?? null,
    endBp: fields.end ?? fields.start ?? null,
    reference: fields.ref ?? null,
    alternate: fields.alt ?? null,
    mappingSource: fields.source ?? specSource,
    mappingVerificationStatus:
      fields.verification ?? (assembly === 'UNMAPPED' ? 'UNMAPPED' : 'notIndependentlyVerified'),
  };
}

function commonFields(fields) {
  return {
    sameSiteGroup: fields.site ?? null,
    copyNumber: fields.copyNumber ?? null,
    phenotypeRange: fields.range ?? null,
    breedsOrFamilies: fields.families ?? [],
    evidence: evidenceRecord(fields),
    studyObservations: fields.studies ?? [],
    legacyApproximation: fields.legacyApproximation ?? null,
    healthClassification: healthClassification(fields),
    healthRuleIds: fields.health ?? [],
    knownCisWith: [],
    knownTransWith: [],
    incompatibleWith: fields.incompatibleWith ?? [],
    requiresCisWith: fields.requiresCisWith ?? [],
    generationHaplotypeId: fields.generationHaplotypeId ?? null,
  };
}

/** A real variant. Coordinates default to an EquCab3 mapping from the spec. */
export function variant(variantId, gene, chromosome, fields) {
  const accession = fields.specAccession ? ACCESSION[chromosome] : null;
  const mappings = fields.mappings ?? [
    mapping('EquCab3.0', { ...fields, accession, source: specSource }),
  ];
  return {
    variantId,
    gene,
    chromosome,
    locusRegionId: fields.region ?? `${chromosome}_${gene}`,
    callKind: fields.callKind ?? 'SNV',
    inheritance: chromosome === 'ECAX' ? 'xLinked' : 'AUTOSOMAL',
    isSentinel: false,
    phenotypeModelId: fields.model ?? modelForGene[gene],
    mappings,
    preferredMappingAssembly: fields.preferred === undefined ? 'EquCab3.0' : fields.preferred,
    zygosityEvidence: { heterozygous: fields.het ?? 'observedViable', homozygous: fields.hom },
    foundationGeneration: fields.generation ?? 'ALLOWED',
    ...commonFields(fields),
  };
}

/**
 * A placeholder for a legacy or phenotype-only state with no known variant.
 * It is never a direct assay result, so its detection basis is phenotype only.
 */
export function sentinel(variantId, chromosome, fields) {
  return {
    variantId,
    gene: fields.gene ?? null,
    chromosome,
    locusRegionId: fields.region,
    callKind: 'haplotypeMarker',
    inheritance: 'AUTOSOMAL',
    isSentinel: true,
    phenotypeModelId: fields.model,
    mappings: [],
    preferredMappingAssembly: null,
    zygosityEvidence: { heterozygous: 'observedViable', homozygous: fields.hom },
    foundationGeneration: 'legacyOnly',
    ...commonFields({ ...fields, detection: 'phenotypeOrBreedingEstimateOnly' }),
  };
}

/** KIT dominant-white record (spec §4.4 table; coordinates NC_009146.3). */
export function kitW(number, start, fields) {
  return variant(`KIT_W${number}`, 'KIT', 'ECA3', {
    region: 'eca3KitRegion',
    specAccession: true,
    start,
    het: 'observedViable',
    hom: 'UNOBSERVED',
    scope: 'LINEAGE',
    ...fields,
  });
}

/** Splash-white record on its real MITF (ECA16) or PAX3 (ECA6) chromosome. */
export function splash(gene, number, start, fields) {
  const chromosome = gene === 'MITF' ? 'ECA16' : 'ECA6';
  return variant(`${gene}_SW${number}`, gene, chromosome, {
    region: `${chromosome}_${gene}`,
    start,
    hom: 'UNKNOWN',
    ...fields,
  });
}
