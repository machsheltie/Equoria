/**
 * disciplineRules.test.mjs (Equoria-576c0 B3)
 *
 * Owner ruling R8 (2026-10-15): the competition stat map is the bible's
 * 24-discipline 50/30/20 table (docs/features/13_Competitions_shows_Event_Scoring_DEEP.md,
 * "Discipline stat model"), with Racing's tertiary stat = Focus (ruling C6,
 * 2026-10-16). One module owns it; the post-show stat gain and the competition
 * level/config read from it, and an unknown discipline is an error rather than a
 * silent Racing fallback.
 *
 * Pure tests: no database.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DISCIPLINE_STATS,
  COMPETITION_DISCIPLINES,
  isKnownDiscipline,
  getDisciplineStats,
} from '../rules/disciplineRules.mjs';
import { calculateStatGains } from '../../../utils/competitionRewards.mjs';
import { getDisciplineConfig } from '../../../utils/competitionLogic.mjs';
import { HORSE_STAT_VALUES } from '../../../constants/schema.mjs';

// The bible table, transcribed: [50% primary, 30% secondary, 20% tertiary].
const BIBLE = {
  'Western Pleasure': ['focus', 'obedience', 'intelligence'],
  Reining: ['agility', 'precision', 'focus'],
  Cutting: ['intelligence', 'agility', 'boldness'],
  'Barrel Racing': ['speed', 'agility', 'obedience'],
  Roping: ['precision', 'focus', 'speed'],
  'Team Penning': ['intelligence', 'agility', 'stamina'],
  Rodeo: ['boldness', 'agility', 'stamina'],
  Hunter: ['balance', 'precision', 'intelligence'],
  Saddleseat: ['flexibility', 'balance', 'obedience'],
  Endurance: ['stamina', 'intelligence', 'speed'],
  Eventing: ['stamina', 'boldness', 'agility'],
  Dressage: ['precision', 'focus', 'obedience'],
  'Show Jumping': ['balance', 'agility', 'boldness'],
  Vaulting: ['flexibility', 'balance', 'obedience'],
  Polo: ['speed', 'boldness', 'agility'],
  'Cross Country': ['stamina', 'boldness', 'intelligence'],
  'Combined Driving': ['obedience', 'stamina', 'focus'],
  'Fine Harness': ['flexibility', 'precision', 'balance'],
  Gaited: ['flexibility', 'balance', 'obedience'],
  Gymkhana: ['speed', 'flexibility', 'focus'],
  Steeplechase: ['stamina', 'boldness', 'balance'],
  Racing: ['speed', 'stamina', 'focus'],
  'Harness Racing': ['speed', 'precision', 'stamina'],
  // Owner ruling 2026-10-21: Pleasure Driving is the 24th discipline. Old contract: 23.
  'Pleasure Driving': ['obedience', 'balance', 'focus'],
};

/** The stat calculateStatGains picks for a 1st place with a forced gain and a given pick. */
function pickedStat(discipline, pick) {
  let call = 0;
  return calculateStatGains('1st', discipline, () => (call++ === 0 ? 0 : pick))?.stat;
}

describe('DISCIPLINE_STATS — the bible table (R8, C6)', () => {
  it('holds exactly the 24 bible disciplines with their primary, secondary and tertiary stats', () => {
    expect(DISCIPLINE_STATS).toEqual(BIBLE);
    expect([...COMPETITION_DISCIPLINES].sort()).toEqual(Object.keys(BIBLE).sort());
  });

  it('gives Racing Speed / Stamina / Focus (ruling C6)', () => {
    expect(getDisciplineStats('Racing')).toEqual(['speed', 'stamina', 'focus']);
  });

  it('uses only stats the Horse model has', () => {
    for (const stats of Object.values(DISCIPLINE_STATS)) {
      for (const stat of stats) {
        expect(HORSE_STAT_VALUES).toContain(stat);
      }
    }
  });

  it('treats a name outside the table as unknown and throws instead of falling back to Racing', () => {
    for (const name of ['Obedience Training', 'Trail', 'English Pleasure', 'Driving', 'racing', '']) {
      expect(isKnownDiscipline(name)).toBe(false);
      expect(() => getDisciplineStats(name)).toThrow(/Unknown competition discipline/);
    }
  });
});

describe('the post-show stat gain reads the bible table', () => {
  it('picks only from each discipline’s three bible stats, with equal odds across them', () => {
    for (const [discipline, stats] of Object.entries(BIBLE)) {
      expect([pickedStat(discipline, 0), pickedStat(discipline, 0.34), pickedStat(discipline, 0.67)]).toEqual(stats);
    }
  });

  it('throws for an unknown discipline instead of using the Racing stats', () => {
    expect(() => calculateStatGains('1st', 'Trail', () => 0)).toThrow(/Unknown competition discipline/);
  });
});

describe('the competition discipline config reads the bible table', () => {
  it('reports the bible stats for every competition discipline', () => {
    for (const [discipline, stats] of Object.entries(BIBLE)) {
      expect(getDisciplineConfig(discipline).stats).toEqual(stats);
    }
  });

  it('throws for a name it does not know instead of answering with Racing', () => {
    expect(() => getDisciplineConfig('Unknown-X')).toThrow(/Unknown/);
  });
});
