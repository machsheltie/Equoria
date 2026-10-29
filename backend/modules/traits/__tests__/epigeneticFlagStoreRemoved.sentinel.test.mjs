/**
 * The old epigeneticFlags store is gone (Equoria-efs4j).
 *
 * Owner ruling 2026-10-29 (q300): remove every remaining reader of
 * Horse.epigeneticFlags (the rider-flag show factor, flag-based groom
 * compatibility, temperament analysis, foal milestones, the flag screens) and
 * drop the column. Nothing had written it since the flag engine went
 * (Equoria-1vep2), so real horses held an empty list and score exactly as before;
 * the owning tests (show scoring, groom compatibility, temperament analysis, foal
 * milestones) prove that, and retiredTraitAdviceRoutes pins the two removed routes.
 *
 * This sentinel pins the removal itself: the schema no longer declares the column
 * or its index, one migration drops it, and no production backend file reads it
 * (a property read, a Prisma select/where key, or a quoted SQL column). The
 * scanner is proven live by a planted reader.
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const repoRoot = resolve(backendRoot, '..');
const schemaPath = join(repoRoot, 'packages/database/prisma/schema.prisma');
const migrationPath = join(
  repoRoot,
  'packages/database/prisma/migrations/20261031010000_drop_epigenetic_flags/migration.sql',
);

// A read of the stored column: horse.epigeneticFlags, { epigeneticFlags: true },
// or "epigeneticFlags" in SQL. breedingPredictionService builds its own local
// summary object named epigeneticFlags from epigeneticModifiers; a local name is
// not a read of the column, so declarations and shorthand keys do not match.
const storeRead = /\.epigeneticFlags\b|\bepigeneticFlags\s*:\s*(?:true|\{)|"epigeneticFlags"/;

function productionFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '__tests__', 'tests', 'coverage'].includes(entry.name)) {
          stack.push(full);
        }
      } else if (entry.name.endsWith('.mjs') && !/\.(test|spec)\.mjs$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

// Comments may name the store (history); only code lines count.
function codeLines(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'));
}

function readersUnder(rootDir) {
  return productionFiles(rootDir).filter(file => codeLines(readFileSync(file, 'utf8')).some(l => storeRead.test(l)));
}

function horseModel() {
  const schema = readFileSync(schemaPath, 'utf8');
  const start = schema.indexOf('model Horse {');
  const end = schema.indexOf('\n}\n', start);
  expect(start).toBeGreaterThan(-1);
  return schema.slice(start, end);
}

describe('the epigeneticFlags store is removed (Equoria-efs4j)', () => {
  it('the Horse model declares neither the column nor its GIN index', () => {
    const model = horseModel();
    expect(model).not.toMatch(/^\s*epigeneticFlags\s/m);
    expect(model).not.toMatch(/@@index\(\[epigeneticFlags/);
  });

  it('one migration drops the column and its index', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/ALTER TABLE "horses" DROP COLUMN IF EXISTS "epigeneticFlags";/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS "idx_horses_epigenetic_flags_gin";/);
  });

  it('no production backend file reads the column', () => {
    expect(readersUnder(backendRoot)).toEqual([]);
  });

  it('the deleted reader modules stay deleted', () => {
    for (const rel of [
      'utils/riderFlagCompatibility.mjs',
      'modules/traits/services/traitInteractionMatrix.mjs',
      'modules/traits/services/traitInteractionRules.mjs',
    ]) {
      expect(existsSync(join(backendRoot, rel))).toBe(false);
    }
  });

  it('SENTINEL-POSITIVE: the scan finds a planted reader of each shape', () => {
    const root = mkdtempSync(join(tmpdir(), 'efs4j-reader-'));
    try {
      writeFileSync(join(root, 'propertyRead.mjs'), 'export const n = horse => horse.epigeneticFlags.length;\n');
      writeFileSync(join(root, 'selectRead.mjs'), 'export const select = { id: true, epigeneticFlags: true };\n');
      writeFileSync(join(root, 'sqlRead.mjs'), 'export const sql = \'SELECT "epigeneticFlags" FROM horses\';\n');
      writeFileSync(
        join(root, 'localSummary.mjs'),
        'const epigeneticFlags = {};\nexport default { epigeneticFlags };\n',
      );
      writeFileSync(join(root, 'comment.mjs'), '// horse.epigeneticFlags was dropped\nexport const x = 1;\n');
      const found = readersUnder(root)
        .map(f => f.slice(root.length + 1))
        .sort();
      expect(found).toEqual(['propertyRead.mjs', 'selectRead.mjs', 'sqlRead.mjs']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
