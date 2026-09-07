/**
 * Lock-order sentinel: inside one `$transaction`, EmailVerificationToken rows
 * must be written BEFORE the User row (Equoria-6p398.5).
 *
 * Why. Finding 5 made the password-rotation paths revoke pending
 * recovery-address changes, which gave `changePassword` / `resetPassword` a
 * write on BOTH tables for the first time. `confirmEmailChange` and
 * `verifyEmailToken` had always written token rows first and the User row
 * after. With the password paths writing User first, two concurrent
 * transactions on one account could deadlock — T1 holds User(u) and waits for
 * token X, T2 holds token X and waits for User(u) — and Postgres resolves that
 * with 40P01, which Prisma reports as P2034. `isRetryableTxError`
 * (utils/retryableTransaction.mjs) deliberately does not classify P2034, so the
 * losing side would surface as an opaque 500. The fix was to reorder rather
 * than to widen the retry classifier; this sentinel is what stops the order
 * from drifting back.
 *
 * The analyzer compares the LAST token write with the FIRST User write, so a
 * transaction counts as compliant only when EVERY token write precedes the User
 * write. See `analyzeTokenBeforeUser` for why first-vs-first is not enough.
 *
 * Structural, not behavioural, for the reason the sibling User-before-Horse
 * sentinel documents: lock ACQUISITION ORDER is not observable from outside a
 * transaction — a correct implementation and a deadlock-prone one commit
 * identical state, and provoking a real 40P01 is nondeterministic. Per
 * CONTRIBUTING the analyzer proves its own detector on planted code, so it
 * cannot pass vacuously.
 *
 * The `$transaction( … )` paren-matcher below is a deliberate copy of the one
 * in `txUserBeforeHorseLockOrder.sentinel.test.mjs`, not an import. Importing
 * it would execute that file's `describe` blocks here too, re-registering its
 * whole suite inside this one and conflating the two sentinels' results. If a
 * third lock-order sentinel ever appears, lift the parser into
 * `__tests__/helpers/` instead of adding a third copy.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..');

const PRISMA_WRITE = '(?:update|updateMany|create|createMany|delete|deleteMany|upsert)';

/** A write that takes an exclusive row lock on `email_verification_tokens`. */
const TOKEN_WRITE = new RegExp(
  String.raw`\.emailVerificationToken\.${PRISMA_WRITE}\s*\(` +
    // The shared revocation helper's only statement is an updateMany on that table.
    String.raw`|\brevokePendingEmailChanges\s*\(` +
    String.raw`|UPDATE\s+email_verification_tokens`,
  'g',
);

/** A write that takes an exclusive row lock on `User`. Reads are excluded. */
const USER_WRITE = new RegExp(String.raw`\.user\.${PRISMA_WRITE}\s*\(` + String.raw`|UPDATE\s+"users"`, 'g');

/**
 * Paren-match every `$transaction( … )` call in `source`.
 *
 * @returns {{ start: number, body: string }[]}
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
          blocks.push({ start: match.index, body: source.slice(match.index, i) });
          break;
        }
      }
    }
  }
  return blocks;
}

function firstIndexOf(pattern, text) {
  const found = new RegExp(pattern.source, 'g').exec(text);
  return found === null ? -1 : found.index;
}

function lastIndexOf(pattern, text) {
  const scoped = new RegExp(pattern.source, 'g');
  let index = -1;
  let found;
  while ((found = scoped.exec(text)) !== null) {
    index = found.index;
  }
  return index;
}

/**
 * Compare the LAST token write with the FIRST User write, not first with first.
 *
 * A transaction may touch the token table more than once, and the shape this
 * sentinel exists to catch did exactly that: `confirmEmailChange` before the
 * fix ran the guarded token claim, then the User update, then a second token
 * revocation. First-vs-first calls that compliant — a token write does come
 * first — while the trailing token write is precisely the lock taken after the
 * User lock, which is the deadlock edge. A transaction is safe only when EVERY
 * token write precedes the first User write.
 *
 * @returns {{ line: number, violation: boolean }[]} one entry per `$transaction`
 *   block that writes BOTH a token row and the User row.
 */
export function analyzeTokenBeforeUser(source) {
  return transactionBlocks(source)
    .map(block => {
      const lastTokenAt = lastIndexOf(TOKEN_WRITE, block.body);
      const firstUserAt = firstIndexOf(USER_WRITE, block.body);
      if (lastTokenAt === -1 || firstUserAt === -1) {
        return null;
      }
      return {
        line: source.slice(0, block.start).split('\n').length,
        violation: firstUserAt < lastTokenAt,
      };
    })
    .filter(Boolean);
}

const GUARDED_FILES = [
  'modules/auth/controllers/passwordController.mjs',
  'modules/auth/services/emailChangeService.mjs',
  'utils/emailVerificationService.mjs',
];

describe('SENTINEL: token rows are locked before the User row inside a transaction', () => {
  it.each(GUARDED_FILES)('%s writes token rows before the User row', relativePath => {
    const source = readFileSync(resolve(BACKEND_ROOT, relativePath), 'utf8');
    const mixedBlocks = analyzeTokenBeforeUser(source);

    // Non-vacuity: each guarded file must still HAVE a transaction touching
    // both tables. If a refactor removes it, this sentinel must go red and be
    // re-aimed rather than quietly protecting nothing.
    expect(mixedBlocks.length).toBeGreaterThan(0);

    expect(mixedBlocks.filter(block => block.violation).map(block => block.line)).toEqual([]);
  });

  it('DETECTOR PROOF: flags a planted User-before-token transaction', () => {
    const planted = `
      await prisma.$transaction(async tx => {
        await tx.user.update({ where: { id }, data: { password: hash } });
        await revokePendingEmailChanges(tx, id, email);
      });
    `;
    const result = analyzeTokenBeforeUser(planted);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(true);
  });

  it('DETECTOR PROOF: flags a token/User/token sandwich (the pre-fix confirmEmailChange shape)', () => {
    // A token write DOES come first here, so a first-vs-first analyzer would
    // call this compliant. The trailing revocation is the lock taken after the
    // User lock — the actual deadlock edge, and the exact shape this file's
    // own guarded `confirmEmailChange` had before Equoria-6p398.5 reordered it.
    const planted = `
      await prisma.$transaction(async tx => {
        await tx.emailVerificationToken.updateMany({ where: { tokenHash }, data: { usedAt: now } });
        const committed = await tx.user.update({ where: { id }, data: { email: destination } });
        await tx.emailVerificationToken.updateMany({ where: { userId }, data: { usedAt: now } });
        return committed;
      });
    `;
    const result = analyzeTokenBeforeUser(planted);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(true);
  });

  it('DETECTOR PROOF: accepts the compliant order', () => {
    const compliant = `
      await prisma.$transaction(async tx => {
        await tx.emailVerificationToken.updateMany({ where: { userId }, data: { usedAt: now } });
        await tx.user.update({ where: { id: userId }, data: { emailVerified: true } });
      });
    `;
    const result = analyzeTokenBeforeUser(compliant);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(false);
  });

  it('DETECTOR PROOF: a read of the User row does not count as a User write', () => {
    const readThenWrite = `
      await prisma.$transaction(async tx => {
        const owner = await tx.user.findUnique({ where: { id }, select: { email: true } });
        await revokePendingEmailChanges(tx, id, owner.email);
        await tx.user.update({ where: { id }, data: { password: hash } });
      });
    `;
    const result = analyzeTokenBeforeUser(readThenWrite);
    expect(result).toHaveLength(1);
    expect(result[0].violation).toBe(false);
  });

  it('ignores a transaction that touches only one of the two tables', () => {
    const tokensOnly = `
      await prisma.$transaction(async tx => {
        await revokePendingEmailChanges(tx, userId, email);
        await tx.emailVerificationToken.create({ data });
      });
    `;
    expect(analyzeTokenBeforeUser(tokensOnly)).toHaveLength(0);
  });
});
