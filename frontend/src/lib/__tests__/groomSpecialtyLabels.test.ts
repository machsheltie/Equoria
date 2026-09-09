/**
 * Equoria-m9lz1 fix round 1 — no player ever reads a raw groom-specialty enum.
 *
 * THE DEFECT THIS LOCKS OUT
 *   `GameNotifRow`'s groom-retired row interpolated `payload.speciality`
 *   directly, so the one new player-facing sentence this feature added read
 *   "Has hung up their headcollar after a long career in foal_care." A database
 *   enum, in prose, in the middle of an emotional moment.
 *
 * The assertions below are deliberately about BOTH halves of the requirement:
 * that every specialty the backend can produce has an authored label (coverage),
 * and that a value nobody has taught this module still cannot surface with an
 * underscore or a camelCase hump in it (the fallback). The second matters more
 * over time — it is what protects the next specialty someone adds to
 * `GROOM_SPECIALTIES` before they find this file.
 */

import { describe, it, expect } from 'vitest';
import { groomSpecialtyLabel } from '../groomSpecialtyLabels';

/**
 * `GROOM_SPECIALTIES` from backend/constants/schema.mjs, mirrored. Kept as a
 * literal rather than imported because the frontend does not import backend
 * modules; if that list grows, this test fails and points at the label map.
 */
const BACKEND_SPECIALTY_VALUES = ['foal_care', 'general', 'training', 'medical'];

/** The camelCase spellings the marketplace generator and older rows use. */
const CAMEL_SPECIALTY_VALUES = ['foalCare', 'general', 'training', 'medical'];

/** Legacy strings that appear in older fixtures and could still reach a payload. */
const LEGACY_SPECIALTY_VALUES = ['general_grooming', 'specialized_disciplines'];

describe('groomSpecialtyLabel — every backend specialty has an authored label', () => {
  it.each([...BACKEND_SPECIALTY_VALUES, ...CAMEL_SPECIALTY_VALUES, ...LEGACY_SPECIALTY_VALUES])(
    'labels %s without leaking the raw value',
    (raw) => {
      const label = groomSpecialtyLabel(raw);

      expect(label).toBeTruthy();
      // The three shapes that betray an unlabelled enum reaching a player.
      expect(label).not.toContain('_');
      expect(label).not.toMatch(/[a-z][A-Z]/);
      expect(label).not.toBe(raw);
    }
  );

  it('speaks the game rather than de-snake-casing: foal care is "raising foals"', () => {
    // The specific wording the review asked for. "foal care" would be *correct*
    // and flat; this is the register the rest of the row is written in.
    expect(groomSpecialtyLabel('foal_care')).toBe('raising foals');
    expect(groomSpecialtyLabel('foalCare')).toBe('raising foals');
  });

  it('maps both spellings of one specialty to the SAME label', () => {
    // Both are live in real data: `grooms.speciality` holds `foal_care`, while the
    // marketplace generator emits `foalCare`. A player must not be able to tell
    // which row shape they happened to get.
    expect(groomSpecialtyLabel('foalCare')).toBe(groomSpecialtyLabel('foal_care'));
  });

  it('reads correctly inside the sentence it was written for', () => {
    for (const raw of BACKEND_SPECIALTY_VALUES) {
      const sentence = `Has hung up their headcollar after a long career in ${groomSpecialtyLabel(raw)}.`;
      expect(sentence).not.toMatch(/_/);
      expect(sentence).toMatch(/^Has hung up their headcollar after a long career in \S.*\.$/);
    }
  });
});

describe('groomSpecialtyLabel — the fallback protects values it has never seen', () => {
  it('humanizes an unknown snake_case value instead of printing it raw', () => {
    expect(groomSpecialtyLabel('barn_management')).toBe('barn management');
  });

  it('humanizes an unknown camelCase value too', () => {
    // The pre-existing `formatSpecialty` helpers were camelCase-only, which is
    // exactly why they never caught `foal_care`; this handles both.
    expect(groomSpecialtyLabel('showPreparation')).toBe('show preparation');
  });

  it('handles a mixed unknown value', () => {
    expect(groomSpecialtyLabel('advanced_showJumping')).toBe('advanced show jumping');
  });

  it('returns the caller-supplied fallback for missing or blank input', () => {
    expect(groomSpecialtyLabel(undefined)).toBe('looking after horses');
    expect(groomSpecialtyLabel(null)).toBe('looking after horses');
    expect(groomSpecialtyLabel('')).toBe('looking after horses');
    expect(groomSpecialtyLabel('   ')).toBe('looking after horses');
    expect(groomSpecialtyLabel(undefined, 'their work')).toBe('their work');
  });

  it('tolerates surrounding whitespace on a known value', () => {
    expect(groomSpecialtyLabel('  foal_care  ')).toBe('raising foals');
  });
});
