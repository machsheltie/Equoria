/**
 * appearanceHealthRules.mjs
 *
 * Genotype health rules for the appearance genome (genetics master spec §14,
 * Equoria-8xxnf slice 1). Health is a separate genotype-rule record, never a
 * `lethal` flag on a variant: dosage, compound state, penetrance and life stage
 * all matter, so `O/O`, `LP/LP`, MCOA and gray melanoma cannot collapse into one
 * boolean.
 *
 * Every rule is `active: false`. Slice 1 designs the shape only; nothing in the
 * game resolves these rules until a later slice is approved. The live breeding
 * path still uses allelePairRules.mjs.
 *
 * Each rule is a §14 GeneticHealthOutcome plus the predicate that selects it:
 *   ruleId             stable identifier
 *   genotypePredicate  { variantIds, minTotalDosage, maxTotalDosage,
 *                      absentVariantIds }: matches when the summed dosage of
 *                      variantIds lies in [minTotalDosage, maxTotalDosage]
 *                      (maxTotalDosage null = no upper bound) and no
 *                      absentVariantIds call is present
 *   syndromeId, triggerGenotype, stage (DiseaseStage), outcome (DiseaseOutcome),
 *   birthStatus, evidence (EvidenceRecord)         - spec §14 / §2 vocabularies
 *   prognosis          the §14 liveAffected prognosis, or ageDependentRisk
 *                      for a later-life risk; null otherwise
 *   penetranceStatus   COMPLETE (every matching horse is affected) or
 *                      UNCALIBRATED (whether a matching horse is affected waits
 *                      on a calibrated `penetrance` distribution, still absent)
 *   birthStatusWhenNotPenetrant  for UNCALIBRATED liveAffected rules: the
 *                      birth status of a carrier who is not affected
 *   penetranceNote     what is known about penetrance, in words
 *   riskLevel          relative risk where the spec separates genotypes
 *                      (HIGHER | LOWER | UNKNOWN), otherwise null
 *
 * Gray (spec §4.3, §14): any G3 is higher melanoma risk; G2 without G3 is lower;
 * legacy gray with unknown copy number is genuinely unknown. Three rules keep
 * those apart. Melanoma is age-dependent and never created at conception, so a
 * gray foal is born liveUnaffected.
 */

import { lastReviewedDate } from './appearanceVariantBuilders.mjs';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function predicate(variantIds, minTotalDosage, { max = null, absent = [] } = {}) {
  return { variantIds, minTotalDosage, maxTotalDosage: max, absentVariantIds: absent };
}

function evidence(tier, sourceIds, notes) {
  return {
    tier,
    detectionBasis: 'directVariantAssayPossible',
    populationScope: 'BROAD',
    sourceIds,
    lastReviewed: lastReviewedDate,
    ...(notes ? { notes } : {}),
  };
}

const GRAY = {
  syndromeId: 'grayAssociatedMelanoma',
  stage: 'ageDependent',
  outcome: 'chronicRisk',
  birthStatus: 'liveUnaffected',
  prognosis: 'ageDependentRisk',
  penetranceStatus: 'UNCALIBRATED',
  penetranceNote: 'Age-dependent and incomplete; G3 groups higher risk than G2 groups',
};

// PMEL Z (spec §4.2, §14): N/Z carries MCOA risk; Z/Z is typically more severe.
const MCOA = {
  syndromeId: 'multipleCongenitalOcularAnomalies',
  stage: 'NEONATAL',
  outcome: 'chronicRisk',
  // When penetrant the anomaly is congenital, so an affected foal is born with it;
  // a carrier who is not penetrant is born unaffected. Until a calibrated
  // penetrance distribution exists, no carrier may be classed as affected.
  birthStatus: 'liveAffected',
  birthStatusWhenNotPenetrant: 'liveUnaffected',
  prognosis: 'chronicMorbidity',
  penetranceStatus: 'UNCALIBRATED',
  penetranceNote: 'Dosage-dependent; registry distributions, not the renderer, resolve it',
  evidence: evidence('aValidatedCausal', ['Brunberg 2006', 'Andersson 2013']),
};

const RULES = [
  {
    ruleId: 'ednrbOHomozygousLwos',
    genotypePredicate: predicate(['EDNRB_O'], 2),
    syndromeId: 'lethalWhiteOveroSyndrome',
    triggerGenotype: 'EDNRB O/O',
    stage: 'NEONATAL',
    outcome: 'LETHAL',
    birthStatus: 'liveAffected',
    prognosis: 'neonatalLethal',
    penetranceStatus: 'COMPLETE',
    penetranceNote: 'Complete',
    riskLevel: null,
    evidence: evidence('aValidatedCausal', ['Metallinos 1998, PMID 9585428']),
  },
  {
    ruleId: 'trpm1LpHomozygousCsnb',
    genotypePredicate: predicate(['TRPM1_LP'], 2),
    syndromeId: 'congenitalStationaryNightBlindness',
    triggerGenotype: 'TRPM1 LP/LP',
    stage: 'NEONATAL',
    outcome: 'severeMorbidity',
    birthStatus: 'liveAffected',
    prognosis: 'chronicMorbidity',
    penetranceStatus: 'COMPLETE',
    penetranceNote: 'Complete; present from birth and non-progressive',
    riskLevel: null,
    evidence: evidence('aValidatedCausal', ['Bellone 2013, PMID 24167615']),
  },
  {
    ruleId: 'pmelZMcoa',
    genotypePredicate: predicate(['PMEL_Z'], 1, { max: 1 }),
    triggerGenotype: 'PMEL N/Z',
    riskLevel: 'LOWER',
    ...MCOA,
  },
  {
    ruleId: 'pmelZHomozygousMcoa',
    genotypePredicate: predicate(['PMEL_Z'], 2),
    triggerGenotype: 'PMEL Z/Z',
    riskLevel: 'HIGHER',
    ...MCOA,
  },
  {
    ruleId: 'stx17G3MelanomaHigher',
    genotypePredicate: predicate(['STX17_G3'], 1),
    triggerGenotype: 'STX17 G3-bearing gray',
    riskLevel: 'HIGHER',
    evidence: evidence('aValidatedCausal', ['Rubin 2024, PMID 39209879']),
    ...GRAY,
  },
  {
    ruleId: 'stx17G2MelanomaLower',
    genotypePredicate: predicate(['STX17_G2'], 1, { absent: ['STX17_G3'] }),
    triggerGenotype: 'STX17 G2 gray without G3',
    riskLevel: 'LOWER',
    evidence: evidence('aValidatedCausal', ['Rubin 2024, PMID 39209879']),
    ...GRAY,
  },
  {
    ruleId: 'stx17GrayUnknownMelanoma',
    genotypePredicate: predicate(['stx17GrayUnknownCopyNumber'], 1, {
      absent: ['STX17_G2', 'STX17_G3'],
    }),
    triggerGenotype: 'Legacy gray, copy number unknown',
    riskLevel: 'UNKNOWN',
    // The copy number that sets the risk was never recorded for these horses.
    evidence: {
      ...evidence('xGameplayOnly', ['Rubin 2024, PMID 39209879'], 'Legacy G allele'),
      detectionBasis: 'phenotypeOrBreedingEstimateOnly',
    },
    ...GRAY,
  },
];

export const healthRules = deepFreeze(
  Object.fromEntries(RULES.map(rule => [rule.ruleId, { ...rule, active: false }])),
);
