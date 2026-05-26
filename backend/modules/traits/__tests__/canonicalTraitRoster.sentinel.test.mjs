/**
 * Sentinel: canonical horse-trait roster invariants (Equoria-9o3n7.3, §B + §E).
 *
 * Asserts the reconciled single-source-of-truth roster holds across the three
 * real trait catalogs:
 *   - backend/utils/traitEffects.mjs            (TRAIT_COMPETITION/training effects)
 *   - backend/utils/epigeneticTraits.mjs        (TRAIT_DEFINITIONS — inheritance roster)
 *   - backend/utils/traitCompetitionImpact.mjs  (competition-impact effects)
 *
 * Invariants (each is sentinel-positive: it FAILS if a regression reintroduces
 * the bad state):
 *   (a) §E — the four dropped names (weatherImmunity/nightVision/fireResistance/
 *       waterPhobia, any casing) appear in NONE of the three catalogs.
 *   (b) §E — legendaryBloodline is present and canonical (camelCase) in all
 *       three catalogs; no snake legendary_bloodline survives.
 *   (c) §B — no groom-personality name leaks into the horse trait catalogs.
 *   (d) §C/§B — no snake_case key survives in the two camelCase catalogs
 *       (traitEffects + TRAIT_DEFINITIONS), EXCEPT the discipline_affinity_*
 *       effect keys which are intentionally converted in §F (9o3n7.5). This
 *       guard tightens to "zero snake keys" once §F lands.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllTraitEffects } from '../../../utils/traitEffects.mjs';
import { getAllTraitCompetitionEffects } from '../../../utils/traitCompetitionImpact.mjs';
import { getTraitsByType } from '../../../utils/epigeneticTraits.mjs';

const DROPPED = ['weatherimmunity', 'nightvision', 'fireresistance', 'waterphobia'];
// The specific groom-personality / temperament "ghost" names the 2026-05-21
// review flagged (groomPersonalityTraits / horseTemperamentAnalysis), which the
// spec §B excludes from the horse epigenetic roster. NOTE: this is NOT the
// generic GROOM_PERSONALITY_VALUES set — "calm" and "confident" are legitimate
// horse epigenetic traits AND groom personalities; the ghosts below are names
// that exist ONLY on the groom side and must never appear as horse traits.
const GROOM_GHOSTS = [
  'spooky',
  'self_assured',
  'selfAssured',
  'timid',
  'friendly',
  'withdrawn',
  'hardy',
  'adaptable',
  'sensitive',
  'dependent',
  'steady',
  'delicate',
];

const effectsKeys = Object.keys(getAllTraitEffects());
const impactKeys = Object.keys(getAllTraitCompetitionEffects());
const definitionKeys = getTraitsByType('all');
const allKeys = [...effectsKeys, ...impactKeys, ...definitionKeys];

describe('canonical trait roster — §E dropped names', () => {
  it('none of the four dropped traits appear in any of the three catalogs', () => {
    const offenders = allKeys.filter(k => DROPPED.includes(k.toLowerCase()));
    expect(offenders).toEqual([]);
  });
});

describe('canonical trait roster — §E legendaryBloodline canonical everywhere', () => {
  it('legendaryBloodline (camelCase) present in all three catalogs', () => {
    expect(effectsKeys).toContain('legendaryBloodline');
    expect(impactKeys).toContain('legendaryBloodline');
    expect(definitionKeys).toContain('legendaryBloodline');
  });
  it('no snake legendary_bloodline survives in any catalog', () => {
    expect(allKeys).not.toContain('legendary_bloodline');
  });
});

describe('canonical trait roster — §B groom-personality names excluded', () => {
  it('no groom-personality ghost appears in the horse trait effect/definition catalogs', () => {
    const horseKeys = [...effectsKeys, ...definitionKeys].map(k => k.toLowerCase());
    const leaked = GROOM_GHOSTS.filter(g => horseKeys.includes(g.toLowerCase()));
    expect(leaked).toEqual([]);
  });
});

describe('canonical trait roster — §C/§B casing (camelCase, affinity exempt until §F)', () => {
  it('no snake_case key (other than discipline_affinity_*) survives in the two camelCase catalogs', () => {
    const camelCatalogs = [...effectsKeys, ...definitionKeys];
    const snakeOffenders = camelCatalogs.filter(k => k.includes('_') && !k.startsWith('discipline_affinity_'));
    expect(snakeOffenders).toEqual([]);
  });
});
