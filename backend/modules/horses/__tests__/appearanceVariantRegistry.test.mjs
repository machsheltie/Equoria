/**
 * appearanceVariantRegistry.test.mjs
 *
 * Genetics master spec slice 1 (Equoria-8xxnf): the evidence-aware molecular
 * variant registry. Pure data + pure functions, real code, no mocks.
 */

import {
  variantRegistry,
  knownCisHaplotypes,
  getVariant,
  cisIncompatibilityReason,
  listFoundationGenerationUnits,
} from '../services/appearanceVariantRegistry.mjs';
import { healthRules } from '../services/appearanceHealthRules.mjs';

const entries = Object.values(variantRegistry);
const zygosityStates = new Set([
  'observedViable',
  'observedAffected',
  'UNOBSERVED',
  'predictedNonviable',
  'lethalConfirmed',
  'UNKNOWN',
]);
// Closed vocabularies from master spec §2 and §18.
const TIERS = new Set([
  'aValidatedCausal',
  'bStrongAssociation',
  'cCandidate',
  'qQuantitativeOrUnresolved',
  'dDevelopmentalOrAcquired',
  'xGameplayOnly',
]);
const DETECTION = new Set([
  'directVariantAssayPossible',
  'linkedMarkerAssayPossible',
  'researchMethodOnly',
  'phenotypeOrBreedingEstimateOnly',
]);
const SCOPES = new Set(['LINEAGE', 'breedLimited', 'multiBreed', 'BROAD', 'UNKNOWN']);
const healthClasses = new Set([
  'BENIGN',
  'riskAssociated',
  'severeMorbidity',
  'lethalConfirmed',
  'predictedNonviable',
  'homozygoteUnobserved',
  'UNKNOWN',
]);
const mappingStatuses = new Set([
  'primaryBreakpointValidated',
  'accessionValidated',
  'reviewMapped',
  'computationalLiftover',
  'notIndependentlyVerified',
  'UNMAPPED',
]);

function preferred(entry) {
  return entry.mappings.find(m => m.assembly === entry.preferredMappingAssembly) ?? null;
}

describe('variant registry integrity', () => {
  test('every entry is keyed by its own variantId', () => {
    for (const [key, entry] of Object.entries(variantRegistry)) {
      expect(entry.variantId).toBe(key);
    }
  });

  test('variantIds are never display labels or coordinates', () => {
    for (const entry of entries) {
      // Placeholders are Equoria's own names, so camelCase (owner ruling
      // 2026-10-21); molecular variants are written gene_allele.
      const shape = entry.isSentinel ? /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/ : /^[A-Z0-9]+(_[A-Za-z0-9]+)+$/;
      expect(entry.variantId).toMatch(shape);
      expect(entry.variantId).not.toMatch(/\d{6,}/);
    }
  });

  test('skipped W29 and W36 designations do not exist', () => {
    expect(getVariant('KIT_W29')).toBeNull();
    expect(getVariant('KIT_W36')).toBeNull();
  });

  test('fictional loci from the old research are absent', () => {
    const banned = /SALL1|ASIP_A\+|ASIP_At|FLAXEN|PANGARE|SOOTY|RABICANO|MANCHADO|FGF5|CURLY_cu|_NF$|_fb$/i;
    for (const entry of entries) {
      expect(entry.variantId).not.toMatch(banned);
    }
  });

  test('every entry carries the §18 contract fields in their closed vocabularies', () => {
    for (const entry of entries) {
      const id = entry.variantId;
      expect([id, TIERS.has(entry.evidence.tier)]).toEqual([id, true]);
      expect([id, DETECTION.has(entry.evidence.detectionBasis)]).toEqual([id, true]);
      expect([id, SCOPES.has(entry.evidence.populationScope)]).toEqual([id, true]);
      expect(entry.evidence.sourceIds.length).toBeGreaterThan(0);
      expect(entry.evidence.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect([id, healthClasses.has(entry.healthClassification)]).toEqual([id, true]);
      expect(typeof entry.phenotypeModelId).toBe('string');
      expect(Array.isArray(entry.breedsOrFamilies)).toBe(true);
      expect(Array.isArray(entry.studyObservations)).toBe(true);
      expect(Array.isArray(entry.knownCisWith)).toBe(true);
      expect(Array.isArray(entry.knownTransWith)).toBe(true);
      for (const m of entry.mappings) {
        expect([id, mappingStatuses.has(m.mappingVerificationStatus)]).toEqual([id, true]);
      }
    }
  });

  test('every entry declares zygosity evidence from the closed vocabulary', () => {
    for (const entry of entries) {
      expect(zygosityStates.has(entry.zygosityEvidence.heterozygous)).toBe(true);
      expect(zygosityStates.has(entry.zygosityEvidence.homozygous)).toBe(true);
    }
  });

  test('absent homozygotes are never recorded as lethal (W5, W10, W22, SW3)', () => {
    for (const id of ['KIT_W5', 'KIT_W10', 'KIT_W22', 'MITF_SW3', 'PAX3_SW4']) {
      expect(getVariant(id).zygosityEvidence.homozygous).toBe('UNOBSERVED');
      expect(getVariant(id).healthClassification).toBe('homozygoteUnobserved');
    }
  });

  test('viable homozygotes the literature reports are recorded as viable', () => {
    for (const id of ['KIT_W15', 'KIT_W19', 'KIT_W20', 'PAX3_SW2', 'MITF_SW1', 'KIT_TO']) {
      expect(getVariant(id).zygosityEvidence.homozygous).toBe('observedViable');
    }
  });

  test('health is linked through rule ids, not a lethal flag on the variant', () => {
    for (const entry of entries) {
      expect(entry).not.toHaveProperty('lethal');
      expect(Array.isArray(entry.healthRuleIds)).toBe(true);
      for (const ruleId of entry.healthRuleIds) {
        expect(healthRules[ruleId]).toBeDefined();
      }
    }
    expect(getVariant('EDNRB_O').healthRuleIds).toContain('ednrbOHomozygousLwos');
    expect(getVariant('TRPM1_LP').healthRuleIds).toContain('trpm1LpHomozygousCsnb');
  });

  test('every non-sentinel entry has a mapping in its preferred assembly or is explicitly unmapped', () => {
    for (const entry of entries) {
      if (entry.isSentinel) {
        expect(entry.mappings).toEqual([]);
        expect(entry.preferredMappingAssembly).toBeNull();
        continue;
      }
      expect(entry.mappings.length).toBeGreaterThan(0);
      if (entry.preferredMappingAssembly !== null) {
        expect(preferred(entry)).not.toBeNull();
      }
    }
  });

  test('tobiano keeps its breakpoint accession, EquCab2 interval, EquCab3 review mapping and legacy ~43 Mb as separate records', () => {
    const to = getVariant('KIT_TO');
    expect(to.callKind).toBe('INVERSION');
    const byAssembly = Object.fromEntries(to.mappings.map(m => [m.assembly, m]));
    expect(byAssembly['EquCab3.0']).toMatchObject({
      startBp: 42737476,
      endBp: 79471993,
      mappingVerificationStatus: 'reviewMapped',
    });
    expect(byAssembly['EquCab2.0']).toMatchObject({ startBp: 41925230, endBp: 77663330 });
    expect(to.mappings).toContainEqual(
      expect.objectContaining({
        sourceAccession: 'EF442014',
        mappingVerificationStatus: 'primaryBreakpointValidated',
      }),
    );
    expect(to.legacyApproximation).toMatch(/43 Mb/);
  });

  test('W17 is L674P at g.79548244A>G plus E667D at g.79548264T>A (OMIA corrected record)', () => {
    expect(preferred(getVariant('KIT_W17_L674P'))).toMatchObject({
      startBp: 79548244,
      reference: 'A',
      alternate: 'G',
    });
    expect(preferred(getVariant('KIT_W17_E667D'))).toMatchObject({
      startBp: 79548264,
      reference: 'T',
      alternate: 'A',
    });
  });

  test('W30 is the alternative substitution at the W17 L674 site', () => {
    expect(preferred(getVariant('KIT_W30'))).toMatchObject({ startBp: 79548244, alternate: 'T' });
    expect(cisIncompatibilityReason('KIT_W17_L674P', 'KIT_W30')).toBe('overlappingSite');
    expect(getVariant('KIT_W30').sameSiteGroup).toBe(getVariant('KIT_W17_L674P').sameSiteGroup);
    expect(getVariant('KIT_W30').sameSiteGroup).not.toBeNull();
  });

  test('W31, which the live naming code recognizes, has a registry record', () => {
    expect(getVariant('KIT_W31')).toMatchObject({ chromosome: 'ECA3', gene: 'KIT' });
  });

  test('gene membership alone never makes two variants incompatible', () => {
    expect(cisIncompatibilityReason('KIT_W20', 'KIT_W22')).toBeNull();
    expect(cisIncompatibilityReason('KIT_TO', 'KIT_W20')).toBeNull();
    expect(cisIncompatibilityReason('KIT_SB1', 'KIT_W20')).toBeNull();
    expect(cisIncompatibilityReason('SLC45A2_Cr', 'SLC45A2_Prl')).toBeNull();
  });

  test('overlapping sites on one copy are a molecular impossibility', () => {
    // W15 lies inside the W22 deletion.
    expect(cisIncompatibilityReason('KIT_W15', 'KIT_W22')).toBe('overlappingSite');
    // SW6 and SW8 lie inside the SW5 deletion.
    expect(cisIncompatibilityReason('MITF_SW5', 'MITF_SW6')).toBe('overlappingSite');
    expect(cisIncompatibilityReason('MITF_SW6', 'MITF_SW8')).toBe('overlappingSite');
    // Alternative copy-number states of the same STX17 segment.
    expect(cisIncompatibilityReason('STX17_G2', 'STX17_G3')).toBe('overlappingSite');
  });

  test('declared alternative haplotypes are incompatible in cis', () => {
    expect(cisIncompatibilityReason('TBX3_D', 'TBX3_nd1')).toBe('declaredIncompatible');
    expect(cisIncompatibilityReason('stx17GrayUnknownCopyNumber', 'STX17_G3')).toBe('declaredIncompatible');
  });

  test('declared incompatibility is symmetric', () => {
    for (const entry of entries) {
      for (const other of entry.incompatibleWith) {
        expect(getVariant(other).incompatibleWith).toContain(entry.variantId);
      }
    }
  });

  test('an inversion never conflicts with the variants it spans', () => {
    for (const entry of entries) {
      if (entry.chromosome === 'ECA3' && entry.variantId !== 'KIT_TO') {
        expect(cisIncompatibilityReason('KIT_TO', entry.variantId)).toBeNull();
      }
    }
  });

  test('gray copy number lives on the registry record', () => {
    expect(getVariant('STX17_G2').copyNumber).toBe(2);
    expect(getVariant('STX17_G3').copyNumber).toBe(3);
    expect(getVariant('stx17GrayUnknownCopyNumber').copyNumber).toBeNull();
  });

  test('known cis haplotypes reference real ECA3 variants that are compatible in cis', () => {
    const required = ['KIT_W17', 'KIT_W20_W22', 'KIT_W32_W35', 'KIT_W35_W37'];
    for (const id of required) {
      expect(knownCisHaplotypes[id]).toBeDefined();
    }
    for (const hap of Object.values(knownCisHaplotypes)) {
      expect(hap.variantIds.length).toBeGreaterThanOrEqual(2);
      for (const a of hap.variantIds) {
        expect(getVariant(a).chromosome).toBe(hap.chromosome);
        for (const b of hap.variantIds) {
          if (a !== b) {
            expect(cisIncompatibilityReason(a, b)).toBeNull();
            expect(getVariant(a).knownCisWith).toContain(b);
          }
        }
      }
    }
    expect(knownCisHaplotypes.KIT_W17.variantIds).toEqual(['KIT_W17_E667D', 'KIT_W17_L674P']);
  });

  test('W17 components are only generated together; W37 only with its W35 founder chromosome', () => {
    const units = listFoundationGenerationUnits();
    const singles = units.filter(u => u.variantIds.length === 1).map(u => u.variantIds[0]);
    expect(singles).not.toContain('KIT_W17_E667D');
    expect(singles).not.toContain('KIT_W17_L674P');
    expect(singles).not.toContain('KIT_W37');
    expect(units).toContainEqual(
      expect.objectContaining({ unitId: 'KIT_W17', variantIds: ['KIT_W17_E667D', 'KIT_W17_L674P'] }),
    );
    expect(units.find(u => u.unitId === 'KIT_W35_W37').foundationGeneration).toBe('lineageBound');
    expect(getVariant('KIT_W17_E667D').requiresCisWith).toEqual(['KIT_W17_L674P']);
    expect(getVariant('KIT_W17_L674P').requiresCisWith).toEqual(['KIT_W17_E667D']);
    for (const unit of units) {
      for (const id of unit.variantIds) {
        expect(getVariant(id).isSentinel).toBe(false);
      }
    }
  });

  test('legacy roan, generic white, generic splash and generic gray have explicit unknown sentinels', () => {
    expect(getVariant('roanUnknownKit')).toMatchObject({ isSentinel: true, chromosome: 'ECA3' });
    expect(getVariant('kitWhiteUnknownLegacy')).toMatchObject({
      isSentinel: true,
      chromosome: 'ECA3',
    });
    expect(getVariant('splashUnknownLegacy')).toMatchObject({ isSentinel: true, chromosome: null });
    expect(getVariant('stx17GrayUnknownCopyNumber')).toMatchObject({
      isSentinel: true,
      chromosome: 'ECA25',
    });
  });

  test('research-only and lineage-bound records are flagged for generation', () => {
    expect(getVariant('SLC45A2_Sun').foundationGeneration).toBe('researchOnly');
    expect(getVariant('SLC45A2_Sno').foundationGeneration).toBe('lineageBound');
    expect(getVariant('SLC45A2_Cr').foundationGeneration).toBe('ALLOWED');
  });

  test('the X-linked brindle record lives on ECAX', () => {
    expect(getVariant('MBTPS2_BR1')).toMatchObject({ chromosome: 'ECAX', inheritance: 'xLinked' });
  });

  test('health rules are designed in but inactive in this slice', () => {
    // Round 3: field names follow master spec §14 GeneticHealthOutcome.
    const required = [
      'genotypePredicate',
      'syndromeId',
      'triggerGenotype',
      'stage',
      'outcome',
      'birthStatus',
      'riskLevel',
      'evidence',
    ];
    expect(Object.keys(healthRules).length).toBeGreaterThan(0);
    for (const [ruleId, rule] of Object.entries(healthRules)) {
      expect(rule.ruleId).toBe(ruleId);
      expect(rule.active).toBe(false);
      for (const field of required) {
        expect(rule).toHaveProperty(field);
      }
      const predicate = rule.genotypePredicate;
      for (const id of [...predicate.variantIds, ...predicate.absentVariantIds]) {
        expect(getVariant(id)).not.toBeNull();
      }
    }
  });

  test('G2, G3 and unknown-copy gray have separate melanoma rules with distinct risk', () => {
    const ruleFor = id => Object.values(healthRules).filter(r => r.genotypePredicate.variantIds.includes(id));
    const [g2] = ruleFor('STX17_G2');
    const [g3] = ruleFor('STX17_G3');
    const [unknown] = ruleFor('stx17GrayUnknownCopyNumber');
    expect(new Set([g2.ruleId, g3.ruleId, unknown.ruleId]).size).toBe(3);
    expect(g3.riskLevel).toBe('HIGHER');
    expect(g2.riskLevel).toBe('LOWER');
    expect(unknown.riskLevel).toBe('UNKNOWN');
    // A horse carrying G3 is governed by the G3 rule, not also the G2 rule.
    expect(g2.genotypePredicate.absentVariantIds).toContain('STX17_G3');
    for (const id of g3.genotypePredicate.variantIds) {
      expect(id).toBe('STX17_G3');
    }
  });

  test('cisIncompatibilityReason rejects an unknown variant id', () => {
    expect(() => cisIncompatibilityReason('KIT_TO', 'KIT_W99')).toThrow(/KIT_W99/);
  });

  test('the registry is frozen', () => {
    expect(Object.isFrozen(variantRegistry)).toBe(true);
    expect(Object.isFrozen(getVariant('KIT_TO'))).toBe(true);
    expect(Object.isFrozen(getVariant('KIT_TO').mappings)).toBe(true);
  });
});

describe('variant registry (review round 2)', () => {
  test('no sentinel claims validated causality or a direct variant assay', () => {
    for (const entry of entries.filter(e => e.isSentinel)) {
      expect([entry.variantId, entry.evidence.tier]).not.toEqual([entry.variantId, 'aValidatedCausal']);
      expect([entry.variantId, entry.evidence.detectionBasis]).toEqual([
        entry.variantId,
        'phenotypeOrBreedingEstimateOnly',
      ]);
    }
    expect(getVariant('stx17GrayUnknownCopyNumber').evidence.tier).toBe('xGameplayOnly');
  });

  test('published HPS5 cohort effects are kept as study observations, not constants', () => {
    const transportability = new Set(['studyOnly', 'breedLimited', 'replicatedBroadly']);
    for (const entry of entries) {
      for (const obs of entry.studyObservations) {
        expect(typeof obs.sourceId).toBe('string');
        expect(typeof obs.population).toBe('string');
        expect(typeof obs.phenotypeMetric).toBe('string');
        expect(['number', 'string']).toContain(typeof obs.estimate);
        expect(transportability.has(obs.transportability)).toBe(true);
      }
    }
    expect(getVariant('HPS5_EDXW2').studyObservations).toContainEqual(
      expect.objectContaining({ estimate: 9.5, transportability: 'studyOnly' }),
    );
    expect(getVariant('HPS5_EDXW3').studyObservations).toContainEqual(
      expect.objectContaining({ estimate: 5.59, transportability: 'studyOnly' }),
    );
    expect(getVariant('HPS5_EDXW1').studyObservations.length).toBeGreaterThan(0);
  });

  test('research-only variants join foundation units only when asked for', () => {
    const ordinary = listFoundationGenerationUnits().map(u => u.unitId);
    expect(ordinary).not.toContain('SLC45A2_Sun');
    expect(ordinary).toContain('SLC45A2_Cr');
    const research = listFoundationGenerationUnits({ includeResearchOnly: true });
    expect(research.map(u => u.unitId)).toContain('SLC45A2_Sun');
  });

  test('every lineage-bound unit names the population it belongs to', () => {
    const lineage = listFoundationGenerationUnits().filter(u => u.foundationGeneration === 'lineageBound');
    expect(lineage.map(u => u.unitId).sort()).toEqual(['KIT_W17', 'KIT_W35_W37', 'SLC45A2_Sno']);
    for (const unit of lineage) {
      expect([unit.unitId, unit.breedsOrFamilies.length > 0]).toEqual([unit.unitId, true]);
    }
  });
});

describe('health rules follow the master spec §14 contract (review round 3)', () => {
  const STAGES = new Set([
    'EMBRYONIC',
    'FETAL',
    'STILLBIRTH',
    'NEONATAL',
    'JUVENILE',
    'ADULT',
    'ageDependent',
    'prenatalUnknown',
    'UNKNOWN',
  ]);
  const OUTCOMES = new Set(['LETHAL', 'severeMorbidity', 'chronicRisk', 'BENIGN', 'UNKNOWN']);
  const BIRTH = new Set(['prenatalLoss', 'STILLBIRTH', 'liveUnaffected', 'liveAffected']);
  const PROGNOSES = new Set(['neonatalLethal', 'juvenileSevere', 'chronicMorbidity', 'ageDependentRisk']);

  test('every rule uses the §14 GeneticHealthOutcome vocabularies', () => {
    for (const rule of Object.values(healthRules)) {
      const id = rule.ruleId;
      expect(typeof rule.syndromeId).toBe('string');
      expect(typeof rule.triggerGenotype).toBe('string');
      expect([id, STAGES.has(rule.stage)]).toEqual([id, true]);
      expect([id, OUTCOMES.has(rule.outcome)]).toEqual([id, true]);
      expect([id, BIRTH.has(rule.birthStatus)]).toEqual([id, true]);
      if (rule.birthStatus === 'liveAffected' || rule.stage === 'ageDependent') {
        expect([id, PROGNOSES.has(rule.prognosis)]).toEqual([id, true]);
      }
      expect([id, TIERS.has(rule.evidence.tier)]).toEqual([id, true]);
      expect([id, DETECTION.has(rule.evidence.detectionBasis)]).toEqual([id, true]);
      expect([id, SCOPES.has(rule.evidence.populationScope)]).toEqual([id, true]);
      expect(rule.evidence.sourceIds.length).toBeGreaterThan(0);
      expect(rule.evidence.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('each rule matches its §14 table row', () => {
    const row = id => {
      const { stage, outcome, birthStatus, prognosis } = healthRules[id];
      return { stage, outcome, birthStatus, prognosis };
    };
    expect(row('ednrbOHomozygousLwos')).toEqual({
      stage: 'NEONATAL',
      outcome: 'LETHAL',
      birthStatus: 'liveAffected',
      prognosis: 'neonatalLethal',
    });
    expect(row('trpm1LpHomozygousCsnb')).toEqual({
      stage: 'NEONATAL',
      outcome: 'severeMorbidity',
      birthStatus: 'liveAffected',
      prognosis: 'chronicMorbidity',
    });
    expect(row('pmelZMcoa')).toMatchObject({ stage: 'NEONATAL', outcome: 'chronicRisk' });
    for (const id of ['stx17G3MelanomaHigher', 'stx17G2MelanomaLower', 'stx17GrayUnknownMelanoma']) {
      // Melanoma is never created at conception.
      expect(row(id)).toEqual({
        stage: 'ageDependent',
        outcome: 'chronicRisk',
        birthStatus: 'liveUnaffected',
        prognosis: 'ageDependentRisk',
      });
    }
  });
});

describe('health rule penetrance state (review round 4)', () => {
  test('every rule states whether its penetrance is complete or still uncalibrated', () => {
    for (const rule of Object.values(healthRules)) {
      expect([rule.ruleId, ['COMPLETE', 'UNCALIBRATED'].includes(rule.penetranceStatus)]).toEqual([rule.ruleId, true]);
      if (rule.penetranceStatus === 'UNCALIBRATED' && rule.birthStatus === 'liveAffected') {
        // A carrier who is not penetrant is born unaffected; the rule must say so.
        expect([rule.ruleId, rule.birthStatusWhenNotPenetrant]).toEqual([rule.ruleId, 'liveUnaffected']);
      }
    }
  });

  test('PMEL Z carriers are not all affected while penetrance is uncalibrated', () => {
    const rule = healthRules.pmelZMcoa;
    expect(rule.penetranceStatus).toBe('UNCALIBRATED');
    expect(rule.birthStatusWhenNotPenetrant).toBe('liveUnaffected');
    expect(healthRules.ednrbOHomozygousLwos.penetranceStatus).toBe('COMPLETE');
    expect(healthRules.trpm1LpHomozygousCsnb.penetranceStatus).toBe('COMPLETE');
  });
});

describe('health rule dosage strata (review round 5)', () => {
  // A rule matches when the summed dosage of its variantIds lies within
  // [minTotalDosage, maxTotalDosage] and none of its absentVariantIds is present.
  function matchingRules(dosageByVariant) {
    return Object.values(healthRules).filter(rule => {
      const { variantIds, minTotalDosage, maxTotalDosage, absentVariantIds } = rule.genotypePredicate;
      const total = variantIds.reduce((sum, id) => sum + (dosageByVariant[id] ?? 0), 0);
      return (
        total >= minTotalDosage &&
        (maxTotalDosage === null || total <= maxTotalDosage) &&
        absentVariantIds.every(id => !dosageByVariant[id])
      );
    });
  }

  test('N/Z and Z/Z each match exactly one PMEL rule, and Z/Z carries the higher risk', () => {
    const [heterozygous, ...extraHet] = matchingRules({ PMEL_Z: 1 });
    const [homozygous, ...extraHom] = matchingRules({ PMEL_Z: 2 });
    expect([extraHet, extraHom]).toEqual([[], []]);
    expect(heterozygous.ruleId).not.toBe(homozygous.ruleId);
    expect(heterozygous.riskLevel).toBe('LOWER');
    expect(homozygous.riskLevel).toBe('HIGHER');
    for (const rule of [heterozygous, homozygous]) {
      expect(rule).toMatchObject({
        syndromeId: 'multipleCongenitalOcularAnomalies',
        penetranceStatus: 'UNCALIBRATED',
        birthStatusWhenNotPenetrant: 'liveUnaffected',
      });
    }
  });

  test('every predicate states its dosage bounds explicitly', () => {
    for (const rule of Object.values(healthRules)) {
      const { minTotalDosage, maxTotalDosage } = rule.genotypePredicate;
      expect([rule.ruleId, maxTotalDosage === null || maxTotalDosage >= minTotalDosage]).toEqual([rule.ruleId, true]);
    }
  });
});

describe('health rule reachability (review round 6)', () => {
  test('every rule is linked from each variant its predicate counts', () => {
    for (const rule of Object.values(healthRules)) {
      for (const variantId of rule.genotypePredicate.variantIds) {
        expect([rule.ruleId, variantId, getVariant(variantId).healthRuleIds.includes(rule.ruleId)]).toEqual([
          rule.ruleId,
          variantId,
          true,
        ]);
      }
    }
  });
});
