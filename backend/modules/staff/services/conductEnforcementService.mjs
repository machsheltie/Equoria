/**
 * Conduct enforcement (Equoria-w47x7, owner ruling q77)
 *
 * What a steward's warning, freeze or ban means at the door: a frozen or banned
 * account cannot sign in or act, and a banned IP or device cannot sign in or
 * sign up. Every refusal is an authored message with a machine code; a freeze
 * names the day it ends.
 *
 * The device is a first-party cookie the game itself issues (equoriaDevice, a
 * random token); only its SHA-256 is stored. Nothing here talks to a third party.
 *
 * Account standing is read on every authenticated request, so it is cached per
 * account for a short time; every conduct action evicts the account's entry, so a
 * freeze or ban takes effect on the next request.
 */

import crypto from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { REFRESH_TOKEN_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';

export const DEVICE_COOKIE = 'equoriaDevice';
const DEVICE_COOKIE_MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const STANDING_CACHE_TTL_MS = 30_000;
const standingCache = new Map();

const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const DEVICE_TOKEN_SHAPE = /^[0-9a-f]{64}$/;

/** Drop an account's cached standing; every conduct action calls this. */
export function evictStandingCache(userId) {
  standingCache.delete(userId);
}

/**
 * The account's current standing: null when in good standing, otherwise
 * { state: 'banned' } or { state: 'frozen', endsAt }.
 * @param {object} client prisma or a transaction client
 * @param {string} userId
 * @param {Date} [now]
 */
export async function accountStanding(client, userId, now = new Date()) {
  // A lift record (q101) ends everything issued before it; only rows after the
  // latest lift count.
  const all = await client.conductRecord.findMany({
    where: {
      userId,
      OR: [{ kind: 'ban' }, { kind: 'lift' }, { kind: 'freeze', endsAt: { gt: now } }],
    },
    select: { id: true, kind: true, endsAt: true },
  });
  const lastLiftId = all.reduce(
    (latest, row) => (row.kind === 'lift' && row.id > latest ? row.id : latest),
    0,
  );
  const rows = all.filter(row => row.kind !== 'lift' && row.id > lastLiftId);
  if (rows.some(row => row.kind === 'ban')) {
    return { state: 'banned' };
  }
  const endsAt = rows.reduce(
    (latest, row) => (latest === null || row.endsAt > latest ? row.endsAt : latest),
    null,
  );
  return endsAt === null ? null : { state: 'frozen', endsAt };
}

/** accountStanding through a short cache, for the per-request check. */
export async function cachedAccountStanding(userId) {
  const hit = standingCache.get(userId);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    const stale = hit.standing?.state === 'frozen' && hit.standing.endsAt.getTime() <= now;
    if (!stale) {
      return hit.standing;
    }
  }
  const standing = await accountStanding(prisma, userId, new Date(now));
  standingCache.set(userId, { standing, expiresAt: now + STANDING_CACHE_TTL_MS });
  return standing;
}

function formatEnd(endsAt) {
  const text = endsAt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  return `${text} Eastern`;
}

/**
 * The refusal for an account standing, or null. Authored words, never the code.
 * @returns {{ status: number, body: object } | null}
 */
export function standingRefusal(standing) {
  if (!standing) {
    return null;
  }
  if (standing.state === 'banned') {
    return {
      status: 403,
      body: {
        success: false,
        status: 'error',
        code: 'accountBanned',
        message: 'This account has been banned.',
      },
    };
  }
  return {
    status: 403,
    body: {
      success: false,
      status: 'error',
      code: 'accountFrozen',
      message: `Your account is frozen until ${formatEnd(standing.endsAt)}.`,
      until: standing.endsAt.toISOString(),
    },
  };
}

const blockedRefusal = {
  status: 403,
  body: {
    success: false,
    status: 'error',
    code: 'accessBlocked',
    message: 'This connection can no longer be used to sign in or create an account.',
  },
};

/** The request's address, as stored. */
export const requestIp = req => req.ip || req.connection?.remoteAddress || '';

/**
 * This browser's device hash, issuing the equoriaDevice cookie when it has none.
 * Resolved once per request.
 */
export function deviceHashFor(req, res) {
  if (req.conductDeviceHash) {
    return req.conductDeviceHash;
  }
  let token = req.cookies?.[DEVICE_COOKIE];
  if (typeof token !== 'string' || !DEVICE_TOKEN_SHAPE.test(token)) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(DEVICE_COOKIE, token, {
      ...REFRESH_TOKEN_COOKIE_OPTIONS,
      maxAge: DEVICE_COOKIE_MAX_AGE_MS,
    });
  }
  req.conductDeviceHash = sha256(token);
  return req.conductDeviceHash;
}

/** Hash a raw device token the way deviceHashFor does (tests, tools). */
export const hashDeviceToken = sha256;

/**
 * Refuse a sign-in or sign-up when this IP or device is banned, or, given a
 * userId, when the account is frozen or banned. Writes the 403 itself.
 * @returns {Promise<boolean>} true when a refusal was sent
 */
export async function refuseSignIn(req, res, { userId } = {}) {
  const ip = requestIp(req);
  const deviceHash = deviceHashFor(req, res);
  const blocked = await prisma.conductBlock.findFirst({
    where: {
      OR: [...(ip ? [{ kind: 'ip', value: ip }] : []), { kind: 'device', value: deviceHash }],
    },
    select: { id: true },
  });
  const refusal = blocked
    ? blockedRefusal
    : standingRefusal(userId ? await accountStanding(prisma, userId) : null);
  if (!refusal) {
    return false;
  }
  res.status(refusal.status).json(refusal.body);
  return true;
}

/**
 * Remember that this account signed in from this address and device. Best
 * effort: a failure only logs, so a sighting can never stop a sign-in.
 */
export async function recordLoginSighting(req, res, userId) {
  try {
    const ipAddress = requestIp(req);
    const deviceHash = deviceHashFor(req, res);
    await prisma.loginSighting.upsert({
      where: { userId_ipAddress_deviceHash: { userId, ipAddress, deviceHash } },
      create: { userId, ipAddress, deviceHash },
      update: { lastSeenAt: new Date() },
    });
  } catch (error) {
    logger.warn(`[conduct] login sighting not recorded: ${error.message}`);
  }
}
