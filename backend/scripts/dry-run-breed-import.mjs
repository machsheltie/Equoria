/**
 * dry-run-breed-import.mjs (Equoria-mxhpi)
 *
 * READ-ONLY dry-run of the breed SQL profile import. Parses every
 * samples/Breeds/*.txt file, validates structure, and reports what the
 * actual import would do — WITHOUT writing to the database.
 *
 * No INSERT/UPDATE/DELETE. Only SELECT against the breeds table to
 * categorize files as "would INSERT (new)" vs "would UPDATE (existing)".
 *
 * Usage: node backend/scripts/dry-run-breed-import.mjs
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Equoria-26qjf.3 (2026-05-28): canonical location is backend/data/breeds/.
const SAMPLES_DIR = join(__dirname, '..', 'data', 'breeds');
// Same skip list as the real importer (defence in depth — keeps the dry-run
// honest if a meta/registry file ever gets dropped into the data dir).
const SKIP_FILES = new Set(['generichorse.txt', '_breed-list.txt', '_gait-registry.txt']);

const REQUIRED_TOP_LEVEL = [
  'allowed_alleles',
  'allele_weights',
  'marking_bias',
  'shade_bias',
  'rating_profiles',
  'temperament_weights',
];

// Loci the genotype/phenotype services expect — must appear in allele_weights.
const REQUIRED_LOCI = [
  'E_Extension',
  'A_Agouti',
  'Cr_Cream',
  'D_Dun',
  'Z_Silver',
  'Ch_Champagne',
  'G_Gray',
  'Rn_Roan',
  'W_DominantWhite',
  'TO_Tobiano',
  'O_FrameOvero',
  'SB1_Sabino1',
  'SW_SplashWhite',
  'LP_LeopardComplex',
  'PATN1_Pattern1',
  'EDXW',
  'MFSD12_Mushroom',
  'Prl_Pearl',
  'BR1_Brindle1',
];

function extractName(sql) {
  // Match a single-quoted SQL string literal that allows doubled '' as an
  // escaped apostrophe (so M''Par → M'Par). Then unescape '' back to '.
  const m = sql.match(/INSERT INTO breeds \([^)]*\) VALUES\s*\(\s*'((?:''|[^'])+)'/i);
  return m ? m[1].replace(/''/g, "'") : null;
}

function extractProfile(sql) {
  const m = sql.match(/\$json\$([\s\S]*?)\$json\$/);
  if (!m) {
    return { error: 'no $json$...$json$ block found' };
  }
  try {
    return { value: JSON.parse(m[1]) };
  } catch (e) {
    return { error: `JSON.parse: ${e.message}` };
  }
}

function validateProfileShape(profile) {
  const warnings = [];
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in profile)) {
      warnings.push(`missing top-level "${key}"`);
    }
  }
  if (profile.allele_weights && typeof profile.allele_weights === 'object') {
    for (const locus of REQUIRED_LOCI) {
      if (!(locus in profile.allele_weights)) {
        warnings.push(`allele_weights missing locus "${locus}"`);
      }
    }
  }
  return warnings;
}

async function main() {
  const files = (await readdir(SAMPLES_DIR))
    .filter(f => f.endsWith('.txt') && !SKIP_FILES.has(f))
    .sort();

  const existing = await prisma.breed.findMany({ select: { id: true, name: true } });
  const existingByName = new Map(existing.map(b => [b.name, b]));

  const stats = {
    totalFiles: files.length,
    skipFiles: [...SKIP_FILES],
    parsedOk: 0,
    parseErrors: [],
    missingName: [],
    duplicateNames: [],
    wouldInsert: [],
    wouldUpdate: [],
    noShadeBias: [],
    shadeBiasKeyCountDistribution: {},
    shadeBiasVocab: new Set(),
    structuralWarnings: [],
  };
  const seenNames = new Set();

  for (const file of files) {
    const sql = await readFile(join(SAMPLES_DIR, file), 'utf8');
    const name = extractName(sql);
    if (!name) {
      stats.missingName.push(file);
      continue;
    }
    if (seenNames.has(name)) {
      stats.duplicateNames.push({ file, name });
    }
    seenNames.add(name);

    const parsed = extractProfile(sql);
    if (parsed.error) {
      stats.parseErrors.push({ file, name, error: parsed.error });
      continue;
    }
    const profile = parsed.value;
    stats.parsedOk++;

    const warnings = validateProfileShape(profile);
    if (warnings.length > 0) {
      stats.structuralWarnings.push({ name, warnings });
    }

    if (!profile.shade_bias || typeof profile.shade_bias !== 'object') {
      stats.noShadeBias.push(name);
    } else {
      const keyCount = Object.keys(profile.shade_bias).length;
      stats.shadeBiasKeyCountDistribution[keyCount] =
        (stats.shadeBiasKeyCountDistribution[keyCount] || 0) + 1;
      for (const colorEntry of Object.values(profile.shade_bias)) {
        if (colorEntry && typeof colorEntry === 'object') {
          for (const shadeName of Object.keys(colorEntry)) {
            stats.shadeBiasVocab.add(shadeName);
          }
        }
      }
    }

    if (existingByName.has(name)) {
      stats.wouldUpdate.push({ name, existingId: existingByName.get(name).id });
    } else {
      stats.wouldInsert.push(name);
    }
  }

  console.log('=== Breed SQL Dry-Run (Equoria-mxhpi) ===\n');
  console.log(`Source: ${SAMPLES_DIR}`);
  console.log(`Total .txt files inspected (excl. skipped): ${stats.totalFiles}`);
  console.log(`Skipped: ${stats.skipFiles.join(', ')}`);
  console.log(`Parsed OK: ${stats.parsedOk}`);
  console.log(`Parse errors: ${stats.parseErrors.length}`);
  console.log(`Missing breed name in SQL: ${stats.missingName.length}`);
  console.log(`Duplicate breed names across files: ${stats.duplicateNames.length}`);
  console.log(`Files missing shade_bias: ${stats.noShadeBias.length}`);
  console.log(
    `Structural warnings (missing top-level keys or loci): ${stats.structuralWarnings.length}`,
  );
  console.log();
  console.log(`Would INSERT (new breeds): ${stats.wouldInsert.length}`);
  console.log(`Would UPDATE (existing breeds, profile overwrite): ${stats.wouldUpdate.length}`);
  console.log();
  console.log('shade_bias key-count distribution (colorNames per breed):');
  for (const [k, v] of Object.entries(stats.shadeBiasKeyCountDistribution).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    console.log(`  ${k} colors → ${v} breeds`);
  }
  console.log();
  console.log(
    `Unique shade vocabulary across all files (${stats.shadeBiasVocab.size} distinct values):`,
  );
  console.log(`  ${[...stats.shadeBiasVocab].sort().join(', ')}`);
  console.log();
  console.log('Sample of breeds that would UPDATE (existing by name):');
  for (const u of stats.wouldUpdate.slice(0, 20)) {
    console.log(`  - ${u.name} (id ${u.existingId})`);
  }
  if (stats.wouldUpdate.length > 20) {
    console.log(`  ... and ${stats.wouldUpdate.length - 20} more`);
  }
  console.log();
  if (stats.parseErrors.length > 0) {
    console.log('Parse errors:');
    for (const e of stats.parseErrors.slice(0, 10)) {
      console.log(`  ${e.file} [${e.name}]: ${e.error}`);
    }
    if (stats.parseErrors.length > 10) {
      console.log(`  ... and ${stats.parseErrors.length - 10} more`);
    }
  }
  if (stats.missingName.length > 0) {
    console.log('Files missing breed name (would not import):');
    for (const f of stats.missingName) {
      console.log(`  ${f}`);
    }
  }
  if (stats.duplicateNames.length > 0) {
    console.log('Duplicate breed names across files:');
    for (const d of stats.duplicateNames) {
      console.log(`  ${d.file} → "${d.name}"`);
    }
  }
  if (stats.noShadeBias.length > 0) {
    console.log(`Breeds with NO shade_bias (${stats.noShadeBias.length}):`);
    for (const n of stats.noShadeBias.slice(0, 20)) {
      console.log(`  - ${n}`);
    }
    if (stats.noShadeBias.length > 20) {
      console.log(`  ... and ${stats.noShadeBias.length - 20} more`);
    }
  }
  if (stats.structuralWarnings.length > 0) {
    console.log('\nFirst 5 structural warnings:');
    for (const w of stats.structuralWarnings.slice(0, 5)) {
      console.log(`  ${w.name}:`);
      for (const warn of w.warnings) {
        console.log(`    - ${warn}`);
      }
    }
    if (stats.structuralWarnings.length > 5) {
      console.log(`  ... and ${stats.structuralWarnings.length - 5} more warned breeds`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
