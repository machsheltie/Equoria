/**
 * Function-level lock-order sentinel for the sale reconciliation service
 * (Equoria-6p398.18).
 *
 * `txUserBeforeHorseLockOrder.sentinel.test.mjs` analyzes `$transaction( ... )`
 * blocks, so it cannot see a service that owns no transaction and runs on the `tx`
 * its caller opened. `horseTransferReconciliation.mjs` is exactly that: the buy
 * transaction calls `reconcileHorseOnTransfer(tx, ...)`, and the order of the User
 * and Horse writes INSIDE the service decides the lock-acquisition order of the
 * whole purchase (User row, then Horse row, then staff rows; see that sentinel for
 * why a source-order check is the honest instrument).
 *
 * This file brace-matches one named function and compares its first User write with
 * its first Horse write, and pins that `reconcileHorseOnTransfer` calls the User-first
 * tack return before its Horse-only steps. The detector-proof cases prove the
 * analyzer fires on a planted violation. The write patterns are the sibling
 * sentinel's, restated here in camelCase.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');

const prismaWrite = '(?:update|updateMany|create|createMany|delete|deleteMany|upsert)';

/** A write that takes an exclusive row lock on `User`. */
const userWrite = new RegExp(
  String.raw`\.user\.${prismaWrite}\s*\(` +
    String.raw`|\bdebitMoneyOrThrow\s*\(` +
    String.raw`|\bupdateUserSettingsPaths\s*\(` +
    String.raw`|UPDATE\s+"User"`,
  'g',
);

/** A write that takes an exclusive row lock on `Horse`. */
const horseWrite = new RegExp(
  String.raw`\.horse\.${prismaWrite}\s*\(` + String.raw`|UPDATE\s+"horses"` + String.raw`|\bapplyTackChange\s*\(`,
  'g',
);

function firstIndexOf(pattern, text) {
  const found = new RegExp(pattern.source, 'g').exec(text);
  return found === null ? -1 : found.index;
}

/**
 * @returns {{ found: boolean, hasUser: boolean, hasHorse: boolean, violation: boolean }}
 */
export function analyzeFunctionUserBeforeHorse(source, functionName) {
  const match = new RegExp(String.raw`function\s+${functionName}\s*\(`).exec(source);
  if (match === null) {
    return { found: false, hasUser: false, hasHorse: false, violation: false };
  }
  const braceStart = source.indexOf('{', source.indexOf(')', match.index));
  let depth = 0;
  let end = source.length;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(braceStart, end);
  const userAt = firstIndexOf(userWrite, body);
  const horseAt = firstIndexOf(horseWrite, body);
  return {
    found: true,
    hasUser: userAt !== -1,
    hasHorse: horseAt !== -1,
    violation: userAt !== -1 && horseAt !== -1 && horseAt < userAt,
  };
}

const reconciliationService = 'modules/marketplace/services/horseTransferReconciliation.mjs';

describe('SENTINEL: the sale reconciliation service keeps the lock order inside its own functions', () => {
  const source = readFileSync(resolve(backendRoot, reconciliationService), 'utf8');

  it('returnTackToSeller writes the seller User row before the Horse row', () => {
    const result = analyzeFunctionUserBeforeHorse(source, 'returnTackToSeller');
    // Non-vacuity: the function must still write both rows.
    expect(result.found).toBe(true);
    expect(result.hasUser).toBe(true);
    expect(result.hasHorse).toBe(true);
    expect(result.violation).toBe(false);
  });

  it('reconcileHorseOnTransfer runs the User-first tack return before every Horse-only step', () => {
    const body = source.slice(source.indexOf('export async function reconcileHorseOnTransfer'));
    const tackAt = body.indexOf('returnTackToSeller(');
    const staffAt = body.indexOf('reconcileStaffOnHorseTransfer(');
    const studAt = body.indexOf('clearStudListingOnTransfer(');
    expect(tackAt).toBeGreaterThan(-1);
    expect(staffAt).toBeGreaterThan(tackAt);
    expect(studAt).toBeGreaterThan(tackAt);
  });

  it('DETECTOR PROOF: the analyzer flags a planted Horse-before-User function', () => {
    const planted = `
      export async function plantedService(tx, { horseId, userId }) {
        await tx.horse.update({ where: { id: horseId }, data: { tack: {} } });
        await updateUserSettingsPaths(tx, userId, { set: { inventory: [] } });
      }
    `;
    expect(analyzeFunctionUserBeforeHorse(planted, 'plantedService').violation).toBe(true);
  });

  it('DETECTOR PROOF: the analyzer accepts the compliant order and reports a missing function', () => {
    const compliant = `
      export async function okService(tx, { horseId, userId }) {
        await updateUserSettingsPaths(tx, userId, { set: { inventory: [] } });
        await tx.horse.update({ where: { id: horseId }, data: { tack: {} } });
      }
    `;
    expect(analyzeFunctionUserBeforeHorse(compliant, 'okService').violation).toBe(false);
    expect(analyzeFunctionUserBeforeHorse(compliant, 'absent').found).toBe(false);
  });
});
