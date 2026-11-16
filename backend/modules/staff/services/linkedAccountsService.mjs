/**
 * Linked accounts and busy addresses, for the Owner and Admins (Equoria-x5n89,
 * owner rulings q123-q126, 2026-10-27).
 *
 * Both views read the conduct system's login sightings inside their 90-day
 * retention window. Every account counts, staff included (q126). A busy address
 * is only a flag for staff to look at: it never blocks a signup or a sign-in
 * (q123); the device alone blocks, in deviceAccountLimitService.
 *
 * The device hash is a secret-derived token and is never returned.
 *
 * Equoria-puj1e.4 (owner ruling q102) adds a player's own sign-in history and the
 * accounts seen on the same internet addresses, for the holders of view.identity
 * (the Owner and Admins). Devices are shown as "device 1", "device 2", numbered
 * per player in the order they were first used; addresses are shown as stored.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { accountsPerDeviceLimit } from './deviceAccountLimitService.mjs';
import { loginSightingRetentionMs } from './staffCheckinRetentionService.mjs';

/** An address is flagged when MORE than this many accounts were seen on it. */
export const flaggedAddressThreshold = accountsPerDeviceLimit;
const maxAddresses = 100;
const accountFields = { id: true, username: true, role: true };

const windowStart = now => new Date(now.getTime() - loginSightingRetentionMs);

/**
 * Other accounts that signed in from a device this player used.
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<Array<{ id: string, username: string, role: string,
 *   sharedDevices: number, lastSeenAt: Date }>>}
 */
export async function accountsSharingDevice(userId, now = new Date()) {
  const since = windowStart(now);
  const mine = await prisma.loginSighting.findMany({
    where: { userId, lastSeenAt: { gte: since } },
    distinct: ['deviceHash'],
    select: { deviceHash: true },
  });
  if (mine.length === 0) {
    return [];
  }
  const others = await prisma.loginSighting.findMany({
    where: {
      deviceHash: { in: mine.map(row => row.deviceHash) },
      userId: { not: userId },
      lastSeenAt: { gte: since },
    },
    select: { userId: true, deviceHash: true, lastSeenAt: true },
  });
  const byUser = new Map();
  for (const row of others) {
    const entry = byUser.get(row.userId) ?? { devices: new Set(), lastSeenAt: row.lastSeenAt };
    entry.devices.add(row.deviceHash);
    if (row.lastSeenAt > entry.lastSeenAt) {
      entry.lastSeenAt = row.lastSeenAt;
    }
    byUser.set(row.userId, entry);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: accountFields,
    orderBy: { username: 'asc' },
  });
  return users.map(user => ({
    ...user,
    sharedDevices: byUser.get(user.id).devices.size,
    lastSeenAt: byUser.get(user.id).lastSeenAt,
  }));
}

/**
 * Internet addresses seen with more than four accounts, busiest first.
 * @param {Date} [now]
 * @returns {Promise<Array<{ ipAddress: string, accountCount: number,
 *   accounts: Array<{ id: string, username: string, role: string }> }>>}
 */
export async function flaggedAddresses(now = new Date()) {
  const since = windowStart(now);
  const busy = await prisma.$queryRaw`
    SELECT "ipAddress", COUNT(DISTINCT "userId")::int AS "accountCount"
    FROM login_sightings
    WHERE "lastSeenAt" >= ${since}
    GROUP BY "ipAddress"
    HAVING COUNT(DISTINCT "userId") > ${flaggedAddressThreshold}
    ORDER BY "accountCount" DESC, "ipAddress" ASC
    LIMIT ${maxAddresses}`;
  if (busy.length === 0) {
    return [];
  }
  const sightings = await prisma.loginSighting.findMany({
    where: { ipAddress: { in: busy.map(row => row.ipAddress) }, lastSeenAt: { gte: since } },
    distinct: ['ipAddress', 'userId'],
    select: { ipAddress: true, user: { select: accountFields } },
  });
  const byAddress = new Map();
  for (const { ipAddress, user } of sightings) {
    byAddress.set(ipAddress, [...(byAddress.get(ipAddress) ?? []), user]);
  }
  return busy.map(({ ipAddress, accountCount }) => ({
    ipAddress,
    accountCount,
    accounts: (byAddress.get(ipAddress) ?? []).sort((a, b) => a.username.localeCompare(b.username)),
  }));
}

const maxHistoryRows = 100;
const maxSharingAccounts = 100;
const maxSharedRows = 2000;

/**
 * Where a player signed in from inside the 90-day window, latest first.
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<Array<{ ipAddress: string, device: number,
 *   firstSeenAt: Date, lastSeenAt: Date }>>}
 */
export async function loginHistory(userId, now = new Date()) {
  const rows = await prisma.loginSighting.findMany({
    where: { userId, lastSeenAt: { gte: windowStart(now) } },
    orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
    take: maxHistoryRows,
    select: { id: true, ipAddress: true, deviceHash: true, firstSeenAt: true, lastSeenAt: true },
  });
  const deviceNumber = new Map();
  const byFirstUse = [...rows].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.id - b.id);
  for (const row of byFirstUse) {
    if (!deviceNumber.has(row.deviceHash)) {
      deviceNumber.set(row.deviceHash, deviceNumber.size + 1);
    }
  }
  return rows.map(({ ipAddress, deviceHash, firstSeenAt, lastSeenAt }) => ({
    ipAddress,
    device: deviceNumber.get(deviceHash),
    firstSeenAt,
    lastSeenAt,
  }));
}

/**
 * Other accounts that signed in from an internet address this player used.
 * A shared address is only a lead: households, schools and phone networks
 * share addresses too. It never blocks anyone (q123).
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<Array<{ id: string, username: string, role: string,
 *   sharedAddresses: string[], lastSeenAt: Date }>>}
 */
export async function accountsSharingAddress(userId, now = new Date()) {
  const since = windowStart(now);
  const mine = await prisma.loginSighting.findMany({
    where: { userId, lastSeenAt: { gte: since } },
    distinct: ['ipAddress'],
    select: { ipAddress: true },
  });
  if (mine.length === 0) {
    return [];
  }
  const others = await prisma.loginSighting.findMany({
    where: {
      ipAddress: { in: mine.map(row => row.ipAddress) },
      userId: { not: userId },
      lastSeenAt: { gte: since },
    },
    orderBy: { lastSeenAt: 'desc' },
    take: maxSharedRows,
    select: { userId: true, ipAddress: true, lastSeenAt: true },
  });
  const byUser = new Map();
  for (const row of others) {
    const entry = byUser.get(row.userId) ?? { addresses: new Set(), lastSeenAt: row.lastSeenAt };
    entry.addresses.add(row.ipAddress);
    if (row.lastSeenAt > entry.lastSeenAt) {
      entry.lastSeenAt = row.lastSeenAt;
    }
    byUser.set(row.userId, entry);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: accountFields,
    orderBy: { username: 'asc' },
    take: maxSharingAccounts,
  });
  return users.map(user => ({
    ...user,
    sharedAddresses: [...byUser.get(user.id).addresses].sort(),
    lastSeenAt: byUser.get(user.id).lastSeenAt,
  }));
}
