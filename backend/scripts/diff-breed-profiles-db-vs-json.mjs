/**
 * diff-breed-profiles-db-vs-json.mjs (Equoria-ctop1 investigation)
 *
 * READ-ONLY diagnostic. Compares the JSON-shaped breed profiles in
 * backend/data/breedProfiles.json against the canonical-DB
 * `breeds.breedGeneticProfile` JSONB column, across the three fields the
 * no-preload test suite (backend/tests/setup.mjs:92-104) flagged as
 * divergent:
 *
 *   (a) rating_profiles.gaits ORDERING / contents
 *   (b) rating_profiles.gaited_gait_registry + is_gaited_breed
 *   (c) rating_profiles.conformation regions
 *
 * Plus temperament_weights as a bonus dimension.
 *
 * This script performs ONLY `SELECT` queries (pg client). It never writes,
 * never runs DDL, never mutates. It exists purely to characterise the
 * DB↔JSON divergence so the canonical-source decision can be made.
 *
 * Usage (from backend/):
 *   DATABASE_URL="postgresql://..." node scripts/diff-breed-profiles-db-vs-json.mjs
 *
 * Equoria-ctop1.
 */

import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROFILES_PATH = resolve(__dirname, '../data/breedProfiles.json');

// Representative breeds: the 12 canonical (id 1-12, asserted by the tests) +
// a spread of gaited breeds (registry divergence) + a few non-canonical.
const SAMPLE_BREEDS = [
  'Thoroughbred',
  'Arabian',
  'American Saddlebred',
  'National Show Horse',
  'Pony Of The Americas',
  'Appaloosa',
  'Tennessee Walking Horse',
  'Andalusian',
  'American Quarter Horse',
  'Walkaloosa',
  'Lusitano',
  'Paint Horse',
  'Aegidienberger',
  'Icelandic horse',
  'Marwari horse',
  'Abaga',
];

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
const GAIT_KEYS_ORDER = ['walk', 'trot', 'canter', 'gallop', 'gaiting'];

function shallowMeanStd(node) {
  // Normalize a {mean, std_dev} leaf into a compact comparable string.
  if (node === null || node === undefined) {
    return String(node);
  }
  if (typeof node !== 'object') {
    return JSON.stringify(node);
  }
  return `mean=${node.mean},std=${node.std_dev}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Refusing to run.');
    process.exit(1);
  }

  const json = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
  const jsonKeys = Object.keys(json);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // READ-ONLY: select only the two columns for the sample breeds.
  const { rows } = await client.query(
    'SELECT name, "breedGeneticProfile" AS profile FROM breeds WHERE name = ANY($1::text[])',
    [SAMPLE_BREEDS],
  );
  const dbByName = new Map(rows.map(r => [r.name, r.profile]));

  // Also a global tally: how many DB breeds vs JSON breeds, and how many DB
  // rows carry a usable rating_profiles object.
  const countRes = await client.query('SELECT COUNT(*)::int AS n FROM breeds');
  const ratingRes = await client.query(
    `SELECT COUNT(*)::int AS n FROM breeds
     WHERE "breedGeneticProfile" IS NOT NULL
       AND jsonb_typeof("breedGeneticProfile") = 'object'
       AND "breedGeneticProfile" ? 'rating_profiles'`,
  );

  console.log('=== GLOBAL COUNTS ===');
  console.log(`JSON breeds:                 ${jsonKeys.length}`);
  console.log(`DB breeds (total rows):      ${countRes.rows[0].n}`);
  console.log(`DB breeds w/ rating_profiles:${ratingRes.rows[0].n}`);
  console.log('');

  for (const name of SAMPLE_BREEDS) {
    const j = json[name];
    const d = dbByName.get(name);
    console.log(`\n##### ${name} #####`);
    if (!j) {
      console.log('  [JSON] MISSING from breedProfiles.json');
    }
    if (!d) {
      console.log('  [DB]   MISSING / null breedGeneticProfile');
    }
    if (!j || !d) {
      continue;
    }

    const jrp = j.rating_profiles ?? {};
    const drp = d && typeof d === 'object' && d.rating_profiles ? d.rating_profiles : {};

    // (a) GAITS — ordering + values
    const jGaitKeys = Object.keys(jrp.gaits ?? {});
    const dGaitKeys = Object.keys(drp.gaits ?? {});
    console.log('  --- (a) gaits ---');
    console.log(`    JSON key order: [${jGaitKeys.join(', ')}]`);
    console.log(`    DB   key order: [${dGaitKeys.join(', ')}]`);
    const orderMatch = JSON.stringify(jGaitKeys) === JSON.stringify(dGaitKeys);
    console.log(`    KEY-ORDER MATCH: ${orderMatch}`);
    // value diff across the canonical gait order
    const gaitValDiffs = [];
    for (const k of GAIT_KEYS_ORDER) {
      const jv = shallowMeanStd(jrp.gaits?.[k]);
      const dv = shallowMeanStd(drp.gaits?.[k]);
      if (jv !== dv) {
        gaitValDiffs.push(`${k}: JSON{${jv}} vs DB{${dv}}`);
      }
    }
    console.log(`    VALUE DIFFS: ${gaitValDiffs.length ? gaitValDiffs.join(' | ') : 'none'}`);

    // (b) gaited registry + is_gaited_breed
    console.log('  --- (b) gaited registry ---');
    console.log(
      `    JSON is_gaited_breed=${jrp.is_gaited_breed}  registry=${JSON.stringify(jrp.gaited_gait_registry)}`,
    );
    console.log(
      `    DB   is_gaited_breed=${drp.is_gaited_breed}  registry=${JSON.stringify(drp.gaited_gait_registry)}`,
    );
    const regMatch =
      jrp.is_gaited_breed === drp.is_gaited_breed &&
      JSON.stringify(jrp.gaited_gait_registry) === JSON.stringify(drp.gaited_gait_registry);
    console.log(`    REGISTRY MATCH: ${regMatch}`);

    // (c) conformation regions
    console.log('  --- (c) conformation ---');
    const jConf = jrp.conformation ?? {};
    const dConf = drp.conformation ?? {};
    const jConfKeys = Object.keys(jConf);
    const dConfKeys = Object.keys(dConf);
    console.log(`    JSON regions: [${jConfKeys.join(', ')}]`);
    console.log(`    DB   regions: [${dConfKeys.join(', ')}]`);
    const confValDiffs = [];
    for (const r of CONFORMATION_REGIONS) {
      const jv = shallowMeanStd(jConf[r]);
      const dv = shallowMeanStd(dConf[r]);
      if (jv !== dv) {
        confValDiffs.push(`${r}: JSON{${jv}} vs DB{${dv}}`);
      }
    }
    console.log(`    VALUE DIFFS: ${confValDiffs.length ? confValDiffs.join(' | ') : 'none'}`);

    // (bonus) temperament_weights
    const jt = j.temperament_weights ?? null;
    const dt = d && typeof d === 'object' ? (d.temperament_weights ?? null) : null;
    const tempMatch = JSON.stringify(jt) === JSON.stringify(dt);
    console.log('  --- (bonus) temperament_weights ---');
    console.log(`    MATCH: ${tempMatch}`);
    if (!tempMatch) {
      console.log(`      JSON: ${JSON.stringify(jt)}`);
      console.log(`      DB:   ${JSON.stringify(dt)}`);
    }

    // (bonus) color genetics presence (DB-only superset claim)
    const dbHasColor =
      d &&
      typeof d === 'object' &&
      ('shade_bias' in d || 'allele_weights' in d || 'marking_bias' in d);
    console.log(
      `  --- (bonus) DB color genetics present: ${dbHasColor} (JSON has shade_bias: ${'shade_bias' in (j ?? {})}) ---`,
    );
  }

  await client.end();
}

// Equoria-ctop1: main-module guard (CONTRIBUTING.md). This script issues DB
// SELECTs on import-as-entrypoint only — never on bare import. Read-only, but
// the guard keeps it side-effect-free when merely loaded (e.g. parse-check).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
