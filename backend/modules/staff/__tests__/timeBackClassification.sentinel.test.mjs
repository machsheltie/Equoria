/**
 * Equoria-puj1e.5 (docs/features/admin-time-back.md, invariant 7): every
 * DateTime field in the schema is classified for outage time-back exactly once,
 * and nothing is classified that the schema no longer has. A new DateTime
 * column therefore cannot ship until someone decides whether an outage gives
 * its time back. Proven on a planted unclassified field.
 */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dateTimeClassification,
  neverMovedFields,
  pastEventFields,
  pendingDeadlineFields,
  unruledFields,
} from '../services/timeBackClassification.mjs';
import { movedFieldRules } from '../services/timeBackRules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(HERE, '..', '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

/** 'Model.field' for every DateTime / DateTime? field in a schema text. */
function dateTimeFields(schemaText) {
  const out = [];
  let model = null;
  for (const line of schemaText.replace(/\r/g, '').split('\n')) {
    const opened = line.match(/^model (\w+)\s*\{/);
    if (opened) {
      [, model] = opened;
    } else if (/^}/.test(line)) {
      model = null;
    } else if (model) {
      const field = line.match(/^\s+(\w+)\s+DateTime\??(\s|$)/);
      if (field) {
        out.push(`${model}.${field[1]}`);
      }
    }
  }
  return out;
}

/** The detector: unclassified schema fields and stale classifications. */
function classificationGaps(schemaText, classification = dateTimeClassification) {
  const fields = dateTimeFields(schemaText);
  return {
    unclassified: fields.filter(key => !Object.hasOwn(classification, key)),
    stale: Object.keys(classification).filter(key => !fields.includes(key)),
  };
}

const schemaText = readFileSync(schemaPath, 'utf8');

describe('outage time-back DateTime classification', () => {
  test('the live schema has DateTime fields to classify (not vacuous)', () => {
    expect(dateTimeFields(schemaText).length).toBeGreaterThan(100);
  });

  test('every DateTime field in the schema is classified, and nothing stale', () => {
    expect(classificationGaps(schemaText)).toEqual({ unclassified: [], stale: [] });
  });

  test('a planted unclassified DateTime field fails', () => {
    const planted = `${schemaText}\nmodel PlantedClock {\n  id Int @id\n  ticksAt DateTime?\n}\n`;
    expect(classificationGaps(planted).unclassified).toEqual(['PlantedClock.ticksAt']);
  });

  test('a classification the schema no longer has fails', () => {
    const removed = schemaText.replace(/^\s+lastShod\s+DateTime\?.*$/m, '');
    expect(classificationGaps(removed).stale).toEqual(['Horse.lastShod']);
  });

  test('no field sits in two lists', () => {
    const all = [...pastEventFields, ...pendingDeadlineFields, ...neverMovedFields, ...unruledFields];
    expect(all.length).toBe(new Set(all).size);
    expect(Object.keys(dateTimeClassification).length).toBe(all.length);
  });

  test('every moved field has exactly one rule, and every rule is a moved field', () => {
    const moved = [...pastEventFields, ...pendingDeadlineFields].sort();
    expect(movedFieldRules.map(rule => rule.key).sort()).toEqual(moved);
  });
});
