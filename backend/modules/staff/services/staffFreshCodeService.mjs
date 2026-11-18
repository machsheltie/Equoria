/**
 * Fresh one-time codes for a single owner action (Equoria-puj1e.5, STAFF-CR-06,
 * owner ruling q378: "one fresh email code at the moment of apply, and again at
 * undo. Not at sign-in.").
 *
 * The proof the 30-day trusted browser cannot stand in for:
 * - purpose-bound: a code is issued for one action ('timeBackApply' or
 *   'timeBackUndo') and works for nothing else, the browser check-in included;
 * - one-time and short-lived: 10 minutes, five guesses, consumed atomically
 *   inside the action's own transaction (consumeFreshCodeTx), so it cannot be
 *   replayed and an action that fails leaves nothing changed;
 * - bound to the account's security state like every staff code: a password
 *   change, a verified-email change or a role change retires it
 *   (staffChallengeRetirement.mjs), and a code issued before such a change is
 *   void whatever its row says.
 *
 * Built on the check-in code table and its helpers; codes are never logged.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { sendStaffCheckinCodeEmail } from '../../../utils/emailService.mjs';
import { hasCapability } from '../capabilities.mjs';
import { retireStaffCheckinCodesTx } from './staffChallengeRetirement.mjs';
import {
  StaffCheckinError,
  checkinCodeTtlMs,
  checkinMaxAttempts,
  checkinRequestLimit,
  checkinRequestWindowMs,
  lockAccountTx,
  mayCheckIn,
  newestLiveCodeTx,
} from './staffCheckinService.mjs';

/** Each purpose, the capability it needs, and what the email calls it. */
const purposes = Object.freeze({
  timeBackApply: Object.freeze({ capability: 'time-back', action: 'give outage time back' }),
  timeBackUndo: Object.freeze({ capability: 'time-back', action: 'undo an outage time-back' }),
});

export const freshCodePurposes = Object.freeze(Object.keys(purposes));

const codeHashRounds = 10;

/** Whether the locked account may still use a code of this purpose. */
const mayUse = (account, purpose) =>
  mayCheckIn(account) && hasCapability(account.role, purposes[purpose]?.capability);

function assertPurpose(purpose) {
  if (!Object.hasOwn(purposes, purpose)) {
    throw new StaffCheckinError('codeInvalid');
  }
}

/**
 * Issue a fresh code for one action and email it. Issuing retires the older
 * live codes of the same purpose only; at most 3 per purpose per 15 minutes.
 * @param {{ id: string }} account
 * @param {string} purpose
 */
export async function requestFreshCode(account, purpose) {
  assertPurpose(purpose);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, codeHashRounds);

  const sendTo = await prisma.$transaction(async tx => {
    const fresh = await lockAccountTx(tx, account.id);
    if (!mayUse(fresh, purpose)) {
      throw new StaffCheckinError(
        fresh?.emailVerified === false ? 'emailUnverified' : 'codeInvalid',
      );
    }
    const now = new Date();
    const recent = await tx.staffCheckinCode.count({
      where: {
        userId: fresh.id,
        purpose,
        createdAt: { gt: new Date(now.getTime() - checkinRequestWindowMs) },
      },
    });
    if (recent >= checkinRequestLimit) {
      throw new StaffCheckinError('rateLimited');
    }
    await retireStaffCheckinCodesTx(tx, fresh.id, now, purpose);
    await tx.staffCheckinCode.create({
      data: {
        userId: fresh.id,
        codeHash,
        purpose,
        createdAt: now,
        expiresAt: new Date(now.getTime() + checkinCodeTtlMs),
      },
    });
    return fresh.email;
  });

  await sendStaffCheckinCodeEmail(sendTo, code, purposes[purpose].action);
}

/**
 * Check a typed code against the account's newest live code of `purpose`,
 * spending one of its five guesses. Does NOT consume it: the action does that
 * in its own transaction with consumeFreshCodeTx. Throws
 * StaffCheckinError('codeInvalid') on any refusal.
 * @returns {Promise<{ codeId: number, purpose: string }>}
 */
export async function checkFreshCode(account, purpose, code) {
  assertPurpose(purpose);
  const normalized = typeof code === 'string' ? code.trim() : '';
  const candidate = await prisma.$transaction(async tx => {
    const fresh = await lockAccountTx(tx, account.id);
    if (!mayUse(fresh, purpose)) {
      return null;
    }
    const newest = await newestLiveCodeTx(tx, fresh, new Date(), {
      requireAttemptLeft: true,
      purpose,
    });
    if (!newest) {
      return null;
    }
    const reserved = await tx.staffCheckinCode.updateMany({
      where: { id: newest.id, attempts: { lt: checkinMaxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return reserved.count === 1 ? newest : null;
  });
  if (!candidate) {
    throw new StaffCheckinError('codeInvalid');
  }
  const matches =
    /^\d{6}$/.test(normalized) && (await bcrypt.compare(normalized, candidate.codeHash));
  if (!matches) {
    throw new StaffCheckinError('codeInvalid');
  }
  return { codeId: candidate.id, purpose };
}

/**
 * Consume a checked code inside the action's transaction: the account is
 * re-read under its row lock, the code must still be its newest live code of
 * that purpose, and it is marked used exactly once. If the action then fails,
 * the transaction rolls the use back with everything else.
 * @param {object} tx
 * @param {{ id: string }} account
 * @param {{ codeId: number, purpose: string }} proof from checkFreshCode
 * @returns {Promise<object>} the fresh, locked account
 */
export async function consumeFreshCodeTx(tx, account, proof) {
  if (!proof || !Object.hasOwn(purposes, proof.purpose)) {
    throw new StaffCheckinError('codeInvalid');
  }
  const fresh = await lockAccountTx(tx, account.id);
  if (!mayUse(fresh, proof.purpose)) {
    throw new StaffCheckinError('codeInvalid');
  }
  const now = new Date();
  const newest = await newestLiveCodeTx(tx, fresh, now, {
    requireAttemptLeft: false,
    purpose: proof.purpose,
  });
  if (!newest || newest.id !== proof.codeId) {
    throw new StaffCheckinError('codeInvalid');
  }
  const consumed = await tx.staffCheckinCode.updateMany({
    where: { id: proof.codeId, purpose: proof.purpose, usedAt: null, retiredAt: null },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    throw new StaffCheckinError('codeInvalid');
  }
  return fresh;
}
