import { describe, it, expect } from '@jest/globals';
import {
  HANDLER_SKILL_BONUSES,
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  calculateHandlerBonus,
  recordHandlerPerformance,
  calculateGroomExperienceGain,
} from '../../services/groomHandlerService.mjs';

// ── HANDLER_SKILL_BONUSES ────────────────────────────────────────────────────

describe('HANDLER_SKILL_BONUSES', () => {
  it('exports constants for all four skill levels', () => {
    for (const level of ['novice', 'intermediate', 'expert', 'master']) {
      expect(HANDLER_SKILL_BONUSES).toHaveProperty(level);
      const entry = HANDLER_SKILL_BONUSES[level];
      expect(typeof entry.baseBonus).toBe('number');
      expect(typeof entry.maxBonus).toBe('number');
      expect(typeof entry.experienceMultiplier).toBe('number');
      expect(entry.maxBonus).toBeGreaterThan(entry.baseBonus);
    }
  });
});

// ── PERSONALITY_DISCIPLINE_SYNERGY ───────────────────────────────────────────

describe('PERSONALITY_DISCIPLINE_SYNERGY', () => {
  it('has entries for all expected personality types', () => {
    for (const p of ['gentle', 'energetic', 'patient', 'strict', 'calm', 'confident']) {
      expect(PERSONALITY_DISCIPLINE_SYNERGY).toHaveProperty(p);
      const entry = PERSONALITY_DISCIPLINE_SYNERGY[p];
      expect(Array.isArray(entry.beneficial)).toBe(true);
      expect(typeof entry.bonus).toBe('number');
      expect(entry.bonus).toBeGreaterThan(0);
    }
  });
});

// ── SPECIALTY_DISCIPLINE_BONUSES ─────────────────────────────────────────────

describe('SPECIALTY_DISCIPLINE_BONUSES', () => {
  it('has entries for all expected specialties', () => {
    for (const s of ['showHandling', 'racing', 'western', 'training', 'foalCare', 'general']) {
      expect(SPECIALTY_DISCIPLINE_BONUSES).toHaveProperty(s);
      const entry = SPECIALTY_DISCIPLINE_BONUSES[s];
      expect(Array.isArray(entry.disciplines)).toBe(true);
      expect(typeof entry.bonus).toBe('number');
    }
  });
});

// ── calculateHandlerBonus ────────────────────────────────────────────────────

const mockGroom = {
  name: 'TestGroom',
  skillLevel: 'intermediate',
  speciality: 'showHandling',
  personality: 'gentle',
  experience: 50,
};
const mockHorse = { id: 1, name: 'TestHorse', bondScore: 60 };

describe('calculateHandlerBonus', () => {
  it('returns handlerBonus=0 and isConformationShow=false for a non-conformation discipline', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Racing', {});
    expect(result.handlerBonus).toBe(0);
    expect(result.isConformationShow).toBe(false);
    expect(result.bonusBreakdown.totalBonus).toBe(0);
    expect(result.groomName).toBe('TestGroom');
  });

  it('returns handlerBonus=0.15 and isConformationShow=true for a valid conformation class', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Mares', {});
    expect(result.isConformationShow).toBe(true);
    expect(result.handlerBonus).toBe(0.15);
    expect(result.bonusBreakdown.totalBonus).toBe(0.15);
  });

  it('returns isConformationShow=true for "Stallions" class', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Stallions', {});
    expect(result.isConformationShow).toBe(true);
  });

  it('returns error-default result when groom is null (error handler branch)', () => {
    const result = calculateHandlerBonus(null, mockHorse, 'Racing', {});
    expect(result.handlerBonus).toBe(0);
    expect(result.groomName).toBe('Unknown');
    expect(result.groomSkillLevel).toBe('novice');
  });

  it('groomName/skillLevel/specialty/personality are reflected in result', () => {
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Barrel Racing', {});
    expect(result.groomSkillLevel).toBe('intermediate');
    expect(result.groomSpecialty).toBe('showHandling');
    expect(result.groomPersonality).toBe('gentle');
  });
});

// ── calculateGroomExperienceGain ─────────────────────────────────────────────

describe('calculateGroomExperienceGain', () => {
  it('awards +3 extra XP for 1st place', () => {
    const xp = calculateGroomExperienceGain(1, 5, 'novice');
    expect(xp).toBe(4); // base 1 + placement bonus 3, novice multiplier 1.0
  });

  it('awards +2 extra XP for 2nd place', () => {
    const xp = calculateGroomExperienceGain(2, 5, 'novice');
    expect(xp).toBe(3); // base 1 + 2 = 3 * 1.0
  });

  it('awards +1 extra XP for 3rd place', () => {
    const xp = calculateGroomExperienceGain(3, 5, 'novice');
    expect(xp).toBe(2); // base 1 + 1 = 2 * 1.0
  });

  it('awards only base XP for 4th place', () => {
    const xp = calculateGroomExperienceGain(4, 5, 'novice');
    expect(xp).toBe(1); // base 1 only
  });

  it('adds +1 for large competitions (>=10 entries)', () => {
    const xp = calculateGroomExperienceGain(4, 10, 'novice');
    expect(xp).toBe(2); // base 1 + field bonus 1
  });

  it('does NOT add field bonus for <10 entries', () => {
    const xp = calculateGroomExperienceGain(4, 9, 'novice');
    expect(xp).toBe(1); // base 1 only
  });

  it('applies novice multiplier 1.0', () => {
    expect(calculateGroomExperienceGain(1, 5, 'novice')).toBe(4);
  });

  it('applies intermediate multiplier 0.8', () => {
    // (1 + 3) * 0.8 = 3.2 → rounded to 3
    expect(calculateGroomExperienceGain(1, 5, 'intermediate')).toBe(3);
  });

  it('applies expert multiplier 0.6', () => {
    // (1 + 3) * 0.6 = 2.4 → rounded to 2
    expect(calculateGroomExperienceGain(1, 5, 'expert')).toBe(2);
  });

  it('applies master multiplier 0.4', () => {
    // (1 + 3) * 0.4 = 1.6 → rounded to 2
    expect(calculateGroomExperienceGain(1, 5, 'master')).toBe(2);
  });

  it('defaults to 1.0 multiplier for unknown skill level', () => {
    expect(calculateGroomExperienceGain(4, 5, 'legendary')).toBe(1);
  });

  it('returns an integer (Math.round applied)', () => {
    const xp = calculateGroomExperienceGain(2, 5, 'intermediate');
    expect(Number.isInteger(xp)).toBe(true);
  });
});

// ── recordHandlerPerformance ─────────────────────────────────────────────────

describe('recordHandlerPerformance', () => {
  it('returns competitionResult unchanged when hasHandler=false', async () => {
    const result = { placement: 1, score: 95 };
    const returned = await recordHandlerPerformance(result, { hasHandler: false });
    expect(returned).toBe(result);
  });
});
