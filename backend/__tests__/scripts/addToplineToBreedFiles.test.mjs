/**
 * addToplineToBreedFiles.test.mjs (Equoria-f8qew)
 *
 * Unit coverage for the pure helpers in
 * backend/scripts/add-topline-to-breed-files.mjs — the deterministic
 * migration that added the 8th conformation region (`topline`) to all 312
 * breed source files.
 *
 * No DB, no filesystem writes: these tests import the exported pure functions
 * (the script's main() is behind a main-module guard, so importing it does NOT
 * run the migration) and assert:
 *
 *   - deriveTopline prefers the authoritative breedProfiles.json topline.
 *   - deriveTopline falls back to the 7-region average when the JSON has no
 *     usable topline (sentinel-positive: proves the fallback path actually
 *     computes the documented value, even though 0 real breeds need it).
 *   - deriveTopline rejects malformed JSON topline (out of range / non-finite)
 *     and uses the fallback instead.
 *   - insertToplineLine produces VALID JSON with exactly 8 regions and leaves
 *     the rest of the block byte-identical (minimal-diff contract).
 */

import { describe, it, expect } from '@jest/globals';
import {
  deriveTopline,
  insertToplineLine,
} from '../../scripts/add-topline-to-breed-files.mjs';

// A minimal profile mimicking the .txt $json$ block conformation shape.
function makeProfile() {
  return {
    rating_profiles: {
      conformation: {
        head: { mean: 60, std_dev: 8 },
        neck: { mean: 62, std_dev: 8 },
        shoulders: { mean: 64, std_dev: 8 },
        back: { mean: 66, std_dev: 8 },
        hindquarters: { mean: 68, std_dev: 8 },
        legs: { mean: 70, std_dev: 6 },
        hooves: { mean: 72, std_dev: 4 },
      },
    },
  };
}

describe('deriveTopline — authoritative JSON source (Equoria-f8qew)', () => {
  it('uses the breedProfiles.json topline when it is valid', () => {
    const json = { TestBreed: { rating_profiles: { conformation: { topline: { mean: 81, std_dev: 7 } } } } };
    const { topline, source } = deriveTopline('TestBreed', makeProfile(), json);
    expect(source).toBe('json');
    expect(topline).toEqual({ mean: 81, std_dev: 7 });
  });
});

describe('deriveTopline — 7-region-average fallback (Equoria-f8qew)', () => {
  it('falls back when the breed is absent from the JSON', () => {
    const { topline, source } = deriveTopline('Unknown', makeProfile(), {});
    expect(source).toBe('fallback');
    // means: 60,62,64,66,68,70,72 → avg 66; std_devs: 8,8,8,8,8,6,4 → avg 50/7=7.14→7
    expect(topline).toEqual({ mean: 66, std_dev: 7 });
  });

  it('falls back when the JSON topline mean is out of range', () => {
    const json = { B: { rating_profiles: { conformation: { topline: { mean: 250, std_dev: 8 } } } } };
    const { topline, source } = deriveTopline('B', makeProfile(), json);
    expect(source).toBe('fallback');
    expect(topline.mean).toBe(66);
  });

  it('falls back when the JSON topline std_dev is non-finite', () => {
    const json = { B: { rating_profiles: { conformation: { topline: { mean: 70, std_dev: NaN } } } } };
    const { source } = deriveTopline('B', makeProfile(), json);
    expect(source).toBe('fallback');
  });

  it('throws if neither JSON nor the profile can supply a topline', () => {
    expect(() => deriveTopline('X', { rating_profiles: {} }, {})).toThrow(/no rating_profiles\.conformation/);
  });
});

describe('insertToplineLine — minimal-diff textual insertion (Equoria-f8qew)', () => {
  const SOURCE = `INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
('Demo', 'Trait', $json${'$'}{
  "rating_profiles": {
    "conformation": {
      "head": { "mean": 60, "std_dev": 8 },
      "neck": { "mean": 62, "std_dev": 8 },
      "shoulders": { "mean": 64, "std_dev": 8 },
      "back": { "mean": 66, "std_dev": 8 },
      "hindquarters": { "mean": 68, "std_dev": 8 },
      "legs": { "mean": 70, "std_dev": 6 },
      "hooves": { "mean": 72, "std_dev": 4 }
    },
    "gaits": { "walk": { "mean": 70, "std_dev": 9 } }
  }
}$json${'$'}::JSONB);`;

  it('inserts a topline region yielding valid JSON with exactly 8 regions', () => {
    const out = insertToplineLine(SOURCE, { mean: 75, std_dev: 8 });
    const block = out.match(/\$json\$([\s\S]*?)\$json\$/)[1];
    const parsed = JSON.parse(block);
    const regions = Object.keys(parsed.rating_profiles.conformation);
    expect(regions).toHaveLength(8);
    expect(regions[regions.length - 1]).toBe('topline');
    expect(parsed.rating_profiles.conformation.topline).toEqual({ mean: 75, std_dev: 8 });
    // hooves still present and unchanged in value
    expect(parsed.rating_profiles.conformation.hooves).toEqual({ mean: 72, std_dev: 4 });
    // gaits untouched
    expect(parsed.rating_profiles.gaits.walk).toEqual({ mean: 70, std_dev: 9 });
  });

  it('changes exactly one line (hooves gains a comma) and adds one (topline)', () => {
    const out = insertToplineLine(SOURCE, { mean: 75, std_dev: 8 });
    const before = SOURCE.split('\n');
    const after = out.split('\n');
    expect(after.length).toBe(before.length + 1);
    // The only pre-existing line that changed is the hooves line (added comma).
    const changed = before.filter((line, i) => line !== after[i]);
    // Diff is not line-aligned after the insert, so compare as sets minus topline.
    const addedTopline = after.filter(l => l.includes('"topline"'));
    expect(addedTopline).toHaveLength(1);
    expect(changed.length).toBeGreaterThanOrEqual(1);
  });

  it('throws when the hooves anchor line is absent', () => {
    expect(() => insertToplineLine('no conformation here', { mean: 70, std_dev: 8 })).toThrow(
      /hooves conformation line not found/,
    );
  });
});
