#!/usr/bin/env node
/**
 * add-topline-to-breed-files.mjs (Equoria-f8qew)
 *
 * One-shot, deterministic migration that adds the 8th conformation region
 * `topline` to every breed source file in backend/data/breeds/*.txt.
 *
 * WHY THIS EXISTS
 * ---------------
 * Each backend/data/breeds/<Breed>.txt is a SQL `INSERT ... ON CONFLICT`
 * whose `$json$...$json$` block carries the breed's full genetic profile,
 * including `rating_profiles.conformation`. Historically that conformation
 * object held only 7 regions (head/neck/shoulders/back/hindquarters/legs/
 * hooves). The conformation engine (backend/modules/horses/services/
 * conformationService.mjs) and the runtime validator
 * (backend/seed/breedProfileValidator.mjs) both require all 8 regions —
 * the 8th being `topline`.
 *
 * Until now the gap was papered over at runtime by a transitional merge in
 * breedProfileLoader.mjs that pulled `topline` from backend/data/
 * breedProfiles.json. This script closes the gap at the source so the
 * source files are self-sufficient and that merge can be deleted.
 *
 * TOPLINE DERIVATION (AC2 — principled, not fabricated)
 * -----------------------------------------------------
 *   1. PREFERRED / authoritative: backend/data/breedProfiles.json supplies a
 *      real per-breed `rating_profiles.conformation.topline` { mean, std_dev }
 *      for every one of the 312 breeds. That JSON topline is exactly the value
 *      breedProfileLoader.mjs already serves at runtime today via its
 *      transitional merge, so writing it into the .txt source makes the
 *      .txt -> DB -> runtime path behaviour-identical to the current merged
 *      output (a true no-op for live conformation generation).
 *   2. FALLBACK (documented, used only if a breed is absent from the JSON or
 *      its JSON topline is malformed): the arithmetic mean of the breed's own
 *      7 existing conformation region means, with std_dev = the rounded mean
 *      of the 7 existing std_devs. This keeps the 8th region internally
 *      consistent with that breed's real per-breed data rather than inventing
 *      an arbitrary number.
 *
 * As of the 2026-06 run, the JSON covers all 312 breeds with a valid topline,
 * so the fallback is exercised for ZERO breeds. The fallback path is retained
 * (and unit-tested) for robustness if the breed roster or JSON ever drifts.
 *
 * EDIT STRATEGY (minimal-diff textual insertion)
 * ----------------------------------------------
 * Re-serialising the whole JSON block would reformat every line and produce
 * an unreadable diff. Instead this script performs a surgical textual edit:
 * it finds the `"hooves": { ... }` line (verified to be the last conformation
 * region in all 312 files), gives it a trailing comma, and inserts a
 * `"topline": { "mean": M, "std_dev": S }` line immediately after, matching
 * the surrounding 6-space indentation. The rest of the file is byte-for-byte
 * untouched. After editing, the script re-parses the `$json$` block to prove
 * the result is still valid JSON with exactly 8 conformation regions.
 *
 * IDEMPOTENT: a file that already contains a `topline` region is skipped.
 *
 * Run: node backend/scripts/add-topline-to-breed-files.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BREEDS_DIR = resolve(__dirname, '../data/breeds');
const PROFILES_JSON = resolve(__dirname, '../data/breedProfiles.json');

// The 7 conformation regions that already exist in the source .txt files.
const EXISTING_REGIONS = [
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
];

/**
 * Extract the breed name from a breed .txt SQL INSERT.
 * Handles SQL apostrophe escaping ('' -> ') so "M''Bayar" -> "M'Bayar".
 * @param {string} txt - full file contents
 * @returns {string|null}
 */
function extractBreedName(txt) {
  const m = txt.match(/VALUES\s*\(\s*'((?:[^']|'')*)'/);
  if (!m) {
    return null;
  }
  return m[1].replace(/''/g, "'");
}

/**
 * Parse the breed JSON profile out of the $json$...$json$ delimited block.
 * @param {string} txt - full file contents
 * @returns {object|null}
 */
function parseProfileJson(txt) {
  const m = txt.match(/\$json\$([\s\S]*?)\$json\$/);
  if (!m) {
    return null;
  }
  return JSON.parse(m[1]);
}

/**
 * Derive the topline { mean, std_dev } for a breed.
 * Authoritative source: breedProfiles.json topline. Fallback: average of the
 * breed's own 7 existing conformation region means/std_devs.
 * @param {string} breedName
 * @param {object} profile - the parsed profile from the .txt file
 * @param {object} jsonProfiles - breedProfiles.json keyed by breed name
 * @returns {{ topline: {mean:number, std_dev:number}, source: 'json'|'fallback' }}
 */
export function deriveTopline(breedName, profile, jsonProfiles) {
  const jsonTopline = jsonProfiles?.[breedName]?.rating_profiles?.conformation?.topline;
  if (
    jsonTopline &&
    Number.isFinite(jsonTopline.mean) &&
    jsonTopline.mean >= 0 &&
    jsonTopline.mean <= 100 &&
    Number.isFinite(jsonTopline.std_dev) &&
    jsonTopline.std_dev >= 0
  ) {
    return {
      topline: { mean: jsonTopline.mean, std_dev: jsonTopline.std_dev },
      source: 'json',
    };
  }

  // Fallback: average the breed's own 7 region means and std_devs.
  const conformation = profile?.rating_profiles?.conformation;
  if (!conformation) {
    throw new Error(`Cannot derive topline for "${breedName}": no rating_profiles.conformation.`);
  }
  const means = [];
  const stdDevs = [];
  for (const region of EXISTING_REGIONS) {
    const r = conformation[region];
    if (!r || !Number.isFinite(r.mean) || !Number.isFinite(r.std_dev)) {
      throw new Error(
        `Cannot derive fallback topline for "${breedName}": region "${region}" is missing or malformed.`,
      );
    }
    means.push(r.mean);
    stdDevs.push(r.std_dev);
  }
  const meanAvg = Math.round(means.reduce((a, b) => a + b, 0) / means.length);
  const stdAvg = Math.round(stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length);
  return {
    topline: { mean: meanAvg, std_dev: stdAvg },
    source: 'fallback',
  };
}

/**
 * Insert a topline region line into the file text immediately after the
 * `"hooves": { ... }` conformation line, preserving all other formatting.
 * @param {string} txt - full file contents
 * @param {{mean:number, std_dev:number}} topline
 * @returns {string} edited contents
 */
export function insertToplineLine(txt, topline) {
  // Match the hooves region line (last region) and capture its leading indent.
  // It is followed (possibly with a trailing comma already? no — it is last)
  // by a newline and the conformation object's closing brace.
  const re = /^([ \t]*)"hooves":\s*\{[^}]*\}(,?)[ \t]*$/m;
  const m = txt.match(re);
  if (!m) {
    throw new Error('hooves conformation line not found — file structure unexpected.');
  }
  const indent = m[1];
  const hadComma = m[2] === ',';
  const hoovesLine = m[0];
  const toplineLine = `${indent}"topline": { "mean": ${topline.mean}, "std_dev": ${topline.std_dev} }`;
  // hooves must now end with a comma (it is no longer last); topline takes its
  // place as the trailing entry (no comma).
  const newHooves = hadComma ? hoovesLine : `${hoovesLine},`;
  return txt.replace(hoovesLine, `${newHooves}\n${toplineLine}`);
}

function main() {
  const jsonProfiles = JSON.parse(readFileSync(PROFILES_JSON, 'utf8'));
  const files = readdirSync(BREEDS_DIR)
    .filter(f => f.endsWith('.txt'))
    .sort();

  let edited = 0;
  let skipped = 0;
  const sourceCounts = { json: 0, fallback: 0 };
  const fallbackBreeds = [];

  for (const file of files) {
    const filePath = join(BREEDS_DIR, file);
    const original = readFileSync(filePath, 'utf8');

    const breedName = extractBreedName(original);
    if (!breedName) {
      throw new Error(`Could not extract breed name from ${file}.`);
    }

    const profile = parseProfileJson(original);
    if (!profile) {
      throw new Error(`Could not parse $json$ block in ${file}.`);
    }

    // Idempotent: skip files already carrying a topline region.
    if (profile.rating_profiles?.conformation?.topline) {
      skipped += 1;
      continue;
    }

    const { topline, source } = deriveTopline(breedName, profile, jsonProfiles);
    const updated = insertToplineLine(original, topline);

    // Prove the edit yields valid JSON with exactly 8 conformation regions.
    const reparsed = parseProfileJson(updated);
    const regions = Object.keys(reparsed.rating_profiles.conformation);
    if (regions.length !== 8 || !regions.includes('topline')) {
      throw new Error(
        `Post-edit validation failed for ${file}: conformation has ${regions.length} regions (${regions.join(', ')}).`,
      );
    }
    const tl = reparsed.rating_profiles.conformation.topline;
    if (
      !Number.isFinite(tl.mean) ||
      tl.mean < 0 ||
      tl.mean > 100 ||
      !Number.isFinite(tl.std_dev) ||
      tl.std_dev < 0
    ) {
      throw new Error(`Post-edit topline for ${file} is out of range: ${JSON.stringify(tl)}.`);
    }

    writeFileSync(filePath, updated, 'utf8');
    edited += 1;
    sourceCounts[source] += 1;
    if (source === 'fallback') {
      fallbackBreeds.push(breedName);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[add-topline] files: ${files.length}; edited: ${edited}; skipped (already had topline): ${skipped}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[add-topline] topline source — json (authoritative): ${sourceCounts.json}; fallback (7-region average): ${sourceCounts.fallback}`,
  );
  if (fallbackBreeds.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[add-topline] fallback breeds: ${fallbackBreeds.join(', ')}`);
  }
}

// Equoria-f8qew / CONTRIBUTING.md "main-module guard": main() WRITES the 312
// breed source files. It must NOT run on bare import (e.g. a parse-check
// `node -e "import('./add-topline-to-breed-files.mjs')"` or when the unit
// test imports deriveTopline/insertToplineLine). Use fileURLToPath, NOT
// string concatenation (broken on Windows — see CONTRIBUTING.md Equoria-ur0y8).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
