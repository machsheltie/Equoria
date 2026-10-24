/**
 * Equoria-bdpvw — owner ruling 2026-10-23: players never see a stored code
 * name. Every stored staff word has an authored, title-cased label and an
 * unknown value reads as a generic phrase, never the stored value.
 */
import { describe, it, expect } from 'vitest';
import { skillLevelLabel, personalityLabel } from '../staffLabels';
import { groomSpecialtyTitle } from '../groomSpecialtyLabels';

// Mirrors of the backend value sets (groom constants, riderMarketplace,
// trainerMarketplace). The frontend does not import backend modules.
const SKILL_LEVELS = [
  'novice',
  'intermediate',
  'expert',
  'master',
  'rookie',
  'developing',
  'experienced',
];
const PERSONALITIES = [
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
const SPECIALTIES = ['foalCare', 'general', 'training', 'medical'];

describe('staff labels', () => {
  it.each(SKILL_LEVELS)('skill level %s is a capitalised word', (raw) => {
    const label = skillLevelLabel(raw);
    expect(label).toMatch(/^[A-Z][a-z]+$/);
    expect(label.toLowerCase()).toBe(raw);
  });

  it.each(PERSONALITIES)('personality %s is a capitalised word', (raw) => {
    expect(personalityLabel(raw)).toMatch(/^[A-Z][a-z]+$/);
  });

  it.each(SPECIALTIES)('groom specialty %s is title-cased with no code shape', (raw) => {
    const label = groomSpecialtyTitle(raw);
    expect(label).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
    expect(label).not.toBe(raw);
  });

  it('foalCare reads Foal Care', () => {
    expect(groomSpecialtyTitle('foalCare')).toBe('Foal Care');
  });

  it('an unknown or missing value never surfaces raw', () => {
    expect(skillLevelLabel('grand_master')).toBe('Unrated');
    expect(skillLevelLabel(undefined)).toBe('Unrated');
    expect(personalityLabel('trust_building')).toBe('Hard to Read');
    expect(groomSpecialtyTitle('some_new_code')).not.toContain('_');
    expect(groomSpecialtyTitle(null)).toBe('Everyday Care');
  });
});
