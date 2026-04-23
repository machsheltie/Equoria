#!/usr/bin/env node
/**
 * Generate per-breed rating profiles (conformation, gaits, temperament)
 * for every breed in backend/data/breedStarterStats.json.
 *
 * Output: backend/data/breedProfiles.json — keyed by breed display name,
 * 309 entries, each with:
 *   - rating_profiles.conformation  (8 regions × { mean, std_dev })
 *   - rating_profiles.gaits         (walk/trot/canter/gallop/gaiting)
 *   - rating_profiles.is_gaited_breed
 *   - rating_profiles.gaited_gait_registry
 *   - temperament_weights           (11 types summing to 100)
 *   - category                      (draft|gaited|pony|sport|racing|general)
 *
 * The profile values come from category-level templates derived from
 * the 12 previously-hand-tuned canonical profiles. This file is meant to
 * be AUDITABLE and HAND-TUNED: the generator is deterministic, and any
 * breed that deserves finer-grained tuning can simply have its entry in
 * breedProfiles.json overwritten by hand — subsequent reruns of this
 * generator should be wired to preserve manual edits (not implemented
 * in this first pass; safe to rerun until manual tuning begins).
 *
 * Run:
 *   node backend/scripts/generateBreedProfiles.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  BREED_GENETIC_PROFILES,
  CANONICAL_BREEDS,
} from '../modules/horses/data/breedGeneticProfiles.mjs';

// Per-breed overrides inherited from the legacy 12 hand-tuned profiles.
// For these specific breeds, we preserve their curated conformation,
// gait, temperament weights, and gaited-gait registries EXACTLY. The
// category-template generator fills in only the other 300 breeds.
const LEGACY_OVERRIDES = {};
for (const b of CANONICAL_BREEDS) {
  const p = BREED_GENETIC_PROFILES[b.id];
  if (p) {
    LEGACY_OVERRIDES[b.name] = {
      rating_profiles: p.rating_profiles,
      temperament_weights: p.temperament_weights,
    };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATS_PATH = resolve(__dirname, '../data/breedStarterStats.json');
const OUT_PATH = resolve(__dirname, '../data/breedProfiles.json');

// ── Categorization ────────────────────────────────────────────────────
// Order matters: more-specific categories must be checked first.

const DRAFT_TOKENS = [
  'Draft',
  'Drum',
  'Percheron',
  'Shire',
  'Clydesdale',
  'Suffolk',
  'Belgian',
  'Ardennes',
  'Boulonnais',
  'Breton',
  'Brabant',
  'Comtois',
  'Dole Gudbrandsdal',
  'Dutch Heavy',
  'Finnhorse',
  'Gypsy',
  'Haflinger',
  'Irish Draught',
  'Jutland',
  'Latvian',
  'Lithuanian',
  'Murakoz',
  'Noriker',
  'North Swedish',
  'Polish Heavy',
  'Russian Heavy',
  'Schleswig',
  'Soviet Heavy',
  'Vladimir',
  'Italian Heavy',
  'Rhineland Heavy',
  'Fjord',
  'Cob',
];
const GAITED_TOKENS = [
  'Tennessee Walking',
  'Tennessee Walker',
  'American Saddlebred',
  'National Show Horse',
  'Paso Fino',
  'Peruvian Paso',
  'Icelandic',
  'Rocky Mountain',
  'Kentucky Mountain',
  'Missouri Fox Trotter',
  'Mangalarga',
  'Campolina',
  'Pampa',
  'Aegidienberger',
  'Spotted Saddle',
  'Racking',
  'Walkaloosa',
  'Mountain Pleasure',
  'Florida Cracker',
  'McCurdy Plantation',
  'Gaited',
  'Tolt',
  'Marwari',
  'Kathiawari',
  'Singlefoot',
  'Standardbred',
];
const PONY_TOKENS = [
  'Pony',
  'Shetland',
  'Welsh',
  'Hackney Pony',
  'Connemara',
  'Dartmoor',
  'Exmoor',
  'Highland',
  'New Forest',
  'Fell',
  'Haflinger',
  'Falabella',
  'Miniature',
];
const SPORT_TOKENS = [
  'Warmblood',
  'Oldenburg',
  'Holsteiner',
  'Hanoverian',
  'Trakehner',
  'KWPN',
  'Dutch Warmblood',
  'Westphalian',
  'Bavarian',
  'Selle Francais',
  'Swedish Warmblood',
  'Danish Warmblood',
  'Belgian Warmblood',
  'Rhinelander',
  'Wielkopolski',
  'Irish Sport',
  'Canadian Sport',
  'Hungarian Sport',
  'Zangersheide',
];
const RACING_TOKENS = ['Thoroughbred', 'Quarter Horse', 'Akhal-Teke', 'Barb'];

function classify(name) {
  const matchAny = tokens => tokens.some(t => name.toLowerCase().includes(t.toLowerCase()));
  if (matchAny(PONY_TOKENS)) return 'pony';
  if (matchAny(DRAFT_TOKENS)) return 'draft';
  if (matchAny(GAITED_TOKENS)) return 'gaited';
  if (matchAny(SPORT_TOKENS)) return 'sport';
  if (matchAny(RACING_TOKENS)) return 'racing';
  return 'general';
}

// ── Category templates ────────────────────────────────────────────────
// Means are baseline per category; std_dev is uniform per dimension.
// All conformation values use std_dev 8; all gait values use std_dev 9.
// Adjusted against the 12 existing canonical profiles so new breeds
// slot in cleanly next to hand-tuned ones.

const CONFORMATION_TEMPLATES = {
  general: {
    head: 70,
    neck: 70,
    shoulders: 70,
    back: 70,
    hindquarters: 70,
    legs: 70,
    hooves: 70,
    topline: 70,
  },
  racing: {
    head: 76,
    neck: 74,
    shoulders: 74,
    back: 68,
    hindquarters: 76,
    legs: 74,
    hooves: 70,
    topline: 72,
  },
  sport: {
    head: 78,
    neck: 78,
    shoulders: 80,
    back: 78,
    hindquarters: 80,
    legs: 78,
    hooves: 76,
    topline: 80,
  },
  draft: {
    head: 72,
    neck: 74,
    shoulders: 82,
    back: 78,
    hindquarters: 86,
    legs: 80,
    hooves: 76,
    topline: 78,
  },
  gaited: {
    head: 74,
    neck: 74,
    shoulders: 74,
    back: 76,
    hindquarters: 76,
    legs: 76,
    hooves: 76,
    topline: 76,
  },
  pony: {
    head: 68,
    neck: 66,
    shoulders: 66,
    back: 68,
    hindquarters: 68,
    legs: 70,
    hooves: 74,
    topline: 70,
  },
};

const GAIT_TEMPLATES = {
  general: { walk: 70, trot: 72, canter: 74, gallop: 75, gaiting: null },
  racing: { walk: 62, trot: 72, canter: 78, gallop: 90, gaiting: null },
  sport: { walk: 76, trot: 82, canter: 82, gallop: 78, gaiting: null },
  draft: { walk: 72, trot: 66, canter: 62, gallop: 56, gaiting: null },
  gaited: { walk: 78, trot: 72, canter: 70, gallop: 70, gaiting: 82 },
  pony: { walk: 72, trot: 72, canter: 70, gallop: 68, gaiting: null },
};

const TEMPERAMENT_TEMPLATES = {
  general: {
    Spirited: 10,
    Nervous: 8,
    Calm: 18,
    Bold: 10,
    Steady: 18,
    Independent: 8,
    Reactive: 8,
    Stubborn: 6,
    Playful: 8,
    Lazy: 4,
    Aggressive: 2,
  },
  racing: {
    Spirited: 28,
    Nervous: 14,
    Calm: 4,
    Bold: 16,
    Steady: 6,
    Independent: 6,
    Reactive: 14,
    Stubborn: 4,
    Playful: 5,
    Lazy: 2,
    Aggressive: 1,
  },
  sport: {
    Spirited: 14,
    Nervous: 6,
    Calm: 14,
    Bold: 18,
    Steady: 16,
    Independent: 6,
    Reactive: 6,
    Stubborn: 6,
    Playful: 10,
    Lazy: 2,
    Aggressive: 2,
  },
  draft: {
    Spirited: 4,
    Nervous: 2,
    Calm: 30,
    Bold: 8,
    Steady: 32,
    Independent: 4,
    Reactive: 2,
    Stubborn: 10,
    Playful: 4,
    Lazy: 2,
    Aggressive: 2,
  },
  gaited: {
    Spirited: 10,
    Nervous: 4,
    Calm: 22,
    Bold: 10,
    Steady: 22,
    Independent: 6,
    Reactive: 4,
    Stubborn: 8,
    Playful: 8,
    Lazy: 4,
    Aggressive: 2,
  },
  pony: {
    Spirited: 14,
    Nervous: 6,
    Calm: 14,
    Bold: 12,
    Steady: 10,
    Independent: 12,
    Reactive: 6,
    Stubborn: 16,
    Playful: 8,
    Lazy: 2,
    Aggressive: 0,
  },
};

// Sanity-check templates sum to 100.
for (const [cat, t] of Object.entries(TEMPERAMENT_TEMPLATES)) {
  const sum = Object.values(t).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    throw new Error(`Temperament template for ${cat} sums to ${sum}, expected 100`);
  }
}

// ── Profile builders ──────────────────────────────────────────────────

const CONFORMATION_REGIONS = [
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
  'topline',
];

function buildConformation(category) {
  const means = CONFORMATION_TEMPLATES[category];
  return Object.fromEntries(
    CONFORMATION_REGIONS.map(region => [region, { mean: means[region], std_dev: 8 }]),
  );
}

function buildGaits(category) {
  const means = GAIT_TEMPLATES[category];
  const gaits = {};
  for (const key of ['walk', 'trot', 'canter', 'gallop']) {
    gaits[key] = { mean: means[key], std_dev: 9 };
  }
  gaits.gaiting = means.gaiting === null ? null : { mean: means.gaiting, std_dev: 9 };
  return gaits;
}

function buildProfile(name) {
  const category = classify(name);

  // Legacy-12 overrides: preserve hand-tuned conformation/gait/temperament
  // exactly so the canonical Thoroughbred/Arabian/etc. profiles match
  // their historical statistical distributions (used by existing chi²
  // tests and by breeders who have been balancing against them).
  const override = LEGACY_OVERRIDES[name];
  if (override) {
    return {
      category,
      rating_profiles: override.rating_profiles,
      temperament_weights: override.temperament_weights,
    };
  }

  const isGaited = category === 'gaited';
  return {
    category,
    rating_profiles: {
      conformation: buildConformation(category),
      gaits: buildGaits(category),
      is_gaited_breed: isGaited,
      gaited_gait_registry: isGaited ? ['Tolt'] : null,
    },
    temperament_weights: { ...TEMPERAMENT_TEMPLATES[category] },
  };
}

// ── Generate ──────────────────────────────────────────────────────────

const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
const breedNames = Object.keys(stats).sort();

const profiles = {};
const counts = { general: 0, racing: 0, sport: 0, draft: 0, gaited: 0, pony: 0 };

for (const name of breedNames) {
  const profile = buildProfile(name);
  profiles[name] = profile;
  counts[profile.category] += 1;
}

writeFileSync(OUT_PATH, JSON.stringify(profiles, null, 2) + '\n', 'utf8');

console.log(`Wrote ${breedNames.length} breed profiles → ${OUT_PATH}`);
console.log('Category breakdown:');
for (const [cat, n] of Object.entries(counts)) {
  console.log(`  ${cat.padEnd(10)} ${n}`);
}
