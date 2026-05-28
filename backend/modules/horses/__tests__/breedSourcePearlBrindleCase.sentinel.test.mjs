/**
 * Breed source Pearl/Brindle allele-case sentinel (Equoria-je1q0)
 *
 * The phenotype engine (phenotypeCalculationService.mjs) reads the
 * Prl_Pearl and BR1_Brindle1 loci with LOWERCASE allele tokens:
 *   - isPearlHomozygous(prl)   → prl === 'prl/prl'
 *   - isPseudoDoubleDilute(prl)→ prl === 'prl/n' || prl === 'n/prl'
 *   - brindle active           → genotype.BR1_Brindle1 !== 'n/n'
 *
 * The canonical breed source files (samples/Breeds/*.txt) historically
 * stored these allele VALUES in mixed/upper case ("N/N", "N/Prl",
 * "Prl/Prl", "BR1/N", ...). An uppercase token never matches the engine's
 * lowercase comparisons, so Pearl/Brindle phenotypes silently never fire
 * for any horse seeded from those profiles. Equoria-je1q0 normalized the
 * source files to lowercase.
 *
 * This sentinel re-parses every Prl_Pearl / BR1_Brindle1 block in every
 * breed source file (single-line AND multi-line, both the allele-list
 * shape `[ "n/n", ... ]` and the probability-map shape `{ "n/n": 1.0 }`)
 * and asserts EVERY allele VALUE token is fully lowercase. It also asserts
 * the MFSD12_Mushroom locus is LEFT uppercase ('N/N'), because the engine
 * defaults Mushroom to uppercase and detects it via 'M/N' / 'M/M' — so a
 * blanket lowercasing of that locus would be a regression.
 *
 * Sentinel-positive: the test below plants an uppercase token in a synthetic
 * block and confirms the same scanner flags it — proving the check fires on
 * a real violation rather than passing vacuously.
 *
 * No mocks — pure filesystem read of real source data.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Equoria-dsd2a: c12c53c72 (Equoria-26qjf.3) relocated the 312 breed SQL
// profile files samples/Breeds/*.txt -> backend/data/breeds/*.txt to
// co-locate operational seed data with backend/data/breedProfiles.json.
// The sentinel now scans the new canonical location.
const BREEDS_DIR = resolve(__dirname, '../../../data/breeds');

const PRL_BR1_KEY = /"(Prl_Pearl|BR1_Brindle1)"\s*:/g;
const MUSHROOM_KEY = /"MFSD12_Mushroom"\s*:/g;
const ALLELE_PAIR = /"([A-Za-z0-9]+\/[A-Za-z0-9]+)"/g;

/**
 * Block-aware extraction: given source text and a key-regex, return every
 * quoted allele-pair token found INSIDE the bracketed value (`[...]` or
 * `{...}`) that immediately follows each matched key. Tracks bracket depth
 * so multi-line blocks are captured correctly and sibling loci are excluded.
 *
 * @param {string} src
 * @param {RegExp} keyRe - global regex matching the locus key
 * @returns {string[]} allele tokens (e.g. "n/n", "N/Prl")
 */
function extractAlleleTokens(src, keyRe) {
  const tokens = [];
  keyRe.lastIndex = 0;
  let m;
  while ((m = keyRe.exec(src)) !== null) {
    let j = m.index + m[0].length;
    while (j < src.length && /\s/.test(src[j])) {
      j += 1;
    }
    const open = src[j];
    if (open !== '[' && open !== '{') {
      continue; // bare value — no block
    }
    let depth = 0;
    let k = j;
    while (k < src.length) {
      const c = src[k];
      if (c === '[' || c === '{') {
        depth += 1;
      } else if (c === ']' || c === '}') {
        depth -= 1;
        if (depth === 0) {
          k += 1;
          break;
        }
      }
      k += 1;
    }
    const block = src.slice(j, k);
    let pm;
    ALLELE_PAIR.lastIndex = 0;
    while ((pm = ALLELE_PAIR.exec(block)) !== null) {
      tokens.push(pm[1]);
    }
  }
  return tokens;
}

const breedFiles = readdirSync(BREEDS_DIR).filter(f => f.endsWith('.txt'));

describe('breed source Pearl/Brindle allele-case sentinel (Equoria-je1q0)', () => {
  it('discovers the breed source files', () => {
    // Guard against a path/glob regression silently scanning zero files.
    expect(breedFiles.length).toBeGreaterThan(300);
  });

  it('every Prl_Pearl / BR1_Brindle1 allele VALUE token is lowercase across all breed files', () => {
    const offenders = [];
    for (const file of breedFiles) {
      const src = readFileSync(join(BREEDS_DIR, file), 'utf8');
      for (const tok of extractAlleleTokens(src, PRL_BR1_KEY)) {
        if (tok !== tok.toLowerCase()) {
          offenders.push(`${file}: "${tok}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('leaves MFSD12_Mushroom allele tokens UPPERCASE (engine defaults Mushroom to N/N)', () => {
    // The engine compares Mushroom against 'M/N'/'M/M' and defaults 'N/N'
    // uppercase. The normalizer must NOT have touched this locus.
    const lowercased = [];
    let sawAnyMushroomToken = false;
    for (const file of breedFiles) {
      const src = readFileSync(join(BREEDS_DIR, file), 'utf8');
      for (const tok of extractAlleleTokens(src, MUSHROOM_KEY)) {
        sawAnyMushroomToken = true;
        // Mushroom tokens use uppercase N and M; a fully-lowercase token
        // here would indicate the normalizer over-reached into this locus.
        if (tok === tok.toLowerCase() && /[a-z]/.test(tok)) {
          lowercased.push(`${file}: "${tok}"`);
        }
      }
    }
    expect(sawAnyMushroomToken).toBe(true);
    expect(lowercased).toEqual([]);
  });

  it('sentinel-positive: the scanner flags a planted uppercase token (non-vacuous)', () => {
    const planted = `{
      "Prl_Pearl": [
        "N/Prl",
        "n/n"
      ],
      "BR1_Brindle1": { "BR1/N": 0.5, "n/n": 0.5 }
    }`;
    const tokens = extractAlleleTokens(planted, PRL_BR1_KEY);
    const uppercase = tokens.filter(t => t !== t.toLowerCase());
    // Proves the check would catch real violations: N/Prl and BR1/N.
    expect(uppercase.sort()).toEqual(['BR1/N', 'N/Prl']);
  });
});
