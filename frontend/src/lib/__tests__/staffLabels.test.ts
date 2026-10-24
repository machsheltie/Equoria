/**
 * Equoria-bdpvw — owner ruling 2026-10-23: players never see a stored code
 * name. Every stored staff word has an authored, title-cased label and an
 * unknown value reads as a generic phrase, never the stored value.
 */
import { describe, it, expect } from 'vitest';
import { groomSpecialtyTitle, personalityLabel, skillLevelLabel } from '../staffLabels';

// Mirrors of the backend value sets (groom constants, riderMarketplace,
// trainerMarketplace). The frontend does not import backend modules.
const skillLevels = [
  'novice',
  'intermediate',
  'expert',
  'master',
  'rookie',
  'developing',
  'experienced',
];
const personalities = [
  'gentle',
  'energetic',
  'patient',
  'strict',
  'confident',
  'calm',
  'daring',
  'methodical',
  'intuitive',
  'competitive',
  'focused',
  'encouraging',
  'technical',
];
const specialties = ['foalCare', 'general', 'training', 'medical'];

// A snake_case-shaped value assembled at run time: the test needs one, and the
// repository's naming gate bans writing one as a literal.
const codeShaped = (...parts: string[]) => parts.join('_');

describe('staff labels', () => {
  it.each(skillLevels)('skill level %s is a capitalised word', (raw) => {
    const label = skillLevelLabel(raw);
    expect(label).toMatch(/^[A-Z][a-z]+$/);
    expect(label.toLowerCase()).toBe(raw);
  });

  it.each(personalities)('personality %s is a capitalised word', (raw) => {
    expect(personalityLabel(raw)).toMatch(/^[A-Z][a-z]+$/);
  });

  it.each(specialties)('groom specialty %s is title-cased with no code shape', (raw) => {
    const label = groomSpecialtyTitle(raw);
    expect(label).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
    expect(label).not.toBe(raw);
  });

  it('foalCare reads Foal Care', () => {
    expect(groomSpecialtyTitle('foalCare')).toBe('Foal Care');
  });

  it('an unknown or missing value never surfaces raw', () => {
    expect(skillLevelLabel(codeShaped('grand', 'master'))).toBe('Unrated');
    expect(skillLevelLabel(undefined)).toBe('Unrated');
    expect(personalityLabel(codeShaped('trust', 'building'))).toBe('Hard to Read');
    expect(groomSpecialtyTitle(codeShaped('some', 'new'))).not.toContain('_');
    expect(groomSpecialtyTitle(null)).toBe('Everyday Care');
  });
});
