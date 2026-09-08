/**
 * Cross-module lock-order sentinel: inside one `$transaction`, a User row must
 * be written BEFORE a Horse row (Equoria-6p398.4 / Equoria-6p398.9).
 *
 * Why this exists. Every `UPDATE` takes a row write-lock held until commit, so
 * the order in which a transaction writes rows IS its lock-acquisition order.
 * Finding 4 rebuilt `buyHorse` around a guarded listing claim and, per the
 * project's lock-ordering ruling, moved its money moves ahead of the horse
 * transfer (User rows first, ascending id; Horse row second; staff rows last).
 * That made every remaining Horse-then-User transaction a deadlock partner:
 * `buyHorse` would hold `User(seller)` and wait for `Horse(H)` while a vet,
 * farrier or tack-shop purchase held `Horse(H)` and waited for `User(owner)` —
 * the exact cycle Postgres resolves by killing one transaction with 40P01.
 * vetController, farrierController and tackShopController were flipped to
 * User-first in the same change; this sentinel is what stops any of them (or
 * `buyHorse` itself) from silently flipping back.
 *
 * Why a source-order sentinel rather than a behavioural one. The invariant is
 * about lock ACQUISITION ORDER inside a transaction, which is not observable
 * from outside it: a correct implementation and a deadlock-prone one produce
 * identical committed state. Proving it behaviourally means provoking a real
 * 40P01 — inherently nondeterministic, requiring several simultaneously held
 * transactions against a test pool of 3 connections, and green either way
 * (Postgres kills one side and the retry succeeds). A structural assertion is
 * the honest instrument here. It follows the established in-repo pattern
 * (`backend/modules/horses/__tests__/feedLostUpdateConcurrent.test.mjs`,
 * `backend/modules/marketplace/__tests__/buyStoreHorseAtomicity.sentinel.test.mjs`),
 * and — per CONTRIBUTING — it proves its own detector by running the analyzer
 * against a planted violation, so it cannot pass vacuously.
 *
 * The analyzer is structure-aware, not a flat regex: it brace/paren-matches each
 * `$transaction( … )` call and compares the position of the first User-row write
 * with the first Horse-row write inside that block only.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..');

const PRISMA_WRITE = '(?:update|updateMany|create|createMany|delete|deleteMany|upsert)';

/** A write that takes an exclusive row lock on `User`. */
const USER_WRITE = new RegExp(
  String.raw`\.user\.${PRISMA_WRITE}\s*\(` +
    // debitMoneyOrThrow's first statement is `client.user.updateMany(...)`.
    String.raw`|\bdebitMoneyOrThrow\s*\(`,
  'g',
);

/** A write that takes an exclusive row lock on `Horse`. */
const HORSE_WRITE = new RegExp(
  String.raw`\.horse\.${PRISMA_WRITE}\s*\(` +
    // Raw statements bypass the Prisma model API but take the same lock.
    String.raw`|UPDATE\s+"horses"`,
  'g',
);

/**
 * Paren-match every `$transaction( … )` call in `source`.
 *
 * @returns {{ start: number, end: number, body: string }[]}
 */
function transactionBlocks(source) {
  const blocks = [];
  const opener = /\$transaction\s*\(/g;
  let match;
  while ((match = opener.exec(source)) !== null) {
    let depth = 0;
    // Start on the '(' that `$transaction\s*\(` just consumed.
    for (let i = match.index + match[0].length - 1; i < source.length; i++) {
      const char = source[i];
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ start: match.index, end: i, body: source.slice(match.index, i) });
          break;
        }
      }
    }
  }
  return blocks;
}

function firstIndexOf(pattern, text) {
  const scoped = new RegExp(pattern.source, 'g');
  const found = scoped.exec(text);
  return found === null ? -1 : found.index;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * @returns {{ line: number, violation: boolean }[]} one entry per `$transaction`
 *   block that writes BOTH a User row and a Horse row.
 */
export function analyzeUserBeforeHorse(source) {
  return transactionBlocks(source)
    .map(block => {
      const userAt = firstIndexOf(USER_WRITE, block.body);
      const horseAt = firstIndexOf(HORSE_WRITE, block.body);
      if (userAt === -1 || horseAt === -1) {
        return null;
      }
      return {
        line: lineOf(source, block.start),
        violation: horseAt < userAt,
      };
    })
    .filter(Boolean);
}

const GUARDED_FILES = [
  'modules/marketplace/controllers/marketplaceController.mjs',
  'modules/economy/vet/controllers/vetController.mjs',
  'modules/economy/farrier/controllers/farrierController.mjs',
  'modules/economy/tackShop/controllers/tackShopController.mjs',
];

describe('SENTINEL: User rows are locked before Horse rows inside a transaction', () => {
  it.each(GUARDED_FILES)('%s writes the User row before the Horse row', relativePath => {
    const source = readFileSync(resolve(BACKEND_ROOT, relativePath), 'utf8');
    const mixedBlocks = analyzeUserBeforeHorse(source);

    // Non-vacuity: each guarded file must still HAVE a transaction that writes
    // both kinds of row. If a refactor removes it, this sentinel must go red
    // and be re-aimed rather than quietly protecting nothing.
    expect(mixedBlocks.length).toBeGreaterThan(0);

    const offenders = mixedBlocks.filter(block => block.violation).map(block => block.line);
    expect(offenders).toEqual([]);
  });

  it('DETECTOR PROOF: the analyzer flags a planted Horse-before-User transaction', () => {
    const planted = `
      await prisma.$transaction(async tx => {
        const horseRow = await tx.horse.update({ where: { id: horseId }, data });
        await debitMoneyOrThrow(tx, { userId, amount: 10 });
        return horseRow;
      });
    `;
    const result = analyzeUserBeforeHorse(planted);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(true);
  });

  it('DETECTOR PROOF: the analyzer accepts the compliant order', () => {
    const compliant = `
      await prisma.$transaction(async tx => {
        await debitMoneyOrThrow(tx, { userId, amount: 10 });
        return tx.horse.update({ where: { id: horseId }, data });
      });
    `;
    const result = analyzeUserBeforeHorse(compliant);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(false);
  });

  it('DETECTOR PROOF: a raw UPDATE on horses counts as a Horse write', () => {
    const planted = `
      await prisma.$transaction(async tx => {
        await tx.$executeRaw(Prisma.sql\`UPDATE "horses" SET "bondScore" = 1 WHERE "id" = \${id}\`);
        await tx.user.update({ where: { id: userId }, data: { money: { decrement: 5 } } });
      });
    `;
    const result = analyzeUserBeforeHorse(planted);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(true);
  });

  it('ignores a transaction that touches only one of the two tables', () => {
    const horseOnly = `
      await prisma.$transaction(async tx => {
        await tx.horse.update({ where: { id: horseId }, data });
        await tx.horse.updateMany({ where: { damId: horseId }, data });
      });
    `;
    expect(analyzeUserBeforeHorse(horseOnly)).toHaveLength(0);
  });
});
