/**
 * deriveBreedTendencies — pure-function tests (Equoria-x83v4)
 *
 * No network, no MSW — exercises the real derivation logic directly against the
 * real `breedGeneticProfile.rating_profiles` shape the import produces. These
 * are sentinel-positive: they prove the derivation produces DIFFERENTIATED,
 * real-data-driven tendencies (the whole point of the issue) and that the
 * null/missing-data guards fall back honestly rather than fabricating.
 */

import { describe, it, expect } from 'vitest';
import { deriveBreedTendencies, type BreedGeneticProfile } from '../deriveBreedTendencies';

// A realistic draft-breed profile (Shire-like) — high conformation, low gallop.
const draftProfile: BreedGeneticProfile = {
  rating_profiles: {
    conformation: {
      head: { mean: 70, std_dev: 6 },
      neck: { mean: 72, std_dev: 6 },
      shoulders: { mean: 74, std_dev: 7 },
      back: { mean: 78, std_dev: 5 },
      hindquarters: { mean: 82, std_dev: 5 },
      legs: { mean: 80, std_dev: 6 },
      hooves: { mean: 80, std_dev: 6 },
      topline: { mean: 76, std_dev: 6 },
    },
    gaits: {
      walk: { mean: 70, std_dev: 8 },
      trot: { mean: 62, std_dev: 9 },
      canter: { mean: 58, std_dev: 9 },
      gallop: { mean: 50, std_dev: 9 },
      gaiting: null,
    },
  },
};

// A racing-type profile — high gallop, leaner conformation.
const racingProfile: BreedGeneticProfile = {
  rating_profiles: {
    conformation: {
      head: { mean: 78, std_dev: 5 },
      neck: { mean: 76, std_dev: 5 },
      shoulders: { mean: 80, std_dev: 5 },
      back: { mean: 72, std_dev: 6 },
      legs: { mean: 78, std_dev: 5 },
      hooves: { mean: 74, std_dev: 6 },
      topline: { mean: 75, std_dev: 5 },
    },
    gaits: {
      walk: { mean: 68, std_dev: 7 },
      trot: { mean: 74, std_dev: 7 },
      canter: { mean: 82, std_dev: 6 },
      gallop: { mean: 92, std_dev: 5 },
    },
  },
};

describe('deriveBreedTendencies — mapping from real rating_profiles', () => {
  it('maps each UI stat to its documented conformation/gait proxy', () => {
    const t = deriveBreedTendencies(draftProfile)!;
    expect(t).not.toBeNull();

    // speed ← gaits.gallop (50)
    expect(t.speed.avg).toBe(50);
    // stamina ← avg(trot 62, canter 58) = 60
    expect(t.stamina.avg).toBe(60);
    // agility ← avg(legs 80, hooves 80) = 80
    expect(t.agility.avg).toBe(80);
    // balance ← avg(back 78, topline 76) = 77
    expect(t.balance.avg).toBe(77);
    // precision ← avg(walk 70, shoulders 74) = 72
    expect(t.precision.avg).toBe(72);
    // boldness ← avg(head 70, neck 72) = 71
    expect(t.boldness.avg).toBe(71);
  });

  it('derives min/max from mean ± std_dev, clamped to 0–100', () => {
    const t = deriveBreedTendencies(draftProfile)!;
    // gallop 50 ± 9 → [41, 59]
    expect(t.speed.min).toBe(41);
    expect(t.speed.max).toBe(59);
    // agility: legs/hooves std 6 → 80 ± 6 → [74, 86]
    expect(t.agility.min).toBe(74);
    expect(t.agility.max).toBe(86);
  });

  it('produces DIFFERENT profiles for different breeds (the core requirement)', () => {
    const draft = deriveBreedTendencies(draftProfile)!;
    const racer = deriveBreedTendencies(racingProfile)!;
    // A racer is meaningfully faster than a draft horse — proves the derivation
    // is data-driven, not a constant.
    expect(racer.speed.avg).toBeGreaterThan(draft.speed.avg);
    expect(racer.speed.avg).toBe(92);
    expect(racer.stamina.avg).toBeGreaterThan(draft.stamina.avg);
  });

  it('does not produce all-equal (DEFAULT-like) tendencies for a real breed', () => {
    const t = deriveBreedTendencies(draftProfile)!;
    const avgs = [t.speed.avg, t.stamina.avg, t.agility.avg, t.balance.avg, t.precision.avg, t.boldness.avg];
    expect(new Set(avgs).size).toBeGreaterThan(1);
  });

  it('clamps a derived mean above 100 down to 100', () => {
    const t = deriveBreedTendencies({
      rating_profiles: { gaits: { gallop: { mean: 120, std_dev: 0 } } },
    })!;
    expect(t.speed.avg).toBe(100);
    expect(t.speed.max).toBe(100);
  });
});

describe('deriveBreedTendencies — honest fallback (returns null, never fabricates)', () => {
  it('returns null for null / undefined profile', () => {
    expect(deriveBreedTendencies(null)).toBeNull();
    expect(deriveBreedTendencies(undefined)).toBeNull();
  });

  it('returns null when rating_profiles is missing', () => {
    expect(deriveBreedTendencies({})).toBeNull();
    expect(deriveBreedTendencies({ rating_profiles: null })).toBeNull();
  });

  it('returns null when conformation and gaits are both absent', () => {
    expect(deriveBreedTendencies({ rating_profiles: {} })).toBeNull();
  });

  it('tolerates JSONB non-object shapes (array / primitive) without throwing', () => {
    // The import can in theory store malformed JSONB; the guard must not throw.
    expect(deriveBreedTendencies([] as unknown as BreedGeneticProfile)).toBeNull();
    expect(deriveBreedTendencies('oops' as unknown as BreedGeneticProfile)).toBeNull();
    expect(
      deriveBreedTendencies({ rating_profiles: [] as unknown as never })
    ).toBeNull();
  });

  it('falls back a stat with a missing proxy to the breed OWN average, not a global constant', () => {
    // Only gaits present (no conformation) — agility/balance/boldness proxies
    // are absent, so they should use this breed's own present-mean average,
    // never an injected 55.
    const t = deriveBreedTendencies({
      rating_profiles: {
        gaits: {
          walk: { mean: 60, std_dev: 5 },
          trot: { mean: 60, std_dev: 5 },
          canter: { mean: 60, std_dev: 5 },
          gallop: { mean: 60, std_dev: 5 },
        },
      },
    })!;
    expect(t).not.toBeNull();
    // present proxies (speed/stamina/precision) all derive to 60; the absent
    // ones (agility/balance/boldness) fall back to the breed's own avg = 60.
    expect(t.speed.avg).toBe(60);
    expect(t.agility.avg).toBe(60);
    expect(t.boldness.avg).toBe(60);
  });

  it('ignores a null gait cell (e.g. gaiting: null on non-gaited breeds)', () => {
    const t = deriveBreedTendencies(draftProfile)!;
    // gaiting is null and is not part of any mapping — derivation still works.
    expect(t.speed.avg).toBe(50);
  });
});
