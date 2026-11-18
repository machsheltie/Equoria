/**
 * Shared helpers for the outage time-back suites (Equoria-puj1e.5). Real HTTP
 * and the email service's own non-production sink; nothing is mocked.
 */

import { readFileSync, existsSync } from 'node:fs';
import { expect } from '@jest/globals';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { gameDateParts } from '../../../../utils/gameTime.mjs';
import { post, staffApi } from './staffFixtures.mjs';

/** The fresh one-time codes the email service captured for this address. */
export function actionCodesFor(email) {
  const file = process.env.EMAIL_CAPTURE_FILE;
  if (!file || !existsSync(file)) {
    return [];
  }
  return readFileSync(file, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-action-code' && entry.to === email)
    .map(entry => entry.preview.match(/\b(\d{6})\b/)[1]);
}

/** Ask for a fresh code for `purpose` over HTTP and return it. */
export async function freshCode(user, device, purpose) {
  const res = await post(`${staffApi}/time-back/code`, user, { purpose }, device);
  expect(res.status).toBe(202);
  const codes = actionCodesFor(user.email);
  expect(codes.length).toBeGreaterThan(0);
  return codes.at(-1);
}

/** An instant as the Eastern wall-clock text the time-back form sends. */
export function easternWall(instant) {
  const p = gameDateParts(instant);
  const two = n => String(n).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** An instant truncated to the whole minute (what a wall-clock text can express). */
export const toMinute = ms => new Date(Math.floor(ms / 60_000) * 60_000);

/** The current hold row, to put back exactly as it was after a suite. */
export async function snapshotHold() {
  return prisma.gameControl.findUnique({ where: { id: 1 } });
}

export async function restoreHold(snapshot) {
  if (snapshot) {
    const { id, jobsHeld, heldAt, heldById, reason } = snapshot;
    const rest = { jobsHeld, heldAt, heldById, reason };
    await prisma.gameControl.upsert({ where: { id }, create: { id, ...rest }, update: rest });
  } else {
    await prisma.gameControl.deleteMany({ where: { id: 1 } });
  }
}
